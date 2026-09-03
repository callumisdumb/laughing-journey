'use client';

import { AGENCY_SHORT, MAPPA_CATEGORY_LABELS, MAPPA_LEVEL_LABELS, RISK_TOOL_LABELS, formatDate, formatDateTime, type MappaProcess } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, KeyValue, Pill, RiskBand, Sheet, SheetBody, SheetHead, Table, TableWrap, useToast } from '@mas/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { MappaReferralDialog } from '../forms/MappaReferralDialog';
import styles from './shared.module.css';

export function MappaPanels({ process }: { process: MappaProcess }) {
  const t = useT();
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
    toast({ title: t('mappa.disclosures.decided.title', { status }), text: t('mappa.disclosures.decided.text', { status }), tone: 'success' });
  }

  return (
    <>
      <div className={styles.warn}>
        <ShieldAlert size={16} aria-hidden="true" />
        <span>{t('mappa.banner')}</span>
      </div>

      <div className={styles.stack}>
        <Sheet>
          <SheetHead title={t('mappa.level.title')} meta={MAPPA_CATEGORY_LABELS[d.category]} actions={<Button size="sm" variant="secondary" onClick={() => setReferralOpen(true)}>{t('mappa.level.refer')}</Button>} />
          <SheetBody>
            <div className={styles.bigLevel}>
              <span className={styles.bigLevelNumeral}>{d.level}</span>
              <span className={styles.bigLevelLabel}>{MAPPA_LEVEL_LABELS[d.level]}</span>
            </div>
            <div className={styles.levelHistory} style={{ marginTop: 12 }}>
              {d.levelHistory.map((h, i) => (
                <span key={i}>{t('mappa.level.history', { level: h.level, date: formatDate(h.at), reason: h.reason })}</span>
              ))}
            </div>
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('mappa.identifiers.title')} />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('mappa.identifiers.leadRa'), value: AGENCY_SHORT[d.leadResponsibleAuthority] },
                { key: t('mappa.identifiers.visor'), value: <span>{d.visorReference} <span className={styles.note}>{t('mappa.identifiers.visorNote')}</span></span> },
                { key: t('mappa.identifiers.notification'), value: t('mappa.identifiers.notificationValue', { when: formatDateTime(d.notification.at), source: d.notification.source, name: d.notification.byName }) },
                { key: t('mappa.identifiers.referral'), value: d.referral ? t('mappa.identifiers.referralValue', { when: formatDateTime(d.referral.at), name: d.referral.byName, reason: d.referral.reason }) : t('mappa.identifiers.noReferral') },
                { key: t('mappa.identifiers.custody'), value: d.custody.releasedAt ? t('mappa.identifiers.released', { date: formatDate(d.custody.releasedAt), hasEstablishment: d.custody.establishment ? 'yes' : 'no', establishment: d.custody.establishment ?? '', hasLicence: d.custody.licenceExpiresAt ? 'yes' : 'no', licence: d.custody.licenceExpiresAt ? formatDate(d.custody.licenceExpiresAt) : '' }) : d.custody.establishment ? t('mappa.identifiers.inCustody', { establishment: d.custody.establishment }) : t('mappa.identifiers.notInCustody') },
              ]}
            />
          </SheetBody>
        </Sheet>
      </div>

      <div className={styles.grid2}>
        <Sheet>
          <SheetHead title={t('mappa.sonr.title')} />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('mappa.sonr.subject'), value: d.sonr.subject ? t('common.answers.yes') : t('common.answers.no') },
                { key: t('mappa.sonr.compliance'), value: <Pill size="sm" tone={d.sonr.compliant ? 'low' : 'critical'}>{d.sonr.compliant ? t('mappa.sonr.compliant') : t('mappa.sonr.nonCompliant')}</Pill> },
                { key: t('mappa.sonr.lastNotification'), value: d.sonr.lastNotificationAt ? formatDate(d.sonr.lastNotificationAt) : t('common.keyValue.none') },
                { key: t('mappa.sonr.nextDue'), value: d.sonr.nextDueAt ? formatDate(d.sonr.nextDueAt) : t('mappa.sonr.notSet') },
                { key: t('mappa.sonr.end'), value: d.sonr.endsAt ? formatDate(d.sonr.endsAt) : t('mappa.sonr.indefinite') },
              ]}
            />
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('mappa.licence.title')} meta={t('mappa.licence.meta', { count: d.licenceConditions.filter((c) => c.status === 'active').length })} />
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
        <SheetHead title={t('mappa.risk.title')} meta={t('mappa.risk.meta')} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('mappa.risk.columns.tool')}</th>
                  <th scope="col">{t('mappa.risk.columns.date')}</th>
                  <th scope="col">{t('mappa.risk.columns.assessor')}</th>
                  <th scope="col">{t('mappa.risk.columns.band')}</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td>{RISK_TOOL_LABELS[r.tool]}</td>
                    <td>{formatDate(r.assessedAt)}</td>
                    <td>{t('mappa.risk.assessor', { name: r.assessorName, agency: AGENCY_SHORT[r.assessorAgency] })}</td>
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
          <SheetHead title={t('mappa.rmp.title')} meta={t('mappa.rmp.meta', { date: formatDate(d.rmp.reviewedAt) })} />
          <SheetBody>
            <div className={styles.grid2}>
              <KeyValue items={[{ key: t('mappa.rmp.triggers'), value: <ul>{d.rmp.triggers.map((x) => <li key={x}>{x}</li>)}</ul> }, { key: t('mappa.rmp.contingencies'), value: <ul>{d.rmp.contingencies.map((x) => <li key={x}>{x}</li>)}</ul> }, { key: t('mappa.rmp.controls'), value: <ul>{d.rmp.controls.map((x) => <li key={x}>{x}</li>)}</ul> }]} />
              <KeyValue items={[{ key: t('mappa.rmp.victimSafety'), value: d.rmp.victimSafety }, { key: t('mappa.rmp.accommodation'), value: d.rmp.accommodation }, { key: t('mappa.rmp.employment'), value: d.rmp.employment }, { key: t('mappa.rmp.associates'), value: d.rmp.associates }]} />
            </div>
          </SheetBody>
        </Sheet>
      ) : null}

      <div className={styles.grid2}>
        <Sheet tone={era?.status === 'in-progress' ? 'accent' : 'default'}>
          <SheetHead title={t('mappa.era.title')} meta={era ? t('mappa.era.meta', { status: era.status.replace('-', ' '), date: formatDate(era.startedAt), name: era.assessorName }) : t('mappa.era.notStarted')} />
          <SheetBody>
            {era ? (
              <KeyValue
                items={[
                  { key: t('mappa.era.address'), value: eraAddress ? t('mappa.era.addressValue', { line1: eraAddress.line1, town: eraAddress.town, postcode: eraAddress.postcode }) : t('mappa.era.notRecorded') },
                  { key: t('mappa.era.concerns'), value: <ul>{era.concerns.map((c) => <li key={c}>{c}</li>)}</ul> },
                  { key: t('mappa.era.conclusion'), value: era.conclusion ?? t('mappa.era.pending') },
                ]}
              />
            ) : null}
          </SheetBody>
        </Sheet>
        <Sheet>
          <SheetHead title={t('mappa.returns.title')} meta={t('mappa.returns.meta', { hasDate: d.reviewSchedule.nextDueAt ? 'yes' : 'no', date: d.reviewSchedule.nextDueAt ? formatDate(d.reviewSchedule.nextDueAt) : '' })} />
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
        <SheetHead title={t('mappa.disclosures.title')} meta={t('mappa.disclosures.meta')} />
        <SheetBody flush>
          <TableWrap style={{ border: 0, borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('mappa.disclosures.columns.recipient')}</th>
                  <th scope="col">{t('mappa.disclosures.columns.facts')}</th>
                  <th scope="col">{t('mappa.disclosures.columns.rationale')}</th>
                  <th scope="col">{t('mappa.disclosures.columns.status')}</th>
                  <th scope="col">{t('mappa.disclosures.columns.decision')}</th>
                </tr>
              </thead>
              <tbody>
                {d.disclosures.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t('mappa.disclosures.empty')}</td>
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
                      {x.decidedByName ? <span className={styles.listMeta} style={{ display: 'block' }}>{t('mappa.disclosures.decidedBy', { name: x.decidedByName, date: x.decidedAt ? formatDate(x.decidedAt) : '' })}</span> : null}
                    </td>
                    <td>
                      {x.status === 'pending' ? (
                        <span className={styles.pills}>
                          <Button size="sm" variant="primary" onClick={() => decideDisclosure(x.id, 'approved')}>
                            {t('mappa.disclosures.approve')}
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => decideDisclosure(x.id, 'declined')}>
                            {t('mappa.disclosures.decline')}
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
          <SheetHead title={t('mappa.exit.title')} meta={t('mappa.exit.meta', { kind: d.exit.kind.replace('-', ' '), date: formatDate(d.exit.at) })} />
          <SheetBody>{d.exit.note}</SheetBody>
        </Sheet>
      ) : null}

      <MappaReferralDialog open={referralOpen} onClose={() => setReferralOpen(false)} process={process} />
    </>
  );
}
