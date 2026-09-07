import { glossaryLookup } from '@mas/domain';
import { useId, type ReactNode } from 'react';
import styles from './Term.module.css';

/** A statutory term with a glossary tooltip on hover and focus. */
export function Term({ term, children }: { term: string; children?: ReactNode }) {
  const id = useId();
  const entry = glossaryLookup(term);
  if (!entry) return <>{children ?? term}</>;
  return (
    <button type="button" className={styles.term} aria-describedby={id}>
      {children ?? term}
      <span className={styles.tip} role="tooltip" id={id}>
        {entry.term}: {entry.definition}
      </span>
    </button>
  );
}
