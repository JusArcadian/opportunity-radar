# Patch notes

## v0.9.3 (2026-11-06): easier to tap on phones

### Buffs
- The "Show jobs below my pay floor" checkbox and every other tick-box row are now about 44px tall, so they're easy to hit with a thumb.
- Folded boxes like "Skills and certificates you have" have a bigger tap area on their title line.

## v0.9.2 (2026-11-06): works from any US ZIP code

### Features
- **ZIP code replaces Home ZIP + Home city.** Type a ZIP code anywhere in the US and Radar finds your city. The South Florida city list is gone from Setup.
- **Distance and drive times work anywhere** when a job has a map location. Adzuna jobs include one when available.

### Buffs
- In-person jobs show if they're within about 100 road miles of home, wherever home is. This replaces the South Florida ZIP check.
- Setup won't save with both Remote and Local unticked, since that shows no jobs.
- Pay that Adzuna estimated says "(estimate)".
- Take-home pay no longer says Florida: it covers federal tax and FICA, and says state tax isn't included.
- Event form examples are no longer South Florida names.
- Old profiles get their city and map dot the next time the app opens.

## v0.9.1 (2026-11-06): more jobs inside Radar

### Features
- **Local jobs are on.** Adzuna now adds in-person jobs around Miami, Fort Lauderdale and West Palm Beach to the daily feed, as normal Radar cards with Save and My resume.

### Buffs
- "Search right now" is now a small folded **Search other job sites** box, so Radar's own jobs come first. When nothing matches, the card says why and what to change.
- New users have local jobs turned on by default.
- In-person jobs only show for South Florida ZIPs (or no ZIP), since the feed only covers that area for now.
- Adzuna: one search per job type per city, up to 50 results each, spaced out to stay under the free key's limits.

### Bugs fixed
- The Adzuna credit now links to Adzuna and meets their minimum size.

## v0.9.0 (2026-11-06): pick any job, not just 13

### Features
- **Searchable "Jobs to look for" menu.** The 13 checkboxes became one search box with 143 kinds of jobs in 18 groups. Type a job, another name for it, or a big employer ("Chipotle", "CNA", "WFH"), or open a group to browse. Small typos still work.
- **Add your own job.** If it isn't listed, one tap adds it, and Radar matches it against job titles.
- **Search right now** uses every pick, including custom jobs (first 8 picks).

### Bugs fixed
- **The senior-job filter was throwing away normal jobs.** "iv" (for Tier IV) also matched inside "driver", "delivery", "representative" and "executive", so jobs like Delivery Driver and Customer Service Representative never reached the app. The filter now checks whole words only.
- "Staff" now only blocks senior titles like Staff Engineer, not Wait Staff.

### Buffs
- The daily feed keeps up to 300 jobs that fit no main career, as "Other jobs", in-person ones first. The app only shows them when they match someone's picks. Careers stay in `config/feed.json`.
- New users start with nothing ticked instead of Help desk and Tech support.
- Anyone already set up keeps their picks.

## v0.8.2 (2026-11-03): Radar is only about jobs

### Nerfs
- **Removed the Money tab** (Gigs and the used-tech Deals checker). Radar now has 6 tabs: Today, Jobs, Saved, Events, Skills, Me. The code and gig list are kept in `docs/money_tab_moved_out.txt` and `docs/gigs.json`, so they can move to another project. Your old gig and deal entries are still inside your backup file, not deleted.

### Bugs fixed
- The "Search right now" box said Radar updates 3 times a day; it updates every morning.

## v0.8.1 (2026-11-03): no waiting for jobs

### Features
- **Search right now.** When Radar's list has nothing for you (new user, new job type, a quiet day), the Jobs tab shows one-tap **Indeed / Google / Snagajob** searches for exactly the kinds of jobs you picked, near your ZIP or remote. No more "check back tomorrow."
- (Tried updating the job list 3 times a day, then went back to once a day: "Search right now" already means nobody waits.)

