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

// GenOffice (Apache-2.0) kodu: vendor/genoffice. Orada "@genoffice/<paket>" ve "node:*" içe aktarmaları şöyle çözülür:
//  - @genoffice/<paket>[/<alt>]  → vendor/genoffice/packages/<paket>/src/...
//  - node:zlib, node:fs, node:os, node:path, node:crypto, node:stream/promises → vendor/shim/* (tarayıcıda çalışan küçük katmanlar)
// Yalnızca vendor/genoffice içindeki dosyalar etkilenir; sitenin kendi kodu ve testler gerçek Node modüllerini kullanır.
const SHIM = { 'node:zlib': 'zlib.js', 'node:fs': 'fs.js', 'node:os': 'os.js', 'node:path': 'path.js', 'node:crypto': 'crypto.js', 'node:stream/promises': 'stream-promises.js' };
function genoffice() {
  return {
    name: 'genoffice-cozumleyici',
    enforce: 'pre',
    resolveId(kaynak, ice) {
      const iceYol = (ice ?? '').replace(/\\/g, '/');
      if (!iceYol.includes('/vendor/genoffice/')) return null;
      if (SHIM[kaynak]) return resolve(kok, 'vendor/shim', SHIM[kaynak]);
      const m = /^@genoffice\/([^/]+)(?:\/(.+))?$/.exec(kaynak);
      if (!m) return null;
      const [, paket, alt] = m;
      if (!alt) return resolve(kok, `vendor/genoffice/packages/${paket}/src/index.ts`);
      if (alt.endsWith('.json')) return resolve(kok, `vendor/genoffice/packages/${paket}/${alt}`);
      return resolve(kok, `vendor/genoffice/packages/${paket}/src/${alt}.ts`);
    },
  };
}

export default defineConfig({
  // Göreli yollar: site GitHub Pages'te alt klasörde (kullanici.github.io/depo/) de çalışsın.
  base: './',
  plugins: [genoffice()],
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
