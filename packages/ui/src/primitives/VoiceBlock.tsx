import { VIEWS_KIND_LABELS, formatDate, type ViewsRecord } from '@mas/domain';
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
  return (
    <figure className={cn(styles.voice, className)} data-size={size}>
      <figcaption className={styles.kind}>{VIEWS_KIND_LABELS[record.kind]}</figcaption>
      <blockquote className={styles.quote}>{record.content}</blockquote>
      <div className={styles.attribution}>
        <strong>{personName}</strong>, {formatDate(record.recordedAt)}. Recorded by {record.recordedByName}, {record.method}.
      </div>
    </figure>
  );
}
