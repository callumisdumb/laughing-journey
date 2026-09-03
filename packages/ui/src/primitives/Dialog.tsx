import { useT } from '@mas/messages';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { IconButton } from './Button';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

/** Native dialog element: focus trapping, Escape and backdrop come from the platform. */
export function Dialog({ open, onClose, title, children, actions, size = 'md', className }: DialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Backdrop click closes: attached imperatively because the dialog element itself is the backdrop target.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) onClose();
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(styles.dialog, className)}
      data-size={size}
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <div className={styles.head}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <IconButton aria-label={t('common.actions.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </div>
      <div className={styles.body}>{children}</div>
      {actions ? <div className={styles.foot}>{actions}</div> : null}
    </dialog>
  );
}
