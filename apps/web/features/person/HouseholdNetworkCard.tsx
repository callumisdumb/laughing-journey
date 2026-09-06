'use client';

import {
  formatDate,
  householdOn,
  householdOnlyMembers,
  membersOn,
  networkOn,
  processesTouchedByHousehold,
  type Person,
  type Relationship,
} from '@mas/domain';
import { useT } from '@mas/messages';
import {
  Button,
  DateField,
  Dialog,
  Pill,
  SelectField,
  Sheet,
  SheetBody,
  SheetHead,
  TextareaField,
  useToast,
} from '@mas/ui';
import { CalendarOff, HousePlus, LogOut, Network, Pencil, Truck, UserPlus } from 'lucide-react';
import { useState, type HTMLAttributes } from 'react';
import { PersonLink } from '@/components/EntityLink';
import { fullName } from '@/lib/selectors';
import { useAppStore, useData, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import { AddToHouseholdDialog, EndMembershipDialog, RenameHouseholdDialog } from './HouseholdPanel';
import { KnownElsewhere } from './KnownElsewhere';
import { EndRelationshipDialog, RelationshipDialog } from './NetworkPanel';
import { NetworkGraph, inverseWord, networkNodes, relationWord } from './NetworkGraph';
import styles from './HouseholdNetworkCard.module.css';

/**
 * Household and network: one card.
 *
 * It replaced three (a household list, a wider network list and a diagram of both) that were three
 * answers to one question, stacked, each with its own empty state (D-230). The distinction the
 * scenarios rest on survives inside it: the household is the people at an address with dates, and
 * the wider network is everyone else who matters. Marion Fraser's nephew is network and not
 * household; Kayleigh Docherty's children are both.
 *
 * The header names the household and its address. For a household of one it says the person lives
 * alone there, never that no household is recorded about somebody whose address is known; where
 * there is no household record yet, the first "Add someone" creates one from the address on the
 * record. The diagram is a toggle, offered only when there is somebody to draw.
 */
export function HouseholdNetworkCard({
  person,
  concernIds,
  ...rest
}: { person: Person; concernIds: string[] } & HTMLAttributes<HTMLElement>) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const on = now.toISOString().slice(0, 10);
  const addToHousehold = useAppStore((s) => s.addToHousehold);
  const endMembership = useAppStore((s) => s.endHouseholdMembership);
  const setLabel = useAppStore((s) => s.setHouseholdLabel);
  const createHousehold = useAppStore((s) => s.createHousehold);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<Person | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [relating, setRelating] = useState(false);
  const [editing, setEditing] = useState<Relationship | null>(null);
  const [endingTie, setEndingTie] = useState<Relationship | null>(null);
  const [moving, setMoving] = useState(false);
  const [diagram, setDiagram] = useState(false);

  const household = householdOn(data, person, on);
  const ties = networkOn(data, person.id, on);
  const unrelated = householdOnlyMembers(data, person.id, on);
  const nodes = networkNodes(data, person, on);

  const currentPeriod = [...person.addressHistory]
    .sort((a, b) => (a.from < b.from ? 1 : -1))
    .find((a) => !a.to);
  const addressRecord =
    household?.address ??
    (currentPeriod ? data.addresses.find((a) => a.id === currentPeriod.addressId) : undefined);
  const address = addressRecord
    ? [addressRecord.line1, addressRecord.line2, addressRecord.town, addressRecord.postcode]
        .filter(Boolean)
        .join(', ')
    : '';
  const others = household
    ? household.household.members.filter((m) => m.personId !== person.id && !m.to)
    : [];
  const past = household ? household.household.members.filter((m) => m.to) : [];
  const alone = others.length === 0;

  const meta = alone
    ? address
      ? t('person.household.alone', { address })
      : t('person.household.aloneNoAddress')
    : `${[household?.label, address].filter(Boolean).join(', ')}. ${t('person.household.membersCount', { count: household?.members.length ?? 0 })}`;

  const empty = alone && ties.network.length === 0 && past.length === 0 && ties.ended.length === 0;

  function startAdding() {
    if (!household) {
      if (!addressRecord) {
        toast({
          title: t('person.household.moveDialog.refused'),
          text: readErrors(['addressMissing']).join(' '),
          tone: 'error',
        });
        return;
      }
      const result = createHousehold(person.id, addressRecord.id, on);
      if (!result.ok) {
        toast({
          title: t('person.household.done.addedTitle'),
          text: readErrors(result.errors).join(' '),
          tone: 'error',
        });
        return;
      }
    }
    setAdding(true);
  }

  const actions = (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<HousePlus size={14} aria-hidden="true" />}
        onClick={startAdding}
        data-testid="household-add"
      >
        {t('person.household.add')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={<UserPlus size={14} aria-hidden="true" />}
        onClick={() => setRelating(true)}
        data-testid="network-add"
      >
        {t('person.network.add')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={<Truck size={14} aria-hidden="true" />}
        onClick={() => setMoving(true)}
        data-testid="household-move"
      >
        {t('person.household.move')}
      </Button>
      {household ? (
        <Button
          size="sm"
          variant="quiet"
          icon={<Pencil size={14} aria-hidden="true" />}
          onClick={() => setRenaming(true)}
          data-testid="household-rename"
        >
          {t('person.household.editLabel')}
        </Button>
      ) : null}
      {nodes.length > 0 ? (
        <Button
          size="sm"
          variant="quiet"
          icon={<Network size={14} aria-hidden="true" />}
          aria-expanded={diagram}
          onClick={() => setDiagram((d) => !d)}
          data-testid="network-diagram"
        >
          {diagram ? t('person.network.hideDiagram') : t('person.network.showDiagram')}
        </Button>
      ) : null}
    </>
  );

  const membershipHousehold = household ?? householdOn(data, person, on);

  return (
    <Sheet empty={empty} {...rest}>
      <SheetHead title={t('person.overview.network.title')} meta={meta} actions={actions} />
      {empty ? null : (
        <SheetBody>
          {!alone ? (
            <section className={styles.section} aria-labelledby={`hh-${person.id}`}>
              <h3 id={`hh-${person.id}`} className={styles.sub}>
                {t('person.household.inThis')}
              </h3>
              <ul className={styles.rows} data-testid="household-members">
                {others.map((membership) => {
                  const member = data.people.find((p) => p.id === membership.personId);
                  if (!member) return null;
                  const tie = ties.household.find((x) => x.other.id === member.id);
                  return (
                    <li key={member.id} className={styles.row}>
                      <span className={styles.name}>
                        <PersonLink person={member} />
                      </span>
                      <span className={styles.meta}>
                        {tie ? (
                          <span>
                            {tie.subjectIsFrom
                              ? inverseWord(tie.relationship.type)
                              : relationWord(tie.relationship.type)}
                          </span>
                        ) : (
                          <Pill size="sm" tone="outline">
                            {t('person.network.noRelationship')}
                          </Pill>
                        )}
                        <span className={styles.date}>
                          {t('person.household.since', { date: formatDate(membership.from) })}
                        </span>
                        <KnownElsewhere person={member} />
                      </span>
                      <span className={styles.rowActions}>
                        <Button
                          size="sm"
                          variant="quiet"
                          icon={<LogOut size={14} aria-hidden="true" />}
                          onClick={() => setEnding(member)}
                          data-testid={`household-end-${member.id}`}
                        >
                          {t('person.household.end')}
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {unrelated.length > 0 ? (
                <p className={styles.hint}>{t('person.network.recordRelationship')}</p>
              ) : null}
            </section>
          ) : null}

          {/*
            The wider network is listed whenever the card has a body, empty or not: beside a household
            list, "nobody recorded outside the household" is the fact a reader most often needs and the
            one place the picture is usually thinnest. It is one line, and it is the only line.
          */}
          <section className={styles.section} aria-labelledby={`nw-${person.id}`}>
            <h3 id={`nw-${person.id}`} className={styles.sub}>
              {t('person.network.title')}
            </h3>
            <ul className={styles.rows} data-testid="network-ties">
              {ties.network.length === 0 ? (
                <li className={styles.hint}>{t('person.network.nobody')}</li>
              ) : null}
              {ties.network.map((tie) => (
                <li key={tie.relationship.id} className={styles.row}>
                  <span className={styles.name}>
                    <PersonLink person={tie.other} />
                  </span>
                  <span className={styles.meta}>
                    <span>
                      {tie.subjectIsFrom
                        ? inverseWord(tie.relationship.type)
                        : relationWord(tie.relationship.type)}
                    </span>
                    {tie.relationship.from ? (
                      <span className={styles.date}>
                        {t('person.household.since', { date: formatDate(tie.relationship.from) })}
                      </span>
                    ) : null}
                    <KnownElsewhere person={tie.other} />
                  </span>
                  <span className={styles.rowActions}>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon={<Pencil size={14} aria-hidden="true" />}
                      onClick={() => setEditing(tie.relationship)}
                      data-testid={`network-edit-${tie.other.id}`}
                    >
                      {t('common.actions.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon={<CalendarOff size={14} aria-hidden="true" />}
                      onClick={() => setEndingTie(tie.relationship)}
                      data-testid={`network-end-${tie.other.id}`}
                    >
                      {t('person.network.endRelationship')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {diagram && nodes.length > 0 ? (
            <NetworkGraph person={person} concernIds={concernIds} on={on} />
          ) : null}

          {past.length > 0 || ties.ended.length > 0 ? (
            <div className={styles.folded}>
              {past.length > 0 ? (
                <details className={styles.past}>
                  <summary>{t('person.household.past')}</summary>
                  <ul className={styles.pastList}>
                    {past.map((membership) => {
                      const member = data.people.find((p) => p.id === membership.personId);
                      return (
                        <li key={`${membership.personId}-${membership.from}`}>
                          {t('person.household.pastRow', {
                            name: member ? fullName(member) : membership.personId,
                            from: formatDate(membership.from),
                            to: formatDate(membership.to ?? on),
                          })}
                          {membership.endedReason ? (
                            <span className={styles.reason}>{membership.endedReason}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
              {ties.ended.length > 0 ? (
                <details className={styles.past}>
                  <summary>{t('person.network.endedTitle')}</summary>
                  <ul className={styles.pastList}>
                    {ties.ended.map((tie) => (
                      <li key={tie.relationship.id}>
                        <PersonLink person={tie.other} />
                        <span className={styles.meta}>
                          {tie.subjectIsFrom
                            ? inverseWord(tie.relationship.type)
                            : relationWord(tie.relationship.type)}
                          {tie.relationship.to ? (
                            <span className={styles.date}>
                              {t('person.network.endedOn', {
                                date: formatDate(tie.relationship.to),
                              })}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </SheetBody>
      )}

      {adding && membershipHousehold ? (
        <AddToHouseholdDialog
          open
          householdId={membershipHousehold.household.id}
          label={membershipHousehold.label ?? address}
          exclude={membershipHousehold.members.map((m) => m.personId)}
          onClose={() => setAdding(false)}
          onSave={(personId, from, note, notify) => {
            const result = addToHousehold(
              membershipHousehold.household.id,
              personId,
              from,
              note,
              notify,
            );
            if (result.ok) {
              const joined = data.people.find((p) => p.id === personId);
              toast({
                title: t('person.household.done.addedTitle'),
                text: t('person.household.done.addedText', {
                  name: joined ? fullName(joined) : personId,
                  date: formatDate(from),
                }),
                tone: 'success',
              });
            }
            return readErrors(result.errors);
          }}
        />
      ) : null}

      {ending && household ? (
        <EndMembershipDialog
          member={ending}
          label={household.label ?? address}
          affected={processesTouchedByHousehold(data, household.household.id, on).length}
          onClose={() => setEnding(null)}
          onSave={(to, reason) => {
            const result = endMembership(household.household.id, ending.id, to, reason);
            if (result.ok)
              toast({
                title: t('person.household.done.endedTitle'),
                text: t('person.household.done.endedText', {
                  name: fullName(ending),
                  date: formatDate(to),
                }),
                tone: 'success',
              });
            return readErrors(result.errors);
          }}
        />
      ) : null}

      {renaming && household ? (
        <RenameHouseholdDialog
          open
          label={household.label ?? ''}
          onClose={() => setRenaming(false)}
          onSave={(label) => readErrors(setLabel(household.household.id, label).errors)}
        />
      ) : null}
      {relating || editing ? (
        <RelationshipDialog
          person={person}
          relationship={editing}
          onClose={() => {
            setRelating(false);
            setEditing(null);
          }}
        />
      ) : null}
      {endingTie ? (
        <EndRelationshipDialog
          person={person}
          relationship={endingTie}
          onClose={() => setEndingTie(null)}
        />
      ) : null}
      {moving ? (
        <RecordMoveDialog
          person={person}
          alone={
            household
              ? membersOn(household.household, on).every((m) => m.personId === person.id)
              : true
          }
          fromAddress={address}
          onClose={() => setMoving(false)}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * A move. The address history closes the old period and opens the new one; the household follows
 * when the person is its only member and is left behind when they are not; the chronology carries
 * the move as a fact. What it will do to the household is said before the button.
 */
function RecordMoveDialog({
  person,
  alone,
  fromAddress,
  onClose,
}: {
  person: Person;
  alone: boolean;
  fromAddress: string;
  onClose: () => void;
}) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const recordMove = useAppStore((s) => s.recordMove);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [addressId, setAddressId] = useState('');
  const [on, setOn] = useState(now.toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const current = [...person.addressHistory]
    .sort((a, b) => (a.from < b.from ? 1 : -1))
    .find((a) => !a.to)?.addressId;
  const options = data.addresses
    .filter((a) => a.id !== current)
    .map((a) => ({ value: a.id, label: [a.line1, a.town, a.postcode].filter(Boolean).join(', ') }));

  function save() {
    const result = recordMove(person.id, addressId, on, note);
    if (!result.ok) {
      setErrors(readErrors(result.errors));
      return;
    }
    const chosen = options.find((o) => o.value === addressId);
    toast({
      title: t('person.household.moveDialog.toastTitle'),
      text: t('person.household.moveDialog.toastText', {
        name: fullName(person),
        address: chosen?.label ?? '',
        date: formatDate(on),
      }),
      tone: 'success',
    });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('person.household.moveDialog.title', { name: fullName(person) })}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!addressId || !on}
            onClick={save}
            data-testid="household-move-submit"
          >
            {t('person.household.moveDialog.submit')}
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
        <SelectField
          label={t('person.household.moveDialog.to')}
          required
          value={addressId}
          onChange={(e) => setAddressId(e.target.value)}
          placeholder={t('person.household.moveDialog.toPlaceholder')}
          options={options}
          data-testid="household-move-to"
        />
        <DateField
          label={t('person.household.moveDialog.on')}
          required
          value={on}
          onChange={setOn}
          data-testid="household-move-on"
        />
        <TextareaField
          label={t('person.household.moveDialog.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          hint={t('person.household.moveDialog.noteHint')}
        />
        <p className={styles.hint}>
          {t('person.household.moveDialog.household', {
            alone: alone ? 'yes' : 'no',
            address: fromAddress,
          })}
        </p>
      </div>
    </Dialog>
  );
}
