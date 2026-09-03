# Person360

Person360: multi-agency public protection for Scotland, a high-fidelity clickable desktop mockup with no backend. The product name lives in the message catalogue as `product.name`, so a rebrand is one edit. The UI chrome pairs it with a lantern glyph until a mark is designed. The hero screen is the Person record, deliberately not named after the product (D-057).

Read `docs/BRIEF.md` first. It is the single source of truth. Then `docs/PLAN.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `docs/NOTES.md` and `docs/RESEARCH.md`.

## Stack

- pnpm workspaces, Node 22 LTS.
- `apps/web`: Next.js 16 App Router, `output: 'export'`, React 19, TypeScript 5 strict, Tailwind CSS 4 (CSS-first `@theme`), CSS Modules for every component with structure or state.
- `apps/desktop-tauri`: Tauri 2 shell (primary). `apps/desktop-electron`: thin Electron shell loading the same export.
- `packages/domain`: Zod schemas (source of truth), enums, statutory clocks, need-to-know rules, permissions.
- `packages/ui`: design tokens, primitives, glyphs, component CSS.
- `packages/mock-data`: deterministic seed generator, eight worked scenarios with READMEs.
- `packages/connectors`: `ConnectorAdapter` interface and mock adapters with `mapping.md` per system.
- `tooling/`: shared ESLint and Stylelint configs, Playwright config, contrast checker.
- State: Zustand (UI and session), TanStack Query (mock connector calls), TanStack Table and Virtual. Forms: react-hook-form + Zod. Dates: date-fns + date-fns-tz, Europe/London.
- Tests: Vitest, Testing Library, Playwright with axe-core. `pnpm typecheck && pnpm lint && pnpm test` must pass before every commit.

## Non-negotiables (brief section 2)

1. Fictional data only. Postcodes start with Q, V or X. CHI numbers are generated and tagged `synthetic`.
2. No real integrations, no network calls at runtime, no telemetry, no external fonts or CDNs. Fully offline.
3. British English and Scottish terminology. Dates `dd Mon yyyy` in UI, ISO 8601 in data, 24-hour clock, Europe/London.
4. No em dashes anywhere: not in UI copy, code comments, docs or commit messages.
5. WCAG 2.2 AA throughout: visible focus, keyboard-complete, 4.5:1 text, 3:1 components, never colour alone, reduced motion respected, labelled fields, live regions, 44px primary targets, 400 percent zoom reflow.
6. Custom CSS throughout. Tailwind for tokens and spacing utilities only. Every structured component has its own `.module.css` with `data-state` driven states.
7. TypeScript strict, Zod schemas as the source of truth, Vitest and Playwright.
8. Facts and analysis are separate objects. Chronology events are facts; analysis notes link to them.
9. Need-to-know is first-class. Every share carries purpose, lawful basis, proportionality note and author. Restricted reads are audited.
10. The person is present in their own record: structured, dated views and voice, shown prominently.

## Definition of done (brief section 12)

A screen is done when all states are designed and reachable; it works keyboard-only; axe reports no violations; light and dark both look intentional; comfortable and compact both work; its CSS module carries its identity; its screenshot is committed under `docs/SCREENSHOTS/`; copy has been read aloud and simplified; the drawer shows correct need-to-know and lawful basis for the selection; the scenario demo path passes.

The mockup is done when every screen in brief section 10 exists, all eight scenarios walk end to end, the desktop build runs offline, `docs/` is current, and `docs/DEMO.md` exists.

## Working rules

- Decide, record in `docs/DECISIONS.md`, keep going. Do not ask questions.
- Uncertain statutory detail: implement as configuration, seed the best value, mark `TODO(verify)` in code and in `docs/DECISIONS.md`, cite the research in `docs/RESEARCH.md`.
- Conventional commits, one feature per commit.
- Keep `docs/NOTES.md` as the visual log: what was tried, what was rejected and why.

## Commands

```
pnpm install
pnpm dev                 # Next dev server on http://localhost:3000
pnpm build               # static export to apps/web/out
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                 # Playwright screenshots and axe against the export
pnpm desktop:tauri:dev / pnpm desktop:tauri:build
pnpm desktop:electron:dev / pnpm desktop:electron:build
pnpm seed:export         # write the generated seed to packages/mock-data/dist for inspection
pnpm docs:data-model     # regenerate docs/DATA-MODEL.md from the Zod schemas
```
