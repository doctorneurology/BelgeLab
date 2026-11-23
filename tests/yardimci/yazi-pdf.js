// Yazı düzeltme motoru testleri için yapay PDF'ler (bilinen konum/boyut/renk ile).
import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFString } from 'pdf-lib';
import { yaziTipiGom } from '../../src/core/fonts.js';
import { pngUret } from './pdf-uret.js';

export const KENAR = { sol: 72, sag: 523.28 };

/**
 * 3 sayfalık "kurumsal yazı":
 *  - her sayfada aynı başlık (paylaşılan form nesnesi içinde) ve "Sayfa N / 3" alt bilgisi
 *  - logo resmi + üstünde logo yazısı, çizgiler, renkli kutu
 *  - sola dayalı, ortalı, sağa dayalı ve iki yana yaslı satırlar; döndürülmüş yazı; Helvetica (gömülü değil)
 */
export async function kurumsalPdf({ imzali = false, baglanti = true } = {}) {
  const doc = await PDFDocument.create();
  const serif = await yaziTipiGom(doc, 'liberation-serif');
  const serifB = await yaziTipiGom(doc, 'liberation-serif', { kalin: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const logo = await doc.embedPng(pngUret(40, 40, [200, 30, 30, 255]));

  // Paylaşılan başlık: ayrı bir sayfa form nesnesi olarak gömülür, her sayfada çizilir
  const bas = await PDFDocument.create();
  const bs = await yaziTipiGom(bas, 'liberation-sans', { kalin: true });
  const bp = bas.addPage([595.28, 60]);
  bp.drawText('ÖRNEK KURUM — Bilgi İşlem Daire Başkanlığı', { x: 72, y: 25, size: 11, font: bs, color: rgb(0.1, 0.2, 0.5) });
  bp.drawLine({ start: { x: 72, y: 15 }, end: { x: 523.28, y: 15 }, thickness: 1, color: rgb(0.1, 0.2, 0.5) });
  const [basForm] = await doc.embedPdf(await bas.save());

  const govde = 'Bu satır iki yana yaslı paragrafın ilk satırıdır ve sağ kenara kadar uzanır';
  for (let i = 1; i <= 3; i++) {
    const ad = ['birinci', 'ikinci', 'üçüncü'][i - 1];
    const p = doc.addPage([595.28, 841.89]);
    p.drawPage(basForm, { x: 0, y: 770 });
    p.drawRectangle({ x: 72, y: 600, width: 451.28, height: 30, color: rgb(0.93, 0.95, 1) });
    if (i === 1) {
      p.drawImage(logo, { x: 72, y: 690, width: 60, height: 60 });
      p.drawText('LOGO', { x: 82, y: 715, size: 12, font: serifB, color: rgb(1, 1, 1) });
    }
    p.drawText(`Konu: Deneme yazısı ${ad}`, { x: 72, y: 650, size: 12, font: serif });
    const baslik = `Ortalanmış ${ad} başlık ĞÜŞİÖÇ`;
    p.drawText(baslik, { x: (595.28 - serifB.widthOfTextAtSize(baslik, 14)) / 2, y: 610, size: 14, font: serifB });
    const tarih = `Tarih (${ad}): 23.11.2026`;
    p.drawText(tarih, { x: KENAR.sag - serif.widthOfTextAtSize(tarih, 12), y: 580, size: 12, font: serif, color: rgb(0.6, 0, 0) });
    // İki yana yaslı paragraf: kelimeler, satır sağ kenarda bitecek şekilde aralıklı
    const satirlar = [`${govde} ${ad}`, `ikinci satır da yine iki yana yaslıdır ve aynı genişlikte biter ${ad}`, `son satır kısa kalır ${ad}.`];
    satirlar.forEach((s, k) => {
      const y = 540 - k * 16;
      const kel = s.split(' ');
      if (k === satirlar.length - 1) { p.drawText(s, { x: 72, y, size: 12, font: serif }); return; }
      const dolu = kel.reduce((t, w) => t + serif.widthOfTextAtSize(w, 12), 0);
      const ara = (KENAR.sag - KENAR.sol - dolu) / (kel.length - 1);
      let x = 72;
      for (const w of kel) { p.drawText(w, { x, y, size: 12, font: serif }); x += serif.widthOfTextAtSize(w, 12) + ara; }
    });
    p.drawText(`Helvetica ile yazilmis satir ${['bir', 'iki', 'uc'][i - 1]}`, { x: 72, y: 440, size: 10, font: helv });
    p.drawText('DÖNDÜRÜLMÜŞ', { x: 560, y: 300, size: 10, font: serif, rotate: degrees(90) });
    p.drawLine({ start: { x: 72, y: 420 }, end: { x: 523.28, y: 420 }, thickness: 0.5, color: rgb(0, 0, 0) });
    p.drawText(`İmza (${ad}): ____________`, { x: 380, y: 200, size: 11, font: serif });
    const alt = `Sayfa ${i} / 3`;
    p.drawText(alt, { x: (595.28 - serif.widthOfTextAtSize(alt, 9)) / 2, y: 40, size: 9, font: serif });
    if (baglanti && i === 1) {
      const a = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [72, 645, 250, 665], Border: [0, 0, 1], C: [0, 0, 1], A: { S: 'URI', URI: PDFString.of('https://example.invalid/') } });
      p.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(a)]));
    }
  }
  if (imzali) {
    const ctx = doc.context;
    const v = ctx.register(ctx.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached', Contents: PDFString.of('GIZLI-IMZA-VERISI') }));
    const alan = ctx.obj({ FT: 'Sig', T: PDFString.of('Imza1'), V: v, Type: 'Annot', Subtype: 'Widget', Rect: [380, 180, 520, 215], F: 4, P: doc.getPage(0).ref });
    const ref = ctx.register(alan);
    doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([ref]));
    doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [ref], SigFlags: 3 }));
  }
  return doc.save({ useObjectStreams: false });
}

/** Tek satırlık, verilen yazı tipiyle PDF (eşleme/uyum testleri için). */
export async function tekSatirPdf(aile, metin, { boyut = 12 } = {}) {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, aile);
  const p = doc.addPage([400, 200]);
  p.drawText(metin, { x: 50, y: 100, size: boyut, font: f });
  return doc.save();
}
