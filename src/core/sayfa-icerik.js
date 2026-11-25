// Bir PDF sayfasının içeriğini (yazı parçaları ve resimler) pdf.js ile "görünür" koordinatlarda çıkarır.
// Koordinatlar: nokta (1/72 inç), orijin ekranda görünen sol-alt köşe. Word dönüştürücüsü bunu kullanır.

import { belgeAc, pdfjsOps, tuvalOlustur, tuvaliBayta } from './render.js';

const KALIN = /(bold|black|heavy|semibold|demi|extrabold|ultra|[-_,]bd\b|bdit)/i;
const ITALIK = /(italic|oblique|[-_,]it\b|kursiv|slanted)/i;
const SABIT = /(courier|mono|consolas|lucida console|typewriter|menlo)/i;
const SERIFLI = /(times|serif|georgia|cambria|garamond|minion|palatino|book|caslon|baskerville|roman|merriweather|caladea)/i;

/** "ABCDEF+Arial-BoldMT" → { ad, kalin, italik, sabit, serifli } */
export function yaziTipiOzellikleri(ad = '', ek = {}) {
  const temiz = String(ad).replace(/^[A-Z]{6}\+/, '').replace(/-\d+$/, '');
  return {
    ad: temiz,
    kalin: !!ek.bold || KALIN.test(temiz),
    italik: !!ek.italic || ITALIK.test(temiz),
    sabit: !!ek.isMonospace || SABIT.test(temiz),
    serifli: ek.isSerifFont ?? (SERIFLI.test(temiz) && !/sans/i.test(temiz)),
  };
}

const carp = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * Sayfadaki yazı parçalarını verir.
 * @returns {{genislik, yukseklik, parcalar:{metin,x0,x1,y,boyut,kalin,italik,sabit,serifli}[], dondurulmus:number}}
 *   y = taban çizgisi (alttan yukarı), dönük (yatay olmayan) yazılar atlanır ve sayılır.
 */
export async function sayfaYazilari(belge, no) {
  const sayfa = await belge.getPage(no);
  const ic = await sayfa.getTextContent();
  await sayfa.getOperatorList().catch(() => null); // yazı tipi nesnelerinin yüklenmesi için
  const sonuc = await yazilariCikar(sayfa, ic);
  sayfa.cleanup();
  return sonuc;
}

/** Zaten açılmış sayfa ve getTextContent sonucundan yazı parçalarını çıkarır (yazı tipleri yüklenmiş olmalı). */
async function yazilariCikar(sayfa, ic) {
  const vp = sayfa.getViewport({ scale: 1 });
  const t = vp.transform;
  const don = (x, y) => [t[0] * x + t[2] * y + t[4], vp.height - (t[1] * x + t[3] * y + t[5])];
  const fontOnbellek = new Map();
  const fontBilgi = (id) => {
    if (!fontOnbellek.has(id)) {
      let f = null;
      try { f = sayfa.commonObjs.get(id); } catch { /* yüklenmemiş */ }
      fontOnbellek.set(id, yaziTipiOzellikleri(f?.name ?? f?.fallbackName ?? '', f ?? {}));
    }
    return fontOnbellek.get(id);
  };
  const parcalar = [];
  let dondurulmus = 0;
  for (const o of ic.items) {
    const metin = o.str ?? '';
    if (!metin.trim()) continue;
    const [a, b, , , e, f] = o.transform;
    const boyut = Math.hypot(a, b);
    if (!(boyut > 1)) continue;
    const w = o.width || 0;
    const [x0, y0] = don(e, f);
    const [x1, y1] = don(e + (a / boyut) * w, f + (b / boyut) * w);
    if (Math.abs(y1 - y0) > 0.25 * Math.max(1, Math.abs(x1 - x0)) + 0.5 && w > boyut) { dondurulmus++; continue; }
    parcalar.push({ metin, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y: y0, boyut, ...fontBilgi(o.fontName) });
  }
  // Bağlantılar (yalnızca http/https/mailto): kesişen yazı parçalarına adres yazılır
  try {
    const ek = await sayfa.getAnnotations();
    for (const a of ek) {
      const url = a.url ?? a.unsafeUrl;
      if (a.subtype !== 'Link' || !url || !/^(https?:|mailto:)/i.test(url) || !a.rect) continue;
      const [rx0, ry0, rx1, ry1] = a.rect;
      const n = [don(rx0, ry0), don(rx1, ry1)];
      const k = { x0: Math.min(n[0][0], n[1][0]), x1: Math.max(n[0][0], n[1][0]), y0: Math.min(n[0][1], n[1][1]), y1: Math.max(n[0][1], n[1][1]) };
      for (const p of parcalar) {
        const ortaX = (p.x0 + p.x1) / 2, ortaY = p.y + p.boyut * 0.3;
        if (!p.url && ortaX >= k.x0 && ortaX <= k.x1 && ortaY >= k.y0 && ortaY <= k.y1) p.url = url;
      }
    }
  } catch { /* bağlantı okunamazsa yazı yine de aktarılır */ }
  return { genislik: vp.width, yukseklik: vp.height, parcalar, dondurulmus };
}

