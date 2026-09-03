'use client';

import { AGENCY_SHORT, HARM_TYPE_LABELS, formatDate, formatDateTime, type AspProcess } from '@mas/domain';
import { Button, KeyValue, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { personPath } from '@/lib/routes';
import { fullName, personById, userById, userName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { ThreePointTestDialog } from '../forms/ThreePointTestDialog';
import styles from './shared.module.css';

const LIMB_TEXT = {
  a: 'Unable to safeguard their own wellbeing, property, rights or other interests',
  b: 'At risk of harm',
  c: 'More vulnerable to being harmed because of disability, mental disorder, illness or infirmity',
};

function Met({ met }: { met: 'yes' | 'no' | 'unclear' }) {
  if (met === 'yes') return <Pill tone="low" size="sm" icon={<CheckCircle2 size={12} aria-hidden="true" />}>Met</Pill>;
  if (met === 'no') return <Pill tone="critical" size="sm" icon={<XCircle size={12} aria-hidden="true" />}>Not met</Pill>;
  return <Pill tone="medium" size="sm" icon={<CircleDashed size={12} aria-hidden="true" />}>Unclear</Pill>;
}

export function AspPanels({ process }: { process: AspProcess }) {
  const data = useData();
  const d = process.detail;
  const [testOpen, setTestOpen] = useState(false);
  const inv = d.investigation;

  return (
    <>
      {d.lsi ? (
        <Sheet tone="accent">
          <SheetHead title={`Large Scale Investigation: ${d.lsi.setting}`} meta={`Provider ${d.lsi.provider}. ${d.lsi.strands.length} strands. Care Inspectorate ${d.lsi.careInspectorateNotified ? 'notified' : 'not notified'}. Commissioning ${d.lsi.commissioningInvolved ? 'involved' : 'not involved'}.`} />
          <SheetBody>
            <div className={styles.pills} style={{ marginBottom: 10 }}>
              {d.lsi.agenciesInvolved.map((a) => (
                <Pill key={a} size="sm" tone="outline">
                  {AGENCY_SHORT[a]}
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
                      {s.status}
                    </Pill>
                    <span className={styles.strandMeta}>
                      {s.concern}
                      {lead ? ` Lead: ${userName(lead)}.` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title="Adult concern" meta={`Received ${formatDateTime(d.concern.receivedAt)} from ${d.concern.source} (${AGENCY_SHORT[d.concern.sourceAgency]})${d.concern.sourceReference ? `, ${d.concern.sourceReference}` : ''}`} />
        <SheetBody>
          <p style={{ marginBottom: 10 }}>{d.concern.summary}</p>
          <KeyValue
            items={[
              { key: 'Harm types', value: <span className={styles.pills}>{d.concern.harmTypes.map((h) => <Pill key={h} size="sm" tone="high">{HARM_TYPE_LABELS[h]}</Pill>)}</span> },
              { key: 'Immediate safety', value: d.concern.immediateSafety },
              { key: 'Police involved', value: d.concern.policeInvolved ? 'Yes' : 'No' },
            ]}
          />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title="Three-point test (s3)" meta={`Assessed ${formatDateTime(d.threePointTest.assessedAt)} by ${d.threePointTest.byName}. All three limbs must be met.`} actions={<Button size="sm" variant="secondary" onClick={() => setTestOpen(true)}>Record three-point test</Button>} />
        <SheetBody>
          <div className={styles.limbs}>
            {(['a', 'b', 'c'] as const).map((k) => (
              <div key={k} className={styles.limb}>
                <Met met={d.threePointTest[k].met} />
                <span className={styles.limbTitle}>Limb ({k}): {LIMB_TEXT[k]}</span>
                <span className={styles.limbText}>{d.threePointTest[k].reasoning}</span>
              </div>
            ))}
          </div>
          <p className={styles.note} style={{ marginTop: 10 }}>
            Outcome: <strong>{d.threePointTest.outcome === 'met' ? 'adult at risk (all limbs met)' : d.threePointTest.outcome === 'not-met' ? 'not an adult at risk' : 'unclear, gather more information'}</strong>.
          </p>
        </SheetBody>
      </Sheet>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Screening and inquiry (s4)" />
          <SheetBody>
            <KeyValue
              items={[
                { key: 'Screening', value: d.screening ? `${d.screening.outcome.replace(/-/g, ' ')} (${formatDate(d.screening.at)}, ${d.screening.byName}). ${d.screening.rationale}` : 'Not yet recorded' },
                { key: 'Inquiry opened', value: d.inquiry ? formatDate(d.inquiry.openedAt) : 'Not opened' },
                { key: 'Agencies contacted', value: d.inquiry ? d.inquiry.agenciesContacted.map((a) => AGENCY_SHORT[a]).join(', ') : '' },
                { key: 'Inquiry outcome', value: d.inquiry ? `${d.inquiry.outcome.replace(/-/g, ' ')}${d.inquiry.decidedAt ? ` on ${formatDate(d.inquiry.decidedAt)}` : ''}. ${d.inquiry.rationale ?? ''}` : '' },
              ]}
            />
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Consent, capacity and advocacy" />
          <SheetBody>
            {inv ? (
              <KeyValue
                items={[
                  { key: 'Consent', value: `${inv.consent.status.replace(/-/g, ' ')}. ${inv.consent.note}` },
                  { key: 'Capacity', value: `${inv.capacity.assessed ? 'Assessed' : 'Not yet assessed'}${inv.capacity.fluctuates ? ', fluctuates' : ''}. ${inv.capacity.summary}${inv.capacity.linkedAwiProcessId ? ' ' : ''}` },
                  ...(inv.capacity.linkedAwiProcessId ? [{ key: 'AWI process', value: <AppLink href={`/processes/${inv.capacity.linkedAwiProcessId}`}>Linked Adults with Incapacity process</AppLink> }] : []),
                  { key: 'Undue pressure', value: inv.unduePressure.considered ? `Considered: ${inv.unduePressure.found ? 'found' : 'not found'}. ${inv.unduePressure.reasoning ?? ''}` : 'Not yet considered' },
                  { key: 'Advocacy', value: inv.advocacy.offered ? `Offered${inv.advocacy.accepted ? ' and accepted' : inv.advocacy.accepted === false ? ', declined' : ''}${inv.advocacy.advocateName ? `: ${inv.advocacy.advocateName} (${inv.advocacy.provider ?? ''})` : ''}` : 'Not yet offered' },
                ]}
              />
            ) : (
              <p className={styles.note}>Recorded once an investigation opens.</p>
            )}
          </SheetBody>
        </Sheet>
      </div>

      {inv ? (
        <Sheet>
          <SheetHead title="Investigation powers used" meta={`Council officer ${userById(data, inv.councilOfficerUserId) ? userName(userById(data, inv.councilOfficerUserId)!) : ''}${inv.secondWorkerUserId ? `, second worker ${userName(userById(data, inv.secondWorkerUserId)!)}` : ''}`} />
          <SheetBody flush>
            <TableWrap style={{ border: 0, borderRadius: 0 }}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">Power</th>
                    <th scope="col">When</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.visits.map((v, i) => (
                    <tr key={`v${i}`}>
                      <td>s7 visit</td>
                      <td>{formatDateTime(v.at)}</td>
                      <td>
                        {v.byNames.join(', ')}. {v.note}
                      </td>
                      <td>Done</td>
                    </tr>
                  ))}
                  {inv.interviews.map((v, i) => {
                    const p = personById(data, v.withPersonId);
                    return (
                      <tr key={`i${i}`}>
                        <td>s8 interview</td>
                        <td>{formatDateTime(v.at)}</td>
                        <td>
                          With {p ? fullName(p) : v.withPersonId}. {v.note}
                        </td>
                        <td>{v.adultDeclined ? 'Adult declined' : 'Done'}</td>
                      </tr>
                    );
                  })}
                  {inv.medicalExamination ? (
                    <tr>
                      <td>s9 medical examination</td>
                      <td>{formatDateTime(inv.medicalExamination.requestedAt)}</td>
                      <td>{inv.medicalExamination.byName}</td>
                      <td>{inv.medicalExamination.outcome ?? 'Requested'}</td>
                    </tr>
                  ) : null}
                  {inv.recordsRequests.map((r, i) => (
                    <tr key={`r${i}`}>
                      <td>s10 records</td>
                      <td>{formatDateTime(r.requestedAt)}</td>
                      <td>
                        {r.holder} ({AGENCY_SHORT[r.holderAgency]}). {r.note ?? ''}
                      </td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </SheetBody>
        </Sheet>
      ) : null}

      <Sheet>
        <SheetHead title="Protection orders considered" meta="Assessment (s11), removal (s14), banning (s19), warrants for entry" />
        <SheetBody>
          {d.ordersConsidered.length === 0 ? <p className={styles.note}>No orders considered yet.</p> : null}
          <ul className={styles.list}>
            {d.ordersConsidered.map((o) => (
              <li key={o.order}>
                <Pill size="sm" tone={o.decision === 'not-required' ? 'outline' : o.decision === 'granted' ? 'low' : 'accent'}>
                  {o.decision.replace(/-/g, ' ')}
                </Pill>
                <span style={{ fontWeight: 700 }}>{o.order.replace(/-/g, ' ')}</span>
                <span className={styles.listMeta}>{o.rationale}</span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      {d.closure ? (
        <Sheet tone="well">
          <SheetHead title="Closure" meta={formatDate(d.closure.at)} />
          <SheetBody>{d.closure.reason}</SheetBody>
        </Sheet>
      ) : null}

      <ThreePointTestDialog open={testOpen} onClose={() => setTestOpen(false)} process={process} />
    </>
  );
}
