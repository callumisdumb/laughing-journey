# Handover

What was built, what was decided, what was verified, and what is left. Read with `docs/BRIEF.md` (the request), `docs/PLAN.md` (the shape), `docs/DESIGN.md` (the look), `docs/DECISIONS.md` (the why), `docs/NOTES.md` (the phase logs), `docs/RESEARCH.md` (the sources), `docs/DEMO.md` (the demo script), `docs/HOW-TO.md` (how a practitioner moves work through it, written from the stage engine's tables) and, for the cryptography, `docs/THREAT-MODEL.md`, `docs/SECURITY.md`, `docs/CRYPTO-INVENTORY.md` and `docs/DPIA-NOTES.md` (the architecture, what it does not do, and the mapping to Article 32).

Everything in the dataset is fictional. Postcodes are in the Q, V and X ranges, CHI numbers are synthetic, and every person, address, organisation and record was invented for this mockup.

## 1. What is here

| Area | Where | State |
|---|---|---|
| Domain model, clocks, need-to-know, permissions, forms, the stage engine, notifications | `packages/domain` | Zod schemas are the source of truth; `docs/DATA-MODEL.md` is generated from them. Unit tests cover clocks, the 62 stage transitions (each driven through a permitted actor, a refused actor, a record that lacks what it needs and one that has it), the notification derivation, resolver, permissions, lenses and forms. |
| Design system | `packages/ui`, `apps/web/styles/tokens.css`, `docs/DESIGN.md` | Warm paper, heather accent, Atkinson Hyperlegible, Bricolage Grotesque, JetBrains Mono for audit only. Light and dark, comfortable and compact. Contrast is checked by a script over every text and control pairing. |
| Synthetic data | `packages/mock-data` | Deterministic generator (seed `clydeshore-2026`, demo now 02 Sep 2026 09:00), eight worked scenarios under `src/scenarios`, 58 background households, audit trail. |
| Copy catalogue | `packages/messages`, `docs/MESSAGES.md` | Every user-visible string in `src/en-GB.json` with `src/en-GB.context.json` beside it; typed keys, ICU MessageFormat, three-layer overrides (bundled, local file, session) edited in Admin, Copy and labels; `pnpm messages:check` in lint. |
| Cryptography | `packages/crypto`, `docs/SECURITY.md`, `docs/THREAT-MODEL.md` | One suite (`v1-x25519-mlkem768-aes256gcm`): AES-256-GCM content, hybrid X25519 with ML-KEM-768 key wrapping, Ed25519 with ML-DSA-65 signatures, Argon2id, Shamir 2 of 5 escrow, a signed audit hash chain. Primitives from @noble only; known-answer vectors from RFC 7748, RFC 8032, RFC 5869, FIPS 180-4 and NIST CAVP; a committed ciphertext fixture that is never regenerated. `docs/CRYPTO-INVENTORY.md` is generated from the source and checked for drift in lint. |
| Connectors | `packages/connectors` | Ten mock adapters with fixtures, mapping tables, simulated latency, outage and degraded toggles, and "how this would connect for real" copy. |
| Web app | `apps/web` | Next.js 16 static export with a client-side router; every screen in brief section 10. |
| Desktop shells | `apps/desktop-tauri`, `apps/desktop-electron` | Tauri 2 is the primary target (config, Rust menu, capabilities); Electron is the verified fallback. Both load `apps/web/out`. |
| Tests | `apps/web/e2e`, package `*.test.ts`, `apps/web/lib/*.test.ts` | Playwright per phase and per round with axe on every captured screen, and the driven suites (`flows`, `meetings`, `actions`, `notifications`, `cross-persona`, and one per built decision from `invitations` to `away`) that create a thing from nothing, drive it to its terminal state and read every consequence as a second persona (D-210). Vitest in domain, web (the store's pipeline, transitions and involvement), crypto, messages, ui, mock-data and connectors. |
| Screenshots | `docs/SCREENSHOTS/<phase>/<screen>-<theme>-<density>.png` | Reviewed at the end of each phase; the index is in section 5. |
| Continuous integration | `.github/workflows/ci.yml` | On every push and pull request, Node 22 with pnpm cached: `pnpm install --frozen-lockfile`, the static export first (the dialog margin guard reads it), `pnpm typecheck`, `pnpm lint` with every package's ESLint at `--max-warnings=0`, `pnpm test`; then a second job takes the export, installs Chromium and runs the layout, dialogs, flows and cross-persona suites against it. Any red step fails the run; a lint warning is a red step. |

## 2. Decisions

The full list with one line of rationale each is in `docs/DECISIONS.md`. The ones a new team should know first:

### Domain
- Need-to-know defaults to deny and the more restrictive reading wins where guidance is silent (D-042). MARAC perpetrators and associates and MAPPA victims are hard exclusions the UI cannot lift (D-043).
- MAPPA records are restricted; non-members see presence only and Responsible Authority agencies can break glass with a reason for four hours, audited (D-044).
- Statutory clocks carry a source and a confidence; Verify and Local rules are `TODO(verify)` in code and marked in the product (D-041). The IRD label and the ASP council officer eligibility are configuration (D-040, D-045).
- An unborn baby is a Person with `lifeStage: 'unborn'` and an expected delivery date (D-046).
- Exclusions are keyed on the case-role register (D-035); the MARAC DAQ and the MAPPA referral ask who else must not receive information and feed it (D-047). The MAPPA annual report is Annex 3 Tables 1 to 9 with the field set High and the annex's own wording, supplied verbatim (D-048, corrected 04 Sep 2026).
- Facts and analysis are separate records; a fact that reads as opinion is rejected by the schema and analysis must cite a fact (D-020b).
- Presence means a case exists, not who it is about. `identifiesSubject` in `packages/domain/src/permissions/access.ts` is the only answer to whether a reader may see whose case it is; four screens had each tested `level !== 'none'` and named the subject at presence level (D-170). The context drawer refuses in the same words as the record, keeping only what is about the reader (D-171).
- Linked cases are shown on the case, with the access rules run per link rather than inherited from the case in hand (D-169). The MARAC and the child protection case are clickable end to end, and a reader on one and not the other is told the other exists and nothing more.
- Search indexes what the reader could decrypt, and is built by decrypting rather than by checking a level (D-172). What it could not reach is counted and never described (D-173). Results are grouped by type on the screen and flat with a type tag in the typeahead (D-174); the results lag the query by 220ms, which is the debounce showing through rather than a spinner (D-175). Control and K focuses the box from anywhere (D-176). `apps/web/lib/search.ts` and `apps/web/lib/searchIndex.ts`.

### Design
- No avatars or initials circles; identity is name, date of birth and reference (D-022). Pills are for process and stage only; agencies use marks with a glyph, a colour and a label (D-023).
- Two agency colours were added for regulators and fire and rescue (D-021), and three text colours were darkened to pass 4.5:1 on every paper step (D-020).
- Wide tables are labelled focusable regions so keyboards can scroll them (D-024). Dates are typed as dd Mon yyyy in a shared field rather than picked from the browser's locale-formatted control (D-049).
- Four named layout modes chosen by width, applied through one attribute, with no media query for layout anywhere in the stylesheet (D-092). Below 1280 the rail is icons and the drawer is a panel; below 1024 both are panels (D-093), and both panels are the dialog primitive rather than a second overlay implementation (D-094). Panels respond to the record's width through a container query, not the window's (D-095).
- Text either wraps or truncates with a visible ellipsis and the full string reachable; nothing is sliced silently (D-096). Asserted on five screens rather than described.
- Any named person with a record is a link to it, and a link the reader may not follow looks exactly like one they may (D-097): refusing in writing on the presence-only state, and auditing the attempt, is inspectable where greying the link out is not. An excluded party is never a link (D-098). Practitioners have a card at `/practitioners/<id>`, whose case list is filtered by the reader's access and says how many cases it is withholding (D-099). A clock links to the timescale rule that sets it (D-101).
- Where you have been and where you were before that are session state and are not persisted (D-100): reloading empties both, deliberately.
- A screen that composes cards has one twelve-column grid; spans are declared once in the composition and re-packed when a card is absent, an empty card has the height of its title with the action that fixes it in its head, and a card whose absence changes nothing is absent (D-229). `apps/web/lib/composition.ts`, `docs/DESIGN.md` 4.4. The person record overview is the first screen built this way and `layout.spec.ts` measures it at 1440, 1920 and 2560 in both themes.
- Household and network is one card with the diagram as a toggle, a household of one is created with the person, and a move is recorded rather than edited (D-230). The record header is two regions and its action row is three buttons and a More menu holding the rare and consequential actions (D-231); the `Menu` primitive in `packages/ui` is the WAI-ARIA menu button pattern.
- Sentence case everywhere is enforced: `pnpm lint:caps` fails any `text-transform: uppercase` in the source CSS outside the classification marking, and the layout suite walks the rendered record for computed capitals (D-232). The empty record is designed on the person, the process, the meeting and the plan (D-233).
- One dialog primitive, centred by rules of its own with a compiled-CSS guard behind it, because a framework preflight can zero the margin that centres a native dialog without touching a line of this repository's code (D-088, D-089). Long forms summarise their validation failures at the top of the body (D-090).

### Engineering
- Static export plus a `pushState` router that prerenders every known path (D-004); the dataset is generated at start-up from a seeded PRNG, not committed JSON (D-005).
- TypeScript 5.9, ESLint 9.39, Playwright 1.62.1, TanStack Table 8.21 are pinned for the reasons in D-002, D-003, D-013, D-014 and D-038.
- Every screen accepts `?state=` for designed states (D-012). Telemetry is off at the build level (D-018).
- Electron is the demo build and Tauri stays configured (D-032); the Linux build container has no GTK or WebKitGTK, so the Tauri binary is not built here (D-007). See section 4.
- CI is `.github/workflows/ci.yml` (added 06 Sep 2026): the same gate a contributor runs before a commit (`pnpm build`, then `pnpm typecheck && pnpm lint && pnpm test`, lint refusing any warning), and the four driven Playwright suites that exercise the product end to end against the export (`layout`, `dialogs`, `flows`, `cross-persona`). The other suites run locally with `pnpm e2e`; they are longer, capture the screenshots and are run before each round's push rather than on every commit.

### Records management
- Every create and update goes through one pipeline, `store.write()`, which runs the ten steps of `docs/RECORDS.md` section 7 in order (D-110). Refusals are total and come first, so a refused write leaves no half-record, no orphan audit entry and no clock counting against something that does not exist (D-111). It returns codes; `apps/web/lib/writeErrors.ts` does the wording (D-119). This was not true until 04 Sep 2026: the raw `upsert` stayed public after the pipeline landed and eighteen older call sites kept using it, including the four statutory forms, the meeting workspace and the chronology. They are migrated, `upsert` is private to `store.ts`, and `apps/web/lib/write.test.ts` walks every source file so a direct write cannot come back (D-110, corrected). The pipeline also writes the lawful basis and the sharing records, completes clocks as well as starting them, and runs the exclusion check in reverse when a register entry is recorded (D-198). A connector delivering an event or an inbound change is the one other writer, through `store.receive`, and it is not audited as a person's act (D-199).
- A person is never created directly. The path is search, review candidates, then create only if nothing matches, and the count of candidates dismissed is recorded on the record (D-114). Candidates the reader cannot open are shown rather than hidden, because the invisible record is the one that produces the duplicate (D-115), and every candidate says why it matched rather than carrying a score (D-116).
- Permission to create is checked at the action, and the refusal names a route (D-117). `canCreate` in `packages/domain/src/permissions/create.ts` keys on the role's oversight kind, not on a list of role names.
- Generated CHI numbers are deliberately invalid: the right shape, no check digit (D-118).
- Household and network are two different things and stay separate (D-128 to D-131). Household membership is dated: `members` with `from`, `to` and a reason, read through `membersOn`. Relationships are stored once and read from both ends (D-129).
- Opening a process is gated twice, on eligibility and on permission, and both explain themselves (D-135). MAPPA has no age floor (D-136). A clock starts at the trigger its own rule names, which means a MARAC referral starts none, and the dialog says so (D-137).
- A relationship change shows what it does to the exclusion registers before the save button, computed by running the real register twice and diffing (D-130). Ending one never lifts an exclusion by itself; the decision is asked, defaults to standing, and is recorded either way (D-132).
- A merge is real and reversible. It repoints by walking the dataset and records the path of every reference it moved, so the unmerge is exact (D-122); both records are kept whole rather than reversing a field union afterwards (D-123); an undone merge keeps its record and is marked undone (D-124). `persistDatasetChange` in the store is how a whole-dataset change reaches the overlay, and step 13's closures and deaths will want it too (D-127).
- Every entity in the data model now has a create path or a row in `docs/RECORDS.md` saying why it does not. The ones added last: a plan as a list of outcomes with the ASP review date asked in the form (D-141); an alert with its visibility scope asked explicitly (D-142); an ASP protection order whose grant starts the statutory clocks, previewed from the rule table before the write (D-143); a MAPPA disclosure entered as a list of facts and opening pending (D-144); AWI supervision visits and section 10 or 12 investigations; and a manual case-role register entry for what derivation cannot know (D-145).
- The global create action in the top bar mounts the screens' own dialogs rather than a second implementation, and says which creates live on their own screen instead of faking them (D-146). It asks what, then the one thing the create needs, then hands over. `apps/web/components/CreateMenu.tsx`.
- Nothing in casework is deleted. Every casework record carries a version history and a recorded-in-error marker (D-148), the version entry is computed by the pipeline rather than declared by the caller (D-149), and a retired record stays on the record, in the audit trail and in any pack already distributed (D-153).
- A closure writes the coded reason its own national return uses, and says so where the list is local rather than national (D-150, D-151). A reopened case resumes the clocks the closure stopped, against the date they started, because the case was shut and the statutory period was running the whole time (D-152). `packages/domain/src/processes/close.ts`.
- A reason is required on a name, a date of birth or a CHI number and not on a telephone number, because those are what other agencies match on (D-154).
- A death is a flow with named consequences, computed by the function that performs them: each case the person is a subject of closes with its own return's reason, and a case they are only a party to is flagged for review rather than shut (D-155). `packages/domain/src/people/death.ts`.

### Casework: the stage engine, meetings, actions and notifications
- A notification is an output of the write pipeline and of the clock engine, never something a screen composes (D-207). It stores a kind, a pointer to its source, the recipient's detail level, the lawful basis where the thing announced reveals content, and a key; the sentence is rendered at read time from the catalogue and the record, so a presence-level recipient reads that a case they are linked to changed and nothing more. The actor is never told about their own act, an excluded party is never a recipient, and two drafts with one key are one notification. Twenty-seven kinds. `packages/domain/src/notifications/derive.ts`, `apps/web/lib/notifications.ts`.
- The clock engine is the third writer beside `write` and `receive` (D-208): warnings at `warnDays`, breaches at due, actions due, overdue and escalated, evaluated when the instant moves, after every process or action write, and once a minute on the live clock, keyed on the trigger so a hundred evaluations raise one warning. The seed carries its standing warnings already read, so a fresh seed writes nothing at boot and reset leaves an empty overlay. Reading, marking read and dismissing are the recipient's own state and are not audited (D-209).
- "Works" means a driven test (D-210): created from nothing, driven through the interface to its terminal state, and read by a second persona. Seeded data is never the thing under test. `cross-persona.spec.ts`, the five driven walks in `flows.spec.ts` (F.2.1 to F.2.5), `meetings.spec.ts`, `actions.spec.ts`, `notifications.spec.ts`.
- The stage engine is the only route to a stage (D-211). `packages/domain/src/processes/transitions.ts` and `stages/` hold 62 transitions across the five types, each with what it needs the record to hold, who records it, what it validates and writes, the clocks it completes and starts, where the case goes and what the store creates beside it (a meeting, a plan and its actions, information requests, a closure, a linked case). There is no stage picker; forward, with three named returns (D-241) and reopen as the only other way back; a refusal names the roles that record it or the missing thing and the action that creates it. The stepper's offer is a panel of buttons, one per transition, and the drawer and the demo panel say the same thing as sentences (D-217). `docs/HOW-TO.md` is written from the tables. Two readings decided in code: the ASP inquiry decision clock completes at the screening decision, and a level 1 MAPPA case sits at notification with managed semantics and never meets.
- An action may be given to any person the case permits or to every holder of a role, and membership is not the test (D-212); the test is the share recipient check. A role's action sits on every holder's worklist until one takes it, which is a reassignment. Cancelling keeps it. The escalation interval is configuration. `packages/domain/src/actions/assign.ts`.
- A meeting is scheduled through the engine where the tables schedule its type from the case's stage, as a plain meeting where they do not, and is refused, naming the stages, where the case has not reached it (D-213). Holding a meeting is recording the decision it made: the close button opens the transition's outcome form and the meeting is marked held as a consequence; the old meeting clock table is deleted. The invite list is proposed by one module and everybody it leaves off is recorded on the meeting with the reason (D-214). A rescheduled CPPM moves its notice period and a cancelled one completes it (D-216).
- What the round of 07 Sep 2026 added to the engine, which is where a new team will meet it: a case can end **transferred** as well as closed, from every non-terminal stage of the three types that lacked it, completing every running clock and offering nothing further (D-248); a level 1 MAPPA case is **reviewed on a clock**, repeatably, and referring up is offered rather than performed because the level is a meeting's decision (D-251); a guardianship order has a **life after it is granted**, renewed, varied, recalled or appealed, with the renewal clock counting back from whichever expiry is current (D-252); and a **Large Scale Investigation** is opened and added to, the chair refused unless they are a senior officer of the council (D-253). Outside the engine, the same round made the referral correctable from the case (D-245), a pending involvement request the requester's to amend or withdraw (D-246), a return markable as submitted (D-247), a pre-meeting request addressable to somebody with no account here (D-249), an action ownable outside the partnership and repeatable (D-250), and a notification copyable to whoever is covering you (D-254). Each has a driven spec named in section 6.
- What the driven walks found and fixed: recording a decision puts the recorder on the case (D-219); Home reads the case's members, not only the seeded list (D-218); the child protection decisions live in the meetings that make them (D-220); a MARAC child concern opens the child protection case authorised by the transition, and links to one already open (D-221, D-224); a response to a request the engine sent is the engine's own transition, so the MARAC research clock completes (D-222); a MARAC referral opens without a risk assessment and names its perpetrator (D-215, D-223); the MAPPA referral form records through the engine and the level waits for the meeting (D-225); a clock trigger is an instant and step 1 of the pipeline validates them (D-226); and "Ask to be involved" is a record the lead decides (D-227).

### Connectors, in both directions
- The write capability matrix is per connector and deliberately asymmetric (D-157). ECLIPSE is full two-way, CareFirst is batch, SEEMIS is a flag and an alert, EMIS Web is a coded flag after accreditation and marked unverified, iVPD is notify-only, ViSOR is never. It is on each connector card. `packages/domain/src/connectors/write.ts`.
- Every outbound write goes through an outbox with a visible delivery state (D-159). Sent is not acknowledged, a failure is surfaced rather than retried into silence, and the attempt count survives a retry. `packages/domain/src/connectors/outbox.ts`.
- Nothing writes automatically. A person authorises, with a purpose and a lawful basis, having seen the payload in the target system's own field names (D-160).
- The idempotency key is built from what the write is about, which is what makes a retry a retry and what catches the echo when the far side pushes our own write back (D-161).
- Conflicts go to a person, decided by a written-down authority table rather than by recency (D-162). The reconciliation screen is on each connector's own tab.
- The outbound payload is composed in the browser and relayed as ciphertext, so the encryption claim survives the feature (D-163). `packages/connectors/src/gateway.test.ts` asserts it, mirroring the inbound test.
- A working day is decided in one place, `packages/domain/src/calendar`, by three lists that compose: the national holidays, which of those the organisation observes, and the council's own local days (D-194). It refuses outside the committed range rather than guessing, and the clock that catches the refusal marks its due date unverified and says so on the countdown (D-195). Admin, Calendar shows all three lists, the provenance, the next twelve months and a working-day calculator that shows which days it skipped and why (D-197).
- `docs/DEMO.md` is a shooting script: ten chapters with waypoint, persona, clicks, narration, what to look at and a duration (D-188). It is checked twice: `pnpm demo:check` fails when a chapter's narration no longer fits its slot or the chapters stop adding up, and `apps/web/e2e/demo-script.spec.ts` walks every chapter from its own waypoint (D-189). The waypoint ids are the chapter ids, so the script, the panel and the test are one list.
- The recording preset is a setting in Settings and in the demo panel, not a build (D-185). It raises every type size one step, forces comfortable density and stops the looping animation. Every screen is swept at 1920x1080 with it on, with axe and a no-sideways-scroll check (D-186). `apps/web/lib/appearance.ts`, `apps/web/styles/tokens.css`.
- `pnpm lint` fails on placeholder copy in the catalogue: lorem, ipsum, TODO, TBD, TBC, XXX, placeholder, coming soon, FIXME, WIP, matched as words (D-187). One message says "placeholder" on purpose and carries `placeholderWord: true` in its context entry. `tooling/no-placeholder-copy.mjs`.
- The two-persona view is at `/compare`, and is the most persuasive screen here: the same case drawn for two people in one window, with the hosting provider as an optional third panel. The panels are the real screens inside a `ViewAs` provider rather than a summary of what the rules would say (D-181), and a panel holds no break-glass grant unless it is set to the signed-in user (D-182). Built and tested at 1920x1080. `apps/web/features/compare/`.
- The demo control panel is at Control, Shift and D on any screen, gated on `NEXT_PUBLIC_DEMO_TOOLS` like the simulator and labelled as not part of the product (D-177). Twelve waypoints, one per row of `docs/DEMO.md`, each setting persona, route, theme, density and clock in one action (D-178); persona switching; saved states for a second take (D-180); connector outage and speed; and reset to seed, which takes the clock and any break-glass grant with it (D-179). `apps/web/features/demo/`.
- The source system simulator is at `/simulator`, reachable from the Connectors screen. It is a real second system rather than a screenshot: an episode created there arrives here as a proposal, and one edited there produces a divergence on the reconciliation screen (D-165). It is a demo affordance gated on `NEXT_PUBLIC_DEMO_TOOLS`, which a production build sets to `0` (D-166). It deliberately looks like a different product and carries a neutral name (D-167).

### Security
- The claim is exact and the product never exceeds it: record content is end to end encrypted, the product as a whole is not, and every record is encrypted to exactly the principals the need-to-know rules entitle rather than to one organisational key (D-065). `docs/THREAT-MODEL.md` ranks the adversaries and `docs/SECURITY.md` section 10 is the rule that no screen may claim more.
- Entitlement is a key, not a boolean: the resolver returns a wrapping list, `canSee` was deleted, and a test walks every source file to make sure nothing reintroduces a content gate (D-066).
- Audit is signed and chained rather than encrypted, because it exists to be read by the people it polices; only the free-text detail is encrypted (D-067).
- Escrow is two of five across five organisations, and two holders from the same organisation are refused in code rather than in policy (D-068). Two colluding holders can read anything, which is stated plainly everywhere it matters.
- Primitives come from @noble only, and the build fails on MD5, SHA-1, ECB, DES, RC4, PBKDF2, scrypt, a supplied nonce or the platform pseudo-random source anywhere in the repository (D-063, D-064).

## 3. Verification table

Every clock rule in `packages/domain/src/clocks/rules.ts` with its seeded value, confidence and source. This is the only copy of the table. It is generated from the code by `pnpm docs:verification-table`, and `packages/domain/src/clocks/verification.test.ts` fails when the committed rows differ from `rules.ts` and holds `docs/RESEARCH.md` to them, whose section 3 indexes the research entries by rule id with the date and route of each source. Local and Verify rules are editable in Admin, Timescales.

| Rule id | Process | Trigger | Seeded value | Confidence | Source | Flag |
|---|---|---|---|---|---|---|
| cp.cppm.initial | cp | Child protection investigation begun (IRD decision) | 28 calendar-days | high | National Guidance for Child Protection in Scotland 2021 (updated 2023), Part 3 (Within 28 calendar days following a child protection investigation (Appendix D). The "concern being raised" framing belongs to the unborn baby row) |  |
| cp.coregroup.first | cp | Initial CPPM held | 15 working-days | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Within 15 working days of the CPPM (Appendix D, read live 03 Sep 2026)) |  |
| cp.cppm.review.first | cp | Initial CPPM held | 6 months | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Within 6 months of the initial CPPM (Appendix D). A review may be brought forward on significant change without altering the statutory maximum) |  |
| cp.cppm.review.subsequent | cp | Review CPPM held | 6 months | high | National Guidance for Child Protection in Scotland 2021, Appendix D (At least every 6 months, or earlier on significant change) |  |
| cp.cppm.notice | cp | CPPM date set (the clock counts back from the meeting date) | 5 calendar-days before | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Invitations, reports and notice to the family no later than 5 calendar days before the CPPM (Appendix D, read live 03 Sep 2026)) |  |
| cp.coregroup.escalate | cp | Significant change or concern within the plan identified | 3 calendar-days | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Escalation to the lead professional and the CPPM chair within 3 calendar days (Appendix D, read live 03 Sep 2026)) |  |
| cp.prebirth.review | cp | Pre-birth CPPM held | 3 months | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Review within 3 months of the pre-birth CPPM (Appendix D, read live 03 Sep 2026). After the birth the review may be deferred on professional judgement, with the reason recorded) | deferrable |
| cp.cppm.inquorate.reconvene | cp | CPPM inquorate | 10 working-days | high | National Guidance for Child Protection in Scotland 2021, Appendix D (An inquorate CPPM is reconvened within 10 working days (Appendix D, read live 03 Sep 2026)) |  |
| cp.cppm.record.distribute | cp | CPPM held | 10 working-days | high | National Guidance for Child Protection in Scotland 2021, Appendix D (The record of the CPPM is distributed within 10 working days (Appendix D, read live 03 Sep 2026)) |  |
| cp.prebirth.cppm | cp | Pre-birth concern raised | 28 calendar-days | high | National Guidance for Child Protection in Scotland 2021, Part 4 (unborn babies) (Within 28 calendar days of the concern and no later than 28 weeks gestation. The gestation cap is applied as a due date override on the process) |  |
| asp.inquiry.decision | asp | Adult concern received | 5 working-days | local | Local procedures (the Code of Practice 2022 sets no national timescale) (West of Scotland inter-agency guidance and Edinburgh 2024 procedures use 5 working days) | TODO(verify) |
| asp.caseconference.initial | asp | Adult concern received | 21 calendar-days | local | Local procedures (the Code of Practice 2022 sets no national timescale) (Highland 21 days; Orkney 20 days; Renfrewshire 20 working days) | TODO(verify) |
| asp.nmds.q1 | asp | Quarter 1 ended (30 June) | 45 calendar-days | high | ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026 (Quarter 1: data collection period 01.04.26 to 30.06.26 inclusive, return deadline 14.08.26, anticipated reporting to APCs not applicable) |  |
| asp.nmds.q2 | asp | Quarter 2 ended (30 September) | 44 calendar-days | high | ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026 (Quarter 2: data collection period 01.07.26 to 30.09.26 inclusive, return deadline 13.11.26, anticipated reporting to APCs February 2027) |  |
| asp.nmds.q3 | asp | Quarter 3 ended (31 December) | 43 calendar-days | high | ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026 (Quarter 3: data collection period 01.10.26 to 31.12.26 inclusive, return deadline 12.02.27, anticipated reporting to APCs not applicable) |  |
| asp.nmds.q4 | asp | Quarter 4 ended (31 March) | 44 calendar-days | high | ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026 (Quarter 4: data collection period 01.01.27 to 31.03.27 inclusive, return deadline 14.05.27, anticipated reporting to APCs August 2027) |  |
| asp.order.banning.maximum | asp | Banning or temporary banning order granted | 6 months | high | Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary (A banning or temporary banning order may last a period not exceeding 6 months. Serious harm must be evidenced. In urgency the council may apply to a justice of the peace rather than a sheriff) |  |
| asp.order.assessment.validity | asp | Assessment order granted | 7 calendar-days | high | Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary (An assessment order is valid for 7 days) |  |
| asp.order.removal.validity | asp | Adult removed under a removal order | 7 calendar-days | high | Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary (A removal order lasts a maximum of 7 days after the day the person is removed) |  |
| asp.order.removal.executeBy | asp | Removal order granted | 72 hours | high | Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary (The removal must take place within 72 hours of the order being granted) |  |
| asp.plan.review | asp | Protection plan agreed | 3 months | local | Local procedures (South Lanarkshire and Dumfries and Galloway review at 3 months then three monthly) | TODO(verify) |
| marac.research.return | marac | Research request sent | 5 working-days | local | Local MARAC Operating Protocol (SafeLives sets no national deadline) (SafeLives: case list circulated about 8 working days before the meeting; the return window is local) | TODO(verify) |
| marac.flag.expiry | marac | Case heard at MARAC | 12 months | high | SafeLives MARAC practice (Flag on agency records for 12 months from the last referral) |  |
| marac.repeat.window | marac | Case heard at MARAC | 12 months | high | SafeLives MARAC definitions (A repeat is a further referral within 12 months of the last referral) |  |
| mappa.level1.review | mappa | The case being managed at level 1, and each level 1 review after that | 12 months | local | Local: no national interval exists for level 1, which the MAPPA National Guidance 2022 leaves to local arrangements (Seeded at 12 months as the interval a partnership would recognise; confirm against the area procedures (docs/RESEARCH.md 9.4)) | TODO(verify) |
| mappa.level2.review | mappa | Level 2 meeting held | 12 weeks | high | MAPPA National Guidance 2022 (refreshed 31 March 2022) (Level 2 cases reviewed no less than once every 12 weeks) |  |
| mappa.level3.review | mappa | Level 3 (MAPPP) meeting held | 6 weeks | high | MAPPA National Guidance 2022 (refreshed 31 March 2022) (Level 3 cases reviewed no less than once every 6 weeks) |  |
| awi.order.renewal.due | awi | The order's expiry date, set when it is granted, renewed or varied | 90 calendar-days before | local | Adults with Incapacity (Scotland) Act 2000 s58 and s60: an order runs for the period the sheriff specifies (The expiry is the order's own. The 90 day lead time is the product's, so a renewal is prepared rather than discovered late; confirm the area's own lead time (docs/RESEARCH.md 9.5)) | TODO(verify) |
| awi.mho.report | awi | MHO notified of guardianship application | 21 calendar-days | high | Adults with Incapacity (Scotland) Act 2000 s57(4) (Report within 21 days of the date of notice) |  |
| awi.interim.warning | awi | Interim order granted | 3 months | high | Adults with Incapacity (Scotland) Act 2000 s57 as amended by ASP Act 2007 s60 (Interim orders run for 3 months by default and cannot exceed 6 months in total (s57). Adults with Incapacity Reform: Expert Working Group minutes, April 2026 (gov.scot, published June 2026) record the concern about prolonged interim orders) |  |
| awi.interim.maximum | awi | Interim order granted | 6 months | high | Adults with Incapacity (Scotland) Act 2000 s57 as amended (Total interim period cannot exceed 6 months) |  |

