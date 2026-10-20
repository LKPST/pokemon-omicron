import { defineConfig } from 'vite';

// StackBlitz sometimes throws "ENOENT: read" when a file changes while it is being read.
// Log it instead of letting it kill the dev server.
process.on('uncaughtException', (e) => console.warn('[ignored]', e && e.code, e && e.message));
process.on('unhandledRejection', (e) => console.warn('[ignored]', e && e.message));

export default defineConfig({
  optimizeDeps: { entries: ['index.html'] },   // don't scan the big editor .html files
  server: {
    watch: {
      ignored: ['**/graphics/**', '**/audio/**', '**/node_modules/**', '**/.git/**', '**/package-lock.json'],
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    },
  },
});
