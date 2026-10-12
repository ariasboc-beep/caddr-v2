// Version de démonstration publiée comme artefact : un seul fichier JS + un seul fichier CSS
// (polices incluses), chargés par une petite page.
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dans l'artefact, la page n'est pas servie à la racine du site : les polices doivent être
// appelées en relatif (« fonts/… », publiées à côté de la page) et non en absolu (« /fonts/… »).
const relativeFonts = () => ({
  name: 'caddr-demo-relative-fonts',
  enforce: 'post' as const,
  generateBundle(_: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
    Object.values(bundle).forEach(a => {
      if (a.type !== 'asset' || !a.fileName.endsWith('.css') || a.source === undefined) return;
      const css = typeof a.source === 'string' ? a.source : new TextDecoder().decode(a.source);
      a.source = css.replace(/url\((['"]?)\/fonts\//g, 'url($1fonts/');
    });
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), relativeFonts()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  publicDir: false,
  build: {
    outDir: 'dist-demo', emptyOutDir: true, sourcemap: false, assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2022',
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
});
