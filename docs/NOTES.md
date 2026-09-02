# Notes

Running log of what was tried visually, what was rejected and why. Newest at the bottom. Future passes read this before changing anything.

## Phase 0

- Wrote the design plan before code. First sketch of Home used three KPI tiles; rejected as generic (see DESIGN.md section 9). Replaced by typographic clocks.
- Considered a soft drop shadow on panels to lift them off the cream. Rejected: on paper-1 over paper-0 the shadow reads as grey smudge and the product starts looking like a marketing card grid. Hairline rules and paper steps do the job.
- Considered Beam's near-black chocolate `#2e1616` as the ink. Rejected: it pulls red and fights the risk colours. Our ink `#22201B` is a warm olive-black that sits neutrally next to red, amber and green.
- Considered using the agency colour as the left border of chronology rows (a common pattern). Rejected in favour of glyph + colour + label inside the agency cell, because a coloured border alone is colour-only meaning and looks like a Kanban.
- Contrast arithmetic on the brief's starting tokens showed ink-3, risk-high and risk-medium failing on paper-2. Adjusted before writing any CSS so the checker is green from the first build.

## Phase 1

- First screenshots at 1280 by 720 (the Playwright device preset overrode the 1440 by 900 viewport). The top bar search collapsed to 130px because a flex spacer competed with it. Fixed both: device preset spread first, spacer removed, search grows with a 160px minimum.
- The clocks chip read "0 clocks due" for Janet, whose only clock is 12 days out. Changed the copy to "No clocks due this week" so zero reads as reassurance, not an error.
- Sign-in: the split composition (warm paper-2 intro on the left, paper-0 picker on the right) works; the headline in Bricolage at 3rem with width 90 is the only large display type in the product, as the brief asks. Considered a full-bleed photograph or illustration. Rejected: the product has no imagery language and a stock image would make it look like a marketing site.
- Home: the typographic clock (numeral, unit, label, trigger) reads at a glance and the amber "due soon" flag carries the meaning without relying on colour. Considered putting the clocks in a card grid. Rejected as the KPI-tile pattern called out in DESIGN.md section 9.
- Dark theme: first pass looks intentional rather than inverted: paper steps are visible, the amber numeral and the heather rail highlight both hold contrast. No changes.
- Compact density on Home is subtle (row and panel padding only). It will matter on the worklist and chronology tables; revisit in Phase 2.
- The designed states (loading, empty, error, offline) were not reachable in the production export because the `?state=` override was gated on NODE_ENV. Ungated it: the mockup is always a demo.
- Keyboard walk: rail, search, clocks chip, notifications, persona switcher, worklist rows and the drawer toggle are all reachable in order with a visible heather focus ring. Persona switcher is a native dialog so Escape and focus trapping come free.
