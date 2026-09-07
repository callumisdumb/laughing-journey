'use client';

import { deathConsequences, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useData, useNow } from '@/lib/store';
import { fullName } from '@/lib/selectors';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from '../process/terminal.module.css';

/**
 * Recording a death, which is a flow with consequences and not a tick box.
 *
 * The consequences are computed from the same function that performs them, so the list on screen is
 * what will happen rather than a description somebody wrote next to a form. They differ by process
 * because the returns differ: an ASP case takes the workbook's own row for a death during the
 * process, a child protection case takes "Child died" from the de-registration list, a MAPPA case
 * exits by de-registration.
 *
 * A case the person is only a party to is flagged for review rather than closed. A father dying does
 * not close his child's child protection case; it changes it, sometimes profoundly, and that needs a
 * person to look at it rather than a system to shut it.
 */
export function RecordDeathDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const recordDeath = useAppStore((s) => s.recordDeath);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [at, setAt] = useState(now.toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const consequences = deathConsequences(data, person.id);

  function submit() {
    const result = recordDeath({ personId: person.id, at, source: source.trim() || undefined, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({
      title: t('person.death.doneTitle'),
      text: t('person.death.doneText', { count: (result.consequences ?? []).filter((c) => c.effect === 'close').length }),
      tone: 'success',
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('person.death.title', { name: fullName(person) })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="death-submit">
            {t('person.death.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{t('person.death.intro')}</p>
        <div className={styles.grid}>
          <DateField label={t('person.death.date')} hint={t('person.death.dateHint')} value={at} onChange={setAt} data-testid="death-date" />
          <TextField label={t('person.death.source')} hint={t('person.death.sourceHint')} value={source} onChange={(e) => setSource(e.target.value)} data-testid="death-source" />
        </div>
        <TextareaField label={t('person.death.note')} hint={t('person.death.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} rows={3} required data-testid="death-note" />

        <div className={styles.warn} data-testid="death-consequences">
          <span className={styles.consequenceHead}>{consequences.length > 0 ? t('person.death.consequencesHead') : t('person.death.consequencesNone')}</span>
          {consequences.map((c) => (
            <span key={c.processId}>
              {c.effect === 'close'
                ? t('person.death.closeLine', { reference: c.reference, type: c.typeLabel, reason: c.reasonLabel ?? c.reasonId ?? '' })
                : t('person.death.reviewLine', { reference: c.reference, type: c.typeLabel })}
            </span>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
