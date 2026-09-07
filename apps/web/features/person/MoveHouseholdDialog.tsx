'use client';

import { formatDate, membersOn, type Household, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, Dialog, SelectField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { fullName } from '@/lib/selectors';
import { useAppStore, useData, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './HouseholdNetworkCard.module.css';

/**
 * Moving the household (D-244): everybody who lives there on the date, one address, one date; untick
 * anybody staying behind and say where they are going, or leave it blank. The store writes the
 * household, each person with their own chronology event, and a household of their own for anybody
 * left behind with an address. Address history is kept for everyone.
 */
export function MoveHouseholdDialog({ household, fromAddress, onClose }: { household: Household; fromAddress: string; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const move = useAppStore((s) => s.moveHousehold);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [addressId, setAddressId] = useState('');
  const [on, setOn] = useState(now.toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [staying, setStaying] = useState<Record<string, { stays: boolean; addressId: string }>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const members = membersOn(household, on).map((m) => data.people.find((p) => p.id === m.personId)).filter((p): p is Person => p !== undefined);
  const options = data.addresses.filter((a) => a.id !== household.addressId).map((a) => ({ value: a.id, label: [a.line1, a.town, a.postcode].filter(Boolean).join(', ') }));
  const moving = members.filter((p) => !staying[p.id]?.stays);
  const left = members.filter((p) => staying[p.id]?.stays);

  function save() {
    const result = move(
      household.id,
      addressId,
      on,
      note,
      left.map((p) => ({ personId: p.id, addressId: staying[p.id]?.addressId || undefined })),
    );
    if (!result.ok) {
      setErrors(readErrors(result.errors));
      return;
    }
    const chosen = options.find((o) => o.value === addressId);
    toast({ title: t('person.household.moveHousehold.toastTitle'), text: t('person.household.moveHousehold.toastText', { count: moving.length, address: chosen?.label ?? '', date: formatDate(on), left: left.length }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('person.household.moveHousehold.dialogTitle')}
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!addressId || !on || moving.length === 0} onClick={save} data-testid="move-household-submit">
            {t('person.household.moveHousehold.submit', { count: moving.length })}
          </Button>
        </>
      }
    >
      <div className="stack">
        {errors.length > 0 ? (
          <div className={styles.errors} role="alert">
            <strong>{t('person.household.moveDialog.refused')}</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={styles.hint}>{t('person.household.moveHousehold.intro', { count: members.length })}</p>
        <SelectField label={t('person.household.moveHousehold.to')} required value={addressId} onChange={(e) => setAddressId(e.target.value)} placeholder={t('person.household.moveHousehold.toPlaceholder')} options={options} data-testid="move-household-to" />
        <DateField label={t('person.household.moveHousehold.on')} required value={on} onChange={setOn} data-testid="move-household-on" />
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('person.household.moveHousehold.who')}</legend>
          {members.map((p) => (
            <div key={p.id} className="stack" data-testid={`move-member-${p.id}`}>
              <CheckboxField label={staying[p.id]?.stays ? t('person.household.moveHousehold.stays', { name: fullName(p) }) : t('person.household.moveHousehold.moving', { name: fullName(p) })} checked={!staying[p.id]?.stays} onChange={(e) => setStaying({ ...staying, [p.id]: { stays: !e.target.checked, addressId: staying[p.id]?.addressId ?? '' } })} data-testid={`move-member-${p.id}-moves`} />
              {staying[p.id]?.stays ? (
                <SelectField label={t('person.household.moveHousehold.stayAddress', { name: fullName(p) })} value={staying[p.id]?.addressId ?? ''} onChange={(e) => setStaying({ ...staying, [p.id]: { stays: true, addressId: e.target.value } })} placeholder={t('person.household.moveHousehold.stayAddressNone')} options={options.filter((o) => o.value !== addressId)} data-testid={`move-member-${p.id}-address`} />
              ) : null}
            </div>
          ))}
        </fieldset>
        <TextareaField label={t('person.household.moveHousehold.note')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="move-household-note" />
        <p className={styles.hint}>{t('person.household.moveDialog.household', { alone: 'yes', address: fromAddress })}</p>
      </div>
    </Dialog>
  );
}
