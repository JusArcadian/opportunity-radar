"""
fetch_jobs.py - builds the daily job feed the Radar app reads.

What it does (in plain English):
  1. Reads config/feed.json (careers, search words, skip words, skills, red flags).
  2. Asks job sources for fresh postings:
       - Himalayas, Remotive, Jobicy (remote jobs, free, no key)
       - The Muse (entry-level jobs near your cities + remote, free, no key)
       - Adzuna (local South Florida jobs, free key, OFF until you add the key)
  3. Cleans each job into the same simple shape, drops senior roles,
     works out the lowest hourly pay, spots skills and scam red flags (with WHY),
     and writes a plain summary: what the job is, what they want, nice-to-haves.
  4. Checks jobs that disappeared since yesterday: still open, closed, or removed?
  5. Writes web/data/jobs.json and web/data/status.json for the app.

Run it:
  python feed/fetch_jobs.py            (real run, needs internet)
  python feed/fetch_jobs.py --sample   (offline test using feed/sample_himalayas.json)

Only the Python standard library is used, so there is nothing to install.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "config" / "feed.json").read_text(encoding="utf-8"))
OUT_DIR = ROOT / "web" / "data"
STATE_FILE = ROOT / "feed" / "state" / "history.json"
SAMPLE = "--sample" in sys.argv
UA = {"User-Agent": "OpportunityRadar/0.1 (personal job tracker)"}
NOW = time.time()


# ------------------------------------------------------------------ helpers
def get_json(url, headers=None):
    """Download a URL and turn the JSON answer into Python data."""
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def status_code(url):
    """Return just the HTTP status number (200 = ok, 404 = gone, 410 = closed)."""
    req = urllib.request.Request(url, headers=UA, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def hourly(amount, period):
    """Turn a salary into dollars per hour so every job compares the same way."""
    if not amount:
        return None
    period = (period or "year").lower()
    per = {"hour": 1, "hourly": 1, "day": 8, "daily": 8, "week": 40, "weekly": 40,
           "month": 173.3, "monthly": 173.3, "year": 2080, "annual": 2080, "yearly": 2080}.get(period, 2080)
    return round(float(amount) / per, 2)


def pay_text(lo, hi, period, currency="USD"):
    if not lo and not hi:
        return ""
    sym = "$" if (currency or "USD").upper() == "USD" else (currency + " ")
    unit = {"hour": "/hr", "year": "/yr", "month": "/mo", "week": "/wk"}.get((period or "year").lower(), "/yr")
    fmt = (lambda v: f"{sym}{v:,.2f}") if unit == "/hr" else (lambda v: f"{sym}{v:,.0f}")
    return f"{fmt(lo)}-{fmt(hi)}{unit}" if lo and hi and lo != hi else f"{fmt(lo or hi)}{unit}"


def too_senior(title):
    """Whole words only. Without this, "iv" (as in Tier IV) also matched "driver" and "representative"."""
    t = title.lower()
    return any(re.search(r"(?<![a-z])" + re.escape(w.strip()) + r"(?![a-z])", t) for w in CONFIG["skip_title_words"])


def find_skills(text):
    low = (text or "").lower()
    return [s for s in CONFIG["skills"] if s.lower() in low]


def _flag_rule(word, rule):
    """Config allows a plain label string or {label, why}. Always return (label, why)."""
    if isinstance(rule, str):
        return rule, ""
    return rule.get("label", word), rule.get("why", "")


def find_flags(text):
    """Red flags = common scam signs. 2+ of these and the job is dropped."""
    low = (text or "").lower()
    return sorted({_flag_rule(w, r)[0] for w, r in CONFIG["red_flags"].items() if w in low})


def flag_info(job, desc, career):
    """Every red flag (level 'red') and softer warning (level 'check') with a plain WHY,
    so the app can show a '?' explaining each one."""
    low = (desc or "").lower()
    out, seen = [], set()
    def add(label, why, level):
        if label not in seen:
            seen.add(label); out.append({"label": label, "why": why, "level": level})
    for w, r in CONFIG["red_flags"].items():
        if w in low:
            label, why = _flag_rule(w, r); add(label, why, "red")
    for w, r in CONFIG.get("check_flags", {}).items():
        if w in low:
            label, why = _flag_rule(w, r); add(label, why, "check")
    if not (job.get("company") or "").strip():
        add("No company name", "Real employers say who they are. A posting with no company can be a recruiter fishing for resumes, or a scam.", "check")
    if len(desc or "") < 300 and job.get("source") != "Adzuna":
        add("Very short description", "Real jobs usually explain the duties and requirements. A vague posting can mean a scam or a low-effort repost; ask questions before sharing personal info.", "check")
    mid = career.get("bench_mid")
    if mid and (job.get("hourly") or 0) > mid * 1.6:
        add("Pay looks too good", f"The lowest pay is far above the typical ${mid:.0f}/hr for this kind of job. Sometimes it's real, but scams often promise big pay for easy work.", "check")
    return out


ABOUT_DOES = re.compile(r"\b(you will|you'll|responsib|dut(y|ies)|day[- ]to[- ]day|role involves|troubleshoot|respond|assist|resolv|support (users|customers|employees)|answer|install|maintain|monitor|document|handle)", re.I)
ABOUT_WANTS = re.compile(r"\b(requir|must|minimum|experience (with|in)|\d+\+? ?years?|years? of|degree|diploma|certif|knowledge of|familiar|ability to|able to|proficien|understanding of|background in|comfortable)", re.I)
ABOUT_NICE = re.compile(r"\b(prefer|bonus|a plus|nice to have|desired|ideally)", re.I)


def pieces(html):
    """Break a job description into bullet points and sentences."""
    html = re.sub(r"<h\d[^>]*>.*?</h\d>|<(strong|b)>[^<]{0,40}</(strong|b)>\s*(?=<|$)", " . ", html or "", flags=re.I | re.S)
    items = [strip_html(x) for x in re.findall(r"<li[^>]*>(.*?)</li>", html, re.I | re.S)]
    text = strip_html(re.sub(r"<li[^>]*>.*?</li>", " ", html, flags=re.I | re.S))
    items += [x.strip() for x in re.split(r"(?<=[.!?])\s+", text)]
    return [x[:180].rstrip() for x in items if 25 <= len(x) <= 400]


def about(html):
    """A plain summary built only from the posting's own words:
    does = what you'd do, wants = what they require, nice = nice-to-haves, years = experience asked."""
    does, wants, nice = [], [], []
    for p in pieces(html):
        if ABOUT_NICE.search(p):
            (nice if len(nice) < 3 else []).append(p)
        elif ABOUT_WANTS.search(p):
            (wants if len(wants) < 5 else []).append(p)
        elif ABOUT_DOES.search(p):
            (does if len(does) < 4 else []).append(p)
    yrs = [int(m) for m in re.findall(r"(\d{1,2})\+?\s*(?:-\s*\d+\s*)?years?", strip_html(html), re.I) if int(m) <= 15]
    return {"does": does, "wants": wants, "nice": nice, "years": min(yrs) if yrs else None,
            "degree": bool(re.search(r"\b(bachelor|associate'?s|degree)\b", html or "", re.I))}


