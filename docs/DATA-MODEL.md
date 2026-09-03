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
| Process | One case of one type | id, type, reference, subjectIds[], leadAgency, stage, stageHistory[], status, classification, accessRestriction, members[], clocks[], detail (union) |
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
- `ClassificationLevel`: official, secret, top-secret. The three levels of the Government Security Classification scheme. `Classification` is `{ level, sensitive, handling }`: Official-Sensitive is a marking on a subset of Official, not a fourth level. Secret and Top Secret are in the type and unreachable in the product, and a test says so.
- `AccessRestriction`: none, restricted. Whether a record is reachable only by the people on it. Orthogonal to classification, and not a level of it: RESTRICTED was abolished on 2 April 2014 with the rest of the Government Protective Marking Scheme.
- `MarkingProfileId`: official, official-sensitive, access-restricted. The key of the local handling configuration, which is not a classification: the third profile describes a record that is both Official-Sensitive and access restricted.

## Generated tables

Generated on 2026-09-03 by `pnpm docs:data-model`. Do not edit below this line.

### Organisation

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `kind` | enum (10 values) | yes |
| `name` | string | yes |
| `shortName` | string | yes |

### Team

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `organisationId` | string | yes |
| `name` | string | yes |
| `base` | string | yes |

### User

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `givenName` | string | yes |
| `familyName` | string | yes |
| `agency` | enum (11 values) | yes |
| `roleId` | enum (38 values) | yes |
| `jobTitle` | string | yes |
| `organisationId` | string | yes |
| `teamId` | string | no |
| `base` | string | yes |
| `email` | string | yes |
| `phone` | string | yes |
| `processMemberships` | array of "asp" \| "cp" \| "marac" \| "mappa" \| "awi" | yes |
| `caseMemberships` | array of string | yes |
| `blurb` | string | yes |
| `featured` | boolean | no |

### Address

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `line1` | string | yes |
| `line2` | string | no |
| `town` | string | yes |
| `postcode` | string | yes |

### Person

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `givenName` | string | yes |
| `familyName` | string | yes |
| `preferredName` | string | no |
| `aliases` | array of string | yes |
| `pronouns` | string | no |
| `lifeStage` | "unborn" \| "child" \| "adult" | yes |
| `dateOfBirth` | string (date) | no |
| `expectedDeliveryDate` | string (date) | no |
| `sex` | "female" \| "male" \| "not-recorded" | yes |
| `chi` | string | no |
| `addressHistory` | array of object { addressId, from, to, note } | yes |
| `householdId` | string | no |
| `communicationNeeds` | object { interpreterLanguage, needs, note } | yes |
| `alerts` | array of object { id, kind, text, from, to, visibleTo } | yes |
| `contact` | object { phone, email } | yes |
| `gpPractice` | string | no |
| `school` | string | no |
| `ethnicity` | string | no |
| `deceased` | boolean | no |
| `createdAt` | string (date-time) | yes |

### Household

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `addressId` | string | yes |
| `memberIds` | array of string | yes |
| `label` | string | no |

### Relationship

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `fromPersonId` | string | yes |
| `toPersonId` | string | yes |
| `type` | enum (21 values) | yes |
| `from` | string (date) | no |
| `to` | string (date) | no |
| `notes` | string | no |

### Process (discriminated by type)

Variant 1

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `reference` | string | yes |
| `title` | string | yes |
| `subjectIds` | array of string | yes |
| `leadAgency` | enum (11 values) | yes |
| `leadUserId` | string | no |
| `stage` | enum (29 values) | yes |
| `stageHistory` | array of object { stage, at, byUserId, byName, note } | yes |
| `status` | "open" \| "closed" \| "transferred" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `classificationOverride` | object { level, sensitive, handling, reason, byUserId, byName, at } | no |
| `openedAt` | string (date-time) | yes |
| `closedAt` | string (date-time) | no |
| `closureReason` | string | no |
| `members` | array of object { userId, caseRole, agency, since, reason } | yes |
| `clocks` | array of object { id, ruleId, triggeredAt, completedAt, dueOverride, overrideReason, note } | yes |
| `linkedProcessIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `riskAssessmentIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | no |
| `flags` | object | yes |
| `parties` | array of object { personId, userId, name, party, label, since, source, reason } | yes |
| `type` | literal "asp" | yes |
| `detail` | object { concern, threePointTest, screening, inquiry, investigation, ordersConsidered, planId, closure, lsi } | yes |

