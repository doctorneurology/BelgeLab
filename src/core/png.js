// Hızlı PNG yazıcı. Tarayıcının canvas.toBlob("image/png") kodlaması büyük resimlerde çok yavaştır (resim başına 0,5-1 sn,
// ana iş parçacığını da meşgul eder). Burada ham pikseller doğrudan PNG'ye çevrilir ve sıkıştırma ayrı iş parçacığında
// (fflate işçisi) yapılır; böylece birçok resim aynı anda, ana sayfa donmadan kodlanır. Çıktı KAYIPSIZDIR (piksel piksel aynı);
// dosya, tarayıcının en iyi sıkıştırmalı PNG'sinden biraz büyük olabilir.
import { zlib, zlibSync } from 'fflate';
import { crc32 } from './zip.js';

const IMZA = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

function parca(tur, veri) {
  const b = new Uint8Array(12 + veri.length);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, veri.length);
  for (let i = 0; i < 4; i++) b[4 + i] = tur.charCodeAt(i);
  b.set(veri, 8);
  dv.setUint32(8 + veri.length, crc32(b.subarray(4, 8 + veri.length)));
  return b;
}

const SEKILLER = {
  gri1: { renkTuru: 0, derinlik: 1, satirBayt: (w) => Math.ceil(w / 8) }, // 1 bit gri (1 = beyaz)
  rgb: { renkTuru: 2, derinlik: 8, satirBayt: (w) => w * 3 },
  rgba: { renkTuru: 6, derinlik: 8, satirBayt: (w) => w * 4 },
};

function sikistir(ham, seviye) {
  return new Promise((coz) => {
    try { zlib(ham, { level: seviye }, (hata, cikti) => coz(hata || !cikti ? zlibSync(ham, { level: seviye }) : cikti)); } catch { coz(zlibSync(ham, { level: seviye })); }
  });
}

/**
 * @param o.veri   ham pikseller: 'rgb' → 3 bayt/piksel, 'rgba' → 4, 'gri1' → satır başına ceil(w/8) bayt
 * @param o.tur    'rgb' | 'rgba' | 'gri1'
 * @param o.seviye zlib düzeyi (1 = en hızlı, varsayılan 2)
 * @returns {Promise<Uint8Array>} PNG baytları
 */
export async function pngKodla({ genislik: w, yukseklik: h, veri, tur = 'rgb', seviye = 2 }) {
  const s = SEKILLER[tur];
  if (!s || !(w > 0 && h > 0)) throw new Error('PNG için geçersiz biçim ya da boyut.');
  const sb = s.satirBayt(w);
  if (veri.length < sb * h) throw new Error('PNG için piksel verisi eksik.');
  const ham = new Uint8Array((sb + 1) * h); // her satırın başında süzgeç baytı (0 = yok)
  for (let y = 0; y < h; y++) ham.set(veri.subarray(y * sb, (y + 1) * sb), y * (sb + 1) + 1);
  const baslik = new Uint8Array(13);
  const dv = new DataView(baslik.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  baslik[8] = s.derinlik; baslik[9] = s.renkTuru; // sıkıştırma/süzgeç/geçişme = 0
  const idat = await sikistir(ham, seviye);
  const parcalar = [IMZA, parca('IHDR', baslik), parca('IDAT', idat), parca('IEND', new Uint8Array(0))];
  const cikti = new Uint8Array(parcalar.reduce((t, p) => t + p.length, 0));
  let k = 0;
  for (const p of parcalar) { cikti.set(p, k); k += p.length; }
  return cikti;
}

/** RGBA pikselleri tamamen opaksa RGB'ye indirir (veri %25 küçülür); saydamlık varsa null. */
export function opaksaRgb(rgba) {
  const n = rgba.length >> 2;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 3) {
    if (rgba[j + 3] !== 255) return null;
    rgb[k] = rgba[j]; rgb[k + 1] = rgba[j + 1]; rgb[k + 2] = rgba[j + 2];
  }
  return rgb;
}

/** Tuvali (canvas) hızlı PNG'ye çevirir. */
export async function tuvaldenPng(tuval, seviye = 2) {
  const w = tuval.width, h = tuval.height;
  const rgba = tuval.getContext('2d').getImageData(0, 0, w, h).data;
  const rgb = opaksaRgb(rgba);
  return pngKodla({ genislik: w, yukseklik: h, veri: rgb ?? rgba, tur: rgb ? 'rgb' : 'rgba', seviye });
}