### Buffs
- "Local job sources near you" works anywhere in the US: the Florida-only links (CareerSource South Florida, Miami Craigslist, Miami-Dade jobs) became nationwide ones (American Job Centers from the U.S. Dept. of Labor, Craigslist for your city, city/county jobs near your ZIP).

## v0.8.0 (2026-11-03): Radar for any job, any resume

### Features
- **Read any resume.** In Setup, paste your resume or pick a **.docx / .txt** file and tap **Read my resume**. Radar finds your jobs (by their dates), bullets, skills, education and certificates, fills **My resume facts** for you, and checks your skills. On the Me tab: **Fill from a resume file** and **Turn a pasted resume into facts** (you review before saving). It all runs on the phone: no AI, nothing uploaded. PDF: copy the text and paste it.
- **7 new kinds of jobs:** Call center / customer service, Driver / delivery, Healthcare support, Office / admin, Restaurant / food service, Retail / store, Warehouse / logistics.
- **Resumes for those jobs.** New resume types (Restaurant, Warehouse, Office, Healthcare, Driver) pick your best-matching bullets and skills for each kind of job.
- 20 everyday skills added (Cash handling, POS / register, Food safety, ServSafe, Forklift, Data entry, CPR / First aid, Bilingual (Spanish), and more). Skills found in your resume that aren't on the list get added for you.

- **PDF resumes.** Pick a PDF and Radar reads it on the phone. It uses Mozilla's free pdf.js reader, stored inside the app in `web/vendor/pdfjs/`, so the file is never uploaded.
- **About Radar and your privacy** card on the Me tab, in plain words: what Radar does and doesn't do.
- **Money tab is optional.** New users choose it in Setup (off by default). Anyone who set up Radar earlier keeps it.

### Buffs
- **Setup starts with your resume.** Skills sit in a folded box that your resume fills in for you, instead of a wall of 60 checkboxes.
- **Saved job cards are calmer**: Apply, My resume and Status up front. Talking points, Directions, Tailored resume and cover letter help are under **More**.
- "Copy AI prompt" is now **Help writing a cover letter**, with one line explaining how to use it.
- The resume-facts format example is folded under **Show the format**.
- Home city label says honestly that distance and drive times only work in South Florida for now.
- Job types and resume types are listed A to Z.
- In-person job types skip the remote-only job site, so the robot makes fewer wasted requests.

### Bugs fixed
- "1 jobs match" → "1 job matches"; "1 skills on file" → "1 skill on file".
- The "Listing not seen today" chip no longer shows on jobs you added yourself or imported from your sheet.

