// Aşama 5 — Doğrulama. Tarayıcıda ve Node'da aynı kod çalışır (çizim için render.js ortamı gerekir).
//  (a) Yazıları çıkarılmış orijinal ile yazıları çıkarılmış çıktı piksel piksel karşılaştırılır:
//      logo, çizgi, resim, imza alanı... farkı SIFIR olmalı.
//  (b) Satır konum sapması: pdf.js ile iki belgeden satırlar çıkarılır, eşleşen satırların başlangıç,
//      bitiş ve taban çizgisi farkı ölçülür.
//  (c) Eski/yeni üst üste bindirme görüntüsü (eski: kırmızı, yeni: camgöbeği, ikisi aynı: siyah).

import { belgeAc, sayfaCiz } from '../render.js';
import { yazilariKaldir } from './motor.js';
import { SINIR } from './analiz.js';

async function pikseller(belge, no, olcek) {
  const { tuval, genislik, yukseklik } = await sayfaCiz(belge, no, { olcek });
  const veri = tuval.getContext('2d').getImageData(0, 0, genislik, yukseklik).data;
  return { genislik, yukseklik, veri: new Uint8ClampedArray(veri) };
}

/** İki çizimi BİREBİR karşılaştırır (hiçbir eşik yok). */
export function birebirFark(a, b) {
  if (a.genislik !== b.genislik || a.yukseklik !== b.yukseklik) return { fark: Infinity, kutu: null };
  let fark = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const w = a.genislik;
  for (let i = 0; i < a.veri.length; i += 4) {
    if (a.veri[i] !== b.veri[i] || a.veri[i + 1] !== b.veri[i + 1] || a.veri[i + 2] !== b.veri[i + 2] || a.veri[i + 3] !== b.veri[i + 3]) {
      fark++;
      const p = i / 4, x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { fark, kutu: fark ? { x0, y0, x1, y1 } : null };
}

/** (c) Üst üste bindirme: eski kırmızı, yeni camgöbeği, ortak kısım koyu. */
export function ustUsteBindir(eski, yeni) {
  const out = new Uint8ClampedArray(eski.veri.length);
  for (let i = 0; i < out.length; i += 4) {
    const le = (eski.veri[i] * 0.3 + eski.veri[i + 1] * 0.59 + eski.veri[i + 2] * 0.11);
    const ly = (yeni.veri[i] * 0.3 + yeni.veri[i + 1] * 0.59 + yeni.veri[i + 2] * 0.11);
    out[i] = ly; out[i + 1] = le; out[i + 2] = le; out[i + 3] = 255;
  }
  return { genislik: eski.genislik, yukseklik: eski.yukseklik, veri: out };
}

/** pdf.js metin öğelerinden satırları kurar (bağımsız ölçüm için motorun kodunu kullanmaz). */
export async function pdfjsSatirlari(belge, no) {
  const sayfa = await belge.getPage(no);
  const tc = await sayfa.getTextContent();
  const ogeler = tc.items.filter((x) => x.str && x.str.trim() && x.transform[1] === 0 && x.transform[2] === 0 && x.transform[0] > 0)
    .map((x) => {
      // Sondaki boşluğun genişliği belirsiz: gruplama için yaklaşık "dolu" bitiş kullanılır
      const dolu = x.str.replace(/\s+$/, '').length;
      return { x0: x.transform[4], x1: x.transform[4] + x.width, x1d: x.transform[4] + (x.width * dolu) / x.str.length, y: x.transform[5], boyut: Math.abs(x.transform[3]), str: x.str };
    })
    .sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const satirlar = [];
  for (const o of ogeler) {
    const l = satirlar.find((s) => Math.abs(s.y - o.y) <= 0.2 * Math.min(s.boyut, o.boyut) && o.x0 - s.x1d <= 1.2 * Math.max(s.boyut, o.boyut) && o.x0 >= s.x0 - 0.3 * o.boyut);
    // pdf.js, araya giren boşluğu bazen öğenin genişliğine katar bazen katmaz; boşlukla biten öğenin
    // bitişi bu yüzden belirsizdir → bitiş karşılaştırmasında kullanılmaz (bosSon işareti).
    const bosSon = /\s$/.test(o.str);
    if (l) {
      if (o.x1 > l.x1) { l.x1 = o.x1; l.bosSon = bosSon; }
      l.x1d = Math.max(l.x1d, o.x1d);
      l.metin += o.str;
    } else satirlar.push({ x0: o.x0, x1: o.x1, x1d: o.x1d, y: o.y, boyut: o.boyut, metin: o.str, bosSon });
  }
  for (const s of satirlar) s.anahtar = s.metin.normalize('NFKC').replace(/\s+/g, '');
  return satirlar.filter((s) => s.anahtar);
}

/** (b) Eşleşen satırların sapması. */
export function satirSapmasi(eskiler, yeniler) {
  const kullanildi = new Set();
  const sonuc = { eslesen: 0, eslesmeyen: 0, enBuyuk: 0, ortalama: 0, asan: [] };
  let top = 0;
  for (const e of eskiler) {
    let en = null;
    for (const y of yeniler) {
      if (kullanildi.has(y) || y.anahtar !== e.anahtar) continue;
      const d = Math.abs(y.y - e.y) + Math.abs(y.x0 - e.x0);
      if (!en || d < en.d) en = { y, d };
    }
    if (!en || en.d > 20) {
      // pdf.js yan yana iki satırı bir belgede birleştirip ötekinde ayırmış olabilir: kapsayan satırı ara
      const k = yeniler.find((y) => Math.abs(y.y - e.y) <= SINIR.konum && y.anahtar.includes(e.anahtar) && y.x0 <= e.x0 + SINIR.konum && y.x1 >= e.x1 - 2);
      if (k) { sonuc.kapsanan = (sonuc.kapsanan ?? 0) + 1; sonuc.eslesen++; sonuc.enBuyuk = Math.max(sonuc.enBuyuk, Math.abs(k.y - e.y)); continue; }
      sonuc.eslesmeyen++;
      continue;
    }
    kullanildi.add(en.y);
    const bitisOlcul = !e.bosSon && !en.y.bosSon;
    const s = Math.max(Math.abs(en.y.x0 - e.x0), bitisOlcul ? Math.abs(en.y.x1 - e.x1) : 0, Math.abs(en.y.y - e.y));
    if (bitisOlcul) sonuc.bitisOlculen = (sonuc.bitisOlculen ?? 0) + 1;
    sonuc.eslesen++;
    top += s;
    sonuc.enBuyuk = Math.max(sonuc.enBuyuk, s);
    if (s > SINIR.konum) sonuc.asan.push({ x0: e.x0, y: e.y, sapma: s, dx0: en.y.x0 - e.x0, dx1: en.y.x1 - e.x1, dy: en.y.y - e.y });
  }
  sonuc.ortalama = sonuc.eslesen ? top / sonuc.eslesen : 0;
  return sonuc;
}

/**
 * Orijinal ve çıktıyı doğrular. sayfalar: 1 tabanlı sayfa numaraları.
 * @returns {{sayfalar: {no, pikselFark, fark kutusu, sapma}[], gecti:boolean}}
 */
export async function dogrula(orijinal, cikti, { sayfalar, olcek = 1.5, bindirme = false } = {}) {
  const dizin = sayfalar.map((n) => n - 1);
  const [ya, yb] = [await yazilariKaldir(orijinal, { sayfalar: dizin }), await yazilariKaldir(cikti, { sayfalar: dizin })];
  const [A, B, O, C] = await Promise.all([belgeAc(ya), belgeAc(yb), belgeAc(orijinal), belgeAc(cikti)]);
  try {
    const sonuc = [];
    for (const no of sayfalar) {
      const fa = birebirFark(await pikseller(A, no, olcek), await pikseller(B, no, olcek));
      const sapma = satirSapmasi(await pdfjsSatirlari(O, no), await pdfjsSatirlari(C, no));
      const r = { no, pikselFark: fa.fark, farkKutusu: fa.kutu, sapma };
      if (bindirme) r.bindirme = ustUsteBindir(await pikseller(O, no, olcek), await pikseller(C, no, olcek));
      sonuc.push(r);
    }
    const gecti = sonuc.every((s) => s.pikselFark === 0 && s.sapma.enBuyuk <= SINIR.konum);
    return { sayfalar: sonuc, gecti };
  } finally {
    await Promise.all([A, B, O, C].map((b) => b.kapat()));
  }
}
