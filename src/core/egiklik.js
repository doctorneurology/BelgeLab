// Taranmış sayfa eğikliği: açıyı bulur (yatay izdüşüm keskinliği) ve resmi düzeltir. Tarayıcıda ve Node'da aynı kod çalışır.
import { tuvalOlustur } from './render.js';

/** Otsu eşiği (0-255 gri düzeyi histogramından). */
function otsu(hist, toplam) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, enIyi = 0, esik = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = toplam - wB; if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > enIyi) { enIyi = v; esik = i; }
  }
  return esik;
}

/**
 * Sayfanın eğiklik açısı. Dönen değer, resme `tuvaliDondur(tuval, aci)` ile UYGULANINCA yazıyı yatay yapacak açıdır (derece, saat yönü +).
 * @returns {{aci:number, guven:number}}  guven: eğik/düz keskinlik oranı (1'e yakınsa belirsiz; sayfada yazı yoksa aci=0)
 */
export function egiklikAcisi(tuval, { enBuyuk = 6 } = {}) {
  const k = Math.min(1, 800 / tuval.width);
  const w = Math.max(8, Math.round(tuval.width * k)), h = Math.max(8, Math.round(tuval.height * k));
  const kucuk = tuvalOlustur(w, h);
  const g = kucuk.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(tuval, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const gri = new Uint8Array(w * h), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) { const v = (d[j] * 77 + d[j + 1] * 151 + d[j + 2] * 28) >> 8; gri[i] = v; hist[v]++; }
  const esik = Math.min(otsu(hist, w * h), 200);
  const xs = [], ys = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (gri[y * w + x] < esik) { xs.push(x - w / 2); ys.push(y - h / 2); }
  if (xs.length < 200) return { aci: 0, guven: 1 };
  const adim = Math.max(1, Math.floor(xs.length / 90000)); // en çok ~90 bin nokta
  const skor = (derece) => {
    const r = (derece * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r);
    const kutu = new Float64Array(h * 2 + 8);
    for (let i = 0; i < xs.length; i += adim) { const yy = Math.round(xs[i] * sn + ys[i] * cs + h); if (yy >= 0 && yy < kutu.length) kutu[yy]++; }
    let t = 0; for (let i = 0; i < kutu.length; i++) t += kutu[i] * kutu[i];
    return t;
  };
  let en = 0, enSkor = -1;
  for (let a = -enBuyuk; a <= enBuyuk + 1e-9; a += 0.5) { const s = skor(a); if (s > enSkor) { enSkor = s; en = a; } }
  for (let a = en - 0.5; a <= en + 0.5 + 1e-9; a += 0.1) { const s = skor(a); if (s > enSkor) { enSkor = s; en = a; } }
  const duz = skor(0);
  return { aci: Math.round(en * 10) / 10, guven: enSkor / Math.max(1, duz) };
}

/** Tuvali merkez etrafında `derece` (saat yönü +) döndürür; boşluklar köşe rengiyle dolar. Boyut aynı kalır. */
export function tuvaliDondur(tuval, derece) {
  const w = tuval.width, h = tuval.height;
  const yeni = tuvalOlustur(w, h);
  const g = yeni.getContext('2d');
  const p = tuval.getContext('2d').getImageData(2, 2, 1, 1).data;
  g.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2); g.rotate((derece * Math.PI) / 180); g.drawImage(tuval, -w / 2, -h / 2);
  return yeni;
}
