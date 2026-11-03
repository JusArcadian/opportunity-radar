/*
  talk.js - talking points for events and jobs. Works offline, no AI.

  ELI5: before a career fair, meetup or interview, you need three things: a short intro, a few things worth
  saying about yourself, and good questions to ask. This file builds all of that from YOUR resume facts
  (the same ones resume.js uses) plus a set of proven question lists for each kind of event.
  It never adds a fact about you. Where a real story helps, it says [your example] so you fill it in.
*/
(function (root) {
  "use strict";
  const R = root.ResumeMaker || (typeof require !== "undefined" ? require("./resume.js") : null);

  // What kind of thing is it? (decides which questions and what to bring)
  function typeOf(item, kind) {
    if (kind === "job") return "job";
    const t = `${item.name || ""} ${item.group || ""} ${item.notes || ""}`.toLowerCase();
    if (/career fair|job fair|hiring event|hiring day|open interview|recruit|career expo/.test(t)) return "hiring";
    if (/meetup|meeting|ctf|conference|bsides|workshop|talk|hackmiami|owasp|isaca|issa|chapter|webinar|hacker|club|summit/.test(t)) return "meetup";
    return "general";
  }

  const QUESTIONS = {
    hiring: ["Which roles are you hiring for today, and which ones fit someone with customer service experience?",
      "What does training look like in the first week or two?",
      "What days, hours or shifts are you trying to fill?",
      "What's the next step after today, and how soon do you decide?",
      "Who should I follow up with, and what's the best way to reach them?"],
    meetup: ["How did you get started in this field?",
      "What would you tell a beginner who's studying for Security+ to focus on next?",
      "Are there beginner-friendly projects, CTFs or volunteer roles in this group?",
      "What does a normal day look like in your job?",
      "Do you know anyone hiring for entry-level IT or security roles?"],
    job: ["What does a normal day look like in this role?",
      "What do new people find hardest in their first 90 days?",
      "How will you measure success in the first few months?",
      "What training or support do new team members get?",
      "What are the next steps, and when do you expect to decide?"],
    general: ["What brought you here today?",
      "What's the best way for someone new to get involved?",
      "Who else here should I talk to?",
      "Is there anything coming up that a beginner could help with?"],
  };
  const BRING = {
    hiring: ["Printed copies of your resume (Saved tab → My resume → Print)", "Your availability: days and hours you can work",
      "Dress one step nicer than the job's uniform", "Get one name and follow up within 24 hours"],
    meetup: ["Phone charged, with your LinkedIn QR code ready", "A goal: meet 3 people and add them to your People list",
      "Send a LinkedIn note within 48 hours (Template 1 on your sheet)"],
    job: ["Two printed copies of your resume", "Practice your 30-second intro out loud twice",
      "Send a thank-you note the same day (Template 4 on your sheet)"],
    general: ["Your 30-second intro practiced once out loud", "Follow up with anyone you meet within 48 hours"],
  };

  function joinNice(xs) { return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]; }

  function build(item, kind, factsText) {
    if (!R) return null;
    const f = R.parseFacts(factsText);
    if (!f.jobs.length) return null;
    const type = typeOf(item, kind);
    const first = (f.name || "").split(" ")[0] || "I";
    const latest = f.jobs[0];
    const studying = (f.studying[0] || "").replace(/\s*\(.*\)$/, "");
    const allBullets = f.jobs.flatMap((j) => j.bullets).join(" ").toLowerCase();
    const support = /customer|guest|service/.test(allBullets);

    // Intro: who you are (latest job, as written), what you're working on, why you're here.
    const focus = kind === "job" ? `the ${item.title} role at ${item.company}`
      : type === "hiring" ? (item.group ? `the roles ${item.group} is hiring for` : "the roles you're hiring for")
      : type === "meetup" ? `${item.group || "this group"} and meet people working in the field`
      : (item.name || "this event");
    let intro = `Hi, I'm ${first}. Most recently I worked as a ${latest.title} at ${latest.company}${support ? ", helping customers solve problems" : ""}.`;
    if (studying && (kind === "job" ? /it|tech|support|help|desk|security|analyst|computer/i.test(item.title || "") : type !== "hiring")) intro += ` I'm studying for ${studying}.`;
    intro += kind === "job" ? ` I'm excited about ${focus}.` : type === "hiring" ? ` I'm here to learn about ${focus}.` : ` I'm here to learn about ${focus}.`;

    // Talking points: your best-matching real bullets for this event/job (scored by resume.js).
    const resume = R.build({ title: kind === "job" ? item.title : item.name, company: kind === "job" ? item.company : item.group,
      description: `${item.description || ""} ${item.notes || ""} ${type === "meetup" ? "security network computer technical" : "customer service team"}` }, factsText, "");
    const points = [];
    resume.jobs.slice(0, 3).forEach((j) => { if (j.bullets[0]) points.push(`At ${j.company}: ${j.bullets[0].charAt(0).toLowerCase() + j.bullets[0].slice(1)}.`); });
    if (studying && (type === "meetup" || resume.kind === "it")) points.push(`What you're working toward: ${studying} (studying now).`);
    if (resume.project && (type === "meetup" || resume.kind === "it")) points.push(`Something you built: ${resume.project.title.split(":")[0]}. ${(resume.project.bullets[0] || "").replace(/\.?$/, ".")}`);
    points.push("[your example]: a time you calmed down an upset customer or fixed a problem fast.");

    return { type, intro, points: points.slice(0, 6), questions: QUESTIONS[type].slice(), bring: BRING[type].slice(), made: new Date().toISOString().slice(0, 10) };
  }

  function toText(name, t) {
    const sec = (h, xs) => xs && xs.length ? `${h}\n${xs.map((x) => "- " + x).join("\n")}\n\n` : "";
    return `${name}\n\nYOUR 30-SECOND INTRO\n${t.intro}\n\n${sec("TALKING POINTS", t.points)}${sec("QUESTIONS TO ASK", t.questions)}${sec("BRING / DO", t.bring)}`.trim();
  }

  const api = { build, typeOf, toText, QUESTIONS, BRING };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TalkMaker = api;
})(typeof self !== "undefined" ? self : this);
