// Sayfa çizip karşılaştırma yardımcıları.
// Hem testlerde hem "ornek-test" betiğinde kullanılır; sonraki oturumlarda (ör. yazı düzeltme motoru)
// "belge bozulmadan düzenlendi mi?" denetimi için de kullanılacaktır.
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { belgeAc, sayfaCiz } from '../src/core/render.js';
import { nodeOrtaminiKur } from './ortam-node.mjs';

nodeOrtaminiKur();

/** Bir PDF sayfasını çizip ham RGBA piksellerini verir. sayfaNo 1 tabanlı. */
export async function sayfaPikselleri(bayt, sayfaNo = 1, { olcek = 1, sifre } = {}) {
  const belge = await belgeAc(bayt, { sifre });
  try {
    const { tuval, genislik, yukseklik } = await sayfaCiz(belge, sayfaNo, { olcek });
    const veri = tuval.getContext('2d').getImageData(0, 0, genislik, yukseklik).data;
    return { genislik, yukseklik, veri: new Uint8ClampedArray(veri) };
  } finally {
    await belge.kapat();
  }
}

export async function sayfaSayisiOku(bayt, sifre) {
  const belge = await belgeAc(bayt, { sifre });
  const n = belge.numPages;
  await belge.kapat();
  return n;
}

/** Sayfadaki tüm metni (pdf.js ile) çıkarır. Sayfa başına bir dizgi döner. */
export async function metinCikar(bayt, { sifre } = {}) {
  const belge = await belgeAc(bayt, { sifre });
  try {
    const sonuc = [];
    for (let i = 1; i <= belge.numPages; i++) {
      const sayfa = await belge.getPage(i);
      const icerik = await sayfa.getTextContent();
      sonuc.push(icerik.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim());
    }
    return sonuc;
  } finally {
    await belge.kapat();
  }
}

/**
 * İki çizimi karşılaştırır.
 * @returns {{boyutUyumsuz:boolean, genislik, yukseklik, farkliPiksel:number, oran:number, kutu:object|null}}
 */
export function karsilastir(a, b, { esik = 0.1, yoksayAntialias = true } = {}) {
  if (a.genislik !== b.genislik || a.yukseklik !== b.yukseklik) {
    return { boyutUyumsuz: true, genislik: a.genislik, yukseklik: a.yukseklik, farkliPiksel: Infinity, oran: 1, kutu: null };
  }
  const { genislik: w, yukseklik: h } = a;
  const fark = new Uint8ClampedArray(w * h * 4);
  const farkliPiksel = pixelmatch(a.veri, b.veri, fark, w, h, { threshold: esik, includeAA: !yoksayAntialias });
  let kutu = null;
  if (farkliPiksel > 0) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (fark[i] === 255 && fark[i + 1] === 0 && fark[i + 2] === 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    kutu = { x0, y0, x1, y1 };
  }
  return { boyutUyumsuz: false, genislik: w, yukseklik: h, farkliPiksel, oran: farkliPiksel / (w * h), kutu, fark };
}

/** Çizimin ne kadarı "boş" (beyaz olmayan piksel oranı). Boş/bozuk çizimi yakalamak için. */
export function doluluk(c) {
  let dolu = 0;
  for (let i = 0; i < c.veri.length; i += 4) {
    if (c.veri[i] < 250 || c.veri[i + 1] < 250 || c.veri[i + 2] < 250) dolu++;
  }
  return dolu / (c.genislik * c.yukseklik);
}

export function pngKaydet(c, yol, fark) {
  mkdirSync(dirname(yol), { recursive: true });
  const png = new PNG({ width: c.genislik, height: c.yukseklik });
  png.data = Buffer.from(fark ?? c.veri);
  writeFileSync(yol, PNG.sync.write(png));
}