Variant 2

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `reference` | string | yes |
| `title` | string | yes |
| `subjectIds` | array of string | yes |
| `leadAgency` | enum (11 values) | yes |
| `leadUserId` | string | no |
| `stage` | enum (29 values) | yes |
| `stageHistory` | array of object { stage, at, byUserId, byName, note } | yes |
| `status` | "open" \| "closed" \| "transferred" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `classificationOverride` | object { level, sensitive, handling, reason, byUserId, byName, at } | no |
| `openedAt` | string (date-time) | yes |
| `closedAt` | string (date-time) | no |
| `closureReason` | string | no |
| `members` | array of object { userId, caseRole, agency, since, reason } | yes |
| `clocks` | array of object { id, ruleId, triggeredAt, completedAt, dueOverride, overrideReason, note } | yes |
| `linkedProcessIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `riskAssessmentIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | no |
| `flags` | object | yes |
| `parties` | array of object { personId, userId, name, party, label, since, source, reason } | yes |
| `type` | literal "cp" | yes |
| `detail` | object { concern, proceduresInitiatedAt, ird, investigation, cppm, register, coreGroup, childsPlanId, preBirth } | yes |

Variant 3

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `reference` | string | yes |
| `title` | string | yes |
| `subjectIds` | array of string | yes |
| `leadAgency` | enum (11 values) | yes |
| `leadUserId` | string | no |
| `stage` | enum (29 values) | yes |
| `stageHistory` | array of object { stage, at, byUserId, byName, note } | yes |
| `status` | "open" \| "closed" \| "transferred" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `classificationOverride` | object { level, sensitive, handling, reason, byUserId, byName, at } | no |
| `openedAt` | string (date-time) | yes |
| `closedAt` | string (date-time) | no |
| `closureReason` | string | no |
| `members` | array of object { userId, caseRole, agency, since, reason } | yes |
| `clocks` | array of object { id, ruleId, triggeredAt, completedAt, dueOverride, overrideReason, note } | yes |
| `linkedProcessIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `riskAssessmentIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | no |
| `flags` | object | yes |
| `parties` | array of object { personId, userId, name, party, label, since, source, reason } | yes |
| `type` | literal "marac" | yes |
| `detail` | object { referral, researchRequests, meetingId, actionPlanId, idaa, idaaFeedback, flags, links, safeLivesReturn, transfer } | yes |

Variant 4

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `reference` | string | yes |
| `title` | string | yes |
| `subjectIds` | array of string | yes |
| `leadAgency` | enum (11 values) | yes |
| `leadUserId` | string | no |
| `stage` | enum (29 values) | yes |
| `stageHistory` | array of object { stage, at, byUserId, byName, note } | yes |
| `status` | "open" \| "closed" \| "transferred" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `classificationOverride` | object { level, sensitive, handling, reason, byUserId, byName, at } | no |
| `openedAt` | string (date-time) | yes |
| `closedAt` | string (date-time) | no |
| `closureReason` | string | no |
| `members` | array of object { userId, caseRole, agency, since, reason } | yes |
| `clocks` | array of object { id, ruleId, triggeredAt, completedAt, dueOverride, overrideReason, note } | yes |
| `linkedProcessIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `riskAssessmentIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | no |
| `flags` | object | yes |
| `parties` | array of object { personId, userId, name, party, label, since, source, reason } | yes |
| `type` | literal "mappa" | yes |
| `detail` | object { category, level, levelHistory, leadResponsibleAuthority, visorReference, victimPersonIds, notification, referral, sonr, custody, licenceConditions, orders, riskAssessmentIds, rmp, era, disclosures, preMeetingReturns, reviewSchedule, exit, significantCaseReviewTrigger } | yes |

