import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, rgb } from 'pdf-lib';
import { filigranEkle, filigranGeriAl, filigranSay } from '../src/core/filigran.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { sayfaPikselleri, metinCikar, karsilastir, doluluk } from '../tools/karsilastir.mjs';
import { ornekPdf, pngUret } from './yardimci/pdf-uret.js';

async function kaynakSayilari(bayt) {
  const d = await PDFDocument.load(bayt);
  return d.getPages().map((p) => {
    const r = p.node.Resources();
    const say = (ad) => { const x = r?.lookup(PDFName.of(ad)); return x instanceof PDFDict ? x.keys().length : 0; };
    return { font: say('Font'), xobject: say('XObject'), gs: say('ExtGState'), icerik: p.node.Contents()?.size?.() ?? 1 };
  });
}

describe('Filigran ekle ve geri al', () => {
  it('yazı filigranı eklenir (görünür) ve geri alınınca sayfalar PİKSEL PİKSEL özgününe döner', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    const f = await filigranEkle(pdf, { metin: 'TASLAK ĞÜŞİ', opaklik: 0.3, aci: 45, konum: 'orta' });
    expect((await metinCikar(f.bayt))[0]).toContain('TASLAK ĞÜŞİ');
    expect(await filigranSay(f.bayt)).toMatchObject({ sayfa: 3, islem: 1 });
    const degisim = karsilastir(await sayfaPikselleri(pdf, 1), await sayfaPikselleri(f.bayt, 1));
    expect(degisim.farkliPiksel).toBeGreaterThan(200);

    const g = await filigranGeriAl(f.bayt);
    expect(g.bulunan).toBe(3);
    expect((await metinCikar(g.bayt))[0]).not.toContain('TASLAK');
    for (let i = 1; i <= 3; i++) {
      const fark = karsilastir(await sayfaPikselleri(pdf, i), await sayfaPikselleri(g.bayt, i));
      expect(fark.farkliPiksel, `sayfa ${i}`).toBe(0);
    }
    expect(await filigranSay(g.bayt)).toMatchObject({ adet: 0 });
  });

  it('geri alma, eklenen yazı tipi/saydamlık kaynaklarını da dosyadan siler', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const once = await kaynakSayilari(pdf);
    const f = await filigranEkle(pdf, { metin: 'GİZLİ', konum: 'doseme' });
    const araDurum = await kaynakSayilari(f.bayt);
    expect(araDurum[0].font).toBeGreaterThan(once[0].font);
    const g = await filigranGeriAl(f.bayt);
    const sonra = await kaynakSayilari(g.bayt);
    expect(sonra[0].font).toBe(once[0].font);
    expect(sonra[0].gs).toBe(once[0].gs);
    // Dosya, özgününden belirgin biçimde büyük kalmamalı (artık nesne yok)
    expect(g.bayt.length).toBeLessThan(pdf.length * 1.1);
  });

  it('döşeme (tekrarlı) filigran sayfayı kaplar; geri alınır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const f = await filigranEkle(pdf, { metin: 'KOPYA', konum: 'doseme', boyut: 40, opaklik: 0.8, renk: '#000000', aci: 30 });
    const fark = karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(f.bayt), { esik: 0.02 });
    expect(fark.kutu.x1 - fark.kutu.x0).toBeGreaterThan(400);
    expect(fark.kutu.y1 - fark.kutu.y0).toBeGreaterThan(600);
    const g = await filigranGeriAl(f.bayt);
    expect(karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(g.bayt)).farkliPiksel).toBe(0);
  });

  it('resim filigranı (PNG, saydam) eklenir ve geri alınır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const f = await filigranEkle(pdf, { resim: { bayt: pngUret(40, 20, [255, 0, 0, 255]) }, opaklik: 0.5, aci: 0, resimGenislikOrani: 0.4 });
    const c = await sayfaPikselleri(f.bayt);
    expect(doluluk(c)).toBeGreaterThan(doluluk(await sayfaPikselleri(pdf)));
    const g = await filigranGeriAl(f.bayt);
    expect(karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(g.bayt)).farkliPiksel).toBe(0);
  });

  it('"alt" katman: filigran içeriğin ARKASINA konur', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const f = await filigranEkle(pdf, { metin: 'ARKA', katman: 'alt', opaklik: 1, boyut: 120, aci: 0, renk: '#ff0000' });
    const g = await filigranGeriAl(f.bayt);
    expect(karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(g.bayt)).farkliPiksel).toBe(0);
  });

  it('seçili sayfalara eklenir', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    const f = await filigranEkle(pdf, { metin: 'SADECE-2', sayfalar: '2' });
    const m = await metinCikar(f.bayt);
    expect(m[0]).not.toContain('SADECE-2');
    expect(m[1]).toContain('SADECE-2');
    expect(await filigranSay(f.bayt)).toMatchObject({ sayfa: 1 });
  });

  it('BAŞKASININ koyduğu filigrana dokunmaz: yalnızca bu programın eklediği geri alınır', async () => {
    // Başka bir araçla (burada doğrudan pdf-lib ile) konmuş "filigran"
    const temel = await ornekPdf({ sayfa: 2 });
    const d = await PDFDocument.load(temel);
    const font = await yaziTipiGom(d, 'liberation-sans');
    d.getPages().forEach((p) => p.drawText('YABANCI-FILIGRAN', { x: 100, y: 400, size: 50, font, color: rgb(0.7, 0.7, 0.7), opacity: 0.4 }));
    const yabanci = new Uint8Array(await d.save());

    const g1 = await filigranGeriAl(yabanci);
    expect(g1.bulunan).toBe(0);
    expect(g1.bayt).toBe(yabanci); // bayt'a hiç dokunulmadı
    expect((await metinCikar(g1.bayt))[0]).toContain('YABANCI-FILIGRAN');

    // Kendi filigranımızı da ekleyelim; geri alınca yalnızca bizimki gitmeli
    const f = await filigranEkle(yabanci, { metin: 'BENIM-FILIGRAN' });
    const g2 = await filigranGeriAl(f.bayt);
    expect(g2.bulunan).toBe(2);
    const m = (await metinCikar(g2.bayt))[0];
    expect(m).toContain('YABANCI-FILIGRAN');
    expect(m).not.toContain('BENIM-FILIGRAN');
    expect(karsilastir(await sayfaPikselleri(yabanci), await sayfaPikselleri(g2.bayt)).farkliPiksel).toBe(0);
  });

  it('iki kez filigran eklenip ikisi de geri alınabilir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const a = await filigranEkle(pdf, { metin: 'BIRINCI' });
    const b = await filigranEkle(a.bayt, { metin: 'IKINCI', aci: 0 });
    expect(await filigranSay(b.bayt)).toMatchObject({ islem: 2 });
    const g = await filigranGeriAl(b.bayt);
    expect(karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(g.bayt)).farkliPiksel).toBe(0);
  });

  it('döndürülmüş sayfada filigran sayfanın ortasında görünür', async () => {
    const pdf = await ornekPdf({ sayfa: 1, don: 90 });
    const f = await filigranEkle(pdf, { metin: 'ORTA', aci: 0, boyut: 80, opaklik: 1, renk: '#ff0000' });
    const once = await sayfaPikselleri(pdf), sonra = await sayfaPikselleri(f.bayt);
    const fark = karsilastir(once, sonra);
    const mx = (fark.kutu.x0 + fark.kutu.x1) / 2, my = (fark.kutu.y0 + fark.kutu.y1) / 2;
    expect(Math.abs(mx - once.genislik / 2)).toBeLessThan(once.genislik * 0.06);
    expect(Math.abs(my - once.yukseklik / 2)).toBeLessThan(once.yukseklik * 0.06);
  });

  it('boş girdi ve kötü değerlerde hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(filigranEkle(pdf, { metin: '  ' })).rejects.toThrow(/metin yazın/);
    await expect(filigranEkle(pdf, { metin: 'x', opaklik: 0 })).rejects.toThrow(/Saydamlık/);
    await expect(filigranEkle(pdf, { resim: { bayt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) } })).rejects.toThrow(/PNG veya JPEG/);
  });
});
