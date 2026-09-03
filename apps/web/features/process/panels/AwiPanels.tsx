'use client';

import { AGENCY_SHORT, computeClock, findClockRule, formatDate, formatDateTime, type AwiProcess } from '@mas/domain';
import { Button, ClockNumeral, KeyValue, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { userById, userName } from '@/lib/selectors';
import { useConfig, useData, useNow } from '@/lib/store';
import { CapacityAssessmentDialog } from '../forms/CapacityAssessmentDialog';
import styles from './shared.module.css';

const ROUTE_LABELS: Record<string, string> = {
  'informal-support': 'Informal support and supported decision making',
  s13za: 'Section 13ZA arrangement (Social Work (Scotland) Act 1968)',
  'poa-covers': 'Existing power of attorney covers the decision',
  'intervention-order': 'Intervention order',
  'guardianship-welfare': 'Welfare guardianship',
  'guardianship-financial': 'Financial guardianship',
  'guardianship-combined': 'Combined welfare and financial guardianship',
  'part5-certificate': 'Part 5 certificate of incapacity (s47)',
};

export function AwiPanels({ process }: { process: AwiProcess }) {
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const d = process.detail;
  const [capOpen, setCapOpen] = useState(false);
  const app = d.application;
  const mhoRule = findClockRule(config.clockRules, 'awi.mho.report');
  const mhoTrigger = process.clocks.find((c) => c.ruleId === 'awi.mho.report');
  const mhoClock = mhoRule && mhoTrigger ? computeClock(mhoTrigger, mhoRule, now, { bankHolidays: config.bankHolidays }) : null;
  const interim = app?.interimOrder;
  const interimDays = interim?.grantedAt ? differenceInCalendarDays(now, parseISO(interim.grantedAt)) : null;

  return (
    <>
      <Sheet>
        <SheetHead title="Capacity concern" meta={`Raised ${formatDateTime(d.concern.raisedAt)} by ${d.concern.source} (${AGENCY_SHORT[d.concern.sourceAgency]})`} />
        <SheetBody>
          <KeyValue items={[{ key: 'Decision in question', value: d.concern.decisionInQuestion }, { key: 'Summary', value: d.concern.summary }]} />
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title="Capacity assessments by decision" meta="Capacity is decision-specific and time-specific (AWI 2000 s1)." actions={<Button size="sm" variant="secondary" onClick={() => setCapOpen(true)}>Record capacity assessment</Button>} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">Decision</th>
                  <th scope="col">Assessed</th>
                  <th scope="col">By</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {d.capacityAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No assessment recorded yet.</td>
                  </tr>
                ) : null}
                {d.capacityAssessments.map((c) => (
                  <tr key={c.id}>
                    <td>{c.decision}</td>
                    <td>{formatDate(c.assessedAt)}</td>
                    <td>
                      {c.assessorName}, {c.assessorRole}
                    </td>
                    <td>
                      <Pill size="sm" tone={c.outcome === 'lacks-capacity' ? 'critical' : c.outcome === 'has-capacity' ? 'low' : c.outcome === 'fluctuating' ? 'medium' : 'outline'}>
                        {c.outcome.replace('-', ' ')}
                      </Pill>
                    </td>
                    <td>
                      {c.evidence}
                      {c.communicationSupport ? ` Communication support: ${c.communicationSupport}.` : ''}
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
          <SheetHead title="Will and preferences" meta={d.willAndPreferences ? `Recorded ${formatDate(d.willAndPreferences.recordedAt)} by ${d.willAndPreferences.byName}, ${d.willAndPreferences.communicationMethod}` : 'Not yet recorded'} />
          <SheetBody>
            {d.willAndPreferences ? (
              <KeyValue
                items={[
                  { key: 'Past wishes', value: d.willAndPreferences.pastWishes },
                  { key: 'Present wishes', value: d.willAndPreferences.presentWishes },
                  { key: 'Consulted', value: <ul>{d.willAndPreferences.consultedOthers.map((c) => <li key={c.name}><strong>{c.name}</strong> ({c.relationship}): {c.view}</li>)}</ul> },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Existing powers (OPG register)" meta={d.opgResult ? `Checked ${formatDateTime(d.opgResult.checkedAt)}, ${d.opgResult.reference}` : 'Not yet checked'} />
          <SheetBody>
            {d.opgResult ? (
              <KeyValue
                items={[
                  { key: 'Power of attorney', value: d.opgResult.powerOfAttorney.exists ? `${d.opgResult.powerOfAttorney.kind ?? ''} attorney ${d.opgResult.powerOfAttorney.attorneyName ?? ''}${d.opgResult.powerOfAttorney.registeredAt ? `, registered ${formatDate(d.opgResult.powerOfAttorney.registeredAt)}` : ''}` : 'None registered' },
                  { key: 'Guardianship', value: d.opgResult.guardianship.exists ? `${d.opgResult.guardianship.guardianName ?? ''}: ${(d.opgResult.guardianship.powers ?? []).join('; ')}${d.opgResult.guardianship.expiresAt ? `, expires ${formatDate(d.opgResult.guardianship.expiresAt)}` : ''}` : 'None' },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title="Route decision" meta={d.routeDecision ? `${formatDate(d.routeDecision.decidedAt)}, ${d.routeDecision.byName}` : 'Not yet decided'} />
        <SheetBody>
          {d.routeDecision ? (
            <KeyValue
              items={[
                { key: 'Route', value: <Pill tone="accent">{ROUTE_LABELS[d.routeDecision.route] ?? d.routeDecision.route}</Pill> },
                { key: 'Rationale', value: d.routeDecision.rationale },
                ...(d.routeDecision.s13za ? [{ key: 'Section 13ZA', value: `${d.routeDecision.s13za.considered ? 'Considered' : 'Not considered'}${d.routeDecision.s13za.applied ? ', applied' : ', not applied'}. ${d.routeDecision.s13za.reasoning}${d.routeDecision.s13za.objectionFrom ? ` Objection from ${d.routeDecision.s13za.objectionFrom}.` : ''}` }] : []),
              ]}
            />
          ) : null}
        </SheetBody>
      </Sheet>

      {app ? (
        <Sheet tone="accent">
          <SheetHead title="Guardianship application tracker" meta={`${app.applicant === 'council' ? 'Council application' : 'Private application'} by ${app.applicantName}${app.solicitor ? `, solicitor ${app.solicitor}` : ''}. ${app.court.sheriffCourt}.`} />
          <SheetBody>
            <div className={styles.grid2}>
              <div className="stack">
                {mhoClock ? <ClockNumeral daysRemaining={mhoClock.daysRemaining} band={mhoClock.band} status={mhoClock.status} label="MHO report (s57(4))" sub={`Notified ${formatDateTime(app.mhoNotifiedAt)}. Due ${formatDate(mhoClock.dueAt)}. ${app.mhoUserId ? `MHO ${userName(userById(data, app.mhoUserId)!)}. ` : ''}Report ${app.mhoReport.status.replace('-', ' ')}.`} size="sm" /> : null}
                <KeyValue
                  items={[
                    { key: 'Powers sought', value: <ul>{app.powersSought.map((p) => <li key={p}>{p}</li>)}</ul> },
                    { key: 'Medical reports', value: <ul>{app.medicalReports.map((m, i) => <li key={i}>{m.practitioner} ({m.kind.replace(/-/g, ' ')}): {m.status}{m.receivedAt ? ` ${formatDate(m.receivedAt)}` : ''}</li>)}</ul> },
                    { key: 'Suitability report', value: app.suitabilityReport.required ? (app.suitabilityReport.status ?? 'requested') : 'Not required (no financial powers)' },
                  ]}
                />
              </div>
              <div className="stack">
                <KeyValue
                  items={[
                    { key: 'Lodged', value: app.court.lodgedAt ? formatDate(app.court.lodgedAt) : 'Not yet lodged' },
                    { key: 'Hearing', value: app.court.hearingAt ? formatDate(app.court.hearingAt) : 'Not yet fixed' },
                    { key: 'Interim order', value: interim ? `${interim.grantedAt ? `Granted ${formatDate(interim.grantedAt)}${interim.expiresAt ? `, expires ${formatDate(interim.expiresAt)}` : ''}` : `Sought ${formatDate(interim.soughtAt)}, not yet granted`}. Renewals: ${interim.renewals}.` : 'Not sought' },
                  ]}
                />
                {interim?.grantedAt && interimDays !== null ? (
                  <div className={interimDays > 90 ? styles.warn : styles.info}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>
                      Interim order in force for {interimDays} days. Interim orders run for 3 months by default and cannot exceed 6 months in total (AWI 2000 s57 as amended). {interimDays > 90 ? 'Beyond the default period: check the renewal and the reasons for delay.' : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Order register" meta={d.orders.length === 0 ? 'No order in force' : `${d.orders.length} orders`} />
          <SheetBody>
            <ul className={styles.list}>
              {d.orders.map((o) => (
                <li key={o.id}>
                  <Pill size="sm" tone="accent">
                    {o.kind.replace(/-/g, ' ')}
                  </Pill>
                  <span>
                    <strong>{o.guardianName}</strong>. Granted {formatDate(o.grantedAt)}
                    {o.expiresAt ? `, expires ${formatDate(o.expiresAt)}` : ''}. Powers: {o.powers.join('; ')}.
                    <span className={styles.listMeta} style={{ display: 'block' }}>
                      {o.supervisingOfficerUserId ? `Supervising officer ${userName(userById(data, o.supervisingOfficerUserId)!)}. ` : ''}
                      {o.opgRegisteredAt ? `OPG registered ${formatDate(o.opgRegisteredAt)}. ` : ''}
                      {o.mwcNotifiedAt ? `MWC notified ${formatDate(o.mwcNotifiedAt)}.` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Supervision visits and investigations" />
          <SheetBody>
            {d.supervisionVisits.length === 0 && d.investigations.length === 0 ? <p className={styles.note}>Supervision starts once an order is granted (s10).</p> : null}
            <ul className={styles.list}>
              {d.supervisionVisits.map((v, i) => (
                <li key={`v${i}`}>
                  <span style={{ fontWeight: 700 }}>{formatDate(v.at)}</span>
                  <span>
                    {v.byName}: {v.summary}
                  </span>
                </li>
              ))}
              {d.investigations.map((v, i) => (
                <li key={`i${i}`}>
                  <Pill size="sm" tone={v.status === 'open' ? 'high' : 'outline'}>
                    {v.section}
                  </Pill>
                  <span>
                    Opened {formatDate(v.openedAt)}: {v.summary}
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <CapacityAssessmentDialog open={capOpen} onClose={() => setCapOpen(false)} process={process} />
    </>
  );
}
