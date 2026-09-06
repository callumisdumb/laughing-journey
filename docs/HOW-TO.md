# How to do things

A practitioner's guide to moving work through Person360: which button records what, who may press it, what it needs to be true first, and what happens elsewhere in the product when it is pressed. It is written from the stage engine's own tables (`packages/domain/src/processes/transitions.ts` and `stages/`), which are the source of truth; the stage names and button labels are the catalogue's, so they read here as they read on screen. Where this document and the product disagree, the product's **What happens next** panel is right and this document needs correcting.

Everything here is driven end to end by a test that creates the thing from nothing and has a second persona read the consequence (`apps/web/e2e/flows.spec.ts`, `meetings.spec.ts`, `actions.spec.ts`, `cross-persona.spec.ts`). Seeded cases are for the demonstration to look populated; nothing below depends on one.

## 1. The rules every case follows

- **A case moves when a decision is recorded, never by picking a stage.** There is no stage picker anywhere. The stepper at the top of a case record shows where the case is; the **What happens next** panel under it lists every decision the current stage carries, one button each, with a line saying "# decisions this stage carries".
- **Each button says what it does before you press it.** "Moves the case to Screening", or "Records a step; the case stays where it is". A button you may not press is disabled and names the roles that record it. A button the record is not ready for says what is missing and offers the thing that records it ("Go to Record screening decision", "Record it"), so a refusal is always a route.
- **A decision a meeting makes is recorded by closing the meeting.** The panel says "Case conference held is recorded when the ASP case conference is held" with a link to the meeting once it is scheduled, or "Schedule it first". The close button on the meeting workspace opens the outcome form of that decision; the meeting is marked held as a consequence of recording it.
- **Recording a decision puts you on the case.** Your membership carries the decision as its reason, beside anybody the decision seats (a chair, a coordinator, a Mental Health Officer).
- **Every decision writes the same things.** A stage history entry, a chronology milestone, an audit entry, the clocks it completes and starts (the toast says "Clocks completed: ... Clocks started: ..."), a notification to every member and to every audience the need-to-know matrix names, each at their own detail level, and, where the tables say so, a meeting, a plan and its actions, information requests to agencies, a closure or a linked case.
- **Forward only.** The way back is **Reopen the case** after a closure, which resumes the clocks the closure stopped, or a decision whose form asks for a reason to return.
- **The same sentences appear in three places.** The panel on the case, the **What happens next** section of the context drawer, and the demo panel all read the tables; if one of them says something different from another, that is a bug.

## 2. Where things are

| Screen | What you do there |
|---|---|
| Home | Your clocks (from the cases you are on), your actions, and unread notifications by kind. |
| Worklist | Actions and inbox items waiting on you; bulk **Mark complete** for actions. |
| Notifications (the bell, or the Notifications page) | Everything sent to you or to a role you hold; **Mark all read**; dismiss. What you read depends on your access to the case it concerns. |
| People, then a person record | The header: identity on the left, the case status and the action row on the right. **Start a process**, **Edit the record**, **Add an alert**, and **More** for the rare actions (Merge with another record, Record a death). The overview: clocks, alerts, key contacts, the Household and network card (add someone, record a relationship, record a move, rename, show the diagram), views and voice, recent chronology, current plans, and the history of the record collapsed until opened. |
| Processes, then a case record | The stepper, **What happens next**, the panels for that process type, plans, clocks, membership, **Close the case**, **Reopen the case**, and at presence level **Ask to be involved**. |
| Meetings | Every meeting you can read; **Schedule a meeting** (it asks for the case first); the meeting workspace with its Before, During and After phases. |
| Actions | Every action you can read; **Add an action**; **Take** a role's action; reassign, complete, cancel. |
| Sharing | Outbound shares; the **Inbound** tab, where requests made of you or your agency wait with a **Respond** button. |
| The create button in the top bar | "What would you like to record?" Hands over to the screens' own dialogs for a person, a case, a meeting, an action, a plan, a chronology entry, the person's own words, an alert, a protection order, a disclosure, a visit, an investigation or a register entry. |
| The context drawer (right) | Who is involved and why, need to know at this stage, lawful basis, what happens next, what has been sent to you about the case, and the audit trail of the selected record. |
| The demo panel (Control, Shift and D) | Switch persona, move the demo clock, jump to a chapter of `docs/DEMO.md`, reset to seed. Not part of the product. |

