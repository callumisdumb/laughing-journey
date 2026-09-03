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

## Phase 3

### What was tried and rejected

- Process dashboard frame: the first draft gave each process type its own page layout. Rejected: five layouts meant five places to learn. Every process now shares one frame (reference row, title, subjects, next meeting, stage stepper, clocks, then a two-column body of type-specific panels on the left and participants, views, meetings, sharing and actions on the right). The stepper is the only element that changes shape per type, because the stages differ by statute.
- Stage stepper: tried a horizontal progress bar with percentages. Rejected: statutory stages are not a percentage of anything. The stepper is a list of named stages with the date and the person who moved the process into each one, taken from `stageHistory`, and the ASP stepper hides whichever of support plan and protection plan does not apply.
- Clocks on the dashboard: tried a compact row of numerals only. Rejected: a numeral without its rule is a number without a meaning. Each clock carries the rule label, the trigger, the due date, and where the rule is Local or Verify the confidence and a TODO(verify) marker, the same object as in Admin.
- Views panel: tried tucking the person's views into the participants column as a quote. Rejected: the brief makes the person's views prominent. The views panel sits at the top of the right column on every dashboard, with the advocate, interpreter or carer who recorded them named, and an empty state that says the views have not been sought rather than hiding the panel.
- MARAC perpetrator exclusion: tried an "excluded" pill on the participants list. Rejected as too quiet. The MARAC panel carries a boxed statement naming who must not receive anything about the process, above the DAQ breakdown, and the same exclusion drives the invite and distribution generators in Phase 4.
- MAPPA restricted state: tried a modal that demanded a reason on entry. Rejected: a modal on navigation traps keyboard users and hides the stage the process is at. The restricted state is a page: the process type, stage and lead agency are visible (presence), the reason for restriction is in words, and "Open with a reason" is an ordinary button for Responsible Authority agencies only. The break-glass window is four hours and every read is audited.
- Statutory form dialogs: tried building them as multi-step wizards. Rejected: practitioners fill these forms with the file open beside them, so a wizard hides context. Each form is one dialog with the schema errors inline and the outcome computed live (the DAQ shows the count of yes answers against the threshold; the three-point test shows which limb is unmet).
- LSI workspace: tried one dashboard per resident. Rejected: an LSI is one investigation with strands. The Rowanbank process has six subjects; the LSI panel lists strands per resident with their own status, the provider dissent is recorded by name, and the setting-level events sit in every resident's chronology.

### Scenario data

- Seven of the eight scenarios were authored by parallel agents to a shared contract (`scenarios/<nn-slug>/{index.ts,README.md,scenario.test.ts}`, exports `seedX` and an ids constant, no edits outside the folder). Wiring into `SCENARIOS` and `src/index.ts` was done afterwards in one pass (D-025). The dataset validates against the Zod schema with all eight scenarios and the 58 background households.
- Clocks were checked against the demo now (02 Sep 2026): Marion's initial case conference is due 11 Sep, Ishbel's MHO report has 12 days left, Aiden's review CPPM carries a due override to 14 Sep with its reason, Tomasz's plan review runs from 09 Jul, Derek's Level 2 review is due from 14 Jul and the 06 Oct meeting will close it.

### Screenshot review

- Process list: the reference column wrapped "MARAC-2026-0093" over three lines and "Social work" over two. Both cells are now nowrap; the clock column takes the slack.
- MAPPA dashboard: "Category and level" and "Lead Responsible Authority" sat side by side inside the narrow left column, so the category label wrapped one word per line and the ViSOR reference broke badly. They now stack. The same shot showed the participants list forcing the role text into a narrow second column; members are now name on one line and role, since date and reason below, on every dashboard.
- MARAC dashboard: the DAQ tick glyphs carried aria-label on plain spans, which axe rejects (aria-prohibited-attr). They are role="img" now.
- AWI dashboard: the capacity assessments table scrolls sideways at this width, which axe flagged as a scrollable region without keyboard focus. TableWrap is now a labelled focusable region (D-024).
- Restricted state for a police officer off the distribution list: presence only (type, stage, lead, opened), the reason in words, one primary action. Break-glass then shows the full dashboard with the "access is active" reason in the drawer. Reads correctly.
- Pre-birth CP: the 28 week cap reads as a sentence with the date it falls on, and the "subject is the unborn baby" note links to the mother's record. Good.

## Phase 4

### What was tried and rejected

