# Study guide: how Opportunity Radar works

Read one chapter at a time. Each has the real code and a plain-English explanation.

---
## Chapter 1: What is a PWA?
A **Progressive Web App** is a website that can install like an app. It needs three things:
1. A **manifest** (`web/manifest.webmanifest`): the app's name, colors and icons. This is what the phone uses for the home-screen icon.
2. A **service worker** (`web/sw.js`): a helper script that saves the app's files on the phone so it opens offline.
3. **HTTPS** hosting: GitHub Pages gives us that for free.

ELI5: a normal website is a restaurant you visit. A PWA is the same restaurant, but it gave you a lunchbox
(the cached files) so you can eat even when the restaurant is closed (offline).

Why not the App Store first? Store apps cost $99/yr (Apple) and need review. A PWA is free and the same code
can be wrapped for the stores later (see ROADMAP.md).

---
## Chapter 2: How the pieces fit
```
GitHub Actions (7:40 AM) ──runs──> feed/fetch_jobs.py ──writes──> web/data/jobs.json
                                                                        │
Your phone ──opens──> web/index.html + app.js ──reads──> data/jobs.json ┘
                           │
                           └──saves YOUR stuff──> localStorage on the phone ("radar.v1")
```
The robot never sees your saved jobs. The phone never needs a server of its own.

---
## Chapter 3: The daily robot (`.github/workflows/daily.yml`)
```yaml
on:
  schedule:
    - cron: "40 11 * * *"   # minute 40, hour 11 UTC, every day
  workflow_dispatch: {}      # adds a "Run workflow" button
```
- **cron** is a time pattern: `minute hour day month weekday`. `*` means "every". 11:40 UTC = 7:40 AM Eastern.
- Job 1 (`feed`) runs `python feed/fetch_jobs.py`, then `git commit` + `git push` so the new jobs are saved in the repo.
- Job 2 (`deploy`) uploads the `web/` folder to GitHub Pages: that's the live app.
- `secrets.ADZUNA_APP_KEY`: secrets are passwords GitHub keeps hidden. The script reads them with `os.environ`.

---
## Chapter 4: Building the feed (`feed/fetch_jobs.py`)
Every job, from any source, gets turned into the same simple shape:
```python
jobs.append({
    "id": "him:" + guid.rstrip("/").split("/companies/")[-1],   # unique name, e.g. him:dmi/jobs/service-desk-analyst
    "title": j.get("title", "").strip(),
    "pay": pay_text(lo, hi, per, j.get("currency")),          # "$45,000-$52,000/yr"
    "hourly": hourly(lo or hi, per),                          # 21.63, so all jobs compare the same way
    "applyUrl": j.get("applicationLink") or guid,             # Himalayas' rule: use their link unchanged
    "skills": find_skills(desc),                              # ["CompTIA A+", "Active Directory"]
    "flags": find_flags(desc),                                # ["Interview over Telegram"]
})
```
- `hourly()` divides a yearly salary by 2080 (40 hours x 52 weeks).
- `too_senior()` drops titles with words like "senior", "lead", "manager".
- Jobs with **2 or more** scam warning signs are dropped completely.
- `check_disappeared()` asks Himalayas about jobs that vanished: **200** = still open, **410** = closed, **404** = removed.
  Those answers go into `status.json`, which is how your Saved tab knows a listing closed.

Try it offline: `python feed/fetch_jobs.py --sample` uses fake jobs from `feed/sample_himalayas.json`.

---
## Chapter 5: Your data on the phone (`app.js`)
```js
const KEY = "radar.v1";
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(me)); }
  catch { toast("Couldn't save on this phone. Download a backup from the Me tab."); }
}
```
- `localStorage` is a small notebook each website gets inside the browser. `JSON.stringify` turns our data into text to store it.
- `try { } catch { }` means "try this; if it breaks, do the backup plan instead of crashing".
- Everything you do (Save, Skip, Applied) changes `me`, calls `persist()`, then `render()` redraws the screen.
- Because the data lives only on the phone, **Download backup** matters. Deleting browser data deletes Radar's data.