def match_career(title, desc=""):
    """For sources we search once (not per career): which career does this title fit?"""
    t = (title or "").lower()
    for c in CONFIG["careers"]:
        if any(q.lower() in t for q in c["queries"] + c.get("title_words", [])):
            return c
    return next((c for c in CONFIG["careers"] if c.get("catch_all")), None)  # keep the rest for the app's job picker


def iso(ts):
    """Unix seconds -> 'YYYY-MM-DD' (empty if missing)."""
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return ""


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


# ------------------------------------------------------------------ sources
def himalayas(career):
    """Remote US jobs from Himalayas. Their rules: link to them as the source,
    use their applicationLink unchanged, and drop jobs once they expire."""
    jobs = []
    for q in career["queries"]:
        if SAMPLE:
            data = json.loads((ROOT / "feed" / "sample_himalayas.json").read_text(encoding="utf-8"))
        else:
            qs = urllib.parse.urlencode({"q": q, "country": "US", "sort": "recent"})
            try:
                data = get_json(f"https://himalayas.app/jobs/api/search?{qs}")
            except Exception as e:
                print(f"  ! Himalayas '{q}' failed: {e}")
                continue
            time.sleep(1.2)  # be polite: stay far below their rate limit
        for j in (data.get("jobs") or [])[: CONFIG["max_per_query"]]:
            if j.get("expiryDate") and float(j["expiryDate"]) < NOW:
                continue  # expired -> their terms say remove it
            desc = strip_html(j.get("description") or j.get("excerpt"))
            lo, hi, per = j.get("minSalary"), j.get("maxSalary"), j.get("salaryPeriod")
            guid = j.get("guid") or ""
            jobs.append({
                "id": "him:" + guid.rstrip("/").split("/companies/")[-1] if guid else "him:" + j.get("title", ""),
                "title": j.get("title", "").strip(),
                "company": j.get("companyName", "").strip(),
                "companySlug": j.get("companySlug", ""),
                "location": "Remote (US)",
                "remote": "Remote",
                "pay": pay_text(lo, hi, per, j.get("currency")),
                "hourly": hourly(lo or hi, per),
                "posted": iso(j.get("pubDate")),
                "expires": iso(j.get("expiryDate")),
                "applyUrl": j.get("applicationLink") or guid,
                "sourceUrl": guid,
                "source": "Himalayas",
                "career": career["key"],
                "summary": strip_html(j.get("excerpt"))[:280],
                "skills": find_skills(desc),
                "flags": find_flags(desc),
                "type": j.get("employmentType", ""),
                "_html": j.get("description") or j.get("excerpt") or "",
            })
    return jobs