function nesneBekle(sayfa, id, ms = 1500) {
  // Sık kullanılan/büyük resimler pdf.js'te ortak nesne deposunda ("g_" önekli) durur
  const depo = String(id).startsWith("g_") ? sayfa.commonObjs : sayfa.objs;
  return new Promise((coz) => {
    const z = setTimeout(() => coz(null), ms);
    try { depo.get(id, (o) => { clearTimeout(z); coz(o); }); } catch { clearTimeout(z); coz(null); }
  });
}

async function resmiPngYap(o) {
  const w = o.width, h = o.height;
  if (!(w > 0 && h > 0)) return null;
  const tuval = tuvalOlustur(w, h);
  const g = tuval.getContext('2d');
  if (o.bitmap) {
    g.drawImage(o.bitmap, 0, 0, w, h);
  } else if (o.data) {
    const kare = g.createImageData(w, h);
    const d = kare.data, s = o.data;
    if (o.kind === 2) { // RGB 24 bit
      for (let i = 0, j = 0; i < w * h; i++, j += 3) { d[i * 4] = s[j]; d[i * 4 + 1] = s[j + 1]; d[i * 4 + 2] = s[j + 2]; d[i * 4 + 3] = 255; }
    } else if (o.kind === 3) { // RGBA 32 bit
      d.set(s.subarray(0, w * h * 4));
    } else if (o.kind === 1) { // 1 bit gri, satır başına bayt sınırı
      const satir = Math.ceil(w / 8);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = (s[y * satir + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
    } else return null;
    g.putImageData(kare, 0, 0);
  } else return null;
  return tuvaliBayta(tuval, 'png');
}

/**
 * Sayfadaki resimleri (konum + PNG) çıkarır. En fazla `enCok` resim, çok küçükler (< 12 pt) atlanır.
 * @returns {{resimler:{x0,y0,x1,y1,png,piksel:{g,y}}[], atlanan:number}}
 */
export async function sayfaResimleri(belge, no, secenek = {}) {
  const sayfa = await belge.getPage(no);
  const sonuc = await resimleriCikar(sayfa, await sayfa.getOperatorList(), secenek);
  sayfa.cleanup();
  return sonuc;
}

/** Zaten açılmış sayfa ve operatör listesinden resimleri çıkarır. onbellek: aynı ortak resmi (g_) tekrar PNG'leme. */
async function resimleriCikar(sayfa, ol, { enCok = 40, enAz = 12, enCokPiksel = 25_000_000, onbellek } = {}) {
  const OPS = pdfjsOps();
  const vp = sayfa.getViewport({ scale: 1 });
  const t = vp.transform;
  let ctm = [1, 0, 0, 1, 0, 0];
  const yigin = [];
  const bulunan = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], arg = ol.argsArray[i];
    if (fn === OPS.save) yigin.push(ctm);
    else if (fn === OPS.restore) ctm = yigin.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = carp(ctm, arg);
    else if (fn === OPS.paintFormXObjectBegin) { yigin.push(ctm); if (arg?.[0]) ctm = carp(ctm, arg[0]); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = yigin.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const m = carp(t, ctm); // birim kare → ekran (üstten aşağı)
      const nok = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [m[0] * u + m[2] * v + m[4], vp.height - (m[1] * u + m[3] * v + m[5])]);
      const xs = nok.map((p) => p[0]), ys = nok.map((p) => p[1]);
      const kutu = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      bulunan.push({ kutu, id: fn === OPS.paintImageXObject ? arg[0] : null, satirIci: fn === OPS.paintInlineImageXObject ? arg[0] : null });
    }
  }
  const resimler = [];
  let atlanan = 0;
  for (const b of bulunan) {
    const { kutu } = b;
    if (kutu.x1 - kutu.x0 < enAz || kutu.y1 - kutu.y0 < enAz) { atlanan++; continue; }
    if (resimler.length >= enCok) { atlanan++; continue; }
    const ortak = onbellek && b.id && String(b.id).startsWith('g_');
    let png = ortak ? onbellek.get(b.id) : null;
    let o = null;
    if (!png) {
      o = b.id ? await nesneBekle(sayfa, b.id) : b.satirIci;
      if (!o || o.width * o.height > enCokPiksel) { atlanan++; continue; }
      try { png = await resmiPngYap(o); } catch { png = null; }
      if (png && ortak) onbellek.set(b.id, { png, piksel: { g: o.width, y: o.height } });
    } else {
      // önbellekten: { png, piksel }
      resimler.push({ ...kutu, png: png.png, piksel: png.piksel });
      continue;
    }
    if (!png) { atlanan++; continue; }
    resimler.push({ ...kutu, png, piksel: { g: o.width, y: o.height } });
  }
  return { resimler, atlanan, genislik: vp.width, yukseklik: vp.height };
}

