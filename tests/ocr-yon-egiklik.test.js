import { describe, it, expect, afterAll } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { egiklikAcisi, tuvaliDondur } from '../src/core/egiklik.js';
import { pdfOcr, ocrKapat } from '../src/core/ocr.js';
import { belgeAc } from '../src/core/render.js';
import { taramaPdf, TARAMA_SATIRLARI, sadelestir } from './yardimci/tarama.js';

afterAll(() => ocrKapat());

async function metin(bayt) {
  const b = await belgeAc(bayt); let s = '';
  for (let i = 1; i <= b.numPages; i++) { const p = await b.getPage(i); s += (await p.getTextContent()).items.map((o) => o.str).join(' ') + ' '; }
  await b.kapat(); return s;
}

describe('eğiklik açısı', () => {
  it('yazı satırlarının eğikliğini bulur ve düzeltir', () => {
    const c = createCanvas(1200, 1600); const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 1600); g.fillStyle = '#000'; g.font = '34px sans-serif';
    g.translate(600, 800); g.rotate((2.5 * Math.PI) / 180); g.translate(-600, -800); // saat yönünde 2,5° eğik
    for (let i = 0; i < 28; i++) g.fillText('Hastanın şikâyetleri üç gündür devam etmektedir ve kontrol önerildi.', 100, 140 + i * 48);
    const e = egiklikAcisi(c);
    expect(e.aci).toBeGreaterThan(-3.2); expect(e.aci).toBeLessThan(-1.8); // düzeltme açısı ≈ -2,5
    expect(Math.abs(egiklikAcisi(tuvaliDondur(c, e.aci)).aci)).toBeLessThanOrEqual(0.6);
    // yazısız sayfa: açı 0
    const bos = createCanvas(600, 800); bos.getContext('2d').fillStyle = '#fff'; bos.getContext('2d').fillRect(0, 0, 600, 800);
    expect(egiklikAcisi(bos).aci).toBe(0);
  });
});

describe('OCR: yan duran sayfa, eğik tarama, yeniden okuma', () => {
  it('yan duran (90°) taranmış sayfa dik döndürülür ve okunur', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 });
    const doc = await PDFDocument.load(bayt); doc.getPage(0).setRotation(degrees(90));
    const yan = new Uint8Array(await doc.save());
    const r = await pdfOcr(yan, { dil: 'tur', dpi: 200, yon: 'otomatik' });
    expect(r.degisti).toBe(true);
    const cikti = await PDFDocument.load(r.bayt);
    expect(cikti.getPage(0).getRotation().angle % 360).toBe(0);
    expect(r.uyarilar.join(' ')).toMatch(/döndürüldü/);
    const m = sadelestir(await metin(r.bayt));
    expect(m).toContain(sadelestir('Hastanın şikâyetleri'));
  }, 180000);

  it('dik sayfa döndürülmez', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 });
    const r = await pdfOcr(bayt, { dil: 'tur', dpi: 200, yon: 'otomatik' });
    expect((await PDFDocument.load(r.bayt)).getPage(0).getRotation().angle).toBe(0);
    expect(r.uyarilar.join(' ')).not.toMatch(/döndürüldü/);
  }, 180000);

  it('eğik tarama düzeltilir, okunur; eski sayfa dosyada kalmaz', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200, egim: 2.2 });
    const duz = await pdfOcr(bayt, { dil: 'tur', dpi: 200, egiklik: 'duzelt' });
    expect(duz.rapor[0].egiklik).not.toBe(0);
    expect(duz.uyarilar.join(' ')).toMatch(/eğikliği düzeltildi/);
    expect(sadelestir(await metin(duz.bayt))).toContain(sadelestir('Hastanın şikâyetleri'));
    expect((await PDFDocument.load(duz.bayt)).getPageCount()).toBe(1);
    expect(duz.bayt.length).toBeLessThan(bayt.length * 3); // özgün taramayı ikinci kez taşımaz
  }, 180000);

  it('yeniden oku: bu sitenin OCR katmanı silinip yeniden yazılır', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 });
    const ilk = await pdfOcr(bayt, { dil: 'tur', dpi: 200 });
    const atla = await pdfOcr(ilk.bayt, { dil: 'tur', dpi: 200 });
    expect(atla.degisti).toBe(false); // yazısı var → atlanır
    const yeni = await pdfOcr(ilk.bayt, { dil: 'tur', dpi: 200, yeniden: true });
    expect(yeni.degisti).toBe(true);
    expect(yeni.uyarilar.join(' ')).toMatch(/silinip yeniden okundu/);
    expect(sadelestir(await metin(yeni.bayt))).toContain(sadelestir('Hastanın şikâyetleri'));
  }, 240000);

  it('Türkçe + İngilizce birlikte okuma çalışır', async () => {
    const { bayt } = await taramaPdf([['Hastanın şikâyetleri devam ediyor.', 'The patient presented with acute ischemic stroke.']], { dpi: 200 });
    const r = await pdfOcr(bayt, { dil: 'tur+eng', dpi: 200 });
    const m = sadelestir(await metin(r.bayt));
    expect(m).toContain(sadelestir('acute ischemic stroke'));
    expect(m).toContain(sadelestir('şikâyetleri'));
  }, 240000);
});
