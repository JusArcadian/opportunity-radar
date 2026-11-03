/*
  resume.js - Radar's resume maker. Works offline, no AI, no internet.

  ELI5: you type your real resume facts once (Me tab). When you save a job, Radar reads the job's title and
  description, gives every one of your bullets and skills a "how well does this match?" score, and builds a
  one-page resume from your best-matching facts, in your own words. It never writes anything new, so it can't
  invent a skill or a job you don't have.

  The facts format (one thing per line):
    NAME: First Last
    CONTACT: City, State · phone · email
    JOB: Job title | Company | City, State | Mon YYYY – Mon YYYY
    - a bullet about that job
    PROJECT: Project name | Mon YYYY
    - a bullet
    SKILLS Group name: skill one; skill two; skill three
    EDUCATION: School name, degree or coursework
    CERT: Certificate name, who gave it
    STUDYING: a class or certificate in progress
    SUMMARY store: (optional) your own summary for store/retail jobs
    SUMMARY it: (optional) your own summary for IT jobs
    SUMMARY: (optional) your own summary for any other job
*/
(function (root) {
  "use strict";

  // Words that tell us what kind of job it is, and what that kind of job cares about.
  const KINDS = {
    it: {
      label: "IT / tech",
      spot: /\b(help ?desk|service desk|it support|desktop support|technician|technical support|tech support|support specialist|support analyst|it specialist|network|cyber|security analyst|soc|system administrator|sysadmin|geek squad|computer)\b/i,
      words: ["ticket", "troubleshoot", "windows", "desktop", "hardware", "network", "printer", "remote", "support", "escalat", "email", "outlook",
        "active directory", "server", "endpoint", "security", "mfa", "password", "documentation", "guides", "computer", "systems", "technical", "python", "automation", "customer", "plain language"],
    },
    store: {
      label: "Store / retail",
      spot: /\b(sales associate|cashier|retail|store|stock|merchandis|grocery|front end|bagger|deli|bakery|produce|team member|crew member|customer service associate|sales floor|key holder|keyholder|publix|best buy|gamestop|target|walmart|costco|home depot|lowe'?s|cvs|walgreens|winn-dixie|aldi|marshalls|ross|game stop)\b/i,
      words: ["customer", "guest", "cash", "card", "transaction", "sales", "sell", "product", "store", "team", "fast", "busy", "complaint", "question",
        "safety", "clean", "organized", "records", "accurate", "multitask", "communication", "explain", "goals", "customer service", "objections", "microsoft office"],
    },
    food: {
      label: "Restaurant / food service",
      spot: /\b(crew member|cook|barista|server|host|hostess|dishwasher|food service|kitchen|busser|restaurant|cafe|chipotle|starbucks|mcdonald'?s|chick-fil-a|taco bell|wendy'?s|subway|panera)\b/i,
      words: ["customer", "guest", "food", "safety", "clean", "cash", "card", "register", "team", "fast", "busy", "order", "prep", "accurate", "friendly", "communication", "organized", "shift"],
    },
    warehouse: {
      label: "Warehouse / logistics",
      spot: /\b(warehouse|package handler|forklift|picker|packer|material handler|loader|fulfillment|shipping|receiving|logistics)\b/i,
      words: ["safety", "inventory", "pack", "pick", "load", "lift", "scanner", "accurate", "fast", "team", "organized", "records", "shipping", "equipment", "deadline"],
    },
    office: {
      label: "Office / admin",
      spot: /\b(administrative|admin assistant|receptionist|front desk|data entry|office|clerk|scheduler|coordinator)\b/i,
      words: ["records", "accurate", "document", "schedul", "phone", "email", "microsoft", "office", "excel", "data", "organized", "customer", "communication", "systems", "multitask"],
    },
    care: {
      label: "Healthcare support",
      spot: /\b(medical assistant|patient|caregiver|home health|cna|pharmacy|phlebotom|dental assistant|clinic)\b/i,
      words: ["patient", "care", "safety", "records", "accurate", "communication", "calm", "schedul", "clean", "team", "compassion", "cpr", "privacy"],
    },
    drive: {
      label: "Driver / delivery",
      spot: /\b(driver|courier|delivery)\b/i,
      words: ["deliver", "route", "safety", "on time", "customer", "license", "records", "accurate", "load", "vehicle"],
    },
    other: { label: "Other", spot: /$^/, words: ["customer", "communication", "records", "accurate", "fast", "goals", "team", "explain", "organized", "safety"] },
  };
  const STOP = new Set("the and for with you your our are will this that from have has job work able must who what when into able also more than each them they their about other such per any all can not but may".split(" "));

  function parseFacts(text) {
    const f = { name: "", contact: "", jobs: [], projects: [], skills: [], education: [], certs: [], studying: [], summaries: {} };
    let current = null;
    String(text || "").split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      const m = line.match(/^([A-Za-z ]+?)(?:\s+([^:]+))?:\s*(.*)$/);           // "KEY rest: value"
      const bullet = line.match(/^[-•*]\s*(.+)$/);
      if (bullet && current) { current.bullets.push(bullet[1].trim()); return; }
      if (!m) return;
      const key = m[1].trim().toUpperCase(), extra = (m[2] || "").trim(), val = m[3].trim();
      if (key === "NAME") f.name = val;
      else if (key === "CONTACT") f.contact = val;
      else if (key === "JOB" || key === "PROJECT") {
        const [title = "", company = "", place = "", dates = ""] = val.split("|").map((x) => x.trim());
        current = key === "JOB" ? { title, company, place, dates, bullets: [] } : { title, dates: company, bullets: [] };
        (key === "JOB" ? f.jobs : f.projects).push(current);
      } else if (key === "SKILLS") f.skills.push({ group: extra || "Skills", items: val.split(";").map((x) => x.trim()).filter(Boolean) });
      else if (key === "EDUCATION") f.education.push(val);
      else if (key === "CERT" || key === "CERTIFICATION") f.certs.push(val);
      else if (key === "STUDYING") f.studying.push(val);
      else if (key === "SUMMARY") f.summaries[(extra || "any").toLowerCase()] = val;
    });
    return f;
  }

  function kindOf(job, pick) {
    if (pick && KINDS[pick]) return pick;
    const title = `${job.title || ""} ${job.company || ""}`;
    const order = ["it", "food", "warehouse", "care", "drive", "office", "store"];   // most specific first
    const hit = (t) => order.find((k) => KINDS[k].spot.test(t));
    return hit(title) || hit(`${title} ${job.description || job.summary || ""}`) || "other";
  }

  function jobWords(job) {
    const text = `${job.title || ""} ${job.description || job.summary || ""}`.toLowerCase();
    return new Set((text.match(/[a-z][a-z+#.]{3,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 7)));
  }

  // How well one of your facts matches this job: kind-of-job words count 2, words from the posting count 1.
  function score(fact, kind, words) {
    const t = fact.toLowerCase();
    let s = 0;
    KINDS[kind].words.forEach((w) => { if (t.includes(w)) s += 2; });
    (t.match(/[a-z][a-z+#.]{3,}/g) || []).forEach((w) => { if (words.has(w.slice(0, 7))) s += 1; });
    return s;
  }
  const best = (list, kind, words, n) => list.map((text, i) => ({ text, i, s: score(text, kind, words) }))
    .sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n);

  function joinNice(list) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]; }

  // A summary built only from your facts (or your own SUMMARY line, if you wrote one).
  function summaryFor(f, kind, skills) {
    const own = f.summaries[kind] || (kind === "store" ? f.summaries.retail : "") || f.summaries.any;
    if (own) return own;
    const companies = joinNice(f.jobs.slice(0, 3).map((j) => j.company).filter(Boolean));
    const all = f.jobs.flatMap((j) => j.bullets).join(" ").toLowerCase();
    const strengths = [];
    if (/customer|guest/.test(all)) strengths.push("customer service");
    if (kind !== "it" && /sales|sell|product/.test(all)) strengths.push("sales");
    if (kind !== "it" && /cash|card|transaction/.test(all)) strengths.push("cash and card handling");
    if (/record|document/.test(all)) strengths.push(kind === "it" ? "documenting every interaction" : "accurate record keeping");
    if (kind === "it" && /step by step|escalat/.test(all)) strengths.push("step-by-step troubleshooting with customers");
    const lead = kind === "it" ? "Customer support professional" : /customer|guest|patient/.test(all) ? "Customer-focused team member" : "Dependable team member";
    let s = `${lead} with experience at ${companies}${strengths.length ? " in " + joinNice(strengths.slice(0, 3)) : ""}.`;
    if (kind === "it" && skills.length) s += ` Skills include ${joinNice(skills.slice(0, 3))}.`;
    if (kind === "it" && f.studying.length) s += ` Currently studying for ${f.studying[0].replace(/\s*\(.*\)$/, "")}.`;
    if (kind !== "it" && /fast|busy/.test(all + " " + f.skills.flatMap((g) => g.items).join(" ").toLowerCase())) s += " Comfortable in fast-paced, busy settings.";
    return s;
  }

  function build(job, factsText, pickKind) {
    const f = parseFacts(factsText);
    if (!f.jobs.length) return null;
    const kind = kindOf(job, pickKind), words = jobWords(job);
    const jobs = f.jobs.map((j) => ({ ...j, bullets: best(j.bullets, kind, words, kind === "it" ? 3 : 3).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.text) }));
    const groups = f.skills.map((g) => {
      const scored = g.items.map((text, i) => ({ text, i, s: score(text, kind, words) }));
      const total = scored.reduce((n, x) => n + x.s, 0);
      // store/other jobs: a skill must match a kind-of-job word, not just one stray word from the posting
      const keep = scored.filter((x) => x.s >= (kind === "it" ? 1 : 2)).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.text);
      return { group: g.group, items: keep.length ? keep : (kind === "it" ? g.items.slice(0, 4) : []), total };
    }).filter((g) => g.items.length).sort((a, b) => b.total - a.total).slice(0, 4);
    const topSkills = groups.flatMap((g) => g.items);
    const showProject = f.projects.length && (kind === "it" || /computer|tech|software|spreadsheet|excel|python|data/i.test(job.description || ""));
    const project = showProject ? { ...f.projects[0], bullets: best(f.projects[0].bullets, kind, words, 3).map((x) => x.text) } : null;
    const school = kind === "it" ? [...f.studying.map((s) => `${s.replace(/\s*\(.*\)$/, "")} (currently studying)`), ...f.education, ...f.certs]
      : [...f.education, ...f.certs, ...f.studying.map((s) => `${s.replace(/\s*\(.*\)$/, "")} (currently studying)`)];
    return { kind, kindLabel: KINDS[kind].label, name: f.name, contact: f.contact, headline: job.title || "", summary: summaryFor(f, kind, topSkills),
      groups: groups.map(({ group, items }) => ({ group, items })), jobs, project, school, made: new Date().toISOString().slice(0, 10) };
  }

  function toHtml(r, esc) {
    const ul = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    return `<div class="resume">
<h2>${esc(r.name)}</h2><p class="contact">${esc(r.contact)}</p>
<p class="headline">${esc(r.headline)}</p>
<h4>Summary</h4><p>${esc(r.summary)}</p>
${r.groups.length ? `<h4>Skills</h4><ul>${r.groups.map((g) => `<li><b>${esc(g.group)}:</b> ${esc(g.items.join("; "))}</li>`).join("")}</ul>` : ""}
<h4>Experience</h4>${r.jobs.map((j) => `<p><b>${esc(j.title)}</b>, ${esc(j.company)}${j.place ? ", " + esc(j.place) : ""}${j.dates ? " · " + esc(j.dates) : ""}</p>${ul(j.bullets)}`).join("")}
${r.project ? `<h4>Project</h4><p><b>${esc(r.project.title)}</b>${r.project.dates ? " · " + esc(r.project.dates) : ""}</p>${ul(r.project.bullets)}` : ""}
${r.school.length ? `<h4>Education &amp; Certifications</h4>${ul(r.school)}` : ""}
</div>`;
  }

  function toText(r) {
    const out = [r.name, r.contact, "", r.headline.toUpperCase(), "", "SUMMARY", r.summary, ""];
    if (r.groups.length) { out.push("SKILLS"); r.groups.forEach((g) => out.push(`${g.group}: ${g.items.join("; ")}`)); out.push(""); }
    out.push("EXPERIENCE");
    r.jobs.forEach((j) => { out.push(`${j.title}, ${j.company}${j.place ? ", " + j.place : ""}${j.dates ? " · " + j.dates : ""}`); j.bullets.forEach((b) => out.push("- " + b)); out.push(""); });
    if (r.project) { out.push("PROJECT", `${r.project.title}${r.project.dates ? " · " + r.project.dates : ""}`); r.project.bullets.forEach((b) => out.push("- " + b)); out.push(""); }
    if (r.school.length) { out.push("EDUCATION & CERTIFICATIONS"); r.school.forEach((s) => out.push("- " + s)); }
    return out.join("\n").trim();
  }


  /* ---------------------------------------------------------------- any resume -> facts (v0.8.0)
    ELI5: people paste a normal resume. This reads it top to bottom, notices the section titles
    (Experience, Education, Skills...), spots job lines by their dates, and rewrites everything
    in the facts format above. It only moves your own words around, it never adds any. */
  const MON = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  const DATE = `(?:${MON}\\s*\\d{4}|\\d{1,2}\\/\\d{2,4}|\\d{4})`;
  const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to)\\s*(${DATE}|present|current|now)`, "i");
  const HEAD = [
    ["summary", /^(professional\s+)?(summary|profile|objective|about me)\b/i],
    ["jobs", /^(work\s+|professional\s+|relevant\s+)?(experience|employment|work history|history)\b/i],
    ["school", /^(education|schooling|training)\b/i],
    ["skills", /^(skills|core skills|key skills|technical skills|abilities|strengths|competencies)\b/i],
    ["certs", /^(certifications?|certificates?|licenses?( (and|&) certifications?)?)\b/i],
    ["projects", /^(projects?|portfolio)\b/i],
    ["other", /^(references|volunteer|activities|interests|awards|languages)\b/i],
  ];
  const cap = (s) => s.replace(/\s+/g, " ").trim();
  const isBullet = (l) => /^[-•*▪●◦·‣–]\s*/.test(l);
  const noBullet = (l) => l.replace(/^[-•*▪●◦·‣–]\s*/, "").trim();
  const looksPlace = (s) => /^[A-Z][A-Za-z .'-]+,\s*([A-Z]{2}|[A-Z][a-z]+)\b/.test(s) || /^remote$/i.test(s);

  // hide commas that aren't separators: "(Concessions, Usher)" and "Company, Inc."
  const guard = (t) => t.replace(/\([^)]*\)/g, (m) => m.replace(/,/g, "\u0001").replace(/;/g, "\u0002")).replace(/,\s*(inc|llc|ltd|corp|co|l\.l\.c)\b\.?/gi, (m) => m.replace(",", "\u0001"));
  const unguard = (t) => t.replace(/\u0001/g, ",").replace(/\u0002/g, ";");
  function splitHeader(text) {
    const parts = guard(text).split(/\s+[|•·–—-]\s+|\s*\|\s*|,\s+|\s+at\s+/).map((x) => cap(unguard(x))).filter(Boolean);
    let title = parts[0] || "", company = parts[1] || "", place = "";
    const rest = parts.slice(2);
    // "City, ST" was split by the comma: glue it back
    if (rest.length >= 2 && /^[A-Z]{2}$/.test(rest[1])) place = `${rest[0]}, ${rest[1]}`;
    else if (rest.length) place = rest.join(", ");
    return { title, company, place };
  }

  function fromResume(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\t/g, " ").trim());
    const out = { name: "", contact: [], summary: [], jobs: [], school: [], skills: [], certs: [], projects: [], studying: [] };
    let sec = "top", job = null, prev = "";
    lines.forEach((raw) => {
      const line = cap(raw);
      if (!line) { prev = ""; return; }
      const bare = line.replace(/[:\s]+$/, "");
      const h = bare.length <= 40 && HEAD.find(([, re]) => re.test(bare));
      if (h) { sec = h[0]; job = null; prev = ""; return; }
      const inl = line.match(/^([A-Za-z &]{4,30}):\s*(.+)$/), ih = inl && HEAD.find(([, re]) => re.test(inl[1]));
      if (ih && ["skills", "certs", "school"].includes(ih[0])) { sec = ih[0]; job = null; prev = ""; return void handleList(sec, inl[2]); }
      if (sec === "top") {
        if (!out.name && line.split(" ").length <= 4 && !/[@\d]/.test(line)) { out.name = line; return; }
        if (/@|\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}|linkedin|github|,\s*[A-Z]{2}\b/.test(line)) { out.contact.push(...line.split(/\s*[|•·]\s*/).map(cap).filter(Boolean)); return; }
        out.summary.push(line); return;
      }
      if (sec === "summary") { out.summary.push(line); return; }
      if (sec === "jobs" || sec === "projects") {
        const m = line.match(RANGE);
        if (m && !isBullet(line)) {
          const dates = `${cap(m[1])} – ${cap(m[2]).replace(/^(current|now)$/i, "Present").replace(/^present$/i, "Present")}`;
          let head = cap(line.replace(m[0], "").replace(/[\s|,·•–—-]+$/, "").replace(/^[\s|,·•–—-]+/, ""));
          // two-line headers: "Company, City" on one line, "Title   Jan 2024 - Present" on the next
          if (prev && head.split(" ").length <= 6 && !(job && job.bullets.length === 0 && job.from === prev)) head = head ? `${head} | ${prev}` : prev;
          if (job && job.from === prev && job.bullets.length === 0) (sec === "jobs" ? out.jobs : out.projects).pop();
          const p = splitHeader(head || prev);
          job = { ...p, dates, bullets: [], from: line };
          (sec === "jobs" ? out.jobs : out.projects).push(job);
          prev = ""; return;
        }
        if (job && (isBullet(line) || line.length > 45 || line.split(" ").length >= 5)) { job.bullets.push(noBullet(line).replace(/\.$/, "")); prev = ""; return; }
        prev = line; return;
      }
      if (["skills", "school", "certs"].includes(sec)) handleList(sec, line);
    });
    function handleList(where, line) {
      if (/currently studying|in progress|expected/i.test(line) && !/\b(college|university|school)\b/i.test(line)) return void out.studying.push(noBullet(line).replace(/\s*\((currently studying|in progress)\)/i, ""));
      if (where === "school") return void out.school.push(noBullet(line));
      if (where === "certs") return void out.certs.push(noBullet(line));
      const t = noBullet(line), m = t.match(/^([^:]{2,30}):\s*(.+)$/);
      const items = guard(m ? m[2] : t).split(/\s*[,;|•·]\s*/).map((x) => cap(unguard(x))).filter((x) => x && x.length <= 40);
      if (items.length) out.skills.push({ group: m ? cap(m[1]) : "Skills", items });
    }
    // merge skills that share a group name
    const groups = [];
    out.skills.forEach((g) => { const same = groups.find((x) => x.group === g.group); same ? same.items.push(...g.items) : groups.push(g); });
    const L = [];
    if (out.name) L.push(`NAME: ${out.name}`);
    if (out.contact.length) L.push(`CONTACT: ${out.contact.join(" · ")}`);
    out.jobs.forEach((j) => { L.push(`JOB: ${j.title} | ${j.company} | ${j.place} | ${j.dates}`); j.bullets.forEach((b) => L.push(`- ${b}`)); });
    out.projects.forEach((j) => { L.push(`PROJECT: ${[j.title, j.company].filter(Boolean).join(": ")} | ${j.dates}`); j.bullets.forEach((b) => L.push(`- ${b}`)); });
    groups.forEach((g) => L.push(`SKILLS ${g.group}: ${g.items.join("; ")}`));
    out.school.forEach((s) => L.push(`EDUCATION: ${s}`));
    out.certs.forEach((s) => L.push(`CERT: ${s}`));
    out.studying.forEach((s) => L.push(`STUDYING: ${s}`));
    if (out.summary.length) L.push(`SUMMARY: ${cap(out.summary.join(" "))}`);
    return { facts: L.join("\n"), jobs: out.jobs.length, skills: groups.flatMap((g) => g.items), found: out };
  }

  const api = { parseFacts, kindOf, build, toHtml, toText, fromResume, KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ResumeMaker = api;
})(typeof self !== "undefined" ? self : this);