### The personas

Every role the tables name is held by a seeded persona. Switch with the persona control in the top bar or from the demo panel.

| Persona | Role | Agency |
|---|---|---|
| Anne Hendry | Team leader | Clydeshore Council |
| Moira Gilmour | Council officer (adult support and protection) | Clydeshore HSCP |
| Stuart Blair | Social worker, adults | Clydeshore HSCP |
| Janet Kerr | Social worker, children | Clydeshore Council |
| David Laird | Independent reviewing chair | Clydeshore Council |
| Lesley Morton | Minute taker | Clydeshore Council |
| Graeme Dunlop | Mental Health Officer | Clydeshore HSCP |
| Karen Findlay | MARAC coordinator | Clydeshore Council |
| Ross Mowat | MAPPA coordinator | Clydeshore Council |
| Helen Rae | Justice social worker | Clydeshore Council |
| Colin Beattie | Prison social worker | Scottish Prison Service |
| Paul Mackay | Detective sergeant, public protection unit | Police Scotland |
| Ewan Sutherland | Domestic abuse officer | Police Scotland |
| Priya Sharif | Offender management | Police Scotland |
| Gavin Brodie | Concern hub officer | Police Scotland |
| Fiona Ross | Child protection nurse adviser | NHS Clydeshore |
| Amira Farouk | General practitioner | NHS Clydeshore |
| Sunita Rao | Health visitor | NHS Clydeshore |
| Kasia Nowicka | Midwife | NHS Clydeshore |
| Louise Kennedy | Community mental health nurse | NHS Clydeshore |
| Heather Aitken | Discharge coordinator | NHS Clydeshore |
| Mark Hepburn | Housing officer | Clydeshore Council |
| Claire Cowan | Education child protection lead | Clydeshore Council |
| Sadia Qureshi | Independent domestic abuse advocate | Women's Aid |
| Erin Lamont | Women's Aid worker | Women's Aid |
| Tam Guthrie | Independent advocate | Clydeshore Advocacy |
| Andrew Muirhead | Chief Social Work Officer | Clydeshore Council |
| Isla Crawford | Reporter | SCRA |
| Alistair Meek | Office of the Public Guardian officer | Office of the Public Guardian |
| Jean Hogg | Mental Welfare Commission officer | Mental Welfare Commission |

Oversight roles (the Chief Social Work Officer, the committee lead officers, inspectors, the regulators) read; they do not record decisions and are not offered **Ask to be involved**.

## 3. Starting a case

From the person record, **Start a process** opens "Start a process for {name}". All five process types are listed with two answers each: whether the person is eligible (age, an existing case, a pre-birth record) and whether you may open it, and both say why when the answer is no. An open case of the same type is shown first, and **Start a second case anyway** takes a reason. A MARAC referral asks who the perpetrator is before it will open, because the case-role register that keeps them out of the record is derived from the referral. The source of the concern and a summary are the other two things every opening asks.

Opening writes the reference, the opening stage and its history entry, the classification, the case-role register, the members the need-to-know matrix seats at the opening stage, and the notifications those members receive. It starts no clock unless the process's own rule table starts one at opening; a MARAC referral starts none, and the dialog says so.

## 4. Adult support and protection

Stages: Adult concern, Screening, Inquiry (s4), Inquiry using investigatory powers, Case conference, Protection plan or Support plan, Review, Closed.