Variant 5

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `reference` | string | yes |
| `title` | string | yes |
| `subjectIds` | array of string | yes |
| `leadAgency` | enum (11 values) | yes |
| `leadUserId` | string | no |
| `stage` | enum (29 values) | yes |
| `stageHistory` | array of object { stage, at, byUserId, byName, note } | yes |
| `status` | "open" \| "closed" \| "transferred" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `classificationOverride` | object { level, sensitive, handling, reason, byUserId, byName, at } | no |
| `openedAt` | string (date-time) | yes |
| `closedAt` | string (date-time) | no |
| `closureReason` | string | no |
| `members` | array of object { userId, caseRole, agency, since, reason } | yes |
| `clocks` | array of object { id, ruleId, triggeredAt, completedAt, dueOverride, overrideReason, note } | yes |
| `linkedProcessIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `riskAssessmentIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | no |
| `flags` | object | yes |
| `parties` | array of object { personId, userId, name, party, label, since, source, reason } | yes |
| `type` | literal "awi" | yes |
| `detail` | object { concern, capacityAssessments, willAndPreferences, opgResult, routeDecision, application, orders, supervisionVisits, investigations } | yes |

### AspDetail

| Field | Type | Required |
|---|---|---|
| `concern` | object { receivedAt, source, sourceAgency, sourceReference, summary, referralSource, referralSourceOther, harmTypes, primaryHarmType, traffickingKinds, harmTypeOther, primaryClientGroup, clientGroupOther, locationOfHarm, locationOfHarmOther, immediateSafety, policeInvolved } | yes |
| `threePointTest` | object { assessedAt, byName, byUserId, a, b, c, outcome } | yes |
| `screening` | object { outcome, rationale, at, byName } | no |
| `inquiry` | object { openedAt, interAgencyDiscussionMeetingId, agenciesContacted, outcome, action, rationale, decidedAt } | no |
| `investigation` | object { councilOfficerUserId, secondWorkerUserId, visits, interviews, medicalExamination, recordsRequests, consent, capacity, unduePressure, advocacy } | no |
| `ordersConsidered` | array of object { order, considered, decision, rationale } | yes |
| `planId` | string | no |
| `closure` | object { at, reason } | no |
| `lsi` | object { setting, provider, serviceType, careInspectorateCsNumber, nhsHospitalLocationCode, strands, agenciesInvolved, careInspectorateNotified, commissioningInvolved, chairUserId, chairIsSeniorCouncilOfficer } | no |

### CpDetail

| Field | Type | Required |
|---|---|---|
| `concern` | object { receivedAt, source, sourceAgency, sourceReference, summary } | yes |
| `proceduresInitiatedAt` | string (date-time) | no |
| `ird` | object { meetingId, heldAt, outOfHours, participants, contributions, decisions, siblingsConsidered, interimSafetyPlanId, childViewsSought } | no |
| `investigation` | object { openedAt, jiiHeldAt, jiiModel, medicalHeldAt, summary } | no |
| `cppm` | object { meetingId, heldAt, decision, rationale } | no |
| `register` | object { registeredAt, concerns, localCategory, deregisteredAt, deregistrationReason, deregistrationNote, transfer } | no |
| `coreGroup` | object { memberUserIds, leadProfessionalUserId, namedPersonUserId, firstMeetingAt } | no |
| `childsPlanId` | string | no |
| `preBirth` | object { expectedDeliveryDate, motherPersonId, gestationWeeksAtConcern } | no |

### MaracDetail

