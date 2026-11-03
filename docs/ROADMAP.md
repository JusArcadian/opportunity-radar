# Roadmap: from personal tool to real apps

Three apps, one foundation. Everything starts free and only costs money once it earns money.

## The shared foundation (built in Radar v0.1, reused by the other two)
- **App shell:** installable PWA (manifest + service worker), bottom tabs, light/dark design, backup/restore.
- **Daily robot:** a GitHub Actions job builds a JSON "feed" every morning and publishes the app with it.
- **Local-first data:** each person's data stays on their phone until accounts exist.
Copy this folder to start a new app, then swap the feed script and the screens.

## App 1: Opportunity Radar (job search)
| Version | What it adds | Cost |
|---|---|---|
| **v0.1 (now)** | Installable app, daily feed, save/skip/apply, closed listings, follow-ups, skill gaps, AI prompts | $0 |
| v0.2 | Real phone notifications ("3 new jobs", "follow up today"). Needs a tiny free server (Cloudflare Workers) to send Web Push. iPhone needs iOS 16.4+ and the app installed to the home screen. | $0 |
| v0.3 | Accounts + sync across phones (Supabase free tier), privacy policy, delete-my-account button | $0 |
| v0.4 | Built-in AI: tailored resume and interview prep inside the app (Claude API). Paid feature or "bring your own key", because AI calls cost money. | pay-as-you-go |
| v1.0 | Own domain (~$12/yr), landing page, feedback form, terms + privacy, launch to other job seekers | ~$12/yr |
| Store apps | Wrap the same app for Google Play ($25 once) and the App Store ($99/yr) using Capacitor or PWABuilder | $25 + $99/yr |

Selling notes: job data from Himalayas may be shown in your own app (credit them, use their apply links,
never resell the listings to other job boards). Check each source's terms again before charging money.

## App 2: Paycheck Planner (budget app)
Turn the spreadsheet into an app with the same features: take-home pay from IRS brackets, custom groups and %,
inflation, real paydays for any schedule, spending + money-in logs, dashboard.
- v0.1: local-first app with the tax math ported from `build_template.py`; export to Excel.
- v0.2: monthly report screen + charts; reminders on paydays.
- v1.0: accounts + sync; sell as a one-time unlock (the template buyers get the app free).

## App 3: Trend Finder (niches, problems, demand)
What it shows (you picked all four):
1. **Digital product niches:** what PDFs, templates, planners and printables are selling.
2. **Problems people search:** questions and pain points to turn into guides.
3. **Tech/cyber service demand:** what small businesses need help with (feeds your cyber side hustle).
4. **Rising keywords:** terms growing fast, with a simple trend score (growth this week vs. last 4 weeks).

Free, official data sources to start with (each needs its terms checked before selling):
- Wikipedia Pageviews API: daily interest in topics (official, free).
- Stack Exchange API: tech questions people ask, with votes and views (official, free key).
- Hacker News API: what tech people discuss (official, free).
- YouTube Data API: video titles and view counts by topic (free daily quota).
- Reddit API: problems and complaints (free for personal use; commercial use needs Reddit's approval).
- Etsy Open API: product listings and favorites (free key; terms limit how data is shown).
Avoid scraping Google Trends or Pinterest: no official public API, and scraping breaks their terms.

Plan: same daily robot → `trends.json` → app with tabs Niches / Problems / Demand / Rising, each item linking
to its sources, plus "Save idea" and "Turn into a product" (AI prompt for an outline).
Competitor to beat: PDF Trend Lab ($25 lifetime). Edge: covers templates and tech services too, shows sources.

## Suggested order
1. Launch Radar v0.1 for yourself (this week).
2. Trend Finder v0.1 (helps pick Paycheck Planner niches and cyber services).
3. Radar v0.2 notifications.
4. Paycheck Planner app v0.1.
5. Accounts (v0.3) for all three, then launch publicly.
