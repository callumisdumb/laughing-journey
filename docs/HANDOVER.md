# Handover

What was built, what was decided, what was verified, and what is left. Read with `docs/BRIEF.md` (the request), `docs/PLAN.md` (the shape), `docs/DESIGN.md` (the look), `docs/DECISIONS.md` (the why), `docs/NOTES.md` (the phase logs), `docs/RESEARCH.md` (the sources), `docs/DEMO.md` (the demo script) and, for the cryptography, `docs/THREAT-MODEL.md`, `docs/SECURITY.md`, `docs/CRYPTO-INVENTORY.md` and `docs/DPIA-NOTES.md` (the architecture, what it does not do, and the mapping to Article 32).

Everything in the dataset is fictional. Postcodes are in the Q, V and X ranges, CHI numbers are synthetic, and every person, address, organisation and record was invented for this mockup.

## 1. What is here

| Area | Where | State |
|---|---|---|
| Domain model, clocks, need-to-know, permissions, forms | `packages/domain` | Zod schemas are the source of truth; `docs/DATA-MODEL.md` is generated from them. Unit tests cover clocks, transitions, resolver, permissions, lenses and forms. |
| Design system | `packages/ui`, `apps/web/styles/tokens.css`, `docs/DESIGN.md` | Warm paper, heather accent, Atkinson Hyperlegible, Bricolage Grotesque, JetBrains Mono for audit only. Light and dark, comfortable and compact. Contrast is checked by a script over every text and control pairing. |
| Synthetic data | `packages/mock-data` | Deterministic generator (seed `clydeshore-2026`, demo now 02 Sep 2026 09:00), eight worked scenarios under `src/scenarios`, 58 background households, audit trail. |
| Copy catalogue | `packages/messages`, `docs/MESSAGES.md` | Every user-visible string in `src/en-GB.json` with `src/en-GB.context.json` beside it; typed keys, ICU MessageFormat, three-layer overrides (bundled, local file, session) edited in Admin, Copy and labels; `pnpm messages:check` in lint. |
| Cryptography | `packages/crypto`, `docs/SECURITY.md`, `docs/THREAT-MODEL.md` | One suite (`v1-x25519-mlkem768-aes256gcm`): AES-256-GCM content, hybrid X25519 with ML-KEM-768 key wrapping, Ed25519 with ML-DSA-65 signatures, Argon2id, Shamir 2 of 5 escrow, a signed audit hash chain. Primitives from @noble only; known-answer vectors from RFC 7748, RFC 8032, RFC 5869, FIPS 180-4 and NIST CAVP; a committed ciphertext fixture that is never regenerated. `docs/CRYPTO-INVENTORY.md` is generated from the source and checked for drift in lint. |
| Connectors | `packages/connectors` | Ten mock adapters with fixtures, mapping tables, simulated latency, outage and degraded toggles, and "how this would connect for real" copy. |
| Web app | `apps/web` | Next.js 16 static export with a client-side router; every screen in brief section 10. |
| Desktop shells | `apps/desktop-tauri`, `apps/desktop-electron` | Tauri 2 is the primary target (config, Rust menu, capabilities); Electron is the verified fallback. Both load `apps/web/out`. |
| Tests | `apps/web/e2e`, package `*.test.ts` | Playwright per phase with axe on every captured screen; Vitest in domain, ui and mock-data. |
| Screenshots | `docs/SCREENSHOTS/<phase>/<screen>-<theme>-<density>.png` | Reviewed at the end of each phase; the index is in section 5. |

## 2. Decisions

The full list with one line of rationale each is in `docs/DECISIONS.md`. The ones a new team should know first:

### Domain
- Need-to-know defaults to deny and the more restrictive reading wins where guidance is silent (D-042). MARAC perpetrators and associates and MAPPA victims are hard exclusions the UI cannot lift (D-043).
- MAPPA records are restricted; non-members see presence only and Responsible Authority agencies can break glass with a reason for four hours, audited (D-044).
- Statutory clocks carry a source and a confidence; Verify and Local rules are `TODO(verify)` in code and marked in the product (D-041). The IRD label and the ASP council officer eligibility are configuration (D-040, D-045).
- An unborn baby is a Person with `lifeStage: 'unborn'` and an expected delivery date (D-046).
- Exclusions are keyed on the case-role register (D-035); the MARAC DAQ and the MAPPA referral ask who else must not receive information and feed it (D-047). The MAPPA annual report is Annex 3 Tables 1 to 9 with the field set High and placeholder wording (D-048).
- Facts and analysis are separate records; a fact that reads as opinion is rejected by the schema and analysis must cite a fact (D-020b).