| At this stage | Decision | Who records it | What it needs first | What it asks | What it does |
|---|---|---|---|---|---|
| Adult concern | **Record screening decision** | Team leader | The three-point test, unless the outcome is no further ASP action; the panel offers the test if it is missing. Refused if a screening decision is already recorded. | Outcome (Proceed to inquiry, Emergency action, No further ASP action) and the rationale. No further action asks the closure reason from the workbook's action-taken list. | Completes the **Inquiry decision** clock. Proceed moves the case to Screening. Emergency action moves it straight to Inquiry using investigatory powers and offers a protection order. No further action closes the case. |
| Screening | **Open inquiry (s4)** | Council officer, team leader | A screening outcome of Proceed to inquiry; otherwise the panel points back to the screening decision. | The purpose of the inquiry, the agencies to contact, and whether to hold an inter-agency discussion. | Sends one information request to each agency (it lands on their Sharing inbound tab and as a notification), moves the case to Inquiry (s4), and offers to schedule an ASP inter-agency discussion. |
| Inquiry (s4) | **Record inquiry outcome** | Council officer | The inquiry opened. | Outcome (Proceed to investigation, Support only, No further action), the action taken from the workbook list, the rationale, and the consent, capacity, undue pressure and advocacy findings. | Proceed moves the case to Inquiry using investigatory powers. Support only moves it to Support plan. No further action closes it with the reason given. |
| Inquiry using investigatory powers | **Record investigatory step** (repeatable) | Council officer, social worker (adults) | The investigation opened. | Which power: a s7 visit (who attended, whether the adult was present), a s8 interview (with whom, whether the adult declined), a s9 medical examination (practitioner, consent, outcome) or a s10 records request (holder, agency, records sought, lawful basis). | Adds the step to the investigation record. A s10 request sends an information request to the records holder. The case stays where it is. |
| Inquiry using investigatory powers | **Schedule case conference** (repeatable) | Council officer, team leader, chair, minute taker, social worker (adults) | The investigation opened. | Date, place, chair, minute taker and the invite list, proposed from need-to-know with everybody left off recorded with the reason. | Creates the ASP case conference and tells every invitee. The **Initial ASP case conference** clock has been running since the inquiry decision. |
| Inquiry using investigatory powers | **Case conference held**, by closing the case conference | Chair, council officer, team leader | The conference scheduled. | Whether the adult is at risk, whether a protection plan is needed, and the rationale. | Moves the case to Case conference, completes the case conference clock, and marks the meeting held. |
| Case conference | **Record protection plan** | Chair, council officer | The conference held. | The plan: a title, outcomes as rows, the coordinator, the review date, and the actions with owners and due dates. | Moves the case to Protection plan, starts the **Adult Protection Plan review** clock, and assigns each action, telling its owner. |
| Case conference, Support plan | **Record support plan** | Chair, council officer, social worker (adults) | Nothing further. | The plan, as above. | Moves the case to Support plan and assigns the actions. |
| Protection plan, Support plan, Review | **Schedule review** (repeatable) | The schedulers above | A plan recorded. | The meeting details. | Creates the ASP review case conference and tells the invitees. |
| Protection plan, Support plan, Review | **Record review outcome**, by closing the review conference | Chair, council officer, team leader | A plan recorded. | The decision (continue, with a new review date, or close), the rationale, and the closure reason if closing. | Records the plan review, completes the plan review clock and starts the next one from the new date, moves the case to Review, or closes it. |
| Any open stage | **Close** | Council officer, team leader, chair, social worker (adults) | Nothing further. | The reason from the workbook's action-taken list and a note. | Stops every clock with the closure as its note, tells the contributing agencies at their level, and proposes the outbound write that closes the episode in the source system. |

The three-point test, protection orders (with the clocks a grant starts), the adult's views and alerts are recorded from the panels on the case rather than as decisions, and the decisions above read them.

## 5. Child protection

Stages: Child concern, IRD, Investigation, CPPM, Child's plan, Review, De-registered, Closed. A pre-birth case runs the same stages and the same forms; the schedule dialog offers only the pre-birth planning meeting on it, and **Record the birth** swaps the pre-birth clocks for the child protection clocks.

