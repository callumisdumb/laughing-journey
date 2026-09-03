import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The whole package is security-critical, so every line of it is covered.
    coverage: { include: ['src/**'], thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 } },
  },
});
