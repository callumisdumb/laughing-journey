import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconEnd, loading = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(styles.button, className)}
      data-variant={variant}
      data-size={size}
      data-state={loading ? 'loading' : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
      {iconEnd}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconEnd' | 'children'> {
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({ className, variant = 'quiet', children, ...rest }: IconButtonProps) {
  return (
    <Button className={cn(styles.iconButton, className)} variant={variant} {...rest}>
      {children}
    </Button>
  );
}
