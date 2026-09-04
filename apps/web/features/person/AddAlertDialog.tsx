'use client';

import { AGENCIES, agencyShort, formatDate, type Agency, type Person, type PersonAlert } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextareaField, useToast } from '@mas/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, useNow } from '@/lib/store';
import { fullName } from '@/lib/selectors';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './AddAlertDialog.module.css';

const KINDS = ['staff-safety', 'marac-flag', 'cp-register', 'mappa', 'missing', 'other'] as const;
const kindLabel = (kind: PersonAlert['kind']) => tKey(`person.alerts.kind.${kind.replace(/-([a-z])/g, (_m, l: string) => l.toUpperCase())}`);

/**
 * An alert on a person, with the scope it is visible at.
 *
 * The scope is the part that matters and the part a form usually forgets. A staff safety alert
 * should be seen by anybody who might visit; a MAPPA presence alert must not be, because the alert
 * itself discloses that a MAPPA case exists. So the visibility is asked explicitly, defaults to
 * everybody for a staff safety alert and to the responsible authorities for a MAPPA one, and the
 * dialog says what each choice means rather than offering a bare list of agencies.
 *
 * An alert also carries an end date. A bail condition expires, a missing person is found, and an
 * alert with no end is one that is still on the record in three years telling a visiting worker
 * something that stopped being true.
 */
export function AddAlertDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const t = useT();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [kind, setKind] = useState<PersonAlert['kind']>('staff-safety');
  const [text, setText] = useState('');
  const [from, setFrom] = useState(now.toISOString().slice(0, 10));
  const [to, setTo] = useState('');
  const [scope, setScope] = useState<'everybody' | 'agencies'>('everybody');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const alert: PersonAlert = {
      id: newId('alt'),
      kind,
      text: text.trim(),
      from,
      to: to || undefined,
      visibleTo: scope === 'agencies' && agencies.length > 0 ? agencies : undefined,
    };

    const rules: string[] = [];
    if (alert.text.length < 10) rules.push('alertTextRequired');
    if (scope === 'agencies' && agencies.length === 0) rules.push('alertScopeRequired');
    if (alert.to && alert.to < alert.from) rules.push('alertEndsBeforeStart');

    const result = write({
      collection: 'people',
      record: { ...person, alerts: [...person.alerts, alert] },
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: fullName(person),
      rules,
      event: {
        eventType: 'other',
        significance: kind === 'staff-safety' ? 'high' : 'moderate',
        visibility: scope === 'everybody' ? 'integrated' : 'agency-only',
        title: t('person.alerts.eventTitle', { kind: kindLabel(kind) }),
        detail: alert.text,
        subjectIds: [person.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('person.alerts.doneTitle'), text: t('person.alerts.doneText', { kind: kindLabel(kind), from: formatDate(from) }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('person.alerts.addTitle', { name: fullName(person) })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" icon={<ShieldAlert size={16} aria-hidden="true" />} onClick={submit} data-testid="alert-submit">
            {t('person.alerts.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <SelectField label={t('person.alerts.kindLabel')} value={kind} onChange={(e) => setKind(e.target.value as PersonAlert['kind'])} options={KINDS.map((k) => ({ value: k, label: kindLabel(k) }))} data-testid="alert-kind" />
        <TextareaField label={t('person.alerts.text')} hint={t('person.alerts.textHint')} value={text} onChange={(e) => setText(e.target.value)} rows={2} required data-testid="alert-text" />

        <div className={styles.grid}>
          <DateField label={t('person.alerts.from')} value={from} onChange={setFrom} />
          <DateField label={t('person.alerts.to')} hint={t('person.alerts.toHint')} value={to} onChange={setTo} data-testid="alert-to" />
        </div>

        <fieldset className={styles.scope}>
          <legend className={styles.legend}>{t('person.alerts.scope')}</legend>
          <label className={styles.radio}>
            <input type="radio" name="alert-scope" checked={scope === 'everybody'} onChange={() => setScope('everybody')} data-testid="alert-scope-everybody" />
            <span>
              {t('person.alerts.scopeEverybody')}
              <span className={styles.hint}>{t('person.alerts.scopeEverybodyHint')}</span>
            </span>
          </label>
          <label className={styles.radio}>
            <input type="radio" name="alert-scope" checked={scope === 'agencies'} onChange={() => setScope('agencies')} data-testid="alert-scope-agencies" />
            <span>
              {t('person.alerts.scopeAgencies')}
              <span className={styles.hint}>{t('person.alerts.scopeAgenciesHint')}</span>
            </span>
          </label>
          {scope === 'agencies' ? (
            <div className={styles.agencies} data-testid="alert-agencies">
              {AGENCIES.map((agency) => (
                <label key={agency} className={styles.agency}>
                  <input
                    type="checkbox"
                    checked={agencies.includes(agency)}
                    onChange={(e) => setAgencies(e.target.checked ? [...agencies, agency] : agencies.filter((a) => a !== agency))}
                  />
                  {agencyShort(agency)}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
      </div>
    </Dialog>
  );
}
