import { t } from '@mas/messages';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/400-italic.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance';

export const metadata: Metadata = {
  title: t('common.app.name'),
  description: t('common.app.tagline'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