| At this stage | Decision | Who records it | What it needs first | What it asks | What it does |
|---|---|---|---|---|---|
| Child concern | **Convene IRD** | Social worker (children), team leader, detective sergeant, concern hub officer | Nothing further. | When, whether out of hours, and who attends. | Creates the Inter-agency Referral Discussion, tells the invitees, and moves the case to IRD. |
| IRD | **Record IRD decisions**, by closing the IRD | Social worker (children), team leader, detective sergeant | The IRD convened. | The seven decisions, each with its rationale: significant harm, whether to investigate, a joint investigative interview, a medical examination and its kind, emergency measures, referral to the Reporter, and whether the parents are informed; the child's views sought, siblings considered, each agency's contribution, any dissent, an interim safety plan, and if there is no investigation the route (close, or single agency) and why. | Investigate moves the case to Investigation and starts the **Initial Child Protection Planning Meeting** clock (28 days from the IRD). An interim safety plan is recorded with its actions. No investigation closes the case or leaves it with one agency. |
| Investigation | **Record joint investigative interview** (repeatable) | Social worker (children), team leader, detective sergeant | The investigation opened. | When, and a summary. | Adds it to the investigation record. |
| Investigation | **Record medical examination** (repeatable) | Social worker (children), team leader, child protection nurse adviser, detective sergeant | The investigation opened. | When, the kind (joint paediatric forensic, or comprehensive) and a summary. | Adds it to the investigation record. |
| Investigation | **Schedule planning meeting** (repeatable) | Social worker (children), team leader, chair, minute taker | The investigation opened. | The meeting details, whether the parents are invited or excluded with the reason, and whether the child is invited. | Creates the Child Protection Planning Meeting (or the pre-birth one), starts the **notice** clock counting back from the meeting date, and tells the invitees. Rescheduling moves the notice period; cancelling completes it. |
| Investigation | **Planning meeting held**, by closing the CPPM | Chair | The CPPM scheduled. | Whether it was quorate; the decision (Register, Do not register) with the concerns and any local category; the rationale; the core group, seated from the people at the meeting; the lead professional and named person; and the child's plan with its actions. | Registered, which requires the plan, moves the case to Child's plan, completes the initial meeting clock, starts the **first core group** and **record distributed** clocks, and assigns the plan's actions. Not registered moves it to CPPM with the reason. Inquorate keeps the case where it is, starts the **reconvened** clock and offers a reschedule. |
| Child's plan, Review | **Record core group meeting** (repeatable), by closing a core group meeting or from the case | Social worker (children), team leader, health visitor, education child protection lead, child protection nurse adviser, chair | Nothing further. | When, who was present, progress against the plan, and whether there has been a significant change. | A significant change starts the **escalated to the chair** clock. |
| Child's plan, Review | **Schedule review planning meeting** (repeatable) | The schedulers above | Nothing further. | As for the planning meeting. | Creates the review CPPM and starts the notice clock. |
| Child's plan, Review | **Review planning meeting held**, by closing the review CPPM | Chair | The review scheduled. | Quorate; the decision (continue, or de-register with the national reason); the rationale. | Continue completes the review clock and starts the next (**subsequent review**) and the record distributed clock; de-register closes the case with the national statistics reason and stops every clock. Inquorate starts the reconvened clock. |
| Child's plan, Review | **De-register** | Chair, team leader | Nothing further. | The reason from the de-registration list and a note. | Moves the case to De-registered, closes it and stops the clocks. |
| Any open stage of a pre-birth case | **Record the birth** | Midwife, health visitor, social worker (children), team leader | A pre-birth record. | The date and time of birth. | Replaces the pre-birth clocks with the initial planning meeting and first review clocks, and writes the birth to the chronology. |
| Any open stage | **Close** | Social worker (children), team leader, chair | Nothing further. | The de-registration reason and a note. | As for ASP. |

## 6. MARAC

Stages: Referral, Research, Meeting, Action plan, Feedback, Transferred, Closed. A referral opens with a risk assessment optional (a professional judgement referral) and the perpetrator named; the DASH is attached from the case afterwards.

