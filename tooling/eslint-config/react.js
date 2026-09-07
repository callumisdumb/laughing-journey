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
      // Scrollable regions must be focusable (axe scrollable-region-focusable); region is the landmark we use.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region', 'application'], allowExpressionValues: true }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
