'use client';

import { agencyShort, aspClientGroupLabel, aspHarmLocationLabel, aspInquiryOutcomeLabel, aspReferralSourceLabel, aspOrderDecisionLabel, aspOrderLabel, aspScreeningOutcomeLabel, consentStatusLabel, formatDate, formatDateTime, harmTypeLabel, lsiStrandStatusLabel, requestStatusLabel, type AspProcess } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, KeyValue, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { personPath } from '@/lib/routes';
import { fullName, personById, userById, userName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { ProtectionOrderDialog } from '../forms/ProtectionOrderDialog';
import { ThreePointTestDialog } from '../forms/ThreePointTestDialog';
import styles from './shared.module.css';

function Met({ met }: { met: 'yes' | 'no' | 'unclear' }) {
  const t = useT();
  if (met === 'yes') return <Pill tone="low" size="sm" icon={<CheckCircle2 size={12} aria-hidden="true" />}>{t('forms.threePointTest.met.met')}</Pill>;
  if (met === 'no') return <Pill tone="critical" size="sm" icon={<XCircle size={12} aria-hidden="true" />}>{t('forms.threePointTest.met.notMet')}</Pill>;
  return <Pill tone="medium" size="sm" icon={<CircleDashed size={12} aria-hidden="true" />}>{t('forms.threePointTest.met.unclear')}</Pill>;
}

export function AspPanels({ process }: { process: AspProcess }) {
  const t = useT();
  const data = useData();
  const d = process.detail;
  // The return counts one primary harm; where none is named the first recorded stands in.
  const primaryHarm = d.concern.primaryHarmType ?? d.concern.harmTypes[0];
  const [testOpen, setTestOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const inv = d.investigation;
  const officer = inv ? userById(data, inv.councilOfficerUserId) : undefined;
  const second = inv?.secondWorkerUserId ? userById(data, inv.secondWorkerUserId) : undefined;

  return (
    <>
      {d.lsi ? (
        <Sheet tone="accent">
          <SheetHead title={t('asp.lsi.title', { setting: d.lsi.setting })} meta={t('asp.lsi.meta', { provider: d.lsi.provider, count: d.lsi.strands.length, notified: d.lsi.careInspectorateNotified ? 'yes' : 'no', involved: d.lsi.commissioningInvolved ? 'yes' : 'no' })} />
          <SheetBody>
            <div className={styles.pills} style={{ marginBottom: 10 }}>
              {d.lsi.agenciesInvolved.map((a) => (
                <Pill key={a} size="sm" tone="outline">
                  {agencyShort(a)}
                </Pill>
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {d.lsi.strands.map((s) => {
                const p = personById(data, s.subjectId);
                const lead = userById(data, s.leadUserId);
                return (
                  <div key={s.subjectId} className={styles.strand}>
                    <span>{p ? <AppLink href={personPath(p.id)}>{fullName(p)}</AppLink> : s.subjectId}</span>
                    <Pill size="sm" tone={s.status === 'open' ? 'accent' : s.status === 'reviewed' ? 'medium' : 'low'}>
                      {lsiStrandStatusLabel(s.status)}
                    </Pill>
                    <span className={styles.strandMeta}>
                      {s.concern}
                      {lead ? ` ${t('asp.lsi.strandLead', { name: userName(lead) })}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title={t('asp.concern.title')} meta={t('asp.concern.meta', { when: formatDateTime(d.concern.receivedAt), source: d.concern.source, agency: agencyShort(d.concern.sourceAgency), hasReference: d.concern.sourceReference ? 'yes' : 'no', reference: d.concern.sourceReference ?? '' })} />
        <SheetBody>
          <p style={{ marginBottom: 10 }}>{d.concern.summary}</p>
          <KeyValue
            items={[
              { key: t('asp.concern.referralSource'), value: d.concern.referralSource === 'other' ? (d.concern.referralSourceOther ?? aspReferralSourceLabel('other')) : aspReferralSourceLabel(d.concern.referralSource) },
              { key: t('asp.concern.harmTypes'), value: <span className={styles.pills}>{d.concern.harmTypes.map((h) => <Pill key={h} size="sm" tone="high">{harmTypeLabel(h)}</Pill>)}</span> },
              { key: t('asp.concern.primaryHarmType'), value: primaryHarm ? harmTypeLabel(primaryHarm) : t('common.values.notRecorded') },
              { key: t('asp.concern.locationOfHarm'), value: d.concern.locationOfHarm === 'other' ? (d.concern.locationOfHarmOther ?? aspHarmLocationLabel('other')) : aspHarmLocationLabel(d.concern.locationOfHarm) },
              { key: t('asp.concern.clientGroup'), value: d.concern.primaryClientGroup === undefined ? t('common.values.notRecorded') : d.concern.primaryClientGroup === 'other' ? (d.concern.clientGroupOther ?? aspClientGroupLabel('other')) : aspClientGroupLabel(d.concern.primaryClientGroup) },
              { key: t('asp.concern.immediateSafety'), value: d.concern.immediateSafety },
              { key: t('asp.concern.policeInvolved'), value: d.concern.policeInvolved ? t('common.answers.yes') : t('common.answers.no') },
            ]}
          />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('asp.threePointTest.title')} meta={t('asp.threePointTest.meta', { when: formatDateTime(d.threePointTest.assessedAt), name: d.threePointTest.byName })} actions={<Button size="sm" variant="secondary" onClick={() => setTestOpen(true)}>{t('asp.threePointTest.record')}</Button>} />
        <SheetBody>
          <div className={styles.limbs}>
            {(['a', 'b', 'c'] as const).map((k) => (
              <div key={k} className={styles.limb}>
                <Met met={d.threePointTest[k].met} />
                <span className={styles.limbTitle}>{t('asp.threePointTest.limbTitle', { limb: k, text: t(`asp.threePointTest.limbs.${k}` as const) })}</span>
                <span className={styles.limbText}>{d.threePointTest[k].reasoning}</span>
              </div>
            ))}
          </div>
          <p className={styles.note} style={{ marginTop: 10 }}>
            {t('asp.threePointTest.outcomeLabel')} <strong>{t('asp.threePointTest.outcomeValue', { outcome: d.threePointTest.outcome === 'not-met' ? 'notMet' : d.threePointTest.outcome })}</strong>.
          </p>
        </SheetBody>
      </Sheet>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title={t('asp.screening.title')} />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('asp.screening.screening'), value: d.screening ? t('asp.screening.screeningValue', { outcome: aspScreeningOutcomeLabel(d.screening.outcome), date: formatDate(d.screening.at), name: d.screening.byName, rationale: d.screening.rationale }) : t('asp.screening.notRecorded') },
                { key: t('asp.screening.inquiryOpened'), value: d.inquiry ? formatDate(d.inquiry.openedAt) : t('asp.screening.notOpened') },
                { key: t('asp.screening.agenciesContacted'), value: d.inquiry ? d.inquiry.agenciesContacted.map((a) => agencyShort(a)).join(', ') : '' },
                { key: t('asp.screening.inquiryOutcome'), value: d.inquiry ? t('asp.screening.inquiryOutcomeValue', { outcome: aspInquiryOutcomeLabel(d.inquiry.outcome), hasDate: d.inquiry.decidedAt ? 'yes' : 'no', date: d.inquiry.decidedAt ? formatDate(d.inquiry.decidedAt) : '', rationale: d.inquiry.rationale ?? '' }) : '' },
              ]}
            />
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('asp.consent.title')} />
          <SheetBody>
            {inv ? (
              <KeyValue
                items={[
                  { key: t('asp.consent.consent'), value: t('asp.consent.consentValue', { status: consentStatusLabel(inv.consent.status), note: inv.consent.note }) },
                  { key: t('asp.consent.capacity'), value: t('asp.consent.capacityValue', { assessed: inv.capacity.assessed ? 'yes' : 'no', fluctuates: inv.capacity.fluctuates ? 'yes' : 'no', summary: inv.capacity.summary }) },
                  ...(inv.capacity.linkedAwiProcessId ? [{ key: t('asp.consent.awiProcess'), value: <AppLink href={`/processes/${inv.capacity.linkedAwiProcessId}`}>{t('asp.consent.awiLink')}</AppLink> }] : []),
                  { key: t('asp.consent.unduePressure'), value: inv.unduePressure.considered ? t('asp.consent.unduePressureValue', { found: inv.unduePressure.found ? 'yes' : 'no', reasoning: inv.unduePressure.reasoning ?? '' }) : t('asp.consent.unduePressureNone') },
                  { key: t('asp.consent.advocacy'), value: inv.advocacy.offered ? t('asp.consent.advocacyValue', { accepted: inv.advocacy.accepted ? 'yes' : inv.advocacy.accepted === false ? 'declined' : 'no', hasAdvocate: inv.advocacy.advocateName ? 'yes' : 'no', advocate: inv.advocacy.advocateName ?? '', provider: inv.advocacy.provider ?? '' }) : t('asp.consent.advocacyNone') },
                ]}
              />
            ) : (
              <p className={styles.note}>{t('asp.consent.pending')}</p>
            )}
          </SheetBody>
        </Sheet>
      </div>

      {inv ? (
        <Sheet>
          <SheetHead title={t('asp.investigation.title')} meta={t('asp.investigation.meta', { officer: officer ? userName(officer) : '', hasSecond: second ? 'yes' : 'no', second: second ? userName(second) : '' })} />
          <SheetBody flush>
            <TableWrap style={{ border: 0, borderRadius: 0 }}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('asp.investigation.columns.power')}</th>
                    <th scope="col">{t('asp.investigation.columns.when')}</th>
                    <th scope="col">{t('asp.investigation.columns.detail')}</th>
                    <th scope="col">{t('asp.investigation.columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.visits.map((v, i) => (
                    <tr key={`v${i}`}>
                      <td>{t('asp.investigation.visit')}</td>
                      <td>{formatDateTime(v.at)}</td>
                      <td>{t('asp.investigation.visitDetail', { names: v.byNames.join(', '), note: v.note })}</td>
                      <td>{t('asp.investigation.done')}</td>
                    </tr>
                  ))}
                  {inv.interviews.map((v, i) => {
                    const p = personById(data, v.withPersonId);
                    return (
                      <tr key={`i${i}`}>
                        <td>{t('asp.investigation.interview')}</td>
                        <td>{formatDateTime(v.at)}</td>
                        <td>{t('asp.investigation.interviewDetail', { name: p ? fullName(p) : v.withPersonId, note: v.note })}</td>
                        <td>{v.adultDeclined ? t('asp.investigation.adultDeclined') : t('asp.investigation.done')}</td>
                      </tr>
                    );
                  })}
                  {inv.medicalExamination ? (
                    <tr>
                      <td>{t('asp.investigation.medical')}</td>
                      <td>{formatDateTime(inv.medicalExamination.requestedAt)}</td>
                      <td>{inv.medicalExamination.byName}</td>
                      <td>{inv.medicalExamination.outcome ?? t('asp.investigation.requested')}</td>
                    </tr>
                  ) : null}
                  {inv.recordsRequests.map((r, i) => (
                    <tr key={`r${i}`}>
                      <td>{t('asp.investigation.records')}</td>
                      <td>{formatDateTime(r.requestedAt)}</td>
                      <td>{t('asp.investigation.recordsDetail', { holder: r.holder, agency: agencyShort(r.holderAgency), note: r.note ?? '' })}</td>
                      <td>{requestStatusLabel(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title={t('asp.orders.title')} meta={t('asp.orders.meta')} actions={<Button size="sm" variant="secondary" onClick={() => setOrderOpen(true)} data-testid="record-order">{t('asp.orders.record')}</Button>} />
        <SheetBody>
          {d.ordersConsidered.length === 0 ? <p className={styles.note}>{t('asp.orders.empty')}</p> : null}
          <ul className={styles.list}>
            {d.ordersConsidered.map((o) => (
              <li key={o.order}>
                <Pill size="sm" tone={o.decision === 'not-required' ? 'outline' : o.decision === 'granted' ? 'low' : 'accent'}>
                  {aspOrderDecisionLabel(o.decision)}
                </Pill>
                <span style={{ fontWeight: 700 }}>{aspOrderLabel(o.order)}</span>
                <span className={styles.listMeta}>{o.rationale}</span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      {d.closure ? (
        <Sheet tone="well">
          <SheetHead title={t('asp.closure.title')} meta={formatDate(d.closure.at)} />
          <SheetBody>{d.closure.reason}</SheetBody>
        </Sheet>
      ) : null}

      <ThreePointTestDialog open={testOpen} onClose={() => setTestOpen(false)} process={process} />
      {orderOpen ? <ProtectionOrderDialog process={process} open onClose={() => setOrderOpen(false)} /> : null}
    </>
  );
}
