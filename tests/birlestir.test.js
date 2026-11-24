import { describe, it, expect } from 'vitest';
import { birlestir } from '../src/core/sayfalar.js';
import { sayfaPikselleri, metinCikar, karsilastir, sayfaSayisiOku } from '../tools/karsilastir.mjs';
import { ornekPdf, gizliIsaretEkle } from './yardimci/pdf-uret.js';
import { formluPdf } from './yardimci/pdf-uret.js';

describe('PDF birleştir', () => {
  it('iki belgeyi sırasıyla birleştirir; sayfalar görsel olarak aynen korunur', async () => {
    const a = await ornekPdf({ sayfa: 3, baslik: 'Alfa' });
    const b = await ornekPdf({ sayfa: 2, baslik: 'Beta' });
    const sonuc = await birlestir([{ ad: 'a.pdf', bayt: a }, { ad: 'b.pdf', bayt: b }]);
    expect(sonuc.sayfaSayisi).toBe(5);
    const metin = await metinCikar(sonuc.bayt);
    expect(metin.map((m) => m.split(' Pijamalı')[0])).toEqual([
      'Alfa 1 / 3', 'Alfa 2 / 3', 'Alfa 3 / 3', 'Beta 1 / 2', 'Beta 2 / 2',
    ]);
    // Görsel: birleşik belgenin 1. ve 4. sayfası kaynak sayfalarıyla piksel pikselle aynı olmalı
    for (const [sonSayfa, kaynak, kaynakSayfa] of [[1, a, 1], [4, b, 1], [5, b, 2]]) {
      const fark = karsilastir(await sayfaPikselleri(sonuc.bayt, sonSayfa), await sayfaPikselleri(kaynak, kaynakSayfa));
      expect(fark.boyutUyumsuz).toBe(false);
      expect(fark.farkliPiksel).toBe(0);
    }
  });

  it('üç belgeyi birleştirir', async () => {
    const dosyalar = await Promise.all([1, 2, 3].map(async (n) => ({ ad: `d${n}.pdf`, bayt: await ornekPdf({ sayfa: n }) })));
    const sonuc = await birlestir(dosyalar);
    expect(await sayfaSayisiOku(sonuc.bayt)).toBe(6);
  });

  it('tek dosya ya da bozuk dosya için anlaşılır hata verir', async () => {
    const a = await ornekPdf({ sayfa: 1 });
    await expect(birlestir([{ ad: 'a.pdf', bayt: a }])).rejects.toThrow(/en az iki/);
    await expect(birlestir([{ ad: 'a.pdf', bayt: a }, { ad: 'bozuk.pdf', bayt: new Uint8Array([1, 2, 3, 4]) }]))
      .rejects.toThrow(/"bozuk.pdf" açılamadı/);
  });

  it('form alanı olan belgede uyarı gösterir (sessizce bozmaz)', async () => {
    const f = await formluPdf();
    const a = await ornekPdf({ sayfa: 1 });
    const sonuc = await birlestir([{ ad: 'form.pdf', bayt: f }, { ad: 'a.pdf', bayt: a }]);
    expect(sonuc.uyarilar.join(' ')).toMatch(/form\.pdf: .*form alanları/);
  });

  it('çıktı, dürüstçe bu programın ürettiği olarak işaretlenir', async () => {
    const a = await ornekPdf({ sayfa: 1 });
    const sonuc = await birlestir([{ ad: 'a.pdf', bayt: a }, { ad: 'b.pdf', bayt: a }]);
    const { PDFDocument } = await import('pdf-lib');
    const d = await PDFDocument.load(sonuc.bayt, { updateMetadata: false });
    expect(d.getProducer()).toMatch(/BelgeLab/);
    expect(d.getModificationDate()).toBeInstanceOf(Date);
  });
});

void gizliIsaretEkle;
