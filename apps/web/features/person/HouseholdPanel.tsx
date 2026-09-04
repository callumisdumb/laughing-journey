'use client';

import { formatDate, membersOn, networkOn, householdOn, householdOnlyMembers, processesTouchedByHousehold, processLabel, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, Dialog, Pill, Sheet, SheetBody, SheetHead, TextField, TextareaField, DateField, useToast } from '@mas/ui';
import { HousePlus, LogOut, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PersonPicker } from '@/components/PersonPicker';
import { PersonLink } from '@/components/EntityLink';
import { KnownElsewhere } from './KnownElsewhere';
import { fullName } from '@/lib/selectors';
import { useAppStore, useData, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './HouseholdPanel.module.css';

/**
 * The household: people at an address, with dates.
 *
 * Kept separate from the wider network on purpose. Marion Fraser's nephew is network and not
 * household, and that distinction is the whole point of her case; Kayleigh Docherty's children are
 * both. A single list of "people around this person" loses the fact that decides whether somebody is
 * in the room every evening or visits once a fortnight.
 *
 * Everything here is managed from the panel rather than from a separate screen, because the moment a
 * practitioner learns a household has changed is the moment they are looking at it.
 */
export function HouseholdPanel({ person }: { person: Person }) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const on = now.toISOString().slice(0, 10);
  const addToHousehold = useAppStore((s) => s.addToHousehold);
  const endMembership = useAppStore((s) => s.endHouseholdMembership);
  const setLabel = useAppStore((s) => s.setHouseholdLabel);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<Person | null>(null);
  const [renaming, setRenaming] = useState(false);

  const household = householdOn(data, person, on);
  const ties = networkOn(data, person.id, on);
  const unrelated = householdOnlyMembers(data, person.id, on);

  if (!household) {
    return (
      <Sheet>
        <SheetHead title={t('person.household.title')} meta={t('person.household.none')} />
        <SheetBody>
          <p className={styles.hint}>{t('person.household.noneHint')}</p>
        </SheetBody>
      </Sheet>
    );
  }

  const address = household.address ? [household.address.line1, household.address.line2, household.address.town, household.address.postcode].filter(Boolean).join(', ') : '';
  /*
   * Who is in the household now, which means whose membership has not ended. `membersOn` answers the
   * question about a day, and by that measure somebody who left this morning was there today; on the
   * screen that reads as the removal not having worked.
   */
  const others = household.household.members.filter((m) => m.personId !== person.id && !m.to);
  const past = household.household.members.filter((m) => m.to);

  return (
    <Sheet>
      <SheetHead
        title={household.label ?? t('person.household.title')}
        meta={`${address ? t('person.household.at', { address }) : ''} ${t('person.household.membersCount', { count: household.members.length })}`.trim()}
        actions={
          <>
            <Button size="sm" variant="quiet" icon={<Pencil size={14} aria-hidden="true" />} onClick={() => setRenaming(true)} data-testid="household-rename">
              {t('person.household.editLabel')}
            </Button>
            <Button size="sm" variant="secondary" icon={<HousePlus size={14} aria-hidden="true" />} onClick={() => setAdding(true)} data-testid="household-add">
              {t('person.household.add')}
            </Button>
          </>
        }
      />
      <SheetBody>
        <ul className={styles.members} data-testid="household-members">
          {others.map((membership) => {
            const member = data.people.find((p) => p.id === membership.personId);
            if (!member) return null;
            const tie = ties.household.find((x) => x.other.id === member.id);
            return (
              <li key={member.id} className={styles.member}>
                <span className={styles.memberName}>
                  <PersonLink person={member} />
                </span>
                <span className={styles.memberMeta}>
                  <KnownElsewhere person={member} />
                  {tie ? null : <Pill size="sm" tone="outline">{t('person.network.noRelationship')}</Pill>}
                  <span className={styles.since}>{t('person.household.since', { date: formatDate(membership.from) })}</span>
                </span>
                <Button size="sm" variant="quiet" icon={<LogOut size={14} aria-hidden="true" />} onClick={() => setEnding(member)} data-testid={`household-end-${member.id}`}>
                  {t('person.household.end')}
                </Button>
              </li>
            );
          })}
          {others.length === 0 ? <li className={styles.hint}>{t('person.household.none')}</li> : null}
        </ul>

        {past.length > 0 ? (
          <details className={styles.past}>
            <summary>{t('person.household.past')}</summary>
            <ul className={styles.pastList}>
              {past.map((membership) => {
                const member = data.people.find((p) => p.id === membership.personId);
                return (
                  <li key={`${membership.personId}-${membership.from}`}>
                    {t('person.household.pastRow', { name: member ? fullName(member) : membership.personId, from: formatDate(membership.from), to: formatDate(membership.to ?? on) })}
                    {membership.endedReason ? <span className={styles.reason}>{membership.endedReason}</span> : null}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
        {unrelated.length > 0 ? <p className={styles.hint}>{t('person.network.recordRelationship')}</p> : null}
      </SheetBody>

      {adding ? (
        <AddToHouseholdDialog
          open
          householdId={household.household.id}
          label={household.label ?? address}
          exclude={household.members.map((m) => m.personId)}
          onClose={() => setAdding(false)}
          onSave={(personId, from, note, notify) => {
            const result = addToHousehold(household.household.id, personId, from, note, notify);
            if (result.ok) {
              const joined = data.people.find((p) => p.id === personId);
              toast({ title: t('person.household.done.addedTitle'), text: t('person.household.done.addedText', { name: joined ? fullName(joined) : personId, date: formatDate(from) }), tone: 'success' });
            }
            return readErrors(result.errors);
          }}
        />
      ) : null}

      {ending ? (
        <EndMembershipDialog
          member={ending}
          label={household.label ?? address}
          affected={processesTouchedByHousehold(data, household.household.id, on).length}
          onClose={() => setEnding(null)}
          onSave={(to, reason) => {
            const result = endMembership(household.household.id, ending.id, to, reason);
            if (result.ok) toast({ title: t('person.household.done.endedTitle'), text: t('person.household.done.endedText', { name: fullName(ending), date: formatDate(to) }), tone: 'success' });
            return readErrors(result.errors);
          }}
        />
      ) : null}

      {renaming ? (
        <RenameHouseholdDialog
          open
          label={household.label ?? ''}
          onClose={() => setRenaming(false)}
          onSave={(label) => readErrors(setLabel(household.household.id, label).errors)}
        />
      ) : null}
    </Sheet>
  );
}

function AddToHouseholdDialog({
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

function EndMembershipDialog({ member, label, affected, onClose, onSave }: { member: Person; label: string; affected: number; onClose: () => void; onSave: (to: string, reason: string) => string[] }) {
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

function RenameHouseholdDialog({ open, label, onClose, onSave }: { open: boolean; label: string; onClose: () => void; onSave: (label: string) => string[] }) {
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
