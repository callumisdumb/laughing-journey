# Decisions

One line of rationale each. Newest at the bottom. Prefix D-nnn. Domain decisions carry `TODO(verify)` where a statutory value is seeded from research rather than confirmed from a primary source; see `docs/RESEARCH.md`.

## Engineering

- D-001 Operating mode is autonomous: both checkpoints in brief section 13 are removed by the user's instruction; decisions are recorded here instead of asked.
- D-002 TypeScript stays on 5.9.x, not 6 or 7, because the brief specifies 5.x strict and typescript-eslint support for 7 is not yet settled.
- D-003 Playwright is pinned to 1.56.1 because the container ships Chromium build 1194 for that version; the config also accepts `PLAYWRIGHT_CHROMIUM_PATH` for other machines.
- D-004 Routing: one Next.js App Router page (`app/page.tsx` plus `app/[...slug]/page.tsx`) prerenders every known path (static routes plus seed IDs from `generateStaticParams`) and hands navigation to a client-side router built on `history.pushState`. Reason: under `output: 'export'`, Next's own `<Link>` fetches an RSC payload per path and hard-navigates to a 404 for any path not prerendered, which breaks runtime-created referrals and meetings; the client router keeps the same path shape and never fetches. Deep links to seed entities still work because they are prerendered.
- D-005 Seed data is generated at startup by a deterministic generator (seeded PRNG, fixed default seed) rather than shipped as committed JSON; `pnpm seed:export` writes JSON for inspection. Reason: no regeneration step to forget, and `generateStaticParams` uses the same generator at build time.
- D-006 Demo "now" is fixed at 2026-09-02 09:00 Europe/London so clocks and screenshots are reproducible; Settings offers the real clock.
- D-007 Tauri is the primary shell and its config, Rust source and capabilities are written for macOS and Windows; the Linux CI container has no WebKitGTK so the Tauri binary is not built here. Electron is the verified fallback and both shells load the same `apps/web/out`. Neither shell changes the default build target because the brief allows an Electron switch only when Tauri blocks the work, and it does not.
- D-008 Workspace packages export TypeScript source directly and are compiled by Next through `transpilePackages`; no per-package build step.
- D-009 Zod 4 is imported from `zod` (the v4 API is the default export in 4.x); `@hookform/resolvers` 5.x supports it.
- D-010 Tailwind 4 is used CSS-first with `@theme` in `apps/web/styles/tokens.css` and `@custom-variant` for `[data-theme]`; no `tailwind.config.js`.
- D-011 Persistence: store changes are written to `localStorage` under a versioned key in the browser and to `@tauri-apps/plugin-store` in the Tauri shell; "Reset demo data" clears both.
- D-012 Every screen accepts a development-only `?state=` query (loading, empty, error, restricted, offline, stale) so Playwright can capture designed states without mocking internals.

## Design

- D-020 ink-3 darkened to `#6F6759`, risk-high to `#B4400F`, risk-medium to `#8A5306` so every text colour passes 4.5:1 on every paper step; see DESIGN.md section 2.
- D-021 Two agency colours added: regulator (OPG, MWC, Care Inspectorate) and fire and rescue, because scenarios 1, 5 and 7 need them and neither fits an existing agency.
- D-022 No avatars, initials circles or photos anywhere; identity is name, date of birth and reference. Safeguarding and design reasons in DESIGN.md section 9.
- D-023 Pills are reserved for process and stage; agencies use marks (glyph + colour + label).

## Domain

- D-040 The IRD label is configurable per local area; default "Inter-agency Referral Discussion (IRD)" per the 2021 national guidance.
- D-041 Clock rules live in `packages/domain/src/config/clock-rules.ts`; every rule carries `source` and `confidence` from `docs/RESEARCH.md`. Rules marked Verify or Local are `TODO(verify)` in code and are shown in Admin with their confidence.
- D-042 Need-to-know defaults to deny; where the brief's matrices are silent, the more restrictive reading is used (for example a referrer receives an acknowledgement and outcome only, never detail).
- D-043 MARAC perpetrators and their associates, and MAPPA victims, are hard exclusions in the need-to-know rules: no detail level, not even presence, can be granted to them through the UI.
- D-044 MAPPA records are `restricted` classification; non-members see a RestrictedState with break-glass (reason required, 4 hour window, audited). Break-glass is not available for MARAC perpetrator-linked personas at all.
- D-045 Council officer eligibility under ASP s52 is configuration (`config/asp.ts`), seeded as registered social worker, or nurse or occupational therapist with the required post-qualifying training, per the Code of Practice; `TODO(verify)` against the local council rule.
- D-046 An unborn baby is modelled as a Person with `lifeStage: 'unborn'` and `expectedDeliveryDate`, linked to the mother by an `unborn-child-of` relationship, so pre-birth IRDs and CPPMs have a subject without inventing a birth date.
