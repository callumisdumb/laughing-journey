import { isMarked, marking, type Classification } from '@mas/domain';
import { useT } from '@mas/messages';
import { Lock } from 'lucide-react';
import { cn } from '../cn';
import styles from './Classification.module.css';

/**
 * Government Security Classification markings, Annex 2 of the MAPPA National Guidance.
 *
 * Both components render nothing at Official. The guidance is explicit that routine Official
 * information needs no marking, and a product that marks every page trains people to ignore
 * markings (D-058). Only Official-Sensitive is shown.
 */

/**
 * The print marking: centred, uppercase, at the top and bottom of every page, with any handling
 * instructions after it. This is the one place the marking is mandatory and prominent.
 */
export function ClassificationMarking({ classification, className }: { classification: Classification; className?: string }) {
  const text = marking(classification);
  if (!text) return null;
  return (
    <div className={cn(styles.print, className)} role="note">
      {text}
    </div>
  );
}

/**
 * The screen marking: compact, for the page header, sized to sit beside the restricted indicator
 * without competing with it. Never colour alone: the label text carries the meaning and the lock
 * glyph reinforces it.
 */
export function ClassificationTag({ classification, className }: { classification: Classification; className?: string }) {
  const t = useT();
  const text = marking(classification);
  if (!text || !isMarked(classification)) return null;
  return (
    <span className={cn(styles.tag, className)} aria-label={t('common.marks.classification', { level: text })}>
      <Lock size={12} aria-hidden="true" />
      {text}
    </span>
  );
}