Other configuration marked to verify: the fictional council holiday list (the national list is the committed gov.uk feed fixture, refreshed with `pnpm holidays:sync`), the ASP s52 council officer eligibility wording (seeded from SSI 2008/306, section 6.1 of `docs/RESEARCH.md`), and the field sets of the inspection reports (see `docs/templates/README.md` and `docs/RESEARCH.md` section 5). Four local clocks (ASP inquiry decision, ASP initial case conference, ASP plan review, MARAC research return) keep their seeded values until the Ayrshire values arrive; every CP clock is now High from Appendix D (D-036).

## 4. Desktop packaging

Electron is the demo build (D-032). Tauri stays fully configured as the target shell and is built on macOS or Windows. Both shells load the same static export from `apps/web/out`, expose the same native menu (About, Reset demo data, Toggle theme, Zoom in, Zoom out, Actual size) and send the same `mas-menu` actions, which `apps/web/lib/desktop.ts` handles. No shell has network, filesystem or shell permissions.

| Shell | Verified here | Result | What is left |
|---|---|---|---|
| Tauri 2 (primary) | `cargo check` in `apps/desktop-tauri/src-tauri` | Dependency resolution and `Cargo.lock` succeed; compilation stops at the missing `gdk-3.0` system library because the Linux container has no GTK or WebKitGTK. | Build on macOS or Windows with the commands in section 7. The Rust code, `tauri.conf.json`, capabilities and icons are complete; expect the first build to take a few minutes while crates compile. |
| Electron 44 (fallback) | `tsc`, `electron-builder --dir --linux` | The main and preload scripts compile, the Electron binary downloads through the proxy, and `electron-builder` produces `apps/desktop-electron/release/linux-unpacked` (about 300 MB) with the web export under `resources/web/out` and the message catalogue as `resources/en-GB.json`; the packaged main process was smoke-tested resolving its menu and About text from that file. | Run the macOS and Windows targets on those platforms; the config already lists dmg, nsis and msi. |

