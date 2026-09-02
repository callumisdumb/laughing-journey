# Design

This is the design plan for the product. It is written before the code and refined by screenshots. The direction comes from brief section 8: warmth from Beam, density from the job, and a palette that leaves red, amber, green and blue free to mean risk and police.

## 1. Principles

1. **One picture.** The integrated chronology is the hero. Every screen offers a way into it, and the chronology offers a way back to the person and the process.
2. **Colour never speaks alone.** Agency colour is always paired with the agency glyph and a text label. Risk colour is always paired with an icon and a word. The product must read correctly in greyscale.
3. **Facts on one side, judgement on the other.** Chronology events are facts. Analysis lives in its own lane with its own visual grammar (a bracket, a name, a date). Nothing that is an opinion looks like a fact.
4. **Who knows is one click away.** The context drawer is always present on the right. It shows who is involved, what they can see, under what lawful basis, and who has looked. This is the product's signature.
5. **Clocks are the loudest thing.** Statutory countdowns are set in large display numerals with plain labels. Nothing else on a screen is allowed to be louder than an overdue clock.
6. **Warm, not soft.** Cream paper, warm ink, hairline rules. No shadows on cards, no hover lifts, no gradients, no illustration. The warmth comes from colour temperature and type, not decoration.
7. **The person's own words are set apart.** Views and voice use a distinct treatment: a hanging rule in heather, the person's name, the date, how the view was sought. They sit near the top of every process, never at the bottom.
8. **Say what happens.** Buttons name the outcome. Empty states name the next step. Errors say what went wrong and how to fix it.

## 2. Base colours

Four named base colours plus two semantic families. Values are the light theme; dark theme values follow.

| Name | Role | Light | Dark |
|---|---|---|---|
| **Paper** | Surfaces. Three steps: paper-0 page, paper-1 panels, paper-2 wells and table headers. Lines line-1 hairline, line-2 strong. | `#FCFAF5` `#F6F2EA` `#EEE8DC`; lines `#E3DBCC` `#CFC5B2` | Peat: `#1A1815` `#221F1B` `#2C2823`; lines `#3A352E` `#4C463D` |
| **Ink** | Text. ink-1 body and headings, ink-2 secondary, ink-3 tertiary and placeholders. | `#22201B` `#514B41` `#6F6759` | `#F1ECE2` `#CFC7B8` `#A69D8C` |
| **Heather** | The one accent: primary actions, links, focus rings, selected states, the analysis bracket, the wordmark. | `#4F3D8B` accent-1, `#6B58A8` accent-2, `#EEE9F7` soft | `#B4A6E4` accent-1, `#C9BFF0` accent-2, `#2A2440` soft |
| **Peat** | The dark theme's paper. Listed above. Never used in light theme except the classification banner on print packs. | | |
| Risk family | critical, high, medium, low, unknown. Always with icon and word. | `#9E1B1B` `#B4400F` `#8A5306` `#2F6F4F` `#6F6759` | `#F0A3A3` `#F3B08C` `#E5C36B` `#8FD0AC` `#A69D8C` |
| Agency family | Categorical, each with a glyph. | police `#1F3A93`, social work `#3F6B3A`, health `#0B7A80`, education `#8A6D00`, housing `#8C4A2F`, third sector `#7A2E6E`, SPS `#5A6472`, SCRA `#5B6B1F`, court `#3B3B6B`, regulator `#565B8A`, fire and rescue `#7A3B1F` | lifted variants in tokens.css |

Changes from the brief's starting tokens, with reasons:
- ink-3 darkened from `#7E7668` to `#6F6759`: the original fails 4.5:1 on paper-2 (4.0:1). The new value passes on every paper step.
- risk-high moved from `#C2410C` to `#B4400F` and risk-medium from `#A16207` to `#8A5306`: both originals fail 4.5:1 as text on paper-2. The new values pass while keeping the hue.
- Added `regulator` (OPG, MWC, Care Inspectorate) and `fire-rescue` agency colours because scenarios 1, 5 and 7 need them.

The build-time contrast check in `tooling/contrast` reads `tokens.css`, tests every text colour against every paper step in both themes, and fails the build below 4.5:1 for text and 3:0 for component lines and glyph fills.

## 3. Type

| Role | Face | Sizes | Where |
|---|---|---|---|
| Display | Bricolage Grotesque variable, weight 600, width 100 (75 for numerals over 2.25rem) | 1.375, 1.75, 2.25, 3 rem, line height 1.15 | Page titles, person name in the 360 header, clock numerals, sign-in |
| UI and body | Atkinson Hyperlegible 400 and 700 | 0.75, 0.8125, 0.875 (base), 1, 1.125 rem, line height 1.45 | Everything else |
| Reference | JetBrains Mono 400 | 0.75, 0.8125 rem | Audit log reference numbers and timestamps only |

Rules: sentence case everywhere; no all-caps; no letter-spacing tricks; prose panels max 70ch; tabular numerals (`font-variant-numeric: tabular-nums`) in tables, clocks and dates.

