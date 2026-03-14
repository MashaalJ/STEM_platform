# Push to GitHub & Deploy Stemverse

## 1. Push this project to GitHub

You **do not** paste a link here in the project — you create a new repo on GitHub, then connect this folder to it and push.

### Step A: Create a new repository on GitHub

1. Go to [https://github.com/new](https://github.com/new).
2. **Repository name:** e.g. `stemverse` (or any name you like).
3. Leave it **empty** (no README, no .gitignore, no license).
4. Click **Create repository**.

### Step B: Connect this folder and push

In your terminal, from the **stemverse** project folder, run (replace `YOUR_USERNAME` and `REPO_NAME` with your GitHub username and repo name):

```bash
cd /Users/mashaaljawad/Downloads/stemverse

git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

Example: if your repo is `https://github.com/mashaaljawad/stemverse`:

```bash
git remote add origin https://github.com/mashaaljawad/stemverse.git
git branch -M main
git push -u origin main
```

After this, your code is on GitHub and the repo link (e.g. `https://github.com/mashaaljawad/stemverse`) is what you share or use for deployment.

---

## 2. Deploy to the web (Render)

Render runs your app in the cloud and gives you a public URL. It works with the GitHub repo you just created.

### Step A: Sign up and connect GitHub

1. Go to [https://render.com](https://render.com) and sign up (or log in).
2. Connect your **GitHub** account in Render (Account → Connect GitHub).

### Step B: Create a new Web Service

1. In the Render dashboard, click **New +** → **Web Service**.
2. **Connect repository:** choose your **stemverse** repo (the one you pushed in step 1).
3. Use these settings:
   - **Name:** `stemverse` (or any name).
   - **Runtime:** **Node**.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free (or paid if you prefer).
4. **Before clicking Create:** open **Environment** and add:
   - **Key:** `NODE_ENV` → **Value:** `production`
   - **Key:** `SESSION_SECRET` → **Value:** a long random string (e.g. 32+ characters). Generate one: `openssl rand -hex 32` in your terminal, or use a password generator. **Never commit this value to Git.**
5. Click **Create Web Service**.

Render will clone your repo, run the build, then start the app. When it finishes, you’ll get a URL like `https://stemverse-xxxx.onrender.com`.

### Step C: Use your live app

- Open the URL Render gives you. The app will use SQLite (on free tier the filesystem can be ephemeral, so data may reset if the service sleeps or restarts).
- For persistent data, add a managed database later (e.g. Render PostgreSQL).

---

## 3. Secure deployment checklist (avoid leaks and breaches)

Do these so your deployment stays secure:

| Item | What to do |
|------|------------|
| **SESSION_SECRET** | Set in production only. Use a long random string (32+ chars). Never put it in code or commit to Git. On Render: Environment → add `SESSION_SECRET`. |
| **Secrets in env only** | No API keys or passwords in source code. Use `.env` locally and the host’s **Environment** / **Secrets** in production. `.env` is in `.gitignore`; never commit it. |
| **HTTPS** | Use the host’s HTTPS URL only. The app sets `secure: true` on cookies in production so they’re only sent over HTTPS. |
| **No default secret in prod** | The server **exits with an error** if `NODE_ENV=production` and `SESSION_SECRET` is missing or still the dev default. So production won’t start without a real secret. |
| **Security headers** | The server sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and in production `Strict-Transport-Security` so browsers use HTTPS. |
| **Auth and access** | Login/signup are rate-limited. Sessions are httpOnly and sameSite. Students can only read/update their own profile and progress; teachers/admins have broader access. |
| **Dependencies** | Run `npm audit` occasionally and fix high/critical issues. Keep Node and dependencies updated. |

After deployment, use only the **HTTPS** URL and ensure `SESSION_SECRET` (and any other secrets) are set only in the host’s environment, not in the repo.

---

## Summary

| Step | What you do |
|------|-------------|
| 1 | Create an **empty** repo on GitHub. |
| 2 | In the stemverse folder: `git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git` then `git push -u origin main`. |
| 3 | Share the repo link: `https://github.com/YOUR_USERNAME/REPO_NAME`. |
| 4 | On Render: New Web Service → connect repo → set **Environment**: `NODE_ENV=production`, `SESSION_SECRET=<long random string>` → Build: `npm install && npm run build`, Start: `npm start` → Deploy. |
| 5 | Use the **HTTPS** Render URL as your live app link. Never commit secrets. |

No need to paste any link “into” the project; you only use the GitHub repo URL when connecting Render (and when sharing the repo with others).
