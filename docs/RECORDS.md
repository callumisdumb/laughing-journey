# Records management

How every entity in the product comes into being, changes, and reaches its terminal state. One row per entity in `docs/DATA-MODEL.md`, including the entities with no create path, where the row says why.

This is the specification for the records work, and it is written before that work rather than after it. Where a cell says something the product does not yet do, that is the specification talking; `docs/HANDOVER.md` carries what is built.

## The rules the matrix rests on

**Nothing in casework is deleted.** A record that has been shared cannot be unshared by deleting it, and the audit trail of what people believed and when is frequently the point of the record. The vocabulary is *correct*, *close*, *end* and *recorded in error*, never *delete*. The only deletion in the product is a user removing something from a draft they have not yet saved.

**Search precedes create, for people.** There is no direct create path for a `Person`. Two records for one child is how information fails to join up, and in a multi-agency system the two records are held by different agencies who each believe they have the whole picture. The path is search, review candidates, then create only after asserting that none match, and that assertion is recorded on the new record.

**Every write goes through one pipeline.** Validation, audit, classification, rewrapping, exclusion check, clock triggers, chronology event where the change is significant, sharing records, connector proposal, persistence. Ten steps, one implementation, asserted by a test that walks every create and update path. The alternative is what the functionality audit found: 29 mutation sites each deciding for themselves.

**Significant event, or not.** A chronology event is written where the change is a significant event and not otherwise, because a chronology that records every corrected typo is a chronology nobody reads. The list is in section 3 of this document, so the distinction is a decision rather than an accident.

## The matrix

Read across: **C** create, **U** update, **T** terminal state, **X** correct, **→** triggers, **K** encryption.

### Casework entities

