# Sources

| What | Source | Used for |
|---|---|---|
| Himalayas jobs API + terms | https://himalayas.app/api | Remote job feed; rules: credit Himalayas, use applicationLink unchanged, drop expired jobs, no redistribution to other boards, no CORS (call from the robot) |
| Himalayas closed-job check | `GET /jobs/api/companies/:company/jobs/:slug` (200 open, 410 closed, 404 removed), same page | Listing status |
| Adzuna API | https://developer.adzuna.com | Optional local jobs ("Jobs by Adzuna" credit required) |
| Remotive API + terms | https://github.com/remotive-com/remote-jobs-api | Remote jobs; rules: credit Remotive, link to the Remotive job URL, max ~4 requests/day (we make 1), no passing jobs to other boards, jobs are delayed 24h |
| Jobicy API + terms | https://github.com/Jobicy/remote-jobs-api | Remote US jobs (`/api/v2/remote-jobs?count=200&geo=usa`); rules: keep Jobicy as the source, keep their job URL, poll at most once an hour (we poll once a day) |
| The Muse public API | https://www.themuse.com/developers/api/v2 | Entry-level jobs by city + remote; credit The Muse, link to their job page |
| Scam warning signs (red flags / check notes) | FTC "Job Scams" consumer advice: https://consumer.ftc.gov/articles/job-scams | Why each red flag matters (fake checks, pay-to-train, chat-only interviews, reshipping) |
| Pay benchmark | BLS Occupational Outlook Handbook, Computer Support Specialists, May 2025: https://www.bls.gov/ooh/computer-and-information-technology/computer-support-specialists.htm | Help desk / support pay check: bottom 10% $40,980/yr (~$19.70/hr), median $61,860/yr (~$29.74/hr) |
| PWA basics | MDN Web Docs: Progressive web apps | Manifest, service worker, install |
| GitHub Pages + Actions | docs.github.com (Pages "publishing with a custom GitHub Actions workflow"; Actions "schedule" event) | Free hosting + daily robot |
| Competitor reference | https://pdftrendlabapp.com | Trend Finder planning ($25 lifetime, "real-time search data") |

## Gig sites (Gigs tab, v0.2.0, checked 2026-10-22)

| What | Source | Used for |
|---|---|---|
| UserTesting, Userlytics, Userbrain, Userfeel, Respondent, PlaytestCloud, Test IO pay + payout | https://www.theworkathomewoman.com/test-websites/ | Gig cards |
| Prolific ($8/hr minimum, $12 recommended, $6 cash-out, 72-hour first cash-outs) | https://www.finder.com/make-money-online/prolific-review | Gig card |
| User Interviews ($60-$250 sessions) | https://dollarsprout.com/paid-research-study-side-hustle/ | Gig card |
| DataAnnotation, Outlier, Alignerr, Mindrift, Mercor, Handshake AI pay + payout | https://www.keepertax.com/posts/best-ai-training-jobs | Gig cards |
| Upwork fee 0-15%, Connects $0.15 | https://golance.com/blogs/upwork-fees-explained-2026 | Gig card |
| HelloTech (avg $100+/job, weekly, car) | https://jobs.disabilitytalent.org/jobs/488981433-hellotech-technician-application | Gig card |
| Field Nation (10% fee, paid Fridays after approval) | https://fieldnation.com/resources/technician-fees | Gig card |
