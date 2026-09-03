'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { currentMessages, hydrateOverrides, memoryStore, subscribe, type OverridesStore } from './overrides';
import type { FormatXMLElementFn } from 'intl-messageformat';
import { formatMessage, formatRich } from './format';
import type { MessageArgs, MessageKey } from './keys.generated';
import type { TArgs } from './t';

export type RichValues = Record<string, Date | ReactNode | FormatXMLElementFn<ReactNode>>;

export interface Translator {
  <K extends MessageKey>(key: K, ...rest: TArgs<K>): string;
  /** A message whose tags render React nodes; pass { b: (chunks) => <strong>{chunks}</strong> } for a <b> tag. */
  rich: <K extends MessageKey>(key: K, values?: RichValues & Partial<MessageArgs[K]>) => ReactNode;
  /** The current message text for a key, unformatted; the Admin editor shows it. */
  raw: (key: string) => string | undefined;
}

const MessagesContext = createContext<Translator | undefined>(undefined);

function buildTranslator(messages: Record<string, string>): Translator {
  const translate = (<K extends MessageKey>(key: K, ...rest: TArgs<K>): string => {
    const message = messages[key];
    if (message === undefined) return key;
    return formatMessage(message, rest[0]);
  }) as Translator;
  translate.rich = (key, values) => {
    const message = messages[key];
    if (message === undefined) return key;
    const parts = formatRich<ReactNode>(message, values);
    return parts.map((part, i) => (typeof part === 'string' ? part : <span key={i}>{part}</span>));
  };
  translate.raw = (key) => messages[key];
  return translate;
}

/**
 * Provides `useT()`. Hydrates session overrides from the store on mount (the app passes a
 * localStorage, Tauri or Electron store) and re-renders every consumer when an override changes.
 */
export function MessagesProvider({ store = memoryStore, children }: { store?: OverridesStore; children: ReactNode }) {
  const messages = useSyncExternalStore(subscribe, currentMessages, currentMessages);
  const translator = useMemo(() => buildTranslator(messages), [messages]);
  useEffect(() => {
    void hydrateOverrides(store);
  }, [store]);
  return <MessagesContext.Provider value={translator}>{children}</MessagesContext.Provider>;
}

const fallback = buildTranslator(currentMessages());

/** The translator for components. Outside a provider it reads the bundled catalogue. */
export function useT(): Translator {
  return useContext(MessagesContext) ?? fallback;
}
