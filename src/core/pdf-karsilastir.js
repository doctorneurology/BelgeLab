// PDF karşılaştırma: iki PDF'in sayfalarını piksel piksel (görsel) ve sözcük sözcük (metin) karşılaştırır.
// Görsel fark: eskide olup yenide olmayan KIRMIZI, yenide olup eskide olmayan CAMGÖBEĞİ, ortak olan açık gri gösterilir.
// Boyutu farklı sayfalarda yeni sayfa eskinin boyutuna ölçeklenir (bu durumda görsel fark güvenilir değildir; uyarı verilir).

import { belgeAc, sayfaCiz, tuvalOlustur } from './render.js';
import { sayfaSecimi } from './util.js';
import { PdfHatasi } from './hatalar.js';

async function sayfaMetni(belge, no) {
  const s = await belge.getPage(no);
  const ic = await s.getTextContent();
  s.cleanup();
  return ic.items.map((o) => o.str).join(' ').split(/\s+/).filter(Boolean);
}

/** Sözcük dizileri arası fark (LCS). Çok uzun sayfalarda ilk 3000 sözcükle sınırlıdır (bellek). */
export function sozcukFarki(a, b, sinir = 3000) {
  const A = a.slice(0, sinir), B = b.slice(0, sinir);
  const n = A.length, m = B.length;
  const satir = new Uint32Array((m + 1) * (n + 1));
  const ix = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) satir[ix(i, j)] = A[i] === B[j] ? satir[ix(i + 1, j + 1)] + 1 : Math.max(satir[ix(i + 1, j)], satir[ix(i, j + 1)]);
  const silinen = [], eklenen = [];
  let i = 0, j = 0, curS = [], curE = [];
  const bosalt = () => { if (curS.length) silinen.push(curS.join(' ')); if (curE.length) eklenen.push(curE.join(' ')); curS = []; curE = []; };
  while (i < n && j < m) {
    if (A[i] === B[j]) { bosalt(); i++; j++; } else if (satir[ix(i + 1, j)] >= satir[ix(i, j + 1)]) curS.push(A[i++]); else curE.push(B[j++]);
  }
  while (i < n) curS.push(A[i++]);
  while (j < m) curE.push(B[j++]);
  bosalt();
  return { silinen, eklenen, kesildi: a.length > sinir || b.length > sinir };
}

function tuvalPikselleri(tuval) {
  return tuval.getContext('2d').getImageData(0, 0, tuval.width, tuval.height);
}

/**
 * @param secenek.dpi        çizim çözünürlüğü (varsayılan 100)
 * @param secenek.esik       renk farkı eşiği (0-255 gri düzeyi; varsayılan 40)
 * @param secenek.bindirme   true → her sayfa için üst üste görüntü (RGBA) üretilir
 * @returns {{sayfalar:{no, pikselFark, oran, boyutFarkli, metin:{silinen,eklenen}, bindirme?}[], ozet, uyarilar}}
 */
export async function pdfKarsilastir(eskiBayt, yeniBayt, { dpi = 100, esik = 40, bindirme = true, sayfalar = '', ilerleme } = {}) {
  const eski = await belgeAc(eskiBayt), yeni = await belgeAc(yeniBayt);
  try {
    const n = Math.min(eski.numPages, yeni.numPages);
    const uyarilar = [];
    if (eski.numPages !== yeni.numPages) uyarilar.push(`Sayfa sayıları farklı: eski ${eski.numPages}, yeni ${yeni.numPages}. Yalnızca ilk ${n} sayfa karşılaştırıldı; ${eski.numPages > yeni.numPages ? 'eskideki fazla sayfalar silinmiş' : 'yenideki fazla sayfalar eklenmiş'}.`);
    const secili = sayfaSecimi(sayfalar, n);
    const sonuc = [];
    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      ilerleme?.(k, secili.length, `Sayfa ${no} karşılaştırılıyor…`);
      const a = await sayfaCiz(eski, no, { olcek: dpi / 72 });
      const b0 = await sayfaCiz(yeni, no, { olcek: dpi / 72 });
      let bT = b0.tuval, boyutFarkli = false;
      if (b0.genislik !== a.genislik || b0.yukseklik !== a.yukseklik) {
        boyutFarkli = true;
        bT = tuvalOlustur(a.genislik, a.yukseklik);
        const g = bT.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, a.genislik, a.yukseklik);
        g.drawImage(b0.tuval, 0, 0, a.genislik, a.yukseklik);
      }
      const A = tuvalPikselleri(a.tuval), B = tuvalPikselleri(bT);
      const veri = bindirme ? new Uint8ClampedArray(A.data.length) : null;
      let fark = 0, x0 = a.genislik, y0 = a.yukseklik, x1 = -1, y1 = -1;
      const w = a.genislik;
      for (let i = 0, p = 0; i < A.data.length; i += 4, p++) {
        const la = A.data[i] * 0.3 + A.data[i + 1] * 0.59 + A.data[i + 2] * 0.11;
        const lb = B.data[i] * 0.3 + B.data[i + 1] * 0.59 + B.data[i + 2] * 0.11;
        const d = la - lb;
        let r, g, bl;
        if (Math.abs(d) > esik) {
          fark++;
          const px = p % w, py = (p / w) | 0;
          if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
          if (d < 0) { r = 230; g = 40; bl = 40; } else { r = 20; g = 190; bl = 210; } // d<0: eski koyu (yalnız eskide)
        } else { const gri = 255 - (255 - la) * 0.25; r = g = bl = gri; }
        if (veri) { veri[i] = r; veri[i + 1] = g; veri[i + 2] = bl; veri[i + 3] = 255; }
      }
      const metin = sozcukFarki(await sayfaMetni(eski, no), await sayfaMetni(yeni, no));
      sonuc.push({
        no, pikselFark: fark, oran: fark / (a.genislik * a.yukseklik), boyutFarkli, metin,
        kutu: fark ? { x0, y0, x1, y1, olcek: dpi / 72 } : null,
        bindirme: veri ? { genislik: a.genislik, yukseklik: a.yukseklik, veri } : undefined,
      });
    }
    const farkli = sonuc.filter((s) => s.pikselFark > 0 || s.metin.silinen.length || s.metin.eklenen.length);
    if (sonuc.some((s) => s.boyutFarkli)) uyarilar.push('Bazı sayfaların boyutu farklı; yeni sayfa eskinin boyutuna ölçeklendi, görsel fark güvenilir değildir.');
    if (sonuc.some((s) => s.metin.kesildi)) uyarilar.push('Çok uzun sayfalarda metin karşılaştırması ilk 3000 sözcükle sınırlandı.');
    uyarilar.push('Metin karşılaştırması PDF içindeki seçilebilir yazıya dayanır; taranmış (resim) sayfalarda yalnızca görsel fark anlamlıdır.');
    return { sayfalar: sonuc, ozet: { karsilastirilan: sonuc.length, farkliSayfa: farkli.length, ayniMi: farkli.length === 0 && eski.numPages === yeni.numPages, eskiSayfa: eski.numPages, yeniSayfa: yeni.numPages }, uyarilar };
  } finally {
    await eski.kapat(); await yeni.kapat();
  }
}

export { PdfHatasi };
