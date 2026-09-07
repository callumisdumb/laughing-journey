import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Sheet.module.css';

export type SheetTone = 'default' | 'paper' | 'well' | 'accent' | 'restricted';

export interface SheetProps extends HTMLAttributes<HTMLElement> {
  tone?: SheetTone;
  selected?: boolean;
  /**
   * The card has nothing to show. It keeps the height of its title: the one-line statement of what is
   * missing goes in the head's meta line and the action that fixes it in the head's action slot, and
   * no body is rendered. A card-sized panel explaining an absence is what this replaces (D-229).
   */
  empty?: boolean;
  as?: 'section' | 'article' | 'div' | 'aside';
}

export function Sheet({ tone = 'default', selected, empty, as: Tag = 'section', className, children, ...rest }: SheetProps) {
  return (
    <Tag className={cn(styles.sheet, className)} data-sheet="true" data-tone={tone} data-state={selected ? 'selected' : undefined} data-empty={empty ? 'true' : undefined} {...rest}>
      {children}
    </Tag>
  );
}

export interface SheetHeadProps {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  divided?: boolean;
  headingLevel?: 2 | 3 | 4;
  id?: string;
}

export function SheetHead({ title, meta, actions, divided = false, headingLevel = 2, id }: SheetHeadProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={styles.head} data-divided={divided ? 'true' : undefined}>
      <div>
        <Heading className={styles.title} id={id}>
          {title}
        </Heading>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export function SheetBody({ flush = false, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div className={cn(styles.body, className)} data-flush={flush ? 'true' : undefined} {...rest}>
      {children}
    </div>
  );
}

export function SheetFoot({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(styles.foot, className)} {...rest}>
      {children}
    </div>
  );
}

export function Rule() {
  return <hr className={styles.rule} />;
}