- Meeting workspace phases: tried a single long page with before, during and after sections stacked. Rejected: a chair running a meeting needs the agenda and attendance without scrolling past the invite list. The three phases are a segmented control (`?phase=`) and the URL is shareable.
- Chair mode: tried a separate route. Rejected: chair mode is the same page with larger type and the rail collapsed (`?mode=chair`), so the chair can drop out of it without losing the agenda position.
- Invite list and distribution list: both are generated from the need-to-know rows for the process stage, and every entry carries the rule id and the reason. Excluded parties (MARAC perpetrators and their associates, MAPPA victims) can never be added, even by hand; the generator says how many exclusions applied.
- Meeting header: the first layout put the action buttons beside the title, which squeezed the title to half the width and wrapped the meta line. The reference row and the buttons now share the top line and the title takes the full width.
- During phase: three equal columns made the agenda unreadable (one word per line). The agenda and the person's views now share the first row at half width each, attendance is a full-width grid of cards beneath, then shared information, decisions and live actions.
- Closing a meeting applies `applyMeetingTransition`: the meeting type completes the clocks it satisfies and starts the ones it triggers (an initial CPPM completes cp.cppm.initial and starts cp.coregroup.first and cp.cppm.review.first). The transitions table is in the domain package with tests, and the After phase shows the clocks as they will stand once the meeting is closed.
- Distribution: "Distribute" creates a SharingRecord per recipient with the detail level, purpose, lawful basis reference and the reason, plus one LawfulBasisRecord for the distribution. The Sharing screen shows the outbound queue and the inbound notifications with the reason each recipient received the item.
- Actions: one screen across processes with mine / my team / all views, grouped by process or agency, completion with evidence (the evidence text is required and the dialog says inspectors read it), escalation for overdue actions.
- "What would X see" preview: the same resolver the product uses, with the rules that matched, the exclusions at the stage and the lawful basis shown, so a coordinator can answer "why can the GP see this" without reading the config.

### Screenshot review

- Meetings list and the Before phase: fine after the header fix. Pre-meeting requests show sent versus returned with the return summary inline.
- During: agenda items on one line each with the Start control; the child's voice block is the most prominent thing on the row, as intended. Chair mode shot: rail collapsed, larger type, agenda enlarged.
- After: the minute steps (draft, chair approves, distribute) disable in order; the toasts from generating the distribution and distributing overlap the list for a moment, which is acceptable.
- Actions: overdue rows carry the date in red plus "18 days overdue" in words. Sharing preview: the reason, matched rule and exclusions read clearly in a two-column layout.

## Phase 5

### What was tried and rejected

- Operations screens were built in parallel by three agents to a shared conventions file (tokens only, CSS modules, the Field and Table primitives, audit every act, no edits outside the assigned folder). Wiring into the route table and the build stayed with one pair of hands, the same way the scenarios were done in Phase 3.
- Connectors: tried a single table of adapters. Rejected: the status word and the "events waiting in the inbox" link are the two things a demo audience looks for, and cards carry them at a glance. The detail area under the cards holds sync history, the mapping preview and the "how this would connect for real" copy, chosen by `?adapter=` so a URL can point at one system. Outage and slow-response toggles are per adapter and audited; the response speed select makes the simulated latency instant for a room that does not want to wait.
- Audit: the ledger deliberately overrides the density variables so it is tighter than any other table; timestamps are the one place JetBrains Mono appears. Break-glass rows carry a glyph, a word and a left rule, never colour alone. Scope follows the role: oversight roles see everything, everyone else sees their own entries, and the lede says which.
- Settings: the live clock switch explains that the demo is frozen at 02 Sep 2026 09:00; the reset sits behind a confirm dialog. Help says plainly that there are no global keyboard shortcuts yet rather than listing keys that do not exist.
- Admin need-to-know: tried a long editable table of rows. Rejected: nobody can see a stage by agency picture in a 31-row table. The matrix (stages down, agencies across, one chip per audience row) with a draft state and a preview that resolves against the draft before saving is what a coordinator can reason about. Hard exclusions (MARAC perpetrator and associates, MAPPA victim) have their remove button disabled with the reason beside it.
- Timescales: editing a statutory amount demotes the rule to local confidence and marks it to verify, so a local override can never masquerade as the national value.
- Admin and Reports close the context drawer column (D-026): configuration has no selection to describe, and the Users and Timescales tables were unreadable at the width the drawer left.

### Screenshot review

- Connectors, light and dark: cards read well; the selected card carries the accent border; "Nothing waiting in the inbox" is a sentence, not a zero.
- Audit: the target column wrapped the reference over three lines and the To date fell onto its own row; the target column now has a minimum width and the filter grid wraps evenly.
- Admin overview, need-to-know matrix, edit dialog, defaults in dark: all fine. Users and Timescales were squeezed by the drawer (columns wrapping one word per line, the Edit button clipped); fixed by the wide chrome above.
- The Playwright "simulate outage" test could not click the switch because the real input was a 1px hidden element behind the drawn track. The input now covers the whole label, which also gives pointer and touch users the full target (44px tall in comfortable density).
- Reports: the MARAC "referrals by agency" bar for Health rendered as ink, not teal. Tailwind had dropped `--color-agency-health` from the built CSS because no stylesheet referenced it (the charts, marks and lanes all pass agency colours as inline `var()`); `@theme static` now emits every token (D-027). The AWI stacked chart's category labels collided ("Financial guardianship" against "Welfare and financial guardianship"); axis labels now wrap to the slot width in both bar charts. The zero-period hint said "1 offenders"; it now pluralises.
- Report print pack: black on white, classification banner, running head and foot with "Page n of N", one section per page, the chart in print ink with its table beneath. The shell chrome is hidden by the print stylesheet, so the agent's own `:global` rule for the same purpose was removed.
