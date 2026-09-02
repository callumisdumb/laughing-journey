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

## Phase 2

### What was tried and rejected

- Person 360 header: tried a two-row header with the process badges under the name. Rejected: the badges belong at the right, where the eye goes for "what is happening now", and the name row stays clean. The cover-sheet rule under the header (2px ink) is the only heavy line on the page and it works.
- Network graph: the first pass used 11px labels in a 520-unit viewBox. At the rendered size they were unreadable and the left-hand label clipped. Enlarged the viewBox to 640 by 360, labels to 0.9375rem and pulled the rings inward. No initials circles (D-022); a small filled marker for the subject, paper-2 fill for household members, dashed stroke for an adult of concern.
- Lanes chart: tried colouring the points by significance. Rejected: colour is the agency and only the agency; significance is size (3, 5, 7px radius) and the high-significance glyph inside the point. Dashed heather halos mark lens hits and every other point dims to 35 percent, so a lens reads at a glance without a legend.
- Analysis lane: tried inline "analysis" rows in the event list. Rejected outright: the brief and the Care Inspectorate guide say analysis must never look like a fact. Analysis lives in its own tinted lane as bracketed spans, in its own section under the list, and in the print pack under a separate heading.
- Add event form: one dialog with a radio at the top, "A fact" or "An analysis note", rather than two buttons. The schema enforces the separation: a fact that reads as opinion ("I think", "seems") is rejected with a message that sends the user to an analysis note; an analysis note must link at least one fact.
- Print pack: Chrome does not support `counter(page)` in fixed running elements, so pages are split in JS (18 rows a page) with a header and footer per page carrying the marking, reference, subject and "Page n of m". The classification banner sits above the first page.
- Inbox: laid out as "as received" (raw source fields, in a well) beside "proposed for the chronology" (plain-language title, significance). The human-in-the-loop step is the layout, not a checkbox.

### Screenshot review

- Person 360 at 1440: header, tabs, clocks, graph, voice block and key contacts all fit above the fold; compact density tightens the sheets without losing the hierarchy. Dark theme holds; the voice block rule in heather is the brightest thing on the page in dark, as intended.
- Chronology with two lenses on: the lens panel explains the prompt in words before the picture; spans show as translucent heather bands; the brackets in the analysis lane are readable. Right-edge labels collided in the first shot; labels now flip to end-anchored above the line near the edge.
- People list first shot: the search field grew to 240px tall because the flex class landed on the input. Fixed by wrapping.
- Worklist: the Due column wrapped the date; now nowrap.

### Self-critique against brief section 8

1. Warmth without decoration: yes. Paper steps and hairlines carry the hierarchy; no shadows except the dialog and the typeahead popover, which float.
2. Accent discipline: heather appears only where the product speaks: primary actions, selected states, focus, the analysis lane, the voice block rule, lens halos. Police blue is never confused with it.
3. Colour never alone: every agency has glyph plus label; significance is size plus a word in the list; risk pills carry an icon and a word; lens hits use a dashed halo plus dimming.
4. Density: the compact toggle now bites on the event list (32px rows) and the sheets. The lanes chart has its own compact prop for the Person 360 preview.
5. Type: Bricolage only on the name, page titles, clock numerals and the voice quote. Atkinson everywhere else. JetBrains Mono only on audit timestamps.
6. Motion: the lanes settle on first load (320ms, staggered 30ms per lane) and nothing else moves unless the user acts. Reduced motion zeroes it.
7. Copy: buttons say what happens ("Promote to integrated chronology", "Record lawful basis and promote", "Open with a reason"). Empty states say what to do next.
8. What still looks generic: the People list is a plain filter row over a table. It does its job, but it is the one screen a template could produce. Left as is; the drawer affordance on hover is what makes it ours.