| Field | Type | Required |
|---|---|---|
| `referral` | object { receivedAt, referringAgency, referrerName, riskAssessmentId, professionalJudgementReferral, repeat, previousHearingAt, victimPersonId, perpetratorPersonId, childPersonIds, summary } | yes |
| `researchRequests` | array of object { id, agency, toUserId, sentAt, dueAt, status, returnSummary, returnedAt } | yes |
| `meetingId` | string | no |
| `actionPlanId` | string | no |
| `idaa` | object { userId, name, organisation } | yes |
| `idaaFeedback` | array of object { at, byName, summary, victimResponse } | yes |
| `flags` | array of object { agency, system, placedAt, expiresAt, receiptRef } | yes |
| `links` | object { cpProcessId, aspProcessId, mappaProcessId, matacConsidered, matacReferredAt, dsdasConsidered, dsdasNote } | yes |
| `safeLivesReturn` | object { referralSource, repeat, childrenCount, outcomeCodes } | yes |
| `transfer` | object { toArea, at, receivingCoordinator } | no |

### MappaDetail

| Field | Type | Required |
|---|---|---|
| `category` | literal 1 or literal 2 or literal 3 | yes |
| `level` | literal 1 or literal 2 or literal 3 | yes |
| `levelHistory` | array of object { level, at, reason, meetingId } | yes |
| `leadResponsibleAuthority` | "police" \| "social-work" \| "health" \| "sps" | yes |
| `visorReference` | string | yes |
| `victimPersonIds` | array of string | yes |
| `notification` | object { at, source, byName } | yes |
| `referral` | object { at, byName, riskAssessmentIds, reason } | no |
| `sonr` | object { subject, compliant, lastNotificationAt, nextDueAt, endsAt } | yes |
| `custody` | object { releasedAt, licenceExpiresAt, establishment } | yes |
| `licenceConditions` | array of object { id, text, status } | yes |
| `orders` | array of object { id, kind, madeAt, expiresAt, court, status } | yes |
| `riskAssessmentIds` | array of string | yes |
| `rmp` | object { planId, triggers, contingencies, controls, victimSafety, accommodation, employment, associates, reviewedAt } | no |
| `era` | object { status, proposedAddressId, assessorName, startedAt, concerns, conclusion } | no |
| `disclosures` | array of object { id, recipient, recipientKind, status, factsToDisclose, rationale, decidedByName, decidedAt } | yes |
| `preMeetingReturns` | array of object { agency, contact, requestedAt, status, summary } | yes |
| `reviewSchedule` | object { lastMeetingId, lastMeetingAt, nextDueAt } | yes |
| `exit` | object { at, kind, note } | no |
| `significantCaseReviewTrigger` | string | no |

### AwiDetail

| Field | Type | Required |
|---|---|---|
| `concern` | object { raisedAt, source, sourceAgency, decisionInQuestion, summary } | yes |
| `capacityAssessments` | array of object { id, decision, assessedAt, assessorName, assessorRole, outcome, evidence, communicationSupport } | yes |
| `willAndPreferences` | object { recordedAt, byName, pastWishes, presentWishes, communicationMethod, consultedOthers } | no |
| `opgResult` | object { checkedAt, reference, powerOfAttorney, guardianship } | no |
| `routeDecision` | object { route, decidedAt, byName, rationale, s13za } | no |
| `application` | object { applicant, applicantName, solicitor, powersSought, mhoUserId, mhoNotifiedAt, mhoReport, medicalReports, suitabilityReport, court, interimOrder } | no |
| `orders` | array of object { id, kind, grantedAt, expiresAt, guardianName, powers, supervisingOfficerUserId, opgRegisteredAt, mwcNotifiedAt } | yes |
| `supervisionVisits` | array of object { at, byName, summary } | yes |
| `investigations` | array of object { section, openedAt, summary, status } | yes |

