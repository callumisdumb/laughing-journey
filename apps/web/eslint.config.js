import react from '@mas/eslint-config/react';
export default [
  ...react,
  { ignores: ['next-env.d.ts', '.next/**', 'out/**', 'playwright-report/**', 'test-results/**'] },
];