---
## Chapter 6: The fit score
```js
function fitScore(job) {
  let s = 3;                                              // everyone starts at 3
  if (job.hourly < p.floor) s -= 1;                       // below your pay floor
  else if (job.hourly >= p.floor * 1.4) s += 1;           // pays 40%+ above your floor
  if (needs.length && matched >= 2) s += 1;               // you have 2+ of the skills it mentions
  if (needs.length >= 3 && matched === 0) s -= 1;         // it wants 3+ skills and you have none
  if (/intern|junior|entry|tier 1/i.test(job.title)) s += 1;  // clearly entry-level
  return Math.max(1, Math.min(5, s));                     // keep it between 1 and 5
}
```
`/intern|junior/i` is a **regular expression**: a search pattern. `|` means "or", `i` means "ignore capitals".

---
## Chapter 7: Offline and updates (`sw.js`)
- On install, the service worker saves `APP_FILES` into a cache named by `VERSION`.
- App files: **cache first** (instant). Job feed: **network first**, cache if offline.
- When you change any file in `web/`, bump `VERSION` (e.g. `radar-v0.1.1`). The old cache is deleted and phones get the new files on their next launch.

---
## Chapter 8: Safety and privacy
- `esc()` turns characters like `<` into `&lt;` before anything from the feed goes on screen. Without it, a job title
  containing code could run that code in your app (an attack called **XSS**, cross-site scripting).
- `safeUrl()` only allows links that start with `http://` or `https://`, so a feed can't sneak in a `javascript:` link.
- No secrets in code: the Adzuna key lives in GitHub Secrets.
- The app never auto-applies: auto-apply bots break job-site rules and get accounts banned.

---
## Chapter 9: When things break (errors we hit and how we fixed them)
| What happened | Why | Fix |
|---|---|---|
| `connect_rejected` when testing the feed in Claude's workspace | Claude's sandbox can't reach himalayas.app | Normal. The real run happens on GitHub's computer. Test with `--sample`. |
| Browser can't call the Himalayas API directly | The API sends no **CORS** headers (CORS = a website's permission slip that lets other sites' pages read it) | The robot fetches jobs and saves them as our own `jobs.json` |
| White 8px edges around the app | Browsers add `margin: 8px` to `body` by default | `body{margin:0}` in a CSS reset |
| An empty red box at the top | `.banner{display:flex}` beat the `hidden` attribute | `[hidden]{display:none!important}` |
| Jobs badge said 4 but the list showed 3 | Badge counted jobs below the pay floor | One shared `freshJobs()` function for both |
| "Failed to load resource" for fonts in testing | Test browser had no internet | Normal; real phones load Google Fonts, and there are fallback fonts |

---
## Chapter 11: The Gigs tab (v0.2.0)

**Two kinds of data, kept apart:**
- `web/data/gigs.json` = the gig sites (same for everyone). Edit it, publish, and every phone gets the new list.
- `me.gigs` and `me.earnings` = YOUR progress and money, saved only on your phone (localStorage).

```js
me.earnings.push({ id: "e" + Date.now(), date: $("e-date").value, gig: $("e-gig").value, amt, note });
const thisMonth = me.earnings.filter((e) => e.date.startsWith(month)).reduce((t, e) => t + e.amt, 0);
```

**ELI5:** every time you log money, it's a sticky note in a jar. `filter` picks the notes from this month,
`reduce` adds them up one by one (t = running total).

**Fastest pay first:** `sort((a, b) => order[a.speed] - order[b.speed] || az(a.name, b.name))`: sort by speed
(fast = 0, medium = 1, slow = 2); if two are tied, A to Z by name.

### When things break: "today" was tomorrow
`new Date().toISOString()` gives the date in London (UTC). At 8:45 PM in Miami it's already the next day there.
Fix: shift by your time zone first:

```js
const d = new Date();
new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
```
`getTimezoneOffset()` is how many minutes you are behind London (240 in Miami in summer).

