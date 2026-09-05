'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useNavigate, useRoute } from '@/lib/router';

export interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
  /** Mark aria-current when the path matches (or starts with, for sections). */
  current?: 'exact' | 'section';
}

/** A real anchor for accessibility and middle-click; primary clicks go through the client router. */
export function AppLink({ href, children, current, onClick, ...rest }: AppLinkProps) {
  const navigate = useNavigate();
  const route = useRoute();
  const path = href.split('?')[0] ?? href;
  const isCurrent = current === 'exact' ? route.path === path : current === 'section' ? route.path === path || route.path.startsWith(`${path}/`) : false;
  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  }
  return (
    <a href={href} onClick={handle} aria-current={isCurrent ? 'page' : undefined} {...rest}>
      {children}
    </a>
  );
}
