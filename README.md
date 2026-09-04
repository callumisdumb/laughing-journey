# Person360

Multi-agency public protection for Scotland: a high-fidelity, clickable desktop mockup with no backend.

Person360 puts one person at the centre of every process that touches them. It covers adult support and protection, child protection, MARAC, MAPPA and adults with incapacity, with the statutory clocks, need-to-know rules and inspection returns each of them needs. Every record is synthetic.

The hero screen is the **Person record**, which is deliberately not named after the product: see D-057 in `docs/DECISIONS.md`.

## Start here

| Document | What it holds |
|---|---|
| `docs/BRIEF.md` | The brief. The single source of truth. |
| `docs/HANDOVER.md` | Decisions, verification table, screenshot index, known gaps, commands. |
| `docs/DEMO.md` | The demonstration script. |
| `docs/MESSAGES.md` | The copy catalogue: conventions, editing, override layers, adding a locale. |
| `docs/DECISIONS.md` | Every decision, with one line of rationale. |
| `docs/RESEARCH.md` | Every statutory value and field set, with its source and confidence. |

## Commands

```
pnpm install
pnpm dev                 # Next dev server on http://localhost:3000
pnpm build               # static export to apps/web/out
pnpm build   # first, on a fresh clone: pnpm lint reads the compiled export
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                 # Playwright screenshots and axe against the export
pnpm desktop:electron:build   # the demo build
pnpm desktop:tauri:build      # the target shell (macOS or Windows)
```

The product name lives in the message catalogue as `product.name`, so a rebrand is a single edit.

No runtime network, no telemetry, no external fonts. Fully offline.
