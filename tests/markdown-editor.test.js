import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { markdownHtml, markdownHtmlBelgesi, markdownPdf, markdownDocx } from '../src/core/markdown-editor.js';
import { belgeAc } from '../src/core/render.js';

const MD = `# Başlık ĞÜŞİ

Bir **kalın**, bir *eğik* ve \`kod\` içeren paragraf. [Bağlantı](https://ornek.org)

## Liste
- Madde bir
- Madde iki
  - İç madde

1. Birinci
2. İkinci

| Ad | Değer |
|----|-------|
| a  | 1     |
| b  | 2     |

> Alıntı metni

\`\`\`
kod satırı
\`\`\`
`;

describe('Markdown editörü çekirdeği', () => {
  it('HTML üretir (başlık, liste, tablo, bağlantı, kaçış)', () => {
    const h = markdownHtml(MD);
    expect(h).toContain('<h1>Başlık ĞÜŞİ</h1>');
    expect(h).toContain('<strong>kalın</strong>');
    expect(h).toContain('<table>');
    expect(h).toContain('<a href="https://ornek.org">Bağlantı</a>');
    expect(markdownHtmlBelgesi(MD)).toMatch(/<title>Başlık ĞÜŞİ<\/title>/);
    expect(markdownHtmlBelgesi('x')).toContain('<html lang="tr">');
  });

  it('PDF üretir ve metin içerir', async () => {
    const r = await markdownPdf(MD);
    expect(r.sayfa).toBeGreaterThanOrEqual(1);
    const belge = await belgeAc(r.bayt); const s = await belge.getPage(1);
    const m = (await s.getTextContent()).items.map((o) => o.str).join(' ');
    expect(m).toContain('Başlık');
    expect(m).toContain('Madde bir');
    await belge.kapat();
    await expect(markdownPdf('   ')).rejects.toThrow(/metin/);
  });

  it('Word (.docx) üretir: başlık, kalın, liste, tablo, bağlantı', async () => {
    const b = await markdownDocx(MD);
    const z = await JSZip.loadAsync(b);
    const x = await z.file('word/document.xml').async('string');
    expect(x).toContain('Heading1');
    expect(x).toContain('Başlık ĞÜŞİ');
    expect(x).toMatch(/<w:b\/>[\s\S]*kalın/);
    expect(x).toContain('<w:tbl>');
    expect(x).toContain('Madde iki');
    expect(x).toContain('İç madde');
    expect(x).toContain('Alıntı metni');
    expect(x).toContain('kod satırı');
    const rels = await z.file('word/_rels/document.xml.rels').async('string');
    expect(rels).toContain('https://ornek.org');
  });
});
