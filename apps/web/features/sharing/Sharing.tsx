'use client';

import { agencyShort, classificationFor, classificationOfShare, contextFor, detailLevelLabel, exclusionPartyLabel, formatDate, formatDateTime, isExcludedParty, marking, processShort, recipientView, resolveNeedToKnow, roleLabel, shareStatusLabel, stageLabel, type ClassifiedShare, type Config, type InformationRequest, type Process, type User } from '@mas/domain';
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
import { useAppStore, useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './Sharing.module.css';

/** How a response to a request the engine sent is recorded: the transition, its input, and whether the protocol's proportionality confirmation is asked. */
interface ReturnRoute {
  transition: string;
  proportionality: boolean;
  input: (answer: { summary: string; nothingKnown: boolean; proportionate: boolean }) => unknown;
}

/**
 * The stage-engine transition a response to this request records, where the case sent the request
 * through the engine (D-222): a MARAC research request is answered as the agency's research return,
 * so the return lands on the case, completes the research clock when it is the last, and puts the
 * responder on the case; a MAPPA pre-meeting request is answered as the agency's return the same
 * way. A request made by hand is answered by hand.
 */
function returnTransitionFor(process: Process | undefined, request: InformationRequest): ReturnRoute | null {
  if (!process || process.status !== 'open') return null;
  if (process.type === 'marac' && process.detail.researchRequests.some((r) => r.id === request.id)) {
    return { transition: 'marac-record-research-return', proportionality: true, input: (a) => ({ requestId: request.id, summary: a.summary, nothingKnown: a.nothingKnown, relevantNecessaryProportionate: a.proportionate }) };
  }
  if (process.type === 'mappa' && process.detail.preMeetingReturns.some((r) => r.agency === request.toAgency && r.status === 'requested')) {
    return { transition: 'mappa-record-return', proportionality: false, input: (a) => ({ agency: request.toAgency, requestId: request.id, summary: a.summary, nothingKnown: a.nothingKnown }) };
  }
  return null;
}

/** Renders the <b> tag of a catalogue message as <strong>, for the bold lead-ins on a request. */
const STRONG: RichValues = { b: (chunks) => <strong>{chunks}</strong> };

/**
 * The Annex 2 marking a share carries, from the classification recorded with its lawful basis.
 * Undefined at Official: a share of routine information is not marked, and saying so in words is
 * better than an empty cell.
 */
/**
 * The marking a share carried when it was sent, from the share's own record rather than resolved
 * from the source. A source raised after the fact does not change what the recipient was given.
 */
function shareMarking(config: Config, share: ClassifiedShare): string | undefined {
  return marking(classificationFor(config, share));
}

export function Sharing() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useGrants();
  const write = useAppStore((s) => s.write);
  const recordTransition = useAppStore((s) => s.recordTransition);
  const readErrors = useWriteErrors();
  const select = useSelection((s) => s.select);
  const { toast } = useToast();
  const dev = useDevState();
  const tab = route.query.get('tab') ?? 'outbound';
  const [responding, setResponding] = useState<InformationRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [nothingKnown, setNothingKnown] = useState(false);
  const [proportionate, setProportionate] = useState(false);
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
    const label = t('sharing.audit.sent', { level: detailLevelLabel(s.detailLevel), name: s.recipient.name });
    const result = write({ collection: 'sharingRecords', record: { ...s, status: 'sent', sentAt: now.toISOString() }, intent: 'update', act: 'share', targetType: 'sharing', targetLabel: label, processId: s.processId, versionChange: label });
    if (!result.ok) {
      toast({ title: t('sharing.outbound.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
      return;
    }
    toast({ title: t('sharing.outbound.sentToastTitle'), text: t('sharing.outbound.sentToastText', { name: s.recipient.name }), tone: 'success' });
  }

  function markRead(id: string) {
    const s = data.sharingRecords.find((x) => x.id === id);
    if (!s) return;
    write({ collection: 'sharingRecords', record: { ...s, status: 'read', readAt: now.toISOString() }, intent: 'update', act: 'read', targetType: 'sharing', targetLabel: s.summary, processId: s.processId, versionChange: t('sharing.audit.read') });
  }

  function reset() {
    setResponding(null);
    setResponseText('');
    setFieldsProvided([]);
    setNothingKnown(false);
    setProportionate(false);
  }

  function respond() {
    if (!responding) return;
    const process = data.processes.find((p) => p.id === responding.processId);
    const via = returnTransitionFor(process, responding);
    if (via && process) {
      const result = recordTransition(process.id, via.transition, via.input({ summary: responseText, nothingKnown, proportionate }));
      if (!result.ok) {
        toast({ title: t('sharing.respondDialog.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
        return;
      }
      toast({ title: t('sharing.respondDialog.toastTitle'), text: t('sharing.respondDialog.researchText', { reference: process.reference, summary: result.outcome?.summary ?? '' }), tone: 'success' });
      reset();
      return;
    }
    const label = t('sharing.audit.responded', { name: responding.fromName, count: fieldsProvided.length });
    const result = write({ collection: 'informationRequests', record: { ...responding, status: 'responded', response: { at: now.toISOString(), byName: userName(user!), text: responseText, fieldsProvided } }, intent: 'update', act: 'share', targetType: 'sharing', targetLabel: label, processId: responding.processId, versionChange: label });
    if (!result.ok) {
      toast({ title: t('sharing.respondDialog.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
      return;
    }
    toast({ title: t('sharing.respondDialog.toastTitle'), text: t('sharing.respondDialog.toastText'), tone: 'success' });
    reset();
  }

  const respondingProcess = responding ? data.processes.find((p) => p.id === responding.processId) : undefined;
  const respondingVia = responding ? returnTransitionFor(respondingProcess, responding) : null;

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
                      <td>{shareMarking(config, s) ?? <span className={styles.rowReason}>{t('nav.drawer.fields.noMarking')}</span>}</td>
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
                      // The marking is shown before the recipient opens anything, and where their role
                      // may not receive Official-Sensitive material the summary itself is withheld.
                      const mark = shareMarking(config, s);
                      const view = recipientView(config, s, user.roleId);
                      return (
                        <tr key={s.id} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                          <td>
                            {mark ? <span className={styles.rowMarking}>{t('sharing.inbound.notifications.beforeOpening', { marking: mark })}</span> : null}
                            {view.showContent ? s.summary : <span className={styles.redacted}>{t('sharing.inbound.notifications.withheld')}</span>}
                            <span className={styles.rowReason}>{t('sharing.inbound.notifications.whyYou', { reason: s.reason })}</span>
                          </td>
                          <td>{p ? <AppLink href={processPath(p.id)}>{p.reference}</AppLink> : ''}</td>
                          <td>{detailLevelLabel(s.detailLevel)}</td>
                          <td>
                            {!view.showContent ? (
                              <Pill size="sm" tone="restricted">{t('sharing.inbound.notifications.withheldPill')}</Pill>
                            ) : s.status !== 'read' ? (
                              <Button size="sm" variant="quiet" onClick={() => markRead(s.id)}>{t('sharing.inbound.notifications.markRead')}</Button>
                            ) : (
                              <Pill size="sm" tone="low">{t('sharing.inbound.notifications.read')}</Pill>
                            )}
                          </td>
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
                        actions={r.status === 'open' ? <Button size="sm" variant="primary" onClick={() => setResponding(r)} data-testid={`respond-${r.id}`}>{t('sharing.inbound.requests.respond')}</Button> : <Pill size="sm" tone={r.status === 'responded' ? 'low' : 'outline'}>{r.status}</Pill>}
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
        onClose={reset}
        title={t('sharing.respondDialog.title')}
        size="lg"
        actions={
          <>
            <Button variant="quiet" onClick={reset}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" disabled={!(respondingVia && nothingKnown) && responseText.trim().length < 5} onClick={respond} data-testid="respond-submit">
              {t('sharing.respondDialog.confirm')}
            </Button>
          </>
        }
      >
        {responding ? (
          <div className="stack">
            {respondingVia ? <p>{t(respondingVia.proportionality ? 'sharing.respondDialog.researchIntro' : 'sharing.respondDialog.returnIntro', { name: responding.fromName, reference: respondingProcess?.reference ?? '', purpose: responding.purpose })}</p> : <p>{t('sharing.respondDialog.intro', { name: responding.fromName, fields: responding.fields.join('; '), purpose: responding.purpose })}</p>}
            {responding.fields.length > 0 ? (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{t('sharing.respondDialog.fieldsLegend')}</legend>
                {responding.fields.map((f) => (
                  <CheckboxField key={f} label={f} checked={fieldsProvided.includes(f)} onChange={(e) => setFieldsProvided(e.target.checked ? [...fieldsProvided, f] : fieldsProvided.filter((x) => x !== f))} />
                ))}
              </fieldset>
            ) : null}
            {respondingVia ? <CheckboxField label={t('sharing.respondDialog.nothingKnown')} hint={t('sharing.respondDialog.nothingKnownHint')} checked={nothingKnown} onChange={(e) => setNothingKnown(e.target.checked)} data-testid="respond-nothing-known" /> : null}
            {respondingVia && nothingKnown ? null : <TextareaField label={t('sharing.respondDialog.response')} required value={responseText} onChange={(e) => setResponseText(e.target.value)} hint={t('sharing.respondDialog.responseHint')} data-testid="respond-text" />}
            {respondingVia?.proportionality ? <CheckboxField label={t('sharing.respondDialog.proportionate')} hint={t('sharing.respondDialog.proportionateHint')} checked={proportionate} onChange={(e) => setProportionate(e.target.checked)} data-testid="respond-proportionate" /> : null}
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
          <dt>{t('sharing.preview.rows.marking')}</dt>
          <dd>
            {(() => {
              // What this recipient would actually be given, marking first. A recipient whose role may
              // not receive Official-Sensitive material is told so here rather than after the share.
              const carried = classificationFor(config, classificationOfShare(process));
              const mark = marking(carried);
              const view = recipientView(config, classificationOfShare(process), viewer.roleId);
              if (!mark) return t('sharing.preview.wouldReceiveNoMarking');
              return view.showContent ? mark : t('sharing.preview.wouldReceiveMarking', { marking: mark });
            })()}
          </dd>
        </div>
        <div className={styles.previewRow}>
          <dt>{t('sharing.preview.rows.lawfulBasis')}</dt>
          <dd>{access.lawfulBasisHints.join(' ') || t('common.values.notApplicable')}</dd>
        </div>
      </dl>
    </div>
  );
}