### ChronologyEvent

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `subjectIds` | array of string | yes |
| `occurredAt` | string (date-time) | yes |
| `hasTime` | boolean | yes |
| `approximate` | boolean | yes |
| `recordedAt` | string (date-time) | yes |
| `agency` | enum (11 values) | yes |
| `sourceSystem` | enum (11 values) | yes |
| `recordedByUserId` | string | no |
| `recordedByName` | string | yes |
| `eventType` | enum (55 values) | yes |
| `title` | string | yes |
| `detail` | string | yes |
| `response` | string | no |
| `outcome` | string | no |
| `significance` | "low" \| "moderate" \| "high" | yes |
| `significanceReason` | string | no |
| `linkedPersonIds` | array of string | yes |
| `linkedProcessIds` | array of string | yes |
| `evidenceRefs` | array of object { kind, ref, label } | yes |
| `visibility` | "agency-only" \| "integrated" \| "restricted" | yes |
| `lawfulBasisId` | string | no |
| `versions` | array of object { at, byUserId, byName, change } | yes |

### ChronologyAnalysis

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `subjectId` | string | yes |
| `processId` | string | no |
| `eventIds` | array of string | yes |
| `authorUserId` | string | no |
| `authorName` | string | yes |
| `agency` | enum (11 values) | yes |
| `recordedAt` | string (date-time) | yes |
| `kind` | "pattern" \| "risk" \| "recommendation" | yes |
| `title` | string | yes |
| `text` | string | yes |

### Meeting

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `type` | enum (13 values) | yes |
| `processId` | string | yes |
| `subjectIds` | array of string | yes |
| `title` | string | yes |
| `scheduledAt` | string (date-time) | yes |
| `endsAt` | string (date-time) | no |
| `location` | string | yes |
| `status` | "scheduled" \| "in-progress" \| "held" \| "cancelled" | yes |
| `chairUserId` | string | no |
| `chairName` | string | yes |
| `minuteTakerUserId` | string | no |
| `minuteTakerName` | string | no |
| `invitees` | array of object { userId, name, agency, role, required, attendance, reason, needToKnowRowId } | yes |
| `agenda` | array of object { id, order, title, status, note } | yes |
| `preMeetingRequests` | array of object { id, agency, toName, toUserId, sentAt, dueAt, status, returnSummary, returnedAt } | yes |
| `pack` | array of object { id, kind, label, ref, windowFrom, windowTo, included } | yes |
| `informationShared` | array of object { id, agency, byName, byUserId, at, summary, relevance, linkedEventIds } | yes |
| `decisions` | array of object { id, question, decision, rationale, dissent, decidedByName, decidedByUserId, decidedAt } | yes |
| `actionIds` | array of string | yes |
| `viewsRecordIds` | array of string | yes |
| `minute` | object { status, draftedAt, approvedAt, distributedAt } | yes |
| `distribution` | array of object { id, recipientName, recipientUserId, agency, role, detailLevel, fields, sharingRecordId, reason } | yes |
| `reviewDate` | string (date) | no |
| `subjectAttendance` | string | no |
| `aspAttendance` | object { adultInvited, adultAttended, advocateInvited, advocateAttended, adultNotInvitedReason } | no |

### Decision

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `question` | string | yes |
| `decision` | string | yes |
| `rationale` | string | yes |
| `dissent` | array of object { byName, byUserId, agency, text } | yes |
| `decidedByName` | string | yes |
| `decidedByUserId` | string | no |
| `decidedAt` | string (date-time) | yes |

### Action

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `processId` | string | yes |
| `meetingId` | string | no |
| `planId` | string | no |
| `title` | string | yes |
| `detail` | string | no |
| `ownerUserId` | string | no |
| `ownerName` | string | yes |
| `ownerAgency` | enum (11 values) | yes |
| `due` | string (date) | yes |
| `status` | "open" \| "in-progress" \| "complete" \| "cancelled" | yes |
| `completedAt` | string (date-time) | no |
| `evidence` | string | no |
| `escalatedAt` | string (date-time) | no |
| `escalatedToName` | string | no |
| `createdAt` | string (date-time) | yes |
| `createdByName` | string | yes |

### Plan

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `processId` | string | yes |
| `type` | "interim-safety" \| "childs-plan" \| "adult-protection" \| "adult-support" \| "marac-action" \| "mappa-rmp" | yes |
| `title` | string | yes |
| `outcomes` | array of object { id, text, actionIds } | yes |
| `coordinatorUserId` | string | no |
| `coordinatorName` | string | yes |
| `agreedAt` | string (date) | yes |
| `reviewDate` | string (date) | no |
| `status` | "draft" \| "active" \| "reviewed" \| "ended" | yes |
| `consentNote` | string | no |
| `noFurtherActionAgreed` | boolean | no |