Brief section 2 requires no runtime network. Both shells satisfy it: the web app never fetches, fonts are bundled, and the Tauri capability file grants no network permission.

## 5. Screenshot index

370 screenshots under `docs/SCREENSHOTS/<round>/<screen>-<theme>-<density>.png`, captured by the Playwright suites at 1440 by 900 unless the round says otherwise (the `compare`, `recording` and `script` rounds are 1920 by 1080, which is what they are filmed at). Light comfortable is the default; dark and compact variants are listed where captured, and phase 6 holds the dark and compact sweep of every screen. **This section is generated by `pnpm contact-sheet`. Do not edit by hand.** `docs/CONTACT-SHEET.md` is the same list with the images, and `docs/CONTACT-SHEET.html` is a single self-contained file whose captures open at full size in a viewer; that one is gitignored.

### phase-1

Foundation: the shell, sign-in, Home and the design system in use.

| Screen | Variants |
|---|---|
| home | dark comfortable, light comfortable, light compact |
| home rail collapsed | light comfortable |
| home state empty | light comfortable |
| home state error | light comfortable |
| home state loading | light comfortable |
| home state offline | light comfortable |
| sign in | light comfortable |

### phase-2

The Person record, the Integrated Chronology and the connector inbox.

| Screen | Variants |
|---|---|
| chronology | dark comfortable, light comfortable, light compact |
| chronology add event validation | light comfortable |
| chronology event selected | light comfortable |
| chronology lenses | light comfortable |
| chronology print pack | light comfortable |
| chronology state empty | light comfortable |
| chronology state restricted | light comfortable |
| chronology state stale | light comfortable |
| inbox | light comfortable |
| inbox promote | light comfortable |
| people | light comfortable |
| person record | dark comfortable, light comfortable, light compact |
| person record chronology | light comfortable |
| person record presence only | light comfortable |
| person record processes | light comfortable |
| person record sharing | light comfortable |
| person record voice | light comfortable |
| search results | light comfortable |
| search typeahead | light comfortable |
| worklist | light comfortable |
| worklist clocks | light comfortable |

