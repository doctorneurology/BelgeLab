import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { gorunurDonusum, noktaDonustur } from './cizim.js';
import { sayfaSecimi } from './util.js';

/**
 * Sayfaları kırpar: sayfanın GÖRÜNEN kenarlarından (ekranda gördüğünüz üst/alt/sol/sağ) verilen miktarda (pt) keser.
 * Yalnızca "görünür alan" (CropBox) değiştirilir.
 */
export async function kirp(bayt, { ust = 0, alt = 0, sol = 0, sag = 0, sayfalar = '' }) {
  for (const [ad, d] of Object.entries({ ust, alt, sol, sag })) {
    if (!(d >= 0)) throw new PdfHatasi(`Kırpma değeri (${ad}) negatif olamaz.`);
  }
  if (!(ust || alt || sol || sag)) throw new PdfHatasi('Kırpılacak bir miktar girin.');
  const doc = await pdfAc(bayt);
  const secili = sayfaSecimi(sayfalar, doc.getPageCount());
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');

  for (const i of secili) {
    const page = doc.getPage(i);
    const g = gorunurDonusum(page);
    const x0 = sol, y0 = alt, x1 = g.vw - sag, y1 = g.vh - ust;
    if (x1 - x0 < 10 || y1 - y0 < 10) {
      throw new PdfHatasi(`Sayfa ${i + 1}: kırpma sayfadan büyük; geriye en az 10 pt kalmalı.`);
    }
    const koseler = [noktaDonustur(g.m, x0, y0), noktaDonustur(g.m, x1, y0), noktaDonustur(g.m, x0, y1), noktaDonustur(g.m, x1, y1)];
    const xs = koseler.map((k) => k[0]), ys = koseler.map((k) => k[1]);
    const ax = Math.min(...xs), ay = Math.min(...ys);
    page.setCropBox(ax, ay, Math.max(...xs) - ax, Math.max(...ys) - ay);
  }
  uyarilar.push(
    'Kırpılan bölgedeki içerik dosyadan silinmez, yalnızca görünmez olur. Gizli kalması gereken bilgileri kırparak saklamayın.',
  );
  return { bayt: await kaydet(doc), sayfaSayisi: doc.getPageCount(), islenen: secili.length, uyarilar };
}
