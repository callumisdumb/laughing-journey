'use client';

import { AGENCY_SHORT, CP_REGISTER_CATEGORY_LABELS, formatDate, formatDateTime, type CpProcess } from '@mas/domain';
import { AgencyMark, KeyValue, Pill, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { differenceInCalendarDays, differenceInWeeks, parseISO, subWeeks } from 'date-fns';
import { Baby } from 'lucide-react';
import { AppLink } from '@/components/AppLink';
import { meetingPath, personPath, processPath } from '@/lib/routes';
import { fullName, personById, userById, userName } from '@/lib/selectors';
import { useData, useNow } from '@/lib/store';
import styles from './shared.module.css';

const DECISION_LABELS: Record<string, string> = {
  significantHarm: 'Is the child at risk of significant harm?',
  investigationNeeded: 'Is a child protection investigation needed?',
  jii: 'Is a Joint Investigative Interview needed?',
  medical: 'Is a medical needed?',
  emergencyMeasures: 'Emergency measures',
  reporterReferral: 'Referral to the Reporter',
  parentsInformed: 'Information sharing with parents and carers',
};

export function CpPanels({ process }: { process: CpProcess }) {
  const data = useData();
  const now = useNow();
  const d = process.detail;
  const ird = d.ird;
  const irdMeeting = ird?.meetingId ? data.meetings.find((m) => m.id === ird.meetingId) : undefined;
  const cppmMeeting = d.cppm?.meetingId ? data.meetings.find((m) => m.id === d.cppm?.meetingId) : undefined;
  const plan = d.childsPlanId ? data.plans.find((p) => p.id === d.childsPlanId) : undefined;
  const interim = ird?.interimSafetyPlanId ? data.plans.find((p) => p.id === ird.interimSafetyPlanId) : undefined;

  return (
    <>
      {d.preBirth ? (
        <Sheet tone="accent">
          <SheetHead
            title="Pre-birth"
            meta={(() => {
              const edd = parseISO(d.preBirth.expectedDeliveryDate);
              const weeks = 40 - differenceInWeeks(edd, now);
              const cap = subWeeks(edd, 12);
              const mother = personById(data, d.preBirth.motherPersonId);
              return `Expected delivery ${formatDate(edd)}. About ${weeks} weeks gestation today. 28 weeks falls on ${formatDate(cap)}: the pre-birth CPPM must be held by then. Mother: ${mother ? fullName(mother) : ''}.`;
            })()}
          />
          <SheetBody>
            <div className={styles.info}>
              <Baby size={16} aria-hidden="true" />
              <span>
                The subject of this process is the unborn baby. The mother is a parent here and may be the subject of her own process. {d.preBirth.motherPersonId ? <AppLink href={personPath(d.preBirth.motherPersonId)}>Open the mother&apos;s record</AppLink> : null}
              </span>
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title="Child concern" meta={`Received ${formatDateTime(d.concern.receivedAt)} from ${d.concern.source} (${AGENCY_SHORT[d.concern.sourceAgency]})${d.concern.sourceReference ? `, ${d.concern.sourceReference}` : ''}`} />
        <SheetBody>
          <p>{d.concern.summary}</p>
          {d.proceduresInitiatedAt ? <p className={styles.note} style={{ marginTop: 8 }}>Child protection procedures initiated {formatDateTime(d.proceduresInitiatedAt)}: the 28 calendar day CPPM clock runs from here.</p> : null}
        </SheetBody>
      </Sheet>

      {ird ? (
        <Sheet>
          <SheetHead title="Inter-agency Referral Discussion" meta={`Held ${formatDateTime(ird.heldAt)}${ird.outOfHours ? ' (out of hours)' : ''}. ${irdMeeting ? '' : 'No meeting record linked.'}`} actions={irdMeeting ? <AppLink href={meetingPath(irdMeeting.id)}>Open meeting record</AppLink> : undefined} />
          <SheetBody>
            <h3 style={{ marginBottom: 8 }}>Participants</h3>
            <div className={styles.pills} style={{ marginBottom: 14 }}>
              {ird.participants.map((p) => (
                <Pill key={p.name} size="sm" tone="outline" icon={<AgencyMark agency={p.agency} hideLabel />}>
                  {p.name}, {p.role}
                </Pill>
              ))}
            </div>
            <h3 style={{ marginBottom: 8 }}>Information from each agency</h3>
            <ul className={styles.list} style={{ marginBottom: 14 }}>
              {ird.contributions.map((c, i) => (
                <li key={i}>
                  <AgencyMark agency={c.agency} />
                  <span>
                    <strong>{c.byName}</strong>: {c.summary}
                  </span>
                </li>
              ))}
            </ul>
            <h3 style={{ marginBottom: 8 }}>Decisions, each with rationale</h3>
            <div className="stack" style={{ gap: 8 }}>
              {(Object.keys(DECISION_LABELS) as Array<keyof typeof ird.decisions>).map((k) => {
                const dec = ird.decisions[k];
                const dissent = irdMeeting?.decisions.find((x) => x.question.toLowerCase().includes(k === 'jii' ? 'jii' : k === 'medical' ? 'medical' : k === 'emergencyMeasures' ? 'emergency' : k === 'reporterReferral' ? 'reporter' : k === 'significantHarm' ? 'significant harm' : k === 'investigationNeeded' ? 'investigation' : 'parents'))?.dissent ?? [];
                return (
                  <div key={k} className={styles.decision} data-decided={dec.decided ? 'true' : 'false'}>
                    <span className={styles.decisionQ}>{DECISION_LABELS[k]}</span>
                    <span>{dec.decision}</span>
                    <span className={styles.decisionMeta}>
                      Rationale: {dec.rationale} {dec.at ? `Decided ${formatDateTime(dec.at)}${dec.byName ? ` by ${dec.byName}` : ''}.` : ''}
                      {'plannerName' in dec && dec.plannerName ? ` Planned by ${dec.plannerName}; informed by ${dec.informedBy ?? 'not recorded'}.` : ''}
                      {'kind' in dec && dec.kind ? ` Kind: ${dec.kind}${dec.consentBy ? `, consent by ${dec.consentBy}` : ''}${dec.when ? `, ${formatDateTime(dec.when)}` : ''}.` : ''}
                      {'withheld' in dec && dec.withheld ? ` Withheld: ${dec.withheld}.` : ''}
                    </span>
                    {dissent.map((ds, i) => (
                      <span key={i} className={styles.dissent}>
                        Dissent recorded: {ds.byName} ({AGENCY_SHORT[ds.agency]}): {ds.text}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
            <KeyValue
              className={styles.note}
              items={[
                { key: 'Siblings considered', value: ird.siblingsConsidered.length === 0 ? 'None' : ird.siblingsConsidered.map((id) => { const p = personById(data, id); return p ? fullName(p) : id; }).join(', ') },
                { key: "Child's views", value: ird.childViewsSought },
                { key: 'Interim safety plan', value: interim ? `${interim.title}: ${interim.outcomes.map((o) => o.text).join('; ')} (${interim.status})` : 'None recorded' },
              ]}
            />
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Investigation, JII and medical" />
          <SheetBody>
            {d.investigation ? (
              <KeyValue
                items={[
                  { key: 'Opened', value: formatDateTime(d.investigation.openedAt) },
                  { key: 'JII', value: d.investigation.jiiHeldAt ? `Held ${formatDateTime(d.investigation.jiiHeldAt)} under ${d.investigation.jiiModel ?? 'SCIM'}` : ird?.decisions.jii.decided && /^yes/i.test(ird.decisions.jii.decision) ? 'Planned, not yet held' : 'Not needed' },
                  { key: 'Medical', value: d.investigation.medicalHeldAt ? `Held ${formatDateTime(d.investigation.medicalHeldAt)}` : 'Not held' },
                  { key: 'Summary', value: d.investigation.summary },
                ]}
              />
            ) : (
              <p className={styles.note}>No investigation opened.</p>
            )}
          </SheetBody>
        </Sheet>
        <Sheet tone={d.register ? 'accent' : 'default'}>
          <SheetHead title="CPPM and register" actions={cppmMeeting ? <AppLink href={meetingPath(cppmMeeting.id)}>Open CPPM</AppLink> : undefined} />
          <SheetBody>
            <KeyValue
              items={[
                { key: 'CPPM', value: d.cppm ? `${d.cppm.heldAt ? `Held ${formatDateTime(d.cppm.heldAt)}. ` : ''}Decision: ${d.cppm.decision.replace('-', ' ')}. ${d.cppm.rationale ?? ''}` : 'Not yet held' },
                { key: 'Register', value: d.register ? <span className={styles.pills}><Pill tone="critical" size="sm">Registered {formatDate(d.register.registeredAt)}</Pill>{d.register.categories.map((c) => <Pill key={c} tone="high" size="sm">{CP_REGISTER_CATEGORY_LABELS[c]}</Pill>)}</span> : 'Not on the register' },
                ...(d.register?.deregisteredAt ? [{ key: 'De-registered', value: `${formatDate(d.register.deregisteredAt)}. ${d.register.deregistrationReason ?? ''}` }] : []),
                ...(d.register?.transfer ? [{ key: 'Transfer', value: `${d.register.transfer.direction} ${d.register.transfer.area} on ${formatDate(d.register.transfer.at)}` }] : []),
                { key: 'Days on register', value: d.register ? String(differenceInCalendarDays(now, parseISO(d.register.registeredAt))) : '' },
              ]}
            />
          </SheetBody>
        </Sheet>
      </div>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Core group" meta={d.coreGroup?.firstMeetingAt ? `First meeting ${formatDateTime(d.coreGroup.firstMeetingAt)}` : 'Not yet set up'} />
          <SheetBody>
            {d.coreGroup ? (
              <ul className={styles.list}>
                {d.coreGroup.memberUserIds.map((id) => {
                  const u = userById(data, id);
                  return u ? (
                    <li key={id}>
                      <AgencyMark agency={u.agency} hideLabel />
                      <span>
                        <strong>{userName(u)}</strong>
                        {id === d.coreGroup?.leadProfessionalUserId ? ' (lead professional)' : ''}
                        {id === d.coreGroup?.namedPersonUserId ? ' (named person)' : ''}
                      </span>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Child's plan" meta={plan ? `${plan.title}. Agreed ${formatDate(plan.agreedAt)}${plan.reviewDate ? `, review ${formatDate(plan.reviewDate)}` : ''}.` : 'No plan yet'} actions={plan ? <AppLink href={processPath(process.id)}>Actions below</AppLink> : undefined} />
          <SheetBody>
            {plan ? (
              <ol className={styles.list}>
                {plan.outcomes.map((o, i) => (
                  <li key={o.id}>
                    <span style={{ fontWeight: 700 }}>{i + 1}</span>
                    <span>
                      {o.text} <span className={styles.note}>({o.actionIds.length} {o.actionIds.length === 1 ? 'action' : 'actions'})</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </SheetBody>
        </Sheet>
      </div>
    </>
  );
}
