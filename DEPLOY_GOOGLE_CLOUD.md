# Deploy Stemverse to Google Cloud (with your credits)

Use this guide to deploy your app to **Google Cloud Run** using your incubation center’s Google Cloud credits.

---

## Prerequisites

1. **Google Cloud account** with credits applied (use the link/code from your incubation center if you haven’t activated yet).
2. **Google Cloud CLI (gcloud)** installed:
   - Mac: `brew install google-cloud-sdk`
   - Or download: https://cloud.google.com/sdk/docs/install

---

## Step 1: Log in and create a project

1. Open a terminal and run:
   ```bash
   gcloud auth login
   ```
   Sign in with the Google account that has the credits.

2. Create a new project (or use an existing one):
   ```bash
   gcloud projects create stemverse-app --name="Stemverse"
   ```
   If you get “project ID already exists,” pick a different ID (e.g. `stemverse-yourname`).

3. Set it as the active project and link billing (required for Cloud Run):
   ```bash
   gcloud config set project stemverse-app
   ```
   Then in the browser: **Google Cloud Console** → [Billing](https://console.cloud.google.com/billing) → link a billing account (your credits will apply here).

---

## Step 2: Enable required APIs

Run:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

---

## Step 3: Generate SESSION_SECRET

In the same terminal:

```bash
openssl rand -hex 32
```

Copy the output (e.g. `a1b2c3d4e5f6...`). You’ll use it in the next step.

---

## Step 4: Deploy to Cloud Run

From your **project folder** (where `Dockerfile` and `package.json` are):

```bash
cd /Users/mashaaljawad/Downloads/stemverse

gcloud run deploy stemverse \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,SESSION_SECRET=PASTE_YOUR_SECRET_HERE"
```

- Replace `PASTE_YOUR_SECRET_HERE` with the string from Step 3.
- First deploy can take 5–10 minutes (builds the container, then deploys).

When it finishes, you’ll see a line like:

**Service [stemverse] URL: https://stemverse-xxxxx-uc.a.run.app**

That’s your live app URL.

---

## Step 5: Open your app

Open the URL in your browser. You should see the Stemverse login.  
Create an account or use Quick Access (in dev mode) to log in.

---

## Optional: Change region

To use a region closer to you (e.g. Europe):

```bash
gcloud run deploy stemverse \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,SESSION_SECRET=YOUR_SECRET"
```

---

## Updating the app after code changes

1. Commit and push to GitHub (if you want the repo in sync).
2. From the project folder, run the same deploy command again (with your real `SESSION_SECRET`):

   ```bash
   gcloud run deploy stemverse \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "NODE_ENV=production,SESSION_SECRET=YOUR_SECRET"
   ```

Cloud Run will build a new image and switch traffic to it.

---

## Changing env vars (e.g. SESSION_SECRET) later

1. In [Cloud Console](https://console.cloud.google.com): **Cloud Run** → click **stemverse**.
2. **Edit & deploy new revision** → open **Variables & secrets**.
3. Add or edit `NODE_ENV` and `SESSION_SECRET` → **Deploy**.

---

## Summary

| Step | Command / action |
|------|-------------------|
| 1 | `gcloud auth login` → create project → set project → link billing |
| 2 | `gcloud services enable run.googleapis.com cloudbuild.googleapis.com` |
| 3 | `openssl rand -hex 32` → copy the value |
| 4 | `gcloud run deploy stemverse --source . --region us-central1 --allow-unauthenticated --set-env-vars "NODE_ENV=production,SESSION_SECRET=YOUR_SECRET"` |
| 5 | Open the URL shown in the terminal |

Your app runs on Cloud Run and uses your Google Cloud credits. SQLite data is stored in the container; for persistent data across redeploys you’d add Cloud SQL or another database later.
