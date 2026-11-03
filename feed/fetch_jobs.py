"""
fetch_jobs.py - builds the daily job feed the Radar app reads.

What it does (in plain English):
  1. Reads config/feed.json (careers, search words, skip words, skills, red flags).
  2. Asks job sources for fresh postings:
       - Himalayas (remote jobs, free, no key)
       - Adzuna (local South Florida jobs, free key, OFF until you add the key)
  3. Cleans each job into the same simple shape, drops senior roles,
     works out the lowest hourly pay, spots skills and scam red flags.
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
    t = f" {title.lower()} "
    return any(w in t for w in CONFIG["skip_title_words"])


def find_skills(text):
    low = (text or "").lower()
    return [s for s in CONFIG["skills"] if s.lower() in low]


def find_flags(text):
    low = (text or "").lower()
    found = [msg for word, msg in CONFIG["red_flags"].items() if word in low]
    return sorted(set(found))


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
                })
    return jobs


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
    for career in CONFIG["careers"]:
        found = himalayas(career) + adzuna(career)
        kept = 0
        for j in found:
            key = (j["title"].lower(), j["company"].lower())
            if not j["title"] or too_senior(j["title"]) or key in seen:
                continue
            if (j.get("hourly") or 0) > CONFIG.get("max_entry_hourly", 999):   # pay far above entry level = not for a beginner
                continue
            if len(j["flags"]) >= 2:  # 2+ scam warning signs = never show it
                print(f"    dropped likely scam: {j['title']} ({', '.join(j['flags'])})")
                continue
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
        "careers": [{k: c[k] for k in ("key", "label", "bench_low", "bench_mid", "bench_source")} for c in CONFIG["careers"]],
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
