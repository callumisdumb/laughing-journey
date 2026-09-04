'use client';

import { DAQ_QUESTIONS, DASH_QUESTIONS, HIGH_RISK_THRESHOLD, agencyShort, daqQuestionText, formatDate, formatDateTime, meetingStatusLabel, researchStatusLabel, riskBandLabel, type MaracProcess } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, KeyValue, Pill, RiskBand, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { Ban, Check, Flag, Repeat } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { meetingPath, personPath, processPath } from '@/lib/routes';
import { fullName, personById } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { DaqDialog } from '../forms/DaqDialog';
import styles from './shared.module.css';
import { PersonLink } from '@/components/EntityLink';

export function MaracPanels({ process }: { process: MaracProcess }) {
  const t = useT();
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
          title={t('marac.referral.title')}
          meta={t('marac.referral.meta', { when: formatDateTime(d.referral.receivedAt), name: d.referral.referrerName, agency: agencyShort(d.referral.referringAgency) })}
          actions={
            <span className={styles.pills}>
              {d.referral.repeat ? (
                <Pill tone="critical" icon={<Repeat size={14} aria-hidden="true" />}>
                  {t('marac.referral.repeat', { hasDate: d.referral.previousHearingAt ? 'yes' : 'no', date: d.referral.previousHearingAt ? formatDate(d.referral.previousHearingAt) : '' })}
                </Pill>
              ) : (
                <Pill tone="outline">{t('marac.referral.first')}</Pill>
              )}
              {d.referral.professionalJudgementReferral ? <Pill tone="medium">{t('marac.referral.judgement')}</Pill> : null}
            </span>
          }
        />
        <SheetBody>
          <p style={{ marginBottom: 10 }}>{d.referral.summary}</p>
          <KeyValue
            items={[
              { key: t('marac.referral.victim'), value: victim ? <AppLink href={personPath(victim.id)}>{fullName(victim)}</AppLink> : d.referral.victimPersonId },
              { key: t('marac.referral.children'), value: d.referral.childPersonIds.length === 0 ? t('common.keyValue.none') : d.referral.childPersonIds.map((id) => { const p = personById(data, id); return p ? <AppLink key={id} href={personPath(id)} style={{ marginRight: 8 }}>{fullName(p)}</AppLink> : id; }) },
              // Named, and never a link: the referral says he must not receive anything about this
              // case, and a route into his record from beside that sentence is the same offer in
              // different clothing. `PersonLink` reads the exclusion register rather than this
              // panel deciding for itself.
              { key: t('marac.referral.perpetrator'), value: <span>{perpetrator ? <PersonLink person={perpetrator} process={process} /> : d.referral.perpetratorPersonId} <Pill size="sm" tone="restricted" icon={<Ban size={12} aria-hidden="true" />}>{t('marac.referral.mustNotReceive')}</Pill></span> },
              { key: t('marac.referral.idaa'), value: t('marac.referral.idaaValue', { name: d.idaa.name, organisation: d.idaa.organisation }) },
            ]}
          />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={ra ? t('marac.checklist.title', { tool: ra.tool }) : t('marac.checklist.titleNone')} meta={ra ? t('marac.checklist.meta', { when: formatDateTime(ra.assessedAt), name: ra.assessorName, agency: agencyShort(ra.assessorAgency) }) : t('marac.checklist.notRecorded')} actions={<Button size="sm" variant="secondary" onClick={() => setDaqOpen(true)}>{t('marac.checklist.record')}</Button>} />
        <SheetBody>
          {ra ? (
            <>
              <div className={styles.score}>
                <span className={styles.scoreNumeral}>{ra.score}</span>
                <span className={styles.scoreLabel}>{t('marac.checklist.scoreLabel', { max: ra.maxScore ?? '', threshold: HIGH_RISK_THRESHOLD })}</span>
                <RiskBand band={ra.judgementOverride?.band ?? ra.band} label={ra.judgementOverride ? t('marac.checklist.overridden', { band: ra.bandLabel, override: riskBandLabel(ra.judgementOverride.band) }) : ra.bandLabel} size="lg" />
              </div>
              {ra.judgementOverride ? <p className={styles.warn}>{t('marac.checklist.override', { name: ra.judgementOverride.byName, reason: ra.judgementOverride.reason })}</p> : null}
              <div className={styles.items}>
                {(ra.items ?? questions.map((q) => ({ id: q.id, question: daqQuestionText(q.id), answer: 'unknown' as const }))).map((it) => (
                  <div key={it.id} className={styles.item}>
                    <span className={styles.tick} role="img" data-answer={it.answer} aria-label={t('marac.checklist.answer', { answer: it.answer })}>
                      {it.answer === 'yes' ? <Check size={12} aria-hidden="true" /> : null}
                    </span>
                    <span>{it.question}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.note}>{t('marac.checklist.empty')}</p>
          )}
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('marac.research.title')} meta={t('marac.research.meta')} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('marac.research.columns.agency')}</th>
                  <th scope="col">{t('marac.research.columns.sent')}</th>
                  <th scope="col">{t('marac.research.columns.due')}</th>
                  <th scope="col">{t('marac.research.columns.status')}</th>
                  <th scope="col">{t('marac.research.columns.return')}</th>
                </tr>
              </thead>
              <tbody>
                {d.researchRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t('marac.research.empty')}</td>
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
                        {researchStatusLabel(r.status)}
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
          <SheetHead title={t('marac.meeting.title')} meta={meeting ? t('marac.meeting.meta', { title: meeting.title, when: formatDateTime(meeting.scheduledAt), status: meetingStatusLabel(meeting.status) }) : t('marac.meeting.notListed')} actions={meeting ? <AppLink href={meetingPath(meeting.id)}>{t('marac.meeting.open')}</AppLink> : undefined} />
          <SheetBody>
            <p className={styles.note}>{t('marac.meeting.note')}</p>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('marac.flags.title')} meta={d.flags.length === 0 ? t('marac.flags.none') : t('marac.flags.meta', { count: d.flags.length })} />
          <SheetBody>
            <ul className={styles.list}>
              {d.flags.map((f, i) => (
                <li key={i}>
                  <Flag size={14} aria-hidden="true" />
                  <span>
                    <strong>{agencyShort(f.agency)}</strong> {t('marac.flags.item', { system: f.system, placed: formatDate(f.placedAt), expires: formatDate(f.expiresAt), receipt: f.receiptRef })}
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title={t('marac.feedback.title')} meta={t('marac.feedback.meta', { count: d.idaaFeedback.length })} />
        <SheetBody>
          <ul className={styles.list}>
            {d.idaaFeedback.map((f, i) => (
              <li key={i}>
                <span style={{ fontWeight: 700 }}>{formatDate(f.at)}</span>
                <span>
                  {f.summary}
                  {f.victimResponse ? <span className={styles.listMeta} style={{ display: 'block' }}>{t('marac.feedback.victimResponse', { response: f.victimResponse })}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('marac.links.title')} />
        <SheetBody>
          <div className={styles.pills}>
            {d.links.cpProcessId ? <AppLink href={processPath(d.links.cpProcessId)}><Pill tone="accent">{t('marac.links.cp')}</Pill></AppLink> : <Pill tone="outline">{t('marac.links.noCp')}</Pill>}
            {d.links.aspProcessId ? <AppLink href={processPath(d.links.aspProcessId)}><Pill tone="accent">{t('marac.links.asp')}</Pill></AppLink> : null}
            {d.links.mappaProcessId ? <AppLink href={processPath(d.links.mappaProcessId)}><Pill tone="restricted">{t('marac.links.mappa')}</Pill></AppLink> : <Pill tone="outline">{t('marac.links.noMappa')}</Pill>}
            <Pill tone={d.links.matacConsidered ? 'high' : 'outline'}>{t('marac.links.matac', { considered: d.links.matacConsidered ? 'yes' : 'no', hasReferral: d.links.matacReferredAt ? 'yes' : 'no', date: d.links.matacReferredAt ? formatDate(d.links.matacReferredAt) : '' })}</Pill>
            <Pill tone={d.links.dsdasConsidered ? 'medium' : 'outline'}>{t('marac.links.dsdas', { considered: d.links.dsdasConsidered ? 'yes' : 'no' })}</Pill>
          </div>
          {d.links.dsdasNote ? <p className={styles.note} style={{ marginTop: 8 }}>{d.links.dsdasNote}</p> : null}
          {d.transfer ? <p className={styles.note} style={{ marginTop: 8 }}>{t('marac.links.transfer', { area: d.transfer.toArea, date: formatDate(d.transfer.at), coordinator: d.transfer.receivingCoordinator })}</p> : null}
        </SheetBody>
      </Sheet>

      <DaqDialog open={daqOpen} onClose={() => setDaqOpen(false)} process={process} />
    </>
  );
}
