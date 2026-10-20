import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/graphics/**', '**/audio/**', '**/node_modules/**', '**/.git/**'],
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    },
  },
});
