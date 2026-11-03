/*
  resume.js - Radar's resume maker. Works offline, no AI, no internet.

  ELI5: you type your real resume facts once (Me tab). When you save a job, Radar reads the job's title and
  description, gives every one of your bullets and skills a "how well does this match?" score, and builds a
  one-page resume from your best-matching facts, in your own words. It never writes anything new, so it can't
  invent a skill or a job you don't have.

  The facts format (one thing per line):
    NAME: Terrence Young
    CONTACT: City, FL · phone · email
    JOB: Title | Company | City, ST | Feb 2026 – Jul 2026
    - a bullet about that job
    PROJECT: Name | Oct 2026
    - a bullet
    SKILLS Help desk: skill one; skill two; skill three
    EDUCATION: Cybersecurity coursework, Miami Dade College
    CERT: Claude 101, Anthropic
    STUDYING: CompTIA Security+
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
    if (KINDS.it.spot.test(title)) return "it";
    if (KINDS.store.spot.test(title)) return "store";
    const all = `${title} ${job.description || job.summary || ""}`;
    if (KINDS.it.spot.test(all)) return "it";
    if (KINDS.store.spot.test(all)) return "store";
    return "other";
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
    const lead = kind === "it" ? "Customer support professional" : "Customer-focused team member";
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

  const api = { parseFacts, kindOf, build, toHtml, toText, KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ResumeMaker = api;
})(typeof self !== "undefined" ? self : this);
