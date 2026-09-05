# Functionality audit

What every interactive control in the product actually does, before any of it is changed. Written on 03 September 2026 against `6ad8b94`, with no behaviour changed in the same commit, so the counts below describe the build as the review found it rather than the build after the work it prompted.

## Method, and its limits

Two passes. A static pass over all 76 components in `apps/web/features` and `apps/web/components` extracts every `onClick`, `onChange`, `onSubmit`, and resolves a handler that is a bare identifier or a `() => name()` to the named function's body in the same file. Each resolved body is classified by what it reaches: a store mutation (`upsert`, `update`, `setConfig`, `grantBreakGlass`, `resetDemo`, `save`, `signIn`), a navigation, a dialog open, a toast alone, or local view state alone. A second pass reads by hand the controls the static pass could not resolve and the ones on the demo path.

Two limits worth stating rather than glossing. A handler passed down as a prop resolves at its call site, not where it is written, so the static pass files those as unresolved and the hand pass classifies them. And "produces its downstream effects" cannot be established by reading a call site at all: a control that calls `upsert` may still fail to start a clock or write a sharing record. That column comes from reading each flow, and it is where the audit found most of what is missing.

## The counts

175 `onClick` handlers, 125 `onChange`, 24 form submissions, across 76 components. Resolved by what the handler reaches:

| Reaches | Count | Share |
|---|---|---|
| A store mutation | 27 | 15% |
| Local view state only | 45 | 25% |
| Navigation | 16 | 9% |
| Opens a dialog | 13 | 7% |
| A toast and nothing else | 4 | 2% |
| Passed as a prop, resolved by hand below | 70 | 40% |

29 call sites reach `upsert`, 47 write an audit entry, 47 raise a toast, 24 render a `Dialog`, and 213 render a link or call `navigate`.

## The four groups

### Works fully: mutates, persists, and produces its downstream effects

The meeting workspace is the strongest area: 20 controls, 6 store mutations, 4 audit entries, and the distribution flow generates sharing records with a lawful basis and completes the record distribution clock. The classification override, break-glass, the connector inbox promote, the copy catalogue editor, the four statutory form dialogs (DAQ, three-point test, capacity assessment, MAPPA referral) and the statutory disclosure flow all mutate, audit and persist.

### Works, but the downstream effect is missing

This is the group that matters and the one a static pass cannot find. The pattern is a control that mutates its own record correctly and stops there: the state persists across a reload, so it looks right, but nothing downstream fires.

The specific gap the audit exists to surface: **there is no single write pipeline.** Each call site decides for itself whether to audit, whether to start a clock, whether to write a chronology milestone, whether to generate sharing records, and whether to recompute the wrapping list. 29 mutation sites and 47 audit calls is not a one-to-one mapping, and the difference is not deliberate. The consequence is that the fifteenth create path will be the one that forgets a clock, and nothing will notice.

### Cosmetic only: renders a response, changes no state

- **"Ask to be involved"** on a process at presence level (`ProcessScreen.tsx:136`) raises a toast naming the lead worker and does nothing else. No request record, no notification to the lead, nothing in the audit log. It is on the demo path: it is the action offered to a persona who cannot see a record, which is the moment the need-to-know model is being demonstrated.
- Three export controls (the copy catalogue JSON export, the audit CSV export, and the workbook download) build a blob and raise a toast. These are correct as they stand, since producing a file is the whole effect, and they are listed here only so the count reconciles.

### Dead: no handler at all

None. Every `<Button>` in the product carries either an `onClick` or a submit type; there are no placeholder controls that do nothing when pressed. That is worth recording as a positive finding, because it is the failure mode this audit was expected to find and it is not there.

## What the audit changes about the plan

1. **The write pipeline comes before any new create path.** Building person create, household management and process creation on top of 29 independent mutation sites would multiply the inconsistency rather than fix it. One pipeline, with a test that walks every create and update and asserts it ran.
2. **"Ask to be involved" needs a record**, not a toast, because it is demonstrated at the exact moment the product is claiming that need-to-know is real.
3. **There is no create path for anything.** The audit's largest finding is an absence: 180 people, 60 households and 14 processes exist because the seed made them, and the product cannot bring a new one into being. That is the subject of `docs/RECORDS.md` and the work that follows it.

## Reconciliation with the demo script

Every control the current `docs/DEMO.md` touches is in the first two groups. Nothing on the scripted path is dead. The risk on camera is not a control that does nothing when pressed; it is a control that appears to work and leaves no trace anywhere else in the product, which is the second group, and which a viewer only notices when the presenter switches persona and the expected notification is not there.
