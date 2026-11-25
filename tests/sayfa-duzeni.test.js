import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { birSayfayaCok, kitapcik, tekUzunSayfa, sayfaBoyutuDegistir, ustUsteBindir } from '../src/core/sayfa-duzeni.js';
import { belgeAc, sayfaCiz } from '../src/core/render.js';

async function etiketli(n, { boyut = [300, 400], don = 0 } = {}) {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= n; i++) { const p = doc.addPage(boyut); p.drawText(`S${i}`, { x: 40, y: boyut[1] - 120, size: 90, font: f }); if (don) p.setRotation(degrees(don)); }
  return new Uint8Array(await doc.save());
}
async function sayfaMetinleri(b) {
  const belge = await belgeAc(b); const sonuc = [];
  for (let i = 1; i <= belge.numPages; i++) { const p = await belge.getPage(i); sonuc.push((await p.getTextContent()).items.map((o) => o.str).join(' ')); }
  await belge.kapat(); return sonuc;
}
async function boyutlar(b) { const d = await PDFDocument.load(b); return d.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]); }

describe('sayfa düzeni', () => {
  it('bir sayfaya 2/4: sayfa sayısı, yön ve içerik', async () => {
    const b = await etiketli(8);
    const dort = await birSayfayaCok(b, { adet: 4 });
    expect(dort.sayfaSayisi).toBe(2);
    expect(await boyutlar(dort.bayt)).toEqual([[595, 842], [595, 842]]);
    const iki = await birSayfayaCok(b, { adet: 2 });
    expect((await boyutlar(iki.bayt))[0][0]).toBeGreaterThan((await boyutlar(iki.bayt))[0][1]); // yatay
    expect((await sayfaMetinleri(dort.bayt))[0].replace(/\s+/g, ' ')).toBe('S1 S2 S3 S4');
    expect((await sayfaMetinleri((await birSayfayaCok(await etiketli(5), { adet: 4 })).bayt))[1]).toBe('S5');
  });
  it('kitapçık sırası doğru (8 sayfa: 8-1 | 2-7 | 6-3 | 4-5)', async () => {
    const r = await kitapcik(await etiketli(8));
    expect(r.sayfaSayisi).toBe(4);
    const m = (await sayfaMetinleri(r.bayt)).map((x) => x.replace(/\s+/g, ' '));
    expect(m).toEqual(['S8 S1', 'S2 S7', 'S6 S3', 'S4 S5']);
    const bes = await kitapcik(await etiketli(5)); // 3 boş sayfa eklenir
    expect(bes.bosEklenen).toBe(3);
    expect((await sayfaMetinleri(bes.bayt))[0].replace(/\s+/g, ' ')).toBe('S1'); // sol boş, sağ S1
  });
  it('tek uzun sayfa', async () => {
    const r = await tekUzunSayfa(await etiketli(3));
    expect(await boyutlar(r.bayt)).toEqual([[300, 1200]]);
    expect((await sayfaMetinleri(r.bayt))[0].replace(/\s+/g, ' ')).toBe('S1 S2 S3');
    await expect(tekUzunSayfa(await etiketli(60))).rejects.toThrow(/çok uzun/);
  });
  it('sayfa boyutu: A4, yüzde ve özel', async () => {
    const b = await etiketli(2, { boyut: [420, 595] }); // A5 yatay-olmayan
    expect(await boyutlar((await sayfaBoyutuDegistir(b, { boyut: 'A4' })).bayt)).toEqual([[595, 842], [595, 842]]);
    expect(await boyutlar((await sayfaBoyutuDegistir(b, { boyut: 'yuzde', yuzde: 50 })).bayt)).toEqual([[210, 298], [210, 298]]);
    expect((await boyutlar((await sayfaBoyutuDegistir(b, { boyut: 'ozel', genislikMM: 100, yukseklikMM: 100 })).bayt))[0]).toEqual([283, 283]);
  });
  for (const don of [90, 180, 270]) {
    it(`döndürülmüş (${don}°) sayfa, %100 ölçekte görünümü aynen korur`, async () => {
      const b = await etiketli(1, { boyut: [300, 400], don });
      const r = await sayfaBoyutuDegistir(b, { boyut: 'yuzde', yuzde: 100 });
      const [a, c] = [await belgeAc(b), await belgeAc(r.bayt)];
      const x = await sayfaCiz(a, 1, { olcek: 0.5 }), y = await sayfaCiz(c, 1, { olcek: 0.5 });
      expect([y.genislik, y.yukseklik]).toEqual([x.genislik, x.yukseklik]);
      const dx = x.tuval.getContext('2d').getImageData(0, 0, x.genislik, x.yukseklik).data, dy = y.tuval.getContext('2d').getImageData(0, 0, y.genislik, y.yukseklik).data;
      let fark = 0; for (let i = 0; i < dx.length; i += 4) if (Math.abs(dx[i] - dy[i]) > 60) fark++;
      expect(fark / (dx.length / 4)).toBeLessThan(0.01);
      await a.kapat(); await c.kapat();
    });
  }
  it('üst üste bindirme: filigran her sayfaya biner (döngü), arkaya da konabilir', async () => {
    const ana = await etiketli(3);
    const ust = await etiketli(1, { boyut: [200, 200] });
    const r = await ustUsteBindir(ana, ust, { tekrar: 'dongu' });
    const m = (await sayfaMetinleri(r.bayt)).map((x) => x.replace(/\s+/g, ' '));
    expect(m).toEqual(['S1 S1', 'S2 S1', 'S3 S1']);
    const yok = await ustUsteBindir(ana, await etiketli(2), { tekrar: 'yok' });
    expect((await sayfaMetinleri(yok.bayt))[2].replace(/\s+/g, ' ')).toBe('S3');
    expect((await sayfaMetinleri((await ustUsteBindir(ana, ust, { arkada: true, opaklik: 0.5 })).bayt))[0]).toContain('S1');
  });
});
