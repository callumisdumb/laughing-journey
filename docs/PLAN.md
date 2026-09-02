# Plan

This plan implements `docs/BRIEF.md`. It is written before any application code. Where it and the brief differ, the brief wins. Where a screen does not fit the design plan in `docs/DESIGN.md`, the screen changes, not the plan.

Operating mode: autonomous. The two checkpoints in brief section 13 are removed. Decisions are recorded in `docs/DECISIONS.md`; research citations in `docs/RESEARCH.md`.

## 1. Phases

| Phase | Deliverable | Done when |
|---|---|---|
| 0 Plan | BRIEF, PLAN, DESIGN (with self-critique), DATA-MODEL outline, DECISIONS, NOTES, RESEARCH, NEED-TO-KNOW, CLAUDE.md | Docs committed, no app code |
| 1 Foundation | Workspace, tooling, tokens, fonts, primitives, glyphs, layout shell, custom router, mock data engine with scenario 4 (Aiden Boyle), sign-in, Home | `pnpm typecheck && pnpm lint && pnpm test` green, Home and sign-in screenshot committed |
| 2 Hero | Person 360, Integrated Chronology (lanes + list), connector inbox, print pack | Screenshots reviewed, self-critique against brief section 8 written to NOTES |
| 3 Processes | ASP, CP, MARAC, MAPPA, AWI dashboards with forms and clocks; all eight scenarios with READMEs | Each scenario demo path walks end to end |
| 4 Meetings and sharing | Meeting workspace (before, during, after, chair mode), Actions, Sharing and notifications, need-to-know admin | Screenshots, axe clean |
| 5 Operations | Connectors admin, Reports, Audit, Admin, Settings and Help | Screenshots, axe clean |
| 6 Ship | Dark mode pass, density pass, accessibility audit, print pass, desktop packaging, DEMO.md, HANDOVER.md | Desktop config builds; docs current |

## 2. Screens and routes

All routes live under one Next.js App Router page that prerenders every known path at build time and hands navigation to a client-side router (see DECISIONS D-004). Paths:

| Route | Screen | Brief |
|---|---|---|
| `/sign-in` | Mock SSO: organisation then persona | 10.1 |
| `/` | Home: clocks, worklist, today | 10.2 |
| `/worklist` | Dense table with saved views and drawer preview | 10.3 |
| `/people` and `/search` | People list and global search results | 10.4 |
| `/people/:id` (+ `?tab=`) | Person 360: overview, chronology, processes, views and voice, documents, sharing and audit | 10.5 |
| `/people/:id/chronology` | Integrated chronology, wide mode | 10.6 |
| `/inbox` | Connector events awaiting review (per agency user) | 7, 10.6 |
| `/processes` and `/processes/:id` | Process list; dashboard rendered by process type (ASP, CP, MARAC, MAPPA, AWI, LSI mode) | 10.7 |
| `/meetings` and `/meetings/:id` | Meeting list; meeting workspace with `?mode=chair` | 10.8 |
| `/actions` | Cross-process action register | 10.9 |
| `/sharing` | Outbound queue, inbound requests, "what would X see" | 10.10 |
| `/connectors` | Adapter health, sync history, mapping preview, outage toggles | 10.11 |
| `/reports` and `/reports/:kind` | ASP, CP register, MARAC return, MAPPA annual, AWI timeliness | 10.12 |
| `/audit` | Audit log with filters and export | 10.13 |
| `/admin/*` | Labels, timescales, forms, need-to-know, agencies, users, markings, defaults, reset | 10.14 |
| `/settings` and `/help` | Theme, density, notifications, glossary, shortcuts, about | 10.15 |

Every screen designs these states: loading skeleton, empty, error, restricted (with break-glass where allowed), offline, stale connector. A shared `ScreenState` wrapper renders them so every feature reaches them the same way, and each screen exposes them through a `?state=` query in development builds so Playwright can capture them.

## 3. Architecture