| At this stage | Decision | Who records it | What it needs first | What it asks | What it does |
|---|---|---|---|---|---|
| Referral, Research | **Schedule MARAC** (repeatable) | MARAC coordinator | Nothing further. | The meeting details. | Creates the MARAC meeting and tells the invitees. The perpetrator and their associates are never seated. |
| Referral | **Send research requests** | MARAC coordinator | Nothing further. | The agencies to ask, the wording, and the date due. | Sends one information request per agency, starts the **research return** clock (five working days), and moves the case to Research. |
| Research | **Record research return** (repeatable) | Any agency the protocol names, usually from Sharing, Inbound, **Respond** | A request outstanding. | The return, or Nothing known to this agency, and the confirmation that it is relevant, necessary and proportionate. | Writes the return on the case and the response on the request, tells the coordinator, and completes the research clock when every return is in. |
| Research | **Heard at MARAC**, by closing the MARAC | MARAC coordinator, chair | The meeting scheduled. | What each agency shared and the risk discussion. | Moves the case to Meeting, completes the research clock and starts the twelve month **repeat window**. |
| Meeting | **Record action plan** | MARAC coordinator, chair | The case heard. | The plan with its actions and owners, the agency flags placed (agency, system, receipt reference) and when they expire, and whether MATAC and DSDAS were considered. | Moves the case to Action plan, assigns the actions, and starts the **flag expiry** clock. |
| Meeting, Action plan, Feedback | **Open a child concern** (repeatable) | MARAC coordinator, social worker (children), team leader, chair | Nothing further. | Which children (those the case knows of, or any other) and the concern. | Opens a child protection case at Child concern for the children, authorised by this decision, or links to one already open; adds children the referral did not name to it; writes the link on both cases. |
| Action plan, Feedback | **Record IDAA feedback** (repeatable) | Independent domestic abuse advocate, MARAC coordinator, Women's Aid worker | A plan recorded. | The feedback and the victim's response. | Moves the case to Feedback. |
| Any open stage | **Transfer to another area** | MARAC coordinator | Nothing further. | The receiving area and coordinator. | Moves the case to Transferred. |
| Any open stage | **Close** | MARAC coordinator | Nothing further. | A reason from the locally agreed list, labelled as local, and a note. | As for ASP. |

## 7. MAPPA

Stages: Notification, Referral, Pre-meeting sharing, Meeting, Managed, Exit. A level 1 case sits at Notification and is managed there: disclosure, exit and a referral up are its decisions, and it never has a meeting. The record is restricted; everybody who is not a member reads presence only, and the Responsible Authority agencies may break glass for four hours with a reason.

| At this stage | Decision | Who records it | What it needs first | What it asks | What it does |
|---|---|---|---|---|---|
| Notification | **Refer to level 2 or 3**, through the referral dialog | Offender management, justice social worker, prison social worker, MAPPA coordinator, detective sergeant | A risk assessment, recorded first from the case (**Record risk assessment**: tool, date, assessor, band). | The level sought, the reason, the referring authority, the category, the ViSOR reference, whether the risk is imminent, victim considerations, and who must not receive information. | Moves the case to Referral. The level the case is managed at does not change until a meeting sets it. |
| Referral, Managed | **Request pre-meeting returns** | MAPPA coordinator | The referral recorded. | The agencies and their contacts, and the date due. | Sends one information request per agency and moves the case to Pre-meeting sharing. |
| Pre-meeting sharing | **Record pre-meeting return** (repeatable) | Any Responsible Authority or duty-to-cooperate role, usually from Sharing, Inbound, **Respond** | A request outstanding. | The return, or nothing known. | Writes the return on the case and the response on the request, and tells the coordinator. |
| Pre-meeting sharing, Managed | **Schedule MAPPA meeting** | MAPPA coordinator | The referral recorded. | The meeting details, as a Level 2 meeting or a MAPPP. | Creates the meeting, tells the invitees, and moves the case to Meeting. Victims are never seated. |
| Meeting | **MAPPA meeting held**, by closing the meeting | Chair, MAPPA coordinator | The meeting scheduled. | The level the meeting sets and why, the risk management plan (the plan with its actions, plus triggers, contingencies, controls, victim safety, accommodation, employment and associates), victim considerations, and the review date. | Moves the case to Managed at that level, records the level history, assigns the actions, and starts the level's **review** clock. |
| Notification, Managed, Meeting | **Record disclosure decision** (repeatable), through the disclosure dialog | MAPPA coordinator, chair, offender management | Nothing further. | The facts to be disclosed, to whom, and the decision. | Adds the disclosure to the register, opening pending. |
| Notification, Managed | **Exit MAPPA** | MAPPA coordinator, chair | Nothing further. | How the case leaves (Level down, Deregistration, Transfer, with the area) and a note. | Moves the case to Exit, completes the review clocks and closes it. |

