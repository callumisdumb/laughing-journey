'use client';

import { membersOn, processesTouchedByHousehold, processLabel, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, Dialog, TextField, TextareaField, DateField } from '@mas/ui';
import { useMemo, useState } from 'react';
import { PersonPicker } from '@/components/PersonPicker';
import { fullName } from '@/lib/selectors';
import { useData, useNow } from '@/lib/store';
import styles from './HouseholdPanel.module.css';

export function AddToHouseholdDialog({
  open,
  householdId,
  label,
  exclude,
  onClose,
  onSave,
}: {
  open: boolean;
  householdId: string;
  label: string;
  exclude: string[];
  onClose: () => void;
  onSave: (personId: string, from: string, note: string, notify: boolean) => string[];
}) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const [chosen, setChosen] = useState<Person | null>(null);
  const [from, setFrom] = useState(now.toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  /*
   * The consequences, computed before the button rather than described after it. A new adult in a
   * household where a child is on the register is a fact the core group needs, and a person joining
   * a MAPPA subject's household changes the Environmental Risk Assessment.
   */
  const affected = useMemo(() => processesTouchedByHousehold(data, householdId, from, chosen ? [chosen.id] : []), [data, householdId, from, chosen]);

  function close() {
    setChosen(null);
    setNote('');
    setErrors([]);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('person.household.addTitle', { label })}
      size="md"
      errors={errors}
      actions={
        <>
          <Button variant="quiet" onClick={close}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              const errs = onSave(chosen.id, from, note, notify && affected.length > 0);
              if (errs.length > 0) setErrors(errs);
              else close();
            }}
            data-testid="household-add-submit"
          >
            {t('person.household.addSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <PersonPicker label={t('person.household.addPerson')} value={chosen} onChange={setChosen} exclude={exclude} idPrefix="household-person" />
        <DateField label={t('person.household.addFrom')} value={from} onChange={setFrom} />
        <TextareaField label={t('person.household.addNote')} hint={t('person.household.addNoteHint')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        {affected.length > 0 ? (
          <div className={styles.affected} data-testid="household-affected">
            <h4>{t('person.network.consequences.affected', { count: affected.length })}</h4>
            <ul>
              {affected.map((p) => (
                <li key={p.id}>
                  {processLabel(p.type)} {p.reference}
                </li>
              ))}
            </ul>
            <CheckboxField label={t('person.network.consequences.notify')} hint={t('person.network.consequences.notifyHint')} checked={notify} onChange={(e) => setNotify(e.target.checked)} data-testid="household-notify" />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

export function EndMembershipDialog({ member, label, affected, onClose, onSave }: { member: Person; label: string; affected: number; onClose: () => void; onSave: (to: string, reason: string) => string[] }) {
  const t = useT();
  const now = useNow();
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('person.household.endTitle', { name: fullName(member), label })}
      size="md"
      errors={errors}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const errs = onSave(to, reason);
              if (errs.length > 0) setErrors(errs);
              else onClose();
            }}
            data-testid="household-end-submit"
          >
            {t('person.household.endSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <DateField label={t('person.household.endTo')} value={to} onChange={setTo} />
        <TextField label={t('person.household.endReason')} hint={t('person.household.endReasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} required data-testid="household-end-reason" />
        {affected > 0 ? <p className={styles.hint}>{t('person.network.consequences.affected', { count: affected })}</p> : null}
      </div>
    </Dialog>
  );
}

export function RenameHouseholdDialog({ open, label, onClose, onSave }: { open: boolean; label: string; onClose: () => void; onSave: (label: string) => string[] }) {
  const t = useT();
  const [value, setValue] = useState(label);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('person.household.editLabel')}
      size="sm"
      errors={errors}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const errs = onSave(value);
              if (errs.length > 0) setErrors(errs);
              else onClose();
            }}
            data-testid="household-rename-submit"
          >
            {t('person.household.labelSubmit')}
          </Button>
        </>
      }
    >
      <TextField label={t('person.household.labelField')} hint={t('person.household.labelHint')} value={value} onChange={(e) => setValue(e.target.value)} data-testid="household-label" />
    </Dialog>
  );
}

/** Kept out of the panel so a member list can be rendered without pulling the whole membership in. */
export function householdMemberIds(household: Parameters<typeof membersOn>[0], on: string): string[] {
  return membersOn(household, on).map((m) => m.personId);
}
