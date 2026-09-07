'use client';

import { changedFields, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fullName } from '@/lib/selectors';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from '../process/terminal.module.css';

/** The fields other agencies match a person on. Changing one of these takes a reason. */
const IDENTITY = ['givenName', 'familyName', 'preferredName', 'dateOfBirth', 'chi'] as const;
const DETAIL = ['phone', 'email', 'gpPractice', 'school'] as const;

/**
 * Editing a person record, with a reason required on the fields that are somebody's identity.
 *
 * The split is the point. A telephone number changes because it changed, and asking why would be
 * bureaucracy. A date of birth changes because it was wrong, and a date of birth changed without a
 * reason is a record nobody can account for: it is the field every other agency matched on, and the
 * match that worked yesterday will fail today with nothing on the record to say what happened.
 *
 * Every change lands in the record's version history through the write pipeline, which computes it
 * rather than trusting this dialog to declare it.
 */
export function EditPersonDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const t = useT();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [givenName, setGivenName] = useState(person.givenName);
  const [familyName, setFamilyName] = useState(person.familyName);
  const [preferredName, setPreferredName] = useState(person.preferredName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(person.dateOfBirth ?? '');
  const [chi, setChi] = useState(person.chi ?? '');
  const [phone, setPhone] = useState(person.contact.phone ?? '');
  const [email, setEmail] = useState(person.contact.email ?? '');
  const [gpPractice, setGpPractice] = useState(person.gpPractice ?? '');
  const [school, setSchool] = useState(person.school ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const next: Person = {
    ...person,
    givenName: givenName.trim(),
    familyName: familyName.trim(),
    preferredName: preferredName.trim() || undefined,
    dateOfBirth: dateOfBirth || undefined,
    chi: chi.trim() || undefined,
    contact: { phone: phone.trim() || undefined, email: email.trim() || undefined },
    gpPractice: gpPractice.trim() || undefined,
    school: school.trim() || undefined,
  };

  // Flattened for the comparison, because contact is nested and the reason rule is about fields a
  // person would name rather than about the shape the schema happens to use.
  const flat = (p: Person) => ({ ...p, phone: p.contact.phone, email: p.contact.email });
  const identityChanges = changedFields(flat(person), flat(next), [...IDENTITY]);
  const detailChanges = changedFields(flat(person), flat(next), [...DETAIL]);
  const changes = identityChanges.length + detailChanges.length;

  function submit() {
    const rules: string[] = [];
    if (next.givenName === '' || next.familyName === '') rules.push('nameRequired');
    if (changes === 0) rules.push('nothingChanged');
    if (identityChanges.length > 0 && reason.trim().length < 10) rules.push('identityReasonRequired');

    const result = write({
      collection: 'people',
      record: next,
      // A correction, not an edit, the moment an identity field moves. The pipeline requires the
      // reason for a correction, so the two rules cannot come apart.
      intent: identityChanges.length > 0 ? 'correct' : 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: fullName(next),
      reason: identityChanges.length > 0 ? reason : undefined,
      versionChange: [...identityChanges, ...detailChanges].map((c) => c.field).join(', '),
      rules,
      event:
        identityChanges.length > 0
          ? {
              eventType: 'other',
              significance: 'moderate',
              visibility: 'integrated',
              title: t('person.edit.title', { name: fullName(next) }),
              detail: reason.trim(),
              subjectIds: [person.id],
            }
          : undefined,
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('person.edit.doneTitle'), text: t('person.edit.doneText', { count: changes }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('person.edit.title', { name: fullName(person) })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="edit-person-submit">
            {t('person.edit.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <fieldset className={styles.grid} style={{ border: 0, padding: 0, margin: 0 }}>
          <TextField label={t('person.edit.fields.givenName')} value={givenName} onChange={(e) => setGivenName(e.target.value)} required data-testid="edit-given-name" />
          <TextField label={t('person.edit.fields.familyName')} value={familyName} onChange={(e) => setFamilyName(e.target.value)} required data-testid="edit-family-name" />
          <TextField label={t('person.edit.fields.preferredName')} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
          <DateField label={t('person.edit.fields.dateOfBirth')} value={dateOfBirth} onChange={setDateOfBirth} data-testid="edit-date-of-birth" />
          <TextField label={t('person.edit.fields.chi')} value={chi} onChange={(e) => setChi(e.target.value)} data-testid="edit-chi" />
        </fieldset>

        {identityChanges.length > 0 ? (
          <div className={styles.warn} data-testid="edit-identity-warning">
            <span className={styles.consequenceHead}>{t('person.edit.identityHead')}</span>
            <span>{t('person.edit.identityNote')}</span>
            <TextareaField label={t('person.edit.reason')} hint={t('person.edit.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="edit-reason" />
          </div>
        ) : null}

        <p className={styles.consequenceHead}>{t('person.edit.detailHead')}</p>
        <fieldset className={styles.grid} style={{ border: 0, padding: 0, margin: 0 }}>
          <TextField label={t('person.edit.fields.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField label={t('person.edit.fields.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label={t('person.edit.fields.gpPractice')} value={gpPractice} onChange={(e) => setGpPractice(e.target.value)} />
          <TextField label={t('person.edit.fields.school')} value={school} onChange={(e) => setSchool(e.target.value)} />
        </fieldset>

        {changes === 0 ? <p className={styles.consequenceNote}>{t('person.edit.noChange')}</p> : null}
      </div>
    </Dialog>
  );
}