### Design
- No avatars or initials circles; identity is name, date of birth and reference (D-022). Pills are for process and stage only; agencies use marks with a glyph, a colour and a label (D-023).
- Two agency colours were added for regulators and fire and rescue (D-021), and three text colours were darkened to pass 4.5:1 on every paper step (D-020).
- Wide tables are labelled focusable regions so keyboards can scroll them (D-024). Dates are typed as dd Mon yyyy in a shared field rather than picked from the browser's locale-formatted control (D-049).

### Engineering
- Static export plus a `pushState` router that prerenders every known path (D-004); the dataset is generated at start-up from a seeded PRNG, not committed JSON (D-005).
- TypeScript 5.9, ESLint 9.39, Playwright 1.62.1, TanStack Table 8.21 are pinned for the reasons in D-002, D-003, D-013, D-014 and D-038.
- Every screen accepts `?state=` for designed states (D-012). Telemetry is off at the build level (D-018).
- Electron is the demo build and Tauri stays configured (D-032); the Linux build container has no GTK or WebKitGTK, so the Tauri binary is not built here (D-007). See section 4.

### Security
- The claim is exact and the product never exceeds it: record content is end to end encrypted, the product as a whole is not, and every record is encrypted to exactly the principals the need-to-know rules entitle rather than to one organisational key (D-065). `docs/THREAT-MODEL.md` ranks the adversaries and `docs/SECURITY.md` section 10 is the rule that no screen may claim more.
- Entitlement is a key, not a boolean: the resolver returns a wrapping list, `canSee` was deleted, and a test walks every source file to make sure nothing reintroduces a content gate (D-066).
- Audit is signed and chained rather than encrypted, because it exists to be read by the people it polices; only the free-text detail is encrypted (D-067).
- Escrow is two of five across five organisations, and two holders from the same organisation are refused in code rather than in policy (D-068). Two colluding holders can read anything, which is stated plainly everywhere it matters.
- Primitives come from @noble only, and the build fails on MD5, SHA-1, ECB, DES, RC4, PBKDF2, scrypt, a supplied nonce or the platform pseudo-random source anywhere in the repository (D-063, D-064).

## 3. Verification table

Every clock rule in `packages/domain/src/clocks/rules.ts` with its seeded value, confidence and source. Sources and dates accessed are in `docs/RESEARCH.md` section 3. Local and Verify rules are editable in Admin, Timescales.

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
| asp.plan.review | asp | Protection plan agreed | 3 months | local | Local procedures (South Lanarkshire and Dumfries and Galloway review at 3 months then three monthly) | TODO(verify) |
| marac.research.return | marac | Research request sent | 5 working-days | local | Local MARAC Operating Protocol (SafeLives sets no national deadline) (SafeLives: case list circulated about 8 working days before the meeting; the return window is local) | TODO(verify) |
| marac.flag.expiry | marac | Case heard at MARAC | 12 months | high | SafeLives MARAC practice (Flag on agency records for 12 months from the last referral) |  |
| marac.repeat.window | marac | Case heard at MARAC | 12 months | high | SafeLives MARAC definitions (A repeat is a further referral within 12 months of the last referral) |  |
| mappa.level2.review | mappa | Level 2 meeting held | 12 weeks | high | MAPPA National Guidance 2022 (refreshed 31 March 2022) (Level 2 cases reviewed no less than once every 12 weeks) |  |
| mappa.level3.review | mappa | Level 3 (MAPPP) meeting held | 6 weeks | high | MAPPA National Guidance 2022 (refreshed 31 March 2022) (Level 3 cases reviewed no less than once every 6 weeks) |  |
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

153 screenshots under `docs/SCREENSHOTS/<phase>/<screen>-<theme>-<density>.png`, captured by the Playwright suites at 1440 by 900 (full page where the screen scrolls). Light comfortable is the default; dark and compact variants are listed where captured. Phase 6 holds the dark and compact sweep of every screen. The `classification`, `nmds` and `security` folders are the three rounds added on 03 September 2026 and are captured by their own specs.

### phase-1

| Screen | Variants |
|---|---|
| home | dark comfortable, light comfortable, light compact |
| home-rail-collapsed | light comfortable |
| home-state-empty | light comfortable |
| home-state-error | light comfortable |
| home-state-loading | light comfortable |
| home-state-offline | light comfortable |
| sign-in | light comfortable |

### phase-2

