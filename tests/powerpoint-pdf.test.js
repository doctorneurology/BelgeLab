import { describe, it, expect } from 'vitest';
import PptxGenJS from 'pptxgenjs';
import { powerpointPdf } from '../src/core/powerpoint-pdf.js';
import { pdfdenPowerPoint } from '../src/core/pdf-powerpoint.js';
import { metinCikar, sayfaPikselleri } from '../tools/karsilastir.mjs';
import { belgeAc } from '../src/core/render.js';
import { pngUret, ornekPdf } from './yardimci/pdf-uret.js';

async function ornekPptx(slaytSayisi = 3) {
  const p = new PptxGenJS();
  p.layout = 'LAYOUT_16x9';
  for (let i = 1; i <= slaytSayisi; i++) {
    const s = p.addSlide();
    s.background = { color: i === 2 ? '1F3864' : 'FFFFFF' };
    s.addText(`Slayt ${i} Başlığı ĞÜŞİÖÇ`, { x: 0.5, y: 0.3, w: 9, h: 0.9, fontSize: 32, bold: true, color: i === 2 ? 'FFFFFF' : '000000', fontFace: 'Arial' });
    s.addText([{ text: 'Birinci madde ', options: { bullet: true, breakLine: true } }, { text: 'İkinci madde ığüşöç', options: { bullet: true } }], { x: 0.5, y: 1.4, w: 5, h: 1.6, fontSize: 18, color: i === 2 ? 'FFFFFF' : '222222' });
    s.addShape(p.ShapeType.rect, { x: 6, y: 1.5, w: 2.5, h: 1.2, fill: { color: 'C00000' } });
    if (i === 1) s.addImage({ data: `image/png;base64,${Buffer.from(pngUret(40, 30, [10, 160, 20, 255])).toString('base64')}`, x: 6, y: 3, w: 2, h: 1.5 });
    if (i === 3) s.addTable([[{ text: 'Ad', options: { bold: true } }, { text: 'Değer', options: { bold: true } }], ['Elma', '5'], ['Armut', '7']], { x: 0.5, y: 3.2, w: 5, colW: [2.5, 2.5], fontSize: 14 });
  }
  return new Uint8Array(await p.write({ outputType: 'uint8array' }));
}

describe('PowerPoint (.pptx) → PDF', () => {
  it('her slayt bir sayfa; slayt boyutu korunur; metin, madde, tablo, şekil rengi ve resim yerinde', async () => {
    const r = await powerpointPdf(await ornekPptx(3), { dosyaAdi: 'sunum.pptx' });
    console.log(JSON.stringify(r.bilgi), r.uyarilar.join('\n '));
    expect(r.sayfa).toBe(3);
    const t = await metinCikar(r.bayt);
    expect(t[0]).toContain('Slayt 1 Başlığı ĞÜŞİÖÇ');
    expect(t[0]).toContain('İkinci madde ığüşöç');
    expect(t[1]).toContain('Slayt 2 Başlığı');
    expect(t[2]).toContain('Armut');
    expect(t[2]).toContain('Değer');
    const b = await belgeAc(r.bayt);
    const v = (await b.getPage(1)).getViewport({ scale: 1 });
    await b.kapat();
    expect(Math.round(v.width)).toBe(720); // 10 inç
    expect(Math.round(v.height)).toBe(405); // 5,625 inç (16:9)
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    const nokta = (x, y) => { const i = (Math.round(y) * px.genislik + Math.round(x)) * 4; return [px.veri[i], px.veri[i + 1], px.veri[i + 2]]; };
    expect(nokta(6.5 * 72, 2 * 72)).toEqual([192, 0, 0]); // kırmızı dikdörtgen
    expect(nokta(7 * 72, 3.7 * 72)[1]).toBeGreaterThan(140); // yeşil resim
    const px2 = await sayfaPikselleri(r.bayt, 2, { olcek: 1 });
    expect([px2.veri[4000 * 4], px2.veri[4000 * 4 + 2]]).toEqual([0x1f, 0x64]); // lacivert arka plan
    expect(r.uyarilar[0]).toContain('birebir üretilmez');
  });

  it('GİDİŞ-DÖNÜŞ: PDF → PowerPoint → PDF metin kaybı olmadan geri döner', async () => {
    const pdf = await ornekPdf({ sayfa: 2, baslik: 'Bölüm' });
    const ppt = await pdfdenPowerPoint(pdf, { dpi: 72 });
    const geri = await powerpointPdf(ppt.bayt);
    expect(geri.sayfa).toBe(2);
    const t = (await metinCikar(geri.bayt)).join(' ');
    expect(t).toContain('Bölüm 1 / 2');
    expect(t).toContain('Bölüm 2 / 2');
    expect(t).toContain('ĞÜŞİÖÇ');
  });

  it('SLAYT SINIRI YOK: 300 slaytlık sunum; geçersiz dosyalar anlaşılır hata verir', async () => {
    const r = await powerpointPdf(await ornekPptx(300));
    expect(r.sayfa).toBe(300);
    expect((await metinCikar(r.bayt))[299]).toContain('Slayt 300');
    await expect(powerpointPdf(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1]))).rejects.toThrow(/\.pptx/);
    await expect(powerpointPdf(new Uint8Array([0x50, 0x4b, 1, 2, 3]))).rejects.toThrow(/açılamadı/);
  }, 240000);
});
