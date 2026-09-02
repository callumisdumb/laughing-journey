# Data model

Outline written in Phase 0. From Phase 1 the entity tables below are regenerated from the Zod schemas in `packages/domain` by `pnpm docs:data-model`; the prose stays hand-written.

## Principles

- Zod schemas are the source of truth. Types are inferred, never hand-written.
- Facts and analysis are different entities. `ChronologyEvent` is a fact. `ChronologyAnalysis` links to event IDs and carries a dated judgement.
- Every share is a `SharingRecord` with a `LawfulBasisRecord`. Every read of restricted content is an `AuditEntry`.
- Every record generated for the mockup carries `synthetic: true`.
- IDs are prefixed strings (`per_`, `hh_`, `prc_`, `evt_`, `ana_`, `mtg_`, `act_`, `pln_`, `ra_`, `vw_`, `shr_`, `req_`, `cev_`, `aud_`, `usr_`, `org_`).
- Dates are ISO 8601 strings in data. `occurredAt` may be date-only with `approximate: true`.

## Entities

| Entity | Purpose | Key fields |
|---|---|---|
| Organisation | Council, health board, police division, third sector body, SPS, SCRA, court, regulator | id, kind, name, agency |
| Team | A team within an organisation | id, organisationId, name, base |
| User | A persona | id, name, agency, role, organisationId, teamId, base, processMemberships, caseMemberships |
| Person | Subject or network member | id, names, preferredName, pronouns, lifeStage (unborn, child, adult), dateOfBirth or expectedDeliveryDate, chi (synthetic), addresses[], householdId, communicationNeeds, alerts[], aliases[] |
| Address | Fictional address with move dates | id, line1, line2, town, postcode (Q, V or X prefix), from, to |
| Household | People at an address | id, addressId, memberIds[] |
| Relationship | Dated, typed link between people | fromPersonId, toPersonId, type, from, to, notes |
| Process | One case of one type | id, type, reference, subjectIds[], leadAgency, stage, stageHistory[], status, classification, members[], clocks[], detail (union) |
| AspDetail | ASP-specific | concern, threePointTest (a, b, c with met, reasoning, date, by), inquiry, investigation, harmTypes, consentAndCapacity, advocacy, powersUsed, ordersConsidered, plan, lsi |
| CpDetail | CP-specific | concern, ird (participants, contributions, decisions, interimSafetyPlan, jii, medical, reporterReferral, parentsInformed, childViews), investigation, cppm, register, coreGroup, childsPlan, preBirth |
| MaracDetail | MARAC-specific | referral (source, tool, items, score, judgement, repeat), researchRequests[], meetingSlot, actionPlan, idaaFeedback[], flags[], links |
| MappaDetail | MAPPA-specific | category, level, levelHistory[], leadResponsibleAuthority, sonr, licenceConditions[], riskTools[], rmp, era, disclosures[], preMeetingReturns[], reviewSchedule, visorReference |
| AwiDetail | AWI-specific | capacityAssessments[], willAndPreferences, opgResult, routeDecision (incl s13ZA record), application (applicant, medicalReports, mhoReport, court, interimOrder), orders[], supervisionVisits[], investigations[] |
| ClockTrigger | An instance of a clock rule on a process | ruleId, triggeredAt, completedAt, note |
| ChronologyEvent | A fact | id, subjectIds[], occurredAt, approximate, recordedAt, agency, sourceSystem, recordedBy, eventType, title, detail, response, outcome, significance, significanceReason, linkedPersonIds[], linkedProcessIds[], evidenceRefs[], visibility, versions[] |
| ChronologyAnalysis | A judgement about facts | id, eventIds[], authorId, agency, recordedAt, text, kind (pattern, risk, recommendation) |
| Meeting | Any meeting type | id, type, processId, subjectIds[], scheduledAt, status, chairId, minuteTakerId, invitees[], agenda[], informationShared[], decisions[], actionIds[], viewsRead[], minute (status, approvedAt, distributedAt), distribution[], reviewDate |
| Decision | Recorded decision with rationale and dissent | id, question, decision, rationale, dissent[], decidedBy, decidedAt |
| Action | An owned, dated action | id, processId, meetingId, planId, title, ownerId, ownerAgency, due, status, evidence, escalation |
| Plan | Any plan type | id, processId, type, outcomes[], actionIds[], coordinatorId, agreedAt, reviewDate |
| RiskAssessment | A tool result | id, processId, tool, assessedAt, assessorId, score, band, evidenceRefs[], judgementOverride (band, reason) |
| ViewsRecord | The person's views | id, personId, processId, kind, recordedAt, recordedBy, method, content, sharedWith |
| LawfulBasisRecord | Why a share was lawful | purpose, article6, article9Condition, article10Criminal, statutoryGateway, necessityAndProportionality, consentStatus, authorisedBy, isaRef, dpiaRef |
| SharingRecord | An outbound notification or share | id, processId, stage, recipient (userId or agency+role), detailLevel, lawfulBasis, channel, status, createdAt, readAt, reasonShown |
| InformationRequest | An inbound request | id, processId, fromAgency, toUserId, purpose, fields[], status, response |
| ConnectorEvent | An inbox item from an adapter | id, connectorId, subjectId, external payload, mappedEventType, proposedTitle, status (pending, promoted, dismissed), reviewedBy |
| AuditEntry | Any audited act | id, at, userId, act (read, share, breakGlass, personaSwitch, export), targetType, targetId, reason, restricted |
| Config | Local configuration | labels, clockRules[], needToKnowRows[], classificationMarkings[], forms[], agencies[], theme and density defaults |

## Enumerations

- `ProcessType`: asp, cp, marac, mappa, awi (extensible; LSI is an ASP variant flag).
- `Agency`: police, social-work, health, education, housing, third-sector, sps, scra, court, regulator, fire-rescue.
- `DetailLevel`: presence, summary, full, fields.
- `Visibility`: agency-only, integrated, restricted.
- `Significance`: low, moderate, high.
- `EventType`: see brief 4.7; grouped as family, move, household, health.*, education.*, police.*, social-work.*, care.*, legal.*, process.*, voice.*, disclosure, sharing.
- `RiskBand`: critical, high, medium, low, unknown.
- `Classification`: official, official-sensitive, restricted.

## Generated tables

(Regenerated by `pnpm docs:data-model` from Phase 1.)
