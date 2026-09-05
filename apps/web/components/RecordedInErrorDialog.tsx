'use client';

import { useT } from '@mas/messages';
import { Button, Dialog, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, type Collection } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './RecordedInErrorDialog.module.css';

/**
 * The terminal state for a record that should never have existed.
 *
 * The whole dialog is an argument against the word "delete", and it makes the argument in the copy
 * rather than in a warning triangle: what this does and, more usefully, what it does not do. The
 * record stays. Its audit entries stay. A pack that went out last Tuesday went out. What changes is
 * that working views stop showing it and every view that still does says who decided and why.
 *
 * It takes a collection and an id rather than a record, because it is used from a toast on a create
 * that has just happened as well as from a record's own actions, and the toast has an id.
 */
export function RecordedInErrorDialog({
  collection,
  id,
  label,
  open,
  onClose,
}: {
  collection: Collection;
  id: string;
  /** What is being retired, for the heading. */
  label: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const recordInError = useAppStore((s) => s.recordInError);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const result = recordInError(collection, id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('common.recordedInError.doneTitle'), text: t('common.recordedInError.doneText'), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('common.recordedInError.title')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} data-testid="in-error-submit">
            {t('common.recordedInError.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.what}>{label}</p>
        <p>{t('common.recordedInError.intro')}</p>
        <p className={styles.keeps}>{t('common.recordedInError.keeps')}</p>
        <TextareaField
          label={t('common.recordedInError.reason')}
          hint={t('common.recordedInError.reasonHint')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          data-testid="in-error-reason"
        />
      </div>
    </Dialog>
  );
}
