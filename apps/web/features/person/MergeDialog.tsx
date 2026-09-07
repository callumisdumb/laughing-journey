'use client';

import { unionPerson, type Person } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, Dialog, Pill, TextareaField, useToast } from '@mas/ui';
import { Merge, RotateCcw, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PersonPicker } from '@/components/PersonPicker';
import { fullName } from '@/lib/selectors';
import { useAppStore, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './MergeDialog.module.css';

/** Fields worth showing side by side, because they are what a practitioner compares. */
const COMPARED = ['dateOfBirth', 'chi', 'gpPractice', 'school'] as const;

/**
 * Merging this record with another, which is destructive and therefore reversible.
 *
 * Two records for one child is the failure this product exists to prevent, so the fix has to be
 * real: every process, event, relationship, meeting and share follows the surviving record. It also
 * has to be reversible, because conflating two children is worse than the duplicate it was meant to
 * fix, and that happens. The dialog says both things before the button rather than after it.
 *
 * The consequences are shown as a count and a list, not as a warning triangle and a sentence about
 * being careful. "Fourteen references will move to this record" is something a practitioner can
 * check against what they expect; "this cannot be undone" would be untrue here and "be careful" is
 * not information.
 */
export function MergeDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const merge = useAppStore((s) => s.mergePerson);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [other, setOther] = useState<Person | null>(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  /** What the surviving record will hold, computed rather than described, so the reader can check it. */
  const preview = useMemo(() => (other ? unionPerson(person, other) : null), [person, other]);

  /** How much of the product actually points at the record about to go, in one number. */
  const references = useMemo(() => {
    if (!other) return 0;
    let count = 0;
    const walk = (node: unknown) => {
      if (typeof node === 'string') {
        if (node === other.id) count += 1;
      } else if (Array.isArray(node)) for (const item of node) walk(item);
      else if (node && typeof node === 'object') for (const value of Object.values(node)) walk(value);
    };
    walk({ ...data, people: [], audit: [], personMerges: [] });
    return count;
  }, [data, other]);

  function close() {
    setOther(null);
    setReason('');
    setErrors([]);
    onClose();
  }

  function submit() {
    if (!other) {
      setErrors(['mergeOtherMissing']);
      return;
    }
    const result = merge(person.id, other.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('person.merge.done.title'), text: t('person.merge.done.text', { name: fullName(other), survivor: fullName(person), count: references }), tone: 'success' });
    close();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('person.merge.title', { name: fullName(person) })}
      size="lg"
      tone="destructive"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={close}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="danger" icon={<Merge size={16} aria-hidden="true" />} disabled={!other} onClick={submit} data-testid="merge-submit">
            {t('person.merge.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.lede}>{t('person.merge.lede', { name: fullName(person) })}</p>

        <PersonPicker
          label={t('person.merge.otherLabel')}
          hint={t('person.merge.otherHint')}
          value={other}
          onChange={(p) => {
            setOther(p);
            setErrors([]);
          }}
          exclude={[person.id]}
          idPrefix="merge-other"
        />

        {other && preview ? (
          <>
            <table className={styles.compare}>
              <caption className={styles.caption}>{t('person.merge.compareCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('person.merge.columns.field')}</th>
                  <th scope="col">{t('person.merge.columns.survivor', { name: fullName(person) })}</th>
                  <th scope="col">{t('person.merge.columns.merged', { name: fullName(other) })}</th>
                  <th scope="col">{t('person.merge.columns.after')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('person.merge.fields.name')}</th>
                  <td>{fullName(person)}</td>
                  <td>{fullName(other)}</td>
                  <td>{fullName(preview)}</td>
                </tr>
                {COMPARED.map((field) => (
                  <tr key={field}>
                    <th scope="row">{tKey(`person.merge.fields.${field}`)}</th>
                    <td>{person[field] ?? <span className={styles.blank}>{t('person.merge.blank')}</span>}</td>
                    <td>{other[field] ?? <span className={styles.blank}>{t('person.merge.blank')}</span>}</td>
                    <td className={preview[field] !== person[field] ? styles.gained : undefined}>{preview[field] ?? <span className={styles.blank}>{t('person.merge.blank')}</span>}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{t('person.merge.fields.aliases')}</th>
                  <td>{person.aliases.join(', ') || <span className={styles.blank}>{t('person.merge.blank')}</span>}</td>
                  <td>{other.aliases.join(', ') || <span className={styles.blank}>{t('person.merge.blank')}</span>}</td>
                  <td className={preview.aliases.length > person.aliases.length ? styles.gained : undefined}>{preview.aliases.join(', ')}</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.consequences} data-testid="merge-consequences">
              <h3 className={styles.consequencesTitle}>
                <TriangleAlert size={16} aria-hidden="true" /> {t('person.merge.consequences.title')}
              </h3>
              <ul>
                <li>{t('person.merge.consequences.references', { count: references, name: fullName(person) })}</li>
                <li>{t('person.merge.consequences.alias', { name: fullName(other) })}</li>
                <li>{t('person.merge.consequences.chronology')}</li>
                <li>{t('person.merge.consequences.audit')}</li>
                <li>
                  <Pill size="sm" tone="low">
                    {t('person.merge.consequences.reversibleTag')}
                  </Pill>{' '}
                  {t('person.merge.consequences.reversible')}
                </li>
              </ul>
            </div>

            <TextareaField
              label={t('person.merge.reason')}
              hint={t('person.merge.reasonHint')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              data-testid="merge-reason"
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Taking a merge back.
 *
 * The unmerge is a real path rather than a promise made in the merge dialog: both records return
 * exactly as they were, every reference goes back to the record it named, and the merge record stays
 * and is marked undone, because the merge happened and an audit trail that deletes its own evidence
 * is not one.
 */
export function UnmergeDialog({ mergeId, open, onClose }: { mergeId: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const unmerge = useAppStore((s) => s.unmergePerson);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const merge = data.personMerges.find((m) => m.id === mergeId);

  function close() {
    setReason('');
    setErrors([]);
    onClose();
  }

  function submit() {
    const result = unmerge(mergeId, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('person.merge.undone.title'), text: t('person.merge.undone.text', { name: merge ? fullName(merge.mergedPerson) : '' }), tone: 'success' });
    close();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('person.merge.unmergeTitle')}
      size="md"
      tone="destructive"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={close}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="danger" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={submit} data-testid="unmerge-submit">
            {t('person.merge.unmergeSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {merge ? (
          <>
            <p className={styles.lede}>{t('person.merge.unmergeLede', { name: fullName(merge.mergedPerson), count: merge.repointed.length, date: merge.at.slice(0, 10), by: merge.byName })}</p>
            <blockquote className={styles.priorReason}>{merge.reason}</blockquote>
          </>
        ) : null}
        <TextareaField label={t('person.merge.unmergeReason')} hint={t('person.merge.unmergeReasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required data-testid="unmerge-reason" />
      </div>
    </Dialog>
  );
}
