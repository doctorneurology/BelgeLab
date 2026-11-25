import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { pdfdenWordDuzenli } from '../src/core/pdf-word-duzen.js';
import { wordTestPdf } from './yardimci/word-pdf.js';
import { taramaPdf } from './yardimci/tarama.js';

async function belgeXml(bayt) {
  const z = await JSZip.loadAsync(bayt);
  return { z, xml: await z.file('word/document.xml').async('string') };
}
const metinler = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' ');

describe('PDF → Word, "düzeni koru" kipi (GenOffice pdf2docx)', () => {
  it('geçerli docx üretir; metin, tablo ve resim gelir', async () => {
    const r = await pdfdenWordDuzenli(await wordTestPdf({ sayfa: 3 }));
    const { z, xml } = await belgeXml(r.bayt);
    expect(r.bilgi.sayfa).toBe(3);
    expect(Object.keys(z.files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'word/document.xml']));
    const m = metinler(xml);
    expect(m).toContain('Kardiyoloji');
    expect(m).toContain('Bulgular');
    expect(xml).toContain('<w:tbl>');
    expect(Object.keys(z.files).some((k) => k.startsWith('word/media/'))).toBe(true);
    expect(r.uyarilar.join(' ')).toMatch(/GÖRÜNÜŞÜNÜ/);
  });

  it('sayfa aralığı seçilebilir', async () => {
    const r = await pdfdenWordDuzenli(await wordTestPdf({ sayfa: 3 }), { sayfalar: '2' });
    expect(r.bilgi.sayfa).toBe(1);
  });

  it('taranmış belgede OCR yapılmaz ve açıkça uyarılır', async () => {
    const { bayt } = await taramaPdf([['Taranmış sayfa metni bir', 'ikinci satır']], { dpi: 150 });
    const r = await pdfdenWordDuzenli(bayt);
    expect(r.bilgi.taranmis).toBe(true);
    expect(r.uyarilar.join(' ')).toMatch(/taranmış/);
  });

  it('bozuk dosyada anlaşılır hata verir', async () => {
    await expect(pdfdenWordDuzenli(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow();
  });
});