### RiskAssessment

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `processId` | string | no |
| `subjectId` | string | yes |
| `tool` | enum (9 values) | yes |
| `assessedAt` | string (date-time) | yes |
| `assessorUserId` | string | no |
| `assessorName` | string | yes |
| `assessorAgency` | enum (11 values) | yes |
| `score` | number | no |
| `maxScore` | number | no |
| `band` | "critical" \| "high" \| "medium" \| "low" \| "unknown" | yes |
| `bandLabel` | string | yes |
| `items` | array of object { id, question, answer } | no |
| `evidenceRefs` | array of object { kind, ref, label } | yes |
| `judgementOverride` | object { band, reason, byName } | no |

### ViewsRecord

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `personId` | string | yes |
| `processId` | string | no |
| `kind` | "adult-views" \| "child-voice" \| "victim-wishes" \| "family-views" \| "carer-views" | yes |
| `recordedAt` | string (date-time) | yes |
| `recordedByUserId` | string | no |
| `recordedByName` | string | yes |
| `recordedByAgency` | enum (11 values) | yes |
| `method` | string | yes |
| `content` | string | yes |
| `sharingPreference` | string | no |

### LawfulBasisRecord

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `purpose` | string | yes |
| `article6` | "6(1)(c) legal obligation" \| "6(1)(e) public task" \| "6(1)(d) vital interests" | yes |
| `article9Condition` | "9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)" \| "9(2)(h) health and social care" \| "9(2)(c) vital interests" \| "not applicable" | yes |
| `article10Criminal` | "DPA 2018 s10 and Sch 1" \| "not applicable" | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `statutoryGateway` | array of string | yes |
| `necessityAndProportionality` | string | yes |
| `consentStatus` | "not-required" \| "sought-and-given" \| "sought-and-refused-overridden" \| "not-sought-risk" | yes |
| `consentNote` | string | no |
| `authorisedByUserId` | string | no |
| `authorisedByName` | string | yes |
| `informationSharingAgreementRef` | string | no |
| `dpiaRef` | string | no |
| `createdAt` | string (date-time) | yes |

### SharingRecord

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `processId` | string | yes |
| `subjectId` | string | yes |
| `stage` | enum (29 values) | yes |
| `recipient` | object { userId, name, agency, role } | yes |
| `detailLevel` | "presence" \| "summary" \| "full" \| "fields" | yes |
| `fields` | array of string | no |
| `lawfulBasisId` | string | yes |
| `channel` | "in-app" \| "secure-email-digest" \| "connector-push" | yes |
| `status` | "queued" \| "sent" \| "read" \| "withheld" | yes |
| `createdAt` | string (date-time) | yes |
| `sentAt` | string (date-time) | no |
| `readAt` | string (date-time) | no |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `reason` | string | yes |
| `needToKnowRowId` | string | no |
| `createdByUserId` | string | no |
| `createdByName` | string | yes |
| `summary` | string | yes |

### InformationRequest

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `processId` | string | yes |
| `subjectId` | string | yes |
| `fromAgency` | enum (11 values) | yes |
| `fromName` | string | yes |
| `fromUserId` | string | no |
| `toAgency` | enum (11 values) | yes |
| `toUserId` | string | no |
| `toName` | string | yes |
| `purpose` | string | yes |
| `fields` | array of string | yes |
| `lawfulBasisId` | string | yes |
| `classification` | object { level, sensitive, handling } | yes |
| `accessRestriction` | "none" \| "restricted" | yes |
| `status` | "open" \| "responded" \| "declined" | yes |
| `createdAt` | string (date-time) | yes |
| `dueAt` | string (date) | no |
| `response` | object { at, byName, text, fieldsProvided } | no |

