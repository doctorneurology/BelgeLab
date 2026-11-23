// PDF→Word testleri için yapay (ama gerçekçi) belgeler. Kişisel örnek dosyalara bağımlı değildir.
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { yaziTipiGom } from '../../src/core/fonts.js';
import { pngUret } from './pdf-uret.js';

export const A4 = [595.28, 841.89];

/** Metni verilen genişliğe sığacak satırlara böler. */
export function satirla(font, metin, boyut, genislik) {
  const kelimeler = metin.split(' ');
  const satirlar = [];
  let s = '';
  for (const k of kelimeler) {
    const dene = s ? `${s} ${k}` : k;
    if (font.widthOfTextAtSize(dene, boyut) > genislik && s) { satirlar.push(s); s = k; } else s = dene;
  }
  if (s) satirlar.push(s);
  return satirlar;
}

const UZUN_1 = 'Kalp ve damar hastalıkları dünyada ölümlerin en önemli nedenlerinden biri olmaya devam etmektedir. Bu çalışmada hastaların yaş, cinsiyet ve laboratuvar değerleri incelenmiş, sonuçlar tablo hâlinde sunulmuştur. Elde edilen bulgular literatürle karşılaştırılmıştır.';
const UZUN_2 = 'Çalışmaya alınan hastaların büyük çoğunluğu düzenli kontrole gelmiştir. Ancak takip süresi kısa olduğu için uzun dönem sonuçlar hakkında kesin bir yargıya varmak mümkün değildir. Daha geniş serilerle yapılacak araştırmalara ihtiyaç vardır.';

/**
 * Çok sayfalı, gerçekçi bir belge: başlık, paragraflar (tireli satır sonu dahil), alt başlık, madde işaretleri,
 * resim, tablo, sayfa numarası + tekrarlayan üst bilgi ve sayfalar arası devam eden bir paragraf.
 */
export async function wordTestPdf({ sayfa = 3 } = {}) {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, 'liberation-sans');
  const fk = await yaziTipiGom(doc, 'liberation-sans', { kalin: true });
  const fi = await yaziTipiGom(doc, 'liberation-sans', { italik: true });
  const img = await doc.embedPng(pngUret(60, 40, [200, 30, 30, 255]));
  const [W, H] = A4;
  const sol = 72, genis = W - 144;
  const sayfalar = [];
  for (let i = 1; i <= sayfa; i++) {
    const p = doc.addPage([W, H]);
    sayfalar.push(p);
    p.drawText('Örnek Kurum Bülteni', { x: sol, y: H - 40, size: 9, font: fi, color: rgb(0.4, 0.4, 0.4) }); // tekrarlayan üst bilgi
    p.drawText(`Sayfa ${i}`, { x: W / 2 - 15, y: 40, size: 9, font: f });
  }
  const p1 = sayfalar[0];
  let y = H - 100;
  p1.drawText('Kardiyoloji Çalışması Raporu', { x: sol, y, size: 24, font: fk });
  y -= 44;
  for (const s of satirla(f, UZUN_1.replace('hâlinde', 'hâlin-de').replace('hâlin-de', 'hâlinde'), 11, genis)) { p1.drawText(s, { x: sol, y, size: 11, font: f }); y -= 15; }
  // tireli satır sonu: "bölün-" / "müş"
  p1.drawText('Veriler istatistiksel olarak analiz edilmiş ve gruplara bölün-', { x: sol, y, size: 11, font: f }); y -= 15;
  p1.drawText('müş olup bulgular aşağıda özetlenmiştir.', { x: sol, y, size: 11, font: f }); y -= 34;
  p1.drawText('Bulgular ve Tartışma', { x: sol, y, size: 16, font: fk });
  y -= 28;
  for (const s of satirla(f, UZUN_2, 11, genis)) { p1.drawText(s, { x: sol, y, size: 11, font: f }); y -= 15; }
  y -= 12;
  for (const m of ['İlk madde: yaş ortalaması 58', 'İkinci madde: erkek hasta oranı yüksek', 'Üçüncü madde: ığüşöç karakter denemesi']) {
    p1.drawText('•', { x: sol, y, size: 11, font: f });
    p1.drawText(m, { x: sol + 14, y, size: 11, font: f });
    y -= 16;
  }
  y -= 14;
  p1.drawImage(img, { x: sol, y: y - 100, width: 150, height: 100 });
  y -= 128;
  // tablo: 3 sütun x 4 satır (sağa dayalı sayılar)
  const tablo = [['Grup', 'Hasta sayısı', 'Ortalama yaş'], ['Kontrol', '120', '54,2'], ['Hasta', '98', '61,7'], ['Toplam', '218', '57,6']];
  const kolX = [sol, sol + 170, sol + 340];
  for (const satir of tablo) {
    satir.forEach((h, k) => p1.drawText(h, { x: kolX[k], y, size: 11, font: f }));
    y -= 17;
  }
  y -= 22;
  // sayfa sonuna doğru, bir sonraki sayfada devam eden paragraf
  const devam = 'Sonuç olarak ilk kontrol sırasında elde edilen değerler hastaların tedavi planlaması için yeterli bilgiyi sağlamış ve özellikle risk grubundaki kişilerin erken dönemde belirlenmesine katkıda bulunmuştur; bununla birlikte';
  const dl = satirla(f, devam, 11, genis);
  dl.forEach((s) => { p1.drawText(s, { x: sol, y, size: 11, font: f }); y -= 15; });
  if (sayfa >= 2) {
    let y2 = H - 100;
    for (const s of satirla(f, 'izlem süresinin uzatılması gerekmektedir. Bu nedenle çalışma sonuçları dikkatle yorumlanmalıdır.', 11, genis)) { sayfalar[1].drawText(s, { x: sol, y: y2, size: 11, font: f }); y2 -= 15; }
  }
  return new Uint8Array(await doc.save());
}

/** Tam genişlikte başlık + iki sütunlu akan metin. */
export async function ikiSutunPdf() {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, 'liberation-serif');
  const fk = await yaziTipiGom(doc, 'liberation-serif', { kalin: true });
  const [W, H] = A4;
  const p = doc.addPage([W, H]);
  p.drawText('İki Sütunlu Makale Başlığı', { x: 72, y: H - 80, size: 20, font: fk });
  const sutunG = (W - 72 * 2 - 24) / 2;
  const sol = ['SOLSUTUN-A', UZUN_1, UZUN_2, UZUN_1, UZUN_2];
  const sag = ['SAGSUTUN-B', UZUN_2, UZUN_1, UZUN_2, UZUN_1];
  [[sol, 72], [sag, 72 + sutunG + 24]].forEach(([paragraflar, x]) => {
    let y = H - 130;
    for (const par of paragraflar) {
      for (const s of satirla(f, par, 10, sutunG)) { p.drawText(s, { x, y, size: 10, font: f }); y -= 13; }
      y -= 8;
    }
  });
  return new Uint8Array(await doc.save());
}

export async function docxOku(bayt) {
  const zip = await JSZip.loadAsync(bayt);
  const xml = await zip.file('word/document.xml').async('string');
  const paragraflar = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  const metin = (p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const medya = Object.keys(zip.files).filter((d) => d.startsWith('word/media/'));
  return { zip, xml, paragraflar, metinler: paragraflar.map(metin), medya };
}

export function pngPikseli(bayt, x = 0, y = 0) {
  const png = PNG.sync.read(Buffer.from(bayt));
  const i = (y * png.width + x) * 4;
  return { genislik: png.width, yukseklik: png.height, rgba: [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]] };
}
