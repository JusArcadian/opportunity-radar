# Launch steps: get Radar live on your phone (about 20 minutes, $0)

You'll put the project on GitHub, turn on the free hosting, run the robot once, then install the app.

## Part A: put it on GitHub
1. Go to github.com and sign in (use your professional account/email).
2. Click **+** (top right) → **New repository**.
3. Name it `opportunity-radar`.
4. Choose **Public**. Why: free GitHub Pages hosting needs a public repo. Nothing personal is in this project
   (your saved jobs live only on your phone), and a public repo doubles as a portfolio piece.
5. Leave "Add a README" **unchecked** (we already have one). Click **Create repository**.
6. In PyCharm, open the folder `Portfolio\Apps\OpportunityRadar`.
7. Open the **Terminal** tab at the bottom of PyCharm and run these one at a time
   (replace `YOUR-USERNAME` with your GitHub username):
   ```powershell
   git init
   git add .
   git commit -m "v0.1.0: first installable version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/opportunity-radar.git
   git push -u origin main
   ```
   If it asks you to sign in, choose "Sign in with your browser".

## Part B: turn on hosting and the robot
8. On the repo page: **Settings** → **Pages** (left menu).
9. Under **Build and deployment** → **Source**, pick **GitHub Actions**.
10. Still in Settings: **Actions** → **General** → scroll to **Workflow permissions** → pick **Read and write permissions** → **Save**.
11. Click the **Actions** tab (top of the repo) → **Daily feed + deploy** (left) → **Run workflow** → **Run workflow**.
12. Wait 1-3 minutes until both steps show a green check. ✅
13. Your app is live at: `https://YOUR-USERNAME.github.io/opportunity-radar/`

## Part C: install it
14. **iPhone:** open that link in **Safari** → tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
15. **Android:** open it in **Chrome** → tap **⋮** → **Install app**.
16. Open Radar from your home screen and finish the setup screen. Paste your resume on that screen to get better AI prompts.

From now on the robot runs every morning at 7:40 AM Eastern by itself.

## Optional: local South Florida jobs (Adzuna, free)
1. Sign up at developer.adzuna.com and create an app. Copy the **App ID** and **App Key**.
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   Add `ADZUNA_APP_ID` with the App ID, then `ADZUNA_APP_KEY` with the App Key.
3. In `config/feed.json`, change `"enabled": false` to `"enabled": true` under `"local"`. Commit and push.
4. Run the workflow again (step 11). In the app, turn on "Local jobs near me" on the Me tab → Edit.

## Test checklist
| Do this | You should see |
|---|---|
| Open the app for the first time | The "Set up Radar" screen |
| Pick careers, tap **Save and show my jobs** | The Jobs tab with cards (after the robot has run) |
| Tap **Save** on a job | It moves to the **Saved** tab |
| On Saved, set Status to **Applied** | A chip "Applied Oct 22" and a reminder 7 days later on Today |
| Tap **Tailor resume with AI** | "Prompt copied" → paste it into Claude |
| Turn on airplane mode, open the app | It still opens and shows your saved jobs |
| Me → **Download backup** | A `radar-backup-YYYY-MM-DD.json` file |

## If something goes wrong
- **Actions run is red:** click it, open the failed step, copy the error, and send it to Claude.
- **The page shows "No job feed yet":** the robot hasn't run. Do step 11.
- **Old version still showing on your phone:** close the app completely and open it again (updates install on the next launch).