## Chapter 12: Deals (v0.3.0)
```js
const ratio = ask / used;                           // 0.78 = 78% of the normal used price
const fee = used * feePct / 100 + 0.40;             // eBay's cut if you resell at the normal price
const profit = used - fee - ship - ask;             // what's left for you
const maxFor40 = used - fee - ship - 40;            // the most you can pay and still make $40
```
**ELI5:** if a GPU normally sells used for $230, eBay keeps about $31.68, shipping is $12, and you paid $180, you keep $6.32.
To make $40 you'd need to pay $146.32 or less.

**Why not scan Facebook automatically?** Marketplace has no public API and its rules forbid bots; a scanner could get
your account banned. So you find listings (Marketplace saved searches send alerts) and Radar/ATLAS do the math.

## Chapter 13: The resume maker (v0.4.0, `web/resume.js`)
**The problem:** every job wants a slightly different resume, and AI tools can "improve" a resume by inventing things.

**Step 1: your facts, one per line.** `parseFacts()` reads lines like `JOB: Title | Company | City | Dates` and
`- a bullet` into a list of jobs, skills, school lines and certs.

**Step 2: what kind of job is it?** `kindOf()` checks the title (then the description) against word patterns:
```js
store: { spot: /\b(sales associate|cashier|retail|store|...|publix|best buy|gamestop)\b/i, words: ["customer", "cash", ...] }
```
"Front End Service Clerk at Publix" matches `publix`, so it's a store job. "Geek Squad Agent at Best Buy" matches IT first.

**Step 3: score every fact.**
```js
KINDS[kind].words.forEach((w) => { if (t.includes(w)) s += 2; });          // a word this KIND of job cares about
(t.match(/[a-z]{4,}/g) || []).forEach((w) => { if (words.has(w)) s += 1; }); // a word from THIS posting
```
ELI5: each of your bullets gets points, like a spelling bee. "Processed cash and card transactions accurately" scores
high for Publix (cash, card, transaction, accurate) and low for a help desk. The top 3 per job make the resume.
A store job's skill needs at least 2 points, so one stray word can't drag in "Cloud service support".

**Step 4: the summary.** Built only from what your facts say (companies you worked at, "customer service" if a
bullet mentions customers...), or your own `SUMMARY store:` line if you wrote one.

**Why no AI here?** The phone app has no server and no key, and everything stays on your phone. The web app inside
Claude (Radar on your Google Sheet) does use Claude to pick facts, and the morning run adds research and a cover letter.

**Printing:** `@media print` in styles.css hides everything except the resume, so "Save as PDF" gives a clean page.

## Chapter 14: Events and talking points (v0.5.0, `web/talk.js`)
**The idea:** before any event or interview you need an intro, things to say, and questions to ask.

**Step 1: what kind of event?** `typeOf()` looks for words:
```js
if (/career fair|job fair|hiring event|recruit/.test(t)) return "hiring";
if (/meetup|ctf|conference|bsides|owasp|hackmiami/.test(t)) return "meetup";
```
**Step 2: the intro** uses your latest job exactly as written in your facts ("Sales Representative at Alorica"),
adds "studying for Security+" only where it helps (meetups, IT jobs), and says why you're there.

**Step 3: talking points** reuse the resume maker's scoring (Chapter 13): your best-matching bullet from each
job, plus `[your example]` so you add a real story.

**Step 4: questions and what to bring** come from a fixed list per type (`QUESTIONS.hiring`, `BRING.meetup`...).
ELI5: like a coach's cheat card for each kind of game.

**Where it's stored:** on the event or saved job itself: `e.talk = { intro, points, questions, bring, made }`.
Delete the event and its talking points go with it.

**The Google Sheet version** (Radar inside Claude): talking points are rows on the new **Talking Points** tab,
written by Claude from your Resume Facts, and the morning run makes a researched version (speakers, agenda).