def adzuna(career):
    """Local jobs from Adzuna (needs ADZUNA_APP_ID and ADZUNA_APP_KEY).
    Their rule: show 'Jobs by Adzuna' and link back to them."""
    app_id, app_key = os.environ.get("ADZUNA_APP_ID"), os.environ.get("ADZUNA_APP_KEY")
    if not (CONFIG["local"]["enabled"] and app_id and app_key) or SAMPLE:
        return []
    jobs = []
    for place in CONFIG["local"]["places"]:
        for q in career["queries"][:2]:
            qs = urllib.parse.urlencode({
                "app_id": app_id, "app_key": app_key, "what": q, "where": place,
                "distance": int(CONFIG["local"]["distance_miles"] * 1.609), "max_days_old": 7,
                "results_per_page": 20, "content-type": "application/json"})
            try:
                data = get_json(f"https://api.adzuna.com/v1/api/jobs/us/search/1?{qs}")
            except Exception as e:
                print(f"  ! Adzuna '{q}' in {place} failed: {e}")
                continue
            time.sleep(1)
            for j in data.get("results", []):
                desc = strip_html(j.get("description"))
                lo, hi = j.get("salary_min"), j.get("salary_max")
                jobs.append({
                    "id": "adz:" + str(j.get("id")),
                    "title": strip_html(j.get("title")),
                    "company": (j.get("company") or {}).get("display_name", ""),
                    "companySlug": "",
                    "location": (j.get("location") or {}).get("display_name", place),
                    "remote": "Onsite",
                    "pay": pay_text(lo, hi, "year"),
                    "hourly": hourly(lo or hi, "year"),
                    "posted": (j.get("created") or "")[:10],
                    "expires": "",
                    "applyUrl": j.get("redirect_url", ""),
                    "sourceUrl": j.get("redirect_url", ""),
                    "source": "Adzuna",
                    "career": career["key"],
                    "summary": desc[:280],
                    "skills": find_skills(desc),
                    "flags": find_flags(desc),
                    "type": j.get("contract_time", ""),
                    "_html": j.get("description") or "",
                })
    return jobs


def remotive():
    """Remote jobs from Remotive. Their rules: name Remotive as the source, link to the
    Remotive job URL, max ~4 requests a day (we make ONE), don't pass jobs to other boards."""
    if SAMPLE or not CONFIG.get("sources", {}).get("remotive", True):
        return []
    try:
        data = get_json("https://remotive.com/api/remote-jobs")
    except Exception as e:
        print(f"  ! Remotive failed: {e}"); return []
    ok = re.compile(r"usa|united states|\bus\b|americas|north america|worldwide|anywhere", re.I)
    jobs = []
    for j in data.get("jobs", []):
        c = match_career(j.get("title"))
        if not c or not ok.search(j.get("candidate_required_location") or ""):
            continue
        desc = j.get("description") or ""
        jobs.append({
            "id": "rem:" + str(j.get("id")), "title": (j.get("title") or "").strip(),
            "company": (j.get("company_name") or "").strip(), "companySlug": "",
            "location": "Remote (" + (j.get("candidate_required_location") or "US") + ")", "remote": "Remote",
            "pay": (j.get("salary") or "").strip()[:40], "hourly": hourly(_first_number(j.get("salary")), "year"),
            "posted": (j.get("publication_date") or "")[:10], "expires": "",
            "applyUrl": j.get("url", ""), "sourceUrl": j.get("url", ""), "source": "Remotive",
            "career": c["key"], "summary": strip_html(desc)[:280], "_html": desc,
            "type": (j.get("job_type") or "").replace("_", "-"),
        })
    return jobs


