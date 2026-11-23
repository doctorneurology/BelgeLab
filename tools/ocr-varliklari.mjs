// OCR'ın tarayıcıda ÇEVRİMDIŞI çalışması için gereken dosyaları public/tesseract'a kopyalar:
// işçi betiği, çekirdek (WASM), Türkçe dil verisi ve lisans metinleri. Dış sunucuya (CDN) başvurulmaz.
// Bu klasör git'e eklenmez; her "npm run dev / build" öncesinde yeniden üretilir.
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const kok = resolve(import.meta.dirname, '..');
const nm = resolve(kok, 'node_modules');
const hedef = resolve(kok, 'public', 'tesseract');

const kaynaklar = {
  isci: resolve(nm, 'tesseract.js', 'dist', 'worker.min.js'),
  cekirdek: resolve(nm, 'tesseract.js-core'),
  dil: resolve(nm, '@tesseract.js-data', 'tur', '4.0.0_best_int', 'tur.traineddata.gz'),
};
for (const [ad, yol] of Object.entries(kaynaklar)) {
  if (!existsSync(yol)) {
    console.error(`OCR bileşeni bulunamadı (${ad}). Önce "npm install" çalıştırın.`);
    process.exit(1);
  }
}

rmSync(hedef, { recursive: true, force: true });
mkdirSync(resolve(hedef, 'core'), { recursive: true });
mkdirSync(resolve(hedef, 'lang'), { recursive: true });
copyFileSync(kaynaklar.isci, resolve(hedef, 'worker.min.js'));
// Yalnızca "LSTM" çekirdekleri gerekir (3 işlemci varyantı); eski motor kullanılmaz.
for (const d of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(resolve(kaynaklar.cekirdek, d), resolve(hedef, 'core', d));
}
copyFileSync(kaynaklar.dil, resolve(hedef, 'lang', 'tur.traineddata.gz'));
copyFileSync(resolve(nm, 'tesseract.js', 'LICENSE.md'), resolve(hedef, 'LICENSE-tesseract.js.txt'));
copyFileSync(resolve(kaynaklar.cekirdek, 'LICENSE'), resolve(hedef, 'LICENSE-tesseract.js-core.txt'));
// Dil verisi (tessdata_best, Apache-2.0): lisans metni, çekirdeğin Apache-2.0 metniyle aynıdır.
copyFileSync(resolve(kaynaklar.cekirdek, 'LICENSE'), resolve(hedef, 'LICENSE-tessdata-tur-Apache-2.0.txt'));
console.log('OCR dosyaları (Türkçe dil verisi dahil) public/tesseract altına kopyalandı.');
