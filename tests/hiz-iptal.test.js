import { describe, it, expect } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { pngKodla } from '../src/core/png.js';
import { paralelSayfalar, pdfdenResimler, belgeAc } from '../src/core/render.js';
import { eszamanliCalistir } from '../src/core/util.js';
import { iptalIste, iptalSifirla, iptalKontrol, IptalHatasi } from '../src/core/iptal.js';
import { pdfdenMarkdown } from '../src/core/pdf-markdown.js';
import { topluIsle } from '../src/core/toplu.js';
import { ornekPdf } from './yardimci/pdf-uret.js';
import { taramaPdf } from './yardimci/tarama.js';

async function pikseller(png) {
  const im = await loadImage(Buffer.from(png));
  const c = createCanvas(im.width, im.height);
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data };
}

describe('hızlı PNG yazıcı (kayıpsız)', () => {
  it('RGB: piksel piksel aynı', async () => {
    const w = 37, h = 21, veri = new Uint8Array(w * h * 3).map((_, i) => (i * 7) % 251);
    const r = await pikseller(await pngKodla({ genislik: w, yukseklik: h, veri, tur: 'rgb' }));
    expect([r.w, r.h]).toEqual([w, h]);
    for (let i = 0; i < w * h; i++) expect([r.d[i * 4], r.d[i * 4 + 1], r.d[i * 4 + 2], r.d[i * 4 + 3]]).toEqual([veri[i * 3], veri[i * 3 + 1], veri[i * 3 + 2], 255]);
  });
  it('RGBA ve 1 bit gri', async () => {
    const w = 10, h = 4, rgba = new Uint8Array(w * h * 4).fill(200);
    rgba[3] = 255; rgba[7] = 255; // bir kısım opak
    const a = await pikseller(await pngKodla({ genislik: w, yukseklik: h, veri: rgba, tur: 'rgba' }));
    expect(a.d[0]).toBe(200);
    const sb = Math.ceil(11 / 8), bit = new Uint8Array(sb * 2);
    bit[0] = 0b10000000; // ilk piksel beyaz, kalanı siyah
    const g = await pikseller(await pngKodla({ genislik: 11, yukseklik: 2, veri: bit, tur: 'gri1' }));
    expect([g.d[0], g.d[4], g.d[11 * 4]]).toEqual([255, 0, 0]);
  });
  it('geçersiz boyutta hata verir', async () => {
    await expect(pngKodla({ genislik: 0, yukseklik: 5, veri: new Uint8Array(0), tur: 'rgb' })).rejects.toThrow();
    await expect(pngKodla({ genislik: 4, yukseklik: 4, veri: new Uint8Array(5), tur: 'rgb' })).rejects.toThrow();
  });
});

describe('paralel sayfa işleme', () => {
  it('sonuçlar sayfa sırasıyla döner, her kulvar kendi belgesini açar', async () => {
    const bayt = await ornekPdf({ sayfa: 7 });
    const belgeler = new Set();
    const sonuc = await paralelSayfalar(bayt, [1, 2, 3, 4, 5, 6, 7], async (b, no) => {
      belgeler.add(b);
      await new Promise((r) => setTimeout(r, 7 - no)); // geç biten sayfa başa gelmesin
      return no * 10;
    }, { sinir: 3 });
    expect(sonuc).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(belgeler.size).toBeGreaterThan(1);
  });
  it('PDF → resim çıktısı sırayla ve eksiksiz', async () => {
    const r = await pdfdenResimler(await ornekPdf({ sayfa: 5 }), 'x.pdf', { dpi: 36 });
    expect(r.dosyalar.map((d) => d.sayfa)).toEqual([1, 2, 3, 4, 5]);
  });
  it('okuma sırasında hata olursa açık belgeler kapatılır ve hata iletilir', async () => {
    await expect(paralelSayfalar(await ornekPdf({ sayfa: 4 }), [1, 2, 3, 4], async (b, no) => { if (no === 2) throw new Error('boom'); return no; }, { sinir: 2 })).rejects.toThrow('boom');
  });
});

describe('iptal', () => {
  it('eşzamanlı işler iptalde yeni iş başlatmaz ve IptalHatasi fırlatır', async () => {
    iptalSifirla();
    let basladi = 0;
    const p = eszamanliCalistir(100, 2, async () => { basladi++; await new Promise((r) => setTimeout(r, 5)); });
    setTimeout(iptalIste, 12);
    await expect(p).rejects.toBeInstanceOf(IptalHatasi);
    expect(basladi).toBeLessThan(20);
    expect(() => iptalKontrol()).toThrow(IptalHatasi);
    iptalSifirla();
    expect(() => iptalKontrol()).not.toThrow();
  });

  it('PDF → Markdown, dosyanın ORTASINDA iptal edilince durur', async () => {
    iptalSifirla();
    const bayt = await ornekPdf({ sayfa: 40 });
    let cagri = 0;
    const p = pdfdenMarkdown(bayt, { ocr: 'yok', ilerleme: () => { if (++cagri === 6) iptalIste(); } });
    await expect(p).rejects.toBeInstanceOf(IptalHatasi);
    iptalSifirla();
  });

  it('OCR sırasında iptal: bekleyen okuma kesilir', async () => {
    iptalSifirla();
    const { bayt } = await taramaPdf([['İptal deneme satırı bir', 'İptal deneme satırı iki'], ['Üçüncü sayfa metni'], ['Dördüncü sayfa metni']]);
    const p = pdfdenMarkdown(bayt, { ocr: 'otomatik', ilerleme: (_k, _n, m) => { if (/OCR/.test(m ?? '')) iptalIste(); } });
    await expect(p).rejects.toBeInstanceOf(IptalHatasi);
    iptalSifirla();
    // iptalden sonra OCR yeniden çalışabilir
    const r = await pdfdenMarkdown((await taramaPdf([['Yeniden çalışma satırı']])).bayt, { ocr: 'otomatik' });
    expect(r.md).toMatch(/çalışma/i);
    const { ocrKapat } = await import('../src/core/ocr.js');
    await ocrKapat();
  }, 120000);

  it('toplu işlem: dosya ortasında iptal → biten dosyalar korunur, yarım dosya eklenmez', async () => {
    iptalSifirla();
    const dosyalar = [{ ad: 'a.pdf' }, { ad: 'b.pdf' }, { ad: 'c.pdf' }];
    const t = await topluIsle(dosyalar, async (d) => {
      if (d.ad === 'b.pdf') { iptalIste(); iptalKontrol(); }
      return { ciktilar: [{ ad: `${d.ad}.md`, bayt: new Uint8Array([1]) }] };
    });
    expect(t.iptal).toBe(true);
    expect(t.basarili).toBe(1);
    expect(t.toplamCikti).toBe(1);
    iptalSifirla();
  });
});