def jobicy():
    """Remote US jobs from Jobicy. Their rules: keep Jobicy as the source, keep their job URL,
    poll at most once an hour (we poll once a day)."""
    if SAMPLE or not CONFIG.get("sources", {}).get("jobicy", True):
        return []
    try:
        data = get_json("https://jobicy.com/api/v2/remote-jobs?count=200&geo=usa")
    except Exception as e:
        print(f"  ! Jobicy failed: {e}"); return []
    jobs = []
    for j in data.get("jobs", []):
        c = match_career(j.get("jobTitle"))
        if not c:
            continue
        desc = j.get("jobDescription") or j.get("jobExcerpt") or ""
        lo, hi, per = j.get("salaryMin"), j.get("salaryMax"), j.get("salaryPeriod") or "year"
        jobs.append({
            "id": "jcy:" + str(j.get("id")), "title": strip_html(j.get("jobTitle")),
            "company": (j.get("companyName") or "").strip(), "companySlug": "",
            "location": "Remote (" + (j.get("jobGeo") or "USA") + ")", "remote": "Remote",
            "pay": pay_text(lo, hi, per, j.get("salaryCurrency")), "hourly": hourly(lo or hi, per),
            "posted": (j.get("pubDate") or "")[:10], "expires": "",
            "applyUrl": j.get("url", ""), "sourceUrl": j.get("url", ""), "source": "Jobicy",
            "career": c["key"], "summary": strip_html(j.get("jobExcerpt") or desc)[:280], "_html": desc,
            "type": ", ".join(j.get("jobType") or []) if isinstance(j.get("jobType"), list) else (j.get("jobType") or ""),
        })
    return jobs


def themuse():
    """Entry-level jobs from The Muse in your cities (and remote). No key needed for light use.
    Credit The Muse and use their job page link."""
    m = CONFIG.get("themuse", {})
    if SAMPLE or not CONFIG.get("sources", {}).get("themuse", True):
        return []
    jobs = []
    for place in m.get("locations", []):
        for page in range(m.get("pages", 2)):
            qs = urllib.parse.urlencode([("page", page), ("location", place)] + [("level", l) for l in m.get("levels", ["Entry Level"])])
            try:
                data = get_json(f"https://www.themuse.com/api/public/jobs?{qs}")
            except Exception as e:
                print(f"  ! The Muse '{place}' failed: {e}"); break
            time.sleep(1)
            for j in data.get("results", []):
                c = match_career(j.get("name"))
                if not c:
                    continue
                locs = ", ".join(x.get("name", "") for x in j.get("locations") or [])
                url = (j.get("refs") or {}).get("landing_page", "")
                remote = "Remote" if re.search(r"remote|flexible", locs, re.I) else "Onsite"
                desc = j.get("contents") or ""
                jobs.append({
                    "id": "muse:" + str(j.get("id")), "title": (j.get("name") or "").strip(),
                    "company": ((j.get("company") or {}).get("name") or "").strip(), "companySlug": "",
                    "location": locs or place, "remote": remote, "pay": "", "hourly": None,
                    "posted": (j.get("publication_date") or "")[:10], "expires": "",
                    "applyUrl": url, "sourceUrl": url, "source": "The Muse",
                    "career": c["key"], "summary": strip_html(desc)[:280], "_html": desc,
                    "type": ", ".join(x.get("name", "") for x in j.get("levels") or []),
                })
            if page + 1 >= (data.get("page_count") or 1):
                break
    return jobs


