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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { ...t, id }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={styles.toast} data-tone={t.tone ?? 'info'} role="status">
            <div className={styles.toastText}>
              <div className={styles.toastTitle}>{t.title}</div>
              {t.text ? <div>{t.text}</div> : null}
            </div>
            <IconButton aria-label="Dismiss notification" size="sm" onClick={() => dismiss(t.id)}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