### phase-3

Process dashboards for ASP, CP, MARAC, MAPPA and AWI, and the eight scenarios.

| Screen | Variants |
|---|---|
| home mho | light comfortable |
| process asp | light comfortable |
| process asp lsi | light comfortable |
| process asp support only | light comfortable |
| process asp three point form | light comfortable |
| process awi | light comfortable |
| process awi capacity form | light comfortable |
| process cp | dark comfortable, light comfortable |
| process cp prebirth | light comfortable |
| process mappa | light comfortable |
| process mappa restricted | dark comfortable, light comfortable |
| process marac | light comfortable |
| process marac daq form | light comfortable |
| processes | light comfortable |

### phase-4

The meeting workspace, actions, sharing and the need-to-know admin.

| Screen | Variants |
|---|---|
| actions | light comfortable |
| actions complete | light comfortable |
| actions team | light compact |
| meeting after | light comfortable |
| meeting before | light comfortable |
| meeting chair | dark comfortable, light comfortable |
| meeting during | light comfortable |
| meeting minutes | light comfortable |
| meeting minutes print | light comfortable |
| meetings | light comfortable |
| sharing inbound | dark comfortable, light comfortable |
| sharing outbound | dark comfortable, light comfortable |
| sharing preview | dark comfortable, light comfortable |

### phase-5

Connectors, the five inspection reports, the audit ledger, Admin, Settings and Help.

