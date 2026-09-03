import { formatCalendarDate, parseTypedDate, UI_DATE_EXAMPLE, UI_DATE_FORMAT } from '@mas/domain';
import { useT } from '@mas/messages';
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';
import styles from './DateField.module.css';
import { TextField } from './Field';

export interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'required'> {
  label: ReactNode;
  /** Omit for the format hint with an example; pass null in a compact row and put the format in the label instead. */
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** A calendar date as yyyy-MM-dd, or empty. */
  value: string;
  /** Called with yyyy-MM-dd when the text parses, with the raw text otherwise so a schema can reject it. */
  onChange: (value: string) => void;
}

/**
 * A date typed as dd Mon yyyy, the format the rest of the product shows. Native date inputs
 * render in the browser's locale, which the product cannot control, so this field takes text
 * and normalises it on blur. Accepts 2 Sep 2026, 02/09/2026 and 2026-09-02 as well.
 */
export function DateField({ label, hint, error, required, value, onChange, onBlur, className, ...rest }: DateFieldProps) {
  const t = useT();
  const [text, setText] = useState(() => formatCalendarDate(value) || value);
  const [formatError, setFormatError] = useState<string | undefined>(undefined);
  const [seenValue, setSeenValue] = useState(value);
  // The format and its example are domain constants; the sentences around them are catalogue messages.
  const formatArgs = { format: UI_DATE_FORMAT, example: UI_DATE_EXAMPLE };

  // Follow the value when it changes from outside (a reset, a default, a cleared filter) without
  // disturbing text the person is still typing that already means the same date.
  if (value !== seenValue) {
    setSeenValue(value);
    if (parseTypedDate(text) !== value) setText(formatCalendarDate(value) || value);
    if (!value) setFormatError(undefined);
  }

  return (
    <TextField
      label={label}
      hint={hint === undefined ? t('common.dateField.hint', formatArgs) : hint || undefined}
      error={error ?? formatError}
      required={required}
      className={cn(styles.date, className)}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        setFormatError(undefined);
        onChange(parseTypedDate(next) ?? next);
      }}
      onBlur={(e) => {
        const parsed = parseTypedDate(text);
        if (parsed) {
          setText(formatCalendarDate(parsed));
          setFormatError(undefined);
        } else {
          setFormatError(text.trim() ? t('common.dateField.formatError', formatArgs) : undefined);
        }
        onBlur?.(e);
      }}
      {...rest}
    />
  );
}