```
apps/web
  app/                 layout.tsx (fonts, providers, shell), page.tsx, [...slug]/page.tsx
  components/          product-level composites (AppShell, Rail, TopBar, ContextDrawer, ScreenState)
  features/<module>/   screen + panels + hooks + module.css per module
  lib/                 router, store, formatting, permissions client, query client, persistence
  styles/              tokens.css, base.css, layout.css, motion.css, print.css, utilities.css
packages/domain        schemas/, enums, clocks/, need-to-know/, permissions/, config/
packages/ui            tokens (re-exported), primitives/, glyphs/, styles per component
packages/mock-data     generator/, names, geography, scenarios/<n>-<slug>/ (data + README)
packages/connectors    adapter.ts, mock/<id>/ (adapter + fixtures + mapping.md), registry
tooling/               eslint-config, stylelint-config, playwright, contrast (build-time AA check)
apps/desktop-tauri     src-tauri (Rust, capabilities, menu), tauri.conf.json
apps/desktop-electron  main.ts, preload.ts, electron-builder config
```

Data flow: the seed generator runs deterministically at startup (and at build time for `generateStaticParams`) and hydrates a Zustand store. User changes are written to the store and, optionally, persisted (localStorage in the browser, `@tauri-apps/plugin-store` in the shell). Connector calls go through TanStack Query so latency, staleness and errors are visible. Need-to-know resolution and clocks are pure functions in `packages/domain` with full test coverage.

## 4. Data model outline

See `docs/DATA-MODEL.md`. Entities: Organisation, Agency, Team, User (persona), Person, Address, Household, Relationship, Process (discriminated union by type), Stage history, ClockTrigger, ChronologyEvent, ChronologyAnalysis, Meeting, Decision, Action, Plan, RiskAssessment, ViewsRecord, LawfulBasisRecord, SharingRecord, InformationRequest, ConnectorEvent (inbox), AuditEntry, Config (labels, clock rules, need-to-know rows, classification markings, forms and versions).

Type-specific process detail: `AspDetail`, `CpDetail`, `MaracDetail`, `MappaDetail`, `AwiDetail`. Adding a process type means adding a detail schema, a need-to-know file, a clock rule set, labels, and a feature module.

## 5. Design plan

See `docs/DESIGN.md`. Summary: warm paper surfaces, warm ink, heather accent, Atkinson Hyperlegible for UI, Bricolage Grotesque for display and clock numerals, hairline rules instead of card shadows, a permanent right-hand context drawer for who-knows-what, agency glyph plus colour plus label everywhere, facts and analysis in separate lanes.

## 6. Mock data plan

- Deterministic generator with a seeded PRNG (mulberry32), default seed `clydeshore-2026`, override via `NEXT_PUBLIC_SEED`.
- Scenario data is authored by hand in `packages/mock-data/src/scenarios/` and merged over the generated bulk. Scenarios are stable regardless of seed.
- Volumes: ~180 people, ~60 households, ~14 active processes, ~1,400 events, ~40 meetings, ~220 actions, ~90 sharing records, audit trail, personas.
- Every record carries `synthetic: true`.
- "Now" for the demo is a fixed clock (`2026-09-02T09:00:00 Europe/London`) so clocks and screenshots are reproducible; Settings can switch to the real clock.

## 7. Testing plan

- Vitest: schemas (parse the whole seed), clocks (100 percent), need-to-know resolution (100 percent), permissions, formatting, pattern lenses, connectors (latency and outage simulation), router.
- Playwright: one spec per screen; loads under the default persona, waits for data, runs axe, screenshots light and dark in comfortable and compact to `docs/SCREENSHOTS/<phase>/`. Smoke flows follow each scenario README demo path.
- Build-time contrast check in `tooling/contrast` reads `tokens.css` and fails on any AA failure.

## 8. Order of work inside each phase

1. Schemas and seed data for the feature.
2. Pure logic and tests.
3. Screen skeleton with all states reachable.
4. Real content and interactions.
5. CSS module pass (identity, states, density, dark).
6. Playwright spec, screenshots, review, fix.
7. NOTES and DECISIONS updates, commit.

## 9. Risks and mitigations

- Static export and runtime-created IDs: solved by the client router (D-004).
- Tauri cannot be built in the Linux CI container (no WebKitGTK): the shell is written and configured for macOS and Windows; Electron is the verified fallback. Recorded in DECISIONS.
- Volume of scope: features share one process frame and one meeting workspace so each process type adds panels, not screens.
- Design drift across many screens: every screen uses primitives from `packages/ui` and the layout tokens; NOTES logs the review of each screenshot.