| Screen | Variants |
|---|---|
| admin | light comfortable |
| admin copy | light comfortable |
| admin defaults | dark comfortable, light comfortable |
| admin need to know | light comfortable, light compact |
| admin need to know edit | light comfortable |
| admin need to know marac | light comfortable |
| admin timescales | light comfortable |
| admin users | light comfortable |
| audit | light comfortable |
| connectors | dark comfortable, light comfortable |
| connectors outage | light comfortable |
| help about | light comfortable |
| help glossary | light comfortable |
| report asp | light comfortable |
| report asp current | light comfortable |
| report awi | light comfortable |
| report cp | dark comfortable, light comfortable |
| report cp print | light comfortable |
| report mappa | light comfortable |
| report mappa annex3 | light comfortable |
| report marac | light comfortable, light compact |
| reports | light comfortable |
| settings | light comfortable |

### phase-6

The dark and compact sweep of every screen, plus print and the 1024 wide check.

| Screen | Variants |
|---|---|
| actions | dark comfortable, light compact |
| admin need to know | dark comfortable, light compact |
| audit | dark comfortable, light compact |
| chronology | dark comfortable, light compact |
| chronology print media | light comfortable |
| connectors | dark comfortable, light compact |
| help | dark comfortable, light compact |
| home | dark comfortable, light compact |
| inbox | dark comfortable, light compact |
| keyboard focus | light comfortable |
| meeting during | dark comfortable, light compact |
| meetings | dark comfortable, light compact |
| people | dark comfortable, light compact |
| person record | dark comfortable, light compact |
| process asp | dark comfortable, light compact |
| process awi | dark comfortable, light compact |
| process cp | dark comfortable, light compact |
| process cp 1024 | dark compact, light comfortable |
| process mappa | dark comfortable, light compact |
| process marac | dark comfortable, light compact |
| processes | dark comfortable, light compact |
| reports | dark comfortable, light compact |
| settings | dark comfortable, light compact |
| sharing | dark comfortable, light compact |
| worklist | dark comfortable, light compact |

### classification

Government Security Classification: what is marked, what is not, and the derivation rules.

| Screen | Variants |
|---|---|
| admin markings | dark comfortable, light comfortable |
| classification dialog | dark comfortable, light comfortable |
| process marked | dark comfortable, light comfortable |
| report unmarked | light comfortable |

### nmds

The ASP data workbook return, previewed against the cells it writes to.

| Screen | Variants |
|---|---|
| nmds filled | light comfortable |
| nmds return | light comfortable |

### security

The cryptographic architecture made inspectable: what the host can see, the audit chain, statutory disclosure and the Security page.

| Screen | Variants |
|---|---|
| audit chain | dark comfortable, light comfortable |
| help security | dark comfortable, light comfortable |
| server view | dark comfortable, light comfortable |
| statutory disclosure | dark comfortable, light comfortable |

### dialogs

The one dialog primitive: a statutory form taller than the viewport, scrolling its body and keeping its footer, in both themes.

| Screen | Variants |
|---|---|
| statutory form | dark comfortable, light comfortable |

### layout

The four layout modes: the same person record docked, compact and as panels.

| Screen | Variants |
|---|---|
| person compact 1024 | light comfortable |
| person narrow 900 | light comfortable |
| person standard 1440 | light comfortable |

### links

The product as a web of records: a practitioner card, the case-party register, an unentitled landing and where you have been.

| Screen | Variants |
|---|---|
| case parties | light comfortable |
| practitioner card | light comfortable |
| recently viewed | light comfortable |
| unentitled landing | light comfortable |

### sign-in

Choosing who you are, rebuilt: one surface, the honest statement second, both questions at once and the keyboard first.

| Screen | Variants |
|---|---|
| sign in | dark comfortable, light comfortable |
| sign in remembered | light comfortable |

### clock

The settable demo clock, which every statutory clock and every relative date in the product is computed against.

| Screen | Variants |
|---|---|
| demo clock | light comfortable |

### create

Making a record. Adding a person begins with looking for them: the search, the candidates with the reason each matched, the form that only opens once they have been dismissed, the refusal for a role that does not hold cases, and the merge, which is destructive and therefore reversible. Then the rest of the create paths, each showing the consequence before the button: the outcomes that are the plan, the alert and who can see it, the clocks a granted protection order starts, the facts a disclosure is limited to, and the global create action that reaches them all from anywhere.

| Screen | Variants |
|---|---|
| add alert | light comfortable |
| add person candidates | light comfortable |
| add person details | light comfortable |
| add person gated | light comfortable |
| add person search | light comfortable |
| add plan | light comfortable |
| global create | light comfortable |
| merge | light comfortable |
| merge standing | light comfortable |
| propose disclosure | light comfortable |
| protection order | light comfortable |
| register entry | light comfortable |
| supervision visit | light comfortable |

### network

Starting a process behind two gates that explain themselves, and household and network kept apart, and what changing either one does: the open cases a household change touches, and the exclusion a relationship creates, both computed and shown before the button.

| Screen | Variants |
|---|---|
| household and network | light comfortable |
| household change | light comfortable |
| relationship consequences | light comfortable |
| start process | light comfortable |
| start process young adult | light comfortable |

### terminal

The other half of a records system: editing, correcting, closing, reopening, retiring and recording a death. Nothing here deletes. A closed case keeps its deadlines and can be reopened; a retired chronology entry is off the working list and still on the record; a corrected date of birth leaves the value it used to hold on screen with the reason it changed.

| Screen | Variants |
|---|---|
| close process | light comfortable |
| edit person | light comfortable |
| record death | light comfortable |
| record history | light comfortable |
| recorded in error | light comfortable |
| reopen process | light comfortable |

### two-way

Connectors in both directions. The capability matrix that refuses to claim what is not realistic, the outbox with a delivery state a person can see, the payload preview in the target system's own field names, the echo defence that recognises our own write coming back, and the reconciliation screen almost no product demo has.

| Screen | Variants |
|---|---|
| authorise write | light comfortable |
| inbound | light comfortable |
| outbox | light comfortable |
| reconcile | light comfortable |
| status echo | light comfortable |
| write matrix | light comfortable |

### simulator

The other side of the connector: a deliberately plain mock of a partner system, so two-way integration can be filmed from both ends. Plainer, denser, older, with a neutral name and a banner saying it is simulated. The wiring is real: an episode created there arrives here as a proposal, and one edited there produces a divergence on the reconciliation screen.

| Screen | Variants |
|---|---|
| simulator | light comfortable |
| simulator new episode | light comfortable |
| simulator record | light comfortable |

### flows

The eight named flows walked end to end rather than described: the three-point test computing its own outcome, the IRD with four agencies and a recorded dissent, the MARAC and child protection chain clicked from one case to the other, the workbook export naming the cells it fills, and the persona proof, where the same case gives three people three different answers and the third is refused by name.

| Screen | Variants |
|---|---|
| asp next refused | light comfortable |
| asp plan form | light comfortable |
| asp plan milestone | light comfortable |
| asp plan recorded | light comfortable |
| asp reviewed | light comfortable |
| asp screening form | light comfortable |
| audit after write | light comfortable |
| awi next | light comfortable |
| awi order form | light comfortable |
| awi route form | light comfortable |
| awi supervision | light comfortable |
| connector inbox | light comfortable |
| cp cppm form | light comfortable |
| cp deregistered | light comfortable |
| cp ird | light comfortable |
| cp ird form | light comfortable |
| cp pre birth born | light comfortable |
| cp registered | light comfortable |
| mappa held form | light comfortable |
| mappa managed | light comfortable |
| mappa presence driven | light comfortable |
| mappa referral form | light comfortable |
| mappa risk form | light comfortable |
| marac chain | light comfortable |
| marac chain driven | light comfortable |
| marac child concern form | light comfortable |
| marac next refused | light comfortable |
| marac plan form | light comfortable |
| marac plan recorded | light comfortable |
| marac research back | light comfortable |
| marac research form | light comfortable |
| marac research return | light comfortable |
| marac transferred | light comfortable |
| nmds export | light comfortable |
| persona not on the case | light comfortable |
| report asp | light comfortable |
| report mappa | light comfortable |
| sharing inbound | light comfortable |
| sharing outbound | light comfortable |

### search

Search over the records the reader can open. The typeahead reaching past people and case references into meetings, actions and chronology entries; the results grouped by type; and the same query typed by somebody who holds no key for the case, which finds the reference, refuses the rest and says how many cases it could not search.

| Screen | Variants |
|---|---|
| loading | light comfortable |
| no key | light comfortable |
| results | light comfortable |
| typeahead | light comfortable |

### demo

The demo control panel, which is not part of the product and says so. Hidden behind Control, Shift and D and absent from a production build. Twelve chapters that each set the persona, the route, the appearance and the clock in one click; persona switching without the account menu; the clock; saved states for a second take; connector outages; and the reset that takes the clock and any break-glass grant with it.

| Screen | Variants |
|---|---|
| panel | light comfortable |

### compare

Two people, one record, one window, at 1920x1080. The panels are the real screens rather than a summary of what the rules would say, and the third panel is the hosting provider: practitioner, partner agency and host in one frame.

| Screen | Variants |
|---|---|
| three panels | light comfortable |
| two personas | light comfortable |