| Screen | Variants |
|---|---|
| chronology | dark comfortable, light comfortable, light compact |
| chronology-add-event-validation | light comfortable |
| chronology-event-selected | light comfortable |
| chronology-lenses | light comfortable |
| chronology-print-pack | light comfortable |
| chronology-state-empty | light comfortable |
| chronology-state-restricted | light comfortable |
| chronology-state-stale | light comfortable |
| inbox | light comfortable |
| inbox-promote | light comfortable |
| people | light comfortable |
| person-record | dark comfortable, light comfortable, light compact |
| person-record-chronology | light comfortable |
| person-record-presence-only | light comfortable |
| person-record-processes | light comfortable |
| person-record-sharing | light comfortable |
| person-record-voice | light comfortable |
| search-results | light comfortable |
| search-typeahead | light comfortable |
| worklist | light comfortable |
| worklist-clocks | light comfortable |

### phase-3

| Screen | Variants |
|---|---|
| home-mho | light comfortable |
| process-asp | light comfortable |
| process-asp-lsi | light comfortable |
| process-asp-support-only | light comfortable |
| process-asp-three-point-form | light comfortable |
| process-awi | light comfortable |
| process-awi-capacity-form | light comfortable |
| process-cp | dark comfortable, light comfortable |
| process-cp-prebirth | light comfortable |
| process-mappa | light comfortable |
| process-mappa-restricted | light comfortable |
| process-marac | light comfortable |
| process-marac-daq-form | light comfortable |
| processes | light comfortable |

### phase-4

| Screen | Variants |
|---|---|
| actions | light comfortable |
| actions-complete | light comfortable |
| actions-team | light compact |
| meeting-after | light comfortable |
| meeting-before | light comfortable |
| meeting-chair | dark comfortable, light comfortable |
| meeting-during | light comfortable |
| meeting-minutes | light comfortable |
| meeting-minutes-print | light comfortable |
| meetings | light comfortable |
| sharing-inbound | light comfortable |
| sharing-outbound | light comfortable |
| sharing-preview | light comfortable |

### phase-5

| Screen | Variants |
|---|---|
| admin | light comfortable |
| admin-copy | light comfortable |
| admin-defaults | dark comfortable, light comfortable |
| admin-need-to-know | light comfortable, light compact |
| admin-need-to-know-edit | light comfortable |
| admin-need-to-know-marac | light comfortable |
| admin-timescales | light comfortable |
| admin-users | light comfortable |
| audit | light comfortable |
| connectors | dark comfortable, light comfortable |
| connectors-outage | light comfortable |
| help-about | light comfortable |
| help-glossary | light comfortable |
| report-asp | light comfortable |
| report-asp-current | light comfortable |
| report-awi | light comfortable |
| report-cp | dark comfortable, light comfortable |
| report-cp-print | light comfortable |
| report-mappa | light comfortable |
| report-mappa-annex3 | light comfortable |
| report-marac | light comfortable, light compact |
| reports | light comfortable |
| settings | light comfortable |

### phase-6

| Screen | Variants |
|---|---|
| actions | dark comfortable, light compact |
| admin-need-to-know | dark comfortable, light compact |
| audit | dark comfortable, light compact |
| chronology | dark comfortable, light compact |
| chronology-print-media | light comfortable |
| connectors | dark comfortable, light compact |
| help | dark comfortable, light compact |
| home | dark comfortable, light compact |
| inbox | dark comfortable, light compact |
| keyboard-focus | light comfortable |
| meeting-during | dark comfortable, light compact |
| meetings | dark comfortable, light compact |
| people | dark comfortable, light compact |
| person-record | dark comfortable, light compact |
| process-asp | dark comfortable, light compact |
| process-awi | dark comfortable, light compact |
| process-cp | dark comfortable, light compact |
| process-cp-1024 | dark compact, light comfortable |
| process-mappa | dark comfortable, light compact |
| process-marac | dark comfortable, light compact |
| processes | dark comfortable, light compact |
| reports | dark comfortable, light compact |
| settings | dark comfortable, light compact |
| sharing | dark comfortable, light compact |
| worklist | dark comfortable, light compact |

### classification

| Screen | Variants |
|---|---|
| admin-markings | dark comfortable, light comfortable |
| classification-dialog | dark comfortable, light comfortable |
| process-marked | dark comfortable, light comfortable |
| report-unmarked | light comfortable |

### nmds

| Screen | Variants |
|---|---|
| nmds-filled | light comfortable |
| nmds-return | light comfortable |

### security

| Screen | Variants |
|---|---|
| server-view | dark comfortable, light comfortable |
| audit-chain | light comfortable |
| statutory-disclosure | light comfortable |
| help-security | light comfortable |

## 6. Known gaps and TODO(verify)

Everything marked here is either configuration seeded from research rather than a primary source, or a deliberate limit of a mockup with no backend.

