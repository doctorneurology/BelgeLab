import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Kökteki tüm .html dosyaları (ana sayfa + araç sayfaları) ayrı birer sayfa olarak derlenir.
const kok = import.meta.dirname;
const sayfalar = Object.fromEntries(
  readdirSync(kok)
    .filter((d) => d.endsWith('.html'))
    .map((d) => [d.replace(/\.html$/, ''), resolve(kok, d)]),
);

export default defineConfig({
  // Göreli yollar: site GitHub Pages'te alt klasörde (kullanici.github.io/depo/) de çalışsın.
  base: './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: sayfalar },
  },
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/kurulum.js'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
