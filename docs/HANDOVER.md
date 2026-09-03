# Handover

What was built, what was decided, what was verified, and what is left. Read with `docs/BRIEF.md` (the request), `docs/PLAN.md` (the shape), `docs/DESIGN.md` (the look), `docs/DECISIONS.md` (the why), `docs/NOTES.md` (the phase logs), `docs/RESEARCH.md` (the sources) and `docs/DEMO.md` (the ten minute script).

Everything in the dataset is fictional. Postcodes are in the Q, V and X ranges, CHI numbers are synthetic, and every person, address, organisation and record was invented for this mockup.

## 1. What is here

| Area | Where | State |
|---|---|---|
| Domain model, clocks, need-to-know, permissions, forms | `packages/domain` | Zod schemas are the source of truth; `docs/DATA-MODEL.md` is generated from them. Unit tests cover clocks, transitions, resolver, permissions, lenses and forms. |
| Design system | `packages/ui`, `apps/web/styles/tokens.css`, `docs/DESIGN.md` | Warm paper, heather accent, Atkinson Hyperlegible, Bricolage Grotesque, JetBrains Mono for audit only. Light and dark, comfortable and compact. Contrast is checked by a script over every text and control pairing. |
| Synthetic data | `packages/mock-data` | Deterministic generator (seed `clydeshore-2026`, demo now 02 Sep 2026 09:00), eight worked scenarios under `src/scenarios`, 58 background households, audit trail. |
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
- Facts and analysis are separate records; a fact that reads as opinion is rejected by the schema and analysis must cite a fact (D-020b).

### Design
- No avatars or initials circles; identity is name, date of birth and reference (D-022). Pills are for process and stage only; agencies use marks with a glyph, a colour and a label (D-023).
- Two agency colours were added for regulators and fire and rescue (D-021), and three text colours were darkened to pass 4.5:1 on every paper step (D-020).
- Wide tables are labelled focusable regions so keyboards can scroll them (D-024).

### Engineering
- Static export plus a `pushState` router that prerenders every known path (D-004); the dataset is generated at start-up from a seeded PRNG, not committed JSON (D-005).
- TypeScript 5.9, ESLint 9.39, Playwright 1.56, TanStack Table 8.21 are pinned for the reasons in D-002, D-003, D-013 and D-014.
- Every screen accepts `?state=` for designed states (D-012). Telemetry is off at the build level (D-018).
- Tauri is primary; the Linux build container has no GTK or WebKitGTK, so the Tauri binary is not built here and Electron is the verified packaging path (D-007). See section 4.

## 3. Verification table

Every clock rule in `packages/domain/src/clocks/rules.ts` with its seeded value, confidence and source. Sources and dates accessed are in `docs/RESEARCH.md` section 3. Local and Verify rules are editable in Admin, Timescales.

| Rule id | Process | Trigger | Seeded value | Confidence | Source | Flag |
|---|---|---|---|---|---|---|
| cp.cppm.initial | cp | Child protection procedures initiated (IRD) | 28 calendar-days | high | National Guidance for Child Protection in Scotland 2021 (updated 2023), Part 3 (Within 28 calendar days of the concern being raised, unless the IRD decides a CPPM is not required) |  |
| cp.coregroup.first | cp | Initial CPPM held | 15 working-days | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Within 15 working days of the CPPM) |  |
| cp.cppm.review.first | cp | Initial CPPM held | 6 months | high | National Guidance for Child Protection in Scotland 2021, Appendix D (Within 6 months of the initial CPPM. Some areas hold the first review at 3 months (local practice)) |  |
| cp.cppm.review.subsequent | cp | Review CPPM held | 6 months | high | National Guidance for Child Protection in Scotland 2021, Appendix D (At least every 6 months, or earlier on significant change) |  |
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
| awi.interim.warning | awi | Interim order granted | 3 months | high | Adults with Incapacity (Scotland) Act 2000 s57 as amended by ASP Act 2007 s60 (Interim orders run for 3 months by default and cannot exceed 6 months in total. The Expert Working Group (2025 to 2026) has raised concerns about prolonged interim orders) |  |
| awi.interim.maximum | awi | Interim order granted | 6 months | high | Adults with Incapacity (Scotland) Act 2000 s57 as amended (Total interim period cannot exceed 6 months) |  |

Other configuration marked to verify: the Scottish bank holiday list used by working-day clocks (`default-config.ts`), the ASP s52 council officer eligibility wording, and the field sets of the inspection reports (see the Reports screens and `docs/RESEARCH.md` section 5).

## 4. Desktop packaging

Both shells load the same static export from `apps/web/out`, expose the same native menu (About, Reset demo data, Toggle theme, Zoom in, Zoom out, Actual size) and send the same `mas-menu` actions, which `apps/web/lib/desktop.ts` handles. No shell has network, filesystem or shell permissions.

