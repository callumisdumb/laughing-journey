'use client';

import { SIGNIFICANCES, agencyLabel, formatDate, formatDateTime, significanceLabel, type ChronologyEvent, type ConnectorEvent } from '@mas/domain';
import { MOCK_ADAPTERS, type ExternalEvent } from '@mas/connectors';
import { useT, type RichValues } from '@mas/messages';
import { AgencyMark, Button, Dialog, SelectField, Sheet, SheetBody, SheetHead, TextField, TextareaField, useToast } from '@mas/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useRoute } from '@/lib/router';
import { personPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { fullName, inboxForUser, personById, processesForPerson } from '@/lib/selectors';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './Inbox.module.css';

function ConnectorPull({ adapterId, subjectIds }: { adapterId: string; subjectIds: string[] }) {
  const t = useT();
  const adapter = MOCK_ADAPTERS.find((a) => a.id === adapterId)!;
  const receive = useAppStore((s) => s.receive);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const now = useNow();
  const { toast } = useToast();
  const health = useQuery({ queryKey: ['health', adapterId], queryFn: () => adapter.health(), refetchInterval: 30_000 });
  const pull = useMutation({
    mutationFn: async () => {
      // One request per subject, in parallel: the simulated latency applies once, not once per person.
      const perSubject = await Promise.all(
        subjectIds.map(async (id) => (await adapter.pullEvents({ personId: id }, { from: '2015-01-01', to: now.toISOString() })).map((e) => ({ ...e, source: { ...e.source, __subject: id } }))),
      );
      const found: ExternalEvent[] = perSubject.flat();
      return found;
    },
    onSuccess: (events) => {
      let added = 0;
      // What arrives is what the source system said, delivered through the store's connector path
      // rather than written as a person's record: it is de-duplicated on the far side's reference and
      // waits for a person to promote or dismiss it, which is the write that gets the ledger line.
      for (const e of events) {
        const subjectId = e.source.__subject ?? subjectIds[0] ?? '';
        const { __subject: _drop, ...sourcePayload } = e.source;
        const rec: ConnectorEvent = { id: newId('cev'), synthetic: true, connectorId: adapter.id, agency: adapter.agency, subjectId, receivedAt: now.toISOString(), externalRef: e.externalRef, sourcePayload, mapped: { eventType: e.mapped.eventType, title: e.mapped.title, detail: e.mapped.detail, occurredAt: e.occurredAt, hasTime: e.hasTime, significance: e.mapped.significance, mappingRule: e.mapped.mappingRule }, status: 'pending' };
        const delivered = receive(rec);
        if (delivered.ok && !delivered.duplicate) added += 1;
      }
      audit({ act: 'read', targetType: 'inbox', targetId: adapter.id, targetLabel: t('inbox.pull.audit', { connector: adapter.displayName }), reason: t('inbox.pull.auditReason', { pulled: events.length, added }) });
      toast({ title: t('inbox.pull.toast.title', { connector: adapter.displayName, count: added }), text: added === 0 ? t('inbox.pull.toast.nothingNew') : t('inbox.pull.toast.review'), tone: 'success' });
    },
    onError: (err: Error) => toast({ title: t('inbox.pull.toast.failed', { connector: adapter.displayName }), text: err.message, tone: 'error' }),
  });
  const status = health.data?.status ?? (health.isLoading ? 'checking' : 'unknown');
  return (
    <span className={styles.pull}>
      <Button size="sm" variant="secondary" icon={<RefreshCw size={14} aria-hidden="true" />} loading={pull.isPending} onClick={() => pull.mutate()} disabled={status === 'down'}>
        {t('inbox.pull.button', { connector: adapter.displayName })}
      </Button>
      <span className={styles.status} data-status={status} aria-live="polite">
        {status === 'down' ? <CloudOff size={12} aria-hidden="true" /> : <Activity size={12} aria-hidden="true" />}
        {status === 'checking' ? t('inbox.pull.checking') : status}
        {health.data?.latencyMs ? `, ${t('inbox.pull.latency', { ms: Math.round(health.data.latencyMs) })}` : ''}
      </span>
    </span>
  );
}

interface PromoteState {
  event: ConnectorEvent;
  integrated: boolean;
}

export function Inbox() {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const select = useSelection((s) => s.select);
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const dev = useDevState();
  const [edits, setEdits] = useState<Record<string, { title: string; significance: ChronologyEvent['significance'] }>>({});
  const [promote, setPromote] = useState<PromoteState | null>(null);
  const [purpose, setPurpose] = useState('');
  const [necessity, setNecessity] = useState('');
  const [dismissing, setDismissing] = useState<ConnectorEvent | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  const focus = route.query.get('event');

  useEffect(() => {
    select(null);
  }, [select]);

  useEffect(() => {
    if (focus) document.getElementById(`inbox-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  if (!user) return null;
  const items = inboxForUser(data, user).sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  const adapters = MOCK_ADAPTERS.filter((a) => a.agency === user.agency && a.capabilities.includes('pullEvents'));
  const subjectIds = [...new Set(data.processes.filter((p) => p.status === 'open' && user.caseMemberships.includes(p.id)).flatMap((p) => p.subjectIds))];

  function edited(c: ConnectorEvent) {
    return edits[c.id] ?? { title: c.mapped.title, significance: c.mapped.significance };
  }

  function doPromote() {
    if (!promote || !user) return;
    const c = promote.event;
    const e = edited(c);
    const processes = processesForPerson(data, c.subjectId).filter((p) => p.status === 'open');
    // Promoted to the integrated view, the event rests on a lawful basis the pipeline writes from
    // the purpose and necessity typed here; the event names it before either exists.
    const lawfulBasisId = promote.integrated ? newId('lb') : undefined;
    const ev: ChronologyEvent = {
      id: newId('evt'),
      synthetic: true,
      subjectIds: [c.subjectId],
      occurredAt: c.mapped.occurredAt,
      hasTime: c.mapped.hasTime,
      approximate: false,
      recordedAt: now.toISOString(),
      agency: c.agency,
      sourceSystem: c.connectorId,
      recordedByUserId: user.id,
      recordedByName: `${user.givenName} ${user.familyName}`,
      eventType: c.mapped.eventType,
      title: e.title,
      detail: c.mapped.detail,
      significance: e.significance,
      significanceReason: e.significance === 'high' ? 'Set at inbox review' : undefined,
      linkedPersonIds: [],
      linkedProcessIds: processes.map((p) => p.id),
      evidenceRefs: [{ kind: 'connector', ref: c.externalRef, label: `${c.connectorId} ${c.externalRef}` }],
      visibility: promote.integrated ? 'integrated' : 'agency-only',
      lawfulBasisId,
      versions: [{ at: now.toISOString(), byUserId: user.id, byName: `${user.givenName} ${user.familyName}`, change: t('inbox.promote.version', { connector: c.connectorId, integrated: promote.integrated ? 'yes' : 'no' }) }],
    };
    // The event first, then the inbox item marked as promoted and citing it. Each is its own
    // ledger line: what was written, and what was reviewed.
    const promoted = write({ collection: 'events', record: ev, intent: 'create', act: 'promote', targetType: 'event', targetLabel: ev.title, processId: processes[0]?.id, lawfulBasis: lawfulBasisId ? { id: lawfulBasisId, purpose, necessity, processes, agency: c.agency } : undefined });
    if (!promoted.ok) {
      toast({ title: t('inbox.promote.refused'), text: readErrors(promoted.errors).join(' '), tone: 'error' });
      return;
    }
    write({ collection: 'connectorEvents', record: { ...c, status: 'promoted', reviewedByUserId: user.id, reviewedAt: now.toISOString(), promotedEventId: ev.id }, intent: 'update', act: 'edit', targetType: 'inbox', targetLabel: t('inbox.promote.audit', { title: c.mapped.title }), processId: processes[0]?.id });
    setPromote(null);
    setPurpose('');
    setNecessity('');
    toast({ title: promote.integrated ? t('inbox.promote.toast.integrated') : t('inbox.promote.toast.single'), text: ev.title, tone: 'success' });
  }

  function doDismiss() {
    if (!dismissing || !user) return;
    const result = write({ collection: 'connectorEvents', record: { ...dismissing, status: 'dismissed', reviewedByUserId: user.id, reviewedAt: now.toISOString() }, intent: 'update', act: 'edit', targetType: 'inbox', targetLabel: t('inbox.dismiss.audit', { title: dismissing.mapped.title }), reason: dismissReason });
    if (!result.ok) {
      toast({ title: t('inbox.dismiss.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
      return;
    }
    setDismissing(null);
    setDismissReason('');
    toast({ title: t('inbox.dismiss.toast.title'), text: t('inbox.dismiss.toast.text') });
  }

  const state = dev ?? (items.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('inbox.title')}</h1>
          <p className="page-lede">{t('inbox.lede')}</p>
        </div>
      </div>
      {adapters.length > 0 ? (
        <div className={styles.pulls}>
          {adapters.map((a) => (
            <ConnectorPull key={a.id} adapterId={a.id} subjectIds={subjectIds} />
          ))}
        </div>
      ) : null}
      <ScreenState state={state} empty={{ title: t('inbox.empty.title'), text: t('inbox.empty.text', { agency: agencyLabel(user.agency) }) }}>
        <div className="stack">
          {items.map((c) => {
            const subject = personById(data, c.subjectId);
            const e = edited(c);
            // The subject is a link, so the title goes through the rich renderer with the node as an argument.
            const titleValues: RichValues = { subject: <span className={styles.subject}>{subject ? <AppLink href={personPath(subject.id)}>{fullName(subject)}</AppLink> : c.subjectId}</span>, connector: c.connectorId };
            return (
              <Sheet key={c.id} id={`inbox-${c.id}`} selected={focus === c.id} onMouseEnter={() => subject && select({ kind: 'person', id: subject.id })}>
                <SheetHead
                  title={t.rich('inbox.item.title', titleValues)}
                  meta={
                    <>
                      <AgencyMark agency={c.agency} /> {t('inbox.item.meta', { when: formatDateTime(c.receivedAt), reference: c.externalRef, rule: c.mapped.mappingRule })}
                    </>
                  }
                  divided
                />
                <SheetBody>
                  <div className={styles.item}>
                    <div className={styles.received}>
                      <div className={styles.receivedTitle}>{t('inbox.item.received', { connector: c.connectorId })}</div>
                      <dl className={styles.raw}>
                        {Object.entries(c.sourcePayload).map(([k, v]) => (
                          <div key={k} style={{ display: 'contents' }}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className={styles.proposed}>
                      <div className={styles.proposedTitle}>{t('inbox.item.proposed')}</div>
                      <TextField label={t('inbox.item.titleField')} value={e.title} maxLength={120} onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, title: ev.target.value } })} hint={t('inbox.item.titleHint', { when: c.mapped.hasTime ? formatDateTime(c.mapped.occurredAt) : formatDate(c.mapped.occurredAt), type: c.mapped.eventType })} />
                      <SelectField label={t('inbox.item.significance')} value={e.significance} onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, significance: ev.target.value as ChronologyEvent['significance'] } })} options={SIGNIFICANCES.map((s) => ({ value: s, label: significanceLabel(s) }))} />
                      <p className={styles.mappingNote}>{c.mapped.detail}</p>
                      <div className={styles.actions}>
                        <Button variant="secondary" onClick={() => setPromote({ event: c, integrated: false })}>
                          {t('inbox.item.promoteSingle')}
                        </Button>
                        <Button variant="primary" onClick={() => setPromote({ event: c, integrated: true })}>
                          {t('inbox.item.promoteIntegrated')}
                        </Button>
                        <Button variant="quiet" onClick={() => setDismissing(c)}>
                          {t('inbox.item.dismiss')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetBody>
              </Sheet>
            );
          })}
        </div>
      </ScreenState>

      <Dialog
        open={promote !== null}
        onClose={() => setPromote(null)}
        title={promote?.integrated ? t('inbox.promote.titleIntegrated') : t('inbox.promote.titleSingle')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setPromote(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" onClick={doPromote} disabled={promote?.integrated ? purpose.trim().length < 5 || necessity.trim().length < 20 : false}>
              {promote?.integrated ? t('inbox.promote.submitIntegrated') : t('inbox.promote.submitSingle')}
            </Button>
          </>
        }
      >
        {promote?.integrated ? (
          <div className="stack">
            <p>{t('inbox.promote.intro')}</p>
            <TextField label={t('inbox.promote.purpose')} required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('inbox.promote.purposePlaceholder')} />
            <TextareaField label={t('inbox.promote.necessity')} required value={necessity} onChange={(e) => setNecessity(e.target.value)} hint={t('inbox.promote.necessityHint')} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)' }}>{t('inbox.promote.basisNote')}</p>
          </div>
        ) : (
          <p>{t('inbox.promote.singleNote')}</p>
        )}
      </Dialog>

      <Dialog
        open={dismissing !== null}
        onClose={() => setDismissing(null)}
        title={t('inbox.dismiss.title')}
        size="sm"
        tone="destructive"
        actions={
          <>
            <Button variant="quiet" onClick={() => setDismissing(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="danger" onClick={doDismiss} disabled={dismissReason.trim().length < 5}>
              {t('inbox.dismiss.submit')}
            </Button>
          </>
        }
      >
        <TextareaField label={t('inbox.dismiss.reason')} required value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} hint={t('inbox.dismiss.reasonHint')} />
      </Dialog>
    </div>
  );
}
