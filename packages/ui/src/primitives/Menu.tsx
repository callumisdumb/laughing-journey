import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import styles from './Menu.module.css';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  /** Drawn in the critical colour and, by convention, last. */
  destructive?: boolean;
  /** A rule above this item, which is how the rare and consequential are kept apart from the routine. */
  separatorBefore?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

export interface MenuProps {
  /** The button's text. */
  label: ReactNode;
  items: MenuItem[];
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Which edge of the button the list hangs from. */
  align?: 'start' | 'end';
  className?: string;
  'data-testid'?: string;
}

/**
 * A menu button: one control that opens a short list of actions.
 *
 * The WAI-ARIA menu button pattern, no more. The button carries `aria-haspopup="menu"` and
 * `aria-expanded`; the list is `role="menu"` with `role="menuitem"` buttons; arrow keys move, Home
 * and End jump, Escape closes and returns focus to the button, Tab closes and moves on, and a click
 * outside closes. Focus lands on the first item when the list opens, which is what makes it a menu
 * rather than a popover with buttons in it.
 *
 * It exists so that an action row can hold the two or three things a person does every visit and one
 * "More" for the rare and consequential, at one visual weight each (D-231).
 */
export function Menu({ label, items, variant = 'secondary', size = 'md', icon, align = 'end', className, 'data-testid': testId }: MenuProps) {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) button.current?.focus();
  }

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (enabled.length === 0) return;
    const index = enabled.findIndex((el) => el === document.activeElement);
    const go = (i: number) => enabled[(i + enabled.length) % enabled.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        go(index + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        go(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        go(0);
        break;
      case 'End':
        e.preventDefault();
        go(enabled.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
      default:
    }
  }

  return (
    <div ref={wrap} className={cn(styles.wrap, className)} data-align={align}>
      <Button
        ref={button}
        id={buttonId}
        variant={variant}
        size={size}
        icon={icon}
        iconEnd={<ChevronDown size={14} aria-hidden="true" />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        data-testid={testId}
      >
        {label}
      </Button>
      {open ? (
        <div ref={list} className={styles.menu} role="menu" tabIndex={-1} aria-labelledby={buttonId} onKeyDown={onListKeyDown}>
          {items.map((item) => (
            <div key={item.id} className={styles.itemWrap}>
              {item.separatorBefore ? <div className={styles.separator} role="separator" /> : null}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                data-tone={item.destructive ? 'destructive' : undefined}
                disabled={item.disabled}
                data-testid={item['data-testid']}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
