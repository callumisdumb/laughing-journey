'use client';

import { AGENCY_SHORT, DAQ_QUESTIONS, DASH_QUESTIONS, HIGH_RISK_THRESHOLD, formatDate, formatDateTime, type MaracProcess } from '@mas/domain';
import { AgencyMark, Button, KeyValue, Pill, RiskBand, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { Ban, Check, Flag, Repeat } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { meetingPath, personPath, processPath } from '@/lib/routes';
import { fullName, personById } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { DaqDialog } from '../forms/DaqDialog';
import styles from './shared.module.css';

export function MaracPanels({ process }: { process: MaracProcess }) {
  const data = useData();
  const d = process.detail;
  const [daqOpen, setDaqOpen] = useState(false);
  const ra = data.riskAssessments.find((r) => r.id === d.referral.riskAssessmentId);
  const victim = personById(data, d.referral.victimPersonId);
  const perpetrator = personById(data, d.referral.perpetratorPersonId);
  const meeting = d.meetingId ? data.meetings.find((m) => m.id === d.meetingId) : data.meetings.filter((m) => m.processId === process.id && m.type === 'marac').sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0];
  const questions = ra?.tool === 'dash' ? DASH_QUESTIONS : DAQ_QUESTIONS;

  return (
    <>
      <Sheet>
        <SheetHead
          title="Referral"
          meta={`Received ${formatDateTime(d.referral.receivedAt)} from ${d.referral.referrerName} (${AGENCY_SHORT[d.referral.referringAgency]})`}
          actions={
            <span className={styles.pills}>
              {d.referral.repeat ? (
                <Pill tone="critical" icon={<Repeat size={14} aria-hidden="true" />}>
                  Repeat: last heard {d.referral.previousHearingAt ? formatDate(d.referral.previousHearingAt) : 'within 12 months'}
                </Pill>
              ) : (
                <Pill tone="outline">First referral</Pill>
              )}
              {d.referral.professionalJudgementReferral ? <Pill tone="medium">Professional judgement referral</Pill> : null}
            </span>
          }
        />
        <SheetBody>
          <p style={{ marginBottom: 10 }}>{d.referral.summary}</p>
          <KeyValue
            items={[
              { key: 'Victim', value: victim ? <AppLink href={personPath(victim.id)}>{fullName(victim)}</AppLink> : d.referral.victimPersonId },
              { key: 'Children', value: d.referral.childPersonIds.length === 0 ? 'None' : d.referral.childPersonIds.map((id) => { const p = personById(data, id); return p ? <AppLink key={id} href={personPath(id)} style={{ marginRight: 8 }}>{fullName(p)}</AppLink> : id; }) },
              { key: 'Perpetrator', value: <span>{perpetrator ? <AppLink href={personPath(perpetrator.id)}>{fullName(perpetrator)}</AppLink> : d.referral.perpetratorPersonId} <Pill size="sm" tone="restricted" icon={<Ban size={12} aria-hidden="true" />}>Must not receive anything about this process</Pill></span> },
              { key: 'IDAA', value: `${d.idaa.name}, ${d.idaa.organisation}` },
            ]}
          />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={ra ? `${ra.tool === 'dash' ? 'DASH' : 'DAQ'} risk checklist` : 'Risk checklist'} meta={ra ? `Completed ${formatDateTime(ra.assessedAt)} by ${ra.assessorName} (${AGENCY_SHORT[ra.assessorAgency]})` : 'Not recorded'} actions={<Button size="sm" variant="secondary" onClick={() => setDaqOpen(true)}>Record DAQ</Button>} />
        <SheetBody>
          {ra ? (
            <>
              <div className={styles.score}>
                <span className={styles.scoreNumeral}>{ra.score}</span>
                <span className={styles.scoreLabel}>
                  yes answers of {ra.maxScore}. {HIGH_RISK_THRESHOLD} or more indicates high risk.
                </span>
                <RiskBand band={ra.judgementOverride?.band ?? ra.band} label={ra.judgementOverride ? `${ra.bandLabel} (overridden to ${ra.judgementOverride.band})` : ra.bandLabel} size="lg" />
              </div>
              {ra.judgementOverride ? <p className={styles.warn}>Professional judgement override by {ra.judgementOverride.byName}: {ra.judgementOverride.reason}</p> : null}
              <div className={styles.items}>
                {(ra.items ?? questions.map((q) => ({ id: q.id, question: q.text, answer: 'unknown' as const }))).map((it) => (
                  <div key={it.id} className={styles.item}>
                    <span className={styles.tick} role="img" data-answer={it.answer} aria-label={`${it.answer}`}>
                      {it.answer === 'yes' ? <Check size={12} aria-hidden="true" /> : null}
                    </span>
                    <span>{it.question}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.note}>Record the DAQ to score the referral.</p>
          )}
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title="Research requests" meta={`Each agency searches its records for the victim, the perpetrator and the children, and shares only what is relevant, necessary and proportionate. Names and dates of birth only in the request.`} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">Agency</th>
                  <th scope="col">Sent</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col">Return</th>
                </tr>
              </thead>
              <tbody>
                {d.researchRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Research requests are sent by the coordinator when the case is listed.</td>
                  </tr>
                ) : null}
                {d.researchRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <AgencyMark agency={r.agency} />
                    </td>
                    <td>{formatDate(r.sentAt)}</td>
                    <td>{formatDate(r.dueAt)}</td>
                    <td>
                      <Pill size="sm" tone={r.status === 'returned' ? 'low' : r.status === 'nothing-known' ? 'outline' : r.status === 'overdue' ? 'critical' : 'medium'}>
                        {r.status.replace('-', ' ')}
                      </Pill>
                    </td>
                    <td>{r.returnSummary ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Meeting slot" meta={meeting ? `${meeting.title}, ${formatDateTime(meeting.scheduledAt)} (${meeting.status})` : 'Not yet listed'} actions={meeting ? <AppLink href={meetingPath(meeting.id)}>Open</AppLink> : undefined} />
          <SheetBody>
            <p className={styles.note}>The victim does not attend. The IDAA represents their wishes. The perpetrator is not told.</p>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Flags placed" meta={d.flags.length === 0 ? 'No MARAC flags yet' : `${d.flags.length} flags, 12 months from the hearing`} />
          <SheetBody>
            <ul className={styles.list}>
              {d.flags.map((f, i) => (
                <li key={i}>
                  <Flag size={14} aria-hidden="true" />
                  <span>
                    <strong>{AGENCY_SHORT[f.agency]}</strong> on {f.system}: placed {formatDate(f.placedAt)}, expires {formatDate(f.expiresAt)}. Receipt {f.receiptRef}.
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title="IDAA feedback to the victim" meta={`${d.idaaFeedback.length} entries`} />
        <SheetBody>
          <ul className={styles.list}>
            {d.idaaFeedback.map((f, i) => (
              <li key={i}>
                <span style={{ fontWeight: 700 }}>{formatDate(f.at)}</span>
                <span>
                  {f.summary}
                  {f.victimResponse ? <span className={styles.listMeta} style={{ display: 'block' }}>Victim&apos;s response: {f.victimResponse}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title="Links to other processes" />
        <SheetBody>
          <div className={styles.pills}>
            {d.links.cpProcessId ? <AppLink href={processPath(d.links.cpProcessId)}><Pill tone="accent">Child protection process</Pill></AppLink> : <Pill tone="outline">No child protection process</Pill>}
            {d.links.aspProcessId ? <AppLink href={processPath(d.links.aspProcessId)}><Pill tone="accent">ASP process</Pill></AppLink> : null}
            {d.links.mappaProcessId ? <AppLink href={processPath(d.links.mappaProcessId)}><Pill tone="restricted">MAPPA (perpetrator)</Pill></AppLink> : <Pill tone="outline">Perpetrator not MAPPA</Pill>}
            <Pill tone={d.links.matacConsidered ? 'high' : 'outline'}>MATAC {d.links.matacConsidered ? `considered${d.links.matacReferredAt ? `, referred ${formatDate(d.links.matacReferredAt)}` : ''}` : 'not considered'}</Pill>
            <Pill tone={d.links.dsdasConsidered ? 'medium' : 'outline'}>DSDAS {d.links.dsdasConsidered ? 'considered' : 'not considered'}</Pill>
          </div>
          {d.links.dsdasNote ? <p className={styles.note} style={{ marginTop: 8 }}>{d.links.dsdasNote}</p> : null}
          {d.transfer ? <p className={styles.note} style={{ marginTop: 8 }}>Transferred to {d.transfer.toArea} on {formatDate(d.transfer.at)} (receiving coordinator {d.transfer.receivingCoordinator}).</p> : null}
        </SheetBody>
      </Sheet>

      <DaqDialog open={daqOpen} onClose={() => setDaqOpen(false)} process={process} />
    </>
  );
}
