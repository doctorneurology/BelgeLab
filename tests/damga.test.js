import { describe, it, expect } from 'vitest';
import { damgaEkle } from '../src/core/damga.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { ornekPdf, pngUret } from './yardimci/pdf-uret.js';

describe('Görünür imza / metin kutusu ekle', () => {
  it('metin kutusu istenen yere, Türkçe karakterlerle yazılır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await damgaEkle(pdf, [{
      sayfa: 0, tur: 'metin', x: 300, y: 100, genislik: 220, yukseklik: 60,
      metin: 'Onaylandı — Müdür Yardımcısı İğdır', boyut: 12, cerceve: '#000000', arkaPlan: '#ffffcc',
    }]);
    expect((await metinCikar(s.bayt))[0]).toContain('Onaylandı — Müdür Yardımcısı İğdır');
    const fark = karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(s.bayt), { esik: 0.02 });
    // Görünür koordinat (y alttan) → çizimde yukarıdan: üst = 841.89 − (100+60)
    expect(fark.kutu.x0).toBeGreaterThanOrEqual(298);
    expect(fark.kutu.x1).toBeLessThanOrEqual(522);
    expect(fark.kutu.y0).toBeGreaterThanOrEqual(841.89 - 162);
    expect(fark.kutu.y1).toBeLessThanOrEqual(841.89 - 98);
  });

  it('imza resmi (saydam PNG) verilen kutuya yerleşir', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const imza = pngUret(60, 30, [0, 0, 0, 255]);
    const s = await damgaEkle(pdf, [{ sayfa: 1, tur: 'resim', bayt: imza, x: 100, y: 50, genislik: 120, yukseklik: 60 }]);
    const c = await sayfaPikselleri(s.bayt, 2);
    const i = (Math.round(841.89 - 80) * c.genislik + 160) * 4; // kutunun ortası
    expect([c.veri[i], c.veri[i + 1], c.veri[i + 2]]).toEqual([0, 0, 0]);
    // 1. sayfa değişmedi
    expect(karsilastir(await sayfaPikselleri(s.bayt, 1), await sayfaPikselleri(pdf, 1)).farkliPiksel).toBe(0);
  });

  it('döndürülmüş sayfada da EKRANDA seçilen yere konur', async () => {
    const pdf = await ornekPdf({ sayfa: 1, don: 90 });
    const o = await sayfaPikselleri(pdf);
    // Ekranda görünen sol-alt köşeye 50x30'luk siyah kutu
    const s = await damgaEkle(pdf, [{ sayfa: 0, tur: 'resim', bayt: pngUret(10, 10, [0, 0, 0, 255]), x: 0, y: 0, genislik: 50, yukseklik: 30 }]);
    const c = await sayfaPikselleri(s.bayt);
    const f = karsilastir(o, c);
    expect(f.kutu.x0).toBeLessThanOrEqual(1);
    expect(f.kutu.y1).toBeGreaterThanOrEqual(o.yukseklik - 2);
    expect(f.kutu.x1 - f.kutu.x0).toBeGreaterThan(45);
    expect(f.kutu.y1 - f.kutu.y0).toBeGreaterThan(25);
  });

  it('kutuya sığmayan metni ve sayfa dışına taşan öğeyi UYARIR', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await damgaEkle(pdf, [
      { sayfa: 0, tur: 'metin', x: 50, y: 50, genislik: 60, yukseklik: 20, metin: 'Bu metin bu küçük kutuya hiçbir şekilde sığmaz', boyut: 14 },
      { sayfa: 0, tur: 'metin', x: 580, y: 50, genislik: 100, yukseklik: 30, metin: 'taşan', boyut: 10 },
    ]);
    expect(s.uyarilar.join('\n')).toMatch(/sığmıyor/);
    expect(s.uyarilar.join('\n')).toMatch(/sayfa sınırının dışına/);
  });

  it('hatalı girdileri reddeder', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(damgaEkle(pdf, [])).rejects.toThrow(/Eklenecek/);
    await expect(damgaEkle(pdf, [{ sayfa: 3, tur: 'metin', x: 0, y: 0, genislik: 10, yukseklik: 10, metin: 'a' }])).rejects.toThrow(/Sayfa 4 yok/);
    await expect(damgaEkle(pdf, [{ sayfa: 0, tur: 'metin', x: 0, y: 0, genislik: 100, yukseklik: 30, metin: '   ' }])).rejects.toThrow(/boş/);
    await expect(damgaEkle(pdf, [{ sayfa: 0, tur: 'metin', x: 0, y: 0, genislik: 100, yukseklik: 30, metin: 'a 😀' }])).rejects.toThrow(/karakterler yok/);
    await expect(damgaEkle(pdf, [{ sayfa: 0, tur: 'resim', bayt: new Uint8Array(20), x: 0, y: 0, genislik: 10, yukseklik: 10 }])).rejects.toThrow(/PNG veya JPEG/);
  });
});
