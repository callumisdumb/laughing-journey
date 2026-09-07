import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';
import styles from './Field.module.css';

interface FieldChrome {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

function useFieldIds(explicitId: string | undefined, hint: ReactNode, error: ReactNode) {
  const generated = useId();
  const id = explicitId ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

function Chrome({ id, label, hint, error, required, hintId, errorId, children }: FieldChrome & { id: string; hintId?: string; errorId?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <div className={styles.hint} id={hintId}>
          {hint}
        </div>
      ) : null}
      {children}
      {error ? (
        <div className={styles.error} id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends FieldChrome, Omit<InputHTMLAttributes<HTMLInputElement>, 'required'> {}

export function TextField({ label, hint, error, required, id: explicitId, className, ...rest }: TextFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(explicitId, hint, error);
  return (
    <Chrome id={id} label={label} hint={hint} error={error} required={required} hintId={hintId} errorId={errorId}>
      <input id={id} className={cn(styles.control, className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={required || undefined} {...rest} />
    </Chrome>
  );
}

export interface TextareaFieldProps extends FieldChrome, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'> {}

export function TextareaField({ label, hint, error, required, id: explicitId, className, ...rest }: TextareaFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(explicitId, hint, error);
  return (
    <Chrome id={id} label={label} hint={hint} error={error} required={required} hintId={hintId} errorId={errorId}>
      <textarea id={id} className={cn(styles.control, styles.textarea, className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={required || undefined} {...rest} />
    </Chrome>
  );
}

export interface SelectFieldProps extends FieldChrome, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function SelectField({ label, hint, error, required, id: explicitId, className, options, placeholder, ...rest }: SelectFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(explicitId, hint, error);
  return (
    <Chrome id={id} label={label} hint={hint} error={error} required={required} hintId={hintId} errorId={errorId}>
      <select id={id} className={cn(styles.control, styles.select, className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={required || undefined} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Chrome>
  );
}

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function CheckboxField({ label, hint, id: explicitId, className, ...rest }: CheckboxFieldProps) {
  const generated = useId();
  const id = explicitId ?? generated;
  return (
    <label className={cn(styles.check, className)} htmlFor={id}>
      <input id={id} type="checkbox" className={styles.checkInput} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      <span>
        <span className={styles.checkText}>{label}</span>
        {hint ? (
          <span className={styles.hint} id={`${id}-hint`}>
            {' '}
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export interface RadioGroupProps {
  legend: ReactNode;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: ReactNode; hint?: ReactNode }>;
  orientation?: 'vertical' | 'horizontal';
  hint?: ReactNode;
  error?: ReactNode;
}

export function RadioGroup({ legend, name, value, onChange, options, orientation = 'vertical', hint, error }: RadioGroupProps) {
  const id = useId();
  return (
    <fieldset className={styles.radioGroup} data-orientation={orientation} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      {hint ? (
        <div className={styles.hint} id={`${id}-hint`}>
          {hint}
        </div>
      ) : null}
      {options.map((o) => (
        <label key={o.value} className={styles.check}>
          <input type="radio" className={styles.checkInput} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <span className={styles.checkText}>{o.label}</span>
            {o.hint ? <span className={styles.hint}> {o.hint}</span> : null}
          </span>
        </label>
      ))}
      {error ? (
        <div className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </div>
      ) : null}
    </fieldset>
  );
}

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Switch({ label, id: explicitId, className, ...rest }: SwitchProps) {
  const generated = useId();
  const id = explicitId ?? generated;
  return (
    <label className={cn(styles.switch, className)} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" className={styles.switchInput} {...rest} />
      <span className={styles.switchTrack} aria-hidden="true" />
      <span className={styles.checkText}>{label}</span>
    </label>
  );
}
