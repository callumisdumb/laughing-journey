'use client';

import { DOCUMENT_LIMITS, classificationLabel, documentClassification, type Document } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useConfig, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './documents.module.css';

/**
 * Attaching a file (D-243). The file is read into a data URI here, in the browser, and written by
 * the pipeline as a document record classified from its parent; the caps are the record's own, and
 * the dialog says what the file will be marked before the button is pressed. It also says, in as
 * many words, that nothing scans the file, because a mockup that implied otherwise would be lying
 * about the one thing a deployment has to add.
 */
export function AttachFileDialog({ open, onClose, parent, targetLabel }: { open: boolean; onClose: () => void; parent: Document['parent']; targetLabel: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const attach = useAppStore((s) => s.attachDocument);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [file, setFile] = useState<{ name: string; mimeType: string; size: number; dataUri: string } | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const classification = documentClassification(config, parent, data);

  function choose(input: HTMLInputElement) {
    const chosen = input.files?.[0];
    if (!chosen) {
      setFile(null);
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: chosen.name, mimeType: chosen.type || 'application/octet-stream', size: chosen.size, dataUri: typeof reader.result === 'string' ? reader.result : '' });
      setBusy(false);
    };
    reader.onerror = () => {
      setErrors(['documentEmpty']);
      setBusy(false);
    };
    reader.readAsDataURL(chosen);
  }

  function submit() {
    if (!file) {
      setErrors(['documentEmpty']);
      return;
    }
    const result = attach({ parent, ...file, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('documents.toastTitle'), text: t('documents.toastText', { name: file.name, classification: classificationLabel(classification) }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('documents.dialogTitle', { target: targetLabel })}
      errors={readErrors(errors)}
      busy={busy}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!file || busy} data-testid="attach-submit">
            {t('documents.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField label={t('documents.file')} hint={t('documents.fileHint', { limit: DOCUMENT_LIMITS.file / 1000, record: DOCUMENT_LIMITS.record / 1000 })} type="file" required onChange={(e) => choose(e.target)} data-testid="attach-file" />
        {file ? <p className={styles.chosen} data-testid="attach-chosen">{t('documents.chosen', { name: file.name, size: Math.max(1, Math.round(file.size / 1000)), classification: classificationLabel(classification) })}</p> : null}
        <p className={styles.hint}>{t('documents.classificationNote', { classification: classificationLabel(classification) })}</p>
        <TextareaField label={t('documents.note')} hint={t('documents.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="attach-note" />
        <p className={styles.warning}>{t('documents.scanning')}</p>
      </div>
    </Dialog>
  );
}
