/*
  app.js - everything the Radar app does on the phone.

  Big picture (ELI5):
  - The job list comes from data/jobs.json. A robot (GitHub Actions) rebuilds that file every morning.
  - YOUR stuff (profile, saved jobs, applied dates) lives in this phone's storage (localStorage),
    under one key: "radar.v1". Nothing about you is sent anywhere.
  - render() redraws the screen from that data. Every button changes the data, saves it, then calls render().
*/
"use strict";

/* ---------------------------------------------------------------- tiny helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
// today's date on YOUR clock (toISOString() uses London time, which is already "tomorrow" after 8 PM in Miami)
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const nice = (iso) => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString([], { month: "short", day: "numeric" }); };
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }

/* ---------------------------------------------------------------- saved data (this phone only) */
const KEY = "radar.v1";
const blank = () => ({ profile: null, facts: "", events: [], saved: {}, skipped: {}, gigs: {}, earnings: [], deals: [], wants: [], ui: { tab: "today", filter: "Best", gigFilter: "All", moneyView: "gigs", eventView: "events" } });
let me = load();
function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? Object.assign(blank(), JSON.parse(raw)) : blank(); }
  catch { return blank(); }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(me)); }
  catch { toast("Couldn't save on this phone. Download a backup from the Me tab."); }
}

/* ---------------------------------------------------------------- the job feed */
let feed = { meta: { careers: [], skills: [], generated: "" }, jobs: [] };
let status = {};          // listing status from the robot: { jobId: {status, lastSeen} }
let feedError = "";
let feedLoaded = false;   // true once data/jobs.json has been read at least once

