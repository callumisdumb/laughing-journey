import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

/**
 * Every user-visible string in the app comes from the message catalogue (docs/MESSAGES.md), so the
 * copy rule covers the whole app. `e2e` and `scripts` are excluded by the ignores above.
 */
export default [
  ...react,
  { ignores: ['next-env.d.ts', '.next/**', 'out/**', 'playwright-report/**', 'test-results/**'] },
  copyRule(['app/**/*.tsx', 'components/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}', 'lib/**/*.ts']),
];
