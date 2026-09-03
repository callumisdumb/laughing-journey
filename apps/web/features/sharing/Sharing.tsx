'use client';

import { agencyShort, classificationFor, contextFor, detailLevelLabel, exclusionPartyLabel, formatDate, formatDateTime, isExcludedParty, marking, processShort, resolveNeedToKnow, roleLabel, shareStatusLabel, stageLabel, type Config, type Dataset, type InformationRequest, type Process, type User } from '@mas/domain';
import { useT, type RichValues } from '@mas/messages';
import { AgencyMark, Button, CheckboxField, Dialog, EmptyState, Pill, ProcessMark, SelectField, Sheet, SheetBody, SheetHead, TabPanel, Table, TableWrap, Tabs, TextareaField, useToast } from '@mas/ui';
import { Eye, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, personById, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Sharing.module.css';

/** Renders the <b> tag of a catalogue message as <strong>, for the bold lead-ins on a request. */
const STRONG: RichValues = { b: (chunks) => <strong>{chunks}</strong> };

/**
 * The Annex 2 marking a share carries, from the classification recorded with its lawful basis.
 * Undefined at Official: a share of routine information is not marked, and saying so in words is
 * better than an empty cell.
 */
function shareMarking(config: Config, data: Dataset, lawfulBasisId: string): string | undefined {
  const basis = data.lawfulBases.find((b) => b.id === lawfulBasisId);
  return basis ? marking(classificationFor(config, basis.classification)) : undefined;
}

export function Sharing() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const select = useSelection((s) => s.select);
  const { toast } = useToast();
  const dev = useDevState();
  const tab = route.query.get('tab') ?? 'outbound';
  const [responding, setResponding] = useState<InformationRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [fieldsProvided, setFieldsProvided] = useState<string[]>([]);
  const [previewProcess, setPreviewProcess] = useState('');
  const [previewUser, setPreviewUser] = useState('');

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const tabs = [
    { id: 'outbound', label: t('sharing.tabs.outbound') },
    { id: 'inbound', label: t('sharing.tabs.inbound') },
    { id: 'preview', label: t('sharing.tabs.preview') },
  ];
  const visibleProcesses = data.processes.filter((p) => accessForUser(data, config, user, p, grants, now).level === 'full');
  const outbound = data.sharingRecords.filter((s) => visibleProcesses.some((p) => p.id === s.processId) || s.createdByUserId === user.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const received = data.sharingRecords.filter((s) => s.recipient.userId === user.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const inbound = data.informationRequests.filter((r) => r.toUserId === user.id || (!r.toUserId && r.toAgency === user.agency)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function setTab(id: string) {
    navigate(`/sharing${setQuery(route.query, { tab: id === 'outbound' ? null : id })}`, { replace: true });
  }

  function markSent(id: string) {
    const s = data.sharingRecords.find((x) => x.id === id);
    if (!s) return;
    upsert('sharingRecords', { ...s, status: 'sent', sentAt: now.toISOString() });
    audit({ act: 'share', targetType: 'sharing', targetId: s.id, targetLabel: t('sharing.audit.sent', { level: detailLevelLabel(s.detailLevel), name: s.recipient.name }), processId: s.processId });
    toast({ title: t('sharing.outbound.sentToastTitle'), text: t('sharing.outbound.sentToastText', { name: s.recipient.name }), tone: 'success' });
  }

  function markRead(id: string) {
    const s = data.sharingRecords.find((x) => x.id === id);
    if (!s) return;
    upsert('sharingRecords', { ...s, status: 'read', readAt: now.toISOString() });
    audit({ act: 'read', targetType: 'sharing', targetId: s.id, targetLabel: s.summary, processId: s.processId });
  }

  function respond() {
    if (!responding) return;
    upsert('informationRequests', { ...responding, status: 'responded', response: { at: now.toISOString(), byName: userName(user!), text: responseText, fieldsProvided } });
    audit({ act: 'share', targetType: 'sharing', targetId: responding.id, targetLabel: t('sharing.audit.responded', { name: responding.fromName, count: fieldsProvided.length }), processId: responding.processId });
    toast({ title: t('sharing.respondDialog.toastTitle'), text: t('sharing.respondDialog.toastText'), tone: 'success' });
    setResponding(null);
    setResponseText('');
    setFieldsProvided([]);
  }

  const pProcess = data.processes.find((p) => p.id === previewProcess);
  const pUser = data.users.find((u) => u.id === previewUser);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('sharing.title')}</h1>
          <p className="page-lede">{t('sharing.lede')}</p>
        </div>
      </div>
      <div className={styles.tabs}>
        <Tabs items={tabs.map((item) => ({ ...item, count: item.id === 'outbound' ? outbound.filter((s) => s.status === 'queued').length : item.id === 'inbound' ? inbound.filter((r) => r.status === 'open').length + received.filter((s) => s.status !== 'read').length : undefined }))} value={tab} onChange={setTab} label={t('sharing.tabs.label')} idPrefix="sharing" />
      </div>

      <TabPanel id="outbound" active={tab === 'outbound'} idPrefix="sharing">
        <ScreenState state={dev ?? (outbound.length === 0 ? 'empty' : 'ready')} empty={{ title: t('sharing.outbound.empty.title'), text: t('sharing.outbound.empty.text') }}>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('sharing.outbound.columns.when')}</th>
                  <th scope="col">{t('sharing.outbound.columns.recipient')}</th>
                  <th scope="col">{t('sharing.outbound.columns.process')}</th>
                  <th scope="col">{t('sharing.outbound.columns.detailLevel')}</th>
                  <th scope="col">{t('sharing.outbound.columns.classification')}</th>
                  <th scope="col">{t('sharing.outbound.columns.why')}</th>
                  <th scope="col">{t('sharing.outbound.columns.status')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('common.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {outbound.map((s) => {
                  const p = data.processes.find((x) => x.id === s.processId);
                  return (
                    <tr key={s.id} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                      <td>
                        <AgencyMark agency={s.recipient.agency} hideLabel /> {s.recipient.name}
                        <span className={styles.rowReason}>{s.recipient.role}</span>
                      </td>
                      <td>{p ? <AppLink href={processPath(p.id)}><ProcessMark type={p.type} /></AppLink> : ''}</td>
                      <td>
                        {detailLevelLabel(s.detailLevel)}
                        {s.fields ? <span className={styles.rowReason}>{s.fields.join('; ')}</span> : null}
                      </td>
                      <td>{shareMarking(config, data, s.lawfulBasisId) ?? <span className={styles.rowReason}>{t('nav.drawer.fields.noMarking')}</span>}</td>
                      <td>
                        {s.summary}
                        <span className={styles.rowReason}>{s.reason}</span>
                      </td>
                      <td>
                        <Pill size="sm" tone={s.status === 'read' ? 'low' : s.status === 'sent' ? 'accent' : s.status === 'withheld' ? 'restricted' : 'medium'}>
                          {shareStatusLabel(s.status)}
                        </Pill>
                      </td>
                      <td>{s.status === 'queued' ? <Button size="sm" variant="secondary" onClick={() => markSent(s.id)}>{t('sharing.outbound.send')}</Button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </ScreenState>
      </TabPanel>

      <TabPanel id="inbound" active={tab === 'inbound'} idPrefix="sharing">
        <div className="stack">
          <Sheet>
            <SheetHead title={t('sharing.inbound.notifications.title')} meta={t('sharing.inbound.notifications.meta', { count: received.filter((s) => s.status !== 'read').length })} />
            <SheetBody flush>
              {received.length === 0 ? <div style={{ padding: 16, color: 'var(--color-ink-3)' }}>{t('sharing.inbound.notifications.empty')}</div> : null}
              <TableWrap style={{ border: 0, borderRadius: 0 }}>
                <Table>
                  <tbody>
                    {received.map((s) => {
                      const p = data.processes.find((x) => x.id === s.processId);
                      return (
                        <tr key={s.id} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                          <td>
                            {s.summary}
                            <span className={styles.rowReason}>{t('sharing.inbound.notifications.whyYou', { reason: s.reason })}</span>
                            {shareMarking(config, data, s.lawfulBasisId) ? <span className={styles.rowMarking}>{shareMarking(config, data, s.lawfulBasisId)}</span> : null}
                          </td>
                          <td>{p ? <AppLink href={processPath(p.id)}>{p.reference}</AppLink> : ''}</td>
                          <td>{detailLevelLabel(s.detailLevel)}</td>
                          <td>{s.status !== 'read' ? <Button size="sm" variant="quiet" onClick={() => markRead(s.id)}>{t('sharing.inbound.notifications.markRead')}</Button> : <Pill size="sm" tone="low">{t('sharing.inbound.notifications.read')}</Pill>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
          <Sheet>
            <SheetHead title={t('sharing.inbound.requests.title')} meta={t('sharing.inbound.requests.meta', { count: inbound.filter((r) => r.status === 'open').length })} />
            <SheetBody>
              {inbound.length === 0 ? <EmptyState title={t('sharing.inbound.requests.emptyTitle')} text={t('sharing.inbound.requests.emptyText')} /> : null}
              <div className="stack">
                {inbound.map((r) => {
                  const p = data.processes.find((x) => x.id === r.processId);
                  const subject = personById(data, r.subjectId);
                  return (
                    <Sheet key={r.id} tone="paper">
                      <SheetHead
                        title={t('sharing.inbound.requests.asksAbout', { name: r.fromName, agency: agencyShort(r.fromAgency), subject: subject ? fullName(subject) : r.subjectId })}
                        meta={t('sharing.inbound.requests.received', { hasProcess: p ? 'yes' : 'no', process: p ? processShort(p.type) : '', reference: p?.reference ?? '', received: formatDateTime(r.createdAt), hasDue: r.dueAt ? 'yes' : 'no', due: r.dueAt ? formatDate(r.dueAt) : '' })}
                        actions={r.status === 'open' ? <Button size="sm" variant="primary" onClick={() => setResponding(r)}>{t('sharing.inbound.requests.respond')}</Button> : <Pill size="sm" tone={r.status === 'responded' ? 'low' : 'outline'}>{r.status}</Pill>}
                      />
                      <SheetBody>
                        <div className={styles.request}>
                          <span>{t.rich('sharing.inbound.requests.purpose', { ...STRONG, purpose: r.purpose })}</span>
                          <span>{t.rich('sharing.inbound.requests.fields', { ...STRONG, fields: r.fields.join('; ') })}</span>
                          {r.response ? <span>{t.rich('sharing.inbound.requests.response', { ...STRONG, when: formatDateTime(r.response.at), name: r.response.byName, text: r.response.text, fields: r.response.fieldsProvided.join('; ') || t('common.values.none') })}</span> : null}
                        </div>
                      </SheetBody>
                    </Sheet>
                  );
                })}
              </div>
            </SheetBody>
          </Sheet>
        </div>
      </TabPanel>

      <TabPanel id="preview" active={tab === 'preview'} idPrefix="sharing">
        <div className={styles.preview}>
          <div className="stack">
            <SelectField label={t('sharing.preview.process')} value={previewProcess} onChange={(e) => setPreviewProcess(e.target.value)} placeholder={t('sharing.preview.processPlaceholder')} options={visibleProcesses.map((p) => ({ value: p.id, label: `${p.reference}: ${p.title}` }))} />
            <SelectField label={t('sharing.preview.seenAs')} value={previewUser} onChange={(e) => setPreviewUser(e.target.value)} placeholder={t('sharing.preview.seenAsPlaceholder')} options={data.users.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)} (${agencyShort(u.agency)})` }))} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)' }}>{t('sharing.preview.note')}</p>
          </div>
          {pProcess && pUser ? <Preview process={pProcess} viewer={pUser} /> : <EmptyState title={t('sharing.preview.empty.title')} text={t('sharing.preview.empty.text')} />}
        </div>
      </TabPanel>

      <Dialog
        open={responding !== null}
        onClose={() => setResponding(null)}
        title={t('sharing.respondDialog.title')}
        size="lg"
        actions={
          <>
            <Button variant="quiet" onClick={() => setResponding(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" disabled={responseText.trim().length < 5} onClick={respond}>
              {t('sharing.respondDialog.confirm')}
            </Button>
          </>
        }
      >
        {responding ? (
          <div className="stack">
            <p>{t('sharing.respondDialog.intro', { name: responding.fromName, fields: responding.fields.join('; '), purpose: responding.purpose })}</p>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{t('sharing.respondDialog.fieldsLegend')}</legend>
              {responding.fields.map((f) => (
                <CheckboxField key={f} label={f} checked={fieldsProvided.includes(f)} onChange={(e) => setFieldsProvided(e.target.checked ? [...fieldsProvided, f] : fieldsProvided.filter((x) => x !== f))} />
              ))}
            </fieldset>
            <TextareaField label={t('sharing.respondDialog.response')} required value={responseText} onChange={(e) => setResponseText(e.target.value)} hint={t('sharing.respondDialog.responseHint')} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Preview({ process, viewer }: { process: Process; viewer: User }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const access = accessForUser(data, config, viewer, process, [], now);
  const subject = personById(data, process.subjectIds[0]);
  const res = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  const rows = res.recipients.filter((r) => r.agency === viewer.agency && (r.role === 'any' || r.role === viewer.roleId));
  const excluded = isExcludedParty(process, { userId: viewer.id }, config.exclusions, process.stage, data.relationships);
  const hidden = <span className={styles.redacted}>{t('sharing.preview.hidden')}</span>;
  return (
    <div className={styles.previewCard} aria-live="polite">
      <div className={styles.previewLevel}>
        {access.level === 'none' ? <Lock size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {t('sharing.preview.wouldSee', { name: userName(viewer), level: access.level === 'none' ? t('sharing.preview.nothing') : detailLevelLabel(access.level), redacted: access.redacted ? 'yes' : 'no' })}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', marginBottom: 10 }}>{access.reason}</p>
      <dl>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.processExists')}</dt>
          <dd>{access.level === 'none' ? hidden : `${processShort(process.type)} ${process.reference}`}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.stageLead')}</dt>
          <dd>{access.level === 'none' ? hidden : `${stageLabel(process.type, process.stage)}, ${agencyShort(process.leadAgency)}`}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.subject')}</dt>
          <dd>{access.level === 'full' || access.level === 'summary' ? (access.redacted ? <span className={styles.redacted}>{t('sharing.preview.nameRedacted')}</span> : subject ? fullName(subject) : '') : hidden}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.namedFields')}</dt>
          <dd>{access.fields.length > 0 ? access.fields.join('; ') : access.level === 'full' ? t('sharing.preview.everything') : <span className={styles.redacted}>{t('common.values.none')}</span>}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.detail')}</dt>
          <dd>{access.level === 'full' ? t('sharing.preview.visible') : hidden}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.rules')}</dt>
          <dd>{rows.length === 0 ? (access.member ? t('sharing.preview.caseMembership') : t('sharing.preview.defaultDeny')) : rows.map((r) => `${r.rowId} (${detailLevelLabel(r.detailLevel)})`).join('; ')}</dd>
        </div>
        {excluded ? (
          <div className={styles.previewRow}>
            <dt>{t('sharing.preview.rows.excludedParty')}</dt>
            <dd>{t('sharing.preview.excludedText', { name: userName(viewer), role: excluded.party.label.toLowerCase(), party: exclusionPartyLabel(excluded.party.party).toLowerCase(), reason: excluded.party.reason ?? excluded.exclusion.reason })}</dd>
          </div>
        ) : null}
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.exclusions')}</dt>
          <dd>{res.exclusions.map((e) => e.label).join('; ') || t('sharing.preview.noExclusions')}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.lawfulBasis')}</dt>
          <dd>{access.lawfulBasisHints.join(' ') || t('common.values.notApplicable')}</dd>
        </div>
      </dl>
    </div>
  );
}
