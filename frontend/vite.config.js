import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy /api/* requests to the Flask backend in dev mode.
      // This avoids CORS preflight issues entirely.
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        test: path.resolve(__dirname, 'test/index.html'),
      },
    },
  },
});
