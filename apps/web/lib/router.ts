'use client';

/**
 * Client-side router on top of history.pushState (see docs/DECISIONS.md D-004).
 * Next prerenders every known path; navigation never fetches, so runtime-created
 * records keep the same path shape without a server.
 */
import { create } from 'zustand';

interface RouterState {
  path: string;
  search: string;
  ready: boolean;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  back: () => void;
  sync: () => void;
}

function normalise(path: string): string {
  const p = path.replace(/\/+$/, '').replace(/\.html$/, '');
  return p === '' ? '/' : p;
}

export const useRouterStore = create<RouterState>((set, get) => ({
  path: '/',
  search: '',
  ready: false,
  sync: () => {
    if (typeof window === 'undefined') return;
    set({ path: normalise(window.location.pathname), search: window.location.search, ready: true });
  },
  navigate: (to, options) => {
    if (typeof window === 'undefined') return;
    const url = new URL(to, window.location.origin);
    const path = normalise(url.pathname);
    if (options?.replace) window.history.replaceState({}, '', path + url.search + url.hash);
    else window.history.pushState({}, '', path + url.search + url.hash);
    set({ path, search: url.search });
    if (path !== get().path || !options?.replace) window.scrollTo({ top: 0 });
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  },
  back: () => {
    if (typeof window !== 'undefined') window.history.back();
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => useRouterStore.getState().sync());
}

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
  ready: boolean;
}

export function useRoute(): Route {
  const path = useRouterStore((s) => s.path);
  const search = useRouterStore((s) => s.search);
  const ready = useRouterStore((s) => s.ready);
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(search), ready };
}

export function useNavigate(): RouterState['navigate'] {
  return useRouterStore((s) => s.navigate);
}

export function setQuery(current: URLSearchParams, updates: Record<string, string | null>): string {
  const q = new URLSearchParams(current);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === '') q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
