import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 9000,
    // The hmr configuration is often needed for containerized environments
    hmr: {
      clientPort: 443,
    },
  },
  // By setting appType to 'spa', Vite will automatically handle
  // history API fallbacks, serving index.html for all routes that
  // don't match a static asset. This is the correct way to fix
  // the CSS MIME type error in Vite.
  appType: 'spa',
});
