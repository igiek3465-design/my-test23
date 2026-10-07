# Deploy ROBLOX Classic on Render.com (free)

Your site is a pure Python web server (no Node, no pip packages).  
These steps make it run on **Render** so anyone on the internet can open it.

---

## What was changed for cloud hosting

1. **Port** – uses the `PORT` environment variable (Render requires this). Locally it still defaults to `5000`.
2. **Data folder** – on Render, accounts/games save under `./data` inside the service. Locally still uses `~/RobloxClassicData`.
3. **HTTPS** – public URLs use `https://` correctly when behind Render’s proxy.
4. Added `requirements.txt` and `render.yaml` so Render detects a Python app.

---

## Option A – Deploy from GitHub (recommended)

### 1. Put the project on GitHub

1. Create a free account at [github.com](https://github.com) if you don’t have one.
2. Create a **new repository** (e.g. `roblox-classic`). Leave it empty (no README).
3. On your PC, open a terminal in the project folder (the one that contains `run.py`) and run:

```bash
git init
git add .
git commit -m "ROBLOX Classic Browser – ready for Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/roblox-classic.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Create the service on Render

1. Go to [render.com](https://render.com) → **Sign up** (you can use “Sign up with GitHub”).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select the `roblox-classic` repo.
4. Settings:

| Field            | Value                          |
|------------------|--------------------------------|
| Name             | `roblox-classic` (or any name) |
| Region           | closest to you                 |
| Runtime          | **Python 3**                   |
| Build Command    | `echo "no build"`              |
| Start Command    | `python run.py`                |
| Instance Type    | **Free**                       |

5. Click **Create Web Service**.

6. Wait 1–3 minutes. When the status is **Live**, open the URL Render shows  
   (something like `https://roblox-classic-xxxx.onrender.com`).

That’s it — the classic Roblox site should load.

---

## Option B – Deploy without Git (manual zip)

1. Zip the whole project folder (must include `run.py`, `index.html`, `multiplayer.py`, images, etc.).
2. On Render: **New +** → **Web Service** → **Deploy from existing image / other** is limited;  
   GitHub is strongly preferred. If you only have a zip, use Option A after uploading the zip contents to a new GitHub repo via the web UI (Upload files).

---

## After it is live

- Share the `https://….onrender.com` link with friends. They open it in any browser.
- **Accounts & places** are stored on the server under `./data`.
- **Free tier note:** the service spins down after ~15 minutes of no traffic. The first request after sleep can take 30–60 seconds. Data on the free disk is **ephemeral** (can be wiped on redeploy). For permanent save, add a **Persistent Disk** on a paid plan and set env var `DATA_DIR` to the mount path (e.g. `/var/data`).

---

## Local test (same code)

```bash
python run.py
# or
python3 run.py
```

Then open `http://127.0.0.1:5000`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails / “no module” | You don’t need any pip packages. Build command can be empty or `echo ok`. |
| “Application failed to respond” | Start command must be exactly `python run.py`. Check Logs for Python errors. |
| Site works but data resets | Free plan has no persistent disk. Redeploys wipe `./data`. |
| Port errors | Do not hardcode 5000 in start command; the code already reads `$PORT`. |
| HTTPS mixed content | Already fixed – server respects `X-Forwarded-Proto`. |

---

## Optional: Blueprint deploy

If your repo contains `render.yaml`, on Render you can also use **New + → Blueprint** and select the repo; it will create the web service with the settings in that file.
