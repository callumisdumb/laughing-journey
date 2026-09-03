# Need-to-know matrices

Source of truth is `packages/domain/src/need-to-know/*.ts`. This document is kept in step with it and mirrors brief section 6. Detail levels: `presence`, `summary`, `full`, `fields`. Default is deny. Every notification tells the recipient why they receive it and under what lawful basis. Hard exclusions cannot be overridden in the UI.

## Global rules

- Default deny. A person on a case sees what their role and agency permit for that stage.
- Every notification shows the recipient why they are receiving it and the lawful basis.
- The subject's own views section is visible to the subject in full; subject access is designed as a "what the person would see" preview only.

## Case-role register

Hard exclusions name a party, not a person: "the perpetrator", "the perpetrator's family or associates", "victims". The case-role register on each process (`parties` in `packages/domain/src/schemas/process.ts`) says who holds those roles. A party entry carries a person id or a user id, the party key, a plain-language label ("Perpetrator (named in the referral)"), the date it applies from, where it came from and, for hand-recorded entries, the reason.

Entries come from three sources and are combined by `partyRegister` in `packages/domain/src/need-to-know/parties.ts`:

- `referral`: read from the case record. For MARAC the referral's `perpetratorPersonId` is the perpetrator. For MAPPA the `victimPersonIds` on the case are victims.
- `relationship`: derived from relationship records. Anyone recorded as the MARAC perpetrator's partner, former partner, sibling, parent, child, grandparent, grandchild, aunt or uncle, nephew or niece, relative, household member or associate, in either direction, is one of the perpetrator's family or associates. The victim and her children, whether listed in the referral or recorded as her children, are never derived as associates.
- `manual`: recorded by hand with a reason, for example a persona who is the perpetrator's cousin, or the alleged perpetrator at an ASP case conference. ASP and child protection record nothing automatically: the alleged perpetrator and the parents-if-risk decision are recorded by hand when they apply.

`isExcludedParty(process, { personId | userId })` matches a candidate against the register and the exclusion rows in force for the process type and stage. `accessFor` runs it first, before membership, roles or matrix rows, so an excluded party gets nothing (not even presence) and no break-glass. Invite and distribution generators skip excluded candidates and say how many were left off. The drawer lists the register under "Must not receive". Explicit entries win over derived ones with the same person and party. Hard exclusions cannot be lifted in the UI; where a rule carries `liftableBy`, the lift is a recorded decision on the case, not an edit to the register.

## ASP

| Stage | Full | Summary | Fields | Must not receive |
|---|---|---|---|---|
| Concern received | Council duty team, council officer | Referrer (acknowledgement and outcome only) | | |
| Inquiry | Council officer, team leader; police if criminal element; GP or community nurse for health input | Care provider (regulated service), housing | | |
| Investigation | Council officer, second worker, police (joint visit), health (s9 medical), records holders (s10 request) | Advocacy service, attorney or guardian | OPG (financial harm or attorney/guardian conduct) | |
| Case conference | Invited agencies, chair, minute taker, adult and advocate | Care Inspectorate (regulated service), MWC (welfare concerns about guardian or attorney) | | Alleged perpetrator, unless a household member with a right to be heard by chair's recorded decision |
| Protection plan | Plan owners, adult, advocate, carers with consent | Referrer (outcome) | | |
| Review and closure | As conference | Contributing agencies (closure notice) | | |

## Child protection

| Stage | Full | Summary | Fields | Must not receive |
|---|---|---|---|---|
| Concern received | Social work duty, police PPU | Named person | | |
| IRD | Social work senior, police DS, health CP adviser; education for school-age; midwifery for unborn | Lead professional, SCRA (referral decision), procurator fiscal (if JII) | Housing (if relevant) | Parents where sharing would jeopardise the investigation or increase risk (decision recorded) |
| Investigation and JII | Social work, police, health; JII interviewers | Education (attendance and safety) | School: interim safety plan actions relevant to school | |
| CPPM | Invitees, chair, minute taker, parents (unless excluded with reason), child (age-appropriate) | SCRA, GP | | |
| Registration and child's plan | Core group, named person, lead professional | Agencies with future contact (register check) | GP: registration status and category | |
| Review and de-registration | As CPPM | Register enquirers | | |

## MARAC

| Stage | Full | Summary | Fields | Must not receive |
|---|---|---|---|---|
| Referral | MARAC coordinator, IDAA, referring agency | | | Perpetrator, perpetrator's family or associates |
| Research request | Protocol agencies (victim, perpetrator and children names and DoB only) | | | Perpetrator and associates |
| Meeting | Attending representatives | | | Perpetrator and associates |
| Action plan | Action owners; IDAA (victim feedback) | Children's social work (if children), MAPPA coordinator (if perpetrator is MAPPA), MATAC | Health and housing: MARAC flag, 12 months | Perpetrator and associates |
| Transfer | Receiving MARAC coordinator | | | Perpetrator and associates |

## MAPPA

| Stage | Full | Summary | Fields | Must not receive |
|---|---|---|---|---|
| Notification | Lead Responsible Authority, MAPPA Coordinator | Other Responsible Authorities (presence) | | Victims (VNS is separate), employers, public |
| Referral (Level 2 and 3) | MAPPA Coordinator, single points of contact in each RA and relevant DTC agency | | | Victims, employers, public |
| Pre-meeting returns | MAPPA Coordinator, chair | | | Victims, employers, public |
| Meeting and RMP | Attendees (restricted minute) | Level and review date to case members | Housing: ERA conclusions and controls; school or employer only via a recorded disclosure decision | Anyone not on the distribution list; children's social work receives a specific disclosure where a child is in the household |
| Disclosure decision | Decision maker, recipient (specific facts only) | | | Victims, employers (beyond the disclosed facts), public |
| Exit | Responsible Authorities | | | Victims, employers, public |

## AWI

| Stage | Full | Summary | Fields | Must not receive |
|---|---|---|---|---|
| Capacity concern | Allocated worker, MHO (if welfare guardianship likely), GP or consultant | Discharge team, care provider | | |
| Existing powers | Worker | Attorney or guardian (that a check was made) | OPG register result | |
| Application | Applicant or solicitor, MHO, medical practitioners, court | Nearest relative, primary carer, named person, adult (notification and rights), independent advocate | | |
| Order granted | Guardian, supervising officer, OPG, MWC, care provider | GP | Financial institutions via OPG | |
| Supervision and investigation | Supervising officer, MWC (welfare), OPG (financial) | | | |