/**
 * TEK GEÇİŞTE sayfa içeriği: sayfa bir kez açılır, yazı ve operatör listesi bir kez okunur (eskiden 2-3 kez okunuyordu).
 * @returns {{yaziVar:boolean, genislik, yukseklik, yazi?:{parcalar,dondurulmus}, resim?:{resimler,atlanan}}}
 *   yaziVar=false ise (taranmış sayfa) yazı/resim çıkarılmaz; çağıran OCR yapabilir ya da tamamlamayı isteyebilir.
 */
export async function sayfaTumu(belge, no, { resim = true, onbellek, taranmisYine = false } = {}) {
  const sayfa = await belge.getPage(no);
  try {
    const vp = sayfa.getViewport({ scale: 1 });
    const ic = await sayfa.getTextContent();
    const harf = ic.items.reduce((s, o) => s + (o.str ?? '').replace(/\s+/g, '').length, 0);
    const yaziVar = harf >= 20;
    if (!yaziVar && !taranmisYine) return { yaziVar, genislik: vp.width, yukseklik: vp.height };
    const ol = await sayfa.getOperatorList().catch(() => null); // yazı tipi nesneleri için; resimler de buradan okunur
    const y = await yazilariCikar(sayfa, ic);
    const sonuc = { yaziVar, genislik: y.genislik, yukseklik: y.yukseklik, parcalar: y.parcalar, dondurulmus: y.dondurulmus };
    if (resim && ol) sonuc.resimSonuc = await resimleriCikar(sayfa, ol, { onbellek });
    else if (resim) sonuc.resimSonuc = { resimler: [], atlanan: 0 };
    return sonuc;
  } finally { sayfa.cleanup(); }
}

export { belgeAc };
