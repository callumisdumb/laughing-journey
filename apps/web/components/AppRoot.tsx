'use client';

import { MessagesProvider, useT } from '@mas/messages';
import { SkeletonLines, ToastProvider } from '@mas/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { RetireHost } from '@/components/RetireHost';
import { Screen } from '@/components/Screen';
import { useAppearance } from '@/lib/appearance';
import { useDesktop } from '@/lib/desktop';
import { messagesStore } from '@/lib/messages-store';
import { useSimulator } from '@/lib/simulator';
import { primeDeviceKey } from '@/lib/localStore';
import { useRoute, useRouterStore } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { DemoPanel } from '@/features/demo/DemoPanel';
import { SignIn } from '@/features/sign-in/SignIn';
import { Simulator } from '@/features/simulator/Simulator';

/** The single client entry: boots messages, appearance, router and data, then renders the route. */
export function AppRoot() {
  return (
    <MessagesProvider store={messagesStore}>
      <Boot />
    </MessagesProvider>
  );
}

function Boot() {
  const t = useT();
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const userId = useAppStore((s) => s.session.userId);
  const hydrate = useAppearance((s) => s.hydrate);
  const hydrateSimulator = useSimulator((s) => s.hydrate);
  const sync = useRouterStore((s) => s.sync);
  const route = useRoute();
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }), []);
  useDesktop();

  useEffect(() => {
    hydrate();
    // The simulator's state is read by the reconciliation screen as well as by the simulator itself,
    // and every navigation here is a full page load, so it is hydrated at boot rather than by the
    // screen that happens to own it. Without this an edit made in the simulator was invisible on the
    // platform: the reconciliation panel was reading the seed.
    hydrateSimulator();
    sync();
    // The device key comes from the OS keychain, which is asynchronous, and everything the store
    // persists is encrypted under a key derived from it. Priming it first means nothing is ever
    // written before there is a key to write it under: a failure to protect must not silently
    // become a failure to encrypt (lib/localStore.ts).
    void primeDeviceKey().then(() => {
      init();
    });
  }, [hydrate, hydrateSimulator, sync, init]);

  if (!ready || !route.ready) {
    return (
      <div className="page" data-app-ready="false">
        <SkeletonLines lines={8} label={t('common.app.loading', { app: t('product.name') })} />
      </div>
    );
  }

  // The simulator owns the whole window rather than sitting inside the shell. A viewer must never
  // be confused about which of the two systems they are looking at, and the product's own chrome
  // around a screen pretending to be a different product would be exactly that confusion.
  const content =
    !userId || route.path === '/sign-in' ? (
      <SignIn />
    ) : route.path === '/simulator' ? (
      <Simulator />
    ) : (
      <AppShell>
        <Screen />
      </AppShell>
    );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {content}
        {/*
          The retire dialog lives above the screens because a record can be sent to the correction
          path from the toast that announced it, and by then the dialog that created it has closed.
        */}
        <RetireHost />
        {/*
          The demo control panel, which is not part of the product. It lives here because a
          waypoint sets the persona and the route together, so it has to sit above whichever
          screen is currently drawn, including the simulator.
        */}
        <DemoPanel />
      </ToastProvider>
    </QueryClientProvider>
  );
}