## Chapter 15: Take-home pay (v0.5.1, `takeHome()` in app.js)
```js
const year = hourly * 2080, taxable = Math.max(0, year - 16100);       // 2026 standard deduction
// 10% up to $12,400, 12% up to $50,400, 22% up to $105,700...
const net = year - fed - year * 0.0765;                                 // 7.65% = Social Security + Medicare
return Math.round(net / 26);                                            // 26 paychecks a year
```
ELI5: $17/hr x 2,080 hours = $35,360 a year. Taxes and Social Security take about $4,770, so about $30,590 is
yours, or about **$1,177 every two weeks**. `hourlyOf()` also turns "$45k/yr" into an hourly number first.

## Chapter 16: Near me and commute (v0.6.0)
Radar keeps a dot (latitude, longitude) for ~40 South Florida cities in `CITIES`. `miles()` measures the straight line
between two dots (the "haversine" formula for distance on a globe), `commute()` adds 30% for real roads and guesses
minutes (~28 mph locally, ~45 mph on long highway trips). ELI5: like measuring with a ruler on a map, then adding
some for turns. It's a rough guess; the Directions button opens Google Maps for the real time.

## Chapter 10: Glossary
- **API**: a door into another service's data that programs can use.
- **JSON**: text format for data, like `{"title": "Help Desk"}`.
- **Repository (repo)**: a project folder tracked by Git on GitHub.
- **Commit / push**: save a snapshot / upload it to GitHub.
- **Cron**: a schedule written as five fields.
- **Cache**: saved copies of files for speed and offline use.
- **localStorage**: the browser's per-site notebook on your device.


## Chapter 17: A template anyone can use (v0.6.4)
The grey box on the Me tab is only an example, not your data. It used to show things like "City, FL" and "CompTIA Security+", which only fit one person. Now it uses placeholders like "City, State" and "Mon YYYY", so any new user can copy the shape and fill in their own facts.
ELI5: it's like a blank form at the doctor's office. The labels (NAME, JOB) stay the same for everyone; only the answers change.
Code: just text inside the `<pre class="small fmt">` tag in `web/index.html`. Nothing in the logic changed.


## Chapter 18: More job sites, job summaries, red flags with "why" (v0.7.0)
**New sources.** `remotive()`, `jobicy()` and `themuse()` in `feed/fetch_jobs.py`. Each one asks its site ONCE per day, then `match_career()` sorts every job into a career by its title (for example "help desk" goes to Help desk / IT). Fewer requests means we follow each site's rules; Remotive says at most 4 a day.
ELI5: instead of asking the store 17 times "got any help desk jobs? any support jobs?", we grab the whole list once and sort it at home.

**Job summary.** `about(html)` cuts the description into bullets and sentences (`pieces()`), then sorts each one using word patterns:
- words like "required", "must", "years of", "certification" go in **What they want**
- "preferred", "a plus", "nice to have" go in **Nice to have**
- "you will", "troubleshoot", "respond" go in **What you'd do**
It only copies sentences from the posting and never writes new ones, so it can't make anything up.

**Red flags with why.** In `config/feed.json`, each red flag is now `{"label": ..., "why": ...}`. `flag_info()` returns a list of `{label, why, level}`: "red" means a scam sign (2 or more and the job is dropped), "check" means worth a look. In the app, `flagBlock()` draws a `<details>` box. That's a built-in HTML tap-to-open box, so no extra code is needed for the dropdown.

