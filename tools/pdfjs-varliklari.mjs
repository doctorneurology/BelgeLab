// pdf.js'in çalışması için gereken yardımcı dosyaları (yazı tipleri, karakter haritaları, wasm) public/pdfjs'e kopyalar.
// Bu klasör git'e eklenmez; her "npm run dev / build" öncesinde otomatik yeniden üretilir.
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const kok = resolve(import.meta.dirname, '..');
const kaynak = resolve(kok, 'node_modules', 'pdfjs-dist');
const hedef = resolve(kok, 'public', 'pdfjs');

if (!existsSync(kaynak)) {
  console.error('pdfjs-dist bulunamadı. Önce "npm install" çalıştırın.');
  process.exit(1);
}
rmSync(hedef, { recursive: true, force: true });
mkdirSync(hedef, { recursive: true });
for (const d of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) {
  if (existsSync(resolve(kaynak, d))) cpSync(resolve(kaynak, d), resolve(hedef, d), { recursive: true });
}
cpSync(resolve(kaynak, 'LICENSE'), resolve(hedef, 'LICENSE-pdfjs.txt'));
console.log('pdf.js yardımcı dosyaları public/pdfjs altına kopyalandı.');

// PDFium (EmbedPDF derlemesi, WASM): PDF → Word "Düzeni koru" kipi için. WASM dosyasını Vite paketler (src/ui/ortam.js); burada yalnızca lisans metinleri kopyalanır.
const pdfiumKaynak = resolve(kok, 'node_modules', '@embedpdf', 'pdfium');
const pdfiumHedef = resolve(kok, 'public', 'pdfium');
if (existsSync(resolve(pdfiumKaynak, 'dist', 'pdfium.wasm'))) {
  rmSync(pdfiumHedef, { recursive: true, force: true });
  mkdirSync(pdfiumHedef, { recursive: true });
  for (const l of ['LICENSE', 'LICENSE.pdfium']) if (existsSync(resolve(pdfiumKaynak, l))) cpSync(resolve(pdfiumKaynak, l), resolve(pdfiumHedef, `LICENSE-embedpdf-${l}.txt`));
  console.log('PDFium lisans metinleri public/pdfium altına kopyalandı (wasm dosyası derlemeye kendiliğinden girer).');
}