### recording

Every screen under the recording preset at 1920x1080: every type size a step larger, comfortable density, no looping animation. Video compression eats small text, and the audience for a recording is further from the screen than a practitioner ever is.

| Screen | Variants |
|---|---|
| actions | light comfortable |
| admin need to know | light comfortable |
| admin server view | light comfortable |
| audit | light comfortable |
| chronology | light comfortable |
| connectors | light comfortable |
| help | light comfortable |
| home | light comfortable |
| inbox | light comfortable |
| meeting during | light comfortable |
| meetings | light comfortable |
| people | light comfortable |
| person record | light comfortable |
| process asp | light comfortable |
| process awi | light comfortable |
| process cp | light comfortable |
| process mappa | light comfortable |
| process marac | light comfortable |
| processes | light comfortable |
| reports | light comfortable |
| search | light comfortable |
| settings | light comfortable |
| settings preset | light comfortable |
| sharing | light comfortable |
| worklist | light comfortable |

### script

The shooting script walked against the built product: each of the ten chapters of docs/DEMO.md opened from its own waypoint, at 1920x1080 with the recording preset on, showing the thing the script tells a viewer to look at.

| Screen | Variants |
|---|---|
| chapter 1 problem | light comfortable |
| chapter 10 close | light comfortable |
| chapter 2 chronology | light comfortable |
| chapter 3 need to know | light comfortable |
| chapter 4 connectors | light comfortable |
| chapter 4a simulator | light comfortable |
| chapter 5 chain | light comfortable |
| chapter 5 refused | light comfortable |
| chapter 6 clocks | light comfortable |
| chapter 7 meeting | light comfortable |
| chapter 8 host | light comfortable |
| chapter 9 workbook | light comfortable |

### calendar

The working calendar behind every statutory clock: the national bank holiday list from the gov.uk feed with its provenance, the council's own local days kept separate from it, the next twelve months of non-working days, and a calculator that shows which days a count skipped and why.

| Screen | Variants |
|---|---|
| calculator | light comfortable |
| calendar | light comfortable |

### action-owners

| Screen | Variants |
|---|---|
| evidence file | light comfortable |
| external owner | light comfortable |
| next occurrence | light comfortable |
| repeating | light comfortable |

### actions

| Screen | Variants |
|---|---|
| add from case | light comfortable |
| taken | light comfortable |

### attachments

| Screen | Variants |
|---|---|
| attach dialog | light comfortable |
| event attachment | light comfortable |
| person documents | light comfortable |

### away

| Screen | Variants |
|---|---|
| delegate copy | light comfortable |
| digest | light comfortable |
| out of office | light comfortable |

### cross-persona

| Screen | Variants |
|---|---|
| ask to be involved | light comfortable |
| break glass driven | light comfortable |
| break glass ledger | light comfortable |
| involvement accepted | light comfortable |
| involvement requests | light comfortable |
| janet panel | light comfortable |
| janet worklist overdue | light comfortable |

### external-request

| Screen | Variants |
|---|---|
| external request form | light comfortable |
| return dialog | light comfortable |
| returned on behalf | light comfortable |

### household-move

| Screen | Variants |
|---|---|
| move household dialog | light comfortable |
| moved | light comfortable |

### invitations

| Screen | Variants |
|---|---|
| chair told | light comfortable |
| substitute seated | light comfortable |
| your invitation | light comfortable |

### involvement-change

| Screen | Variants |
|---|---|
| amended | light comfortable |
| withdrawn | light comfortable |
| your request | light comfortable |

### lead

| Screen | Variants |
|---|---|
| reallocate dialog | light comfortable |
| reallocated | light comfortable |

### lsi

| Screen | Variants |
|---|---|
| already open | light comfortable |
| open form | light comfortable |
| opened | light comfortable |
| strand form | light comfortable |
| strand refused | light comfortable |

### mappa-level1

| Screen | Variants |
|---|---|
| refer offered | light comfortable |
| refer up | light comfortable |
| review form | light comfortable |
| reviewed | light comfortable |

### meetings

| Screen | Variants |
|---|---|
| cancelled | light comfortable |
| hold plain | light comfortable |
| inquorate | light comfortable |
| minute distributed bell | light comfortable |
| schedule dialog | light comfortable |
| schedule refused | light comfortable |
| scheduled | light comfortable |

### minute-correction

| Screen | Variants |
|---|---|
| corrected | light comfortable |
| correction dialog | light comfortable |
| pack corrections | light comfortable |

### notifications

| Screen | Variants |
|---|---|
| panel | light comfortable |
| screen | light comfortable |

### order-life

| Screen | Variants |
|---|---|
| appeal form | light comfortable |
| no order yet | light comfortable |
| order life | light comfortable |
| renew form | light comfortable |
| vary form | light comfortable |

### person-record

| Screen | Variants |
|---|---|
| before 1440 | dark comfortable, light comfortable |
| before 1920 | dark comfortable, light comfortable |
| before 2560 | dark comfortable, light comfortable |
| person record new | dark comfortable, light comfortable |
| person record populated | dark comfortable, light comfortable |

### referral-correction

| Screen | Variants |
|---|---|
| correct referral dialog | light comfortable |
| corrected | light comfortable |

### return-stage

| Screen | Variants |
|---|---|
| return dialog | light comfortable |
| returned | light comfortable |

### safelives

| Screen | Variants |
|---|---|
| safelives empty | light comfortable |
| safelives refused | light comfortable |
| safelives return | light comfortable |

### submissions

| Screen | Variants |
|---|---|
| submit dialog | light comfortable |
| submitted | light comfortable |

### transfer

| Screen | Variants |
|---|---|
| transfer dialog | light comfortable |
| transferred | light comfortable |

## 6. Known gaps and TODO(verify)

Everything marked here is either configuration seeded from research rather than a primary source, or a deliberate limit of a mockup with no backend.

### Found by review on 04 Sep 2026, and corrected
- **The person record header collapsed below 1280.** The identity column was `minmax(0, 1fr)` with the record actions row pinned to column 2, so at 1024 and 900 the name, address and CHI shared 60px and the register alert pill was sliced mid-word, and the layout suite passed because its truncation check skipped any element with children. Corrected: a 28ch floor on the identity column of both two-column headers, one column below compact with the actions row back in it, a wrapping pill that hides nothing, and an assertion on both headers and every pill and mark in them at all four widths (D-200).
- **The nephew in scenario 1 carried the presenter's name.** Renamed to Duncan Fraser, the name is out of the forename pool, the seed is regenerated and every capture re-swept (D-201).
- **The dialog margin guard passed on a fresh clone with nothing to check.** It read the compiled export and exited clean when there was none, so `pnpm lint` on a clean checkout could not fail on the bug it exists for. It fails now and says to run `pnpm build` first (D-203).
- **Two documents said the Annex 3 wording was a placeholder.** It has been the annex's own since 03 Sep 2026; D-048, section 2 and the waiting list above said otherwise and are corrected.
- **The gov.uk feed capture was outstanding.** It arrived and is committed byte for byte; the sync derived the fixture from it offline (D-202).
- **The write pipeline was bypassed by the flows the script films.** D-110 and section 2 said every create and update went through `store.write()`. The pipeline existed and the new create paths used it, but `store.upsert` stayed public and eighteen call sites in the four statutory forms, the meeting workspace, the chronology, the person's own views, actions, the worklist, the inbox, sharing and the connector pull still wrote directly, skipping the audit entry, the classification check, the exclusion check, the rewrap, the clocks and the chronology milestone. The meeting workspace recomputed clocks by hand and wrote them back. Corrected in the same round: every one of those sites now goes through the pipeline, `upsert` is private to `store.ts`, `apps/web/lib/write.test.ts` walks every source file under `apps/web` and fails on a direct write, and the flows and phase 4 specs assert the milestone, the sharing record and the ledger lines the pipeline now writes. The pipeline was extended rather than the callers (D-198), and the connector delivery path is named as the one other writer (D-199).

### Reconciled on 05 Sep 2026
- **The research log had kept 02 Sep extracts as if current where a later reading corrected them.** 1.4 and 1.6 (the CP clocks, corrected by 6.4), 1.18 (the AWI citation, by 6.5), 5.3 and 5.4 (the CP register field sets, by the publication read on 03 Sep, now 5.16), and 5.8 and 6.7 (the Annex 3 tables, by 5.12); with them a second copy of the verification table above that had drifted from it, and a reconstruction of Annex 3 that had four of the nine tables wrong. Writing the test then showed the table above was short as well: the four NMDS submission deadlines and the four ASP order clocks added on 03 Sep had never reached it, so it is now generated from `rules.ts` (`pnpm docs:verification-table`) rather than kept by hand. Generating it showed one more thing: the four NMDS deadline clocks had no label, trigger or description in the catalogue, so Admin, Timescales was printing their keys. They have catalogue text now, the one change outside the documents in this round, and the test refuses a rule without it. Each superseded entry now carries a "Superseded by" line and keeps its text, the reconstruction is struck, section 3 of the log indexes the entries by rule id and points here for the values, the method note names each primary source with its date and route, and `verification.test.ts` fails the build if the log marks a rule to verify that this table marks High (D-205).

