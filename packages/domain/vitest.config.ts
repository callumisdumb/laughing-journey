import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: { include: ['src/clocks/**', 'src/need-to-know/**'], thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 } },
  },
});
