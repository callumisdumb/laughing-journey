import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Base config for TypeScript packages without React. */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/vitest.config.ts', '**/playwright.config.ts', '**/next.config.ts', '**/postcss.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\u2014/]",
          message: 'No em dashes. Use a comma, colon, full stop or parentheses.',
        },
        {
          selector: "TemplateElement[value.raw=/\\u2014/]",
          message: 'No em dashes. Use a comma, colon, full stop or parentheses.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