### Nerfs
- In-person jobs mostly come from The Muse (and Adzuna once it's turned on), so expect fewer of them than remote jobs for now. The "Local job sources near you" links (Indeed, Snagajob, store career pages) fill the gap.

## v0.7.1 (2026-11-03): bring your Google Sheet into the app

### Features
- **Import files.** Me → Load backup now understands an *import file* (`"radarMerge": true`). It ADDS saved jobs, events and resume facts and never deletes anything. Loading it twice doesn't make duplicates. A normal full backup still replaces everything, as before.
- Saved jobs can show **notes** and a **Tailored resume (Docs)** button.

## v0.7.0 (2026-11-03): more job sites, job summaries, red flags explained

### Features
- 3 new free job sites: **Remotive** and **Jobicy** (remote US jobs) and **The Muse** (entry-level jobs in Miami / Fort Lauderdale plus remote). Turn any of them off in `config/feed.json` → `sources`.
- Every job card has **"What this job is & what they want"**: what you'd do, what they require, nice-to-haves, years of experience asked and whether a degree is mentioned. It's built only from the posting's own words.
- Red flags now open with a **?** that explains WHY each one is a warning.
- New yellow **"thing to check"** notes (the job still shows): commission only, 1099 contractor, personal Gmail/Yahoo email to apply, "hired immediately", starter-kit fees, reshipping, no company name, very short description, pay far above normal.

### Buffs
- The "Where jobs come from" card lists all sources, and every job links back to the site it came from.

## v0.6.4 (2026-11-03): blank resume facts template

### Buffs
- Me → My resume facts: the example format is now a general blank template anyone can follow (City, State; Job title; Mon YYYY; Group name) instead of examples tied to one person's location, field or cert.

## v0.6.3 (2026-11-02): fresh install for everyone

### Bugs fixed
- New visitors no longer see Terrence's details: setup starts blank (name, ZIP, city), the follow-up message and
  talking points no longer mention Security+ or "your sheet" templates. Your own saved profile is unchanged.

## v0.6.2 (2026-11-02)

### Nerfs (on purpose)
- The daily feed skips jobs that aren't entry level: titles with supervisor, VP, market/business development,
  account/sales executive, and any job whose lowest pay is over $45/hr (`max_entry_hourly` in config/feed.json).

## v0.6.1 (2026-11-02)

### Bugs fixed
- "Near me" showed only remote jobs: every in-person job was 25+ miles away. Distances now use the ZIP in a
  job's location when there is one ("Miami, FL 33186" = West Kendall, ~20 mi), roads count as +20% (was +30%),
  and when nothing is close Radar shows the nearest in-person job and how to raise the distance.

## v0.6.0 (2026-11-02): near me, commute, local sources, weekly goal

### Features
- **Home ZIP, city, max miles and weekly apply goal** in "Edit what I'm looking for".
- **Near me** filter (local within your miles + remote); **Local** now means near you only.
- **Commute chip** on every job ("~9 min drive (2 mi)", amber over 45 min) and a **Directions** button (Google Maps).
- **Local job sources near you** (Jobs tab): Indeed by ZIP, Google jobs, store career sites, Snagajob, government
  jobs, CareerSource, plus Nextdoor / Facebook groups / Craigslist marked "You check this" (they don't allow bots).
- Today: **Applied this week x/goal** tile (turns amber from Thursday if you're behind).

## v0.5.1 (2026-11-02): take-home pay

### Features
- Every job (feed and saved) shows **≈ $X take-home / 2 weeks**: what actually lands in your bank, not the
  posted pay. Same 2026 tax numbers as Paycheck Planner (single filer, 40 hrs/week, Florida has no state tax).

## v0.5.0 (2026-10-30): Events + talking points

### Features
- **Events tab** (new, between Saved and Skills): add any event (career fair, store hiring event, meetup, anything)
  with date, time, place, cost, link and notes. Set **Going?** to Yes/Maybe/No. Upcoming events sort first;
  past ones fade out.
- **Talking points** (`web/talk.js`): a 30-second intro, talking points, questions to ask, and what to bring/do.
  Made automatically when you add an event with Going: Yes, switch an event to Yes, or move a job to Interview.
  Saved jobs get a **Talking points** button too.
- **Events | Talking points** switch on the Events tab shows every set in one place, with **Copy all**.
- Today tab: events you're going to in the next 7 days, with a Talking points button.

### Notes
- Talking points use only your resume facts. Where a real story helps, they say **[your example]**.
- Questions and "bring" lists change with the kind of event: hiring events (resume copies, availability),
  meetups (LinkedIn QR, meet 3 people), interviews (thank-you note).

## v0.4.0 (2026-10-30): automatic resumes for any job

### Features
- **Resume maker** (`web/resume.js`): save a job (or add one) and Radar builds a one-page resume for it right away,
  on your phone, offline, with no AI. It scores every bullet and skill in your facts against the job and keeps the
  best matches, in your own words. It never writes anything new, so it can't invent a job or a skill.
- **Any kind of job**: "+ Add any job" works for Best Buy, GameStop, Publix, help desk, anything. Radar figures out
  the kind of job (IT / tech, Store / retail, Other) from the title and description, or you pick it.
- **My resume facts** card on the Me tab (format shown right there). Saved on this phone only. Your facts are also
  in `private/my_resume_facts.txt` on the PC (not uploaded) to copy in.
- **Resume page**: Print / Save as PDF (prints a clean one-pager without the app around it), Copy as text, and
  "Remake as" to switch style. **Remake all my resumes** after you edit your facts.
- Saved cards: **My resume** / **Make my resume**. The AI prompt button is now "Copy AI prompt (cover letter + research)"
  and uses your facts if you didn't paste a resume.

### Buffs
- Store/retail resumes lead with customer service, sales, and cash and card handling, and leave IT details out.

## v0.3.0 (2026-10-23): Deals

### Features
- The Gigs tab is now **Money** with two views: **Gigs** and **Deals** (it remembers which one you used last).
- **Check a deal:** item, asking price, typical used price, shipping, eBay fee → live verdict (great / good / fair /
  overpriced), % of typical price, flip profit, eBay fees, and the most you should pay to make $40.
  Same math as ATLAS's `tools/deal_check.py` (which looks the used price up on eBay for you).
- **Copy ATLAS command** builds `python tools/deal_check.py "<item>" --price <n>` for you.
- **Want list** (item + max price) and **Deals I checked** history, saved on your phone only.
- "Before you pay" safety box: public meetups, see it running, no deposits/Zelle holds/codes.

## v0.2.0 (2026-10-22): Gigs tab

### Features
- **Gigs tab**: 19 quick-pay gig sites in 4 groups (AI training, Local tech, Tech freelance, Testing & surveys),
  fastest-paying first. Each shows what it pays, how and how fast you get paid, what you need, a link, and where
  the numbers came from. The list lives in `web/data/gigs.json` (edit it to add sites).
- **Where I stand** on each site: Not started / Signed up / Approved / Earning / Not for me.
- **Log money you earned**: date, site, amount, note. Tiles show this month, total, and sites you're approved on.
  Logging money marks that site "Earning".
- Safety reminder: real gig sites never charge you to join or move chats to Telegram/WhatsApp.

### Bugs fixed
- "Today" was tomorrow after 8 PM in Miami: dates used London time (`toISOString()`). Now they use your phone's clock.
  This also fixes follow-up reminder dates.

## v0.1.0 (2026-10-22): first installable version

### Features
- Installable app (PWA) for iPhone and Android with its own icon, offline support and dark mode.
- First-time setup: pick careers, pay floor, remote/local, skills you have, and paste your resume.
- **Jobs** tab: best matches first, a 1-5 fit score, pay check against U.S. labor data, scam red flags, filters (Best, Newest, Remote, Local, Skipped), hides jobs below your pay floor.
- **Saved** tab: bookmark jobs, add jobs from anywhere, status (Saved to Offer), listing status (Open / Closed / Removed).
- **Today** tab: counts, follow-up reminders 7 days after applying, closed-listing alerts, interview reminders.
- **Skills** tab: most-requested skills in your jobs, with "I have this".
- **Me** tab: edit profile, install help, download/load backup, delete data.
- Free AI help: copy a tailored-resume, interview-prep or follow-up prompt to paste into Claude.
- Daily robot (GitHub Actions): builds the job feed from Himalayas at 7:40 AM ET, checks if old listings closed, drops likely scams (2+ red flags) and senior roles, then publishes the app.
- Optional local South Florida jobs through Adzuna (off until you add a free key).

### Bugs fixed (during build)
- Page had an 8px white edge on phones: added a CSS reset (`body{margin:0}`).
- An empty red banner showed on load: hidden elements now really hide (`[hidden]{display:none!important}`).
- Jobs badge counted jobs below your pay floor: badge and Today now use the same rule.
- Dark mode button text was hard to read: new `--on-accent` color token.
