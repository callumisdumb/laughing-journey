# Multi-agency public protection platform (Scotland)
## Build brief for Claude Code: high-fidelity desktop mockup
Working codename for the repo: `mas-platform` (multi-agency sharing). The product has no public name yet. Do not invent one, do not put a name in the UI chrome. Use a neutral wordmark placeholder: a small lantern glyph and the text "Platform" in the sidebar, styled as a real brand would be, so it can be swapped later.
---
## 0. How to use this brief
1. Read this whole document before writing any code. It is the single source of truth for the mockup.
2. Save it into the repo as `docs/BRIEF.md`. Create a short `CLAUDE.md` at the repo root that points to it, lists the stack, the non-negotiables (section 2), and the definition of done (section 12).
3. Start in plan mode. Produce `docs/PLAN.md` (phases, screens, data model, design plan) and `docs/DESIGN.md` (tokens, type, layout, principles, and a short critique of your own plan against section 8). Only then start building.
4. Ask questions only at the two checkpoints described in section 13. Everywhere else, make a decision, record it in `docs/DECISIONS.md` with a one-line rationale, and keep going.
5. Keep `docs/NOTES.md` as a running log of what you tried visually, what you rejected and why. Future passes will read it.
The person you are building this for works inside Scottish local government health and social care and knows these processes first-hand. Accuracy matters to them. Where you are not sure of a statutory detail, say so in a code comment or a doc note rather than guessing, and make the detail configurable.
---
## 1. What this product is
A desktop application for practitioners across Scottish local authorities, Police Scotland, NHS Scotland health boards, the Scottish Prison Service, education, housing, and commissioned third-sector services, who work together on statutory, local-authority-led multi-agency inquiries and protection processes.
The core idea: **one person, many processes, one shared picture.** Today the picture of a person at risk is scattered across a council social work system (Civica ECLIPSE, OLM CareFirst, Swift, Mosaic, Liquidlogic), a GP system (EMIS Web), hospital and community health systems (TrakCare, Morse), a schools system (SEEMIS), and police systems (iVPD concern reports, ViSOR). Practitioners rebuild that picture by phone and email before every meeting. The platform pulls the significant events from each of those systems into one integrated chronology, tells the right people what they need to know (and nothing more), runs the meeting, tracks the actions, and produces inspection-ready records.
The five processes in scope for this mockup:
| Code | Process | Subject | Lead agency | Statutory footing |
|---|---|---|---|---|
| ASP | Adult Support and Protection | Adult at risk of harm, 16+ | Council (council officer) | Adult Support and Protection (Scotland) Act 2007; Code of Practice July 2022 |
| CP / IRD | Child protection, starting with the Inter-agency Referral Discussion | Child or unborn baby, up to 18 | Social work (enquiries), Police (criminal), Health (medical) | National Guidance for Child Protection in Scotland 2021 (updated 2023); Children (Scotland) Act 1995; Children's Hearings (Scotland) Act 2011 |
| MARAC | Multi-Agency Risk Assessment Conference | Adult victim of domestic abuse at high risk of serious harm, plus their children | Local MARAC (chair, coordinator, IDAA) | Non-statutory. SafeLives model, Equally Safe strategy, local MARAC Operating Protocol |
| MAPPA | Multi-Agency Public Protection Arrangements | Person who poses a risk of serious harm (registered sex offenders, restricted patients, other risk of serious harm offenders) | Responsible Authorities: Police Scotland, local authority, NHS health board, SPS | Management of Offenders etc. (Scotland) Act 2005 ss10 and 11; Scottish Government MAPPA National Guidance (current edition, treat as versioned) |
| AWI | Adults with Incapacity | Adult 16+ who lacks capacity for a decision | Council (MHO, welfare supervision), OPG (financial), MWC (welfare oversight), sheriff court | Adults with Incapacity (Scotland) Act 2000 |
Note on IRD naming: the 2021 national guidance calls it the **Inter-agency** Referral Discussion. Some local areas still say "Initial". Use "Inter-agency Referral Discussion (IRD)" in the UI and make the label configurable per local area.
The list is not exhaustive. Design the domain model so a new process type (for example a domestic abuse offender notification category under MAPPA, a MATAC perpetrator process, a Learning Review, or an ASP Large Scale Investigation) can be added as configuration plus a module, not a rewrite.
### 1.1 What "mockup" means here
High-fidelity, clickable, realistic, running as a real desktop app, with no real backend. Every screen works against a local mock data engine seeded with fictional but realistic Scottish cases. Every state (loading, empty, error, restricted, offline, stale connector) is designed. Nothing is a static image. Someone from a Chief Officers Group, an Adult Protection Committee, a MARAC chair, or a Police Scotland public protection unit should be able to sit down, click through a case from referral to review, and believe the product exists.
### 1.2 The reference products
- **AYRshare** (NHS Ayrshire & Arran with East, North and South Ayrshire councils, in use since 2013) is the closest existing thing in Scotland. It is a secure shared record for children's wellbeing, opened by the named person or lead professional, with an integrated chronology of significant events contributed by social work, health and education, key contacts, and notifications. The Care Inspectorate cited it as good practice in the Practice Guide to Chronologies. It is children-only and it is a folder-and-chronology system. This product takes that integrated-chronology idea and extends it across adults, offenders, victims and children, with proper process workflow on top.
- **Beam (beam.org)** is the design reference. Warm, human, confident, product-led. Cream surfaces rather than white, a dark warm ink rather than black, one strong accent, pill-shaped labels, generous but not bubbly radii, real product video in the hero, plain language, security badges shown with pride. Section 8 turns that into a design system that is ours rather than a copy.
---
## 2. Non-negotiables
These apply to every file you write.
1. **Fictional data only.** No real people, addresses, postcodes, CHI numbers, case references, phone numbers or emails. See section 9 for how to generate safe synthetic data. Postcodes use the unallocated first letters Q, V or X (e.g. `QX4 2LR`). CHI numbers follow the 10-digit format but are generated and labelled `synthetic` in the seed.
2. **No real integrations.** Connectors are mock adapters behind a real interface (section 7). No network calls at runtime, no telemetry, no external fonts, no CDNs. The app must run fully offline on a locked-down council or NHS laptop.
3. **British English, Scottish terminology.** "Council" not "local authority" in UI copy where practitioners say council. "Sheriff court", "procurator fiscal", "children's hearing", "Reporter", "health board", "council officer", "MHO". Dates as `dd Mon yyyy` in UI (e.g. `02 Sep 2026`), ISO 8601 in data. 24-hour times. Europe/London timezone.
4. **No em dashes anywhere.** Not in UI copy, not in code comments, not in docs, not in commit messages. Use commas, colons, full stops or parentheses.
5. **Accessibility is not a phase.** WCAG 2.2 AA throughout: visible focus, keyboard-complete, 4.5:1 text contrast, 3:1 for UI components, no colour-only meaning (agency colours and risk levels always pair with an icon or label), `prefers-reduced-motion` respected, all form fields labelled, live regions for async state, minimum 44px hit targets for primary actions, 400% zoom reflow on the main screens.
6. **Custom CSS throughout.** Tailwind 4 provides tokens and utilities. Every component with structure, state, or motion gets its own CSS (CSS Modules or a component layer file). See section 8.6 for the exact rules. A reviewer opening any screen's component folder must find real, hand-written CSS.
7. **Type-safe and tested.** TypeScript strict. Zod schemas are the source of truth for every entity and every form. Vitest for logic and schemas, Playwright for screen-level screenshots and smoke flows. `pnpm typecheck && pnpm lint && pnpm test` must pass at every commit.
8. **Facts and analysis are kept separate** in every record. A chronology entry is a fact. An analysis note, a risk judgement, a recommendation is a separate object linked to facts. This is a Care Inspectorate expectation and it shapes the data model.
9. **Need-to-know is a first-class concept**, not a permissions afterthought. Every share of information carries a purpose, a lawful basis, a proportionality note, and an author. Every read of a restricted record is audited. See section 6.
10. **The person is present in their own record.** Every process has a place for the adult's views, the child's voice, the victim's wishes (via the IDAA), the family's views. These are not free-text afterthoughts; they are structured, dated, and shown prominently.
---
## 3. Stack
### 3.1 Decision
- **Core app:** Next.js 16 (App Router, `output: 'export'`), React 19, TypeScript 5.x strict, Tailwind CSS 4 (CSS-first, `@theme` in CSS, no `tailwind.config.js`), custom CSS via CSS Modules and layered global stylesheets.
- **Desktop shell:** **Tauri 2** as the primary shell. Keep an Electron shell as a second, thin package that loads the same static export, so the choice can be flipped without touching the app. Rationale, in `docs/DECISIONS.md`: Tauri gives a very small installer for distributing demo builds to councils and health boards, a capability-scoped permissions model that supports the product's least-privilege story in security reviews, and no Node runtime in the renderer. The trade-off is the system WebView (WebView2 on Windows, WKWebView on macOS); Chromium parity is not required for this product and the Tauri installer can bootstrap WebView2 on Windows. The developer machine is macOS with a working Terminal; install Rust via `rustup`. If any Tauri blocker appears that cannot be resolved within an hour, switch the default build target to the Electron package and record it.
- **Package manager and workspace:** pnpm workspaces. Node 22 LTS or later.
- **State and data:** Zustand for UI and session state. TanStack Query for anything that goes through the mock connector layer (so latency, staleness, errors and retries are visible and designed). TanStack Table for dense grids. TanStack Virtual for long chronologies.
- **Forms and validation:** react-hook-form + Zod resolvers. Every statutory form (three-point test, DAQ, MAPPA referral, capacity assessment) is a Zod schema first.
- **Dates:** date-fns with `date-fns-tz`. All "statutory clocks" are pure functions with unit tests.
- **Icons:** lucide-react, plus a small set of custom SVG glyphs for agencies and process types (section 8.5).
- **Fonts:** self-hosted through Fontsource packages (section 8.3). No `next/font/google`.
- **Charts:** none from a library by default. Risk and timeline visuals are hand-built SVG components with custom CSS (this is where the product looks like itself). If a chart library is genuinely needed for the reports screen, use Recharts and theme it fully.
- **Testing:** Vitest + Testing Library; Playwright for screenshots and smoke flows against the exported site; axe-core via `@axe-core/playwright` on every main screen.
- **Lint and format:** ESLint (typescript-eslint, jsx-a11y, react-hooks), Prettier, Stylelint for CSS with a rule set that forbids `!important` outside `utilities` and flags unused custom properties.
- **Persistence for the mockup:** in-memory store hydrated from JSON seed files, with optional persistence of user changes to `localStorage` in the browser and to the Tauri app data directory (via `@tauri-apps/plugin-store`) in the shell, so a demo can be reset from Settings.
### 3.2 Repository layout
```
mas-platform/
  CLAUDE.md
  package.json               # pnpm workspace root
  pnpm-workspace.yaml
  docs/
    BRIEF.md                 # this document
    PLAN.md
    DESIGN.md
    DECISIONS.md
    NOTES.md
    DATA-MODEL.md            # generated from Zod schemas + prose
    NEED-TO-KNOW.md          # the matrices in section 6, kept current
    SCREENSHOTS/             # Playwright output, committed per phase
  apps/
    web/                     # Next.js app (the product)
      app/                   # App Router
      components/            # shared UI (design system lives in packages/ui, product components here)
      features/              # one folder per module: asp, cp, marac, mappa, awi, chronology, meetings, sharing, connectors, admin, reports
      lib/                   # clocks, permissions, formatting, mock api client
      styles/                # global CSS layers (see 8.6)
      public/
    desktop-tauri/           # Tauri 2 shell (Rust src-tauri + config)
    desktop-electron/        # Electron shell (thin; loads apps/web export)
  packages/
    ui/                      # design system: tokens, primitives, CSS
    domain/                  # Zod schemas, types, enums, statutory clocks, need-to-know rules, permissions
    mock-data/               # seed generator, fixtures, scenarios
    connectors/              # ConnectorAdapter interface + mock adapters (emis-web, eclipse, carefirst, ivpd, seemis, trakcare, morse, opg, scra, visor)
  tooling/
    eslint-config/
    stylelint-config/
    playwright/
```
### 3.3 Static export constraints
`output: 'export'` means no server actions, no middleware, no dynamic routes without `generateStaticParams`. Person, case and meeting routes generate params from the seed IDs at build time. Anything created at runtime by the user (a new referral, a new meeting) gets an ID and is routed through a client-side catch-all under the same path shape, backed by the in-memory store. Document this pattern once in `docs/DECISIONS.md` and apply it consistently. `images.unoptimized = true`. The desktop shells load `out/` in production and `http://localhost:3000` in development.
---
## 4. Domain primer
This is the section that stops the mockup looking like a generic CRM with Scottish words pasted on. Read it slowly. Every module in section 10 refers back to it.
### 4.1 Shared vocabulary
- **Person / subject:** the individual a process is about. A person can be the subject of several processes at once and can be a different party in each (victim in MARAC, parent in a child protection case, adult at risk in ASP).
- **Network:** the household and the people around a subject: family, carers, attorneys, guardians, partners, ex-partners, professionals. Relationships are dated and typed.
- **Process / case:** an instance of ASP, CP, MARAC, MAPPA or AWI for one subject (or a set of subjects for a Large Scale Investigation or a sibling group).
- **Chronology:** a dated, factual record of significant events. Single-agency chronologies feed an integrated (multi-agency) chronology.
- **Significant event:** something that impacts the person's wellbeing, safety or circumstances, positively or otherwise. Not a case note. Not an opinion.
- **Meeting:** IRD, Child Protection Planning Meeting (CPPM), core group, ASP case conference, MARAC, MAPPA Level 2 meeting, MAPPP (Level 3), AWI multi-disciplinary discussion. Meetings have pre-meeting information sharing, attendance, a record, decisions, dissent, actions, and a review date.
- **Plan:** interim safety plan, child's plan, adult protection plan, MARAC action plan, MAPPA risk management plan. All are outcome-focused with owned, dated actions.
- **Risk assessment:** a structured tool result (DAQ/DASH, three-point test, MAPPA risk level, capacity assessment) with a date, an author, evidence links, and a professional judgement field that can override the tool score with a reason.
- **Statutory clock:** a countdown from a trigger event to a required action (CPPM within 28 calendar days of initiating child protection procedures; MHO report within 21 days of notification under AWI s57(4); local ASP inquiry and case conference timescales; MAPPA review intervals by level). Clocks are configuration, never hard-coded constants.
- **Need-to-know:** the rule set that decides which agency roles should be notified about what, at each stage, with what level of detail.
- **Lawful basis record:** the reason a piece of information was shared (see 4.8).
### 4.2 Adult Support and Protection (ASP)
**Legislation and guidance.** Adult Support and Protection (Scotland) Act 2007. Revised Code of Practice, July 2022, which added a chronologies section, a new chapter on assessing and managing risk (including case conferences, Large Scale Investigations and Learning Reviews), and clarified information sharing and the relationship between inquiries and investigations.
**Who it covers: the three-point test (s3).** An adult at risk is a person aged 16 or over who (a) is unable to safeguard their own wellbeing, property, rights or other interests, (b) is at risk of harm, and (c) because they are affected by disability, mental disorder, illness or physical or mental infirmity, is more vulnerable to being harmed than adults who are not so affected. All three must be met. "Harm" is all harm: physical, sexual, psychological, financial, neglect, self-harm and self-neglect.
**Principles (ss1 and 2).** Any intervention must benefit the adult and be the least restrictive option. Have regard to the adult's wishes and feelings (past and present), the views of the adult's nearest relative, carer, guardian or attorney, the adult's participation, non-discrimination, and the adult's abilities, background and characteristics.
**Duties.** Council duty to make inquiries (s4). Duty to cooperate (s5) on councils, Care Inspectorate, Healthcare Improvement Scotland, Police Scotland, health boards, Office of the Public Guardian, Mental Welfare Commission and any other public body specified, plus a duty on those bodies to report to the council where they know or believe someone is an adult at risk. Investigative powers: visits (s7), interviews (s8), medical examinations (s9), examination of records including health records (s10; only a health professional can inspect health records). Protection orders: assessment order (s11), removal order (s14), banning order (s19), warrants for entry. Adult Protection Committees (s42). Council officers (s52) must be suitably qualified and trained (registered social workers, or nurses, occupational therapists with the required post-qualifying experience and training; the exact rule is configurable per council).
**Process shape.**
1. **Adult concern / referral** arrives (Police Scotland Adult Concern Report from iVPD, a health referral, a care provider, a member of the public, self-referral). Recorded with source, date, harm type(s), immediate safety, whether police involved.
2. **Screening / duty decision:** does the three-point test appear to be met on the information available? Record the reasoning per limb. Outcomes: no further ASP action (signpost / other service), proceed to inquiry, emergency action.
3. **Inquiry (s4):** information gathering across agencies. Many areas run an ASP inter-agency discussion at this point. Outcome: no further action under ASP, a support-only response, or proceed to investigation. Local timescales apply (commonly a decision within 5 working days: configurable).
4. **Investigation:** a council officer, usually with a second worker, visits (s7), interviews (s8), may arrange a medical examination (s9) and examine records (s10). Consent and capacity are assessed and recorded. Undue pressure is considered where the adult refuses. Independent advocacy is offered.
5. **Risk assessment and case conference:** a multi-agency ASP case conference (commonly within 21 to 28 days of the concern: configurable) with the adult present or represented, and a council officer's report including a chronology. The conference decides whether the adult is at risk, whether an Adult Protection Plan is needed, and any protection orders to seek.
6. **Adult Protection Plan:** outcome-focused, with owners and dates, a review date, and a named coordinating worker.
7. **Review case conference(s)** and eventual closure with a recorded reason.
**Variants.** Large Scale Investigation (concerns about a care home, a provider or a setting, involving Care Inspectorate, contracts/commissioning, health and police; one process, many subjects). Learning Reviews under the 2022 national guidance (replacing significant case reviews for ASP). Financial harm cases involve the OPG (attorneys, guardians), banks and DWP.
**Artefacts the mockup must produce.** Adult concern record; three-point test with per-limb reasoning; inquiry record; investigation record (visit, interview, consent/capacity, advocacy offered); chronology; council officer's report; case conference invitation, attendance, minute, decisions and dissent; Adult Protection Plan; review; closure summary; protection order application pack (assessment / removal / banning) as a checklist and draft; LSI workspace.
**Who needs to know.** See section 6.2.
### 4.3 Child protection, from IRD to review
**Legislation and guidance.** National Guidance for Child Protection in Scotland 2021 (updated 2023). GIRFEC (Getting it right for every child) practice model and the SHANARRI wellbeing indicators. Children (Scotland) Act 1995. Children's Hearings (Scotland) Act 2011 (child protection orders, referral to the Principal Reporter). Children and Young People (Scotland) Act 2014. UNCRC (Incorporation) (Scotland) Act 2024 (in force July 2024). Children (Care and Justice) (Scotland) Act 2024 (under-18s treated as children across justice processes). A child is anyone under 18; an unborn baby is included where there is current or future risk.
**The IRD.** The Inter-agency Referral Discussion is the start of the formal child protection process after a concern is shared with police or social work. It is held as soon as reasonably practicable; out of hours it may focus on immediate protective action and be completed later. Core participants are senior enough to decide for their agency: social work (lead for enquiries into significant harm), police (lead for criminal investigation, usually a detective sergeant from the public protection unit), and a designated health professional (child protection nurse adviser or paediatrician, lead on medical assessment). Education joins for school-age children; others (housing, third sector, midwifery for unborn babies) as needed.
**IRD decisions to capture, each with rationale and any dissent.**
- Is the child (and any sibling or other child in the same context) at risk of significant harm, or likely to be?
- Is a child protection investigation needed?
- Is a Joint Investigative Interview needed (Scottish Child Interview Model), who plans it, and who knows the child well enough to inform planning?
- Is a medical needed (joint paediatric forensic examination or comprehensive medical), when, and who consents?
- Interim safety plan until a CPPM is held or a decision is made that one is not needed.
- Emergency measures: Child Protection Order, exclusion order, police emergency powers.
- Referral to the Reporter: considered at every stage, decision and reason recorded either way.
- Information sharing with parents and carers: what, when, and whether anything is withheld because it would jeopardise a criminal investigation or increase risk.
- The child's views and how they were sought.
**Then.** Child protection investigation. **CPPM within 28 calendar days** of child protection procedures being initiated (unless the IRD decided one is not required). The CPPM decides whether the child's name goes on the Child Protection Register, agrees a child's plan, and sets up a core group (first core group meeting shortly after the CPPM; verify the current interval in Appendix D of the national guidance and keep it configurable). Review CPPMs (first review typically within three months, subsequent at least every six months; verify against Appendix D). Transfer in and out of area. De-registration with reason. Pre-birth CPPMs for unborn babies have their own timing relative to expected delivery date.
**Roles.** Named person (health visitor pre-school, head teacher school-age), lead professional, allocated social worker, chair (independent of the case), minute taker, police public protection unit, health CP adviser, education designated CP lead, SCRA (Reporter), procurator fiscal (where a JII or prosecution is in play).
**Artefacts.** Child concern record (including police Child Concern Reports from iVPD); IRD record (participants, information shared by each agency, decisions, dissent, interim safety plan, actions, next steps); JII planning record; medical decision record; investigation record; CPPM pack (reports from each agency, integrated chronology, child's views, parents' views); CPPM minute with registration decision and category; child's plan; core group records; review records; register entry with dates; transfer and de-registration records.
**Who needs to know.** See section 6.3.
### 4.4 MARAC
**Basis.** Non-statutory. Operates in all 32 Scottish local authorities, following the SafeLives model adapted for Scotland, supported by the Scottish Government's Equally Safe strategy. Each area has a MARAC Operating Protocol. SafeLives has been pressing for MARAC to be placed on a statutory footing with minimum standards; build as if that may happen (national standards as configuration).
**Risk identification.** The SafeLives DASH risk checklist (Domestic Abuse, Stalking, Harassment and Honour-based violence) has 24 questions; 14 or more "yes" answers indicates high risk and a referral, and professional judgement can refer below that threshold. Police Scotland use the **DAQ (Domestic Abuse Questions)**, based on DASH with three additional questions supporting child protection decisions. A **repeat** is a further referral within 12 months of the last MARAC hearing for that victim.
**Roles.** MARAC Chair (senior, usually police or council), MARAC Coordinator (agenda, research requests, minutes, actions), **IDAA** (Independent Domestic Abuse Advocate, who supports the victim before, during and after, represents their views, and coordinates the action plan; the victim does not attend), referring agency (must attend and present), and core representatives from police domestic abuse unit, children's social work, adult social work, health (GP link, health visiting, midwifery, mental health, A&E), housing, education, substance use services, justice social work, Women's Aid or equivalent, SPS where the perpetrator is in custody.
**Meeting shape.** Usually fortnightly or monthly. Before the meeting, the coordinator circulates the case list and each agency **researches** its records for the victim, the perpetrator and any children, sharing only what is relevant, necessary and proportionate. At the meeting: information sharing per agency, risk discussion, action planning. The perpetrator is not told about MARAC. After: actions tracked to completion, the IDAA feeds back to the victim, a MARAC flag is placed on agency records (commonly 12 months), links are made to child protection (IRD or referral), ASP, MAPPA, MATAC (Police Scotland's perpetrator-focused Multi Agency Tasking and Coordination) and DSDAS (Disclosure Scheme for Domestic Abuse Scotland). Transfers happen when a victim moves area.
**Artefacts.** Referral form with DASH/DAQ score and professional judgement; research request and per-agency research return; agenda; attendance; per-case record of information shared; action plan (owner, due date, status, evidence of completion); victim feedback via IDAA; flags placed; SafeLives data return fields (referral source, repeat, children, outcomes).
**Who needs to know.** See section 6.4.
### 4.5 MAPPA
**Basis.** Sections 10 and 11 of the Management of Offenders etc. (Scotland) Act 2005 place a duty on the **Responsible Authorities** in each area to jointly establish arrangements for assessing and managing risk: Police Scotland, the local authority (justice social work, with the Chief Social Work Officer accountable; housing and children's services also have duties), the health board (in respect of restricted patients), and the Scottish Prison Service while the person is in custody. **Duty to cooperate** agencies include housing providers and registered social landlords, DWP, Social Security Scotland, SCRA, electronic monitoring providers, and any person or organisation providing services to or on behalf of a Responsible Authority. National guidance is issued by Scottish Ministers under s10(6); treat the current edition as a versioned document in config. Strategic Oversight Groups govern each area. Annual reports are published every October.
**Categories.** Category 1: registered sex offenders (subject to Sex Offender Notification Requirements). Category 2: restricted patients. Category 3: other risk of serious harm offenders (commenced 31 March 2016) who, by reason of conviction, are assessed as high or very high risk of serious harm and require active multi-agency management. A terrorism (TACT) chapter has been in development and a Member's Bill considered in early 2026 proposed notification requirements for domestic abuse offenders managed through MAPPA. Categories are configuration.
**Levels.** Level 1: routine risk management by one agency with information sharing (the majority; police lead for registered sex offenders not under supervision, justice social work for those under statutory supervision). Level 2: active multi-agency management. Level 3: MAPPP, the critical few. Category 3 cannot be managed at Level 1.
**Five stages.** 1 Identification and notification. 2 Referral (must be informed by a current risk assessment). 3 Pre-meeting information sharing (the MAPPA Coordinator passes the referral to a single secure point of contact in each Responsible Authority and relevant duty to cooperate agency; each searches its records for the person, victims and potential victims). 4 Meeting (level decision, Risk Management Plan, actions, disclosure decisions, review date). 5 Exit (level down, deregistration, transfer).
**Risk assessment tools.** RM2000 and Stable and Acute 2007 for sexual offending, LS/CMI for general offending, and the Risk Management Authority's FRAME standards. Orders for Lifelong Restriction require an RMA-approved Risk Management Plan. The platform records tool, date, assessor, outcome band and links to evidence; it does not implement the tools.
**Records.** ViSOR is the UK system today; **MAPPS** (Multi-Agency Public Protection System) is due to replace it around 2028. The platform is not ViSOR. It holds the local MAPPA case record and references the ViSOR/MAPPS identifier.
**Artefacts.** Notification; referral; pre-meeting information returns per agency; meeting record (restricted); level decision with reasons; Risk Management Plan (contingency and triggers, controls, victim safety, accommodation, employment, associates, licence conditions, SONR compliance); Environmental Risk Assessment for accommodation (National Accommodation Strategy for Sex Offenders); disclosure decisions to third parties with rationale; victim considerations (Victim Notification Scheme is separate; MAPPA information is not given to victims directly); review schedule by level (intervals from national guidance, configurable); annual report statistics; Significant Case Review triggers.
**Who needs to know.** See section 6.5. This is the most restrictive process in the product.
### 4.6 Adults with Incapacity (AWI)
**Basis.** Adults with Incapacity (Scotland) Act 2000. Reform is under way (Scottish Government Expert Working Group and Ministerial Oversight Group from 2025, a work programme running to 2030, a 2024 consultation on an Amendment Act) but no new Act was passed before the May 2026 election. Build for today's Act and keep the model reform-ready: prioritisation of the adult's will and preferences, possible single-report guardianship applications, a deprivation of liberty approval route, and a "decision-making representative" model have all been proposed.
**Principles (s1).** Benefit to the adult that cannot reasonably be achieved without the intervention; least restrictive option; account taken of the adult's past and present wishes (by any means of communication); consultation with the nearest relative, primary carer, guardian or attorney, named person; encouragement of the adult to exercise and develop skills. Capacity is decision-specific and time-specific.
**Parts that matter to this product.** Part 2 powers of attorney (registered with the OPG; welfare attorneys are supervised by the council and overseen by the MWC, financial by the OPG). Part 3 access to funds. Part 4 management of residents' funds. Part 5 medical treatment (s47 certificate of incapacity). Part 6 intervention orders and guardianship orders granted by the sheriff. Section 13ZA of the Social Work (Scotland) Act 1968 lets a council make arrangements for community care services, including a move to residential care, for an adult who lacks capacity where there is no guardian or attorney with relevant powers and no objection; the decision and its reasoning must be recorded.
**Council duties.** Supervise welfare guardians (s10). Investigate complaints about welfare attorneys and guardians, and investigate where the personal welfare of an adult seems to be at risk (ss10 and 12). Apply for guardianship where necessary and nobody else is doing so (s57(2)). Provide the Mental Health Officer report for welfare guardianship applications (s57(3)); the MHO must report within 21 days of being notified (s57(4)). Two medical reports are required, one from an approved medical practitioner where incapacity arises from mental disorder. Interim orders can be granted while a full application proceeds (concerns exist about prolonged or repeat interim orders and ECHR compliance; surface interim order duration prominently).
**Process shapes.**
- **Capacity concern** raised (hospital discharge, care home, ASP financial harm, family). Record the decision in question, the assessment (who, when, evidence, outcome), the adult's expressed wishes, and consultation with relevant others.
- **Existing powers check:** OPG register lookup (mock) for attorneys and guardians; details of powers granted and their expiry.
- **Route decision:** informal support and supported decision making; s13ZA; PoA already covers it; intervention order; guardianship (welfare, financial, or both); Part 5 certificate for treatment.
- **Guardianship application workflow:** applicant (private applicant with solicitor, or council), medical reports, MHO report with the 21-day clock, suitability report for financial powers, court lodgement, interim order, hearing date, order granted with powers and duration, OPG registration, MWC notification.
- **Post-order:** supervision visits schedule, annual reports, variation, renewal, recall, complaints and investigations.
**Artefacts.** Capacity assessment record; will and preferences record; OPG register result; s13ZA decision record; MHO report task with statutory clock; medical report tracking; court timeline; order register (powers, expiry, supervising officer); supervision visit log; s10/s12 investigation record; notifications to OPG and MWC; interpreter and communication needs.
**Who needs to know.** See section 6.6.
### 4.7 Chronologies (cross-cutting)
The Care Inspectorate's Practice Guide to Chronologies (2017) is the standard. A chronology is a record in date order of significant events and changes in a person's life: key dates, life events, moves, changes in circumstances, concerns, agency involvement, interventions, the response, and the impact or outcome. It is factual, brief, and free of opinion. It is not the case record and it is not a substitute for assessment. Single-agency chronologies are the building blocks; an integrated (multi-agency) chronology is compiled for a specific purpose and contains only what is relevant, necessary, legitimate, appropriate and proportionate. It is a live tool, reviewed and analysed regularly, and it is how patterns and cumulative harm become visible. Chronologies are required in ASP council officer reports, in CPPM packs, and are central to MAPPA and AWI history.
The product's chronology model:
- `ChronologyEvent`: `id`, `subjectIds[]`, `occurredAt` (date, optional time, optional "approximate" flag), `recordedAt`, `agency`, `sourceSystem` (connector or manual), `recordedBy`, `eventType` (taxonomy below), `title` (one line), `detail` (short, factual), `response` (what was done), `outcome` (what changed), `significance` (low / moderate / high, with a reason if high), `linkedPersonIds[]`, `linkedProcessIds[]`, `evidenceRefs[]`, `visibility` (agency-only / integrated / restricted), `version` history.
- Event type taxonomy (extensible): birth and family, address move, household change, health (attendance, admission, diagnosis disclosed, missed appointment), education (enrolment, attendance pattern, exclusion), police (concern report, incident, charge, conviction, custody, release, bail condition), social work (referral, assessment, visit, allocation change, plan review), care and support (placement, service start or end, provider concern), legal (order granted, hearing, guardianship, PoA registered), protection process milestones (IRD held, CPPM, registration, case conference, MARAC heard, MAPPA level change), views and voice (adult's views recorded, child's view recorded), disclosure made, information shared.
- **Analysis notes** are a separate entity (`ChronologyAnalysis`) that reference event IDs and carry a dated professional judgement. The UI shows them as a distinct lane, never inline as facts.
- **Pattern lenses** (mockup-level heuristics, clearly labelled as prompts for professional analysis, not conclusions): escalation of police incidents, clustering of missed health or education contacts, repeated moves, gaps in agency contact, change of household composition, alignment of events with a perpetrator's release or bail dates.
### 4.8 Information sharing and lawful basis (cross-cutting)
Every share, notification and integrated-chronology inclusion carries a `LawfulBasisRecord`: `purpose` (from the process), `ukGdprArticle6` (typically 6(1)(c) legal obligation or 6(1)(e) public task), `article9Condition` (typically 9(2)(g) substantial public interest with DPA 2018 Schedule 1 Part 2 paragraph 18, safeguarding of children and individuals at risk; or 9(2)(h) health and social care), `article10Criminal` (where offence data is shared: DPA 2018 s10 and Schedule 1), `statutoryGateway` (ASP 2007 s5 duty to cooperate and s10 records; 2005 Act s10 for MAPPA; Children's Hearings (Scotland) Act 2011 s60 referral to the Reporter; Children and Young People (Scotland) Act 2014; Domestic Abuse (Scotland) Act 2018; common law public interest override of confidentiality; Caldicott principles for health), `necessityAndProportionality` (free text, required), `consentStatus` (not required / sought and given / sought and refused with override reason / not sought because it would increase risk), `authorisedBy`, `informationSharingAgreementRef`, `dpiaRef`. The Human Rights Act 1998 Article 8 test (necessary and proportionate for a legitimate aim) is the framing in the UI copy. The Data (Use and Access) Act 2025 amended UK GDPR; keep the field names generic enough to survive that.
### 4.9 The systems landscape (for connectors)
| Agency | Systems the mockup should recognise |
|---|---|
| Council social work | Civica ECLIPSE (originally OLM; cloud-native; used by a large share of Scottish councils), OLM CareFirst (legacy, no longer developed), NEC/Northgate Swift, Access Mosaic (formerly Servelec), System C Liquidlogic, Azeus, Advanced CareDirector |
| Council education | SEEMIS (Scottish schools MIS) |
| Council housing | NEC Housing, Capita OpenHousing, RSL systems |
| NHS primary care | EMIS Web (GP), Vision |
| NHS acute and community | InterSystems TrakCare (patient management), Morse (community and mental health, used by NHS Ayrshire & Arran among others), Clinical Portal, BadgerNet (maternity), CHI (Community Health Index) |
| Police Scotland | iVPD (interim Vulnerable Persons Database: Child Concern Reports, Adult Concern Reports, domestic abuse concern reports), STORM (incidents), crime management, ViSOR (MAPPS from 2028), DAQ |
| Others | OPG register (powers of attorney, guardianships), SCRA (Reporter), SPS, Care Inspectorate, MWC, Women's Aid and ASSIST (often on Oasis case management) |
---
## 5. Roles and permissions
Model users as `agency + role + process memberships + case memberships`. Access is the intersection: what your agency is allowed to see for this process type, what your role can do, and whether you are on the case (need-to-know). Restricted records add a break-glass step (reason required, audited, time-limited).
Roles to seed (one persona each with a photo-free avatar, name, agency, team, base):
- Council: social worker (adults), social worker (children and families), team leader, **council officer (ASP)**, **Mental Health Officer**, justice social worker, **MAPPA Coordinator**, **MARAC Coordinator**, chair (independent reviewing / CP chair), minute taker / admin, housing officer, education CP lead (head teacher), Chief Social Work Officer (read-only oversight plus sign-offs).
- Police Scotland: detective sergeant (public protection unit), domestic abuse unit officer, offender management (sex offender liaison), concern hub officer.
- NHS: child protection nurse adviser, GP, health visitor, midwife, community mental health nurse, hospital discharge coordinator, Caldicott guardian (audit view).
- Third sector: IDAA, Women's Aid worker, independent advocate.
- SPS: prison-based social worker / liaison.
- Oversight: Adult Protection Committee lead officer, Child Protection Committee lead officer, inspector (read-only, redacted), system administrator.
The sign-in screen is a mock SSO picker: choose an organisation (council, NHS board, Police Scotland, third sector) then a persona. Switching persona is available from the account menu at all times for demo purposes and is clearly marked as a demo affordance.
---
## 6. Need-to-know matrices
Implement these as data (`packages/domain/src/need-to-know/*.ts`), render them in the admin area, and drive the notification queue from them. Each row: `process`, `stage`, `audience` (agency + role), `whatTheyGet` (summary only / full record / specific fields), `channel` (in-app, secure email digest, connector push), `trigger`, `mustNotReceive` (explicit exclusions, e.g. perpetrator in MARAC, victims in MAPPA).
### 6.1 Global rules
- Default is **deny**. A person on a case sees what their role and agency permit for that stage.
- Every notification shows the recipient why they are receiving it and under what lawful basis.
- Detail levels: `presence` (a process exists), `summary` (stage, lead, next date), `full` (the record), `fields` (named fields only, e.g. bail conditions to a school).
- The subject sees their own views section in full and their record according to subject access rules (out of scope to implement; in scope to design the "what the person would see" preview).
### 6.2 ASP
| Stage | Must know (full) | Should know (summary) | Fields only | Must not receive |
|---|---|---|---|---|
| Concern received | Council duty team, council officer | Referrer (acknowledgement and outcome, not detail) | | |
| Inquiry | Council officer, team leader; police if criminal element; GP or community nurse for health input | Care provider (if regulated service), housing | | |
| Investigation | Council officer, second worker, police (joint visit), health (s9 medical), records holders (s10 request) | Advocacy service, attorney or guardian | OPG (if financial harm or attorney/guardian conduct) | |
| Case conference | All invited agencies, chair, minute taker, adult and advocate | Care Inspectorate (if regulated service), MWC (if welfare concerns about guardian/attorney) | | Alleged perpetrator (unless a household member with a right to be heard, chair's decision recorded) |
| Protection plan | Plan owners, adult, advocate, carers with consent | Referrer (outcome) | | |
| Review and closure | As conference | All contributing agencies (closure notice) | | |
### 6.3 Child protection
| Stage | Must know (full) | Should know (summary) | Fields only | Must not receive |
|---|---|---|---|---|
| Concern received | Social work duty, police PPU | Named person | | |
| IRD | Social work senior, police DS, health CP adviser; education for school-age; midwifery for unborn | Lead professional, SCRA (referral decision), procurator fiscal (if JII) | Housing (if relevant) | Parents where sharing would jeopardise investigation or increase risk (decision recorded) |
| Investigation and JII | Social work, police, health; JII interviewers | Education (attendance and safety) | School: interim safety plan actions relevant to school | |
| CPPM | All invitees, chair, minute taker, parents (unless excluded with reason), child (age-appropriate) | SCRA, GP | | |
| Registration and child's plan | Core group members, named person, lead professional | Any agency with future contact (register check) | GP: registration status and category | |
| Review and de-registration | As CPPM | Register enquirers | | |
### 6.4 MARAC
| Stage | Must know (full) | Should know (summary) | Fields only | Must not receive |
|---|---|---|---|---|
| Referral | MARAC coordinator, IDAA, referring agency | | | Perpetrator, perpetrator's family or associates |
| Research request | All protocol agencies (victim, perpetrator, children names and DoB only, for record searching) | | | |
| Meeting | Attending representatives | | | |
| Action plan | Action owners; IDAA (victim feedback) | Children's social work (if children; consider IRD), MAPPA coordinator (if perpetrator is MAPPA), MATAC | Health and housing: MARAC flag on record, 12 months | Perpetrator |
| Transfer | Receiving MARAC coordinator | | | |
### 6.5 MAPPA
| Stage | Must know (full) | Should know (summary) | Fields only | Must not receive |
|---|---|---|---|---|
| Notification | Lead Responsible Authority (police offender management or justice social work), MAPPA Coordinator | Other Responsible Authorities (presence) | | Victims (VNS is a separate route), employers, public |
| Referral (Level 2/3) | MAPPA Coordinator, single points of contact in each Responsible Authority and relevant duty to cooperate agency | | | |
| Pre-meeting returns | MAPPA Coordinator, chair | | | |
| Meeting and RMP | Attendees (restricted minute) | Level and review date to case members | Housing: ERA conclusions and controls; school or employer only via a recorded disclosure decision | Anyone not on the distribution list; children's social work receives a specific disclosure where a child is in the household |
| Disclosure decision | Decision maker, recipient (specific facts only) | | | |
| Exit | Responsible Authorities | | | |
### 6.6 AWI
| Stage | Must know (full) | Should know (summary) | Fields only | Must not receive |
|---|---|---|---|---|
| Capacity concern | Allocated worker, MHO (if welfare guardianship likely), GP or consultant | Discharge team, care provider | | |
| Existing powers | Worker | Attorney or guardian (that a check was made) | OPG register result | |
| Application | Applicant or solicitor, MHO, medical practitioners, court | Nearest relative, primary carer, named person, adult (notification and rights), independent advocate | | |
| Order granted | Guardian, supervising officer, OPG, MWC, care provider | GP | Financial institutions via OPG | |
| Supervision and investigation | Supervising officer, MWC (welfare), OPG (financial) | | | |
---
## 7. Connectors
Interface in `packages/connectors/src/adapter.ts`:
```ts
export interface ConnectorAdapter {
  readonly id: ConnectorId;                 // 'emis-web' | 'eclipse' | 'carefirst' | 'ivpd' | 'seemis' | 'trakcare' | 'morse' | 'opg' | 'scra' | 'visor'
  readonly displayName: string;
  readonly agency: Agency;
  readonly capabilities: ConnectorCapability[]; // 'lookupPerson' | 'pullEvents' | 'pushOutcome' | 'registerCheck' | 'flagRecord'
  health(): Promise<ConnectorHealth>;         // { status: 'ok'|'degraded'|'down', lastSyncAt, latencyMs, message }
  lookupPerson(query: PersonQuery): Promise<ExternalPersonMatch[]>;
  pullEvents(subject: SubjectRef, window: DateWindow): Promise<ExternalEvent[]>;
  pushOutcome?(outcome: ProcessOutcome): Promise<PushReceipt>;
  registerCheck?(subject: SubjectRef): Promise<RegisterResult>; // OPG, CP register, MARAC flag
  flagRecord?(subject: SubjectRef, flag: RecordFlag): Promise<PushReceipt>;
}
```
Mock adapters return fixtures with simulated latency (200 to 1500 ms), occasional degraded status, and a mapping table from the source system's vocabulary to the platform's event taxonomy. Each adapter has a `mapping.md` documenting the fictional source fields (e.g. EMIS Web consultation with a safeguarding SNOMED-style code becomes a `health.consultation` event with `significance: high`). The Connectors admin screen shows each adapter's health, last sync, event counts, mapping preview, and a "simulate outage" toggle for demos.
Connector events land in an **inbox** per agency user, not straight into the integrated chronology: a practitioner reviews, edits the one-line title for plain language, sets significance, and promotes to single-agency chronology, then optionally to the integrated chronology with a lawful basis record. This human-in-the-loop step is deliberate and must be visible in the UI.
---
## 8. Design system
### 8.1 Direction
Take Beam's warmth and confidence, then make it ours. Beam's actual tokens are: cream `#fffcf8`, beige `#ede7de`, a warm dark chocolate `#2e1616` instead of black, a lava orange `#ea603e` accent, pinks for marketing moments, `Season Mix` display type, `Graphik` body, `DM Mono` for data, and mostly 0.5rem radii. We are not copying those values. Two things must be different for this product:
1. **Our accent cannot be red, orange, amber or green** because those hues carry risk meaning (RAG) throughout the product, and it cannot be blue because blue is Police Scotland's agency colour in the chronology.
2. This is a working tool used for hours a day with dense information, not a marketing site. Warmth stays; decoration goes.
Write the design plan in `docs/DESIGN.md` first: four to six named base colours, type roles, a layout concept with ASCII wireframes for the three hero screens (Person record, Integrated Chronology, Meeting Workspace), and principles. Then critique it: if any part is what you would produce for any dashboard, change it and say why.
### 8.2 Tokens (starting point, refine in DESIGN.md)
```css
@theme {
  /* surfaces: warm, paper-like, never pure white */
  --color-paper-0: #FCFAF5;
  --color-paper-1: #F6F2EA;
  --color-paper-2: #EEE8DC;
  --color-line-1: #E3DBCC;
  --color-line-2: #CFC5B2;
  /* ink: warm near-black, never #000 or a cold grey */
  --color-ink-1: #22201B;
  --color-ink-2: #514B41;
  --color-ink-3: #7E7668;
  /* accent: heather. Distinct from RAG and from the police blue. */
  --color-accent-1: #4F3D8B;
  --color-accent-2: #6B58A8;
  --color-accent-soft: #EEE9F7;
  /* risk semantics: always paired with an icon and a label */
  --color-risk-critical: #9E1B1B;
  --color-risk-high: #C2410C;
  --color-risk-medium: #A16207;
  --color-risk-low: #2F6F4F;
  --color-risk-unknown: #7E7668;
  /* agency palette: categorical, colour-blind safe with shapes */
  --color-agency-police: #1F3A93;
  --color-agency-social-work: #3F6B3A;
  --color-agency-health: #0B7A80;
  --color-agency-education: #8A6D00;
  --color-agency-housing: #8C4A2F;
  --color-agency-third-sector: #7A2E6E;
  --color-agency-sps: #5A6472;
  --color-agency-scra: #5B6B1F;
  --color-agency-court: #3B3B6B;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-pill: 999px;
  --shadow-1: 0 1px 0 rgb(34 32 27 / 0.06);
  --shadow-2: 0 4px 16px rgb(34 32 27 / 0.08);
}
```
Dark mode is a first-class theme, not an inversion: deep warm brown-black surfaces (`#1A1815`, `#221F1B`, `#2C2823`), warm light ink (`#F1ECE2`), the same accent lifted for contrast, agency and risk colours re-tuned for dark backgrounds. Provide `[data-theme="light"]`, `[data-theme="dark"]` and system-follow. Check every contrast pair with a script in `tooling/` and fail the build if any pair drops below AA.
### 8.3 Type
- **UI and body:** Atkinson Hyperlegible (Fontsource `@fontsource/atkinson-hyperlegible`). Chosen for legibility at small sizes and because it is not the default sans everyone reaches for. Fallback stack: `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`.
- **Display and numerals:** Bricolage Grotesque variable (Fontsource `@fontsource-variable/bricolage-grotesque`) for page titles, person names in the 360 header, big statutory clock numbers, and the sign-in screen. Use its width axis narrow for large numbers.
- **Reference numbers and timestamps in the audit log only:** JetBrains Mono. Nowhere else.
- Type scale (rem): 0.75, 0.8125, 0.875 (base UI), 1, 1.125, 1.375, 1.75, 2.25, 3. Line height 1.45 for body, 1.15 for display. Max line length 70ch for prose panels. Sentence case everywhere. No all-caps labels. No tracked-out eyebrows.
### 8.4 Layout
- Left rail (72px collapsed, 248px expanded) with process-aware navigation: Home, Worklist, People, Meetings, Actions, Sharing, Reports, Connectors, Admin. The rail shows the user's agency glyph and persona.
- Top bar: global search (people, cases, reference numbers), statutory clock summary chip, notifications, persona switcher.
- Content area uses a 12-column grid with a 1200px comfortable max and a "wide" mode for the chronology.
- Right-hand **context drawer** (360px) that shows the need-to-know panel, lawful basis, and audit for whatever is selected. It is the product's signature: information about who knows what is always one click away.
- Density toggle (comfortable / compact) stored per user.
### 8.5 Iconography and agency marks
Create a small custom SVG set in `packages/ui/src/glyphs/`: one glyph per agency (shield outline for police, house-with-people for social work, cross-in-circle for health, book for education, key for housing, hands for third sector, bars for SPS, gavel for court, balance for SCRA) and one per process (ASP, CP, MARAC, MAPPA, AWI). Each glyph has a filled and outline variant, renders at 16, 20 and 24px, and is used with its colour token. In the chronology, each event shows agency glyph + colour + label, never colour alone.
### 8.6 Custom CSS rules
- `apps/web/styles/` contains layered globals: `tokens.css` (`@theme`), `base.css` (reset, typography rhythm, focus rings, selection, scrollbars), `layout.css` (rail, top bar, drawer, grid), `motion.css` (durations, easings, reduced-motion), `print.css` (case conference packs, minutes, chronology exports).
- Every component in `packages/ui` and every feature component with more than trivial structure has a `ComponentName.module.css`. Tailwind utilities are for spacing and one-off alignment, not for the component's identity. A component's states (hover, focus-visible, active, selected, disabled, loading, error, restricted) live in its CSS with `data-state` attributes, not in class-name soup.
- Use CSS custom properties for component theming (`--card-padding`, `--timeline-gap`) so density and theme change without JS.
- Focus ring: 2px accent outline with 2px paper offset, everywhere, including on custom controls.
- Motion: one orchestrated moment on first load of Person record (the chronology lanes settle into place, 320ms). Elsewhere, motion only answers user actions: drawer open, row expand, clock tick. No hover lifts on cards. Respect `prefers-reduced-motion`.
- Print stylesheet produces a clean, paginated, header-and-footer document with the record reference, subject name, date, classification marking and page numbers.
- Stylelint enforces: no `!important` outside `utilities.css`, no hex colours outside `tokens.css`, no `px` font sizes, property order, and no unused custom properties.
### 8.7 Copy
Plain, active, specific. Buttons say what happens: "Record decision", "Send research request", "Promote to integrated chronology", "Place MARAC flag". Empty states tell the user what to do next. Errors say what went wrong and how to fix it. No exclamation marks. No "Oops". Statutory terms are used correctly and consistently; a glossary tooltip is available on first use per screen.
---
## 9. Mock data
### 9.1 Fictional geography and organisations
- **Clydeshore Council** (council area), Health and Social Care Partnership "Clydeshore HSCP".
- **NHS Clydeshore** (health board).
- **Police Scotland, "Z Division"** (fictional letter), Public Protection Unit at "Ardvale".
- Towns: Ardvale, Kilbrannan, Portnellan, Glenmoray, Braeside. Streets with Scottish vernacular (Loan, Wynd, Brae, Vennel, Gait). Postcodes `QX1` to `QX9`.
- Schools: Ardvale Primary, Kilbrannan Academy, St Ninian's Primary (fictional). GP practices: Portnellan Medical Practice, Braeside Health Centre. Hospital: Clydeshore Royal Infirmary. Care home: Rowanbank Care Home.
- Third sector: Clydeshore Women's Aid, Clydeshore Advocacy.
### 9.2 Generation rules
A deterministic generator in `packages/mock-data` (seeded PRNG, fixed seed by default, override via env) that produces: ~180 people, ~60 households, ~14 active processes across the five types, ~1,400 chronology events across agencies and connectors, ~40 meetings (past and scheduled), ~220 actions, ~90 sharing records, a full audit trail, and personas. Names from a curated fictional list with Scottish, Polish, Pakistani, Syrian and Chinese names to reflect real caseloads, with interpreter and communication needs where relevant. Ages and dates internally consistent (a child's school matches their age; a MHO clock started after the notification date). Every generated record is tagged `synthetic: true`.
### 9.3 Worked scenarios (must exist exactly, on top of the generated bulk)
1. **Marion Fraser, 79, Portnellan.** ASP financial harm by a nephew who holds an unregistered "arrangement" over her bank card. Capacity fluctuates (vascular dementia disclosed by GP). ASP inquiry opened after a bank raised concerns via police; investigation under way; case conference scheduled in 9 days; AWI capacity assessment pending and OPG check shows no PoA. Demonstrates ASP to AWI linkage, s10 records request to the GP, advocacy offered, and the adult's stated wish to stay at home.
2. **Kayleigh Docherty, 31, Ardvale, and her children Lily (7) and Mason (3).** MARAC referral from police after a DAQ with 17 yes answers; second referral in 8 months (repeat). Perpetrator **Ryan Kerr, 34**, on bail with conditions, subject to justice social work supervision for a previous domestic abuse conviction, considered for MATAC. IRD held after the latest incident because Lily was present; interim safety plan in place; CPPM in 19 days (clock visible). Demonstrates MARAC, IRD, MARAC flag on health and housing, perpetrator exclusion from need-to-know, and the IDAA's role.
3. **Derek Muir, 52, Kilbrannan.** MAPPA Category 1, Level 2, released from custody 6 weeks ago on licence, SONR compliant. Housing move proposed; Environmental Risk Assessment in progress (proximity to a primary school flagged). A disclosure decision to a new employer is pending. Level 2 review due in 5 weeks. Demonstrates the restricted MAPPA record, pre-meeting returns, RMP, disclosure decisions, and the ViSOR reference.
4. **Aiden Boyle, 7, Braeside.** Child protection: concern from school (bruising, disclosure to teacher), IRD held same day, JII completed under SCIM, CPPM held, registered under emotional abuse and physical abuse, core group active, child's plan with 6 actions. Rich integrated chronology from school (SEEMIS attendance), health visitor history, police concern reports about parental substance use, and social work. Demonstrates the chronology as the hero: patterns of escalation, gaps in engagement, the child's recorded views.
5. **Tomasz Nowak, 44, Glenmoray.** ASP self-neglect and hoarding, fire risk raised by Scottish Fire and Rescue. Has capacity and declines intervention; undue pressure considered and not found; support-only response agreed at case conference with his consent; Polish interpreter required. Demonstrates the adult's right to refuse, least restrictive principle, and a support plan that is not a protection plan.
6. **Ishbel Grant, 84, in Clydeshore Royal Infirmary.** Delayed discharge; lacks capacity for the decision about residential care; no attorney; family divided. Council applying for welfare guardianship; MHO report clock started 9 days ago (12 days left); two medical reports in hand; interim order sought; s13ZA considered and rejected because a relative objects. Demonstrates the AWI workflow and clocks.
7. **Rowanbank Care Home, Large Scale Investigation.** Six residents; medication errors and one alleged financial irregularity; Care Inspectorate, commissioning, health and police involved; a single LSI workspace with per-resident strands and a joint chronology. Demonstrates multi-subject processes.
8. **Chloe Reid, 19, pregnant, Ardvale.** Pre-birth IRD: history of care, current partner known to police for domestic abuse; midwifery, social work, police and health visiting in the IRD; pre-birth CPPM timing relative to expected delivery date. Demonstrates unborn-baby handling and the way an adult can be the subject of one process and a parent in another.
Each scenario ships with a `README.md` in `packages/mock-data/src/scenarios/` explaining the story, the intended demo path (click here, then here), and which product concepts it proves.
---
## 10. Screens and modules
For each screen: purpose, layout, key components, states (loading skeleton, empty, error, restricted, offline, stale), interactions, and what a Playwright screenshot must show. Build in the order given in section 13.
### 10.1 Sign in (mock SSO)
Organisation picker, then persona picker. Explains it is a demo. Full-bleed warm composition with the only large display type in the product. Remembers last persona.
### 10.2 Home
Greeting by first name and role. Three regions: **Clocks** (statutory countdowns across my cases, sorted by urgency, each a big Bricolage numeral with a plain label and the trigger date), **Worklist** (things waiting on me: inbox events to review, research requests, actions due, reports to write, meetings to prepare), **Today** (meetings and visits). Nothing decorative.
### 10.3 Worklist
Dense table with saved views (Mine, Team, Overdue, By process). Bulk actions. Inline preview in the drawer.
### 10.4 Search and people
Global search with typeahead across name, alias, DoB, CHI (synthetic), address, reference number. Results show process badges, restricted indicators, and "you are not on this case" affordances. People list with filters by process, agency involvement, locality, age band.
### 10.5 Person record (hero screen 1)
Header: name, preferred name, pronouns if recorded, age and DoB, address with move history count, interpreter and communication needs, alerts (e.g. "Known risk to staff: lone visits not advised", "MARAC flag until 14 Mar 2027"), process badges with stage and next date. Body tabs: Overview (network graph and household, key contacts by agency with role and last contact, current plans and clocks), Chronology, Processes, Views and voice, Documents, Sharing and audit. The context drawer defaults to "Who is involved" (a people-by-agency list with contact details and their case role).
### 10.6 Integrated chronology (hero screen 2)
Two synchronised views: **Lanes** (horizontal time axis, one lane per agency, events as glyph-marked points sized by significance, brushable zoom from years to days) and **List** (virtualised table: date, agency, type, title, response, outcome, significance, source, visibility). Filters: agency, event type, significance, process, date window, source (manual vs connector), visibility. Toggle between single-agency, integrated and "as it would appear in the CPPM pack". Analysis lane beneath the events. Pattern lenses as a togglable overlay with explanatory copy. Add event form with the fact/analysis separation enforced. Inbox of connector events awaiting review. Export to print pack with classification marking. Keyboard navigation across events with a details panel in the drawer.
### 10.7 Process dashboards (one per type)
Common frame: stage stepper with dates and who decided; clocks; participants and roles; the subject's views; plans and actions; meetings; sharing records; process-specific panels:
- **ASP:** three-point test panel with per-limb reasoning and date; harm types; consent and capacity; advocacy; investigation powers used; protection orders considered; LSI mode for multi-subject.
- **CP:** IRD record with per-agency contributions and decisions; JII and medical decisions; interim safety plan; CPPM and register panel with category and dates; core group; child's plan; pre-birth mode.
- **MARAC:** referral with DASH/DAQ breakdown (24 or 27 items, ticks visible, professional judgement override), repeat indicator, research request status per agency, meeting slot, action plan, IDAA feedback log, flags placed, links to CP, ASP, MAPPA, MATAC, DSDAS.
- **MAPPA:** restricted banner; category and level with history; lead RA; SONR status; licence conditions; risk tools and bands; RMP with triggers and contingencies; ERA; disclosure decisions register; pre-meeting returns; review schedule; ViSOR reference; break-glass entry for non-members.
- **AWI:** capacity assessments by decision; will and preferences; existing powers (OPG result); route decision including s13ZA record; application tracker with MHO 21-day clock, medical reports, court dates, interim order duration warning; order register; supervision visits.
### 10.8 Meeting workspace (hero screen 3)
For any meeting type. Before: invite list generated from need-to-know, pre-meeting information requests and returns, pack builder (select chronology window, reports, views). During: agenda, attendance with role, per-agency information shared (structured, dated, attributable), decisions with rationale and dissent, actions captured live with owner and due date, the subject's views read into the record. After: minute status (draft, chair-approved, distributed), distribution list with detail level per recipient, review date set, clocks updated. A "chair mode" with larger type and minimal chrome.
### 10.9 Actions
Cross-process register: owner, due, status, evidence of completion, escalation, overdue highlighting, grouped by process and by agency. Personal and team views.
### 10.10 Sharing and notifications
Outbound: the notification queue generated by need-to-know rules, each with recipient, detail level, lawful basis record, status (queued, sent, read). Inbound: requests for information from other agencies with a structured response form. A "what would X see" preview for any recipient role. The need-to-know matrices rendered as editable tables in admin.
### 10.11 Connectors
Health cards per adapter, sync history, event mapping preview, per-connector inbox counts, simulate outage / latency toggles, and a "how this would connect for real" panel per system (auth model, direction, cadence) written as product copy, not code.
### 10.12 Reports
Inspection-ready outputs: ASP biennial report figures, CP register statistics, MARAC SafeLives return fields, MAPPA annual report counts by category and level, AWI application timeliness. Each with a print pack. Charts are hand-built and accessible with data tables beneath.
### 10.13 Audit
Every read of restricted content, every share, every break-glass, every persona switch. Filter by person, user, agency, date. Export.
### 10.14 Admin
Local configuration: process labels (e.g. "Inter-agency" vs "Initial" Referral Discussion), statutory and local timescales, forms and their versions, need-to-know matrices, agencies and teams, users and personas, classification markings, theme and density defaults, demo reset.
### 10.15 Settings and help
Theme, density, notification preferences, glossary, keyboard shortcuts, about (build number, synthetic data notice).
---
## 11. Engineering standards
- **Schemas first.** `packages/domain` defines every entity with Zod, exports inferred types, and generates `docs/DATA-MODEL.md` (a script that walks the schemas and emits tables). No entity exists only in a component.
- **Clocks are pure.** `computeClock(trigger, rule, now)` returns due date, days remaining, RAG band, and the rule reference. 100% test coverage on clocks and need-to-know resolution.
- **Feature folders own their UI, hooks, schemas mapping, and CSS.** Shared primitives live in `packages/ui` (Button, IconButton, Pill, Badge, Card, Drawer, Dialog, Tabs, Table, Form controls, Toast, Skeleton, EmptyState, RestrictedState, ClockNumeral, AgencyMark, ProcessMark, RiskBand, Timeline primitives).
- **Every screen has a Playwright test** that loads it under the default persona, waits for data, runs axe, and captures a screenshot to `docs/SCREENSHOTS/<phase>/<screen>-<theme>-<density>.png`. Review the screenshots yourself after each phase and fix what looks wrong before moving on. A picture is worth a thousand tokens.
- **Performance budget.** First render of Person record under 150 ms on the seeded data; chronology list virtualised; lanes view handles 5,000 events at 60 fps on a mid-range laptop.
- **Commits.** Conventional commits, one feature per commit, `pnpm typecheck && pnpm lint && pnpm test` green before each. Update `docs/NOTES.md` and `docs/DECISIONS.md` as you go, not at the end.
- **Desktop packaging.** `pnpm build` produces the static export; `pnpm desktop:tauri:build` produces a macOS `.dmg` and, via CI config, a Windows `.msi`/`.exe`; `pnpm desktop:electron:build` is the fallback. App icon is a placeholder lantern. Window minimum 1200 by 760. Native menu with About, Reset demo data, Toggle theme, Zoom.
---
## 12. Definition of done (per screen and for the whole)
A screen is done when: all states are designed and reachable; it works with keyboard only; axe reports no violations; light and dark both look intentional; comfortable and compact both work; its CSS module exists and carries the component's identity; its screenshot is committed; copy has been read aloud once and simplified; the drawer shows correct need-to-know and lawful basis for the selected item; the scenario README's demo path passes.
The mockup is done when: all screens in section 10 exist; all eight scenarios can be walked end to end; the desktop build runs offline on macOS (and the Windows build is produced by the config even if untested locally); `docs/` is current; a 10-minute demo script exists at `docs/DEMO.md` walking a Chief Officers Group through scenarios 2, 4 and 6.
---
## 13. Working method and checkpoints
**Phase 0, plan (no code):** read the brief, write `PLAN.md`, `DESIGN.md` (with self-critique), `DATA-MODEL.md` outline, and an ASCII wireframe of the three hero screens. **Checkpoint 1:** present these and ask at most five questions. Then proceed.
**Phase 1, foundation:** workspace, tooling, tokens, fonts, primitives, layout shell, mock data engine and one scenario, sign-in, Home.
**Phase 2, the hero:** Person record and Integrated Chronology, with connectors inbox and print pack. Screenshots. Self-critique against section 8.
**Phase 3, processes:** ASP, CP, MARAC, MAPPA, AWI dashboards with their forms and clocks; all eight scenarios.
**Phase 4, meetings and sharing:** Meeting workspace, Actions, Sharing and notifications, need-to-know admin.
**Phase 5, operations:** Connectors admin, Reports, Audit, Admin, Settings.
**Phase 6, ship:** dark mode pass, density pass, accessibility audit, print pass, desktop packaging, `DEMO.md`. **Checkpoint 2:** present the screenshots and the demo script.
Between checkpoints, decide and record. Do not stop to ask whether a colour is right; make it right, screenshot it, and move on. If a statutory detail is uncertain, implement it as configuration with a `TODO(verify)` comment and a line in `DECISIONS.md`.
---
## 14. Out of scope (do not build)
Real authentication or SSO; real integrations; subject access request handling; document generation beyond print packs; e-signatures; mobile layouts (desktop only, but the CSS must not break at 1024px); analytics or telemetry; multi-tenancy administration; any AI-assisted drafting (the product may get this later; the mockup must not pretend it exists).
---
## Appendix A: glossary for UI tooltips
APC Adult Protection Committee. ASP Adult Support and Protection. AWI Adults with Incapacity. CHI Community Health Index number. COG Chief Officers Group. CP Child Protection. CPC Child Protection Committee. CPO Child Protection Order. CPPM Child Protection Planning Meeting. CSWO Chief Social Work Officer. DAQ Domestic Abuse Questions (Police Scotland). DASH Domestic Abuse, Stalking, Harassment and Honour-based violence risk checklist (SafeLives). DSDAS Disclosure Scheme for Domestic Abuse Scotland. DTC Duty to cooperate (MAPPA). ERA Environmental Risk Assessment. GIRFEC Getting it right for every child. HSCP Health and Social Care Partnership. IDAA Independent Domestic Abuse Advocate. IRD Inter-agency Referral Discussion. iVPD interim Vulnerable Persons Database (Police Scotland). JII Joint Investigative Interview. JPFE Joint Paediatric Forensic Examination. LSI Large Scale Investigation. LS/CMI Level of Service/Case Management Inventory. MAPPA Multi-Agency Public Protection Arrangements. MAPPP Multi-Agency Public Protection Panel (Level 3). MAPPS Multi-Agency Public Protection System (ViSOR replacement). MARAC Multi-Agency Risk Assessment Conference. MATAC Multi Agency Tasking and Coordination. MHO Mental Health Officer. MWC Mental Welfare Commission for Scotland. OLR Order for Lifelong Restriction. OPG Office of the Public Guardian (Scotland). PoA Power of Attorney. PPU Public Protection Unit. RA Responsible Authority (MAPPA). RMA Risk Management Authority. RMP Risk Management Plan. RM2000 Risk Matrix 2000. SA07 Stable and Acute 2007. SCIM Scottish Child Interview Model. SCRA Scottish Children's Reporter Administration. SEEMIS Scottish schools management information system. SHANARRI Safe, Healthy, Achieving, Nurtured, Active, Respected, Responsible, Included. SOG Strategic Oversight Group (MAPPA). SONR Sex Offender Notification Requirements. SPS Scottish Prison Service. VNS Victim Notification Scheme. ViSOR Violent and Sex Offender Register.
## Appendix B: legislation and guidance to reference by name in the UI and docs
Adult Support and Protection (Scotland) Act 2007 and Code of Practice (July 2022). National Guidance for Child Protection in Scotland 2021 (updated 2023). Children (Scotland) Act 1995. Children's Hearings (Scotland) Act 2011. Children and Young People (Scotland) Act 2014. UNCRC (Incorporation) (Scotland) Act 2024. Children (Care and Justice) (Scotland) Act 2024. Management of Offenders etc. (Scotland) Act 2005 and MAPPA National Guidance (current edition). Sexual Offences Act 2003 Part 2. Adults with Incapacity (Scotland) Act 2000 and Codes of Practice. Social Work (Scotland) Act 1968 s13ZA. Mental Health (Care and Treatment) (Scotland) Act 2003. Domestic Abuse (Scotland) Act 2018. Equally Safe strategy. UK GDPR, Data Protection Act 2018 (Schedule 1 Part 2 paragraph 18), Data (Use and Access) Act 2025. Human Rights Act 1998. Care Inspectorate Practice Guide to Chronologies (2017). Risk Management Authority Standards and Guidelines for Risk Management (FRAME).
## Appendix C: statutory and local clock rules to seed in config
| Rule id | Process | Trigger | Due | Source | Confidence |
|---|---|---|---|---|---|
| cp.cppm.initial | CP | Child protection procedures initiated | 28 calendar days | National guidance 2021 | High |
| cp.coregroup.first | CP | CPPM held | Local (seed 15 calendar days) | National guidance Appendix D | Verify |
| cp.cppm.review.first | CP | Initial CPPM | 3 months | National guidance Appendix D | Verify |
| cp.cppm.review.subsequent | CP | Review CPPM | 6 months | National guidance Appendix D | Verify |
| asp.inquiry.decision | ASP | Adult concern received | Local (seed 5 working days) | Local procedures | Local |
| asp.caseconference.initial | ASP | Adult concern received | Local (seed 21 calendar days) | Local procedures (Highland uses 21 days) | Local |
| asp.plan.review | ASP | Protection plan agreed | Local (seed 3 months) | Local procedures | Local |
| marac.research.return | MARAC | Research request sent | Local (seed 5 working days before meeting) | MARAC Operating Protocol | Local |
| marac.flag.expiry | MARAC | Case heard | 12 months | SafeLives practice | High |
| mappa.level2.review | MAPPA | Level 2 meeting | Per national guidance (seed 12 weeks) | MAPPA National Guidance | Verify |
| mappa.level3.review | MAPPA | Level 3 meeting | Per national guidance (seed 6 weeks) | MAPPA National Guidance | Verify |
| awi.mho.report | AWI | MHO notified of application | 21 days | AWI 2000 s57(4) | High |
| awi.interim.warning | AWI | Interim order granted | Warn at 6 months | Expert Working Group concerns 2026 | Advisory |
End of brief.
