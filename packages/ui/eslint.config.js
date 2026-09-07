import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

/**
 * Every component in the package renders its copy from the catalogue; the rule keeps it that way.
 * Unit tests are exempt: they assert on rendered text, which has to be written out to be checked.
 */
export default [
  ...react,
  copyRule(['src/**/*.{ts,tsx}']),
  { files: ['src/**/*.test.{ts,tsx}'], rules: { 'mas/no-hardcoded-copy': 'off' } },
];
