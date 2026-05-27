import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const subrouterProxyTarget = process.env.SUBROUTER_API_BASE || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api/site': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/api': {
        target: subrouterProxyTarget,
        changeOrigin: true,
        secure: true,
      },
      '/v1': {
        target: subrouterProxyTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
