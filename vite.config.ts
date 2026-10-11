import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Les bibliothèques lourdes (graphiques, PDF) sont chargées à la demande
        // par les onglets qui les utilisent (import dynamique).
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        }
      }
    }
  }
});
