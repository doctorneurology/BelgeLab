// Testler için "taranmış belge" üretici: yazı bir RESİM olarak sayfaya konur (seçilebilir yazı YOKTUR).
import { PDFDocument } from 'pdf-lib';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';

const fontYolu = (a) => fileURLToPath(new URL(`../../public/fonts/${a}`, import.meta.url));
let kayitli = false;
function fontKaydet() {
  if (kayitli) return;
  kayitli = true;
  GlobalFonts.registerFromPath(fontYolu('liberation-serif/LiberationSerif-Regular.ttf'), 'TestSerif');
  GlobalFonts.registerFromPath(fontYolu('liberation-serif/LiberationSerif-Bold.ttf'), 'TestSerifBold');
  GlobalFonts.registerFromPath(fontYolu('liberation-sans/LiberationSans-Regular.ttf'), 'TestSans');
}

export const TARAMA_SATIRLARI = [
  'Hastanın şikâyetleri üç gündür devam etmektedir.',
  'Ağrı göğüs kafesinin sol tarafında hissedilmiş,',
  'çabucak geçmiştir. Öğleden sonra kontrol önerildi.',
  'İstanbul’da yaşayan 54 yaşındaki hasta ilaçlarını düzenli kullanıyor.',
];

/**
 * @param sayfalar  her sayfa için satır dizisi; ya da { baslik, satirlar }
 * @param secenek.dpi  tarama çözünürlüğü (varsayılan 200)
 * @param secenek.jpeg JPEG olarak göm (gerçek taramalara daha yakın)
 * @param secenek.don  sayfa döndürme (0/90/180/270)
 * @returns {{bayt:Uint8Array, kutular:object[][]}}  kutular: her sayfadaki satırların yaklaşık sayfa-noktası kutuları
 */
export async function taramaPdf(sayfalar = [TARAMA_SATIRLARI], { dpi = 200, jpeg = false, boyut = 13, genislik = 595.28, yukseklik = 841.89, arkaPlan = '#ffffff', yaziRengi = '#111111' } = {}) {
  fontKaydet();
  const doc = await PDFDocument.create();
  const olcek = dpi / 72;
  const kutular = [];
  for (const s of sayfalar) {
    const satirlar = Array.isArray(s) ? s : s.satirlar;
    const baslik = Array.isArray(s) ? null : s.baslik;
    const c = createCanvas(Math.round(genislik * olcek), Math.round(yukseklik * olcek));
    const g = c.getContext('2d');
    g.fillStyle = arkaPlan;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = yaziRengi;
    g.textBaseline = 'alphabetic';
    const sayfaKutular = [];
    let y = 110;
    if (baslik) {
      g.font = `${Math.round(boyut * 1.9 * olcek)}px TestSerifBold`;
      g.fillText(baslik, 72 * olcek, y * olcek);
      y += 44;
    }
    g.font = `${Math.round(boyut * olcek)}px TestSerif`;
    for (const satir of satirlar) {
      g.fillText(satir, 72 * olcek, y * olcek);
      const w = g.measureText(satir).width / olcek;
      sayfaKutular.push({ metin: satir, x0: 72, x1: 72 + w, taban: y, y0: yukseklik - y - boyut * 0.25, y1: yukseklik - y + boyut * 0.8 });
      y += boyut * 1.9;
    }
    kutular.push(sayfaKutular);
    const bayt = jpeg ? await c.encode('jpeg', 88) : await c.encode('png');
    const resim = jpeg ? await doc.embedJpg(bayt) : await doc.embedPng(bayt);
    const p = doc.addPage([genislik, yukseklik]);
    p.drawImage(resim, { x: 0, y: 0, width: genislik, height: yukseklik });
  }
  return { bayt: new Uint8Array(await doc.save()), kutular };
}

/** Küçük harf + aksan/noktalama duyarsız, boşlukları sadeleştirilmiş karşılaştırma metni. */
export function sadelestir(m) {
  return String(m).toLocaleLowerCase('tr').replace(/[’'`´]/g, '').replace(/\s+/g, ' ').trim();
}

/** 0-1 arası benzerlik (Levenshtein). */
export function benzerlik(a, b) {
  a = sadelestir(a); b = sadelestir(b);
  if (!a.length && !b.length) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}
