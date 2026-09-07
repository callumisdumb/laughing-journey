'use client';

import { useT } from '@mas/messages';
import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { Button, IconButton } from './Button';
import styles from './Dialog.module.css';

/**
 * The one dialog in the product. Every modal uses it; there are no local variants.
 *
 * Native `<dialog>` opened with `showModal()`, for four things the platform does better than we
 * would: the top layer, so no ancestor's `position` or `z-index` can put the application chrome over
 * it; `::backdrop`; focus trapping; and Escape. Hand-rolling a focus trap the browser already
 * provides is how a dialog ends up almost accessible.
 *
 * `showModal()` does not stop the page behind from scrolling, so this does, and it restores the
 * previous overflow rather than assuming it was `visible`. Nesting is stacked: a confirmation raised
 * from inside a form dialog, such as the near-match exclusion warning, is a second modal above the
 * first, which the top layer handles in order and which keeps the parent's state intact.
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'full';

/**
 * Where the dialog sits. `centre` is the modal a decision interrupts you with; the two edge
 * placements are the panels that belong against a side of the screen, which is what the context
 * drawer and the navigation rail become once the viewport is too narrow to dock them as columns.
 * They are the same primitive because they need the same four things from the platform: the top
 * layer, focus trapped inside, Escape, and the page behind held still.
 */
export type DialogPlacement = 'centre' | 'inline-start' | 'inline-end';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: DialogSize;
  placement?: DialogPlacement;
  /** Marks a confirmation that destroys or discloses, so it reads as different before the button. */
  tone?: 'default' | 'destructive';
  /**
   * Validation failures, shown as a summary at the top of the body with focus moved to it. A
   * per-field error a keyboard user has to hunt for is a form they abandon.
   */
  errors?: string[];
  /** Blocks the backdrop and Escape while a submission is in flight, so a half-written record cannot be orphaned. */
  busy?: boolean;
  className?: string;
}

/** How many modals are open, so the last one out restores the page's scrolling. */
let openCount = 0;

export function Dialog({ open, onClose, title, children, actions, size = 'md', placement = 'centre', tone = 'default', errors, busy = false, className }: DialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [scroll, setScroll] = useState({ top: false, bottom: false });

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  // Open and close, and remember what to give focus back to. `showModal()` moves focus into the
  // dialog itself, so the invoking control has to be captured before that happens.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
    if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // The page behind must not scroll while a modal is open, which `showModal()` does not do, and it
  // must scroll again when the last one closes, which is why the lock is counted rather than set.
  //
  // The count is paired by React's own cleanup rather than by the element's `close` event, because a
  // dialog can leave the page without ever firing one: navigate away with a modal open and the
  // component unmounts, `close` never runs, and a page locked by an element that no longer exists
  // cannot be scrolled again. The `close` event handles the ways a dialog shuts; this handles the
  // way it disappears.
  useEffect(() => {
    if (!open) return undefined;
    openCount += 1;
    if (openCount === 1) {
      document.body.dataset.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        document.body.style.overflow = document.body.dataset.previousOverflow ?? '';
        delete document.body.dataset.previousOverflow;
      }
    };
  }, [open]);

  // Tell the caller, and restore the caller's focus, however the dialog closed: the footer button,
  // Escape, or the backdrop. `close` fires for all three, which is why this hangs off the element's
  // own event rather than being repeated at each of the three call sites.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onNativeClose = () => {
      returnFocusTo.current?.focus();
      returnFocusTo.current = null;
      onClose();
    };
    el.addEventListener('close', onNativeClose);
    return () => el.removeEventListener('close', onNativeClose);
  }, [onClose]);

  // The backdrop is the dialog element's own box outside its padding, so a click that lands on the
  // element itself is a backdrop click.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) close();
    };
    const onCancel = (e: Event) => {
      if (busy) e.preventDefault();
    };
    el.addEventListener('click', onClick);
    el.addEventListener('cancel', onCancel);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('cancel', onCancel);
    };
  }, [close, busy]);

  // Move focus to the validation summary when one appears, so the reason the form refused is the
  // next thing announced rather than something to be hunted for.
  useEffect(() => {
    if (errors && errors.length > 0) errorsRef.current?.focus();
  }, [errors]);

  // Bails when nothing changed. A setState that always builds a fresh object re-renders on every
  // scroll frame, and with `children` in the effect's dependencies that is an infinite loop: the
  // page stops responding and a click on the trigger never resolves. Found by the regression spec,
  // which is the first thing it caught.
  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setScroll((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
  }, []);

  useEffect(() => {
    if (open) onScroll();
  }, [open, onScroll]);

  return (
    <dialog ref={ref} className={cn(styles.dialog, className)} data-size={size} data-placement={placement} data-tone={tone} aria-labelledby={titleId} aria-busy={busy || undefined}>
      <div className={styles.head}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <IconButton aria-label={t('common.actions.close')} onClick={close} disabled={busy}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </div>
      <div className={styles.body} ref={bodyRef} onScroll={onScroll} data-scroll-top={String(scroll.top)} data-scroll-bottom={String(scroll.bottom)}>
        {errors && errors.length > 0 ? (
          <div className={styles.errors} ref={errorsRef} tabIndex={-1} role="alert">
            <p className={styles.errorsTitle}>{t('common.dialog.errorsTitle', { count: errors.length })}</p>
            <ul className={styles.errorsList}>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {children}
      </div>
      {actions ? <div className={styles.foot}>{actions}</div> : null}
    </dialog>
  );
}

/**
 * The confirmation shape, so a yes-or-no question does not become a bespoke dialog each time.
 * Destructive by default in tone but not in wording: the caller supplies the verb.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = 'destructive',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'destructive';
  busy?: boolean;
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      tone={tone}
      busy={busy}
      actions={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant={tone === 'destructive' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
