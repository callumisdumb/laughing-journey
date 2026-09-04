'use client';

import { agencyShort, awiOrderKindLabel, capacityOutcomeLabel, computeClock, findClockRule, formatDate, formatDateTime, medicalReportKindLabel, mhoReportStatusLabel, poaKindLabel, requestStatusLabel, workingCalendarFrom, type AwiProcess } from '@mas/domain';
import { hasMessage, tKey, useT } from '@mas/messages';
import { Button, ClockNumeral, KeyValue, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { userById, userName } from '@/lib/selectors';
import { useConfig, useData, useNow } from '@/lib/store';
import { InvestigationDialog, SupervisionVisitDialog } from '../forms/AwiRecordDialogs';
import { CapacityAssessmentDialog } from '../forms/CapacityAssessmentDialog';
import styles from './shared.module.css';

/** Route ids are hyphenated (informal-support, part5-certificate); the catalogue keys under awi.routes are camelCase. */
function routeLabel(route: string): string {
  const key = `awi.routes.${route.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())}`;
  return hasMessage(key) ? tKey(key) : route;
}

export function AwiPanels({ process }: { process: AwiProcess }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const d = process.detail;
  const [capOpen, setCapOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const app = d.application;
  const mhoRule = findClockRule(config.clockRules, 'awi.mho.report');
  const mhoTrigger = process.clocks.find((c) => c.ruleId === 'awi.mho.report');
  const mhoClock = mhoRule && mhoTrigger ? computeClock(mhoTrigger, mhoRule, now, { calendar: workingCalendarFrom(config) }) : null;
  const mho = app?.mhoUserId ? userById(data, app.mhoUserId) : undefined;
  const interim = app?.interimOrder;
  const interimDays = interim?.grantedAt ? differenceInCalendarDays(now, parseISO(interim.grantedAt)) : null;

  return (
    <>
      <Sheet>
        <SheetHead title={t('awi.concern.title')} meta={t('awi.concern.meta', { when: formatDateTime(d.concern.raisedAt), source: d.concern.source, agency: agencyShort(d.concern.sourceAgency) })} />
        <SheetBody>
          <KeyValue items={[{ key: t('awi.concern.decision'), value: d.concern.decisionInQuestion }, { key: t('awi.concern.summary'), value: d.concern.summary }]} />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('awi.assessments.title')} meta={t('awi.assessments.meta')} actions={<Button size="sm" variant="secondary" onClick={() => setCapOpen(true)}>{t('awi.assessments.record')}</Button>} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('awi.assessments.columns.decision')}</th>
                  <th scope="col">{t('awi.assessments.columns.assessed')}</th>
                  <th scope="col">{t('awi.assessments.columns.by')}</th>
                  <th scope="col">{t('awi.assessments.columns.outcome')}</th>
                  <th scope="col">{t('awi.assessments.columns.evidence')}</th>
                </tr>
              </thead>
              <tbody>
                {d.capacityAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t('awi.assessments.empty')}</td>
                  </tr>
                ) : null}
                {d.capacityAssessments.map((c) => (
                  <tr key={c.id}>
                    <td>{c.decision}</td>
                    <td>{formatDate(c.assessedAt)}</td>
                    <td>{t('awi.assessments.assessor', { name: c.assessorName, role: c.assessorRole })}</td>
                    <td>
                      <Pill size="sm" tone={c.outcome === 'lacks-capacity' ? 'critical' : c.outcome === 'has-capacity' ? 'low' : c.outcome === 'fluctuating' ? 'medium' : 'outline'}>
                        {capacityOutcomeLabel(c.outcome)}
                      </Pill>
                    </td>
                    <td>
                      {c.evidence}
                      {c.communicationSupport ? ` ${t('awi.assessments.communicationSupport', { support: c.communicationSupport })}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>

      <div className={styles.grid2}>
        <Sheet tone="paper">
          <SheetHead title={t('awi.will.title')} meta={d.willAndPreferences ? t('awi.will.meta', { date: formatDate(d.willAndPreferences.recordedAt), name: d.willAndPreferences.byName, method: d.willAndPreferences.communicationMethod }) : t('awi.will.notRecorded')} />
          <SheetBody>
            {d.willAndPreferences ? (
              <KeyValue
                items={[
                  { key: t('awi.will.past'), value: d.willAndPreferences.pastWishes },
                  { key: t('awi.will.present'), value: d.willAndPreferences.presentWishes },
                  { key: t('awi.will.consulted'), value: <ul>{d.willAndPreferences.consultedOthers.map((c) => <li key={c.name}><strong>{c.name}</strong> ({c.relationship}): {c.view}</li>)}</ul> },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('awi.opg.title')} meta={d.opgResult ? t('awi.opg.meta', { when: formatDateTime(d.opgResult.checkedAt), reference: d.opgResult.reference }) : t('awi.opg.notChecked')} />
          <SheetBody>
            {d.opgResult ? (
              <KeyValue
                items={[
                  { key: t('awi.opg.poa'), value: d.opgResult.powerOfAttorney.exists ? t('awi.opg.poaValue', { kind: d.opgResult.powerOfAttorney.kind ? poaKindLabel(d.opgResult.powerOfAttorney.kind) : '', name: d.opgResult.powerOfAttorney.attorneyName ?? '', hasRegistered: d.opgResult.powerOfAttorney.registeredAt ? 'yes' : 'no', date: d.opgResult.powerOfAttorney.registeredAt ? formatDate(d.opgResult.powerOfAttorney.registeredAt) : '' }) : t('awi.opg.poaNone') },
                  { key: t('awi.opg.guardianship'), value: d.opgResult.guardianship.exists ? t('awi.opg.guardianshipValue', { name: d.opgResult.guardianship.guardianName ?? '', powers: (d.opgResult.guardianship.powers ?? []).join('; '), hasExpiry: d.opgResult.guardianship.expiresAt ? 'yes' : 'no', date: d.opgResult.guardianship.expiresAt ? formatDate(d.opgResult.guardianship.expiresAt) : '' }) : t('common.keyValue.none') },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title={t('awi.route.title')} meta={d.routeDecision ? t('awi.route.meta', { date: formatDate(d.routeDecision.decidedAt), name: d.routeDecision.byName }) : t('awi.route.notDecided')} />
        <SheetBody>
          {d.routeDecision ? (
            <KeyValue
              items={[
                { key: t('awi.route.route'), value: <Pill tone="accent">{routeLabel(d.routeDecision.route)}</Pill> },
                { key: t('awi.route.rationale'), value: d.routeDecision.rationale },
                ...(d.routeDecision.s13za ? [{ key: t('awi.route.s13za'), value: t('awi.route.s13zaValue', { considered: d.routeDecision.s13za.considered ? 'yes' : 'no', applied: d.routeDecision.s13za.applied ? 'yes' : 'no', reasoning: d.routeDecision.s13za.reasoning, hasObjection: d.routeDecision.s13za.objectionFrom ? 'yes' : 'no', objector: d.routeDecision.s13za.objectionFrom ?? '' }) }] : []),
              ]}
            />
          ) : null}
        </SheetBody>
      </Sheet>

      {app ? (
        <Sheet tone="accent">
          <SheetHead title={t('awi.application.title')} meta={t('awi.application.meta', { applicant: app.applicant, name: app.applicantName, hasSolicitor: app.solicitor ? 'yes' : 'no', solicitor: app.solicitor ?? '', court: app.court.sheriffCourt })} />
          <SheetBody>
            <div className={styles.grid2}>
              <div className="stack">
                {mhoClock ? <ClockNumeral daysRemaining={mhoClock.daysRemaining} band={mhoClock.band} status={mhoClock.status} label={t('awi.application.mhoClock')} sub={t('awi.application.mhoSub', { when: formatDateTime(app.mhoNotifiedAt), due: formatDate(mhoClock.dueAt), hasMho: mho ? 'yes' : 'no', mho: mho ? userName(mho) : '', status: mhoReportStatusLabel(app.mhoReport.status) })} size="sm" /> : null}
                <KeyValue
                  items={[
                    { key: t('awi.application.powersSought'), value: <ul>{app.powersSought.map((p) => <li key={p}>{p}</li>)}</ul> },
                    { key: t('awi.application.medicalReports'), value: <ul>{app.medicalReports.map((m, i) => <li key={i}>{t('awi.application.medicalReport', { practitioner: m.practitioner, kind: medicalReportKindLabel(m.kind), status: requestStatusLabel(m.status), hasReceived: m.receivedAt ? 'yes' : 'no', date: m.receivedAt ? formatDate(m.receivedAt) : '' })}</li>)}</ul> },
                    { key: t('awi.application.suitability'), value: app.suitabilityReport.required ? (app.suitabilityReport.status ? requestStatusLabel(app.suitabilityReport.status) : t('awi.application.suitabilityDefault')) : t('awi.application.suitabilityNotRequired') },
                  ]}
                />
              </div>
              <div className="stack">
                <KeyValue
                  items={[
                    { key: t('awi.application.lodged'), value: app.court.lodgedAt ? formatDate(app.court.lodgedAt) : t('awi.application.notLodged') },
                    { key: t('awi.application.hearing'), value: app.court.hearingAt ? formatDate(app.court.hearingAt) : t('awi.application.notFixed') },
                    { key: t('awi.application.interim'), value: interim ? t('awi.application.interimValue', { granted: interim.grantedAt ? 'yes' : 'no', grantedAt: interim.grantedAt ? formatDate(interim.grantedAt) : '', hasExpiry: interim.expiresAt ? 'yes' : 'no', expiresAt: interim.expiresAt ? formatDate(interim.expiresAt) : '', soughtAt: formatDate(interim.soughtAt), renewals: interim.renewals }) : t('awi.application.interimNotSought') },
                  ]}
                />
                {interim?.grantedAt && interimDays !== null ? (
                  <div className={interimDays > 90 ? styles.warn : styles.info}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{t('awi.application.interimWarning', { days: interimDays, beyond: interimDays > 90 ? 'yes' : 'no' })}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title={t('awi.orders.title')} meta={d.orders.length === 0 ? t('awi.orders.none') : t('awi.orders.meta', { count: d.orders.length })} />
          <SheetBody>
            <ul className={styles.list}>
              {d.orders.map((o) => (
                <li key={o.id}>
                  <Pill size="sm" tone="accent">
                    {awiOrderKindLabel(o.kind)}
                  </Pill>
                  <span>
                    <strong>{o.guardianName}</strong>. {t('awi.orders.item', { granted: formatDate(o.grantedAt), hasExpiry: o.expiresAt ? 'yes' : 'no', expires: o.expiresAt ? formatDate(o.expiresAt) : '', powers: o.powers.join('; ') })}
                    <span className={styles.listMeta} style={{ display: 'block' }}>
                      {[o.supervisingOfficerUserId ? t('awi.orders.supervising', { name: userName(userById(data, o.supervisingOfficerUserId)!) }) : '', o.opgRegisteredAt ? t('awi.orders.opgRegistered', { date: formatDate(o.opgRegisteredAt) }) : '', o.mwcNotifiedAt ? t('awi.orders.mwcNotified', { date: formatDate(o.mwcNotifiedAt) }) : ''].filter(Boolean).join(' ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead
            title={t('awi.supervision.title')}
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={() => setVisitOpen(true)} data-testid="record-visit">
                  {t('awi.supervision.record')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setInvestigationOpen(true)} data-testid="record-investigation">
                  {t('awi.supervision.recordInvestigation')}
                </Button>
              </>
            }
          />
          <SheetBody>
            {d.supervisionVisits.length === 0 && d.investigations.length === 0 ? <p className={styles.note}>{t('awi.supervision.empty')}</p> : null}
            <ul className={styles.list}>
              {d.supervisionVisits.map((v, i) => (
                <li key={`v${i}`}>
                  <span style={{ fontWeight: 700 }}>{formatDate(v.at)}</span>
                  <span>{t('awi.supervision.visit', { name: v.byName, summary: v.summary })}</span>
                </li>
              ))}
              {d.investigations.map((v, i) => (
                <li key={`i${i}`}>
                  <Pill size="sm" tone={v.status === 'open' ? 'high' : 'outline'}>
                    {v.section}
                  </Pill>
                  <span>{t('awi.supervision.investigation', { date: formatDate(v.openedAt), summary: v.summary })}</span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <CapacityAssessmentDialog open={capOpen} onClose={() => setCapOpen(false)} process={process} />
      {visitOpen ? <SupervisionVisitDialog process={process} open onClose={() => setVisitOpen(false)} /> : null}
      {investigationOpen ? <InvestigationDialog process={process} open onClose={() => setInvestigationOpen(false)} /> : null}
    </>
  );
}