## 4. Layout

```
+------+----------------------------------------------------------+----------------+
| rail | top bar: search ............ [clocks 3] [bell] [persona]  | context drawer |
|      +----------------------------------------------------------+                |
| home |                                                          | Who is involved|
| work | content: 12 column grid, max 1200 (wide for chronology)  | Need to know   |
| ppl  |                                                          | Lawful basis   |
| mtg  |                                                          | Audit          |
| act  |                                                          |                |
| shr  |                                                          |                |
| rpt  |                                                          |                |
| con  |                                                          |                |
| adm  |                                                          |                |
|      |                                                          |                |
| [agy]|                                                          |                |
| [me] |                                                          |                |
+------+----------------------------------------------------------+----------------+
```

- Rail: 72px collapsed, 248px expanded, persisted. Bottom of the rail carries the user's agency glyph and persona.
- Top bar: 56px. Global search on the left, a clocks chip (count of clocks due within 7 days, colour by worst band), notifications, persona switcher marked "Demo".
- Content: 12-column grid, 24px gutters, max 1200px, `data-width="wide"` for the chronology removes the max.
- Context drawer: 360px, collapsible to a 40px tab. Sections stack: Who is involved, Need to know, Lawful basis, Audit. The drawer reacts to selection: a chronology event, a person, a share, an action.
- Density: `data-density="comfortable|compact"` on the root scales row heights (40 to 32), panel padding (20 to 12) and the base size stays 0.875rem. Density is CSS variables only.
- Minimum viewport 1024px; the drawer becomes an overlay below 1280px.

## 5. Components (packages/ui)

Button (primary, secondary, quiet, danger; sizes md 40px and lg 44px), IconButton, Pill (process, stage, status), Badge (count), Tag (agency mark: glyph + colour + label), Card as `Sheet` (paper-1 with hairline rule, no shadow), Drawer, Dialog, Tabs, Table (TanStack), Field controls (Input, Select, Textarea, Checkbox, Radio, Switch, DateField), Toast, Skeleton, EmptyState, RestrictedState (with break-glass), OfflineState, StaleState, ClockNumeral, AgencyMark, ProcessMark, RiskBand, Stepper, Timeline primitives (Lane, Axis, Marker, Brush), VoiceBlock (views and voice), FactRow and AnalysisNote (chronology grammar), ClassificationBanner.

Every one has a `.module.css` and `data-state` attributes. No component depends on Tailwind for its identity.

## 6. Hero screen wireframes

### 6.1 Person 360

```
+----------------------------------------------------------------------+ drawer
| Aiden Boyle                                  [CP: registered] [next] | Who is
| Also Aidy   7 years, born 14 Mar 2019   12 Brae Wynd, Braeside (3 moves)   involved
| Needs: none recorded    Alerts: [!] Lone visits not advised            |
| ---------------------------------------------------------------------- | Social
| Overview | Chronology | Processes | Views and voice | Documents | Sharing| work: ..
+----------------------------------------------------------------------+ Police:..
| Clocks                    | Household and network      | Views        | Health:..
| 12  days to review CPPM   | [graph: mother, father,    | "I like      | Education:
|     due 14 Sep 2026       |  gran, sibling]            |  school and  |
| 3   actions overdue       | key contacts by agency     |  my gran"    | Need to
|                           | with last contact          |  Aiden, 20 Aug| know:
+---------------------------+----------------------------+--------------+ this stage
| Chronology (last 90 days)  ...lanes preview, click to open wide...     |
+----------------------------------------------------------------------+
```

The header is a cover sheet: name in display type, the essential facts in one line, alerts as pills with icons, process badges on the right with stage and next date. No avatar, no photo. Tabs are text with a heather underline.

### 6.2 Integrated chronology (wide)

```
+------------------------------------------------------------------------------+ drawer
| Aiden Boyle: integrated chronology      [Single agency|Integrated|CPPM pack]  | Event
| Filters: [agency] [type] [significance] [process] [window] [source] [vis]     | detail
| Lenses: [escalation] [missed contacts] [moves] [gaps] [household] [release]   | ------
+------------------------------------------------------------------------------+ Agency
| 2024 |------|------|------ 2025 ------|------|------ 2026 ------|--[brush]--| | Source
| Police      .    .        .  .  .   .. ...  O    .                            | Recorded
| Social work    .      .          .     .      O  o   .  .                     | by
| Health      .  .    .   .            .          .                             | Lawful
| Education         . .  . ..  .   .. .  .   O                                  | basis
| Housing                .                                                      | Audit
| Analysis    [ 12 Feb: pattern of missed HV contacts ]---[ 3 Jun: escalation ]  |
+------------------------------------------------------------------------------+
| date        agency        type            title                 sig  src  vis |
| 03 Jun 2026 [P] Police    Concern report  Child present at ...  High iVPD Int |
| 01 Jun 2026 [E] Education Attendance      Absent 4 of 5 days    Mod  SEEMIS Int|
| ...virtualised...                                                             |
+------------------------------------------------------------------------------+
| [Add event] [Review inbox (4)] [Export pack]                                  |
```

