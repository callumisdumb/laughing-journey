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
  title: 'Platform',
  description: 'Multi-agency public protection platform (mockup, synthetic data only)',
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
