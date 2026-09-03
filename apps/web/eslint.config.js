import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

/**
 * Files listed under copyRule have moved their copy to the message catalogue; the rule keeps them
 * that way. The list grows namespace by namespace until it is a single wildcard.
 */
export default [
  ...react,
  { ignores: ['next-env.d.ts', '.next/**', 'out/**', 'playwright-report/**', 'test-results/**'] },
  copyRule(['components/AppRoot.tsx', 'lib/messages-store.ts']),
];
