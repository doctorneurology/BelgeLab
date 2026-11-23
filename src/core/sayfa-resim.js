// Sayfayı resme çevirme (kalıcı karartma / kalıcı düzeltme için), renk örnekleme ve sayfadaki yazı kutuları.
// Tüm koordinatlar "görünür sayfa" noktasıdır: orijin ekranda görünen sol-alt köşe, birim nokta (1/72 inç).

import { sayfaCiz, tuvaliBayta } from './render.js';
import { PdfHatasi } from './hatalar.js';

/** Dikdörtgenleri normalleştirir (x0<x1, y0<y1) ve sayfa sınırına kırpar. */
export function kutuNormalle(k, genislik, yukseklik) {
  const x0 = Math.max(0, Math.min(k.x0, k.x1));
  const x1 = Math.min(genislik, Math.max(k.x0, k.x1));
  const y0 = Math.max(0, Math.min(k.y0, k.y1));
  const y1 = Math.min(yukseklik, Math.max(k.y0, k.y1));
  if (![x0, x1, y0, y1].every(Number.isFinite)) throw new PdfHatasi('Bölge koordinatları geçersiz.');
  return { x0, x1, y0, y1 };
}

export const kesisir = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const ortanca = (d) => { d.sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; };

/** Bölgenin hemen DIŞINDAki (halka) piksellerin ortanca rengi: yazıyı örtecek zemin rengi. */
export function zeminRengi(tuval, kutu, olcek, sayfaYuksekligi) {
  const g = tuval.getContext('2d');
  const W = tuval.width, H = tuval.height;
  const px = {
    x0: Math.floor(kutu.x0 * olcek), x1: Math.ceil(kutu.x1 * olcek),
    y0: Math.floor((sayfaYuksekligi - kutu.y1) * olcek), y1: Math.ceil((sayfaYuksekligi - kutu.y0) * olcek),
  };
  const kal = Math.max(2, Math.round(olcek * 1.5));
  const aralik = [
    [px.x0 - 2 * kal, px.y0 - 2 * kal, px.x1 + 2 * kal, px.y0 - kal], // üst
    [px.x0 - 2 * kal, px.y1 + kal, px.x1 + 2 * kal, px.y1 + 2 * kal], // alt
    [px.x0 - 2 * kal, px.y0 - kal, px.x0 - kal, px.y1 + kal], // sol
    [px.x1 + kal, px.y0 - kal, px.x1 + 2 * kal, px.y1 + kal], // sağ
  ];
  const R = [], G = [], B = [];
  for (const [ax0, ay0, ax1, ay1] of aralik) {
    const x0 = Math.max(0, ax0), y0 = Math.max(0, ay0), x1 = Math.min(W, ax1), y1 = Math.min(H, ay1);
    if (x1 <= x0 || y1 <= y0) continue;
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    for (let i = 0; i < d.length; i += 4) { R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); }
  }
  if (!R.length) return '#ffffff';
  return hex(ortanca(R), ortanca(G), ortanca(B));
}

/** Bölgenin İÇİndeki en koyu piksellerin ortalaması: eski yazının rengi (yeni yazı için öneri). */
export function yaziRengiTahmin(tuval, kutu, olcek, sayfaYuksekligi, zemin = '#ffffff') {
  const g = tuval.getContext('2d');
  const x0 = Math.max(0, Math.floor(kutu.x0 * olcek)), x1 = Math.min(tuval.width, Math.ceil(kutu.x1 * olcek));
  const y0 = Math.max(0, Math.floor((sayfaYuksekligi - kutu.y1) * olcek)), y1 = Math.min(tuval.height, Math.ceil((sayfaYuksekligi - kutu.y0) * olcek));
  if (x1 <= x0 || y1 <= y0) return '#000000';
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11]);
  px.sort((a, b) => a[3] - b[3]);
  const n = Math.max(1, Math.floor(px.length * 0.05));
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < n; i++) { r += px[i][0]; gg += px[i][1]; b += px[i][2]; }
  const renk = hex(r / n, gg / n, b / n);
  const zl = parseInt(zemin.slice(1), 16);
  const zlum = (((zl >> 16) & 255) * 0.3) + (((zl >> 8) & 255) * 0.59) + ((zl & 255) * 0.11);
  const lum = px[0][3];
  return Math.abs(zlum - lum) < 60 ? '#000000' : renk; // yeterince koyu yazı bulunamadıysa siyah
}

/**
 * Sayfayı (ekranda göründüğü gibi) çizer, verilen bölgeleri düz renkle BOYAR ve resim baytlarını verir.
 * Boyanan pikseller kalıcı olarak yok edilir: eski içerik bu resimde yoktur.
 * @param kutular [{x0,y0,x1,y1,renk}]
 */
export async function sayfayiResmeCevir(belge, no, { dpi = 200, kutular = [], bicim = 'jpeg', kalite = 0.9 } = {}) {
  const sayfa = await belge.getPage(no);
  const vp = sayfa.getViewport({ scale: 1 });
  sayfa.cleanup();
  const olcek = dpi / 72;
  const { tuval } = await sayfaCiz(belge, no, { olcek });
  const g = tuval.getContext('2d');
  for (const k of kutular) {
    g.fillStyle = k.renk ?? '#000000';
    // 1 piksellik taşma: kenardaki yarı saydam (kenar yumuşatma) pikselleri de yok eder
    const x = Math.floor(k.x0 * olcek) - 1, y = Math.floor((vp.height - k.y1) * olcek) - 1;
    const w = Math.ceil((k.x1 - k.x0) * olcek) + 3, h = Math.ceil((k.y1 - k.y0) * olcek) + 3;
    g.fillRect(x, y, w, h);
  }
  const bayt = await tuvaliBayta(tuval, bicim, kalite);
  return { bayt, bicim, genislik: vp.width, yukseklik: vp.height, piksel: { g: tuval.width, y: tuval.height } };
}

/**
 * Sayfadaki yazı parçalarının (pdf.js "text item") görünür kutuları. Gerçek yazı da OCR katmanı da gelir.
 * Her parça tek bir kutu olarak verilir (kelime içi ayrım yok); amaç "karartılacak alanla kesişiyor mu?" sorusuna
 * temkinli (fazla kapsayıcı) cevap vermektir.
 */
export async function sayfaYaziKutulari(belge, no) {
  const sayfa = await belge.getPage(no);
  const vp = sayfa.getViewport({ scale: 1 });
  const ic = await sayfa.getTextContent();
  sayfa.cleanup();
  const t = vp.transform;
  const don = (x, y) => [t[0] * x + t[2] * y + t[4], vp.height - (t[1] * x + t[3] * y + t[5])];
  const sonuc = [];
  for (const o of ic.items) {
    const metin = o.str ?? '';
    if (!metin.trim()) continue;
    const [a, b, , , e, f] = o.transform;
    const uzun = Math.hypot(a, b) || 1;
    const yuk = o.height || uzun;
    const [ux, uy] = [a / uzun, b / uzun];
    const w = o.width || 0;
    // s: taban çizgisi boyunca, v: taban çizgisine dik (yukarı +). Temkinli: yukarı 1.0, aşağı 0.3 yazı boyutu.
    const P = (s, v) => don(e + ux * s - uy * v, f + uy * s + ux * v);
    const noktalar = [P(0, -0.3 * yuk), P(w, -0.3 * yuk), P(0, yuk), P(w, yuk)];
    const xs = noktalar.map((p) => p[0]), ys = noktalar.map((p) => p[1]);
    sonuc.push({ metin, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), boyut: yuk });
  }
  return sonuc;
}