## 8. Adults with incapacity

Stages: Capacity concern, Existing powers, Route decision, Application, Order, Supervision, Closed.

| At this stage | Decision | Who records it | What it needs first | What it asks | What it does |
|---|---|---|---|---|---|
| Any open stage | **Record capacity assessment** (repeatable), through the capacity assessment dialog | Mental Health Officer, general practitioner, community mental health nurse, social worker (adults), team leader | Nothing further. | The assessment. | Adds it to the case; the route decision reads it. |
| Capacity concern | **Check existing powers** | Social worker (adults), Mental Health Officer, team leader, council officer | Nothing further. | The Office of the Public Guardian reference; whether a power of attorney exists (kind, attorney, registration); whether a guardianship exists (guardian, powers, expiry). | Moves the case to Existing powers. |
| Existing powers | **Record route decision** | Mental Health Officer, social worker (adults), team leader | The powers checked and a capacity assessment recorded; the panel offers both. | The route (informal support; section 13ZA; the power of attorney covers it; an intervention order; welfare, financial or combined guardianship; a Part 5 certificate), the rationale, whether section 13ZA was considered and any objection, and the adult's will and preferences (past and present wishes, how they communicate, who else was consulted). | Moves the case to Route decision and offers what follows: close for informal support, a power of attorney or a Part 5 certificate; begin supervision for section 13ZA; open an application for an order. |
| Route decision | **Open application** | Mental Health Officer, social worker (adults), team leader | A route that is an application. | Council or private applicant and their name, the solicitor, the powers sought, the Mental Health Officer, and the sheriff court. | Moves the case to Application and starts the **MHO report** clock (21 days). |
| Application | **Record report** (repeatable) | Mental Health Officer, social worker (adults), team leader, general practitioner | Nothing further. | A medical report (practitioner, whether an approved medical practitioner, date received) or the MHO report (date submitted). | The MHO report completes its clock. |
| Application | **Record court event** (repeatable) | Mental Health Officer, social worker (adults), team leader | Nothing further. | Lodged; interim order granted, with its expiry; hearing set; or order granted, with the kind, the guardian, the powers and the expiry. | An interim order starts the **interim duration** and **statutory maximum** clocks from the London midnight of its date. An order granted completes them and the MHO report clock and moves the case to Order. |
| Order, Route decision (section 13ZA) | **Begin supervision** | Social worker (adults), team leader, Mental Health Officer | An order granted, or the section 13ZA route. | The supervising officer and the first visit date. | Moves the case to Supervision. |
| Supervision | **Record supervision visit** (repeatable), through the visit dialog | Social worker (adults), Mental Health Officer, team leader | Nothing further. | What was seen and what was said. | Adds the visit to the supervision record. |
| Any open stage | **Record investigation (s10 or s12)** (repeatable), through the investigation dialog | Social worker (adults), Mental Health Officer, team leader | Nothing further. | Which section, and the investigation. | Adds it to the case. |
| Any open stage | **Close** | Social worker (adults), Mental Health Officer, team leader | Nothing further. | A reason from the locally agreed list, labelled as local, and a note. | As for ASP. |

## 9. Meetings

**Scheduling.** Three places, one answer. On a case, the **What happens next** panel offers the meeting the stage schedules (a case conference, an IRD, a planning meeting, a MARAC, a MAPPA meeting). On the Meetings screen, **Schedule a meeting** asks which case first and only lists the open cases you can work on. The create button does the same. The type decides the route: a type the tables schedule from the case's current stage goes through the stage engine and records the scheduling as a decision; a type the tables do not schedule (an ASP inter-agency discussion, a Large Scale Investigation planning meeting, an AWI multi-disciplinary discussion) is scheduled as a plain meeting; and a type the tables schedule from a stage the case has not reached is refused, naming the stages.