| Entity | Create | Update | Terminal | Correct | Triggers | Encryption |
|---|---|---|---|---|---|---|
| **Person** | Search first, always. Any practitioner, from People, from the global create action, or inline from within a form. Records the candidate count reviewed. | Name, aliases, contact, communication needs, alerts (which have their own create path, below), life stage, address history. Reason required on identity fields (name, date of birth, CHI). | `deceased`, which is a flow (section 4), never a boolean edit. A person is never closed or removed. | Correction keeps the original visible and marked superseded, with the reason. | Audit; chronology event on identity change, death, merge; rewrap of every process the person is a subject of | Person records are wrapped to the union of the case keys of every process they are subject to, plus the escrow key |
| **Household** | From a person record, or with a person during create. | Label, address, membership. | Ends with a date when the household dissolves. Memberships end individually. | Correction with reason. | Audit; chronology `household change` on every person moved; affected-process warning; sharing records where the matrix requires notification | Wrapped to the case keys of every process any member is subject to |
| **Relationship** | From the network view, from a person record, or inline from a form. The inverse is created automatically. | Type, dates. Ending sets `to` and never deletes. | Ended, with a date. | Correction with reason. | Audit; chronology event where the relationship is significant; **exclusion warning before save** where the relationship would create or remove a case-role exclusion; parties register recompute | As Person |
| **Address** | With a person or household, or standalone from Admin. | Fields, while unreferenced. Referenced addresses are corrected rather than edited. | None. Addresses persist because address history is casework. | Correction with reason. | Audit | Not separately wrapped; carried inside the records that reference it |
| **Process** (all five types) | From a person record via one prominent action, gated by eligibility then permission, both giving reasons. Duplicate-process check first. | Stage, members, flags, detail, parties, classification override. | **Closed**, with a reason from the correct statutory list: the de-registration reasons for CP, the actions-taken list for ASP. Stops the clocks and records why. Reopenable with a reason. | Correction with reason; `recorded in error` for a process opened on the wrong person. | All ten steps of section 4.4 of the task: reference, stage history, **clocks**, classification, wrapping list, parties register, notification queue, chronology milestone, audit, outbound connector proposal | Its own case key, wrapped to the need-to-know resolver's principal list plus escrow |
| **ChronologyEvent** | From the chronology, from a connector event promoted, or written by the pipeline as a process milestone. Fact-and-analysis validation refuses an opinion. | Title, detail, significance, visibility, via `versions[]`. | None. Events are corrected, never removed. | `recorded in error` hides it from working views and keeps it in audit and in any distributed pack. | Audit; sharing records on a visibility raise | Wrapped to the case key of the process it belongs to |
| **ChronologyAnalysis** | From the chronology, against selected events. Must cite at least one fact. | Text, linked events. | None. | Correction with reason. | Audit | As the events it cites |
| **Meeting** | From a process, or from Meetings. Invite list generated from need-to-know, not typed. | Everything up to distribution; the minute locks on chair approval. | Distributed. The minute is then corrected, not edited. | Correction with reason, and a re-distribution to the original list. | Audit; clocks (`cp.cppm.record.distribute`); sharing records per recipient at their detail level; chronology milestone | As its process |
| **Decision** | Within a meeting. Carries rationale and any dissent. | Within the meeting, before approval. | Recorded. | Correction with reason. | Audit; chronology milestone | As its meeting |
| **Action** | From a meeting, a plan, or standalone. | Owner, due date, status, evidence. | **Complete**, with evidence, or **cancelled** with a reason. | Correction with reason. | Audit; notification to the owner; chronology event on completion of a significant action | As its process |
| **Plan** | From the plans sheet on a process, or from the global create action. Outcomes are entered as rows and each one gets an id, because actions point at outcomes. The plan type the case usually produces is preselected. | Outcomes, linked actions, review date. | **Ended**, superseded by a review, or the process closes. | Correction with reason. | Audit; clocks (plan review); chronology milestone | As its process |
| **RiskAssessment** | From a process: DAQ, three-point test, capacity assessment, or an RM2000 or LS/CMI result recorded with band and assessor. | Not edited once recorded. A re-assessment is a new record. | Superseded by a later assessment. | `recorded in error` only. | Audit; MARAC repeat check; clocks; chronology milestone | As its process |
| **ViewsRecord** | From a person record or a meeting. Prominent: the person's own words are a first-class concept. | Text, method, who took it. | None. | Correction with reason, keeping the original words visible. | Audit; chronology event | As its process, or as the person where standalone |
| **LawfulBasisRecord** | Created by the pipeline with every share. Never created alone. | Not edited. A changed basis is a new record. | None. | `recorded in error`. | Audit | Carries a captured classification; wrapped as its share |
| **SharingRecord** | Created by the pipeline, never by hand. Carries the classification captured at the moment of the share. | Status only: queued, sent, read, withheld. | Read, or withheld. | `recorded in error`. A share cannot be unsent. | Audit; notification to the recipient | Wrapped to the recipient and to escrow |
| **InformationRequest** | From a meeting, a process, or Sharing. | Status, response. | Responded or declined. | Correction with reason. | Audit; notification; sharing record on response | As its process |
| **ConnectorEvent** | Inbound only, from an adapter. Never created by a person. | Status: pending, promoted, dismissed. | Promoted to a chronology event, or dismissed with a reason. | Dismissal with a reason; the event itself is never altered, because it is what the source system said. | Audit on promotion or dismissal | Encrypted at the agency gateway before the platform sees it |
| **AuditEntry** | Written by the pipeline. **No user path exists, by design.** | **Never.** The chain would break, and the Admin verification screen would find it. | None. Audit is append-only. | **Never.** A wrong audit entry is followed by a corrective entry, not amended. | It is itself the trigger | Only the free-text detail is encrypted, to oversight roles; the rest is deliberately readable |

### Reference and administrative entities

| Entity | Create | Update | Terminal | Correct | Triggers | Encryption |
|---|---|---|---|---|---|---|
| **Organisation** | Admin. Seeded; a partnership adds one rarely. | Admin, with audit. | Ended, with a date. Never deleted: historic records reference it. | Correction with reason. | Audit | Not encrypted. Reference data naming no person. |
| **Team** | Admin. | Admin. | Ended. | Correction. | Audit | Not encrypted. |
| **User** | Admin, or by enrolment. In this mockup the personas are seeded and the switcher is a demo affordance, not authentication. | Admin: role, team, agency. | **Left**, which runs the leavers flow: revoke devices, rotate case keys, rewrap, keep the audit entries. | Correction with reason. | Audit; key rotation; case membership review | Holds a user key; not itself an encrypted record |
| **Config** | **No create path.** One configuration per deployment, seeded from `DEFAULT_CONFIG`. | Admin, per section, with audit and a reason on the sections that carry statutory values. | None. | Reset to the seeded value. | Audit; recompute of anything derived from the changed value | Not encrypted. Configuration, not casework. |
| **ClockRule** | **No create path in the product.** Rules are code, with a source and a confidence, because a clock invented in a text box is a clock with no provenance. Admin edits the value and the flag, not the rule's existence. | Admin: duration, unit, confidence. | None. | Reset to the seeded value. | Audit; recompute of every running instance | Not encrypted. |
| **NeedToKnowRow** | Admin, on the matrix screen. | Admin. | Removed from the matrix, which is an update rather than a delete: the row's history stays in audit. | Correction with reason. | Audit; **rewrap of every process the row affects**, because the entitled set has changed | Not encrypted; it decides who else's records are wrapped to whom |
| **Exclusion** | Admin, on the exclusions screen. Hard exclusions cannot be created to be liftable. | Admin. | Removed, which is an update. | Correction with reason. | Audit; parties register recompute; rewrap | Not encrypted. |

