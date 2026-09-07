'use client';

import type { Translator } from '@mas/messages';
import type { WriteEffect } from '@/lib/write';

type Toast = (input: { title: string; text?: string; tone?: 'info' | 'success' | 'error' }) => void;

/**
 * What the two forms that record a "must not receive" entry say after the pipeline has run.
 *
 * The register update and the reverse near-match check are the pipeline's (D-198), so the form
 * only reads the effects back: how many entries moved, and which names already on a list resemble
 * one of them. The second is an error-toned toast on purpose, because a similar name already on a
 * distribution list is the thing the register exists to catch.
 */
export function toastRegisterEffects(effects: readonly WriteEffect[], t: Translator, toast: Toast): void {
  for (const effect of effects) {
    if (effect.kind === 'register') {
      toast({ title: t('forms.mustNotReceive.registerUpdated.title'), text: t('forms.mustNotReceive.registerUpdated.text', { count: Number(effect.detail) }), tone: 'success' });
    } else if (effect.kind === 'nearMatch') {
      const names = effect.detail.split('; ').filter(Boolean);
      toast({ title: t('sharing.nearMatch.reverseTitle'), text: t('sharing.nearMatch.reverseText', { count: names.length, names: names.join('; ') }), tone: 'error' });
    }
  }
}
