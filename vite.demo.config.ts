// Version de démonstration publiée comme artefact : un seul fichier JS + un seul fichier CSS
// (polices incluses), chargés par une petite page.
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  publicDir: false,
  build: {
    outDir: 'dist-demo', emptyOutDir: true, sourcemap: false, assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2022',
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
});
