// Her araç için küçük bir HTML sayfası üretir (ana sayfa, hakkında ve tüm araçlar).
// Sayfaların içeriği betikler tarafından doldurulur; bu dosyalar yalnızca "kabuk"tur.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARACLAR, SITE_ADI, SLOGAN } from '../src/araclar.js';

const kok = resolve(import.meta.dirname, '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function sayfa({ dosya, baslik, aciklama, betik }) {
  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(baslik)}</title>
  <meta name="description" content="${esc(aciklama)}">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./src/stil.css">
</head>
<body>
  <div id="uygulama"></div>
  <noscript><p style="padding:16px">Bu site çalışmak için JavaScript gerektirir. Dosyalarınız yine de cihazınızdan çıkmaz.</p></noscript>
  <script type="module" src="${betik}"></script>
</body>
</html>
`;
  writeFileSync(resolve(kok, dosya), html);
}

sayfa({ dosya: 'index.html', baslik: `${SITE_ADI} — tarayıcıda çalışan, gizli ve ücretsiz`, aciklama: SLOGAN, betik: './src/ana.js' });
sayfa({ dosya: 'pdf.html', baslik: `PDF düzenleme — ${SITE_ADI}`, aciklama: 'PDF araçları', betik: './src/pdf-sayfasi.js' });
sayfa({ dosya: 'excel.html', baslik: `Excel düzenleme — ${SITE_ADI}`, aciklama: 'Excel araçları', betik: './src/excel-sayfasi.js' });
sayfa({ dosya: 'diger.html', baslik: `Diğer editörler — ${SITE_ADI}`, aciklama: 'Markdown/HTML editörü ve resim araçları', betik: './src/diger-sayfasi.js' });
sayfa({ dosya: 'hakkinda.html', baslik: `İlkeler ve gizlilik — ${SITE_ADI}`, aciklama: 'Gizlilik ilkeleri ve yapmadığımız şeyler.', betik: './src/hakkinda.js' });
sayfa({ dosya: 'hafiza.html', baslik: `Hafıza — ${SITE_ADI}`, aciklama: 'Ürettiğiniz çıktıların bu tarayıcıdaki kayıtlı kopyaları.', betik: './src/hafiza-sayfasi.js' });
for (const a of ARACLAR) {
  sayfa({ dosya: `${a.slug}.html`, baslik: `${a.ad} — ${SITE_ADI}`, aciklama: a.kisa, betik: `./src/sayfalar/${a.slug}.js` });
}
console.log(`${ARACLAR.length + 6} HTML sayfası üretildi.`);
