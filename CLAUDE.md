# CLAUDE.md - rules for Claude in this project

## About the owner
- Beginner programmer. Explain things in plain English, "like I'm 5" when something is new.
- Wants numbered step-by-step instructions for anything they do themselves.
- Windows 11 + PyCharm. Project folder: `C:\Users\terre\OneDrive\Documents\Portfolio\Apps\OpportunityRadar`

## After EVERY change (required)
1. Back up first: `python tools/backup.py "what you're changing"`
2. Make the change. Prefer editing `config/feed.json` over changing scripts.
3. If you changed anything in `web/`, bump `VERSION` in `web/sw.js` (so phones get the update) and the version on the Me tab in `web/index.html`.
4. Test: `python feed/fetch_jobs.py --sample`, then `python -m http.server 8000 -d web` and click through every tab.
5. Update `PATCH_NOTES.md` (Features / Bugs fixed / Buffs / Nerfs).
6. Update `docs/STUDY_GUIDE.md` with the new code and a simple explanation; errors go in "When things break".
7. Update `docs/SOURCES.md` for any new site, API or number.
8. Back up again: `python tools/backup.py "after: ..."`, then commit with a short message. Push only when the owner says so.
9. In chat: short summary, the changed code explained simply, and a test checklist.

## Coding rules
- Plain HTML/CSS/JavaScript in `web/` (no build step, no npm). Python standard library only in `feed/`.
- Escape every value from the feed before putting it on screen (`esc()` in app.js).
- Never store personal data on a server. User data stays in the phone's localStorage.
- Job sources: keep the attribution link, use the source's apply link unchanged, drop expired jobs,
  never add JobPosting structured data or pass listings to other job boards (Himalayas terms).

## Safety rules
- Never commit API keys. Adzuna keys live only in GitHub Secrets (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`).
- Never auto-apply or auto-message. Ask before deleting files.
