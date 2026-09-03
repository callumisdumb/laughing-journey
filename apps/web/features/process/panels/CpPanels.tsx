'use client';

import { AGENCY_SHORT, CP_REGISTER_CATEGORY_LABELS, formatDate, formatDateTime, type CpProcess } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, KeyValue, Pill, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { differenceInCalendarDays, differenceInWeeks, parseISO, subWeeks } from 'date-fns';
import { Baby } from 'lucide-react';
import { AppLink } from '@/components/AppLink';
import { meetingPath, personPath, processPath } from '@/lib/routes';
import { fullName, personById, userById, userName } from '@/lib/selectors';
import { useData, useNow } from '@/lib/store';
import styles from './shared.module.css';

/** The IRD decisions in the order they are shown; each has a question under cp.ird.decisions. */
const DECISION_KEYS = ['significantHarm', 'investigationNeeded', 'jii', 'medical', 'emergencyMeasures', 'reporterReferral', 'parentsInformed'] as const;

export function CpPanels({ process }: { process: CpProcess }) {
  const t = useT();
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
            title={t('cp.preBirth.title')}
            meta={(() => {
              const edd = parseISO(d.preBirth.expectedDeliveryDate);
              const weeks = 40 - differenceInWeeks(edd, now);
              const cap = subWeeks(edd, 12);
              const mother = personById(data, d.preBirth.motherPersonId);
              return t('cp.preBirth.meta', { edd: formatDate(edd), weeks, cap: formatDate(cap), mother: mother ? fullName(mother) : '' });
            })()}
          />
          <SheetBody>
            <div className={styles.info}>
              <Baby size={16} aria-hidden="true" />
              <span>
                {t('cp.preBirth.note')} {d.preBirth.motherPersonId ? <AppLink href={personPath(d.preBirth.motherPersonId)}>{t('cp.preBirth.openMother')}</AppLink> : null}
              </span>
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title={t('cp.concern.title')} meta={t('cp.concern.meta', { when: formatDateTime(d.concern.receivedAt), source: d.concern.source, agency: AGENCY_SHORT[d.concern.sourceAgency], hasReference: d.concern.sourceReference ? 'yes' : 'no', reference: d.concern.sourceReference ?? '' })} />
        <SheetBody>
          <p>{d.concern.summary}</p>
          {d.proceduresInitiatedAt ? (
            <p className={styles.note} style={{ marginTop: 8 }}>
              {t('cp.concern.proceduresInitiated', { when: formatDateTime(d.proceduresInitiatedAt) })}
            </p>
          ) : null}
        </SheetBody>
      </Sheet>

      {ird ? (
        <Sheet>
          <SheetHead title={t('cp.ird.title')} meta={t('cp.ird.meta', { when: formatDateTime(ird.heldAt), outOfHours: ird.outOfHours ? 'yes' : 'no', hasMeeting: irdMeeting ? 'yes' : 'no' })} actions={irdMeeting ? <AppLink href={meetingPath(irdMeeting.id)}>{t('cp.ird.openMeeting')}</AppLink> : undefined} />
          <SheetBody>
            <h3 style={{ marginBottom: 8 }}>{t('cp.ird.participants')}</h3>
            <div className={styles.pills} style={{ marginBottom: 14 }}>
              {ird.participants.map((p) => (
                <Pill key={p.name} size="sm" tone="outline" icon={<AgencyMark agency={p.agency} hideLabel />}>
                  {t('cp.ird.participant', { name: p.name, role: p.role })}
                </Pill>
              ))}
            </div>
            <h3 style={{ marginBottom: 8 }}>{t('cp.ird.information')}</h3>
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
            <h3 style={{ marginBottom: 8 }}>{t('cp.ird.decisionsHeading')}</h3>
            <div className="stack" style={{ gap: 8 }}>
              {DECISION_KEYS.map((k) => {
                const dec = ird.decisions[k];
                const dissent = irdMeeting?.decisions.find((x) => x.question.toLowerCase().includes(k === 'jii' ? 'jii' : k === 'medical' ? 'medical' : k === 'emergencyMeasures' ? 'emergency' : k === 'reporterReferral' ? 'reporter' : k === 'significantHarm' ? 'significant harm' : k === 'investigationNeeded' ? 'investigation' : 'parents'))?.dissent ?? [];
                return (
                  <div key={k} className={styles.decision} data-decided={dec.decided ? 'true' : 'false'}>
                    <span className={styles.decisionQ}>{t(`cp.ird.decisions.${k}` as const)}</span>
                    <span>{dec.decision}</span>
                    <span className={styles.decisionMeta}>
                      {t('cp.ird.rationale', { rationale: dec.rationale })} {dec.at ? t('cp.ird.decided', { when: formatDateTime(dec.at), hasName: dec.byName ? 'yes' : 'no', name: dec.byName ?? '' }) : ''}
                      {'plannerName' in dec && dec.plannerName ? ` ${t('cp.ird.planned', { planner: dec.plannerName, hasInformedBy: dec.informedBy ? 'yes' : 'no', informedBy: dec.informedBy ?? '' })}` : ''}
                      {'kind' in dec && dec.kind ? ` ${t('cp.ird.kind', { kind: dec.kind, hasConsent: dec.consentBy ? 'yes' : 'no', consentBy: dec.consentBy ?? '', hasWhen: dec.when ? 'yes' : 'no', when: dec.when ? formatDateTime(dec.when) : '' })}` : ''}
                      {'withheld' in dec && dec.withheld ? ` ${t('cp.ird.withheld', { withheld: dec.withheld })}` : ''}
                    </span>
                    {dissent.map((ds, i) => (
                      <span key={i} className={styles.dissent}>
                        {t('cp.ird.dissent', { name: ds.byName, agency: AGENCY_SHORT[ds.agency], text: ds.text })}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
            <KeyValue
              className={styles.note}
              items={[
                { key: t('cp.ird.siblings'), value: ird.siblingsConsidered.length === 0 ? t('common.keyValue.none') : ird.siblingsConsidered.map((id) => { const p = personById(data, id); return p ? fullName(p) : id; }).join(', ') },
                { key: t('cp.ird.childViews'), value: ird.childViewsSought },
                { key: t('cp.ird.interimPlan'), value: interim ? t('cp.ird.interimPlanValue', { title: interim.title, outcomes: interim.outcomes.map((o) => o.text).join('; '), status: interim.status }) : t('cp.ird.interimPlanNone') },
              ]}
            />
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title={t('cp.investigation.title')} />
          <SheetBody>
            {d.investigation ? (
              <KeyValue
                items={[
                  { key: t('cp.investigation.opened'), value: formatDateTime(d.investigation.openedAt) },
                  { key: t('cp.investigation.jii'), value: d.investigation.jiiHeldAt ? t('cp.investigation.jiiHeld', { when: formatDateTime(d.investigation.jiiHeldAt), model: d.investigation.jiiModel ?? t('cp.investigation.jiiModelDefault') }) : ird?.decisions.jii.decided && /^yes/i.test(ird.decisions.jii.decision) ? t('cp.investigation.jiiPlanned') : t('cp.investigation.jiiNotNeeded') },
                  { key: t('cp.investigation.medical'), value: d.investigation.medicalHeldAt ? t('cp.investigation.medicalHeld', { when: formatDateTime(d.investigation.medicalHeldAt) }) : t('cp.investigation.medicalNotHeld') },
                  { key: t('cp.investigation.summary'), value: d.investigation.summary },
                ]}
              />
            ) : (
              <p className={styles.note}>{t('cp.investigation.none')}</p>
            )}
          </SheetBody>
        </Sheet>
        <Sheet tone={d.register ? 'accent' : 'default'}>
          <SheetHead title={t('cp.cppm.title')} actions={cppmMeeting ? <AppLink href={meetingPath(cppmMeeting.id)}>{t('cp.cppm.open')}</AppLink> : undefined} />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('cp.cppm.cppm'), value: d.cppm ? t('cp.cppm.cppmValue', { hasHeld: d.cppm.heldAt ? 'yes' : 'no', when: d.cppm.heldAt ? formatDateTime(d.cppm.heldAt) : '', decision: d.cppm.decision.replace('-', ' '), rationale: d.cppm.rationale ?? '' }) : t('cp.cppm.notHeld') },
                { key: t('cp.cppm.register'), value: d.register ? <span className={styles.pills}><Pill tone="critical" size="sm">{t('cp.cppm.registered', { date: formatDate(d.register.registeredAt) })}</Pill>{d.register.categories.map((c) => <Pill key={c} tone="high" size="sm">{CP_REGISTER_CATEGORY_LABELS[c]}</Pill>)}</span> : t('cp.cppm.notOnRegister') },
                ...(d.register?.deregisteredAt ? [{ key: t('cp.cppm.deregistered'), value: t('cp.cppm.deregisteredValue', { date: formatDate(d.register.deregisteredAt), reason: d.register.deregistrationReason ?? '' }) }] : []),
                ...(d.register?.transfer ? [{ key: t('cp.cppm.transfer'), value: t('cp.cppm.transferValue', { direction: d.register.transfer.direction, area: d.register.transfer.area, date: formatDate(d.register.transfer.at) }) }] : []),
                { key: t('cp.cppm.daysOnRegister'), value: d.register ? String(differenceInCalendarDays(now, parseISO(d.register.registeredAt))) : '' },
              ]}
            />
          </SheetBody>
        </Sheet>
      </div>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title={t('cp.coreGroup.title')} meta={d.coreGroup?.firstMeetingAt ? t('cp.coreGroup.firstMeeting', { when: formatDateTime(d.coreGroup.firstMeetingAt) }) : t('cp.coreGroup.notSetUp')} />
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
                        {id === d.coreGroup?.leadProfessionalUserId ? ` ${t('cp.coreGroup.leadProfessional')}` : ''}
                        {id === d.coreGroup?.namedPersonUserId ? ` ${t('cp.coreGroup.namedPerson')}` : ''}
                      </span>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('cp.plan.title')} meta={plan ? t('cp.plan.meta', { title: plan.title, date: formatDate(plan.agreedAt), hasReview: plan.reviewDate ? 'yes' : 'no', review: plan.reviewDate ? formatDate(plan.reviewDate) : '' }) : t('cp.plan.none')} actions={plan ? <AppLink href={processPath(process.id)}>{t('cp.plan.actionsBelow')}</AppLink> : undefined} />
          <SheetBody>
            {plan ? (
              <ol className={styles.list}>
                {plan.outcomes.map((o, i) => (
                  <li key={o.id}>
                    <span style={{ fontWeight: 700 }}>{i + 1}</span>
                    <span>
                      {o.text} <span className={styles.note}>{t('cp.plan.actionCount', { count: o.actionIds.length })}</span>
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