### Statutory and local values to verify (also in `docs/RESEARCH.md` and Admin, Timescales)
- `asp.inquiry.decision` (5 working days), `asp.caseconference.initial` (21 calendar days), `asp.plan.review` (3 months) and `marac.research.return` (5 working days): local values; confirm against the Clydeshore equivalent's own procedures.
- Every CP clock is High from Appendix D of the 2021 national guidance, read live on 03 Sep 2026 (section 6.4 of `docs/RESEARCH.md`): `cp.cppm.review.first` is the 6 month maximum with no local override anywhere, and the Aiden Boyle review is brought forward by a decision of the meeting, not by a rule.
- `awi.interim.warning`: High. The 3 month default and 6 month total limit are s57 as amended, and the warning cites the Adults with Incapacity Reform Expert Working Group minutes of April 2026 (section 6.5).
- Scottish bank holidays used by working-day clocks: the committed gov.uk feed fixture (`packages/domain/src/config/bank-holidays.json`, Scotland division, 2025 to 2027, including 15 June 2026); refresh with `pnpm holidays:sync`. The council holiday list in `default-config.ts` is fictional and marked to verify.
- ASP s52 council officer eligibility wording (`aspCouncilOfficerEligibility`): seeded from SSI 2008/306; confirm against the local rule.
- ASP: the field sets are now High. All nine were read from the supplied ASP data workbook 2026-27 (`docs/templates/`), which corrected nine of them; see `docs/RESEARCH.md` 5.14 and D-061. The four NMDS submission deadlines (`asp.nmds.q1` to `asp.nmds.q4`) are the only ASP item left to verify: the guidance says the current dates live on the ASP data collection web page rather than in the workbook, so they are seeded from the product owner and marked `confidence: 'verify'`.
- Report field sets for the CP register, MARAC SafeLives return and AWI timeliness reports: the figures are computed from the dataset, but the column sets follow search extracts of the current templates because the source sites were unreachable through the session proxy. Each of those three says "Field set to verify against the current template" in its meta line; sources are in `docs/RESEARCH.md` section 5.
- Government Security Classification: High. Annex 2 of the MAPPA National Guidance, supplied verbatim (`docs/RESEARCH.md` 5.13). The handling instruction descriptors are the one thing to check against the organisation's own information security policy, because descriptor practice varies; they are editable in Admin.
- MAPPA annual report: the field set is High (Annex 3 Tables 1 to 9, year 1 April to 31 March, D-048). Only the label wording is a placeholder, in `apps/web/features/reports/mappaAnnex3.ts`, until the supplied Annex 3 text is pasted in (section 6.7).

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
- Ayrshire values for the four local clocks (ASP inquiry decision, ASP initial case conference, ASP plan review, MARAC research return): seeded values stay until then and are marked to verify.
- Official report templates for the CP register, MARAC, MAPPA and AWI returns, in `docs/templates/` (see the README there); each is reconciled against its template when it arrives. The three ASP documents arrived on 03 Sep 2026 and are reconciled.
- The supplied Annex 3 table text for the MAPPA annual report, to paste over the placeholder labels in `apps/web/features/reports/mappaAnnex3.ts` (the field set and the figures behind the nine tables are complete; only the wording waits).

### Grep points
- `TODO(verify)` in code marks the two configuration points above; every clock rule with `todoVerify: true` is listed in section 3.
- `docs/DECISIONS.md` D-041 to D-046 and D-026 carry the domain and layout choices most likely to be questioned.
- `docs/DECISIONS.md` D-063 to D-072 carry the cryptographic choices, and every one of them is the kind of thing a security reviewer will ask about first.

## 7. Commands

From the repository root (Node 22 or later, pnpm 10):

```
pnpm install                       # once
pnpm dev                           # Next.js dev server on http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
pnpm build                         # contrast check, then the static export to apps/web/out
pnpm --filter @mas/web serve:out   # serve the export on http://localhost:3100 (what Playwright uses)
pnpm e2e                           # Playwright, all phases, writes docs/SCREENSHOTS
pnpm seed:export                   # write the generated dataset to packages/mock-data/dist as JSON
pnpm docs:data-model               # regenerate docs/DATA-MODEL.md from the Zod schemas
pnpm messages:types                # regenerate the MessageKey union from packages/messages/src/en-GB.json
pnpm messages:check                # ICU syntax, key usage, context coverage and style rules (also part of pnpm lint)
pnpm messages:extract              # list string literals that have not moved to the catalogue
pnpm crypto:inventory              # regenerate docs/CRYPTO-INVENTORY.md from the source
pnpm crypto:inventory:check        # fail on drift between the source and the inventory (also part of pnpm lint)
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
