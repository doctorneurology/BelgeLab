import { describe, it, expect, afterAll } from 'vitest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { pdfdenMarkdown, mdKacis } from '../src/core/pdf-markdown.js';
import { pdfdenWord } from '../src/core/pdf-word.js';
import { ocrKapat } from '../src/core/ocr.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { wordTestPdf, docxOku } from './yardimci/word-pdf.js';
import { taramaPdf, TARAMA_SATIRLARI } from './yardimci/tarama.js';
import { ornekPdf } from './yardimci/pdf-uret.js';

afterAll(() => ocrKapat());

describe('PDF → Markdown', () => {
  let r, md;
  it('başlıklar #, paragraflar bütün, madde işaretleri "-", tablo GFM, resim ayrı PNG dosyası', async () => {
    const pdf = await wordTestPdf({ sayfa: 3 });
    r = await pdfdenMarkdown(pdf);
    md = r.md;
    console.log(md);
    expect(md).toMatch(/^# Kardiyoloji Çalışması Raporu$/m);
    expect(md).toMatch(/^## Bulgular ve Tartışma$/m);
    expect(md).toContain('bölünmüş olup bulgular'); // tireli satır sonu birleşti
    expect(md).toContain('bununla birlikte izlem süresinin uzatılması'); // sayfalar arası paragraf
    expect(md.match(/^- /gm)?.length).toBe(3);
    expect(md).toContain('- İlk madde: yaş ortalaması 58\n- İkinci madde');
    expect(md).toMatch(/\| Grup \| Hasta sayısı \| Ortalama yaş \|\n\| --- \| --- \| --- \|\n\| Kontrol \| 120 \| 54,2 \|/);
    expect(md).toMatch(/!\[Resim 1 \(sayfa 1\)\]\(resimler\/resim-001\.png\)/);
    expect(r.resimler.length).toBe(1);
    expect(r.resimler[0].ad).toBe('resimler/resim-001.png');
    expect(Buffer.from(r.resimler[0].bayt.subarray(0, 4)).toString('hex')).toBe('89504e47'); // PNG
    // sayfa numarası / üst bilgi yok
    expect(md).not.toContain('Örnek Kurum Bülteni');
    expect(md).not.toMatch(/Sayfa \d/);
    expect(r.uyarilar[0]).toContain('birebir uymaz');
  });

  it('SAYFA SINIRI YOK: 120 sayfalık belge tek seferde dönüşür; hiçbir sayfa kaybolmaz', async () => {
    const pdf = await ornekPdf({ sayfa: 120, baslik: 'Bölüm' });
    let sonIlerleme = 0;
    const s = await pdfdenMarkdown(pdf, { ilerleme: (k) => { sonIlerleme = k; } });
    expect(sonIlerleme).toBeGreaterThanOrEqual(119);
    for (const n of [1, 37, 64, 120]) expect(s.md).toContain(`Bölüm ${n} / 120`);
    expect((s.md.match(/Bölüm \d+ \/ 120/g) ?? []).length).toBe(120);
  }, 120000);

  it('kalın/italik, bağlantı ve özel karakterler doğru yazılır', async () => {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    const fk = await yaziTipiGom(doc, 'liberation-sans', { kalin: true });
    const fi = await yaziTipiGom(doc, 'liberation-sans', { italik: true });
    const p = doc.addPage([595, 842]);
    p.drawText('Normal ', { x: 72, y: 700, size: 12, font: f });
    const w1 = f.widthOfTextAtSize('Normal ', 12);
    p.drawText('kalın', { x: 72 + w1, y: 700, size: 12, font: fk });
    const w2 = w1 + fk.widthOfTextAtSize('kalın ', 12);
    p.drawText('eğik', { x: 72 + w2, y: 700, size: 12, font: fi });
    p.drawText('site', { x: 72, y: 660, size: 12, font: f });
    p.drawText('2*3_x [a] #etiket', { x: 72, y: 620, size: 12, font: f });
    // bağlantı açıklaması "site" sözcüğünün üstünde
    const link = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [70, 655, 110, 675], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://ornek.org/yol') } });
    p.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(link)]));
    const pdf = new Uint8Array(await doc.save());
    const s = await pdfdenMarkdown(pdf);
    console.log(s.md);
    expect(s.md).toContain('**kalın**');
    expect(s.md).toContain('*eğik*');
    expect(s.md).toContain('[site](https://ornek.org/yol)');
    expect(s.md).toContain(String.raw`2\*3\_x \[a\] #etiket`);
    expect(mdKacis('# başlık', { satirBasi: true })).toBe(String.raw`\# başlık`);
    // Word çıktısında da köprü oluşur
    const d = await docxOku((await pdfdenWord(pdf)).bayt);
    expect(d.xml).toContain('<w:hyperlink');
    expect(d.zip.file('word/_rels/document.xml.rels')).toBeTruthy();
    expect(await d.zip.file('word/_rels/document.xml.rels').async('string')).toContain('https://ornek.org/yol');
  });

  it('resim seçenekleri: gömülü (base64, tek dosya), yok; sayfa ayracı', async () => {
    const pdf = await wordTestPdf({ sayfa: 2 });
    const g = await pdfdenMarkdown(pdf, { resimler: 'gomulu', sayfaAyirac: true });
    expect(g.resimler.length).toBe(0);
    expect(g.md).toContain('](data:image/png;base64,iVBOR');
    expect(g.md).toContain('<!-- Sayfa 1 -->');
    expect(g.md).toContain('<!-- Sayfa 2 -->');
    const y = await pdfdenMarkdown(pdf, { resimler: 'yok' });
    expect(y.md).not.toContain('![');
  });

  it('taranmış sayfa: OCR ile okunur ve uyarılır', async () => {
    const { bayt } = await taramaPdf([{ baslik: 'Hasta Epikrizi', satirlar: TARAMA_SATIRLARI }], { dpi: 200, boyut: 12 });
    const s = await pdfdenMarkdown(bayt, { ocrDpi: 300 });
    expect(s.md).toMatch(/^# Hasta Epikrizi$/m);
    expect(s.md).toContain('göğüs kafesinin sol tarafında');
    expect(s.uyarilar.join(' ')).toContain('OCR ile okundu');
  });
});
