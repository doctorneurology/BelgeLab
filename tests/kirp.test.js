import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { kirp } from '../src/core/kirp.js';
import { sayfaPikselleri, karsilastir } from '../tools/karsilastir.mjs';
import { ornekPdf } from './yardimci/pdf-uret.js';

/** a'nın (x, y, w, h) bölgesini keser */
function kes(c, x, y, w, h) {
  const veri = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) {
    veri.set(c.veri.subarray(((y + r) * c.genislik + x) * 4, ((y + r) * c.genislik + x + w) * 4), r * w * 4);
  }
  return { genislik: w, yukseklik: h, veri };
}

describe('Kırp', () => {
  it('üstten 100 pt kırpınca sayfa küçülür ve kalan görüntü özgün sayfanın aynı bölgesidir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await kirp(pdf, { ust: 100 });
    const o = await sayfaPikselleri(pdf), k = await sayfaPikselleri(s.bayt);
    expect(k.genislik).toBe(o.genislik);
    expect(k.yukseklik).toBe(o.yukseklik - 100);
    const fark = karsilastir(k, kes(o, 0, 100, o.genislik, o.yukseklik - 100));
    expect(fark.oran).toBeLessThan(0.0005);
  });

  it('dört kenardan kırpma: boyut doğru', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await kirp(pdf, { ust: 10, alt: 20, sol: 30, sag: 40 });
    const d = await PDFDocument.load(s.bayt);
    const kutu = d.getPage(0).getCropBox();
    expect(kutu.width).toBeCloseTo(595.28 - 70, 1);
    expect(kutu.height).toBeCloseTo(841.89 - 30, 1);
    expect(kutu.x).toBeCloseTo(30, 1);
    expect(kutu.y).toBeCloseTo(20, 1);
  });

  it('döndürülmüş sayfada "üst" EKRANDA görünen üst kenardır', async () => {
    for (const don of [90, 180, 270]) {
      const pdf = await ornekPdf({ sayfa: 1, don });
      const o = await sayfaPikselleri(pdf), s = await kirp(pdf, { ust: 100 }), k = await sayfaPikselleri(s.bayt);
      expect(k.yukseklik, `don=${don}`).toBe(o.yukseklik - 100);
      const fark = karsilastir(k, kes(o, 0, 100, o.genislik, o.yukseklik - 100));
      expect(fark.oran, `don=${don}`).toBeLessThan(0.0005);
    }
  });

  it('seçili sayfalar kırpılır, diğerleri değişmez', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const s = await kirp(pdf, { sol: 50, sayfalar: '2' });
    expect(karsilastir(await sayfaPikselleri(s.bayt, 1), await sayfaPikselleri(pdf, 1)).farkliPiksel).toBe(0);
    expect((await sayfaPikselleri(s.bayt, 2)).genislik).toBeLessThan((await sayfaPikselleri(pdf, 2)).genislik);
  });

  it('kırpılan içeriğin dosyada kaldığını açıkça UYARIR (gizlilik)', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await kirp(pdf, { alt: 10 });
    expect(s.uyarilar.join(' ')).toMatch(/dosyadan silinmez/);
  });

  it('geçersiz kırpma değerlerini reddeder', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(kirp(pdf, {})).rejects.toThrow(/Kırpılacak bir miktar/);
    await expect(kirp(pdf, { ust: -5 })).rejects.toThrow(/negatif/);
    await expect(kirp(pdf, { ust: 500, alt: 500 })).rejects.toThrow(/kırpma sayfadan büyük/);
  });
});
