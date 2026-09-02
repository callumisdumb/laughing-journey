import base from './index.js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

/** Config for React packages and the Next app. */
export default [
  ...base,
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/no-autofocus': 'off',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