**The invite list** is proposed from need-to-know for the stage (**Generate from need-to-know**), and every invitee carries the reason they are there. Everybody the rules leave off is recorded on the meeting with the reason, and the header shows them: a role whose row gives less than full detail, a party excluded by their case role, a name held back for a near-match confirmation, and anybody you untick by hand. A perpetrator, their associates and a MAPPA victim can never be seated. Every invitee is told.

**Changing it.** **Reschedule** and **Cancel meeting** in the header each take a reason and tell every invitee. Rescheduling a planning meeting moves its notice period to count back from the new date; cancelling one completes the notice clock with the cancellation as its note. **Reconvene** appears on a meeting recorded as inquorate and schedules the new one.

**Running it.** The workspace has three phases. Before: the invite list, pre-meeting information requests and returns (**Send request** asks an agency and its return comes back to this list and to your notifications), and the pack builder. During: the agenda, attendance, the views read into the record (the child's or the adult's own words, with who took them and how), information shared by agency, decisions with rationale and dissent (**Record decision**), and actions captured live. After: the minute and its approval, the distribution list (**Generate from need-to-know**, then **Distribute to N recipients**, which writes a sharing record per recipient at their detail level and tells them), the clocks after this meeting, and **Print minutes**.

**Closing it.** **Close meeting** opens the outcome form of the decision the meeting's type records from the case's stage, and says so: "Closing this meeting records Planning meeting held, which moves the case to Child's plan." Recording it marks the meeting held. A meeting with nothing to decide on the case says "Nothing on the case is decided by closing this meeting" and its minute opens. A meeting whose decision belongs to a stage the case has not reached is refused with what to record first.

## 10. Actions

**Adding one.** **Add an action** on the Actions screen, on a case, on a plan, on a meeting, or from the create button; a plan recorded by a decision creates its actions with it. An action asks for a title, who owns it (a named person the case permits, or everybody holding a role), when it is due, and the plan it sits under if any. Membership is not the test for an owner: a party the case-role register excludes can never own one, and a person who could not open the case cannot be asked to work on it; the refusal reads the same wherever the action is added.

**A role's action** sits on every holder's worklist until one of them presses **Take**, which reassigns it from the role to the person and tells the other holders. **Reassign** moves it to another person or role and tells both sides. **Record completion** asks for evidence (what was done, when, and how you know) and tells whoever asked for it. **Cancel the action** keeps it on the record with the reason. Nothing deletes an action.

**Being chased.** The owner is told when the action is due, and again when it falls overdue; the lead is told when it falls overdue and once more when it has sat there past the escalation interval, which Admin sets under Defaults. Home and the Worklist show the same list.

## 11. Requests between agencies

