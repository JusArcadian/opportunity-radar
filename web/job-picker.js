/* Job Picker: a searchable "Jobs to look for" menu for Opportunity Radar.
   No libraries needed. Use it like this:

     const picker = JobPicker.mount(document.getElementById("jobs-to-look-for"), {
       selected: ["Help desk / IT", "Tech / customer support"],   // what the person picked before
       onChange: (labels) => { saveSomewhere(labels); }           // runs every time they change a pick
     });
     picker.getLabels();       // ["Help desk / IT", ...]
     picker.getSearchTerms();  // ["help desk", "it support", ...] other names for those jobs
     picker.getItems();        // [{ label, custom, terms }] what app.js saves in the profile

   To add a job: add one line to GROUPS. Format: ["Name people see", "other names, employers, misspellings-free words"].
   Colors: uses the app's --surface, --ink, --muted, --line, --accent, --accent-soft if they exist, else dark navy. */
(function (global) {
  "use strict";

  const GROUPS = [
    ["Popular starting points", [
      ["Entry level / no experience", "entry level, no experience, first job, trainee, apprentice, will train, general labor, helper"],
      ["Part-time", "part time, weekends only, evenings, after school"],
      ["Seasonal / temporary", "seasonal, temp, temporary, holiday help, summer job, contract"],
      ["Work from home / remote", "remote, work from home, wfh, telecommute, online job, virtual"],
      ["Gig work / side jobs", "gig, side hustle, freelance, doordash, uber, instacart, taskrabbit, odd jobs"],
      ["Internships", "intern, internship, co-op, student worker, work study"],
    ]],
    ["Food & restaurants", [
      ["Restaurant / food service", "restaurant, food service, crew member, team member, fast food, chipotle, mcdonalds, burger king, wendys, taco bell, chick-fil-a, subway, kfc, popeyes, pizza hut, dominos, panera"],
      ["Cook / line cook", "cook, line cook, prep cook, short order, chef, kitchen"],
      ["Server / waiter", "server, waiter, waitress, food runner, busser, table service, applebees, olive garden"],
      ["Host / hostess", "host, hostess, greeter, restaurant front desk"],
      ["Barista / coffee shop", "barista, coffee, starbucks, dunkin, cafe"],
      ["Bartender", "bartender, barback, mixologist, bar staff"],
      ["Dishwasher / kitchen helper", "dishwasher, dish, steward, kitchen helper, kitchen porter"],
      ["Baker / pastry", "baker, bakery, pastry, cake decorator"],
      ["Butcher / deli", "butcher, meat cutter, deli clerk, seafood counter"],
      ["Catering", "catering, banquet server, event food"],
      ["School or hospital cafeteria", "cafeteria, lunch aide, dietary aide, food service worker"],
      ["Restaurant manager", "restaurant manager, shift leader, shift manager, kitchen manager, general manager"],
    ]],
    ["Retail & stores", [
      ["Retail / store", "retail, store associate, sales associate, sales floor, target, walmart, best buy, gamestop, home depot, lowes, macys, kohls, ross, tj maxx, marshalls, old navy"],
      ["Cashier", "cashier, checkout, register, front end, publix, aldi, kroger, winn-dixie, whole foods"],
      ["Grocery / stock clerk", "grocery, stocker, stock associate, shelf stocker, produce clerk, overnight stock, merchandiser, bagger, courtesy clerk"],
      ["Pharmacy technician / clerk", "pharmacy tech, pharmacy technician, pharmacy clerk, cvs, walgreens"],
      ["Electronics / phone sales", "cell phone sales, wireless sales, t-mobile, verizon, at&t, computer sales, apple store"],
      ["Clothing / fashion", "fashion, apparel, stylist, boutique, fitting room"],
      ["Car sales", "car sales, auto sales, dealership, carmax"],
      ["Store manager", "store manager, assistant manager, keyholder, department supervisor, retail manager"],
      ["Loss prevention", "loss prevention, asset protection, store detective"],
    ]],
    ["Customer service & sales", [
      ["Call center / customer service", "call center, customer service, customer service representative, csr, contact center, phone agent, chat support, alorica, teleperformance, concentrix"],
      ["Tech / customer support", "tech support, technical support, customer support specialist, product support, saas support"],
      ["Sales representative", "sales rep, account executive, inside sales, outside sales, door to door, bdr, sdr"],
      ["Bank teller / member service", "bank teller, teller, credit union, member service representative, personal banker"],
      ["Insurance agent", "insurance agent, insurance sales, claims rep, state farm, allstate, geico"],
      ["Real estate", "real estate agent, realtor, leasing agent, leasing consultant, property manager"],
      ["Travel agent", "travel agent, reservations agent, booking agent"],
    ]],
    ["Office & admin", [
      ["Office / admin", "administrative assistant, admin assistant, office assistant, office clerk, secretary, executive assistant"],
      ["Receptionist / front desk", "receptionist, front desk, front office, greeter, office coordinator"],
      ["Data entry", "data entry, typist, keyer, records clerk, document processing"],
      ["Scheduler / dispatcher", "scheduler, dispatcher, coordinator, appointment setter"],
      ["Mailroom / courier", "mailroom, mail clerk, usps, post office, mail carrier, courier"],
      ["Project coordinator", "project coordinator, project manager, program coordinator, scrum master"],
      ["Human resources", "human resources, hr, recruiter, talent acquisition, payroll, benefits, onboarding"],
      ["Paralegal / legal assistant", "paralegal, legal assistant, law clerk, legal secretary, court clerk"],
      ["Lawyer", "attorney, lawyer, associate attorney, counsel"],
    ]],
    ["Money & business", [
      ["Accounting / bookkeeping", "accountant, bookkeeper, accounts payable, accounts receivable, billing clerk, cpa, audit, quickbooks"],
      ["Tax preparer", "tax preparer, h&r block, jackson hewitt, tax season"],
      ["Finance / banking", "financial analyst, loan officer, mortgage, underwriter, investment, wealth, credit analyst"],
      ["Business analyst", "business analyst, operations analyst, strategy, consultant"],
      ["Operations / general manager", "operations manager, general manager, supervisor, team lead, director"],
      ["Buyer / purchasing", "buyer, purchasing agent, procurement, supply chain analyst"],
    ]],
    ["Healthcare", [
      ["Healthcare support", "healthcare, medical support, patient care, patient services, hospital worker, clinic"],
      ["Nurse (RN / LPN)", "nurse, nursing, registered nurse, rn, lpn, lvn, nurse practitioner"],
      ["Nursing assistant (CNA)", "cna, certified nursing assistant, nurse aide, patient care technician, pct"],
      ["Medical assistant", "medical assistant, ma, clinical assistant, phlebotomist, phlebotomy"],
      ["Home health / caregiver", "caregiver, home health aide, hha, personal care aide, companion, elder care, senior care"],
      ["Dental", "dental assistant, dental hygienist, dentist, dental receptionist"],
      ["Medical office / billing", "medical receptionist, medical billing, medical coding, coder, patient access, medical records"],
      ["Therapy / rehab", "physical therapist, occupational therapist, speech therapist, therapy aide, rehab, respiratory therapist"],
      ["Lab / imaging", "lab technician, medical lab, x-ray tech, radiology, ultrasound, sonographer, mri"],
      ["EMT / paramedic", "emt, paramedic, ambulance, first responder"],
      ["Mental health / counseling", "counselor, therapist, behavior technician, rbt, psychologist, peer support"],
      ["Doctor / physician assistant", "doctor, physician, physician assistant, pa, resident"],
      ["Pharmacist", "pharmacist, pharmd"],
      ["Vet tech / animal care", "vet tech, veterinary assistant, veterinarian, kennel, animal shelter, dog groomer, pet groomer, dog walker, pet sitter, petsmart, petco"],
    ]],
    ["School, kids & community", [
      ["Teacher", "teacher, educator, elementary teacher, high school teacher, substitute teacher, sub"],
      ["Teacher's aide / paraprofessional", "teacher aide, teaching assistant, paraprofessional, para, classroom aide"],
      ["Childcare / daycare", "childcare, daycare, preschool, nanny, babysitter, child care worker, au pair"],
      ["Tutor", "tutor, tutoring, test prep, homework help"],
      ["Coach / camp counselor", "coach, camp counselor, youth worker, after school program, lifeguard, recreation"],
      ["College / school staff", "registrar, admissions, academic advisor, school office, bus aide, librarian, library assistant"],
      ["Social work / nonprofit", "social worker, case manager, nonprofit, community outreach, program assistant, volunteer coordinator"],
      ["Church / faith based", "church, ministry, pastor, youth pastor, parish"],
    ]],
    ["Driving & delivery", [
      ["Driver / delivery", "driver, delivery driver, courier, amazon flex, doordash, uber eats, pizza delivery, ups, fedex"],
      ["Truck driver (CDL)", "truck driver, cdl, class a, class b, tractor trailer, otr, trucker"],
      ["Rideshare / taxi", "rideshare, uber, lyft, taxi, chauffeur, limo driver"],
      ["Bus / shuttle driver", "bus driver, school bus, shuttle driver, transit operator, paratransit"],
      ["Pilot / airline crew", "pilot, flight attendant, airline crew, ramp agent, gate agent, airport, baggage handler"],
      ["Boat / marine crew", "deckhand, boat captain, marina, yacht crew, cruise ship"],
    ]],
    ["Warehouse & factory", [
      ["Warehouse / logistics", "warehouse, warehouse associate, picker, packer, order filler, amazon, fulfillment center, logistics, shipping and receiving"],
      ["Forklift operator", "forklift, reach truck, pallet jack, lift operator, material handler"],
      ["Manufacturing / production", "manufacturing, production worker, assembler, assembly line, machine operator, factory, packaging"],
      ["Machinist / CNC", "machinist, cnc, tool and die, fabricator"],
      ["Quality inspector", "quality control, qc, inspector, quality assurance inspector"],
      ["Inventory / supply", "inventory clerk, stock clerk, supply clerk, cycle counter, supply tech"],
    ]],
    ["Trades & construction", [
      ["Construction / laborer", "construction, laborer, general labor, demolition, roofer, drywall, painter, concrete, mason, framer"],
      ["Electrician", "electrician, electrical apprentice, journeyman, lineman, wiring"],
      ["Plumber", "plumber, plumbing, pipefitter, apprentice plumber"],
      ["HVAC", "hvac, air conditioning, ac tech, refrigeration, heating and cooling"],
      ["Carpenter", "carpenter, cabinet maker, finish carpenter, woodworker"],
      ["Welder", "welder, welding, mig, tig, fabrication"],
      ["Solar / utility installer", "solar installer, cable installer, fiber tech, utility worker, telecom technician, spectrum, comcast"],
      ["Handyman / maintenance", "handyman, maintenance technician, building maintenance, apartment maintenance, facilities tech"],
      ["Mechanic / auto tech", "mechanic, auto technician, automotive, oil change, tire tech, jiffy lube, autozone, advance auto, diesel mechanic, body shop"],
      ["Car wash / detailing", "car wash, detailer, auto detailing, valet, parking attendant, lot attendant"],
      ["Aircraft / marine mechanic", "aircraft mechanic, a&p, aviation maintenance, boat mechanic, marine technician"],
      ["Architect / drafter", "architect, cad drafter, autocad, surveyor, estimator, construction manager"],
    ]],
    ["Cleaning & outdoors", [
      ["Janitor / cleaner", "janitor, custodian, cleaner, cleaning, commercial cleaning, porter"],
      ["Housekeeping / maid", "housekeeper, housekeeping, maid, room attendant, hotel cleaner, airbnb cleaner"],
      ["Landscaping / lawn care", "landscaper, lawn care, groundskeeper, tree trimmer, gardener, irrigation"],
      ["Pest control / pool service", "pest control, exterminator, pool cleaner, pool technician"],
      ["Moving / junk removal", "mover, moving helper, junk removal, furniture delivery, trash collector, sanitation worker"],
      ["Farm / agriculture", "farm worker, farmhand, agriculture, harvest, greenhouse, ranch"],
      ["Environmental / park ranger", "park ranger, environmental technician, conservation, wildlife, water treatment"],
    ]],
    ["Hotels, travel & fun", [
      ["Hotel / hospitality", "hotel, front desk agent, bellhop, concierge, night auditor, guest services, resort, marriott, hilton"],
      ["Theme park / attractions", "theme park, disney, universal, ride operator, zoo, aquarium, attraction, ticket taker"],
      ["Movie theater / entertainment", "movie theater, usher, concessions, regal, amc, bowling alley, arcade, stadium, arena"],
      ["Casino", "casino, dealer, slot attendant, hard rock"],
      ["Events / promoter", "event staff, event coordinator, brand ambassador, promoter, wedding planner, stagehand"],
      ["Gym / fitness", "gym, personal trainer, fitness instructor, yoga instructor, planet fitness, la fitness, front desk gym"],
      ["Tour guide", "tour guide, excursion, cruise staff, museum guide, docent"],
    ]],
    ["Beauty & personal care", [
      ["Hair stylist / barber", "hair stylist, hairdresser, barber, salon, great clips, shampoo assistant"],
      ["Nails / skin care", "nail tech, manicurist, esthetician, lash tech, waxing, makeup artist"],
      ["Massage / spa", "massage therapist, spa attendant, spa"],
      ["Tattoo / piercing", "tattoo artist, piercer"],
      ["Funeral / mortuary", "funeral home, mortuary, cemetery, embalmer"],
    ]],
    ["Security & public service", [
      ["Security guard", "security guard, security officer, unarmed security, armed guard, bouncer, allied universal, event security, tsa"],
      ["Police / corrections", "police officer, deputy, sheriff, correctional officer, corrections, 911 dispatcher"],
      ["Firefighter", "firefighter, fire department, fire rescue"],
      ["Military", "military, army, navy, air force, marines, coast guard, national guard"],
      ["Government jobs", "government, city jobs, county jobs, state jobs, federal, clerk, usajobs, public works"],
    ]],
    ["Tech & IT", [
      ["Help desk / IT", "help desk, it support, service desk, desktop support, it technician, tier 1, computer repair"],
      ["Network technician", "network technician, noc technician, network support, network admin, cabling"],
      ["Cloud support", "cloud support, aws, azure, cloud engineer, devops, site reliability"],
      ["Security / SOC", "soc analyst, cybersecurity, cyber security, security analyst, information security, infosec, pen tester, grc"],
      ["Python / automation", "python, automation, rpa, scripting, junior python"],
      ["Software developer", "software engineer, programmer, developer, coder, java, javascript, web developer, front end, back end, full stack, app developer"],
      ["QA / software tester", "qa tester, software tester, game tester, test engineer, quality assurance"],
      ["Data analyst", "data analyst, sql, excel, tableau, power bi, reporting analyst, data scientist, data engineer"],
      ["AI / machine learning", "ai, machine learning, prompt engineer, data labeling, ai trainer"],
      ["Systems admin", "system administrator, sysadmin, windows server, linux admin, database administrator, dba"],
      ["IT field technician", "field technician, deskside support, it field tech, smart hands"],
      ["Product manager", "product manager, product owner, technical program manager"],
    ]],
    ["Creative & media", [
      ["Graphic design", "graphic designer, adobe, illustrator, photoshop, canva, logo designer"],
      ["UX / web design", "ux designer, ui designer, web designer, figma"],
      ["Marketing", "marketing, marketing coordinator, digital marketing, seo, advertising, brand manager"],
      ["Social media / content", "social media manager, content creator, influencer, tiktok, community manager"],
      ["Writing / editing", "writer, copywriter, editor, proofreader, journalist, technical writer"],
      ["Photo / video", "photographer, videographer, video editor, camera operator, film crew, production assistant"],
      ["Music / performing arts", "musician, dj, singer, actor, dancer, sound engineer, audio tech"],
      ["Game development", "game developer, game designer, 3d artist, animator, roblox, unity, unreal"],
      ["Translator / interpreter", "translator, interpreter, bilingual, spanish, creole, sign language, asl"],
    ]],
    ["Science & engineering", [
      ["Engineer", "mechanical engineer, electrical engineer, civil engineer, industrial engineer, aerospace engineer, chemical engineer"],
      ["Engineering technician", "engineering technician, electronics technician, biomedical technician, avionics"],
      ["Lab / research assistant", "research assistant, lab assistant, chemist, biologist, clinical research, scientist"],
    ]],
  ];

  const POPULAR = ["Entry level / no experience", "Work from home / remote", "Restaurant / food service", "Retail / store",
    "Call center / customer service", "Warehouse / logistics", "Driver / delivery", "Healthcare support", "Office / admin", "Help desk / IT"];

  const CSS = `
.jp{--jp-surface:var(--surface,#182033);--jp-ink:var(--ink,#E7ECF6);--jp-muted:var(--muted,#9AA6BF);--jp-line:var(--line,#2A3550);--jp-accent:var(--accent,#7AA7F2);--jp-soft:var(--accent-soft,#1E2E52);
  display:block;border:1px solid var(--jp-line);border-radius:14px;margin:0;padding:12px 14px 14px;min-width:0;color:var(--jp-ink);font-family:inherit;font-size:15px;box-sizing:border-box}
.jp *{box-sizing:border-box}
.jp legend{font-weight:700;padding:0 6px;font-size:14px}
.jp label{flex-direction:row;font-size:15px}
.jp-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px}
.jp-count{font-size:13px;color:var(--jp-muted)}
.jp-link{appearance:none;background:none;border:0;color:var(--jp-accent);font-weight:600;font-size:13px;font-family:inherit;padding:6px 2px;cursor:pointer}
.jp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 10px}
.jp-chips:empty{display:none}
.jp-chip{display:inline-flex;align-items:center;max-width:100%;background:var(--jp-soft);color:var(--jp-ink);border-radius:999px;font-size:13px;font-weight:600;padding-left:12px}
.jp-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jp-chip button{appearance:none;background:none;border:0;color:inherit;width:34px;height:34px;font-size:17px;line-height:1;cursor:pointer;flex:none}
.jp-field{display:flex;align-items:center;border:1px solid var(--jp-line);border-radius:12px;background:var(--jp-surface);padding-left:12px;min-height:48px}
.jp-field:focus-within{border-color:var(--jp-accent);box-shadow:0 0 0 1px var(--jp-accent)}
.jp-field svg{flex:none;color:var(--jp-muted)}
.jp-field input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--jp-ink);font-size:16px;font-family:inherit;padding:12px 8px;width:100%}
.jp-field input::placeholder{color:var(--jp-muted)}
.jp-field input::-webkit-search-cancel-button{display:none}
.jp-icon{appearance:none;background:none;border:0;color:var(--jp-muted);width:44px;height:46px;cursor:pointer;flex:none;font-size:18px;display:flex;align-items:center;justify-content:center}
.jp-icon[hidden]{display:none}
.jp-icon svg{transition:transform .15s}
.jp-open .jp-toggle svg{transform:rotate(180deg)}
.jp-panel{margin-top:8px;border:1px solid var(--jp-line);border-radius:12px;background:var(--jp-surface);overflow:hidden}
.jp-status{font-size:13px;color:var(--jp-muted);margin:0;padding:10px 12px 4px}
.jp-status:empty{display:none}
.jp-list{max-height:min(52vh,380px);overflow-y:auto;overscroll-behavior:contain;padding:0 0 4px;-webkit-overflow-scrolling:touch}
.jp-h{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--jp-muted);margin:0;padding:12px 12px 4px}
.jp-opt{display:flex;align-items:center;gap:12px;min-height:46px;padding:7px 12px;cursor:pointer;font-weight:600;line-height:1.25}
.jp-opt:hover{background:var(--jp-soft)}
.jp-opt:focus-within{background:var(--jp-soft)}
.jp-opt input{flex:none;width:22px;height:22px;margin:0;padding:0;accent-color:var(--jp-accent);cursor:pointer}
.jp-opt small{display:block;font-weight:400;font-size:12px;color:var(--jp-muted)}
.jp-opt mark{background:none;color:var(--jp-accent)}
.jp-group{border-top:1px solid var(--jp-line)}
.jp-group summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:8px 12px;cursor:pointer;font-weight:700}
.jp-group summary::-webkit-details-marker{display:none}
.jp-group summary::after{content:"";width:8px;height:8px;border-right:2px solid var(--jp-muted);border-bottom:2px solid var(--jp-muted);transform:rotate(45deg);margin-right:4px;flex:none}
.jp-group[open] summary::after{transform:rotate(-135deg)}
.jp-group summary b{margin-left:auto;font-size:12px;color:var(--jp-accent);font-weight:700}
.jp-add{appearance:none;display:block;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--jp-line);color:var(--jp-accent);font-weight:600;font-size:15px;font-family:inherit;min-height:48px;padding:10px 12px;cursor:pointer;overflow-wrap:anywhere}
.jp-add:hover,.jp-add:focus-visible{background:var(--jp-soft)}
.jp-foot{border-top:1px solid var(--jp-line);padding:8px}
.jp-done{appearance:none;width:100%;min-height:46px;border:0;border-radius:10px;background:var(--jp-accent);color:var(--bg,#0B1020);font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
.jp :focus-visible{outline:2px solid var(--jp-accent);outline-offset:1px}
.jp-field input:focus-visible{outline:0}
[hidden].jp-panel{display:none}
@media (prefers-reduced-motion:reduce){.jp-icon svg{transition:none}}
`;

  /* ---------- catalog ---------- */
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[''’.-]/g, "").replace(/[^a-z0-9+#&]+/g, " ").trim();
  const ITEMS = [];
  GROUPS.forEach(([group, jobs]) => jobs.forEach(([label, terms]) => {
    const list = terms.split(",").map((t) => t.trim()).filter(Boolean);
    ITEMS.push({ label, group, terms: list, nLabel: norm(label), labelWords: norm(label).split(" "),
      nTerms: list.map((t) => ({ t, n: norm(t), words: norm(t).split(" ") })) });
  }));
  const BY_LABEL = new Map(ITEMS.map((i) => [i.label, i]));

  /* ---------- search ----------
     Exact-style matches come first. Only if there are none does it try "close enough" spelling. */
  function typoDistance(a, b, max) {            // how many letters differ (a swapped pair counts as 1)
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let two = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (two && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], two[j - 2] + 1);
      }
      two = prev; prev = cur;
    }
    return prev[b.length];
  }
  const close = (tok, word) => { if (tok.length < 4 || word.length < 3) return false; const max = tok.length >= 7 ? 2 : 1; return typoDistance(tok, word, max) <= max; };
  const hit = (tok, word) => tok.length < 3 ? word.startsWith(tok) : word.includes(tok);

  function scoreToken(item, tok, fuzzy) {
    let best = 0, via = null;
    const take = (s, v) => { if (s > best) { best = s; via = v; } };
    if (!fuzzy) {
      item.labelWords.forEach((w) => { if (w === tok) take(70); else if (w.startsWith(tok)) take(60); else if (hit(tok, w)) take(45); });
      item.nTerms.forEach((x) => x.words.forEach((w) => { if (w === tok) take(40, x.t); else if (w.startsWith(tok)) take(35, x.t); else if (hit(tok, w)) take(25, x.t); }));
    } else {
      item.labelWords.forEach((w) => { if (close(tok, w)) take(20); });
      item.nTerms.forEach((x) => x.words.forEach((w) => { if (close(tok, w)) take(15, x.t); }));
    }
    return { best, via };
  }
  function search(query) {
    const q = norm(query), toks = q.split(" ").filter(Boolean);
    if (!toks.length) return [];
    const pass = (fuzzy) => {
      const out = [];
      ITEMS.forEach((item) => {
        let total = item.nLabel.startsWith(q) ? 100 : 0, via = null;
        for (const tok of toks) {
          const r = scoreToken(item, tok, fuzzy);
          if (!r.best) return;
          total += r.best; via = via || r.via;
        }
        out.push({ item, score: total, via });
      });
      return out.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    };
    const exact = pass(false);
    return exact.length ? exact : pass(true);
  }

  /* ---------- the widget ---------- */
  let uid = 0;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const SEARCH_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  const CHEVRON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function mount(root, opts) {
    opts = opts || {};
    if (!document.getElementById("jp-css")) { const s = el("style"); s.id = "jp-css"; s.textContent = CSS; document.head.appendChild(s); }
    const id = "jp" + (++uid);
    const selected = new Map();                 // label -> { label, custom, terms }
    let lastCleared = null;
    const addLabel = (label) => {
      const clean = String(label).trim().replace(/\s+/g, " ").slice(0, 60);
      if (!clean) return;
      const found = BY_LABEL.get(clean) || ITEMS.find((i) => i.nLabel === norm(clean));
      if (found) selected.set(found.label, { label: found.label, custom: false, terms: [found.label].concat(found.terms) });
      else selected.set(clean, { label: clean, custom: true, terms: [clean] });
    };
    (opts.selected || []).forEach(addLabel);

    root.innerHTML = "";
    const box = el("fieldset", "jp");
    box.appendChild(el("legend", "", opts.title || "Jobs to look for"));
    const top = el("div", "jp-top"), count = el("span", "jp-count"), clearBtn = el("button", "jp-link");
    clearBtn.type = "button"; top.append(count, clearBtn);
    const chips = el("div", "jp-chips");
    const field = el("div", "jp-field");
    field.innerHTML = SEARCH_SVG;
    const input = el("input");
    input.type = "search"; input.id = id + "-q"; input.autocomplete = "off"; input.enterKeyHint = "search";
    input.placeholder = opts.placeholder || "Type any job, like cashier";
    input.setAttribute("aria-label", "Search jobs"); input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", id + "-panel"); input.setAttribute("aria-autocomplete", "list");
    const wipe = el("button", "jp-icon", "×"); wipe.type = "button"; wipe.hidden = true; wipe.setAttribute("aria-label", "Clear search");
    const toggle = el("button", "jp-icon jp-toggle"); toggle.type = "button"; toggle.innerHTML = CHEVRON_SVG;
    field.append(input, wipe, toggle);
    const panel = el("div", "jp-panel"); panel.id = id + "-panel"; panel.hidden = true;
    const status = el("p", "jp-status"); status.setAttribute("role", "status");
    const list = el("div", "jp-list"); list.tabIndex = -1;
    const foot = el("div", "jp-foot"), done = el("button", "jp-done"); done.type = "button"; foot.appendChild(done);
    panel.append(status, list, foot);
    box.append(top, chips, field, panel);
    root.appendChild(box);

    function emit() { if (opts.onChange) opts.onChange(api.getLabels(), api.getItems()); }

    function syncPicks() {                       // refresh chips, counts and ticks without rebuilding the list
      const n = selected.size;
      count.textContent = n ? `${n} picked` : "Pick as many as you like";
      clearBtn.hidden = !n && !lastCleared;
      clearBtn.textContent = n ? "Clear all" : "Undo clear";
      done.textContent = n ? `Done (${n} picked)` : "Done";
      chips.replaceChildren(...[...selected.values()].map((s) => {
        const c = el("span", "jp-chip"); c.appendChild(el("span", "", s.label));
        const x = el("button", "", "×"); x.type = "button"; x.setAttribute("aria-label", "Remove " + s.label);
        x.onclick = () => { selected.delete(s.label); lastCleared = null; syncPicks(); emit(); input.focus({ preventScroll: true }); };
        c.appendChild(x); return c;
      }));
      list.querySelectorAll("input[type=checkbox]").forEach((b) => { b.checked = selected.has(b.dataset.label); });
      list.querySelectorAll("details[data-group]").forEach((d) => {
        const c = [...selected.values()].filter((s) => !s.custom && BY_LABEL.get(s.label).group === d.dataset.group).length;
        d.querySelector("b").textContent = c ? c + " picked" : "";
      });
    }

    function option(item, sub) {
      const l = el("label", "jp-opt"), box2 = el("input"), text = el("span");
      box2.type = "checkbox"; box2.dataset.label = item.label; box2.checked = selected.has(item.label);
      text.textContent = item.label;
      if (sub) text.appendChild(el("small", "", sub));
      l.append(box2, text);
      return l;
    }

    function drawBrowse() {
      status.textContent = "";
      const frag = document.createDocumentFragment();
      frag.appendChild(el("p", "jp-h", "Most picked"));
      POPULAR.forEach((p) => frag.appendChild(option(BY_LABEL.get(p))));
      GROUPS.forEach(([group, jobs]) => {
        const d = el("details", "jp-group"); d.dataset.group = group;
        const s = el("summary"); s.appendChild(el("span", "", group)); s.appendChild(el("b"));
        d.appendChild(s);
        jobs.forEach(([label]) => d.appendChild(option(BY_LABEL.get(label))));
        frag.appendChild(d);
      });
      list.replaceChildren(frag);
    }

    function drawResults(q) {
      const res = search(q);
      status.textContent = res.length ? `${res.length} ${res.length === 1 ? "match" : "matches"}` : `No match for "${q.trim()}". You can still add it.`;
      const frag = document.createDocumentFragment();
      res.slice(0, 30).forEach((r) => frag.appendChild(option(r.item, r.via ? "Includes " + r.via : r.item.group)));
      const nq = norm(q);
      const exact = res.some((r) => r.item.nLabel === nq || r.item.nTerms.some((x) => x.n === nq)) || selected.has(q.trim());
      if (!exact) {
        const add = el("button", "jp-add", `+ Add "${q.trim()}" as my own job`); add.type = "button";
        add.onclick = () => { addLabel(q); lastCleared = null; input.value = ""; redraw(); emit(); input.focus({ preventScroll: true }); };
        frag.appendChild(add);
      }
      list.replaceChildren(frag);
      list.scrollTop = 0;
    }

    function redraw() {
      const q = input.value;
      wipe.hidden = !q;
      if (q.trim()) drawResults(q); else drawBrowse();
      syncPicks();
    }
    function setOpen(open) {
      panel.hidden = !open;
      box.classList.toggle("jp-open", open);
      input.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close job list" : "Open job list");
    }

    list.addEventListener("change", (e) => {
      const b = e.target;
      if (b.type !== "checkbox") return;
      if (b.checked) addLabel(b.dataset.label); else selected.delete(b.dataset.label);
      lastCleared = null; syncPicks(); emit();
    });
    list.addEventListener("keydown", (e) => {          // arrow keys walk the list; Esc returns to the search box
      if (e.key === "Escape") { setOpen(false); input.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...list.querySelectorAll("input[type=checkbox],summary,.jp-add")].filter((x) => x.offsetParent);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      const next = items[i + (e.key === "ArrowDown" ? 1 : -1)];
      if (next) next.focus(); else if (e.key === "ArrowUp") input.focus();
    });
    input.addEventListener("focus", () => setOpen(true));
    input.addEventListener("click", () => setOpen(true));
    input.addEventListener("input", () => { setOpen(true); redraw(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); const f = list.querySelector("input[type=checkbox],summary,.jp-add"); if (f) f.focus(); }
      else if (e.key === "Escape") { if (input.value) { input.value = ""; redraw(); } else setOpen(false); }
      else if (e.key === "Enter") {                    // Enter picks the top match, or adds their own words
        e.preventDefault();
        const q = input.value.trim(); if (!q) return;
        const top = search(q)[0];
        addLabel(top ? top.item.label : q);
        lastCleared = null; input.value = ""; redraw(); emit();
      }
    });
    wipe.onclick = () => { input.value = ""; redraw(); input.focus(); };
    toggle.onclick = () => { const open = panel.hidden; setOpen(open); if (open) input.focus({ preventScroll: true }); };
    done.onclick = () => { input.value = ""; redraw(); setOpen(false); };
    clearBtn.onclick = () => {
      if (selected.size) { lastCleared = [...selected.values()]; selected.clear(); }
      else if (lastCleared) { lastCleared.forEach((s) => selected.set(s.label, s)); lastCleared = null; }
      syncPicks(); emit();
    };

    const api = {
      getLabels: () => [...selected.keys()],
      getItems: () => [...selected.values()].map((s) => ({ label: s.label, custom: s.custom, terms: s.terms.slice() })),
      getSearchTerms: () => [...new Set([...selected.values()].flatMap((s) => s.terms))],
      setSelected(labels) { selected.clear(); (labels || []).forEach(addLabel); lastCleared = null; redraw(); },
    };
    setOpen(false);
    redraw();
    return api;
  }

  global.JobPicker = { mount, search, count: ITEMS.length };
})(typeof window !== "undefined" ? window : globalThis);
