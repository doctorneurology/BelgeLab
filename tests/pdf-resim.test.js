import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { pdfdenResimler } from '../src/core/render.js';
import { zipOlustur } from '../src/core/zip.js';
import { sifreEkle } from '../src/core/sifre.js';
import { ornekPdf } from './yardimci/pdf-uret.js';

function pngOku(bayt) {
  const p = PNG.sync.read(Buffer.from(bayt));
  return { w: p.width, h: p.height, px: (x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)] };
}

describe('PDF\'ten resim', () => {
  it('72 dpi PNG: boyut sayfa boyutuna eşit, renkler doğru yerde', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const { dosyalar } = await pdfdenResimler(pdf, 'ornek.pdf', { dpi: 72 });
    expect(dosyalar.map((d) => d.ad)).toEqual(['ornek-sayfa-1.png', 'ornek-sayfa-2.png']);
    const r = pngOku(dosyalar[0].bayt);
    expect([r.w, r.h]).toEqual([596, 842]);
    // Sayfa 1'deki kutu: x 72-272, yukarıdan 280-400 pt; rengi rgb(0.2, 0.6, 0.8) ≈ (51,153,204)
    const [kr, kg, kb] = r.px(172, 340);
    expect(Math.abs(kr - 51)).toBeLessThan(6); expect(Math.abs(kg - 153)).toBeLessThan(6); expect(Math.abs(kb - 204)).toBeLessThan(6);
    expect(r.px(5, 5)).toEqual([255, 255, 255]);
  });

  it('çözünürlük arttıkça boyut büyür (150 dpi)', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const { dosyalar } = await pdfdenResimler(pdf, 'a.pdf', { dpi: 150 });
    const r = pngOku(dosyalar[0].bayt);
    expect(r.w).toBe(Math.ceil((595.28 * 150) / 72));
  });

  it('JPEG biçimi ve sayfa seçimi', async () => {
    const pdf = await ornekPdf({ sayfa: 4 });
    const { dosyalar } = await pdfdenResimler(pdf, 'a.pdf', { dpi: 50, bicim: 'jpeg', sayfalar: '2,4' });
    expect(dosyalar.map((d) => d.ad)).toEqual(['a-sayfa-2.jpg', 'a-sayfa-4.jpg']);
    expect([...dosyalar[0].bayt.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('ZIP olarak paketlenir ve geri okunur', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    const { dosyalar } = await pdfdenResimler(pdf, 'rapor.pdf', { dpi: 40 });
    const zip = await JSZip.loadAsync(zipOlustur(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt }))), { checkCRC32: true });
    expect(Object.keys(zip.files).sort()).toEqual(['rapor-sayfa-1.png', 'rapor-sayfa-2.png', 'rapor-sayfa-3.png']);
  });

  it('çok büyük çözünürlükte bellek patlatmadan anlaşılır hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1, genislik: 5000, yukseklik: 5000 });
    await expect(pdfdenResimler(pdf, 'a.pdf', { dpi: 600 })).rejects.toThrow(/çok büyük/);
  });

  it('şifreli PDF: şifre olmadan hata, doğru şifreyle çizilir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const { bayt } = await sifreEkle(pdf, { kullaniciSifresi: 'gizli-şifre-1' });
    await expect(pdfdenResimler(bayt, 'a.pdf', { dpi: 36 })).rejects.toThrow(/şifre/i);
    await expect(pdfdenResimler(bayt, 'a.pdf', { dpi: 36, sifre: 'yanlis' })).rejects.toThrow(/doğru değil/);
    const { dosyalar } = await pdfdenResimler(bayt, 'a.pdf', { dpi: 36, sifre: 'gizli-şifre-1' });
    expect(dosyalar.length).toBe(1);
  });

  it('geçersiz seçeneklerde hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(pdfdenResimler(pdf, 'a.pdf', { dpi: 5 })).rejects.toThrow(/dpi/);
    await expect(pdfdenResimler(pdf, 'a.pdf', { bicim: 'gif' })).rejects.toThrow(/png veya jpeg/);
  });
});
