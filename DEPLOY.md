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
4. Click **Create Web Service**.

Render will clone your repo, run the build, then start the app. When it finishes, you’ll get a URL like `https://stemverse-xxxx.onrender.com`.

### Step C: Use your live app

- Open the URL Render gives you. The app will use an in-memory SQLite database on the free tier (data can reset if the service sleeps or restarts).
- To keep data across restarts, you’d later add a persistent database (e.g. Render PostgreSQL or an external SQLite volume), but the steps above are enough to get a live link.

---

## Summary

| Step | What you do |
|------|-------------|
| 1 | Create an **empty** repo on GitHub. |
| 2 | In the stemverse folder: `git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git` then `git push -u origin main`. |
| 3 | Share the repo link: `https://github.com/YOUR_USERNAME/REPO_NAME`. |
| 4 | On Render: New Web Service → connect that repo → Build: `npm install && npm run build`, Start: `npm start` → Deploy. |
| 5 | Use the Render URL as your live app link. |

No need to paste any link “into” the project; you only use the GitHub repo URL when connecting Render (and when sharing the repo with others).