Lanes are hand-built SVG: one row per agency, points sized by significance, glyph inside the point at high significance, a brush on the axis. Analysis is a separate row with bracketed spans. The list underneath is synchronised: brushing filters it, selecting a row highlights the point. Keyboard: arrows move across events, Enter opens in the drawer.

### 6.3 Meeting workspace

```
+------------------------------------------------------------------------------+ drawer
| Child Protection Planning Meeting: Aiden Boyle   14 Sep 2026 10:00  [Chair mode]| Who is
| Before | During | After                                       Minute: draft   | invited
+------------------------------------------------------------------------------+ and why
| Agenda                | Attendance             | Decisions                    | (need to
| 1 Welcome and purpose | [SW] J Kerr  present   | 1 Registration: yes          | know per
| 2 Child's views       | [P]  DS Paul present   |   category: emotional, phys  | row)
| 3 Information shared  | [H]  M Ross  apologies |   rationale ...  dissent: none|
| 4 Analysis of risk    | [E]  Head   present    | 2 Core group set ...          | Lawful
| 5 Decision            |                        |                              | basis
| 6 Plan and actions    +------------------------+------------------------------+
|                       | Views read into record | Actions (live)               | Distrib-
|                       | "..." Aiden, 20 Aug    | [ ] HV visit weekly  M Ross 21 Sep | ution
|                       | Parents' views ...     | [ ] School check-in  Head  daily   |
+-----------------------+------------------------+------------------------------+
| Information shared, by agency (structured, dated, attributable)              |
| [SW] ... [P] ... [H] ... [E] ...                                              |
+------------------------------------------------------------------------------+
```

Chair mode: the same data at 1.125rem base, rail collapsed, drawer hidden, agenda item currently in discussion enlarged, one action per line.

## 7. Motion

- One orchestrated moment: Person 360 first load, chronology lanes settle from 8px below with opacity 0 to 1 over 320ms, staggered 30ms per lane, `cubic-bezier(0.2, 0, 0, 1)`.
- Drawer open 200ms, row expand 160ms, clock tick 120ms colour transition. No hover lifts. `prefers-reduced-motion: reduce` sets every duration to 0.

## 8. Iconography

lucide-react for UI icons at 16 and 20px, stroke 1.75. Custom glyphs in `packages/ui/src/glyphs/`: police shield, social work house with people, health cross in circle, education book, housing key, third sector hands, SPS bars, court gavel, SCRA balance, regulator seal, fire and rescue flame. Process marks: ASP, CP, MARAC, MAPPA, AWI. Each has filled and outline variants at 16, 20 and 24px. The lantern wordmark glyph is also here.

## 9. Self-critique against brief section 8

What in the first draft of this plan is what anyone would produce for any dashboard, and what changed:

1. **Home as three KPI cards.** The first sketch had "Overdue 3 / Due this week 8 / Meetings today 2" tiles. That is every admin template. Changed: Home is a column of clocks set as typography (numeral, label, trigger date) sorted by urgency, next to a worklist that reads like a list of sentences, and a Today rail. No tiles, no sparkline.
2. **Cards with shadows in a grid.** Removed. Panels are sheets on paper-1 separated by hairline rules. Hierarchy comes from paper steps and type, so the page reads like a dossier rather than a SaaS dashboard.
3. **Coloured pill badges for everything.** Pills are reserved for process and stage. Agencies are marks (glyph + colour + label) rather than pills, so the chronology and the drawer do not become confetti.
4. **A plain data table for the chronology.** The table stays for scanning, but the lanes view is the identity of the product: agency rows, significance-sized points, an analysis row that visibly differs from the fact rows, and a brush. This is the screen you would not get from a template.
5. **Blue links and a blue primary button.** Blue is the police colour here, so the accent is heather and it appears in exactly the places that mean "the product is speaking": primary actions, links, focus, selection, the analysis bracket.
6. **Views and voice as a text area at the bottom of a form.** Changed to VoiceBlock, placed in the top third of Person 360 and every process dashboard, styled unlike any other block so the person's words are unmistakable.
7. **An avatar circle with initials.** Removed. The product does not show faces or initials; identity is name, date of birth and reference. This is also a safeguarding choice: a screen glanced at across a room should not identify a person by a coloured circle.
8. **Sidebar with a logo and menu.** Kept, because practitioners need it, but the rail ends with the user's agency glyph and persona so it always shows "who am I looking at this as", which matters for need-to-know.
9. **A generic search bar.** Search results show the process badges, the restricted indicator and "you are not on this case" affordance, because the interesting question in this product is not "does this person exist" but "what am I allowed to see".

## 10. Open items for the screenshot review

- Whether ink-2 at 0.8125rem is enough contrast in compact density on paper-2 headers (the checker says yes; eyes will confirm).
- Whether the lanes view needs a second row per agency when events cluster (planned: jitter within the lane, then a count badge above 6 in one day).
- Dark theme risk colours on the clock numerals.