### Made to work on 05 Sep 2026, and what the documents had said
The round's standard was a driven test (D-210), and the full record of each overclaim is in `docs/NOTES.md` ("What the documents said the product did"). In short:
- **The bell counted seeded shares.** Notifications are now an entity the pipeline and the clock engine write, twenty-six kinds, rendered at the reader's level (D-207 to D-209).
- **The stepper was a picture.** Stages were set by whichever form wrote `stage`. The stage engine is now the only route (D-211), and there is no stage picker.
- **"Ask to be involved" was a toast.** It is a record the lead decides, with both sides told (D-227).
- **Holding a meeting wrote a status.** It now records the decision the meeting made, and the meeting clock table that answered separately is deleted (D-213).
- **The walks found nine more.** A MARAC research return never reached the case (D-222); the MAPPA referral form set the level before any meeting (D-225); a MARAC referral from the person record named the victim as the perpetrator (D-223); the coordinator's child concern opened nothing and said it had (D-224); an interim order under the 2000 Act poisoned the next write on the case (D-226); a team leader who screened a concern read the case at presence level a second later (D-219); Home's clocks missed a case opened that morning (D-218); a rescheduled planning meeting completed its own notice clock (D-216); and a referral without a risk assessment could not open at all (D-215). Each is a decision, a fix and a driven assertion.

### Composed on 06 Sep 2026
Two captures of a freshly created person's record showed the overview laying itself out a section at a time, the household as three cards, the header floating its parts, five actions in three styles and a tracked-capitals eyebrow. The before captures and the critique are in `docs/NOTES.md`; the rules are D-229 to D-233 and `docs/DESIGN.md` 4.4. What changed: one twelve-column grid for the overview with rows re-packed when a card is absent and empty cards collapsed to their titles; one Household and network card with the diagram as a toggle, a household of one created with the person and Record a move; a two-region header with three buttons and a More menu; sentence case everywhere with a lint guard and a runtime assertion; and the same empty-state rule on a new process, an uninvited meeting and a plan with no actions. One thing the captures said that the export did not reproduce: at 2560 the page measures 1200 wide and centred, so the cap was kept and asserted rather than changed. The process record followed on the same day (D-238): every type panel is a cell of the screen's one grid, the pairs that had grids of their own are cells of six, and the layout suite holds all five dashboards to the same assertions as the person record.

### Made to work on 06 Sep 2026
Six things the list above had carried since the round of 05 Sep, each now a driven spec (`apps/web/e2e/invitations`, `lead`, `return-stage`, `minute-correction`, `attachments`, `household-move`) and a HOW-TO section (16 to 21):
- **Answer an invitation** (D-239): accept, decline with a reason, or send a colleague from your agency, who is seated through need-to-know and told; the chair is told and the attendance list starts from the answers.
- **Reallocate the lead** (D-240): from the case, with a reason, to somebody in the lead agency whose role may lead the type; both told, membership follows, header and drawer read it, audited, and proposed to the source system where the connector permits.
- **Return a case a stage** (D-241): three named transitions (ASP investigation to inquiry, CP investigation to a reconvened IRD, MARAC action plan to a re-hearing), reason required, no clock started, the clocks by the rule table.
- **Correct an approved minute** (D-242): by addendum, dated and attributed, sent to the original distribution at their levels, beneath the minute in the pack.
- **Attach a file** (D-243) to a person, a case, a meeting or a chronology event: a data URI on the record, 1 MB a file and 4 MB a record, classified from the parent and marked on download, audited; nothing scans it, and the dialog says so.
- **Move a household** (D-244): everybody on one date to one address, one event each, named people left behind with an address or none, address history kept.

### Made to work on 07 Sep 2026
The ten items the list below had carried, each now a decision (D-245 to D-254), a driven spec (`apps/web/e2e/referral-correction`, `involvement-change`, `submissions`, `transfer`, `external-request`, `action-owners`, `mappa-level1`, `order-life`, `lsi`, `away`) and a HOW-TO section (22 to 31):
- **Correct a referral** (D-245) once the case is open, on the fields the opening record carries and never the subject or the perpetrator, with both readings kept.
- **Amend or withdraw a request to be involved** (D-246) while it is still waiting, and ask again after withdrawing.
- **Mark a return as submitted** (D-247), with the recipient, the route, the date and the reference, completing the deadline clock; the product still sends nothing.
- **Transfer a case to another authority** (D-248) from adult support and protection, child protection and adults with incapacity, as MARAC and MAPPA already could: clocks stop, the record says where it went, nothing further is offered.
- **Ask an agency nobody here holds an account for** (D-249) and record the return on their behalf, with how it arrived.
- **Give an action to somebody outside the partnership, repeat it, and attach the evidence** (D-250), with a named chaser here who carries and completes it.
- **Review a level 1 MAPPA case on a clock** (D-251), repeatable, referring up offered rather than done.
- **Renew, vary, recall or appeal a guardianship order** (D-252), with a renewal clock counting back from whichever expiry is current.
- **Open a Large Scale Investigation and add adults to it** (D-253), the chair a senior officer of the council, each adult their own strand.
- **Be told when you are not signed in** (D-254), as far as an offline product honestly can: a delegate while you are away, and the digest that does not go out for the administrator.

### What practitioners still cannot do
Nothing, for the first time. Every item this list has carried since the round of 05 Sep 2026 was built in the round above, and each is a driven spec rather than a claim. What remains are limits of a mockup with no backend, and they are under "Product limits by design" below: no real integrations, no authentication, nothing sent outside the product, and no file scanning.

### Statutory and local values to verify (also in `docs/RESEARCH.md` and Admin, Timescales)
- `asp.inquiry.decision` (5 working days), `asp.caseconference.initial` (21 calendar days), `asp.plan.review` (3 months) and `marac.research.return` (5 working days): local values; confirm against the Clydeshore equivalent's own procedures.
- Every CP clock is High from Appendix D of the 2021 national guidance, read live on 03 Sep 2026 (section 6.4 of `docs/RESEARCH.md`): `cp.cppm.review.first` is the 6 month maximum with no local override anywhere, and the Aiden Boyle review is brought forward by a decision of the meeting, not by a rule.
- `awi.interim.warning`: High. The 3 month default and 6 month total limit are s57 as amended, and the warning cites the Adults with Incapacity Reform Expert Working Group minutes of April 2026 (section 6.5).
- Scottish bank holidays used by working-day clocks: the committed gov.uk fixture (`packages/domain/src/config/bank-holidays.json`, Scotland division, 2019 to 2028, including the one-off 15 June 2026), normalised with its provenance and a corrections log; refresh with `pnpm holidays:sync`, which merges rather than replaces and refuses to change an already-committed date without `--apply-changes` (D-192, D-193). The council local holiday list is fictional and marked to verify, and is kept entirely separate from the national list in the data, on the Admin calendar and in the calculation (D-194). The raw feed response the product owner captured on 03 Sep 2026 is committed byte for byte as `bank-holidays.raw.json`, all three divisions, 2019 to 2028, and the normalised fixture was derived from it offline with `pnpm holidays:sync --from` (D-202): 94 Scottish holidays, 2019 to 2028, an empty corrections log.
- ASP s52 council officer eligibility wording (`aspCouncilOfficerEligibility`): seeded from SSI 2008/306; confirm against the local rule.
- Roles that may not receive Official-Sensitive content (`officialSensitiveWithheldFrom`): seeded from the roles that in this product only ever receive presence-level information, which is a guess at what a partnership would actually agree. Confirm against the information sharing agreement, which is what decides it. Stated as an exclusion list rather than a permission list on purpose (D-078), so a role added later is allowed rather than silently cut off.
- The exclusion near-match threshold (0.82, `SIMILARITY_THRESHOLD` in `packages/domain/src/need-to-know/similarity.ts`): a constant, seeded to catch the four documented ways a name gets written differently and to leave unrelated names alone. A deployment should make it configuration and tune it against real name data, because the right value depends on the naming patterns in the area (D-084).
- ASP: High throughout. All nine field sets were read from the supplied ASP data workbook 2026-27 (`docs/templates/`), which corrected nine of them (`docs/RESEARCH.md` 5.14, D-061), and the four NMDS submission deadlines (`asp.nmds.q1` to `asp.nmds.q4`) were read from the ASP data collection web page on 06 Sep 2026 (9.1). Nothing about ASP is waiting on anyone. The page says an update to the guidance document is pending for summer 2026, so the return dates and the guidance edition are checked against it each year.
- Report field sets: High for all five. The MARAC return is the SafeLives Scotland template's own 32 columns (`docs/templates/New-Marac-data-template-Scotland-2025.xlsx`, D-234, RESEARCH 9.2) and the AWI report is the Mental Welfare Commission's tables (`MWC-AWI-Monitoring-Report-2024-25.pdf`, D-236, RESEARCH 9.3), both read on 06 Sep 2026; the CP register field sets are the 2024-25 publication's own (5.16); ASP and MAPPA as above. Only the MARAC's name on the return is seeded (`Clydeshore MARAC`, in Admin).
- Government Security Classification: High. Annex 2 of the MAPPA National Guidance, supplied verbatim (`docs/RESEARCH.md` 5.13). The handling instruction descriptors are the one thing to check against the organisation's own information security policy, because descriptor practice varies; they are editable in Admin.
- MAPPA annual report: the field set is High (Annex 3 Tables 1 to 9, year 1 April to 31 March, D-048), and so is the wording: every title, row and column header is the annex's own, supplied verbatim by the product owner on 03 Sep 2026 from the 2022 guidance and held in the catalogue under `reports.mappaAnnex3` (125 keys, 114 of them flagged `verbatim` in the context file so an editor may correct them against a newer edition and may not paraphrase them). `apps/web/features/reports/mappaAnnex3.ts` holds the shape and cites `docs/RESEARCH.md` 5.12. Nothing about this report is waiting on anyone.