A decision that asks agencies for something (an inquiry's agencies to contact, a s10 records request, MARAC research, MAPPA pre-meeting returns) writes one information request per agency and tells that agency. The request appears on the agency's **Sharing, Inbound** tab with a **Respond** button; the request and its purpose, and the fields asked for, are in the dialog. A MARAC research request asks for the return, or **Nothing known to this agency** (a nil return is still a return), and the confirmation that it is relevant, necessary and proportionate, which the protocol requires before anything is shared at the meeting. The response carries the request's lawful basis, is recorded on the case as your agency's return, and reaches the person who asked as a notification. When every MARAC return is in, the research clock completes on its own.

## 12. Being told

Every consequence of a decision reaches the people it concerns as a notification: a share, a request or its return, an action assigned, reassigned, completed, due or overdue, a meeting invitation, change or cancellation, a distributed minute, a stage change, being added to or removed from a case, an inbox arrival, a break-glass read (to the lead), a raised classification, a register near match, a clock warning or breach, and a request to be involved or its decision.

What you read depends on your access to the case. A member or an audience the matrix gives fields to reads the sentence with the case reference and who acted; an audience the matrix gives presence to reads that a case they are linked to has changed, and nothing more; an excluded party is never a recipient. The bell shows the unread count, the panel lists everything by case, **Mark all read** clears it, and a dismissed notification is hidden and never deleted. A notification addressed to a role is one record, and the first holder to read it reads it for the role. Nothing is sent outside the product: no email, no text.

## 13. Asking to be involved

On a case you can see exists and nothing more, the header offers **Ask to be involved**. Say why you need to be on it; the request is recorded and the lead is told. Anybody on the case opens **Requests to be involved** from the case, reads the reason, and presses **Accept** or **Decline** with an optional note; you are told the decision. Accepted, you join the members with your reason and the decider's name on the membership, which is the sentence the drawer's "who is involved" then shows, and the case opens to you at the level your role's row gives. One request at a time: a second while one is pending is refused. The button is not offered to oversight roles or to a party the register excludes.

## 14. Closing and reopening

**Close the case** asks why, from the list that process's own national return uses (the de-registration reasons for child protection, the action-taken rows of the ASP workbook, the exit kinds for MAPPA), or from a locally agreed list labelled as local for MARAC and adults with incapacity, and a sentence or two that goes into the closure notice every agency receives. The dialog lists the clocks the closure will stop before the button. **Reopen the case** takes a reason, returns the case to the stage it was at, and resumes the clocks the closure stopped against the dates they started.

## 15. A worked example: an adult concern to a protection plan

An ASP case at Adult concern. The reference on your screen is the one to use; nothing below depends on which case it is.

1. Sign in as **Anne Hendry** (team leader). Open the case from Processes, or from the ASP badge on the person record. **What happens next** shows one decision: **Record screening decision**.
2. If the three-point test is not recorded and you intend to proceed, the button says so and offers the test. Record it from the three-point test panel on the case, one limb at a time with the reasoning.
3. Press **Record screening decision**. Choose **Proceed to inquiry**, write the rationale, press **Record**. The toast reads "Record screening decision recorded" and "Clocks completed: Inquiry decision". The stepper is at Screening, the chronology has the milestone, and every member and matrix audience has a notification at their own level. Anne is now on the case, with the decision as her reason.
4. Sign in as **Moira Gilmour** (council officer). **What happens next** shows **Open inquiry (s4)**. Write the purpose, tick the agencies to contact, say whether to hold an inter-agency discussion, press **Record**. The case is at Inquiry (s4); each agency has a request on its Sharing inbound tab and a notification; if you asked for the discussion, the schedule dialog is offered.
5. Sign in as one of the agencies asked, for example **Amira Farouk** (general practitioner). Sharing, Inbound, **Respond**: the return goes back to Moira as a notification and onto the case.
6. As Moira, **Record inquiry outcome**: **Proceed to investigation**, the action taken, the rationale, and the consent, capacity, undue pressure and advocacy findings. The case is at Inquiry using investigatory powers. Record the steps as they happen (**Record investigatory step**: a s7 visit, a s8 interview, a s10 records request), then **Schedule case conference**; the **Initial ASP case conference** clock has been counting since the inquiry decision.
7. Sign in as **David Laird** (chair). Meetings, open the case conference. Before: the invite list with reasons. During: the adult's views, what each agency shared, the decisions with any dissent. **Close meeting**: the form for **Case conference held** asks whether the adult is at risk, whether a protection plan is needed, and why. The case is at Case conference and the clock is complete.
8. As David, or as Moira, **Record protection plan**: outcomes as rows, the coordinator, the review date, and the actions with owners and due dates. The case is at Protection plan, the **Adult Protection Plan review** clock is running, and each owner has been told about their action; a role's action sits with every holder until one takes it.
9. Later, **Schedule review**, hold the review conference, and **Close meeting** records **Record review outcome**: continue with a new review date, or close the case with the reason from the workbook.

Switch persona at any point to see what the others were told: the allocated worker reads the sentence with the reference and the recorder, a role whose row gives presence reads that a case they are linked to has changed, and the perpetrator of a MARAC, or a MAPPA victim, reads nothing at all.

## 16. What you cannot do yet

`docs/HANDOVER.md` section 6 keeps the list of what practitioners still cannot do through the product, and it is kept there rather than here so there is one copy.
