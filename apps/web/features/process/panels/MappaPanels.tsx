'use client';

import { AGENCY_SHORT, MAPPA_CATEGORY_LABELS, MAPPA_LEVEL_LABELS, RISK_TOOL_LABELS, formatDate, formatDateTime, type MappaProcess } from '@mas/domain';
import { AgencyMark, Button, KeyValue, Pill, RiskBand, Sheet, SheetBody, SheetHead, Table, TableWrap, useToast } from '@mas/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { MappaReferralDialog } from '../forms/MappaReferralDialog';
import styles from './shared.module.css';

export function MappaPanels({ process }: { process: MappaProcess }) {
  const data = useData();
  const now = useNow();
  const user = useCurrentUser();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const [referralOpen, setReferralOpen] = useState(false);
  const d = process.detail;
  const risks = data.riskAssessments.filter((r) => d.riskAssessmentIds.includes(r.id) || r.processId === process.id);
  const era = d.era;
  const eraAddress = era?.proposedAddressId ? data.addresses.find((a) => a.id === era.proposedAddressId) : undefined;

  function decideDisclosure(id: string, status: 'approved' | 'declined') {
    if (!user) return;
    const next = { ...d, disclosures: d.disclosures.map((x) => (x.id === id ? { ...x, status, decidedByName: `${user.givenName} ${user.familyName}`, decidedAt: now.toISOString() } : x)) };
    upsert('processes', { ...process, detail: next });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `Disclosure ${status}: ${d.disclosures.find((x) => x.id === id)?.recipient ?? id}`, processId: process.id, restricted: true });
    toast({ title: `Disclosure ${status}`, text: status === 'approved' ? 'Only the recorded facts are disclosed, by the decision maker, and the recipient is told the limits.' : 'No disclosure. The rationale is recorded.', tone: 'success' });
  }

  return (
    <>
      <div className={styles.warn}>
        <ShieldAlert size={16} aria-hidden="true" />
        <span>Restricted record. Distribution list only. Every read is audited. MAPPA information is not given to victims (the Victim Notification Scheme is a separate route), to employers, or to the public, except through a recorded disclosure decision.</span>
      </div>

      <div className={styles.stack}>
        <Sheet>
          <SheetHead title="Category and level" meta={MAPPA_CATEGORY_LABELS[d.category]} actions={<Button size="sm" variant="secondary" onClick={() => setReferralOpen(true)}>Refer to Level 2 or 3</Button>} />
          <SheetBody>
            <div className={styles.bigLevel}>
              <span className={styles.bigLevelNumeral}>{d.level}</span>
              <span className={styles.bigLevelLabel}>{MAPPA_LEVEL_LABELS[d.level]}</span>
            </div>
            <div className={styles.levelHistory} style={{ marginTop: 12 }}>
              {d.levelHistory.map((h, i) => (
                <span key={i}>
                  Level {h.level} from {formatDate(h.at)}: {h.reason}
                </span>
              ))}
            </div>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Lead Responsible Authority and identifiers" />
          <SheetBody>
            <KeyValue
              items={[
                { key: 'Lead RA', value: AGENCY_SHORT[d.leadResponsibleAuthority] },
                { key: 'ViSOR reference', value: <span>{d.visorReference} <span className={styles.note}>(reference only; the platform is not ViSOR. MAPPS from 2028.)</span></span> },
                { key: 'Notification', value: `${formatDateTime(d.notification.at)} from ${d.notification.source} (${d.notification.byName})` },
                { key: 'Referral', value: d.referral ? `${formatDateTime(d.referral.at)} by ${d.referral.byName}: ${d.referral.reason}` : 'No referral recorded' },
                { key: 'Custody', value: d.custody.releasedAt ? `Released ${formatDate(d.custody.releasedAt)}${d.custody.establishment ? ` from ${d.custody.establishment}` : ''}${d.custody.licenceExpiresAt ? `; licence to ${formatDate(d.custody.licenceExpiresAt)}` : ''}` : d.custody.establishment ? `In custody, ${d.custody.establishment}` : 'Not in custody' },
              ]}
            />
          </SheetBody>
        </Sheet>
      </div>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title="Sex Offender Notification Requirements" />
          <SheetBody>
            <KeyValue
              items={[
                { key: 'Subject to SONR', value: d.sonr.subject ? 'Yes' : 'No' },
                { key: 'Compliance', value: <Pill size="sm" tone={d.sonr.compliant ? 'low' : 'critical'}>{d.sonr.compliant ? 'Compliant' : 'Non-compliant'}</Pill> },
                { key: 'Last notification', value: d.sonr.lastNotificationAt ? formatDate(d.sonr.lastNotificationAt) : 'None' },
                { key: 'Next due', value: d.sonr.nextDueAt ? formatDate(d.sonr.nextDueAt) : 'Not set' },
                { key: 'Requirements end', value: d.sonr.endsAt ? formatDate(d.sonr.endsAt) : 'Indefinite' },
              ]}
            />
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Licence conditions" meta={`${d.licenceConditions.filter((c) => c.status === 'active').length} active`} />
          <SheetBody>
            <ul className={styles.list}>
              {d.licenceConditions.map((c) => (
                <li key={c.id}>
                  <Pill size="sm" tone={c.status === 'active' ? 'accent' : c.status === 'breached' ? 'critical' : 'outline'}>
                    {c.status}
                  </Pill>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title="Risk assessment tools" meta="The platform records the tool, date, assessor and band. It does not implement the tools." />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Date</th>
                  <th scope="col">Assessor</th>
                  <th scope="col">Band</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td>{RISK_TOOL_LABELS[r.tool]}</td>
                    <td>{formatDate(r.assessedAt)}</td>
                    <td>
                      {r.assessorName} ({AGENCY_SHORT[r.assessorAgency]})
                    </td>
                    <td>
                      <RiskBand band={r.band} label={r.bandLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>

      {d.rmp ? (
        <Sheet>
          <SheetHead title="Risk Management Plan" meta={`Reviewed ${formatDate(d.rmp.reviewedAt)}. RMA FRAME standards.`} />
          <SheetBody>
            <div className={styles.grid2}>
              <KeyValue items={[{ key: 'Triggers', value: <ul>{d.rmp.triggers.map((t) => <li key={t}>{t}</li>)}</ul> }, { key: 'Contingencies', value: <ul>{d.rmp.contingencies.map((t) => <li key={t}>{t}</li>)}</ul> }, { key: 'Controls', value: <ul>{d.rmp.controls.map((t) => <li key={t}>{t}</li>)}</ul> }]} />
              <KeyValue items={[{ key: 'Victim safety', value: d.rmp.victimSafety }, { key: 'Accommodation', value: d.rmp.accommodation }, { key: 'Employment', value: d.rmp.employment }, { key: 'Associates', value: d.rmp.associates }]} />
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet tone={era?.status === 'in-progress' ? 'accent' : 'default'}>
          <SheetHead title="Environmental Risk Assessment" meta={era ? `${era.status.replace('-', ' ')}. Started ${formatDate(era.startedAt)} by ${era.assessorName}.` : 'Not started'} />
          <SheetBody>
            {era ? (
              <KeyValue
                items={[
                  { key: 'Proposed address', value: eraAddress ? `${eraAddress.line1}, ${eraAddress.town}, ${eraAddress.postcode}` : 'Not recorded' },
                  { key: 'Concerns', value: <ul>{era.concerns.map((c) => <li key={c}>{c}</li>)}</ul> },
                  { key: 'Conclusion', value: era.conclusion ?? 'Pending' },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title="Pre-meeting returns" meta={`For the review on ${d.reviewSchedule.nextDueAt ? formatDate(d.reviewSchedule.nextDueAt) : 'the next meeting'}`} />
          <SheetBody>
            <ul className={styles.list}>
              {d.preMeetingReturns.map((r, i) => (
                <li key={i}>
                  <AgencyMark agency={r.agency} hideLabel />
                  <span>
                    <strong>{AGENCY_SHORT[r.agency]}</strong> ({r.contact}): <Pill size="sm" tone={r.status === 'returned' ? 'low' : r.status === 'nothing-known' ? 'outline' : 'medium'}>{r.status.replace('-', ' ')}</Pill>
                    {r.summary ? <span className={styles.listMeta} style={{ display: 'block' }}>{r.summary}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title="Disclosure decisions register" meta="Third parties receive specific facts only, by a recorded decision." />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">Recipient</th>
                  <th scope="col">Facts to disclose</th>
                  <th scope="col">Rationale</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {d.disclosures.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No disclosure decisions.</td>
                  </tr>
                ) : null}
                {d.disclosures.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.recipient} <span className={styles.note}>({x.recipientKind})</span>
                    </td>
                    <td>{x.factsToDisclose.join('; ')}</td>
                    <td>{x.rationale}</td>
                    <td>
                      <Pill size="sm" tone={x.status === 'pending' ? 'medium' : x.status === 'declined' ? 'outline' : 'accent'}>
                        {x.status}
                      </Pill>
                      {x.decidedByName ? <span className={styles.listMeta} style={{ display: 'block' }}>{x.decidedByName}, {x.decidedAt ? formatDate(x.decidedAt) : ''}</span> : null}
                    </td>
                    <td>
                      {x.status === 'pending' ? (
                        <span className={styles.pills}>
                          <Button size="sm" variant="primary" onClick={() => decideDisclosure(x.id, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => decideDisclosure(x.id, 'declined')}>
                            Decline
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>

      {d.exit ? (
        <Sheet tone="well">
          <SheetHead title="Exit" meta={`${d.exit.kind.replace('-', ' ')} on ${formatDate(d.exit.at)}`} />
          <SheetBody>{d.exit.note}</SheetBody>
        </Sheet>
      ) : null}

      <MappaReferralDialog open={referralOpen} onClose={() => setReferralOpen(false)} process={process} />
    </>
  );
}
