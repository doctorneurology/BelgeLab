import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { resimlerdenPdf, resimTuru, jpegYonelimi } from '../src/core/resim-pdf.js';
import { sayfaPikselleri } from '../tools/karsilastir.mjs';
import { pngUret, jpegUret, jpegYonelimEkle } from './yardimci/pdf-uret.js';

const piksel = (c, x, y) => {
  const i = (Math.round(y) * c.genislik + Math.round(x)) * 4;
  return [c.veri[i], c.veri[i + 1], c.veri[i + 2]];
};

describe('Resimden PDF', () => {
  it('tür tanıma', async () => {
    expect(resimTuru(pngUret(2, 2))).toBe('png');
    expect(resimTuru(await jpegUret(8, 8))).toBe('jpeg');
    expect(resimTuru(new Uint8Array([1, 2, 3, 4]))).toBe(null);
  });

  it('A4: geniş resim yatay sayfaya, uzun resim dikey sayfaya konur; resim sayfada ortalanır', async () => {
    const genis = pngUret(200, 100, [255, 0, 0, 255]);
    const uzun = pngUret(100, 200, [0, 0, 255, 255]);
    const s = await resimlerdenPdf([{ ad: 'a.png', bayt: genis }, { ad: 'b.png', bayt: uzun }], { sayfaBoyutu: 'A4', kenar: 'orta' });
    const d = await PDFDocument.load(s.bayt);
    const [p1, p2] = d.getPages().map((p) => p.getSize());
    expect(p1.width).toBeGreaterThan(p1.height);
    expect(p2.height).toBeGreaterThan(p2.width);
    const c1 = await sayfaPikselleri(s.bayt, 1);
    expect(piksel(c1, c1.genislik / 2, c1.yukseklik / 2)).toEqual([255, 0, 0]);
    expect(piksel(c1, 5, 5)).toEqual([255, 255, 255]); // kenar boşluğu
    const c2 = await sayfaPikselleri(s.bayt, 2);
    expect(piksel(c2, c2.genislik / 2, c2.yukseklik / 2)).toEqual([0, 0, 255]);
  });

  it('"resim boyutunda" sayfa: sayfa resimle aynı oranda ve boşluk yok', async () => {
    const s = await resimlerdenPdf([{ ad: 'a.png', bayt: pngUret(80, 40, [0, 255, 0, 255]) }], { sayfaBoyutu: 'resim' });
    const d = await PDFDocument.load(s.bayt);
    const { width, height } = d.getPage(0).getSize();
    expect(width / height).toBeCloseTo(2, 2);
    const c = await sayfaPikselleri(s.bayt, 1);
    expect(piksel(c, 1, 1)).toEqual([0, 255, 0]);
  });

  it('EXIF yönelimi: telefon fotoğrafı (yönelim 6 = 90° saat yönü) yan yatmaz', async () => {
    // Sol yarısı kırmızı, sağ yarısı mavi bir resim. Yönelim 6'da ekranda: üst = kırmızı (sol), alt = mavi (sağ).
    const jpeg = jpegYonelimEkle(await jpegUret(200, 100, '#ff0000', '#0000ff'), 6);
    expect(jpegYonelimi(jpeg)).toBe(6);
    const s = await resimlerdenPdf([{ ad: 'foto.jpg', bayt: jpeg }], { sayfaBoyutu: 'A4', kenar: 'yok' });
    const c = await sayfaPikselleri(s.bayt, 1);
    expect(c.yukseklik).toBeGreaterThan(c.genislik); // otomatik: dikey sayfa
    const ust = piksel(c, c.genislik / 2, c.yukseklik / 2 - 60);
    const alt = piksel(c, c.genislik / 2, c.yukseklik / 2 + 60);
    expect(ust[0]).toBeGreaterThan(200); expect(ust[2]).toBeLessThan(60);
    expect(alt[2]).toBeGreaterThan(200); expect(alt[0]).toBeLessThan(60);
  });

  it('EXIF yönelim 3 (180°) ve 8 (90° saat yönünün tersi)', async () => {
    const taban = await jpegUret(200, 100, '#ff0000', '#0000ff');
    const c3 = await sayfaPikselleri((await resimlerdenPdf([{ ad: 'a.jpg', bayt: jpegYonelimEkle(taban, 3) }], { kenar: 'yok' })).bayt, 1);
    // 180°: sol mavi, sağ kırmızı
    expect(piksel(c3, c3.genislik / 2 - 100, c3.yukseklik / 2)[2]).toBeGreaterThan(200);
    expect(piksel(c3, c3.genislik / 2 + 100, c3.yukseklik / 2)[0]).toBeGreaterThan(200);
    const c8 = await sayfaPikselleri((await resimlerdenPdf([{ ad: 'a.jpg', bayt: jpegYonelimEkle(taban, 8) }], { kenar: 'yok' })).bayt, 1);
    // 90° saat yönünün tersi: sol kırmızı → alt; sağ mavi → üst
    expect(piksel(c8, c8.genislik / 2, c8.yukseklik / 2 + 60)[0]).toBeGreaterThan(200);
    expect(piksel(c8, c8.genislik / 2, c8.yukseklik / 2 - 60)[2]).toBeGreaterThan(200);
  });

  it('desteklenmeyen/bozuk resimde anlaşılır hata verir; boş listede de', async () => {
    await expect(resimlerdenPdf([], {})).rejects.toThrow(/En az bir resim/);
    await expect(resimlerdenPdf([{ ad: 'x.webp', bayt: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0]) }], {}))
      .rejects.toThrow(/"x.webp".*desteklenmiyor/);
  });
});