async function loadFeed() {
  $("stamp").textContent = "Updating…";
  try {
    const [f, s] = await Promise.all([
      fetch("data/jobs.json", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("data/status.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    feed = f; status = s; feedError = ""; feedLoaded = true;
    const when = new Date(feed.meta.generated);
    $("stamp").textContent = !feed.meta.generated ? "No job feed yet" : "Jobs updated " + (isNaN(when) ? "recently" : when.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  } catch (e) {
    feedError = "Couldn't load today's jobs. Check your connection and tap Refresh. Your saved jobs are still here.";
    $("stamp").textContent = "Offline";
  }
  render();
}

/* ---------------------------------------------------------------- scoring */
const careerOf = (key) => feed.meta.careers.find((c) => c.key === key) || {};
function payCheck(job) {
  const c = careerOf(job.career);
  if (!job.hourly || c.bench_low == null) return "";
  if (job.hourly < c.bench_low) return "Below market";
  if (job.hourly >= c.bench_mid) return "Strong";
  return "Fair";
}
// Fit 1-5: starts at 3, goes up for good pay and skills you have, down for low pay and many missing skills.
function fitScore(job) {
  const p = me.profile || {};
  let s = 3;
  if (job.hourly && p.floor) { if (job.hourly < p.floor) s -= 1; else if (job.hourly >= p.floor * 1.4) s += 1; }
  const have = new Set((p.skills || []).map((x) => x.toLowerCase()));
  const needs = job.skills || [];
  const matched = needs.filter((x) => have.has(x.toLowerCase())).length;
  if (needs.length && matched >= 2) s += 1;
  if (needs.length >= 3 && matched === 0) s -= 1;
  if (/intern|junior|entry|tier 1|tier i\b|associate/i.test(job.title)) s += 1;
  return Math.max(1, Math.min(5, s));
}
function listingOf(id, job) {
  if (job && job.expires && job.expires < todayISO()) return "Closed";
  const st = status[id];
  if (st && st.status && st.status !== "Open") return st.status;
  if (id.startsWith("me:") || id.startsWith("sheet:")) return "";
  const inFeed = feed.jobs.some((j) => j.id === id);
  if (inFeed || (st && st.status === "Open")) return "Open";
  return feed.jobs.length ? "Unknown" : "";
}
/* Job picks (v0.9.0). ELI5: 13 kinds of jobs are sorted by the daily robot, so those match by "career".
   Everything else in the picker (Cashier, Welder, or words someone typed) matches by the words in the job title. */
const CAREER_LABELS = { helpdesk: "Help desk / IT", support: "Tech / customer support", security: "Security / SOC", python: "Python / automation",
  network: "Network technician", cloud: "Cloud support", food: "Restaurant / food service", retail: "Retail / store", warehouse: "Warehouse / logistics",
  callcenter: "Call center / customer service", office: "Office / admin", care: "Healthcare support", driver: "Driver / delivery" };
const keyOfLabel = (label) => Object.keys(CAREER_LABELS).find((k) => CAREER_LABELS[k] === label) || "";
const myPicks = (p) => p.picks || (p.careers || []).map((k) => ({ label: careerOf(k).label || CAREER_LABELS[k] || k, custom: false, terms: [] }));
function pickMatcher(p) {
  const careers = p.careers || [], extra = myPicks(p).filter((x) => !keyOfLabel(x.label));
  const has = (label) => extra.some((x) => x.label === label);
  const remote = has("Work from home / remote"), entry = has("Entry level / no experience");
  const words = extra.filter((x) => x.label !== "Work from home / remote" && x.label !== "Entry level / no experience")
    .flatMap((x) => x.terms || [x.label]).filter((t) => t.length >= 3)     // 2-letter words like "PA" also mean states and titles
    .map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "[ -]"));
  const titleWords = words.length ? new RegExp("\\b(?:" + words.join("|") + ")s?\\b", "i") : null;
  return (j) => careers.includes(j.career) || (titleWords && titleWords.test(`${j.title} ${j.type || ""}`))
    || (remote && j.remote === "Remote") || (entry && ((j.about || {}).years ?? 0) <= 1 && !(j.about || {}).degree);
}
// The robot only looks for in-person jobs around South Florida (ZIPs starting 330-334) for now.
const feedCovers = (p) => !p.zip || /^33[0-4]/.test(p.zip);
function myJobs() {
  const p = me.profile || {};
  const wanted = pickMatcher(p);
  return feed.jobs.filter(wanted)
    .filter((j) => (j.remote === "Remote" ? p.remote !== false : p.local && feedCovers(p)))
    .map((j) => ({ ...j, fit: fitScore(j), paycheck: payCheck(j) }));
}

// jobs you haven't saved or skipped yet, at or above your pay floor (unknown pay counts)
function freshJobs() {
  const floor = (me.profile || {}).floor || 0;
  return myJobs().filter((j) => !me.saved[j.id] && !me.skipped[j.id] && (!j.hourly || j.hourly >= floor));
}

/* ---------------------------------------------------------------- views */
const TABS = ["today", "jobs", "saved", "events", "skills", "me"];
let view = "today";
function setTab(tab) {
  if (!me.profile) tab = "setup";
  view = tab; setupFilled = false; pickerTouched = false;
  me.ui.tab = tab === "setup" || tab === "resume" ? me.ui.tab : tab; persist();
  ["setup", "resume", ...TABS].forEach((v) => ($("v-" + v).hidden = v !== tab));
  document.querySelectorAll("nav.tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  document.querySelector("nav.tabs").hidden = tab === "setup";
  if (tab === "gigs") return setTab("today");   // the Money tab moved out of Radar in v0.8.2
  window.scrollTo(0, 0);
  render();
}

function render() {
  const n = $("notice");
  n.hidden = !feedError; n.className = "banner bad"; n.textContent = feedError;
  if (!me.profile || view === "setup") { renderSetup(); return; }
  renderToday(); renderJobs(); renderSaved(); renderEvents(); renderSkills(); renderMe();
  if (view === "resume") renderResume();
  const fresh = freshJobs().length;
  $("b-new").textContent = fresh; $("b-new").hidden = !fresh;
}

const chip = (text, cls = "") => (text ? `<span class="chip ${cls}">${esc(text)}</span>` : "");
const STATUS_CLS = { Saved: "violet", Applying: "warn", Applied: "warn", Interview: "good", Offer: "good", Rejected: "plain", Dropped: "plain" };
function listingChip(l) {
  if (!l) return "";
  if (l === "Open") return chip("Listing open", "good");
  if (l === "Closed" || l === "Removed") return chip("Listing " + l.toLowerCase(), "bad");
  return chip("Listing not seen today", "plain");
}
function payChip(p) { return p ? chip("Pay: " + p.toLowerCase(), p === "Strong" ? "good" : p === "Below market" ? "bad" : "") : ""; }
function fitDots(n) { let s = `<span class="fit" aria-label="Fit ${n} of 5">`; for (let i = 1; i <= 5; i++) s += `<i class="${i <= n ? "on" : ""}"></i>`; return s + " fit</span>"; }
function sourceLine(j) {
  const u = safeUrl(j.sourceUrl);
  if (j.source === "Adzuna") return `<div class="source"><a class="adzuna" href="https://www.adzuna.com" target="_blank" rel="noopener">Jobs by Adzuna</a></div>`;
  if (j.source === "Himalayas") return `<div class="source">via ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">Himalayas</a>` : "Himalayas"}${j.posted ? " · posted " + esc(nice(j.posted)) : ""}</div>`;
  if (j.source) return `<div class="source">via ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(j.source)}</a>` : esc(j.source)}${j.posted ? " · posted " + esc(nice(j.posted)) : ""}</div>`;
  return "";
}
// "What this job is": built by the feed robot from the posting's own words (never made up).
function aboutBlock(j) {
  const a = j.about; if (!a) return "";
  const list = (h, xs) => xs && xs.length ? `<p class="small"><b>${h}</b></p><ul class="small">${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const facts = [j.type, j.remote, a.years != null ? `asks for ${a.years}+ yr experience` : "no years of experience listed", a.degree ? "mentions a degree" : ""].filter(Boolean).join(" · ");
  const body = list("What you'd do", a.does) + list("What they want", a.wants) + list("Nice to have", a.nice);
  return `<details class="about"><summary>What this job is &amp; what they want</summary><p class="small">${esc(facts)}</p>${body || `<p class="small">The posting doesn't spell this out. Open it on the site to read the full description.</p>`}</details>`;
}
// Red flags (scam signs) and softer "check this" notes, each with a tap-to-open WHY.
function flagBlock(j) {
  const info = j.flagInfo;
  if (!info) return j.flags && j.flags.length ? `<p class="flag">⚑ ${esc(j.flags.join(" · "))}</p>` : "";
  const grp = (lvl, icon, word) => {
    const xs = info.filter((f) => f.level === lvl); if (!xs.length) return "";
    return `<details class="flags ${lvl}"><summary>${icon} ${xs.length} ${word}${xs.length > 1 ? "s" : ""} <span class="q" aria-hidden="true">?</span></summary><ul>${xs.map((f) => `<li><b>${esc(f.label)}</b>${f.why ? ": " + esc(f.why) : ""}</li>`).join("")}</ul></details>`;
  };
  return grp("red", "⚑", "red flag") + grp("check", "⚠", "thing to check");
}

let setupFilled = false;   // fill the form once, so a background refresh never wipes what you're typing
let picker = null, pickerTouched = false;   // the searchable "Jobs to look for" menu (web/job-picker.js)
function renderSetup() {
  ["setup", ...TABS].forEach((v) => ($("v-" + v).hidden = v !== "setup"));
  document.querySelector("nav.tabs").hidden = true;
  if (setupFilled && feed.meta.careers.length) return;
  setupFilled = feed.meta.careers.length > 0;
  const p = me.profile || {};
  $("s-name").value = p.name || ""; $("s-floor").value = p.floor ?? 17; $("s-resume").value = p.resume || "";
  $("s-remote").checked = p.remote !== false; $("s-local").checked = p.local ?? true;
  $("s-city").innerHTML = `<option value="">Pick your city (South Florida list)</option>` + Object.keys(CITIES).map((c) => `<option value="${c}">${c.replace(/\b\w/g, (m) => m.toUpperCase())}</option>`).join("");
  $("s-zip").value = p.zip || ""; $("s-city").value = p.city || ""; $("s-miles").value = p.maxMi || 20; $("s-goal").value = p.goal || 5;
  if (!picker) picker = JobPicker.mount($("s-careers"), { onChange: () => { pickerTouched = true; } });
  if (!pickerTouched) picker.setSelected(myPicks(p).map((x) => x.label));
  $("s-skills").innerHTML = [...new Set([...(feed.meta.skills || []), ...(p.skills || [])])].map((s) => `<label class="check"><input type="checkbox" value="${esc(s)}" ${(p.skills || []).includes(s) ? "checked" : ""}> ${esc(s)}</label>`).join("") || '<p class="small">Skills load with the job feed.</p>';
  skillCount();
}
/* ---------------------------------------------------------------- read any resume (v0.8.0)
   ELI5: a .docx file is secretly a zip folder. Inside is word/document.xml, which holds the text.
   We unzip just that one file with the browser's built-in DecompressionStream, then keep the words. */
// PDFs: pdf.js (Mozilla's free PDF reader, Apache-2.0) is stored inside the app in web/vendor/pdfjs/,
// so the file never leaves the phone. It only downloads the first time someone picks a PDF.
async function pdfText(file) {
  const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const items = (await (await doc.getPage(n)).getTextContent()).items.filter((i) => i.str !== undefined);
    const rows = new Map();   // group words that sit on the same line (same height on the page)
    items.forEach((i) => { const y = Math.round(i.transform[5] / 3); if (!rows.has(y)) rows.set(y, []); rows.get(y).push(i); });
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, xs]) => {
      xs.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "", end = null;
      xs.forEach((i) => { const gap = end === null ? 0 : i.transform[4] - end; line += (line && gap > 2 && !line.endsWith(" ") && !i.str.startsWith(" ") ? (gap > 25 ? "   " : " ") : "") + i.str; end = i.transform[4] + (i.width || 0); });
      if (line.trim()) out.push(line.trim());
    });
  }
  return out.join("\n");
}
async function fileText(file) {
  if (/\.pdf$/i.test(file.name)) return pdfText(file);
  if (!/\.docx$/i.test(file.name)) return file.text();
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
  let eocd = -1; for (let i = buf.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a docx");
  let off = dv.getUint32(eocd + 16, true); const count = dv.getUint16(eocd + 10, true);
  for (let n = 0; n < count; n++) {
    const method = dv.getUint16(off + 10, true), size = dv.getUint32(off + 20, true), nameLen = dv.getUint16(off + 28, true);
    const extra = dv.getUint16(off + 30, true), comment = dv.getUint16(off + 32, true), local = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(buf.slice(off + 46, off + 46 + nameLen));
    if (name === "word/document.xml") {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), data = buf.slice(start, start + size);
      const xml = method === 0 ? new TextDecoder().decode(data)
        : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      return xml.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    }
    off += 46 + nameLen + extra + comment;
  }
  throw new Error("no text found");
}
function readResume(text) {
  const r = window.ResumeMaker.fromResume(text);
  return r.jobs ? r : null;
}
function skillCount() { const n = document.querySelectorAll("#s-skills input:checked").length; $("s-skillCount").textContent = n ? `(${n} checked)` : ""; }
document.addEventListener("change", (e) => { if (e.target.closest && e.target.closest("#s-skills")) skillCount(); });
function checkSkills(found) {
  const box = $("s-skills"), have = [...box.querySelectorAll("input")];
  let n = 0;
  found.forEach((sk) => {
    const low = sk.toLowerCase(), hit = have.find((i) => i.value.toLowerCase() === low || (low.length > 3 && i.value.toLowerCase().includes(low)) || (i.value.length > 3 && low.includes(i.value.toLowerCase())));
    if (hit) { if (!hit.checked) { hit.checked = true; n++; } return; }
    box.insertAdjacentHTML("beforeend", `<label class="check"><input type="checkbox" value="${esc(sk)}" checked> ${esc(sk)}</label>`); n++;
  });
  return n;
}
$("s-resumeFile").onchange = async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  try { $("s-resume").value = await fileText(f); $("s-read").click(); }
  catch { $("s-readMsg").textContent = "Couldn't read that file. Open it, copy all the text, and paste it in the box instead."; }
  ev.target.value = "";
};
$("s-read").onclick = () => {
  const r = readResume($("s-resume").value);
  if (!r) { $("s-readMsg").textContent = "Radar couldn't find your jobs. Make sure each job has dates, like \"Jan 2024 - Present\"."; return; }
  if (!me.facts.trim() || confirm("Replace the resume facts you already saved with the ones from this resume?")) me.facts = r.facts;
  const n = checkSkills(r.skills); skillCount(); persist();
  $("s-readMsg").textContent = `Found ${r.jobs} job${r.jobs === 1 ? "" : "s"} and checked ${n} skill${n === 1 ? "" : "s"} below. You can fix anything later on Me → My resume facts.`;
};
$("m-convert").onclick = () => {
  const r = readResume($("m-facts").value);
  if (!r) { $("factsMsg").textContent = "Paste your normal resume in the box first. Each job needs dates, like \"Jan 2024 - Present\"."; return; }
  $("m-facts").value = r.facts; $("factsMsg").textContent = `Turned it into ${r.jobs} job${r.jobs === 1 ? "" : "s"}. Check it, fix anything, then tap Save my facts.`;
};
$("m-resumeFile").onchange = async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  try { const r = readResume(await fileText(f)); if (!r) throw new Error();
    $("m-facts").value = r.facts; $("factsMsg").textContent = `Read ${r.jobs} job${r.jobs === 1 ? "" : "s"} from ${f.name}. Check it, then tap Save my facts.`; }
  catch { $("factsMsg").textContent = "Couldn't read that file. Open it, copy all the text, paste it in the box, and tap Turn a pasted resume into facts."; }
  ev.target.value = "";
};

$("setupForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if ($("s-resume").value.trim() && !me.facts.trim()) { const r = readResume($("s-resume").value); if (r) { me.facts = r.facts; checkSkills(r.skills); } }
  const picks = picker.getItems();
  if (!picks.length) { toast("Pick at least one kind of job."); return; }
  const careers = picks.map((x) => keyOfLabel(x.label)).filter(Boolean);
  me.profile = {
    name: $("s-name").value.trim(),
    careers,
    picks,
    floor: parseFloat($("s-floor").value) || 0,
    remote: $("s-remote").checked,
    local: $("s-local").checked,
    zip: $("s-zip").value.trim(), city: $("s-city").value, maxMi: parseFloat($("s-miles").value) || 20, goal: parseInt($("s-goal").value) || 5,
    skills: [...document.querySelectorAll("#s-skills input:checked")].map((i) => i.value),
    resume: $("s-resume").value.trim(),
  };
  persist(); toast("Saved. Here are your jobs."); setTab("jobs");
});

function renderToday() {
  const h = new Date().getHours(), name = me.profile.name;
  $("hello").textContent = (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + (name ? ", " + name : "");
  $("feedInfo").textContent = feed.jobs.length ? `${myJobs().length} job${myJobs().length === 1 ? "" : "s"} match${myJobs().length === 1 ? "es" : ""} what you're looking for. New ones arrive every morning.` : "";
  const saved = Object.entries(me.saved);
  const fresh = freshJobs();
  const count = (fn) => saved.filter(([, s]) => fn(s.status)).length;
  const follow = saved.filter(([, s]) => s.status === "Applied" && s.appliedOn && addDays(s.appliedOn, 7) <= todayISO());
  const dead = saved.filter(([id, s]) => ["Saved", "Applying"].includes(s.status) && ["Closed", "Removed"].includes(listingOf(id, s.job)));
  const goal = me.profile.goal || 5, monday = addDays(todayISO(), -((new Date().getDay() + 6) % 7));
  const appliedWeek = saved.filter(([, s]) => s.appliedOn && s.appliedOn >= monday).length;
  const tiles = [[`Applied this week (goal ${goal})`, `${appliedWeek}/${goal}`, appliedWeek < goal && new Date().getDay() >= 4], ["New jobs", fresh.length], ["Saved", count((x) => x === "Saved" || x === "Applying")], ["Applied", count((x) => ["Applied", "Interview", "Offer", "Rejected"].includes(x))],
    ["Interviews", count((x) => x === "Interview")], ["Follow-ups due", follow.length, follow.length > 0], ["Closed listings", dead.length, dead.length > 0]];
  $("tiles").innerHTML = tiles.map(([l, v, hot]) => `<div class="tile ${hot ? "hot" : ""}"><b>${v}</b><span>${l}</span></div>`).join("");

  const items = [];
  follow.forEach(([id, s]) => items.push(`<div class="alert"><p><b>Follow up:</b> ${esc(s.job.title)} at ${esc(s.job.company)}. You applied ${esc(nice(s.appliedOn))}.</p>
    <div class="actions"><button class="btn" type="button" data-copyfollow="${esc(id)}">Copy follow-up message</button><button class="btn quiet" type="button" data-followed="${esc(id)}">Done</button></div></div>`));
  dead.forEach(([id, s]) => items.push(`<div class="alert bad"><p><b>Listing ${esc(listingOf(id, s.job).toLowerCase())}:</b> ${esc(s.job.title)} at ${esc(s.job.company)}.</p><div class="actions"><button class="btn" type="button" data-setstatus="${esc(id)}|Dropped">Remove from my list</button></div></div>`));
  saved.filter(([, s]) => s.status === "Interview").forEach(([id, s]) => items.push(`<div class="alert good"><p><b>Interview:</b> ${esc(s.job.company)}. Get ready with a prep sheet.</p><div class="actions"><button class="btn" type="button" data-prep="${esc(id)}">Copy interview prep prompt</button></div></div>`));
  (me.events || []).filter((e) => e.going === "Yes" && e.date >= todayISO() && e.date <= addDays(todayISO(), 7)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
    items.push(`<div class="alert info"><p><b>${e.date === todayISO() ? "Today" : e.date === addDays(todayISO(), 1) ? "Tomorrow" : nice(e.date)}:</b> ${esc(e.name)}${e.time ? " at " + esc(e.time) : ""}${e.where ? " · " + esc(e.where) : ""}</p>
      <div class="actions"><button class="btn" type="button" data-seetalk="ev|${esc(e.id)}">Talking points</button></div></div>`);
  });
  if (fresh.length) items.push(`<div class="alert info"><p><b>${fresh.length} job${fresh.length > 1 ? "s" : ""}</b> waiting for a yes or no.</p><div class="actions"><button class="btn primary" type="button" data-tab="jobs">Review jobs</button></div></div>`);
  $("attention").innerHTML = items.join("") || `<p class="empty">You're all caught up. New matches arrive tomorrow morning.</p>`;
  $("installCard").innerHTML = isInstalled() ? "" : `<div class="alert info" style="margin-top:12px"><p><b>Tip:</b> install Radar so it opens like an app. See the Me tab.</p></div>`;
}

const FILTERS = ["Best", "Newest", "Near me", "Remote", "Local", "Skipped"];
function renderJobs() {
  $("jobFilters").innerHTML = FILTERS.map((f) => `<button type="button" data-filter="${f}" aria-pressed="${me.ui.filter === f}">${f}</button>`).join("");
  const floor = (me.profile || {}).floor || 0;
  let list = myJobs().filter((j) => !me.saved[j.id]);
  list = me.ui.filter === "Skipped" ? list.filter((j) => me.skipped[j.id]) : list.filter((j) => !me.skipped[j.id]);
  if (!$("showBelow").checked) list = list.filter((j) => !j.hourly || j.hourly >= floor);
  if (me.ui.filter === "Remote") list = list.filter((j) => j.remote === "Remote");
  const P = me.profile, home = P.city || "", maxMi = P.maxMi || 20;
  if (me.ui.filter === "Local") list = list.filter((j) => j.remote !== "Remote" && inArea(home, maxMi, j.location));
  if (me.ui.filter === "Near me") list = list.filter((j) => inArea(home, maxMi, `${j.location} ${j.remote}`));
  $("localSources").innerHTML = localSources(P.zip || "", (home || "").replace(/\b\w/g, (m) => m.toUpperCase())).map((x) => `<div><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b></a> ${chip(x.who === "auto" ? "Radar can check this" : "You check this", x.who === "auto" ? "good" : "plain")}<div class="small">${esc(x.why)}</div></div>`).join("");
  list.sort(me.ui.filter === "Newest" ? (a, b) => (b.posted || "").localeCompare(a.posted || "") : (a, b) => b.fit - a.fit || (b.hourly || 0) - (a.hourly || 0));
  if (!feed.jobs.length) { $("jobs").innerHTML = `<p class="empty">${feedError ? "Jobs will show up when you're back online." : feedLoaded ? "No jobs in the feed yet. The daily robot fills this in every morning." : "Loading jobs…"}</p>`; return; }
  let hint = "";
  if (["Near me", "Local"].includes(me.ui.filter) && !list.some((j) => !/remote/i.test(`${j.location} ${j.remote}`))) {
    const n = nearestLocal(home, myJobs(), (j) => j.location);
    hint = `<div class="alert info"><p><b>No in-person jobs within ${maxMi} miles yet.</b>${n ? ` Nearest: ${esc(n.j.title)} at ${esc(n.j.company)}, ${esc(n.j.location)} (~${n.c.miles} mi).` : ""} Raise the distance in Me → Edit what I'm looking for.</p></div>`;
  }
  if (!list.length) { $("jobs").innerHTML = hint + searchNow(me.ui.filter); return; }
  $("jobs").innerHTML = hint + list.map((j) => `<article class="card">
      <div class="chips">${fitDots(j.fit)}${chip(careerOf(j.career).label, "plain")}</div>
      <h3 class="title">${esc(j.title)}</h3>
      <div class="meta">${esc(j.company)} · ${esc(j.location)}</div>
      <div class="chips">${chip(j.pay || "Pay not listed", "plain")}${takeHomeChip(j.pay, j.hourly)}${commuteChip((me.profile || {}).city || "", (me.profile || {}).zip, `${j.location} ${j.remote}`)}${payChip(j.paycheck)}${j.hourly && j.hourly < floor ? chip("Below your floor", "bad") : ""}</div>
      ${j.summary ? `<p class="why">${esc(j.summary)}</p>` : ""}
      ${aboutBlock(j)}${flagBlock(j)}
      ${j.skills && j.skills.length ? `<p class="small">Mentions: ${esc(j.skills.join(", "))}</p>` : ""}
      <div class="actions">
        ${safeUrl(j.applyUrl) ? `<a class="btn" href="${esc(safeUrl(j.applyUrl))}" target="_blank" rel="noopener">Apply on site</a>` : ""}
        ${j.location && !/remote/i.test(`${j.location} ${j.remote || ""}`) ? `<a class="btn quiet" href="${esc(mapsLink((me.profile || {}).zip || "", j.location))}" target="_blank" rel="noopener">Directions</a>` : ""}
        <button class="btn primary" type="button" data-save="${esc(j.id)}">Save</button>
        ${me.skipped[j.id] ? `<button class="btn quiet" type="button" data-unskip="${esc(j.id)}">Bring back</button>` : `<button class="btn quiet" type="button" data-skip="${esc(j.id)}">Skip</button>`}
      </div>${sourceLine(j)}</article>`).join("") + `<div class="card">${searchNow(me.ui.filter, true)}</div>`;
}

const BSTAT = ["Saved", "Applying", "Applied", "Interview", "Offer", "Rejected", "Dropped"];
function renderSaved() {
  const rows = Object.entries(me.saved);
  if (!rows.length) { $("saved").innerHTML = `<p class="empty">Nothing saved yet. Tap Save on a job, or add one from anywhere with the button above.</p>`; return; }
  const done = (s) => ["Dropped", "Rejected"].includes(s.status) ? 1 : 0;
  rows.sort((a, b) => done(a[1]) - done(b[1]) || (b[1].savedOn || "").localeCompare(a[1].savedOn || ""));
  $("saved").innerHTML = rows.map(([id, s]) => {
    const j = s.job, l = listingOf(id, j), dead = l === "Closed" || l === "Removed";
    return `<article class="card ${dead ? "dead" : ""}">
      <div class="chips">${chip(s.status, STATUS_CLS[s.status])}${listingChip(l)}${s.appliedOn ? chip("Applied " + nice(s.appliedOn), "plain") : ""}</div>
      <h3 class="title">${esc(j.title)}</h3>
      <div class="meta">${esc(j.company)}${j.location ? " · " + esc(j.location) : ""}${j.pay ? " · " + esc(j.pay) : ""}</div>
      <div class="chips">${takeHomeChip(j.pay, j.hourly)}${commuteChip(me.profile.city || "", me.profile.zip, j.location)}</div>
      ${s.notes ? `<p class="why">${esc(s.notes)}</p>` : ""}
      <div class="actions">
        ${safeUrl(j.applyUrl) ? `<a class="btn" href="${esc(safeUrl(j.applyUrl))}" target="_blank" rel="noopener">Apply on site</a>` : ""}
        ${s.resume ? `<button class="btn primary" type="button" data-viewresume="${esc(id)}">My resume</button>` : `<button class="btn" type="button" data-makeresume="${esc(id)}">Make my resume</button>`}
        <label class="small" for="st-${esc(id)}" style="flex-direction:row;align-items:center;gap:6px;font-weight:600">Status
          <select class="btn" id="st-${esc(id)}" data-statussel="${esc(id)}">${BSTAT.map((x) => `<option ${x === s.status ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      </div>
      <details class="fold more"><summary>More</summary><div class="actions">
        ${safeUrl(s.docLink) ? `<a class="btn" href="${esc(safeUrl(s.docLink))}" target="_blank" rel="noopener">Tailored resume (Docs)</a>` : ""}
        <button class="btn" type="button" data-seetalk="job|${esc(id)}">Talking points</button>
        ${j.location && !/remote/i.test(`${j.location} ${j.remote || ""}`) ? `<a class="btn" href="${esc(mapsLink((me.profile || {}).zip || "", j.location))}" target="_blank" rel="noopener">Directions</a>` : ""}
        <button class="btn" type="button" data-tailor="${esc(id)}">Help writing a cover letter</button>
      </div><p class="small">Cover letter help copies a ready-made request. Paste it into a free AI chat like ChatGPT or Claude, and check what it writes before you send it.</p></details>
      </div>${sourceLine(j)}</article>`;
  }).join("");
}

function renderSkills() {
  const have = new Set((me.profile.skills || []).map((x) => x.toLowerCase()));
  const counts = {};
  myJobs().forEach((j) => (j.skills || []).forEach((s) => (counts[s] = (counts[s] || 0) + 1)));
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!list.length) { $("skills").innerHTML = `<p class="empty">Skill gaps show up once today's jobs load.</p>`; return; }
  const max = list[0][1];
  $("skills").innerHTML = list.map(([s, n]) => {
    const got = have.has(s.toLowerCase());
    return `<article class="card"><div class="skill"><h3 class="title">${esc(s)}</h3>${got ? chip("You have it", "good") : chip(n >= 3 ? "Learn next" : "Nice to have", n >= 3 ? "warn" : "plain")}
      <div class="bar" aria-hidden="true"><i style="width:${Math.round((n / max) * 100)}%"></i></div></div>
      <div class="meta">In ${n} of your jobs today</div>
      <div class="actions">${got ? `<button class="btn quiet" type="button" data-unhave="${esc(s)}">I don't have this</button>` : `<button class="btn" type="button" data-have="${esc(s)}">I have this</button>`}</div></article>`;
  }).join("");
}

function renderMe() {
  const p = me.profile;
  const labels = myPicks(p).map((x) => x.label).join(", ");
  $("meSummary").textContent = `Looking for: ${labels}. Pay floor: $${p.floor}/hr. ${p.remote ? "Remote" : ""}${p.remote && p.local ? " + " : ""}${p.local ? "local" : ""} jobs. ${p.skills.length} skill${p.skills.length === 1 ? "" : "s"} on file.${me.facts.trim() ? " Resume facts saved: every saved job gets a resume." : " Add your resume facts below to get automatic resumes."}`;
  if (document.activeElement !== $("m-facts")) $("m-facts").value = me.facts || "";
  $("installBtn").hidden = !installEvent;
}

/* ---------------------------------------------------------------- where jobs are: distance, commute and local sources ----------
  ELI5: Radar knows roughly where South Florida cities are (a dot on a map for each). It measures the straight
  line from your home city to the job's city, adds 30% for real roads, and guesses minutes (~28 mph locally, ~45 mph on longer highway trips).
  It's a rough guess; the "Directions" link opens Google Maps for the real drive or bus time. */
const CITIES = { "aventura": [25.957, -80.139], "boca raton": [26.368, -80.128], "boynton beach": [26.525, -80.066], "coconut grove": [25.728, -80.243],
  "coral gables": [25.721, -80.268], "coral springs": [26.271, -80.271], "cutler bay": [25.578, -80.337], "davie": [26.076, -80.252], "delray beach": [26.461, -80.073],
  "doral": [25.819, -80.355], "florida city": [25.448, -80.479], "fort lauderdale": [26.122, -80.137], "hialeah": [25.858, -80.278], "hollywood": [26.011, -80.149],
  "homestead": [25.468, -80.477], "kendall": [25.679, -80.317], "key largo": [25.087, -80.447], "lauderhill": [26.140, -80.213], "miami": [25.762, -80.192],
  "miami beach": [25.790, -80.130], "miami gardens": [25.942, -80.245], "miami lakes": [25.909, -80.309], "miramar": [25.987, -80.232], "north miami": [25.890, -80.187],
  "palmetto bay": [25.622, -80.325], "pembroke pines": [26.008, -80.296], "pinecrest": [25.667, -80.308], "plantation": [26.128, -80.233], "pompano beach": [26.238, -80.125],
  "princeton": [25.538, -80.409], "richmond heights": [25.631, -80.369], "south miami": [25.708, -80.293], "sunrise": [26.134, -80.113], "sweetwater": [25.763, -80.373],
  "tamiami": [25.759, -80.398], "the hammocks": [25.671, -80.444], "west kendall": [25.680, -80.420], "west palm beach": [26.715, -80.053], "weston": [26.100, -80.400] };
const ZIP_CITY = { "33030": "homestead", "33031": "homestead", "33032": "princeton", "33033": "homestead", "33034": "florida city", "33035": "homestead",
  "33039": "homestead", "33157": "palmetto bay", "33170": "homestead", "33176": "kendall", "33177": "richmond heights", "33183": "west kendall", "33186": "west kendall", "33187": "the hammocks",
  "33189": "cutler bay", "33190": "cutler bay", "33156": "pinecrest", "33143": "south miami", "33173": "west kendall", "33175": "tamiami", "33196": "the hammocks" };
const cityKey = (s) => { const t = String(s || "").toLowerCase(); const z = (t.match(/\b(33\d{3})\b/) || [])[1]; if (z && ZIP_CITY[z]) return ZIP_CITY[z]; return Object.keys(CITIES).sort((a, b) => b.length - a.length).find((c) => t.includes(c)) || ""; };
function miles(a, b) {
  if (!CITIES[a] || !CITIES[b]) return null;
  const [la1, lo1] = CITIES[a], [la2, lo2] = CITIES[b], r = Math.PI / 180;
  const d = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.sqrt(d));
}
function commute(home, loc) {
  if (/remote/i.test(loc || "")) return { remote: true };
  const c = cityKey(loc); if (!c) return null;
  const m = miles(home, c); if (m == null) return null;
  const road = m * 1.2;                                                   // roads are ~20% longer than a straight line
  return { city: c, miles: Math.round(road), minutes: Math.max(5, Math.round(road / (road > 15 ? 45 : 28) * 60 + 5)) };   // highways faster than local roads
}
const mapsLink = (homeZip, loc) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(homeZip || "")}&destination=${encodeURIComponent(loc || "")}&travelmode=driving`;
function commuteChip(home, homeZip, loc) {
  const c = commute(home, loc);
  if (!c) return "";
  if (c.remote) return `<span class="chip good">No commute</span>`;
  return `<span class="chip ${c.minutes > 45 ? "warn" : "plain"}" title="Rough estimate. Tap Directions for the real time.">~${c.minutes} min drive (${c.miles} mi)</span>`;
}
function nearestLocal(home, jobs, locOf) {             // closest in-person job, for the "nothing near you" message
  return jobs.map((j) => ({ j, c: commute(home, locOf(j)) })).filter((x) => x.c && !x.c.remote).sort((a, b) => a.c.miles - b.c.miles)[0];
}
function inArea(home, maxMi, loc) {
  if (/remote/i.test(loc || "")) return true;
  const c = commute(home, loc);
  return c ? c.miles <= maxMi : false;
}
// Places worth checking for local jobs. "auto" = the morning run searches it; "you" = open it yourself
// (these sites need your login or don't allow bots, so Radar never scans them).
// No jobs to show? Never make people wait for the next update: give them one-tap searches for
// exactly the kinds of jobs they picked, near their ZIP (or remote), on the biggest free job sites.
const SEARCH_WORDS = { helpdesk: "help desk", support: "technical support", security: "security analyst", python: "python developer entry level",
  network: "network technician", cloud: "cloud support", food: "restaurant crew member", retail: "retail sales associate", warehouse: "warehouse associate",
  callcenter: "customer service representative", office: "administrative assistant", care: "medical assistant", driver: "delivery driver" };
function searchNow(filter, sitesOnly) {
  const P = me.profile || {}, zip = P.zip || "", remoteOnly = filter === "Remote" || (!P.local && P.remote !== false);
  const where = remoteOnly ? "remote" : (zip || "");
  const kinds = myPicks(P).slice(0, 8).map((x) => { const k = keyOfLabel(x.label); return { label: x.label, q: k ? careerOf(k).search || SEARCH_WORDS[k] : (x.terms || [])[1] || x.label }; });
  const links = (k) => {
    const q = encodeURIComponent(k.q), l = encodeURIComponent(where);
    return [
      ["Indeed", `https://www.indeed.com/jobs?q=${q}&l=${l}`],
      ["Google", "https://www.google.com/search?ibp=htl;jobs&q=" + encodeURIComponent(`${k.q} jobs ${remoteOnly ? "remote" : "near " + (zip || "me")}`)],
      ...(remoteOnly ? [] : [["Snagajob", `https://www.snagajob.com/search?q=${q}&w=${encodeURIComponent(zip)}`]]),
    ].map(([n, u]) => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join("");
  };
  const why = filter === "Skipped" ? "You haven't skipped anything." : feedError ? "You're offline, so Radar's list can't load." :
    "Radar's list doesn't have a match right now. New jobs arrive every morning.";
  const tip = filter === "Skipped" || feedError ? "" : !P.local && !P.zip ? " Tip: turn on local jobs in Me → Edit what I'm looking for."
    : P.local && !feedCovers(P) ? " Local jobs only cover South Florida for now, so remote jobs may show more." : P.remote === false ? " Tip: turn on remote jobs in Me → Edit what I'm looking for." : "";
  const sites = `<details class="fold"><summary>Search other job sites</summary>
    <p class="small">These open outside Radar${remoteOnly ? " (remote)" : zip ? ` near ${esc(zip)}` : ""}. Found one you like? Go to <b>Saved → + Add any job</b> and Radar makes your resume for it.</p>
    ${kinds.map((k) => `<p class="small"><b>${esc(k.label)}</b></p><div class="actions">${links(k)}</div>`).join("")}</details>`;
  return sitesOnly ? sites : `<div class="card"><h3 class="title">No matches yet</h3><p class="why">${why}${tip}</p>${sites}</div>`;
}
function localSources(zip, cityName) {
  const z = encodeURIComponent(zip || ""), city = cityName || "my area", g = (q) => "https://www.google.com/search?q=" + encodeURIComponent(q);
  return [
    { name: "Indeed near you (15 mi)", who: "auto", url: `https://www.indeed.com/jobs?l=${z}&radius=15`, why: "Biggest list of local jobs of every kind." },
    { name: "Google jobs near you", who: "auto", url: g(`jobs near ${zip}`) + "&ibp=htl;jobs", why: "Pulls from many job sites, including small local companies." },
    { name: "Store and restaurant career sites", who: "auto", url: g(`hiring near ${zip} Target OR Walmart OR Publix OR Chipotle OR Starbucks OR "Home Depot"`), why: "Big chains post openings on their own sites first." },
    { name: "Snagajob (hourly)", who: "auto", url: `https://www.snagajob.com/search?w=${z}`, why: "Hourly and part-time jobs near you." },
    { name: "Government jobs", who: "auto", url: g(`${cityName ? city + " " : ""}city OR county jobs near ${zip}`), why: "City and county jobs: steady pay and good benefits." },
    { name: "Free job center near you", who: "auto", url: `https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx?location=${z}`, why: "American Job Centers (U.S. Dept. of Labor): free resume help, job fairs and hiring events." },
    { name: "Nextdoor", who: "you", url: "https://nextdoor.com/", why: "Neighbors post small-business and local gigs. Search \"hiring\"." },
    { name: "Facebook job groups", who: "you", url: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(city + " jobs")}`, why: "Local hiring groups. Watch for scams: never pay to apply." },
    { name: "Craigslist jobs", who: "you", url: "https://www.craigslist.org/", why: "Pick your city, then Jobs. Small local businesses. Scam-check everything." },
  ];
}

/* ---------------------------------------------------------------- take-home pay (same 2026 numbers as Paycheck Planner: IRS Rev. Proc. 2025-32) ----------
  ELI5: "$17/hr" isn't what lands in your bank. This takes out federal income tax and Social Security/Medicare
  (7.65%) for a single filer working 40 hrs/week, every-2-weeks paydays. Florida has no state income tax. Estimate only. */
const TAX = { std: 16100, fica: 0.0765, floors: [0, 12400, 50400, 105700, 201775, 256225, 640600], rates: [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37] };
function hourlyOf(pay, hourly) {
  if (+hourly > 0) return +hourly;
  const m = String(pay || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!m) return 0;
  let n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
  if (/yr|year|annual|salary/i.test(pay) || n >= 1000) n = n / 2080;     // yearly → hourly
  return n > 5 && n < 500 ? n : 0;
}
function takeHome(hourly) {
  if (!(hourly > 0)) return null;
  const year = hourly * 2080, taxable = Math.max(0, year - TAX.std);
  let fed = 0;
  TAX.floors.forEach((f, i) => { const top = TAX.floors[i + 1] ?? Infinity; if (taxable > f) fed += (Math.min(taxable, top) - f) * TAX.rates[i]; });
  const net = year - fed - year * TAX.fica;
  return { perCheck: Math.round(net / 26), perMonth: Math.round(net / 12), perYear: Math.round(net) };
}
const takeHomeChip = (pay, hourly) => { const t = takeHome(hourlyOf(pay, hourly)); return t ? `<span class="chip plain" title="Estimate: single filer, 40 hrs/week, Florida (no state tax)">≈ $${t.perCheck.toLocaleString()} take-home / 2 weeks</span>` : ""; };

/* ---------------------------------------------------------------- AI prompts (free: you paste them into Claude) */
function tailorPrompt(s) {
  const j = s.job, p = me.profile;
  return `Tailor my resume for this job. Rules: only use facts from MY RESUME below. You may reorder, choose and reword bullets to match the job's language and write a new 2-3 sentence summary. Never add a job, skill, tool, certification, degree, number or years of experience I don't list. If the job needs something I don't have, tell me separately instead of putting it in the resume.

Also give me: a 3-paragraph cover letter that mentions 2 specific facts about the company (research it and cite sources), 4 interview talking points, and 3 good questions to ask.

JOB: ${j.title} at ${j.company} (${j.location || ""}${j.pay ? ", " + j.pay : ""})
Posting: ${j.applyUrl || j.sourceUrl || "(no link)"}
${j.description || j.summary || ""}

MY RESUME:
${p.resume || me.facts || "(I haven't saved my resume in Radar yet. Ask me to paste it.)"}`;
}
function prepPrompt(s) {
  const j = s.job, p = me.profile;
  return `I have an interview for ${j.title} at ${j.company}. Make me a prep sheet: a short company snapshot (research it, cite sources), what the role does day to day, 10 likely questions (behavioral + help desk scenarios + security basics) with suggested STAR answers built ONLY from my resume below (mark where I should add a real example), 3 questions to ask them, and a 30-second "tell me about yourself".

MY RESUME:
${p.resume || me.facts || "(ask me to paste my resume)"}`;
}
function followPrompt(s) {
  return `Hi, I applied for the ${s.job.title} role on ${nice(s.appliedOn)} and wanted to say I'm still very interested. I'd love to bring my experience to your team. Happy to share anything else that helps. Thank you, ${me.profile.name || ""}`.trim();
}
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch { // clipboard blocked: show the text so it can be copied by hand
    const n = $("notice"); n.hidden = false; n.className = "banner";
    n.innerHTML = `<p class="small" style="margin:0">Copy this by hand:</p><textarea rows="6" readonly>${esc(text)}</textarea>`;
    window.scrollTo(0, 0);
  }
}

/* ---------------------------------------------------------------- button handling */
function saveJob(id) {
  const j = feed.jobs.find((x) => x.id === id); if (!j) return;
  me.saved[id] = { status: "Saved", savedOn: todayISO(), job: { ...j } };
  delete me.skipped[id];
  const made = makeResume(id, "", true);
  persist(); toast(made ? "Saved. Your resume is ready on the Saved tab." : "Saved"); render();
}

/* ---------------------------------------------------------------- resumes (resume.js does the matching)
  ELI5: makeResume() hands the job + your facts to ResumeMaker.build(), which picks your best-matching real
  bullets and skills. The result is kept with the saved job on this phone. */
function makeResume(id, kind, quiet) {
  const s = me.saved[id]; if (!s) return false;
  if (!(me.facts || "").trim()) { if (!quiet) { toast("Add your resume facts on the Me tab first."); setTab("me"); } return false; }
  const r = window.ResumeMaker.build(s.job, me.facts, kind || s.kind || "");
  if (!r) { if (!quiet) toast("Radar couldn't read a JOB: line in your facts. Check the Me tab."); return false; }
  s.resume = r; if (kind) s.kind = kind;
  return true;
}
let resumeId = null;
function showResume(id) {
  const s = me.saved[id]; if (!s || !s.resume) return;
  resumeId = id; setTab("resume");
}
function renderResume() {
  const s = me.saved[resumeId]; if (!s || !s.resume) return;
  const r = s.resume;
  $("r-title").textContent = `${s.job.title} · ${s.job.company}`;
  $("r-note").textContent = `Made ${nice(r.made)} (${r.kindLabel} style) from your facts only. Check it, then save it as a PDF to upload.`;
  $("r-kind").value = r.kind;
  $("r-body").innerHTML = window.ResumeMaker.toHtml(r, esc);
}
function setStatus(id, value) {
  const s = me.saved[id]; if (!s) return;
  s.status = value;
  if (value === "Applied" && !s.appliedOn) s.appliedOn = todayISO();
  if (value === "Interview" && !s.talk) makeTalk("job", id, true);
  persist(); toast(value === "Applied" ? "Applied. Follow-up reminder in 7 days." : "Status: " + value); render();
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.tab) return setTab(d.tab);
  if (d.filter) { me.ui.filter = d.filter; persist(); return renderJobs(); }
  if (d.save) return saveJob(d.save);
  if (d.skip) { me.skipped[d.skip] = todayISO(); persist(); toast("Skipped"); return render(); }
  if (d.unskip) { delete me.skipped[d.unskip]; persist(); return render(); }
  if (d.setstatus) { const [id, v] = d.setstatus.split("|"); return setStatus(id, v); }
  if (d.eventview) { me.ui.eventView = d.eventview; persist(); return renderEvents(); }
  if (d.seetalk) { const [k, id] = d.seetalk.split("|"); return seeTalk(k, id); }
  if (d.deltalk) { const [k, id] = d.deltalk.split("|"); const it = k === "ev" ? me.events.find((e) => e.id === id) : me.saved[id]; if (it) { delete it.talk; persist(); renderEvents(); } return; }
  if (d.copytalk) { const [k, id] = d.copytalk.split("|"); const it = k === "ev" ? me.events.find((e) => e.id === id) : me.saved[id]; if (it && it.talk) copy(window.TalkMaker.toText(k === "ev" ? it.name : `${it.job.title} - ${it.job.company}`, it.talk), "Talking points copied."); return; }
  if (d.delevent) { me.events = me.events.filter((e) => e.id !== d.delevent); persist(); toast("Deleted"); return renderEvents(); }
  if (d.makeresume) { if (makeResume(d.makeresume)) { persist(); showResume(d.makeresume); } return; }
  if (d.viewresume) return showResume(d.viewresume);
  if (d.tailor) return copy(tailorPrompt(me.saved[d.tailor]), "Copied. Paste it into ChatGPT or Claude.");
  if (d.prep) return copy(prepPrompt(me.saved[d.prep]), "Prep prompt copied. Paste it into Claude.");
  if (d.copyfollow) return copy(followPrompt(me.saved[d.copyfollow]), "Follow-up message copied.");
  if (d.followed) { me.saved[d.followed].appliedOn = todayISO(); persist(); toast("Next reminder in 7 days"); return render(); }
  if (d.have || d.unhave) {
    const s = d.have || d.unhave, list = new Set(me.profile.skills);
    d.have ? list.add(s) : list.delete(s); me.profile.skills = [...list]; persist(); return render();
  }
});
document.addEventListener("change", (ev) => {
  if (ev.target.dataset.statussel) setStatus(ev.target.dataset.statussel, ev.target.value);
  if (ev.target.dataset.going) {
    const e = me.events.find((x) => x.id === ev.target.dataset.going); if (!e) return;
    e.going = ev.target.value;
    const made = e.going === "Yes" && !e.talk && makeTalk("ev", e.id, true);
    persist(); toast(made ? "Going. Your talking points are ready." : "Going: " + e.going); renderEvents(); renderToday();
  }
  if (ev.target.id === "showBelow") renderJobs();
});

// add a job from anywhere
$("openAdd").onclick = () => { $("addForm").hidden = false; $("a-link").focus(); };
$("cancelAdd").onclick = () => { $("addForm").hidden = true; $("addForm").reset(); };
$("addForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const title = $("a-title").value.trim(), company = $("a-company").value.trim(), link = $("a-link").value.trim();
  if (!title || !company) { $("addMsg").textContent = "Add at least the job title and company."; return; }
  if (link && !safeUrl(link)) { $("addMsg").textContent = "The link should start with https://"; return; }
  const id = "me:" + Date.now(), auto = $("a-auto").checked;
  me.saved[id] = { status: "Saved", savedOn: todayISO(), kind: $("a-kind").value, job: { id, title, company, location: $("a-loc").value.trim(), pay: $("a-pay").value.trim(), applyUrl: link, sourceUrl: "", source: "Added by you", description: $("a-desc").value.trim() } };
  const made = auto && makeResume(id, "", false);
  persist(); $("addForm").reset(); $("a-auto").checked = true; $("addForm").hidden = true; $("addMsg").textContent = "";
  if (made) { toast("Saved. Here's your resume."); showResume(id); } else { toast("Saved"); render(); }
});

/* ---------------------------------------------------------------- events + talking points (talk.js builds them)
  ELI5: events live on this phone in me.events. Talking points are kept on the event (or saved job) they belong to,
  as e.talk = { intro, points, questions, bring }. */
function makeTalk(kind, id, quiet) {
  const it = kind === "ev" ? me.events.find((e) => e.id === id) : me.saved[id];
  if (!it) return false;
  if (!(me.facts || "").trim()) { if (!quiet) { toast("Add your resume facts on the Me tab first."); setTab("me"); } return false; }
  const t = window.TalkMaker.build(kind === "ev" ? it : { ...it.job, description: it.job.description || it.job.summary || "" }, kind === "ev" ? "event" : "job", me.facts);
  if (!t) { if (!quiet) toast("Radar couldn't read a JOB: line in your facts. Check the Me tab."); return false; }
  it.talk = t; return true;
}
function seeTalk(kind, id) {
  const it = kind === "ev" ? me.events.find((e) => e.id === id) : me.saved[id];
  if (it && !it.talk && makeTalk(kind, id)) persist();
  if (!it || !it.talk) return;
  me.ui.eventView = "talk"; persist(); setTab("events");
  const el = document.getElementById("tp-" + kind + id.replace(/\W/g, "")); if (el) el.scrollIntoView({ block: "start" });
}
const GOING = ["Maybe", "No", "Yes"];
function renderEvents() {
  me.events = me.events || [];
  const view = me.ui.eventView || "events";
  $("eventsPane").hidden = view !== "events"; $("talkPane").hidden = view !== "talk";
  document.querySelectorAll("[data-eventview]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.eventview === view)));
  const today = todayISO();
  const list = me.events.slice().sort((a, b) => ((a.date || "9") < today) - ((b.date || "9") < today) || (a.date || "9").localeCompare(b.date || "9"));
  $("eventList").innerHTML = list.length ? list.map((e) => {
    const past = e.date && e.date < today, link = safeUrl(e.link);
    return `<article class="card ${past ? "dead" : ""}">
      <div class="chips">${chip(e.date ? nice(e.date) + (e.time ? " · " + e.time : "") + (past ? " · past" : e.date === today ? " · today" : "") : "Date not set", past ? "plain" : e.date && e.date <= addDays(today, 7) ? "warn" : "")}${e.cost ? chip(e.cost, "plain") : ""}${e.going === "Yes" ? chip("Going", "good") : ""}${e.talk ? chip("Talking points ready", "violet") : ""}</div>
      <h3 class="title">${esc(e.name)}</h3>
      <div class="meta">${esc(e.group || "")}${e.where ? " · " + esc(e.where) : ""}</div>
      ${e.notes ? `<p class="why">${esc(e.notes)}</p>` : ""}
      <div class="actions">
        ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Open link</a>` : ""}
        <button class="btn ${e.talk ? "primary" : ""}" type="button" data-seetalk="ev|${esc(e.id)}">${e.talk ? "Talking points" : "Make talking points"}</button>
        <label class="small" for="go-${esc(e.id)}" style="flex-direction:row;align-items:center;gap:6px;font-weight:600">Going?
          <select class="btn" id="go-${esc(e.id)}" data-going="${esc(e.id)}">${GOING.map((g) => `<option ${g === e.going ? "selected" : ""}>${g}</option>`).join("")}</select></label>
        <button class="btn quiet" type="button" data-delevent="${esc(e.id)}">Delete</button>
      </div></article>`;
  }).join("") : `<p class="empty">No events yet. Add a career fair, hiring event or meetup.</p>`;

  const items = [
    ...me.events.filter((e) => e.talk).map((e) => ({ k: "ev", id: e.id, name: e.name, sub: [e.date ? nice(e.date) : "", e.group].filter(Boolean).join(" · "), when: e.date || "9", t: e.talk, chipText: "Event" })),
    ...Object.entries(me.saved).filter(([, s]) => s.talk).map(([id, s]) => ({ k: "job", id, name: `${s.job.title} · ${s.job.company}`, sub: s.status, when: "8", t: s.talk, chipText: "Job" })),
  ].sort((a, b) => a.when.localeCompare(b.when));
  const ul = (xs) => `<ul>${(xs || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  $("talkList").innerHTML = items.length ? items.map((x) => `<article class="card tp" id="tp-${x.k}${esc(x.id.replace(/\W/g, ""))}">
      <div class="chips">${chip(x.chipText, x.k === "ev" ? "violet" : "")}${x.sub ? chip(x.sub, "plain") : ""}${chip("Made " + nice(x.t.made), "plain")}</div>
      <h3 class="title">${esc(x.name)}</h3>
      <h4>Your 30-second intro</h4><p>${esc(x.t.intro)}</p>
      <h4>Talking points</h4>${ul(x.t.points)}
      <h4>Questions to ask</h4>${ul(x.t.questions)}
      <h4>Bring / do</h4>${ul(x.t.bring)}
      <div class="actions"><button class="btn" type="button" data-copytalk="${x.k}|${esc(x.id)}">Copy all</button><button class="btn quiet" type="button" data-deltalk="${x.k}|${esc(x.id)}">Remove</button></div></article>`).join("")
    : `<p class="empty">Nothing yet. Set an event to Going: Yes, or tap Talking points on a saved job.</p>`;
}
$("openEvent").onclick = () => { $("eventForm").hidden = false; $("ev-name").focus(); };
$("cancelEvent").onclick = () => { $("eventForm").hidden = true; $("eventForm").reset(); };
$("eventForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const name = $("ev-name").value.trim(), link = $("ev-link").value.trim();
  if (!name) { $("eventMsg").textContent = "Add at least the event name."; return; }
  if (link && !safeUrl(link)) { $("eventMsg").textContent = "The link should start with https://"; return; }
  const e = { id: "ev" + Date.now(), name, date: $("ev-date").value, time: $("ev-time").value, group: $("ev-group").value.trim(), where: $("ev-where").value.trim(),
    cost: $("ev-cost").value.trim(), link, going: $("ev-going").value, notes: $("ev-notes").value.trim() };
  me.events.push(e);
  const made = e.going === "Yes" && makeTalk("ev", e.id, true);
  persist(); $("eventForm").reset(); $("eventForm").hidden = true; $("eventMsg").textContent = "";
  toast(made ? "Saved. Your talking points are ready." : "Event saved"); renderEvents(); renderToday();
});

// resume facts + the resume page
$("saveFacts").onclick = () => {
  const text = $("m-facts").value;
  const f = window.ResumeMaker.parseFacts(text);
  if (text.trim() && !f.jobs.length) { $("factsMsg").textContent = "Saved, but Radar didn't find a JOB: line. Check the format above."; }
  else $("factsMsg").textContent = text.trim() ? `Saved: ${f.jobs.length} jobs, ${f.skills.reduce((n, g) => n + g.items.length, 0)} skills, ${f.education.length + f.certs.length + f.studying.length} school/cert lines.` : "Cleared.";
  me.facts = text; persist(); renderMe();
};
$("remakeAll").onclick = () => {
  const ids = Object.keys(me.saved).filter((id) => !["Dropped", "Rejected"].includes(me.saved[id].status));
  const n = ids.filter((id) => makeResume(id, "", true)).length;
  persist(); toast(n ? `Remade ${n} resume${n > 1 ? "s" : ""}` : "Save your facts first."); render();
};
$("r-print").onclick = () => window.print();
$("r-copy").onclick = () => { const s = me.saved[resumeId]; if (s && s.resume) copy(window.ResumeMaker.toText(s.resume), "Resume copied as text."); };
$("r-kind").onchange = () => { if (makeResume(resumeId, $("r-kind").value)) { persist(); renderResume(); toast("Remade as " + $("r-kind").selectedOptions[0].text); } };

// profile, backup, reset
$("editProfile").onclick = () => setTab("setup");
$("refresh").onclick = () => loadFeed();
$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(me, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `radar-backup-${todayISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); $("backupMsg").textContent = "Backup downloaded.";
};
$("importFile").onchange = async (ev) => {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()); if (!data.saved) throw new Error();
    if (data.radarMerge) { $("backupMsg").textContent = mergeIn(data); persist(); render(); }   // an import file: ADD to what you have
    else { me = Object.assign(blank(), data); persist(); $("backupMsg").textContent = "Backup loaded."; render(); }   // a full backup: REPLACE
  } catch { $("backupMsg").textContent = "That file isn't a Radar backup."; }
  ev.target.value = "";
};
// Import file (radarMerge: true): adds saved jobs, events and facts WITHOUT deleting anything you already have.
function mergeIn(d) {
  const key = (j) => `${(j.title || "").toLowerCase()}|${(j.company || "").toLowerCase()}`;
  const have = new Set(Object.values(me.saved).map((s) => key(s.job)));
  let jobs = 0, evs = 0;
  Object.entries(d.saved || {}).forEach(([id, s]) => { if (!me.saved[id] && !have.has(key(s.job))) { me.saved[id] = s; jobs++; } });
  const evHave = new Set(me.events.map((e) => `${e.name}|${e.date}`));
  (d.events || []).forEach((e) => { if (!evHave.has(`${e.name}|${e.date}`)) { me.events.push(e); evs++; } });
  if (d.facts && !me.facts.trim()) me.facts = d.facts;
  if (d.profile && me.profile) ["zip", "city", "maxMi", "goal", "floor"].forEach((k) => { if (!me.profile[k] && d.profile[k]) me.profile[k] = d.profile[k]; });
  return `Added ${jobs} saved job${jobs === 1 ? "" : "s"} and ${evs} event${evs === 1 ? "" : "s"}. Nothing you already had was changed.`;
}
$("resetBtn").onclick = () => { $("resetConfirm").hidden = false; };
$("resetNo").onclick = () => { $("resetConfirm").hidden = true; };
$("resetYes").onclick = () => { me = blank(); persist(); $("resetConfirm").hidden = true; toast("Deleted"); setTab("setup"); };

/* ---------------------------------------------------------------- install + offline */
let installEvent = null;
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; if (me.profile) renderMe(); });
$("installBtn").onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; renderMe(); };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadFeed(); });

/* ---------------------------------------------------------------- start */
setTab(me.profile ? me.ui.tab || "today" : "setup");
loadFeed();
