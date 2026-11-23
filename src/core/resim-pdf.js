// Resimlerden PDF üretme (PNG ve JPEG doğrudan; diğer türler arayüzde önce PNG'ye çevrilir).

import { PDFDocument, degrees } from 'pdf-lib';
import { PdfHatasi } from './hatalar.js';
import { kaydet } from './belge.js';

export const SAYFA_BOYUTLARI = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
};

export const KENAR_BOSLUKLARI = { yok: 0, kucuk: 18, orta: 36, buyuk: 54 };

/** Dosya başlığına (sihirli baytlara) bakarak türü bulur. */
export function resimTuru(bayt) {
  if (bayt.length > 8 && bayt[0] === 0x89 && bayt[1] === 0x50 && bayt[2] === 0x4e && bayt[3] === 0x47) return 'png';
  if (bayt.length > 3 && bayt[0] === 0xff && bayt[1] === 0xd8 && bayt[2] === 0xff) return 'jpeg';
  if (bayt.length > 12 && String.fromCharCode(...bayt.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bayt.subarray(8, 12)) === 'WEBP') return 'webp';
  if (bayt.length > 6 && String.fromCharCode(...bayt.subarray(0, 3)) === 'GIF') return 'gif';
  if (bayt.length > 2 && bayt[0] === 0x42 && bayt[1] === 0x4d) return 'bmp';
  return null;
}

/** JPEG'in EXIF yönelim değeri (1-8). Yoksa 1. Telefon fotoğrafları için gereklidir. */
export function jpegYonelimi(b) {
  try {
    if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
    let i = 2;
    while (i + 4 < b.length) {
      if (b[i] !== 0xff) return 1;
      const isaret = b[i + 1];
      const uzunluk = (b[i + 2] << 8) | b[i + 3];
      if (isaret === 0xe1 && String.fromCharCode(...b.subarray(i + 4, i + 8)) === 'Exif') {
        const t = i + 10; // TIFF başlığı
        const little = b[t] === 0x49;
        const u16 = (o) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
        const u32 = (o) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
          : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
        const ifd = t + u32(t + 4);
        const adet = u16(ifd);
        for (let k = 0; k < adet; k++) {
          const e = ifd + 2 + k * 12;
          if (u16(e) === 0x0112) {
            const v = u16(e + 8);
            return v >= 1 && v <= 8 ? v : 1;
          }
        }
        return 1;
      }
      if (isaret === 0xda) return 1; // görüntü verisi başladı
      i += 2 + uzunluk;
    }
  } catch { /* okunamazsa varsayılan */ }
  return 1;
}

/**
 * @param resimler [{ad, bayt}]  PNG / JPEG
 * @param secenek.sayfaBoyutu 'A4'|'A3'|'A5'|'Letter'|'Legal'|'resim'
 * @param secenek.yon 'otomatik' | 'dikey' | 'yatay'
 * @param secenek.kenar 'yok'|'kucuk'|'orta'|'buyuk'
 */
export async function resimlerdenPdf(resimler, secenek = {}) {
  const { sayfaBoyutu = 'A4', yon = 'otomatik', kenar = 'kucuk' } = secenek;
  if (!resimler?.length) throw new PdfHatasi('En az bir resim seçin.');
  if (sayfaBoyutu !== 'resim' && !SAYFA_BOYUTLARI[sayfaBoyutu]) throw new PdfHatasi('Geçersiz sayfa boyutu.');
  const doc = await PDFDocument.create();
  const uyarilar = [];

  for (const r of resimler) {
    const tur = resimTuru(r.bayt);
    let img, yonelim = 1;
    try {
      if (tur === 'png') img = await doc.embedPng(r.bayt);
      else if (tur === 'jpeg') { img = await doc.embedJpg(r.bayt); yonelim = jpegYonelimi(r.bayt); }
      else throw new PdfHatasi(`"${r.ad}": bu resim türü doğrudan desteklenmiyor (yalnızca PNG ve JPEG).`);
    } catch (e) {
      if (e instanceof PdfHatasi) throw e;
      throw new PdfHatasi(`"${r.ad}" resmi okunamadı (bozuk olabilir).`);
    }
    if ([2, 4, 5, 7].includes(yonelim)) {
      uyarilar.push(`"${r.ad}": resim aynalanmış kaydedilmiş (EXIF); ayna etkisi uygulanamadı, çıktıyı kontrol edin.`);
    }
    const dondur = [5, 6, 7, 8].includes(yonelim);
    const dw = dondur ? img.height : img.width; // ekranda görünen genişlik/yükseklik (piksel)
    const dh = dondur ? img.width : img.height;

    let sw, sh, boslukPt;
    if (sayfaBoyutu === 'resim') {
      boslukPt = 0;
      sw = dw * 0.75; sh = dh * 0.75; // 96 dpi → pt
    } else {
      boslukPt = KENAR_BOSLUKLARI[kenar] ?? 18;
      let [a, b] = SAYFA_BOYUTLARI[sayfaBoyutu];
      const yatayMi = yon === 'yatay' || (yon === 'otomatik' && dw > dh);
      [sw, sh] = yatayMi ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
    }
    const sayfa = doc.addPage([sw, sh]);
    const kw = sw - 2 * boslukPt, kh = sh - 2 * boslukPt;
    const olcek = Math.min(kw / dw, kh / dh);
    const bw = dw * olcek, bh = dh * olcek;
    const bx = (sw - bw) / 2, by = (sh - bh) / 2;
    // Görünen kutu: [bx, by, bw, bh]. Yönelime göre döndürerek çiz.
    if (yonelim === 3) sayfa.drawImage(img, { x: bx + bw, y: by + bh, width: bw, height: bh, rotate: degrees(180) });
    else if (yonelim === 6 || yonelim === 5) sayfa.drawImage(img, { x: bx, y: by + bh, width: bh, height: bw, rotate: degrees(-90) });
    else if (yonelim === 8 || yonelim === 7) sayfa.drawImage(img, { x: bx + bw, y: by, width: bh, height: bw, rotate: degrees(90) });
    else sayfa.drawImage(img, { x: bx, y: by, width: bw, height: bh });
  }
  return { bayt: await kaydet(doc), sayfaSayisi: doc.getPageCount(), uyarilar };
}
