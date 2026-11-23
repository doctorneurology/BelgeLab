// README'deki ekran görüntüleri için YER TUTUCU resimler üretir (docs/ekran-goruntuleri/*.png).
// Gerçek ekran görüntüsü aldığınızda aynı adla bu dosyaların üzerine kaydedin; README değişmeden çalışır.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const kok = resolve(import.meta.dirname, '..');
GlobalFonts.registerFromPath(resolve(kok, 'public/fonts/liberation-sans/LiberationSans-Regular.ttf'), 'YT');
GlobalFonts.registerFromPath(resolve(kok, 'public/fonts/liberation-sans/LiberationSans-Bold.ttf'), 'YTB');
const klasor = resolve(kok, 'docs/ekran-goruntuleri');
mkdirSync(klasor, { recursive: true });

const liste = [
  ['ana-sayfa', 'Ana sayfa'], ['ocr', 'OCR: taranmış PDF’i aranabilir yap'], ['taranmis-duzelt', 'Taranmış belgede yazı düzelt'],
  ['pdf-word', 'PDF → Word'], ['sikistir', 'PDF sıkıştır'], ['karart', 'Karart (gerçek silme)'], ['yazi-duzelt', 'Yazı düzelt'],
];
for (const [dosya, baslik] of liste) {
  const yol = resolve(klasor, `${dosya}.png`);
  if (existsSync(yol) && !process.argv.includes('--zorla')) continue; // gerçek görüntünün üzerine yazma
  const c = createCanvas(1280, 720);
  const g = c.getContext('2d');
  g.fillStyle = '#eef0f4'; g.fillRect(0, 0, 1280, 720);
  g.strokeStyle = '#b9c0cf'; g.setLineDash([14, 10]); g.lineWidth = 3; g.strokeRect(24, 24, 1232, 672);
  g.fillStyle = '#5a6272'; g.textAlign = 'center';
  g.font = '56px YTB'; g.fillText(baslik, 640, 320);
  g.font = '34px YT'; g.fillText('Ekran görüntüsü eklenecek', 640, 390);
  g.font = '26px YT'; g.fillText(`docs/ekran-goruntuleri/${dosya}.png`, 640, 440);
  writeFileSync(yol, new Uint8Array(c.encodeSync('png')));
}
console.log('Yer tutucu resimler hazır:', klasor);
