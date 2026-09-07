'use client';

import {
  RELATIONSHIP_TYPES,
  exclusionChanges,
  exclusionsRestingOn,
  formatDate,
  inverseOf,
  processLabel,
  withRelationship,
  type Person,
  type Relationship,
} from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, Dialog, Pill, RadioGroup, SelectField, TextareaField, DateField, useToast } from '@mas/ui';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PersonPicker } from '@/components/PersonPicker';
import { fullName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow, type PartyDecision } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './NetworkPanel.module.css';

/** Relationship types are kebab-case; their catalogue keys are the camelCase form. */
const segment = (type: Relationship['type']) => type.replace(/-([a-z])/g, (_m, letter: string) => letter.toUpperCase());
const relationWord = (type: Relationship['type']) => tKey(`person.network.relation.${segment(type)}`);
const inverseWord = (type: Relationship['type']) => tKey(`person.network.inverse.${segment(type)}`);

export function RelationshipDialog({ person, relationship, onClose }: { person: Person; relationship: Relationship | null; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const save = useAppStore((s) => s.saveRelationship);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const existingOther = relationship ? data.people.find((p) => p.id === (relationship.fromPersonId === person.id ? relationship.toPersonId : relationship.fromPersonId)) ?? null : null;
  const [other, setOther] = useState<Person | null>(existingOther);
  const [subjectIsFrom, setSubjectIsFrom] = useState(relationship ? relationship.fromPersonId === person.id : true);
  const [type, setType] = useState<Relationship['type']>(relationship?.type ?? 'relative-of');
  const [from, setFrom] = useState(relationship?.from ?? '');
  const [notes, setNotes] = useState(relationship?.notes ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const draft = useMemo<Relationship | null>(() => {
    if (!other) return null;
    return {
      id: relationship?.id ?? 'rel_draft',
      synthetic: true,
      fromPersonId: subjectIsFrom ? person.id : other.id,
      toPersonId: subjectIsFrom ? other.id : person.id,
      type,
      from: from || undefined,
      to: relationship?.to,
      notes: notes.trim() || undefined,
    };
  }, [other, relationship, subjectIsFrom, person.id, type, from, notes]);

  /** What saving this would do to the exclusion registers, run against the real rules. */
  const changes = useMemo(() => (draft ? exclusionChanges(data, config, withRelationship(data.relationships, draft)) : []), [data, config, draft]);
  const added = changes.filter((c) => c.kind === 'added');
  const inverse = inverseOf(type);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(relationship ? 'person.network.editTitle' : 'person.network.addTitle', { name: fullName(person) })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              const result = save({ ...draft, id: relationship?.id ?? newId('rel') });
              if (!result.ok) {
                setErrors(result.errors);
                return;
              }
              toast({ title: t('person.network.add'), text: t('person.network.readsBothWays', { inverse: inverse ? relationWord(inverse) : inverseWord(type) }), tone: 'success' });
              onClose();
            }}
            data-testid="network-save"
          >
            {t('person.network.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <PersonPicker label={t('person.network.otherPerson')} value={other} onChange={setOther} exclude={[person.id]} idPrefix="network-other" />

        <RadioGroup
          legend={t('person.network.direction')}
          name="relationship-direction"
          value={subjectIsFrom ? 'from' : 'to'}
          onChange={(v) => setSubjectIsFrom(v === 'from')}
          orientation="vertical"
          options={[
            { value: 'from', label: `${fullName(person)} ${t('person.network.isThe', { name: '' }).trim()} ${relationWord(type)} ${t('person.network.ofThe')} ${other ? fullName(other) : '...'}` },
            { value: 'to', label: `${other ? fullName(other) : '...'} ${t('person.network.isThe', { name: '' }).trim()} ${relationWord(type)} ${t('person.network.ofThe')} ${fullName(person)}` },
          ]}
        />

        <SelectField
          label={t('person.network.type')}
          value={type}
          onChange={(e) => setType(e.target.value as Relationship['type'])}
          options={RELATIONSHIP_TYPES.map((rt) => ({ value: rt, label: relationWord(rt) }))}
          hint={inverse ? t('person.network.readsBothWays', { inverse: relationWord(inverse) }) : t('person.network.noInverse')}
        />

        <DateField label={t('person.network.from')} hint={t('person.network.fromHint')} value={from} onChange={setFrom} />
        <TextareaField label={t('person.network.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {added.length > 0 ? (
          <div className={styles.consequences} data-testid="network-consequences">
            <h4 className={styles.consequencesTitle}>
              <TriangleAlert size={16} aria-hidden="true" /> {t('person.network.consequences.title')}
            </h4>
            <p className={styles.hint}>{t('person.network.consequences.excludesLede')}</p>
            <ul>
              {added.map((change) => {
                const excluded = data.people.find((p) => p.id === change.personId);
                return (
                  <li key={`${change.process.id}-${change.personId}`}>
                    {t('person.network.consequences.excludes', { name: excluded ? fullName(excluded) : change.personId, process: processLabel(change.process.type), rule: change.exclusion.id })}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Ending a relationship, and the decision that has to come with it.
 *
 * Ending one that is the basis of an exclusion does not lift the exclusion, and it must not: a
 * former partner is frequently the whole risk. So the decision is asked explicitly, defaults to the
 * exclusion standing, and is written onto the case with a name and a reason either way.
 */
export function EndRelationshipDialog({ person, relationship, onClose }: { person: Person; relationship: Relationship; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const user = useCurrentUser();
  const end = useAppStore((s) => s.endRelationship);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [decisions, setDecisions] = useState<Record<string, { stands: boolean; reason: string }>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const resting = useMemo(() => exclusionsRestingOn(data, config, relationship.id), [data, config, relationship.id]);
  const otherId = relationship.fromPersonId === person.id ? relationship.toPersonId : relationship.fromPersonId;
  const other = data.people.find((p) => p.id === otherId);
  const word = relationship.fromPersonId === person.id ? inverseWord(relationship.type) : relationWord(relationship.type);

  const key = (processId: string, personId: string) => `${processId}|${personId}`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('person.network.endTitle', { relation: `${other ? fullName(other) : otherId}, ${word}` })}
      size="md"
      tone="destructive"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const payload: PartyDecision[] = resting.map((change) => {
                const decision = decisions[key(change.process.id, change.personId)];
                return { processId: change.process.id, personId: change.personId, stands: decision?.stands ?? true, reason: decision?.reason.trim() || reason.trim() };
              });
              const result = end(relationship.id, to, reason, payload);
              if (!result.ok) {
                setErrors(result.errors);
                return;
              }
              toast({ title: t('person.network.endRelationship'), text: t('person.network.endedOn', { date: formatDate(to) }), tone: 'success' });
              onClose();
            }}
            data-testid="network-end-submit"
          >
            {t('person.network.endSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <DateField label={t('person.network.endDate')} value={to} onChange={setTo} />
        <TextareaField label={t('person.network.endReason')} hint={t('person.network.endReasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="network-end-reason" />

        {resting.length > 0 ? (
          <div className={styles.consequences} data-testid="network-resting">
            <h4 className={styles.consequencesTitle}>
              <TriangleAlert size={16} aria-hidden="true" /> {t('person.network.consequences.restingTitle')}
            </h4>
            <p className={styles.hint}>{t('person.network.consequences.restingLede')}</p>
            {resting.map((change) => {
              const excluded = data.people.find((p) => p.id === change.personId);
              const id = key(change.process.id, change.personId);
              const decision = decisions[id] ?? { stands: true, reason: '' };
              return (
                <div key={id} className={styles.decision}>
                  <p className={styles.decisionWhat}>
                    <Pill size="sm" tone="critical">
                      {processLabel(change.process.type)}
                    </Pill>{' '}
                    {t('person.network.consequences.excludes', { name: excluded ? fullName(excluded) : change.personId, process: processLabel(change.process.type), rule: change.exclusion.id })}
                  </p>
                  <RadioGroup
                    legend={t('person.network.consequences.title')}
                    name={`decision-${id}`}
                    value={decision.stands ? 'stands' : 'lifted'}
                    onChange={(v) => setDecisions((d) => ({ ...d, [id]: { ...decision, stands: v === 'stands' } }))}
                    options={[
                      { value: 'stands', label: t('person.network.consequences.stands'), hint: t('person.network.consequences.standsHint') },
                      { value: 'lifted', label: t('person.network.consequences.lifted'), hint: t('person.network.consequences.liftedHint') },
                    ]}
                  />
                  <TextareaField
                    label={t('person.network.consequences.decisionReason')}
                    value={decision.reason}
                    onChange={(e) => setDecisions((d) => ({ ...d, [id]: { ...decision, reason: e.target.value } }))}
                    rows={2}
                    data-testid={`network-decision-reason-${change.personId}`}
                  />
                  {user ? <p className={styles.hint}>{`${user.givenName} ${user.familyName}`}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