### ConnectorEvent

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `connectorId` | enum (10 values) | yes |
| `agency` | enum (11 values) | yes |
| `subjectId` | string | yes |
| `receivedAt` | string (date-time) | yes |
| `externalRef` | string | yes |
| `sourcePayload` | object | yes |
| `mapped` | object { eventType, title, detail, occurredAt, hasTime, significance, mappingRule } | yes |
| `status` | "pending" \| "promoted" \| "dismissed" | yes |
| `reviewedByUserId` | string | no |
| `reviewedAt` | string (date-time) | no |
| `promotedEventId` | string | no |

### AuditEntry

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `synthetic` | literal true | yes |
| `at` | string (date-time) | yes |
| `userId` | string | yes |
| `userName` | string | yes |
| `agency` | enum (11 values) | yes |
| `act` | enum (12 values) | yes |
| `targetType` | enum (9 values) | yes |
| `targetId` | string | yes |
| `targetLabel` | string | yes |
| `processId` | string | no |
| `reason` | string | no |
| `restricted` | boolean | yes |
| `expiresAt` | string (date-time) | no |

### ClockRule

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `process` | "asp" \| "cp" \| "marac" \| "mappa" \| "awi" | yes |
| `unit` | "hours" \| "calendar-days" \| "working-days" \| "weeks" \| "months" | yes |
| `amount` | number | yes |
| `kind` | "deadline" \| "warning" \| "expiry" \| "review" | yes |
| `direction` | "after" \| "before" | no |
| `warnDays` | integer | yes |
| `source` | string | yes |
| `sourceRef` | string | no |
| `confidence` | "high" \| "verify" \| "local" \| "advisory" | yes |
| `localNote` | string | no |
| `todoVerify` | boolean | no |
| `deferrable` | boolean | no |
| `deferralNote` | string | no |

### NeedToKnowRow

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `process` | "asp" \| "cp" \| "marac" \| "mappa" \| "awi" | yes |
| `stage` | enum (29 values) | yes |
| `audience` | object { agency, role, label } | yes |
| `detailLevel` | "presence" \| "summary" \| "full" \| "fields" | yes |
| `fields` | array of string | no |
| `channel` | "in-app" \| "secure-email-digest" \| "connector-push" | yes |
| `trigger` | string | yes |
| `condition` | string | no |
| `conditionLabel` | string | no |
| `lawfulBasisHint` | string | yes |

### Exclusion

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `process` | "asp" \| "cp" \| "marac" \| "mappa" \| "awi" | yes |
| `stage` | enum (29 values) or literal "*" | yes |
| `party` | enum (8 values) | yes |
| `label` | string | yes |
| `reason` | string | yes |
| `liftableBy` | string | no |

### Config

| Field | Type | Required |
|---|---|---|
| `area` | object { councilName, hscpName, healthBoardName, policeDivision, ppuBase, maracArea, sheriffCourt } | yes |
| `clockRules` | array of object { id, process, unit, amount, kind, direction, warnDays, source, sourceRef, confidence, localNote, todoVerify, deferrable, deferralNote } | yes |
| `needToKnow` | array of object { id, process, stage, audience, detailLevel, fields, channel, trigger, condition, conditionLabel, lawfulBasisHint } | yes |
| `exclusions` | array of object { id, process, stage, party, label, reason, liftableBy } | yes |
| `classificationMarkings` | array of object { id, handling, instructions } | yes |
| `classificationLowerableBy` | array of enum (38 values) | yes |
| `officialSensitiveWithheldFrom` | array of enum (38 values) | yes |
| `forms` | array of object { id, label, process, version, effectiveFrom, source } | yes |
| `defaults` | object { theme, density } | yes |
| `aspCouncilOfficerEligibility` | array of string | yes |
| `bankHolidays` | array of string | yes |
| `councilHolidays` | array of string | yes |
| `breakGlassHours` | integer | yes |
| `breakGlassReasons` | array of string | yes |
| `guidanceEditions` | array of object { id, label, edition } | yes |

