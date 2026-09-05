import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Sheet.module.css';

export type SheetTone = 'default' | 'paper' | 'well' | 'accent' | 'restricted';

export interface SheetProps extends HTMLAttributes<HTMLElement> {
  tone?: SheetTone;
  selected?: boolean;
  as?: 'section' | 'article' | 'div' | 'aside';
}

export function Sheet({ tone = 'default', selected, as: Tag = 'section', className, children, ...rest }: SheetProps) {
  return (
    <Tag className={cn(styles.sheet, className)} data-tone={tone} data-state={selected ? 'selected' : undefined} {...rest}>
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
