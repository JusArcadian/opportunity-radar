# Opportunity Radar (app)

An installable phone app that finds entry-level tech jobs every morning, lets you save the good ones,
warns you when a saved listing closes, reminds you to follow up, and shows which skills to learn next.

- **Costs $0 to run.** GitHub hosts it (GitHub Pages) and a free GitHub robot (Actions) refreshes the jobs daily.
- **Private by design.** Your profile and saved jobs stay on your phone. There are no accounts and no server that stores user data.
- **Installs like an app** on iPhone and Android (it's a "PWA": Progressive Web App).

Version: see `PATCH_NOTES.md`. First time? Follow `docs/LAUNCH_STEPS.md`.

## Map of every file

| Path | What it is |
|---|---|
| `web/index.html` | The app's screens (Setup, Today, Jobs, Saved, Skills, Me) |
| `web/styles.css` | How it looks (light + dark mode) |
| `web/app.js` | What it does: loads jobs, scoring, saving, reminders, AI prompts |
| `web/sw.js` | Service worker: makes it installable and work offline |
| `web/manifest.webmanifest` | App name, colors, icons for the home screen |
| `web/icons/` | App icons |
| `web/data/jobs.json` | Today's jobs (written by the robot, don't edit by hand) |
| `web/data/status.json` | Which old listings are Open / Closed / Removed (robot) |
| `config/feed.json` | **The one file you edit** to change careers, search words, skills, red flags |
| `feed/fetch_jobs.py` | The robot's script that builds the job feed |
| `feed/sample_himalayas.json` | Fake jobs for offline testing (`--sample`) |
| `feed/state/history.json` | Robot memory of jobs it has seen |
| `.github/workflows/daily.yml` | The schedule: build feed at 7:40 AM ET, then publish the app (arrives in `setup/`; step 7 of LAUNCH_STEPS moves it) |
| `tools/backup.py` | Makes a dated zip in `backups/` |
| `docs/` | Launch steps, roadmap, study guide, sources |

## Run it on your PC

```powershell
python feed/fetch_jobs.py          # build a real feed (needs internet)
python -m http.server 8000 -d web  # start a local web server
```
Then open http://localhost:8000 in Chrome. (Opening index.html by double-clicking won't work: the app has to be served by a web server.)

## Rules the app follows
- It never applies for you and never sends messages. You click Apply.
- Job sources are credited on every card (Himalayas, Adzuna), Apply buttons use their links unchanged, and expired jobs are dropped.
- AI tailoring builds a prompt you paste into Claude. It only uses facts from your own resume.