### Records that live inside another entity

These are not top-level collections. They live inside a `Person` or inside a `Process.detail`, they are wrapped and audited as their parent, and each now has its own create path rather than being reachable only through the seed.

| Record | Lives in | Create | Update | Terminal | Notes |
|---|---|---|---|---|---|
| **PersonAlert** | `Person.alerts` | From the person record header, or from the global create action. Asks the visibility scope explicitly: everybody who can read the record, or a named set of agencies. | Text, dates, scope, with a reason. | Ends on its `to` date. Alerts are ended, not removed. | The scope is the point. A staff safety alert restricted to some agencies is not doing its job; a MAPPA presence alert seen by everybody has disclosed the case (D-142). |
| **ASP order considered** | `AspProcess.detail.ordersConsidered` | From the protection orders sheet on an ASP case, or from the global create action. One entry per order type, replaced rather than duplicated. | Decision and rationale, by recording the order again. | The order expires by its clock, or the process closes. | Recording a grant starts the order's statutory clocks, computed from the date granted using the rule table rather than a duration written into the form (D-143). A warrant for entry starts none, because no rule holds a duration for one. |
| **MAPPA disclosure** | `MappaProcess.detail.disclosures` | From the disclosure register on a MAPPA case, or from the global create action. Facts are a list, one per line, and the record opens **pending**. | Status only, via the approve and decline actions on the register. | Approved, declined, or made. | The proposal and the decision are separate acts by design (D-144). |
| **AWI supervision visit** | `AwiProcess.detail.supervisionVisits` | From the supervision sheet on an AWI case, or from the global create action. | Correction with reason. | None. A visit happened. | The visitor's name is a field, defaulted to the signed-in user, because the person who visited is often not the person recording it. |
| **AWI investigation** | `AwiProcess.detail.investigations` | From the supervision sheet on an AWI case, or from the global create action. Asks whether it is section 10 or section 12. | Status, from open to closed. | Closed. | Which section is being used decides who else has a duty, so it is asked rather than filed under one heading. |
| **CaseParty (manual)** | `Process.parties` | From the case-party register on any process, or from the global create action. Keyed on the typed name, with the reason on the record. | Replaced by recording the same name and party again. | Removed only as a correction, with a reason. | The register is otherwise derived, from the referral and from relationships. This is the path for what derivation cannot know (D-145). |

### Entities that deliberately have no create path

| Entity | Why |
|---|---|
| **AuditEntry** | Written by the pipeline only. A user-created audit entry would break the chain, and the Admin verification screen would find it. |
| **LawfulBasisRecord** | Created by the pipeline with every share. A basis with no share attached is a basis nobody acted on. |
| **SharingRecord** | Created by the pipeline. A share by hand is a share that skipped the need-to-know resolver. |
| **ConnectorEvent** | Inbound only, from an adapter. It is what the source system said, so a person writing one would be putting words in another agency's mouth. |
| **Config** | One configuration per deployment, seeded from `DEFAULT_CONFIG`. Admin edits it; nothing creates a second one. |
| **ClockRule** | Rules are code, with a source and a confidence. A clock invented in a text box is a clock with no provenance. Admin edits the value, not the rule's existence. |
| **ClockTrigger** | Started by the write pipeline from the rule the trigger names, never chosen from a menu. A clock somebody started by hand is a deadline with no event behind it. |
| **StageEntry** | Written by the pipeline on every stage change. The stage history is a record of what happened, not a list to be added to. |
| **Membership** | Generated from the need-to-know resolver when a process opens or its stage changes. Adding a member by hand is how a case membership stops matching the matrix that justifies it. |
| **CaseParty (derived)** | Derived from the referral and from relationships on every read. Only the manual entries above are written. |

## 3. What counts as a significant event

A chronology event is written for these and not for anything else. The list is short on purpose: a chronology that records every field edit is a chronology a practitioner scrolls past.

**Written**: a process opening, a stage change, a closure or a reopening; a meeting held and a minute distributed; a plan agreed or reviewed; a risk assessment recorded; a protection order applied for, granted or expiring; a household change or an address move; a relationship beginning or ending where it bears on a case; a death; a person merge; a views record; a disclosure decision; a break-glass access.

