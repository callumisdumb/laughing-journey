'use client';

import { AGENCY_SHORT, DETAIL_LEVEL_LABELS, EXCLUSION_PARTY_LABELS, PROCESS_SHORT, ROLE_DEFINITIONS, formatDate, formatDateTime, isExcludedParty, resolveNeedToKnow, contextFor, stageLabel, type InformationRequest, type Process, type User } from '@mas/domain';
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

const TABS = [
  { id: 'outbound', label: 'Outbound queue' },
  { id: 'inbound', label: 'Inbound requests' },
  { id: 'preview', label: 'What would X see' },
];

export function Sharing() {
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
    audit({ act: 'share', targetType: 'sharing', targetId: s.id, targetLabel: `${s.detailLevel} to ${s.recipient.name}`, processId: s.processId });
    toast({ title: 'Sent', text: `${s.recipient.name} will see why they received it and under what lawful basis.`, tone: 'success' });
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
    audit({ act: 'share', targetType: 'sharing', targetId: responding.id, targetLabel: `Responded to ${responding.fromName}: ${fieldsProvided.length} fields`, processId: responding.processId });
    toast({ title: 'Response sent', text: 'Only the fields you ticked are shared. The response carries the same lawful basis as the request.', tone: 'success' });
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
          <h1>Sharing and notifications</h1>
          <p className="page-lede">Every share carries a purpose, a lawful basis, a proportionality note and an author. Nothing leaves without a reason the recipient can read.</p>
        </div>
      </div>
      <div className={styles.tabs}>
        <Tabs items={TABS.map((t) => ({ ...t, count: t.id === 'outbound' ? outbound.filter((s) => s.status === 'queued').length : t.id === 'inbound' ? inbound.filter((r) => r.status === 'open').length + received.filter((s) => s.status !== 'read').length : undefined }))} value={tab} onChange={setTab} label="Sharing sections" idPrefix="sharing" />
      </div>

      <TabPanel id="outbound" active={tab === 'outbound'} idPrefix="sharing">
        <ScreenState state={dev ?? (outbound.length === 0 ? 'empty' : 'ready')} empty={{ title: 'No shares yet', text: 'Shares are created when a meeting minute is distributed, an event is promoted to the integrated chronology, or a notification rule fires.' }}>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Process</th>
                  <th scope="col">Detail level</th>
                  <th scope="col">Why</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
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
                        {DETAIL_LEVEL_LABELS[s.detailLevel]}
                        {s.fields ? <span className={styles.rowReason}>{s.fields.join('; ')}</span> : null}
                      </td>
                      <td>
                        {s.summary}
                        <span className={styles.rowReason}>{s.reason}</span>
                      </td>
                      <td>
                        <Pill size="sm" tone={s.status === 'read' ? 'low' : s.status === 'sent' ? 'accent' : s.status === 'withheld' ? 'restricted' : 'medium'}>
                          {s.status}
                        </Pill>
                      </td>
                      <td>{s.status === 'queued' ? <Button size="sm" variant="secondary" onClick={() => markSent(s.id)}>Send</Button> : null}</td>
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
            <SheetHead title="Notifications to you" meta={`${received.filter((s) => s.status !== 'read').length} unread. Each one says why you received it.`} />
            <SheetBody flush>
              {received.length === 0 ? <div style={{ padding: 16, color: 'var(--color-ink-3)' }}>Nothing has been shared with you yet.</div> : null}
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
                            <span className={styles.rowReason}>Why you: {s.reason}</span>
                          </td>
                          <td>{p ? <AppLink href={processPath(p.id)}>{p.reference}</AppLink> : ''}</td>
                          <td>{DETAIL_LEVEL_LABELS[s.detailLevel]}</td>
                          <td>{s.status !== 'read' ? <Button size="sm" variant="quiet" onClick={() => markRead(s.id)}>Mark read</Button> : <Pill size="sm" tone="low">read</Pill>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
          <Sheet>
            <SheetHead title="Requests for information from other agencies" meta={`${inbound.filter((r) => r.status === 'open').length} open`} />
            <SheetBody>
              {inbound.length === 0 ? <EmptyState title="No requests" text="Requests from other agencies for named fields appear here with their purpose and lawful basis." /> : null}
              <div className="stack">
                {inbound.map((r) => {
                  const p = data.processes.find((x) => x.id === r.processId);
                  const subject = personById(data, r.subjectId);
                  return (
                    <Sheet key={r.id} tone="paper">
                      <SheetHead
                        title={`${r.fromName} (${AGENCY_SHORT[r.fromAgency]}) asks about ${subject ? fullName(subject) : r.subjectId}`}
                        meta={`${p ? `${PROCESS_SHORT[p.type]} ${p.reference}. ` : ''}Received ${formatDateTime(r.createdAt)}${r.dueAt ? `, due ${formatDate(r.dueAt)}` : ''}.`}
                        actions={r.status === 'open' ? <Button size="sm" variant="primary" onClick={() => setResponding(r)}>Respond</Button> : <Pill size="sm" tone={r.status === 'responded' ? 'low' : 'outline'}>{r.status}</Pill>}
                      />
                      <SheetBody>
                        <div className={styles.request}>
                          <span>
                            <strong>Purpose:</strong> {r.purpose}
                          </span>
                          <span>
                            <strong>Fields requested:</strong> {r.fields.join('; ')}
                          </span>
                          {r.response ? (
                            <span>
                              <strong>Response {formatDateTime(r.response.at)} by {r.response.byName}:</strong> {r.response.text} (fields: {r.response.fieldsProvided.join('; ') || 'none'})
                            </span>
                          ) : null}
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
            <SelectField label="Process" value={previewProcess} onChange={(e) => setPreviewProcess(e.target.value)} placeholder="Choose a process" options={visibleProcesses.map((p) => ({ value: p.id, label: `${p.reference}: ${p.title}` }))} />
            <SelectField label="Seen as" value={previewUser} onChange={(e) => setPreviewUser(e.target.value)} placeholder="Choose a role" options={data.users.map((u) => ({ value: u.id, label: `${userName(u)}, ${ROLE_DEFINITIONS[u.roleId].label} (${AGENCY_SHORT[u.agency]})` }))} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)' }}>The preview applies the same need-to-know resolution the product applies for that person: agency, role, case membership and stage.</p>
          </div>
          {pProcess && pUser ? <Preview process={pProcess} viewer={pUser} /> : <EmptyState title="Choose a process and a role" text="See exactly what that person would see, and why." />}
        </div>
      </TabPanel>

      <Dialog open={responding !== null} onClose={() => setResponding(null)} title="Respond to the request" size="lg" actions={<><Button variant="quiet" onClick={() => setResponding(null)}>Cancel</Button><Button variant="primary" disabled={responseText.trim().length < 5} onClick={respond}>Send response</Button></>}>
        {responding ? (
          <div className="stack">
            <p>
              {responding.fromName} asked for: {responding.fields.join('; ')}. Purpose: {responding.purpose}. Provide only what is necessary and proportionate for that purpose.
            </p>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>Fields you are providing</legend>
              {responding.fields.map((f) => (
                <CheckboxField key={f} label={f} checked={fieldsProvided.includes(f)} onChange={(e) => setFieldsProvided(e.target.checked ? [...fieldsProvided, f] : fieldsProvided.filter((x) => x !== f))} />
              ))}
            </fieldset>
            <TextareaField label="Response" required value={responseText} onChange={(e) => setResponseText(e.target.value)} hint="Facts only. Anything you decline to share, say why." />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Preview({ process, viewer }: { process: Process; viewer: User }) {
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const access = accessForUser(data, config, viewer, process, [], now);
  const subject = personById(data, process.subjectIds[0]);
  const res = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  const rows = res.recipients.filter((r) => r.agency === viewer.agency && (r.role === 'any' || r.role === viewer.roleId));
  const excluded = isExcludedParty(process, { userId: viewer.id }, config.exclusions, process.stage, data.relationships);
  return (
    <div className={styles.previewCard} aria-live="polite">
      <div className={styles.previewLevel}>
        {access.level === 'none' ? <Lock size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {userName(viewer)} would see: {access.level === 'none' ? 'nothing' : DETAIL_LEVEL_LABELS[access.level]}
        {access.redacted ? ' (names redacted)' : ''}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', marginBottom: 10 }}>{access.reason}</p>
      <dl>
        <div className={styles.previewRow}>
          <dt>Process exists</dt>
          <dd>{access.level === 'none' ? <span className={styles.redacted}>hidden</span> : `${PROCESS_SHORT[process.type]} ${process.reference}`}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Stage and lead</dt>
          <dd>{access.level === 'none' ? <span className={styles.redacted}>hidden</span> : `${stageLabel(process.type, process.stage)}, ${AGENCY_SHORT[process.leadAgency]}`}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Subject</dt>
          <dd>{access.level === 'full' || access.level === 'summary' ? (access.redacted ? <span className={styles.redacted}>[name redacted]</span> : subject ? fullName(subject) : '') : <span className={styles.redacted}>hidden</span>}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Named fields</dt>
          <dd>{access.fields.length > 0 ? access.fields.join('; ') : access.level === 'full' ? 'Everything' : <span className={styles.redacted}>none</span>}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Detail (events, decisions, plans)</dt>
          <dd>{access.level === 'full' ? 'Visible' : <span className={styles.redacted}>hidden</span>}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Rules that apply</dt>
          <dd>{rows.length === 0 ? (access.member ? 'Case membership' : 'None; default deny') : rows.map((r) => `${r.rowId} (${r.detailLevel})`).join('; ')}</dd>
        </div>
        {excluded ? (
          <div className={styles.previewRow}>
            <dt>Excluded party</dt>
            <dd>
              {userName(viewer)} is recorded on this case as {excluded.party.label.toLowerCase()} ({EXCLUSION_PARTY_LABELS[excluded.party.party].toLowerCase()}). {excluded.party.reason ?? excluded.exclusion.reason}. This cannot be lifted here.
            </dd>
          </div>
        ) : null}
        <div className={styles.previewRow}>
          <dt>Exclusions at this stage</dt>
          <dd>{res.exclusions.map((e) => e.label).join('; ') || 'None'}</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Lawful basis shown</dt>
          <dd>{access.lawfulBasisHints.join(' ') || 'Not applicable'}</dd>
        </div>
      </dl>
    </div>
  );
}
