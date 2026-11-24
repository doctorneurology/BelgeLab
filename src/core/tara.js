// "PDF'e Tara": kamera/galeri fotoğraflarını belge taraması gibi iyileştirip (gri, kontrast, siyah-beyaz, renkli düzeltme)
// döndürerek PDF'e çevirir. Tamamen cihazda; hiçbir şey gönderilmez. İstenirse çıktı OCR ile aranabilir yapılabilir (ocr.js).
//
// DÜRÜSTLÜK: Belge kenarını otomatik bulup perspektifi düzeltme (kağıdı "kırpma") YOKTUR; fotoğrafı belgeyi dolduracak şekilde
// çekin ya da önce "Kırp" aracını kullanın. Siyah-beyaz kipi renkli/fotoğraflı belgeleri bozar.

import { resimCoz, tuvalOlustur, tuvaliBayta } from './render.js';
import { resimlerdenPdf } from './resim-pdf.js';
import { PdfHatasi } from './hatalar.js';

export const MODLAR = {
  ozgun: 'Olduğu gibi',
  gri: 'Gri tonlama',
  kontrast: 'Belge (gri + kontrast artırma)',
  'siyah-beyaz': 'Siyah-beyaz (yazılı belgeler için, en küçük dosya)',
  renkli: 'Renkli belge (renk dengesi + kontrast)',
};

function yuzdelik(hist, toplam, oran) {
  let t = 0;
  for (let i = 0; i < 256; i++) { t += hist[i]; if (t >= toplam * oran) return i; }
  return 255;
}

/** RGBA verisini yerinde iyileştirir. */
export function pikselleriIyilestir(veri, w, h, mod) {
  if (mod === 'ozgun') return;
  const n = w * h;
  const gri = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) gri[i] = veri[i * 4] * 0.299 + veri[i * 4 + 1] * 0.587 + veri[i * 4 + 2] * 0.114;
  if (mod === 'renkli') {
    for (let k = 0; k < 3; k++) {
      const hist = new Uint32Array(256);
      for (let i = 0; i < n; i++) hist[veri[i * 4 + k]]++;
      const lo = yuzdelik(hist, n, 0.01), hi = Math.max(lo + 8, yuzdelik(hist, n, 0.995));
      for (let i = 0; i < n; i++) veri[i * 4 + k] = Math.max(0, Math.min(255, ((veri[i * 4 + k] - lo) / (hi - lo)) * 255));
    }
    return;
  }
  if (mod === 'gri') {
    for (let i = 0; i < n; i++) { veri[i * 4] = veri[i * 4 + 1] = veri[i * 4 + 2] = gri[i]; }
    return;
  }
  // kontrast ve siyah-beyaz: önce histogram germe
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[gri[i]]++;
  const lo = yuzdelik(hist, n, 0.02), hi = Math.max(lo + 8, yuzdelik(hist, n, 0.98));
  for (let i = 0; i < n; i++) gri[i] = Math.max(0, Math.min(255, ((gri[i] - lo) / (hi - lo)) * 255));
  if (mod === 'kontrast') {
    for (let i = 0; i < n; i++) { veri[i * 4] = veri[i * 4 + 1] = veri[i * 4 + 2] = gri[i]; }
    return;
  }
  // siyah-beyaz: Bradley uyarlanabilir eşik (düzensiz ışıkta da çalışır)
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let satirToplam = 0;
    for (let x = 0; x < w; x++) {
      satirToplam += gri[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + satirToplam;
    }
  }
  const s = Math.max(8, Math.round(w / 16)), t = 0.15;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - s), y1 = Math.min(h - 1, y + s);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - s), x1 = Math.min(w - 1, x + s);
      const say = (x1 - x0 + 1) * (y1 - y0 + 1);
      const toplam = integral[(y1 + 1) * (w + 1) + x1 + 1] - integral[y0 * (w + 1) + x1 + 1] - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const v = gri[y * w + x] * say <= toplam * (1 - t) ? 0 : 255;
      const i = (y * w + x) * 4;
      veri[i] = veri[i + 1] = veri[i + 2] = v;
    }
  }
}

/**
 * @param resimler [{ ad, bayt, don?: 0|90|180|270 }]  (JPEG, PNG; tarayıcıda tarayıcının çözebildiği her tür)
 * @param secenek.mod        MODLAR anahtarı (varsayılan 'kontrast')
 * @param secenek.enCokKenar uzun kenar bu pikselden büyükse küçültülür (varsayılan 2600 ≈ A4'te 220 dpi)
 */
export async function taraPdf(resimler, { mod = 'kontrast', sayfaBoyutu = 'A4', yon = 'otomatik', kenar = 'yok', kalite = 0.85, enCokKenar = 2600, ilerleme } = {}) {
  if (!MODLAR[mod]) throw new PdfHatasi('Geçersiz tarama kipi.');
  if (!resimler?.length) throw new PdfHatasi('En az bir fotoğraf/resim seçin.');
  const hazir = [];
  for (let i = 0; i < resimler.length; i++) {
    const r = resimler[i];
    ilerleme?.(i, resimler.length, `“${r.ad}” iyileştiriliyor…`);
    let c;
    try { c = await resimCoz(r.bayt); } catch { throw new PdfHatasi(`“${r.ad}” resim olarak okunamadı.`); }
    const don = ((r.don ?? 0) % 360 + 360) % 360;
    if (don % 90) throw new PdfHatasi('Döndürme 90’ın katı olmalı.');
    const olcek = Math.min(1, enCokKenar / Math.max(c.genislik, c.yukseklik));
    const sw = Math.max(1, Math.round(c.genislik * olcek)), sh = Math.max(1, Math.round(c.yukseklik * olcek));
    const yan = don === 90 || don === 270;
    const tuval = tuvalOlustur(yan ? sh : sw, yan ? sw : sh);
    const g = tuval.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, tuval.width, tuval.height);
    g.save();
    g.translate(tuval.width / 2, tuval.height / 2);
    g.rotate((don * Math.PI) / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(c.cizilebilir, -sw / 2, -sh / 2, sw, sh);
    g.restore();
    const kare = g.getImageData(0, 0, tuval.width, tuval.height);
    pikselleriIyilestir(kare.data, tuval.width, tuval.height, mod);
    g.putImageData(kare, 0, 0);
    hazir.push({ ad: r.ad, bayt: await tuvaliBayta(tuval, mod === 'siyah-beyaz' ? 'png' : 'jpeg', kalite) });
  }
  const pdf = await resimlerdenPdf(hazir, { sayfaBoyutu, yon, kenar });
  return {
    bayt: pdf.bayt, sayfaSayisi: pdf.sayfaSayisi,
    uyarilar: [...pdf.uyarilar, 'Belge kenarı otomatik bulunmaz/perspektif düzeltilmez; belgeyi karenin içini doldurur şekilde çekin ya da önce “Kırp” aracını kullanın.',
      ...(mod === 'siyah-beyaz' ? ['Siyah-beyaz kipi fotoğraf/renkli içeriği bozar; yalnızca yazılı belgeler için uygundur.'] : [])],
  };
}
