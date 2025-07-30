import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    setupFiles: ['src/tests/setup.ts'],
  },
}); 