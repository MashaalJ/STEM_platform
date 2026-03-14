# Using Your Incubation Center’s Cloud Credits

## Step 1: Find out which cloud provider you have

Your credits are tied to a **specific provider**. You need to know which one.

**Do this:**

1. **Check the email** from the incubation center that mentioned “cloud credits.” It usually says something like:
   - “Google Cloud credits” → **Google Cloud (GCP)**
   - “AWS credits” / “Amazon Web Services” → **AWS**
   - “Azure credits” / “Microsoft Azure” → **Azure**
   - “DigitalOcean” / “Oracle Cloud” / another name → that provider

2. **Log in to the incubation center’s portal** (member dashboard, startup program, etc.). Look for:
   - A “Cloud” or “Credits” or “Benefits” section
   - Links to “Activate credits” or “Redeem” that take you to a provider (Google, AWS, Azure, etc.)

3. **Ask the program manager:**  
   *“Which cloud platform are our credits for, and how do I activate or redeem them?”*

4. **Typical programs:**
   - **Google for Startups / Google Cloud for Startups** → Google Cloud
   - **AWS Activate** → Amazon Web Services
   - **Microsoft for Startups** → Azure
   - **Oracle for Startups** → Oracle Cloud

Once you know the provider (e.g. “Google Cloud” or “AWS”), use the matching section below to deploy Stemverse.

---

## Step 2: Deploy based on your provider

### If your credits are **Google Cloud (GCP)**

1. **Activate credits** (if you haven’t):
   - Go to [Google Cloud Console](https://console.cloud.google.com).
   - Sign in with the account linked to your incubation program.
   - If you got a link/code from the incubation center, use it to apply credits to this project.

2. **Create a project:**
   - In the console, create a new project (e.g. `stemverse`) and note the **Project ID**.

3. **Deploy with Cloud Run** (good use of credits, serverless):
   - Install [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install) and run `gcloud init` and `gcloud auth login`.
   - From your project folder (where `server.ts` and `package.json` are), build and deploy:
     ```bash
     # Set your project
     gcloud config set project YOUR_PROJECT_ID

     # Build and push a container (you need a Dockerfile – see below)
     gcloud run deploy stemverse --source . --region us-central1 --allow-unauthenticated
     ```
   - Cloud Run will build from source. You need a **Dockerfile** in the repo so Cloud Run can build a container. (See “Dockerfile for Stemverse” at the bottom of this file.)

4. **Set environment variables in Cloud Run:**
   - In Cloud Console: **Cloud Run** → your service **stemverse** → **Edit & deploy new revision** → **Variables & secrets**.
   - Add:
     - `NODE_ENV` = `production`
     - `SESSION_SECRET` = your long random string (e.g. from `openssl rand -hex 32`).

5. Your app URL will look like: `https://stemverse-xxxxx-uc.a.run.app`.

---

### If your credits are **Amazon Web Services (AWS)**

1. **Activate credits:**
   - Use the link/code from your incubation center (often AWS Activate) and log in to the AWS account that will hold the credits.

2. **Deploy with AWS App Runner or Elastic Beanstalk:**
   - **App Runner** (simpler): In AWS Console → **App Runner** → Create service → Source: GitHub → connect **MashaalJ/STEM_platform**. Set build command `npm install && npm run build`, start command `npm start`, add env vars `NODE_ENV=production` and `SESSION_SECRET=...`.
   - **Elastic Beanstalk**: Create an environment for “Node.js,” upload your code (or connect GitHub), set the same build/start commands and env vars in the environment configuration.

3. Add **SESSION_SECRET** and **NODE_ENV=production** in the service’s environment variables.

---

### If your credits are **Microsoft Azure**

1. **Activate credits** in the Azure portal (using the link/code from the incubation center).

2. **Deploy with Azure App Service:**
   - In Azure Portal: **Create a resource** → **Web App**.
   - Runtime: **Node 20 LTS** (or latest Node).
   - After creation: **Deployment Center** → connect your GitHub repo **MashaalJ/STEM_platform**.
   - Set **Build command:** `npm install && npm run build`, **Start command:** `npm start`.
   - In the app’s **Configuration** → **Application settings**, add:
     - `NODE_ENV` = `production`
     - `SESSION_SECRET` = your long random string.

---

### If your credits are **another provider** (DigitalOcean, Oracle, etc.)

- **DigitalOcean App Platform:** Connect GitHub repo, choose Node.js, set build command `npm install && npm run build`, start command `npm start`, and add `NODE_ENV` and `SESSION_SECRET` in the app’s env vars.
- **Oracle Cloud:** Typically you get a VM or use their “Always Free” tier; you’d install Node, clone your repo, run `npm install && npm run build && npm start`, and put the app behind their load balancer or use a process manager like `pm2`.

If you tell me the exact provider name, I can give step-by-step clicks for that platform.

---

## What your app needs on any cloud

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Env vars:** `NODE_ENV=production` and `SESSION_SECRET=<long random string>`
- **Port:** The server reads `process.env.PORT`; most clouds set this automatically.

---

## Dockerfile for Stemverse (for Google Cloud Run or any container-based deploy)

If your provider expects a **Dockerfile** (e.g. Google Cloud Run with “build from source” or a container registry), add this file in your project root (same folder as `package.json`):

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.ts ./
# Install tsx for running TypeScript in production
RUN npm install tsx
EXPOSE 8080
ENV PORT=8080
CMD ["npx", "tsx", "server.ts"]
```

Then in Cloud Run (or wherever) set `PORT=8080` if needed, and set `SESSION_SECRET` in the service’s environment.

---

## Quick summary

| You have…              | Do this first                          | Then…                                              |
|------------------------|----------------------------------------|----------------------------------------------------|
| Don’t know provider    | Check email + portal + ask program     | Use the section above for that provider            |
| Google Cloud credits   | Activate in GCP, create project        | Deploy with Cloud Run (+ Dockerfile if required)   |
| AWS credits            | Activate in AWS                        | Deploy with App Runner or Elastic Beanstalk        |
| Azure credits          | Activate in Azure                      | Deploy with App Service, connect GitHub, set env   |

If you tell me the **exact name of the cloud** (e.g. “Google Cloud for Startups” or “AWS Activate”), I can give you a minimal, copy-paste deployment guide for that one.
