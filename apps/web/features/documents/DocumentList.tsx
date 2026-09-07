'use client';

import { classificationLabel, formatDateTime, markedFileName, type Document } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button } from '@mas/ui';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useData } from '@/lib/store';
import { AttachFileDialog } from './AttachFileDialog';
import styles from './documents.module.css';

/** The live files on one record. */
export function documentsFor(documents: readonly Document[], parent: Document['parent']): Document[] {
  return documents.filter((d) => d.parent.kind === parent.kind && d.parent.id === parent.id && !d.recordedInError).sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

/**
 * The attachments on a record and the button that adds one. A file leaves through the browser's
 * own download with its marking on the name (D-243), which is the one place the classification a
 * record carries reaches a file system the product does not control.
 */
export function DocumentList({ parent, targetLabel, canAttach = true, compact = false }: { parent: Document['parent']; targetLabel: string; canAttach?: boolean; compact?: boolean }) {
  const t = useT();
  const data = useData();
  const [attaching, setAttaching] = useState(false);
  const docs = documentsFor(data.documents, parent);
  const kb = (n: number) => Math.max(1, Math.round(n / 1000));
  return (
    <div className="stack" data-testid={`documents-${parent.kind}`}>
      {docs.length === 0 ? <p className={styles.empty}>{t('documents.list.empty')}</p> : null}
      {docs.length > 0 ? (
        <ul className={styles.list}>
          {docs.map((d) => (
            <li key={d.id} className={styles.item} data-testid="document-item">
              <span className={styles.name}>{d.name}</span>
              <a className={styles.download} href={d.dataUri} download={markedFileName(d.classification, d.name)} data-testid="document-download">
                {t('documents.download', { name: markedFileName(d.classification, d.name) })}
              </a>
              <span className={styles.meta}>{t('documents.list.item', { size: kb(d.size), classification: classificationLabel(d.classification), at: formatDateTime(d.addedAt), by: d.addedByName })}</span>
              {d.note && !compact ? <span className={styles.note}>{d.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canAttach ? (
        <div>
          <Button size="sm" variant="secondary" icon={<Paperclip size={14} aria-hidden="true" />} onClick={() => setAttaching(true)} data-testid={`attach-${parent.kind}`}>
            {t('documents.attach')}
          </Button>
        </div>
      ) : null}
      {attaching ? <AttachFileDialog open onClose={() => setAttaching(false)} parent={parent} targetLabel={targetLabel} /> : null}
    </div>
  );
}