### Product limits by design
- No backend, no real integrations, no authentication. Personas are a switcher; every switch is audited.
- Connector outage, slow response and speed toggles live in module state and reset on reload (the screen says so; kept by decision).
- No global keyboard shortcuts beyond the ones the controls themselves provide (search box, tab lists, rows, dialogs); Help says so rather than listing keys that do not exist.
- Tauri binary not built in this environment (no GTK or WebKitGTK); Electron is the demo build (D-032) and Tauri stays configured; see section 4. The Tauri shell's catalogue-driven menu in `src-tauri/src/lib.rs` (embedded with `include_str!`, overrides from the store plugin) could not be compiled here for the same reason, so the first macOS or Windows build should check it; the Electron shell's equivalent was packaged and smoke-tested with the bundled `resources/en-GB.json`.
- The MAPPA report is counts only, by design, and the unit test asserts that no name reaches its model.
- Exclusions are keyed on the case-role register (D-035). A person who should be excluded but is not linked to the perpetrator by a relationship record, and not named in the referral, must be added to the register by hand; nothing infers it from free text.
- The exclusion register matches hand-recorded names exactly, and that is deliberate (D-084). A similarity check runs beside it: adding a recipient, an invitee, a distribution entry or a pre-meeting request whose name resembles a register entry is blocked behind a confirmation naming the entry, and recording a register entry warns about anyone already on a list who resembles it. Both answers are audited. It is a prompt and not a guarantee: the threshold is seeded at 0.82 and a name below it passes silently, and a party who is neither named in the referral, derivable from a relationship record, nor hand-recorded is excluded by nothing at all.
- Cryptography: `packages/crypto` and everything it drives are real and run on every page. What is represented rather than deployed is listed in `docs/SECURITY.md` section 9 and repeated here so nobody has to look: there is no transport security because there is no transport; escrow shares are held in software, not in a hardware security module; the connector gateway is a structural boundary in the code rather than a separately deployed component; and rotation is on demand because a mockup has no scheduler. Neither a penetration test nor an independent cryptographic review has happened, and a real deployment needs both.
- Metadata is visible to whoever hosts the store, by design and in full: record identifiers, key-holder identifiers, coarse record type, classification, day-bucketed timestamps and the existence of links. The "What the host can see" screen in Admin shows it with real values rather than a sanitised version.
- The blind index supports exact match on reference numbers and dates of birth bucketed to the month, and it reveals equality. Names are never indexed. Encrypted search is not solved here and nothing in the product says it is.
- Removing someone from a case rotates the key and stops future access. It cannot unread what they have already read, and the interface says so at the point of removal.

### Waiting on the product owner
Two items, both the product owner's to supply; nothing else on this list waits on anyone.
- Ayrshire values for the six local clocks: the four asked for on 05 Sep 2026 (ASP inquiry decision, ASP initial case conference, ASP plan review, MARAC research return) and the two added on 07 Sep (the MAPPA level 1 review interval, D-251, and the guardianship renewal lead time, D-252). Seeded values stay until then and all six are marked to verify.
- The MARAC's name as SafeLives holds it, for column A of the return: seeded as `Clydeshore MARAC` in Admin (D-234) and changed there when known.

### What the shooting script needs that the product cannot do

`docs/DEMO.md` was dry-run against the built product by `apps/web/e2e/demo-script.spec.ts`, which walks all ten chapters from their own waypoints. Three things the script asks for happen outside the product, and none of them is a gap the product could close:

- Chapter 4 writes into a simulated council social work system, not a real one. Every adapter is a mock with fictional fixtures and each connector card says so; the capability matrix states each system's true write ceiling, with ViSOR (MAPPS from 2028) stating never and iVPD stating notify only.
- Chapter 9 opens the populated ASP workbook in Excel. The export is real and writes into the published workbook's own cells; the spreadsheet application is not part of this.
- Chapter 6 moves the demo clock. In a deployment that control does not exist, because the clock is the real one.

Everything else the script names, the product does, and the walk asserts it. Where the dry run and the product disagreed, the script was corrected: chapter 5 now shows the MARAC coordinator refused on the linked child protection case, because she holds presence on it, which is a better beat than the one first written.

### Grep points
- `TODO(verify)` marks four configuration points, six times across three files: the Official-Sensitive withheld-from list (`packages/domain/src/schemas/config.ts` and `config/default-config.ts`), the council holiday list (`default-config.ts`), the s52 eligibility wording (`schemas/config.ts`) and the local closure lists for MARAC and AWI (`processes/close.ts`). It appears twice more, in `clocks/rules.ts`, on the two rules added on 07 Sep 2026, saying what each needs confirmed. The six clock rules with `todoVerify: true` are flagged in section 3: the four local ASP and MARAC values, and the two local intervals added on 07 Sep 2026 (D-251, D-252). It was eight until 06 Sep, when the four national minimum dataset submission deadlines were read from the ASP data collection page and became High (RESEARCH 9.1); this line had not been updated with them. `docs/RESEARCH.md` carries the marker four times (5.12, section 7 twice, section 8 once), none against a rule section 3 marks High, which `verification.test.ts` enforces.
- `docs/DECISIONS.md` D-041 to D-046 and D-026 carry the domain and layout choices most likely to be questioned.
- `docs/DECISIONS.md` D-063 to D-072 carry the cryptographic choices, and every one of them is the kind of thing a security reviewer will ask about first.

## 7. Commands

From the repository root (Node 22 or later, pnpm 10):

```
pnpm install                       # once
pnpm dev                           # Next.js dev server on http://localhost:3000
pnpm build               # first, on a fresh clone: pnpm lint reads the compiled export and fails without it (D-203)
pnpm typecheck && pnpm lint && pnpm test
pnpm build                         # contrast check, then the static export to apps/web/out
pnpm --filter @mas/web serve:out   # serve the export on http://localhost:3100 (what Playwright uses)
pnpm e2e                           # Playwright, all phases, writes docs/SCREENSHOTS
pnpm seed:export                   # write the generated dataset to packages/mock-data/dist as JSON
pnpm docs:data-model               # regenerate docs/DATA-MODEL.md from the Zod schemas
pnpm docs:verification-table       # regenerate the section 3 table from the clock rules; a test fails when it is stale
pnpm messages:types                # regenerate the MessageKey union from packages/messages/src/en-GB.json
pnpm messages:check                # ICU syntax, key usage, context coverage and style rules (also part of pnpm lint)
pnpm messages:extract              # list string literals that have not moved to the catalogue
pnpm crypto:inventory              # regenerate docs/CRYPTO-INVENTORY.md from the source
pnpm crypto:inventory:check        # fail on drift between the source and the inventory (also part of pnpm lint)
pnpm contact-sheet                 # regenerate docs/CONTACT-SHEET.md and .html from docs/SCREENSHOTS, and section 5 above
pnpm lint:caps                     # no text-transform: uppercase outside the classification marking (also part of pnpm lint)
pnpm messages:merge <ns>           # fold packages/messages/staging fragments into the catalogue
pnpm demo:check                    # the shooting script still fits its slots (also part of pnpm lint)
pnpm holidays:sync                 # refresh the bank holiday fixture, at maintenance time only; --from <path> derives from a captured response
```

Playwright is pinned to 1.62.1. On macOS or Windows run `pnpm exec playwright install chromium` once in `apps/web` (it downloads the matching Chrome for Testing build); in the build container that download is blocked, so the suite runs against the preinstalled Chromium through `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` (D-038).

Desktop for the demo (Electron, verified here):

```
pnpm desktop:electron:build        # dmg on macOS, nsis and msi on Windows, into apps/desktop-electron/release
pnpm desktop:electron:dev          # loads http://localhost:3000 from pnpm dev
```

Desktop target shell (Tauri), macOS:

```
rustup default stable
pnpm install
pnpm desktop:tauri:build           # apps/desktop-tauri/src-tauri/target/release/bundle/dmg/Person360_0.1.0_*.dmg
```

Tauri on Windows: install the Rust MSVC toolchain and Visual Studio Build Tools, then `pnpm desktop:tauri:build`; the bundle embeds the WebView2 bootstrapper, output under `src-tauri/target/release/bundle/nsis` and `msi`.

Copy: edit `packages/messages/src/en-GB.json` (hot-reloads in `pnpm dev`) or use Admin, Copy and labels, which applies at once, survives reload and is audited; `docs/MESSAGES.md` has the conventions and how a second locale drops in.

Demo states: append `?state=loading|empty|error|restricted|offline|stale` to any screen. Personas: the switcher in the top bar, or `localStorage.setItem('mas.session', JSON.stringify({ userId: 'usr_janet_kerr' }))`. Reset: Settings, or the desktop menu, or the Admin overview.
