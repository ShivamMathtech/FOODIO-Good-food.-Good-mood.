import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.tsx'],
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
  },
});
