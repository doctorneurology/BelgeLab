import { describe, it, expect } from 'vitest';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, ExternalHyperlink,
  AlignmentType, PageBreak, LevelFormat,
} from 'docx';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { wordPdf } from '../src/core/word-pdf.js';
import { metinCikar, sayfaPikselleri, doluluk } from '../tools/karsilastir.mjs';
import { belgeAc } from '../src/core/render.js';
import { pngUret } from './yardimci/pdf-uret.js';

const UZUN = 'Kalp ve damar hastalıkları dünyada ölümlerin en önemli nedenlerinden biri olmaya devam etmektedir. Çalışmada hastaların yaş, cinsiyet ve laboratuvar değerleri incelenmiş, ğüşıöç ĞÜŞİÖÇ karakterleri denenmiştir. ';

async function ornekDocx() {
  const belge = new Document({
    numbering: { config: [{ reference: 'liste', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] }] },
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Rapor Başlığı ĞÜŞ')] }),
        new Paragraph({ children: [new TextRun(UZUN.repeat(3)), new TextRun({ text: 'kalın kısım', bold: true }), new TextRun(' ve '), new TextRun({ text: 'eğik kısım', italics: true })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Alt Başlık')] }),
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun('Birinci madde')] }),
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun('İkinci madde')] }),
        new Paragraph({ numbering: { reference: 'liste', level: 0 }, children: [new TextRun('Numaralı bir')] }),
        new Paragraph({ numbering: { reference: 'liste', level: 0 }, children: [new TextRun('Numaralı iki')] }),
        new Paragraph({ children: [new TextRun('Bağlantı: '), new ExternalHyperlink({ link: 'https://ornek.org/yol', children: [new TextRun({ text: 'ornek.org', style: 'Hyperlink' })] })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [['Grup', 'Sayı', 'Yaş'], ['Kontrol', '120', '54,2'], ['Hasta', '98', '61,7']].map((s) => new TableRow({ children: s.map((m) => new TableCell({ children: [new Paragraph(m)] })) })),
        }),
        new Paragraph({ children: [new ImageRun({ type: 'png', data: pngUret(60, 40, [200, 30, 30, 255]), transformation: { width: 150, height: 100 } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('Ortalı satır')] }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ children: [new TextRun('İkinci sayfanın metni')] }),
        ...Array.from({ length: 60 }, (_, i) => new Paragraph({ children: [new TextRun(`Uzun belge satırı ${i + 1}. ${UZUN}`)] })),
      ],
    }],
  });
  return new Uint8Array(await Packer.toBuffer(belge));
}

describe('Word (.docx) → PDF', () => {
  let r, m;
  it('docx PDF olur: Türkçe metin, başlıklar, kalın/eğik, listeler, tablo ve resim yerinde', async () => {
    const docx = await ornekDocx();
    r = await wordPdf(docx, { dosyaAdi: 'rapor.docx' });
    m = (await metinCikar(r.bayt)).join(' ');
    console.log('sayfa:', r.sayfa, JSON.stringify(r.bilgi), '\n', r.uyarilar.join('\n '));
    expect(r.sayfa).toBeGreaterThan(2);
    for (const s of ['Rapor Başlığı ĞÜŞ', 'ğüşıöç ĞÜŞİÖÇ', 'kalın kısım', 'eğik kısım', 'Alt Başlık', 'Birinci madde', 'Numaralı iki', 'İkinci sayfanın metni', 'Ortalı satır']) {
      expect(m, s).toContain(s);
    }
    expect(m).toContain('•');
    expect(m).toContain('1.');
    expect(m).toMatch(/2\.\s*Numaralı iki|2\./);
    // tablo hücreleri
    for (const s of ['Grup', 'Kontrol', '120', '54,2', '61,7']) expect(m).toContain(s);
    expect(r.bilgi).toMatchObject({ tablo: 1, resim: 1 });
    expect(r.uyarilar[0]).toContain('birebir aynısı olmaz');
  });

  it('başlık gövdeden büyük çizilir; resim sayfada görünür (kırmızı piksel)', async () => {
    const belge = await belgeAc(r.bayt);
    const s1 = await belge.getPage(1);
    const ic = await s1.getTextContent();
    const boyut = (parca) => ic.items.find((o) => o.str.includes(parca))?.height;
    expect(boyut('Rapor Başlığı')).toBeGreaterThan(boyut('Kalp ve damar') * 1.3);
    await belge.kapat();
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    let kirmizi = 0;
    for (let i = 0; i < px.veri.length; i += 4) if (px.veri[i] > 180 && px.veri[i + 1] < 60 && px.veri[i + 2] < 60) kirmizi++;
    expect(kirmizi).toBeGreaterThan(5000); // 150x100 pt kırmızı resim
  });

  it('köprü bağlantısı PDF\'te tıklanabilir (Link açıklaması)', async () => {
    const doc = await PDFDocument.load(r.bayt);
    const adresler = [];
    for (const p of doc.getPages()) {
      const a = p.node.lookup(PDFName.of('Annots'));
      if (a instanceof PDFArray) for (let i = 0; i < a.size(); i++) { const d = a.lookup(i); if (d instanceof PDFDict) adresler.push(d.lookup(PDFName.of('A')).lookup(PDFName.of('URI')).decodeText()); }
    }
    expect(adresler).toContain('https://ornek.org/yol');
  });

  it('sayfa sınırı yok: 400 paragraflık belge tek seferde dönüşür, hepsi PDF\'te', async () => {
    const belge = new Document({ sections: [{ children: Array.from({ length: 400 }, (_, i) => new Paragraph({ children: [new TextRun(`Satır numarası ${i + 1} — ${UZUN}`)] })) }] });
    const s = await wordPdf(new Uint8Array(await Packer.toBuffer(belge)));
    expect(s.sayfa).toBeGreaterThan(20);
    const t = (await metinCikar(s.bayt)).join(' ');
    for (const n of [1, 200, 400]) expect(t).toContain(`Satır numarası ${n} —`);
  }, 120000);

  it('geçersiz girdiler anlaşılır hata verir (.doc, bozuk, boş docx)', async () => {
    await expect(wordPdf(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]))).rejects.toThrow(/\.docx/);
    await expect(wordPdf(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]))).rejects.toThrow(/açılamadı/);
    const bos = new Document({ sections: [{ children: [] }] });
    await expect(wordPdf(new Uint8Array(await Packer.toBuffer(bos)))).rejects.toThrow(/içerik bulunamadı/);
  });
});