| Shell | Verified here | Result | What is left |
|---|---|---|---|
| Tauri 2 (primary) | `cargo check` in `apps/desktop-tauri/src-tauri` | Dependency resolution and `Cargo.lock` succeed; compilation stops at the missing `gdk-3.0` system library because the Linux container has no GTK or WebKitGTK. | Build on macOS or Windows with the commands in section 7. The Rust code, `tauri.conf.json`, capabilities and icons are complete; expect the first build to take a few minutes while crates compile. |
| Electron 44 (fallback) | `tsc`, `electron-builder --dir --linux` | The main and preload scripts compile, the Electron binary downloads through the proxy, and `electron-builder` produces `apps/desktop-electron/release/linux-unpacked` (about 300 MB) with the web export under `resources/web/out`. | Run the macOS and Windows targets on those platforms; the config already lists dmg, nsis and msi. |

Brief section 2 requires no runtime network. Both shells satisfy it: the web app never fetches, fonts are bundled, and the Tauri capability file grants no network permission.

## 5. Screenshot index

PLACEHOLDER_SCREENSHOTS

## 6. Known gaps and TODO(verify)

Everything marked here is either configuration seeded from research rather than a primary source, or a deliberate limit of a mockup with no backend.

### Statutory and local values to verify (also in `docs/RESEARCH.md` and Admin, Timescales)
- `asp.inquiry.decision` (5 working days), `asp.caseconference.initial` (21 calendar days), `asp.plan.review` (3 months) and `marac.research.return` (5 working days): local values; confirm against the Clydeshore equivalent's own procedures.
- `cp.cppm.review.first`: seeded at the national 6 months with a note that some areas hold the first review at 3 months; the Aiden Boyle scenario carries a 3 month local override with its reason.
- `awi.interim.warning`: the 6 month statutory limit is High confidence; the Expert Working Group citation for the warning is Verify.
- Scottish bank holidays used by working-day clocks (`bankHolidays` in `default-config.ts`): confirm against the published list each year.
- ASP s52 council officer eligibility wording (`aspCouncilOfficerEligibility`): confirm against the local rule.
- Report field sets (ASP biennial, CP register, MARAC SafeLives return, MAPPA annual, AWI timeliness): the figures are computed from the dataset, but the column sets follow search extracts of the current templates because the source sites were unreachable through the session proxy. Each report says "Field set to verify against the current template" in its meta line; sources are in `docs/RESEARCH.md` section 5.

### Product limits by design
- No backend, no real integrations, no authentication. Personas are a switcher; every switch is audited.
- Connector outage, slow response and speed toggles live in module state and reset on reload (the screen says so).
- Admin can save the default theme and density (`config.defaults`) but the appearance store does not read them yet; the Defaults screen says they apply to new sign-ins. Small follow-up: read `config.defaults` in `useAppearance.hydrate` when no local preference exists.
- No global keyboard shortcuts beyond the ones the controls themselves provide (search box, tab lists, rows, dialogs); Help says so rather than listing keys that do not exist.
- Tauri binary not built in this environment (no GTK or WebKitGTK); see section 4. Electron packaging verified on Linux only.
- Print packs exist for the chronology and for every report; meeting minutes and case conference packs print through the browser's print of the screen, without a dedicated pack.
- The MAPPA report is counts only, by design, and the unit test asserts that no name reaches its model.

### Grep points
- `TODO(verify)` in code marks the two configuration points above; every clock rule with `todoVerify: true` is listed in section 3.
- `docs/DECISIONS.md` D-041 to D-046 and D-026 carry the domain and layout choices most likely to be questioned.

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
```

Playwright uses the preinstalled Chromium in this container; on another machine either run `pnpm exec playwright install chromium` in `apps/web` or set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium binary.

Desktop, macOS (Tauri, primary):

```
rustup default stable
pnpm install
pnpm desktop:tauri:build           # apps/desktop-tauri/src-tauri/target/release/bundle/dmg/Platform_0.1.0_*.dmg
```

Desktop, Windows (Tauri): install the Rust MSVC toolchain and Visual Studio Build Tools, then `pnpm desktop:tauri:build`; the bundle embeds the WebView2 bootstrapper, output under `src-tauri/target/release/bundle/nsis` and `msi`.

Desktop, either platform (Electron fallback):

```
pnpm desktop:electron:build        # dmg on macOS, nsis and msi on Windows, into apps/desktop-electron/release
pnpm desktop:electron:dev          # loads http://localhost:3000 from pnpm dev
```

Demo states: append `?state=loading|empty|error|restricted|offline|stale` to any screen. Personas: the switcher in the top bar, or `localStorage.setItem('mas.session', JSON.stringify({ userId: 'usr_janet_kerr' }))`. Reset: Settings, or the desktop menu, or the Admin overview.