**When things break**
- A site changes its API, so its jobs vanish. The robot prints `! Remotive failed: ...` in the GitHub Actions log and just skips that site. Turn it off in `sources` until it's fixed.
- A summary looks empty. Some postings (Adzuna's especially) only include a short snippet. Tap **Apply on site** to read the full description.


## Chapter 19: Import vs. backup (v0.7.1)
A **backup** is a photo of everything; loading it swaps your whole app for the photo. An **import file** is a box of extra stuff; loading it puts the new things on the shelf next to what's already there.
Code: `mergeIn(d)` in `web/app.js`. For each saved job it builds a key from `title|company` and skips it if you already have one with that key, so nothing is doubled. Events use `name|date`. Facts are only filled in if yours are empty. The file says which kind it is with `"radarMerge": true`.
**When things break:** "That file isn't a Radar backup" means the file has no `saved` section or isn't valid JSON. Don't edit it in Word; use Notepad.


## Chapter 20: Reading anyone's resume (v0.8.0)
**`fromResume(text)` in `web/resume.js`** reads a normal resume line by line:
1. **Section titles.** Lines like "Experience", "Education" or "Skills" switch the "drawer" that the next lines go into (`HEAD` list).
2. **Job lines are found by their dates.** `RANGE` is a pattern for "Jan 2024 - Present", "06/2021 – 05/2023" or "2019-2021". The words around the date become title | company | place. If the line before it is short, it's treated as part of the job header (for resumes that put the company on its own line).
3. **Bullets.** Lines starting with • or -, or longer sentences, go under the current job.
4. **Commas that aren't separators** get hidden first by `guard()`: "Profits Management, Inc." and "(Concessions, Usher)" stay in one piece.
5. It writes everything back as `JOB:` / `SKILLS` / `EDUCATION:` lines and never adds words.

**.docx files** are zip folders. `fileText()` in `app.js` finds `word/document.xml` inside the zip and unpacks it with the browser's built-in `DecompressionStream("deflate-raw")`, so there's no library to install. Each `</w:p>` (end of a Word paragraph) becomes a new line.

**New job types** live in `config/feed.json` → `careers`. `remote_search: false` means "mostly in-person, don't ask the remote-only site." New resume types are in `KINDS` in `resume.js`. `kindOf()` checks the most specific type first (IT, then food, warehouse, care, driver, office, store).

**When things break**
- "Radar couldn't find your jobs" means the resume has no dates next to the jobs. Add dates like "Jan 2024 - Present".
- A job's title and company are swapped: fix it in Me → My resume facts (the format is `JOB: Title | Company | City, State | dates`).
- An old .doc (not .docx) or PDF won't read. Copy the text and paste it instead.


## Chapter 21: PDFs and the "for the people" polish (v0.8.0)
**PDF reading (`pdfText()` in app.js).** A PDF doesn't store lines of text the way a Word file does. It stores little pieces of words, each with an x/y position on the page. pdf.js hands us those pieces, and we:
1. group the pieces that share the same height on the page (the `y` number), so they become one line
2. sort each line left to right (the `x` number)
3. add a space where there's a gap between pieces
Then the same `fromResume()` from Chapter 20 reads it.
`import("./vendor/pdfjs/pdf.min.mjs")` loads the reader only when someone actually picks a PDF, so the app stays fast for everyone else.

**`<details>` folds** (the Skills box, "Show the format", "More" on saved jobs) are a built-in HTML tap-to-open box, so no JavaScript is needed. This is how we cut noise: rare actions stay one tap away instead of on screen all the time.

**Design rule we followed:** every screen shows the 2–3 things most people need, in plain words, with no buzzwords. Everything else is folded or optional.

**When things break**
- PDF says "Couldn't read that file": it's probably a scanned image with no real text in it. Copy and paste won't work either; type the facts in or use the Word version.


## Chapter 22: Never "come back tomorrow" (v0.8.1)
**Why the list was empty:** Radar's job list is made by the robot on GitHub, not on your phone. A new user (or a new job type) has to wait for the robot's next run.
**Fix 1: `searchNow()` in app.js.** If the filtered list is empty, it builds links like `https://www.indeed.com/jobs?q=crew%20member&l=33034`. `encodeURIComponent()` turns spaces into `%20` so the link works. Each job type has search words (`search` in the feed, or `SEARCH_WORDS` as a backup).
**Fix 2: a schedule of 3 runs a day.** In `.github/workflows/daily.yml`, `cron: "40 11,17,23 * * *"` means "minute 40 of hours 11, 17 and 23 (UTC time)". Cron's 5 slots are: minute, hour, day of month, month, day of week.
**Fix 3: run the feed on push when the search settings change.** `contains(join(github.event.commits.*.modified, ' '), 'config/')` asks "did this push change a file in config/?"
