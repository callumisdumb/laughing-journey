# Notes

Running log of what was tried visually, what was rejected and why. Newest at the bottom. Future passes read this before changing anything.

## Phase 0

- Wrote the design plan before code. First sketch of Home used three KPI tiles; rejected as generic (see DESIGN.md section 9). Replaced by typographic clocks.
- Considered a soft drop shadow on panels to lift them off the cream. Rejected: on paper-1 over paper-0 the shadow reads as grey smudge and the product starts looking like a marketing card grid. Hairline rules and paper steps do the job.
- Considered Beam's near-black chocolate `#2e1616` as the ink. Rejected: it pulls red and fights the risk colours. Our ink `#22201B` is a warm olive-black that sits neutrally next to red, amber and green.
- Considered using the agency colour as the left border of chronology rows (a common pattern). Rejected in favour of glyph + colour + label inside the agency cell, because a coloured border alone is colour-only meaning and looks like a Kanban.
- Contrast arithmetic on the brief's starting tokens showed ink-3, risk-high and risk-medium failing on paper-2. Adjusted before writing any CSS so the checker is green from the first build.