def _first_number(text):
    """'$45,000 - $55,000' -> 45000 (Remotive pay is free text)."""
    m = re.search(r"\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?", text or "", re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    return v * 1000 if m.group(2) else (v if v > 1000 else None)


# ------------------------------------------------------------------ closed-job checks
def check_disappeared(history, today_ids):
    """Jobs we saw before but not today: ask Himalayas if they're still open.
    200 = Open, 410 = Closed, 404 = Removed."""
    checked = 0
    for jid, h in sorted(history.items(), key=lambda kv: kv[1].get("lastChecked", "")):
        if checked >= CONFIG["closed_checks_per_run"] or jid in today_ids:
            continue
        if h.get("status") in ("Closed", "Removed") or not jid.startswith("him:") or SAMPLE:
            continue
        path = jid[4:]  # "<company>/jobs/<slug>"
        code = status_code(f"https://himalayas.app/jobs/api/companies/{path}")
        h["status"] = {200: "Open", 410: "Closed", 404: "Removed"}.get(code, h.get("status", "Unknown"))
        h["lastChecked"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        checked += 1
        time.sleep(1.1)
    return checked


# ------------------------------------------------------------------ main
def main():
    print("Building job feed" + (" (SAMPLE mode)" if SAMPLE else ""))
    all_jobs, seen = [], set()
    once = remotive() + jobicy() + themuse()          # these search ONCE, then sort jobs into careers
    by_key = {c["key"]: c for c in CONFIG["careers"]}
    for career in CONFIG["careers"]:
        found = (himalayas(career) if career.get("remote_search", True) else []) + adzuna(career) + [j for j in once if j["career"] == career["key"]]
        kept = 0
        if career.get("max_jobs"):
            found.sort(key=lambda j: j["remote"] == "Remote")   # capped list: in-person jobs first, they're the rarest
        for j in found:
            if kept >= career.get("max_jobs", 10 ** 9):
                break
            key = (j["title"].lower(), j["company"].lower())
            if not j["title"] or too_senior(j["title"]) or key in seen:
                continue
            if (j.get("hourly") or 0) > CONFIG.get("max_entry_hourly", 999):   # pay far above entry level = not for a beginner
                continue
            html = j.pop("_html", "") or j.get("summary", "")
            text = strip_html(html)
            j.setdefault("skills", find_skills(text)); j["skills"] = j["skills"] or find_skills(text)
            j["flags"] = find_flags(text)
            if len(j["flags"]) >= 2:  # 2+ scam warning signs = never show it
                print(f"    dropped likely scam: {j['title']} ({', '.join(j['flags'])})")
                continue
            j["flagInfo"] = flag_info(j, text, by_key.get(j["career"], career))
            j["about"] = about(html)
            seen.add(key)
            all_jobs.append(j)
            kept += 1
        print(f"  {career['label']}: {kept} jobs")

    # history: remember every job for keep_days so the app can tell you when a saved job closes
    history = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_ids = {j["id"] for j in all_jobs}
    for j in all_jobs:
        h = history.setdefault(j["id"], {"firstSeen": today})
        h.update({"lastSeen": today, "status": "Open", "title": j["title"], "company": j["company"]})
    checked = check_disappeared(history, today_ids)
    cutoff = NOW - CONFIG["keep_days"] * 86400 * 3  # keep status memory ~2 months
    history = {k: v for k, v in history.items()
               if datetime.strptime(v.get("lastSeen", today), "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() > cutoff}

    meta = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(all_jobs),
        "sources": sorted({j["source"] for j in all_jobs}),
        "careers": [{**{k: c[k] for k in ("key", "label", "bench_low", "bench_mid", "bench_source")}, "search": c["queries"][0],
                     "remote_search": c.get("remote_search", True)} for c in CONFIG["careers"]],
        "skills": CONFIG["skills"],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "jobs.json").write_text(json.dumps({"meta": meta, "jobs": all_jobs}, indent=1), encoding="utf-8")
    (OUT_DIR / "status.json").write_text(json.dumps(
        {k: {"status": v["status"], "lastSeen": v.get("lastSeen", "")} for k, v in history.items()}, indent=1), encoding="utf-8")
    STATE_FILE.write_text(json.dumps(history, indent=1), encoding="utf-8")
    print(f"Wrote {len(all_jobs)} jobs, checked {checked} disappeared listings.")


if __name__ == "__main__":
    main()
