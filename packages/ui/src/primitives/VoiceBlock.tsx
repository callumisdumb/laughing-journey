import { formatDate, viewsKindLabel, type ViewsRecord } from '@mas/domain';
import { useT } from '@mas/messages';
import { cn } from '../cn';
import styles from './VoiceBlock.module.css';

export interface VoiceBlockProps {
  record: ViewsRecord;
  personName: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** The person's own words, set apart from every other block on the page. */
export function VoiceBlock({ record, personName, size = 'md', className }: VoiceBlockProps) {
  const t = useT();
  return (
    <figure className={cn(styles.voice, className)} data-size={size}>
      <figcaption className={styles.kind}>{viewsKindLabel(record.kind)}</figcaption>
      <blockquote className={styles.quote}>{record.content}</blockquote>
      <div className={styles.attribution}>
        <strong>{personName}</strong>, {formatDate(record.recordedAt)}. {t('common.voice.recordedBy', { name: record.recordedByName, method: record.method })}
      </div>
    </figure>
  );
}