**Not written**: a typo corrected; a contact number changed; a status moved between queued and sent; a classification override, which is audited and shown on the record but is not a fact about the person; any change to configuration.

## 4. The flows that are more than an edit

**Opening a process.** Two gates, both giving reasons: eligibility from the person, permission from the persona (D-135). Every process is listed with its answer, including the ones that are not available. MAPPA has no age floor and warns rather than refusing under 18 (D-136); a 16 or 17 year old is offered adult support and protection and child protection at once, and the choice is recorded. An open case of the same type is shown first and a second one takes a reason; a MARAC referral runs the repeat check and sets the flag. Opening writes the reference, the opening stage and its history entry, the classification from the derivation rules, the case-role register, the notifications with their lawful basis, a chronology milestone on every subject, the audit entry, and the clocks that the *trigger* starts, which is fewer than it looks: only the two ASP clocks run from a concern (D-137). The dialog says which start and, where none do, what will start them.

**Creating a person.** There is no direct create. The sequence is search, review candidates, then create only if nothing matches, and the create button is not on the screen until the practitioner has explicitly said that none of the candidates is the person. That assertion is recorded on the new record as `createdAfterReviewing`, a count of the candidates that were on screen when it was dismissed, and editing any search field afterwards sends the flow back to the start so the number always describes the search that was actually reviewed. The duplicate search runs over every person in the product, including the ones the searcher has no access to: a candidate held behind need-to-know is shown as a name, a date of birth and a sentence saying the person may already be known and to ask for access, because the invisible record is the one that produces the duplicate. Candidates come back with the reason each one matched rather than a score. The implementation is `packages/domain/src/people/duplicates.ts` and the reasons are listed in D-116.

**Merge.** Two person records become one. Every relationship, process membership, chronology event, meeting, plan and sharing record repoints to the survivor; the audit ledger does not, because it records what happened. The retired record's name is kept as an alias on the survivor so an inbound connector event carrying the old reference still lands. Requires a reason of at least a sentence, is audited, and writes to the survivor's chronology. **It is reversible**, because conflating two children is worse than the duplicate it was meant to fix and it does happen: `packages/domain/src/people/merge.ts` keeps both records whole and the dotted path of every reference it moved, so the unmerge sets exactly those back. An undone merge keeps its record and is marked undone rather than deleted. See D-122 to D-127.

**Recording a death.** Not a checkbox. It closes or changes every open process, and the consequence differs by type: for ASP the action taken becomes the workbook's own label for a death during the ASP process; for child protection the de-registration reason list has "Child died"; for MAPPA the person exits. It writes a chronology event, notifies every case member, and may prompt a Learning Review consideration. Afterwards no report, print pack or export surfaces the person's name inappropriately.

**Closing a process.** Stops the clocks and records why they stopped; writes the closure reason from the statutory list for that process type; notifies contributing agencies at the detail level the matrix specifies; writes a chronology milestone; expires or removes flags; and proposes the outbound write that closes the episode in the source system. A case closed here and left open in the source system is exactly the divergence the reconciliation screen exists to catch.

**Ending a relationship that is the basis of an exclusion.** Requires an explicit decision about whether the exclusion stands, recorded on the case, defaulting to *stands*. A former partner is frequently the whole risk, and silently un-excluding them is the most dangerous single thing in this matrix. Implemented so that the ending cannot lift it by accident: the party register reads the relationship record rather than its dates, so the exclusion survives the ending on its own. Confirming that it stands moves the entry from derived to explicitly recorded, with a name, a date and a reason; lifting it sets `stands: false` on an explicit entry, which is the only thing in the product that suppresses one. See D-132.

**Changing a household.** Adding somebody or recording that they left names the open processes anybody in the household is a subject of, and offers to tell the people the need-to-know matrix entitles, generating one sharing record each with the lawful basis the matrix names. Membership is dated: removing somebody sets an end date and a reason rather than deleting them, so who lived where and when survives (D-128). Both write a `household.change` chronology entry on everybody moved.

## 5. Guardrails

Every record created carries `synthetic: true` automatically, and the person create form carries a permanent line reminding the user that real personal data must not be entered. That line is not decoration: this will be shown to a room where somebody will be tempted to type in a live case, and the product should discourage it at the point of entry.

No fabricated identifiers. Generated CHI numbers follow the synthetic rules from the brief and are marked as synthetic in the interface, not only in the data.

Permission is checked at the action, not at the submit button: a user who cannot create a thing does not see a form they cannot submit, and the gate explains itself and offers the referral route.

No path creates a record without an audit entry, asserted by test.
