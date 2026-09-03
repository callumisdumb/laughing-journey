'use client';

import { CONTEXT, MESSAGE_KEYS, NAMESPACES, defaultMessage, formatMessage, messageArguments, replaceOverrides, resetAllOverrides, resetOverride, sampleArguments, sessionOverrides, setOverride, useT, validateMessage, type MessageKey } from '@mas/messages';
import { Button, Dialog, EmptyState, Pill, SelectField, Switch, Table, TableWrap, TextField, TextareaField, useToast } from '@mas/ui';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAppStore } from '@/lib/store';
import styles from './Copy.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

const LIMIT = 200;

interface Row {
  key: MessageKey;
  namespace: string;
  current: string;
  fallback: string;
  changed: boolean;
  verbatim: boolean;
  where: string;
  maxLength?: number;
}

/**
 * Copy and labels: every message in the catalogue, searchable, with an inline ICU editor, a live
 * preview, reset per key or for all, and export or import of the overrides. Overrides apply at
 * once through the messages provider, persist like theme and density, and are audited.
 */
export function Copy() {
  const t = useT();
  const { canEdit } = useAdminConfig();
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [namespace, setNamespace] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const [editing, setEditing] = useState<MessageKey | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const overrides = sessionOverrides();
  const rows = useMemo<Row[]>(
    () =>
      MESSAGE_KEYS.map((key) => {
        const c = CONTEXT[key];
        const fallback = defaultMessage(key) ?? '';
        const current = t.raw(key) ?? fallback;
        return { key, namespace: key.split('.')[0] ?? '', current, fallback, changed: key in overrides, verbatim: c?.verbatim === true, where: c?.where ?? '', maxLength: c?.maxLength };
      }),
    [t, overrides],
  );
  const changedCount = Object.keys(overrides).length;
  const needle = query.trim().toLowerCase();
  const matches = rows.filter((r) => (!namespace || r.namespace === namespace) && (!changedOnly || r.changed) && (!needle || r.key.toLowerCase().includes(needle) || r.current.toLowerCase().includes(needle) || r.fallback.toLowerCase().includes(needle) || r.where.toLowerCase().includes(needle)));
  const shown = matches.slice(0, LIMIT);

  function startEdit(row: Row) {
    setEditing(row.key);
    setDraft(row.current);
    setError(undefined);
  }

  function commit(row: Row) {
    const text = draft.trim();
    if (!text) {
      setError(t('admin.copy.editor.emptyError'));
      return;
    }
    const syntax = validateMessage(text);
    if (syntax) {
      setError(t('admin.copy.editor.syntaxError', { error: syntax }));
      return;
    }
    setOverride(row.key, text);
    audit({ act: 'edit', targetType: 'config', targetId: 'copy', targetLabel: t('admin.copy.audit.set', { key: row.key, text }) });
    toast({ title: t('admin.copy.toasts.saved'), text: t('admin.copy.toasts.savedText', { key: row.key }), tone: 'success' });
    setEditing(null);
  }

  function reset(row: Row) {
    resetOverride(row.key);
    audit({ act: 'edit', targetType: 'config', targetId: 'copy', targetLabel: t('admin.copy.audit.reset', { key: row.key }) });
    toast({ title: t('admin.copy.toasts.reset'), text: t('admin.copy.toasts.resetText', { key: row.key }), tone: 'success' });
    if (editing === row.key) setEditing(null);
  }

  function resetAll() {
    const count = changedCount;
    resetAllOverrides();
    audit({ act: 'edit', targetType: 'config', targetId: 'copy', targetLabel: t('admin.copy.audit.resetAll', { count }) });
    toast({ title: t('admin.copy.toasts.resetAll'), tone: 'success' });
    setResetAllOpen(false);
    setEditing(null);
  }

  function exportOverrides() {
    const blob = new Blob([`${JSON.stringify(overrides, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'message-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
    audit({ act: 'export', targetType: 'config', targetId: 'copy', targetLabel: t('admin.copy.toasts.exported') });
    toast({ title: t('admin.copy.toasts.exported'), tone: 'success' });
  }

  async function importOverrides(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed as Record<string, unknown>).every((v) => typeof v === 'string')) throw new Error('shape');
      const incoming = parsed as Record<string, string>;
      replaceOverrides({ ...overrides, ...incoming });
      const count = Object.keys(incoming).length;
      audit({ act: 'edit', targetType: 'config', targetId: 'copy', targetLabel: t('admin.copy.audit.import', { count }) });
      toast({ title: t('admin.copy.toasts.imported', { count }), tone: 'success' });
    } catch {
      toast({ title: t('admin.copy.importInvalid'), tone: 'error' });
    }
  }

  const preview = (text: string) => (text.trim() ? formatMessage(text, sampleArguments(text)) : t('admin.copy.editor.previewEmpty'));

  return (
    <>
      <SectionHead
        title={t('admin.copy.title')}
        lede={t('admin.copy.lede')}
        actions={
          <div className={styles.toolbar}>
            <Button variant="secondary" icon={<Download size={14} aria-hidden="true" />} onClick={exportOverrides} disabled={changedCount === 0}>
              {t('admin.copy.toolbar.export')}
            </Button>
            <Button variant="secondary" icon={<Upload size={14} aria-hidden="true" />} onClick={() => fileInput.current?.click()} disabled={!canEdit}>
              {t('admin.copy.toolbar.import')}
            </Button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void importOverrides(e)} />
            <Button variant="quiet" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => setResetAllOpen(true)} disabled={!canEdit || changedCount === 0}>
              {t('admin.copy.toolbar.resetAll')}
            </Button>
          </div>
        }
      />
      <div className={styles.filters}>
        <TextField label={t('admin.copy.filters.search')} placeholder={t('admin.copy.filters.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} className={styles.search} />
        <SelectField label={t('admin.copy.filters.namespace')} value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder={t('admin.copy.filters.allNamespaces')} options={NAMESPACES.map((ns) => ({ value: ns, label: ns }))} />
        <Switch label={t('admin.copy.filters.changedOnly')} checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
      </div>
      <p className={styles.summary} aria-live="polite">
        {t('admin.copy.summary', { shown: shown.length, total: rows.length, changed: changedCount })}
      </p>
      {shown.length === 0 ? (
        <EmptyState title={t('admin.copy.empty.title')} text={t('admin.copy.empty.text')} />
      ) : (
        <TableWrap label={t('admin.copy.table')}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t('admin.copy.columns.key')}</th>
                <th scope="col">{t('admin.copy.columns.current')}</th>
                <th scope="col">{t('admin.copy.columns.default')}</th>
                <th scope="col">{t('admin.copy.columns.where')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.copy.columns.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const isEditing = editing === row.key;
                const args = messageArguments(draft);
                return (
                  <tr key={row.key} data-state={row.changed ? 'changed' : undefined}>
                    <td className={styles.key}>
                      {row.key}
                      <span className={styles.namespace}>{row.namespace}</span>
                    </td>
                    <td>
                      {isEditing ? (
                        <div className={styles.editCell}>
                          {row.verbatim ? (
                            <p className={styles.warning} role="note">
                              {t('admin.copy.editor.verbatimWarning')}
                            </p>
                          ) : null}
                          <TextareaField
                            label={t('admin.copy.editor.label', { key: row.key })}
                            hint={args.length ? t('admin.copy.editor.arguments', { arguments: args.map((a) => `{${a}}`).join(' ') }) : t('admin.copy.editor.noArguments')}
                            value={draft}
                            maxLength={row.maxLength ? Math.max(row.maxLength * 2, 80) : undefined}
                            autoFocus
                            rows={3}
                            onChange={(e) => {
                              setDraft(e.target.value);
                              setError(undefined);
                            }}
                            error={error}
                          />
                          <div className={styles.preview}>
                            <span className={styles.previewLabel}>{t('admin.copy.editor.preview')}</span>
                            <span className={styles.previewText}>{preview(draft)}</span>
                          </div>
                          <div className={styles.editActions}>
                            <Button size="sm" variant="primary" onClick={() => commit(row)}>
                              {t('admin.copy.editor.save')}
                            </Button>
                            <Button size="sm" variant="quiet" onClick={() => setEditing(null)}>
                              {t('admin.copy.editor.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className={styles.text}>
                          {row.current}
                          {row.changed ? (
                            <Pill size="sm" tone="accent">
                              {t('admin.copy.pills.changed')}
                            </Pill>
                          ) : null}
                          {row.verbatim ? (
                            <Pill size="sm" tone="neutral">
                              {t('admin.copy.pills.verbatim')}
                            </Pill>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className={styles.fallback}>{row.changed ? row.fallback : null}</td>
                    <td className={styles.where}>{row.where}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {!isEditing ? (
                          <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => startEdit(row)}>
                            {t('admin.copy.rowActions.edit')}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="quiet" disabled={!canEdit || !row.changed} onClick={() => reset(row)}>
                          {t('admin.copy.rowActions.reset')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {matches.length > shown.length ? <p className={styles.summary}>{t('admin.copy.truncated', { limit: LIMIT })}</p> : null}
      <Dialog
        open={resetAllOpen}
        onClose={() => setResetAllOpen(false)}
        title={t('admin.copy.resetAllDialog.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setResetAllOpen(false)}>
              {t('admin.copy.editor.cancel')}
            </Button>
            <Button variant="primary" onClick={resetAll}>
              {t('admin.copy.resetAllDialog.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('admin.copy.resetAllDialog.text', { count: changedCount })}</p>
      </Dialog>
    </>
  );
}
