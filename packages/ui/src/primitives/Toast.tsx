import { useT } from '@mas/messages';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { IconButton } from './Button';
import styles from './Toast.module.css';

export interface ToastItem {
  id: number;
  title: string;
  text?: string;
  tone?: 'info' | 'success' | 'error';
}

interface ToastApi {
  toast: (t: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/**
 * A counter, not a random number. A toast id needs only to be unique within the session, and a
 * counter is unique by construction where a timestamp plus a pseudo-random fraction merely makes a
 * collision unlikely. It also keeps the platform's non-cryptographic random source out of the
 * codebase entirely, so `pnpm lint:crypto` can ban it outright rather than maintaining a list of
 * places where it happens to be harmless: a reviewer grepping a safeguarding product for it should
 * find nothing at all, not an explanation.
 */
let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (next: Omit<ToastItem, 'id'>) => {
      nextToastId += 1;
      const id = nextToastId;
      setItems((xs) => [...xs, { ...next, id }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="region" aria-label={t('common.toast.region')} aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={styles.toast} data-tone={item.tone ?? 'info'} role="status">
            <div className={styles.toastText}>
              <div className={styles.toastTitle}>{item.title}</div>
              {item.text ? <div>{item.text}</div> : null}
            </div>
            <IconButton aria-label={t('common.toast.dismiss')} size="sm" onClick={() => dismiss(item.id)}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
