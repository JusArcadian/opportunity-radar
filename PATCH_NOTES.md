# Patch notes

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
