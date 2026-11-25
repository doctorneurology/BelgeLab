import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { pdfdenMetin } from '../src/core/pdf-metin.js';
import { wordTestPdf } from './yardimci/word-pdf.js';

const metin = (b) => new TextDecoder().decode(b);

describe('PDF → TXT / HTML / EPUB', () => {
  it('TXT: paragraflar, madde, tablo (sekme ayrılmış)', async () => {
    const r = await pdfdenMetin(await wordTestPdf({ sayfa: 3 }), 'rapor.pdf', { bicim: 'txt' });
    expect(r.dosyalar).toHaveLength(1);
    expect(r.dosyalar[0].ad).toBe('rapor.txt');
    const t = metin(r.dosyalar[0].bayt);
    expect(t).toContain('Kardiyoloji Çalışması Raporu');
    expect(t).toContain('- İlk madde');
    expect(t).toMatch(/Kontrol\t120\t54,2/);
    expect(t).toContain('bununla birlikte izlem süresinin uzatılması');
    expect(t).not.toMatch(/<[a-z]/);
  });

  it('HTML: başlık/madde/tablo etiketleri, kaçışlı, resim ayrı dosya', async () => {
    const r = await pdfdenMetin(await wordTestPdf({ sayfa: 3 }), 'rapor.pdf', { bicim: 'html' });
    const html = metin(r.dosyalar[0].bayt);
    expect(r.dosyalar[0].ad).toBe('rapor.html');
    expect(html).toMatch(/<h1>Kardiyoloji Çalışması Raporu<\/h1>/);
    expect(html).toMatch(/<h2>Bulgular ve Tartışma<\/h2>/);
    expect(html.match(/<li>/g)?.length).toBe(3);
    expect(html).toMatch(/<table><tr><th>Grup<\/th>/);
    expect(html).toContain('<html lang="tr">');
    expect(r.dosyalar.length).toBe(2);
    expect(r.dosyalar[1].ad).toBe('rapor-resimler/resim-001.png');
    expect(html).toContain('src="rapor-resimler/resim-001.png"');
    const g = await pdfdenMetin(await wordTestPdf({ sayfa: 3 }), 'rapor.pdf', { bicim: 'html', resimler: 'gomulu' });
    expect(g.dosyalar).toHaveLength(1);
    expect(metin(g.dosyalar[0].bayt)).toContain('data:image/png;base64,');
  });

  it('EPUB: geçerli yapı (mimetype ilk ve sıkıştırmasız, container, opf, nav, bölümler)', async () => {
    const r = await pdfdenMetin(await wordTestPdf({ sayfa: 3 }), 'rapor.pdf', { bicim: 'epub' });
    expect(r.dosyalar[0].ad).toBe('rapor.epub');
    const bayt = r.dosyalar[0].bayt;
    expect(new TextDecoder('latin1').decode(bayt.subarray(30, 30 + 8 + 20))).toContain('mimetype'); // ilk girdi
    expect(new TextDecoder('latin1').decode(bayt.subarray(38, 58))).toBe('application/epub+zip'); // sıkıştırmasız
    const z = await JSZip.loadAsync(bayt);
    expect(Object.keys(z.files)).toEqual(expect.arrayContaining(['mimetype', 'META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/bolum-1.xhtml', 'OEBPS/stil.css']));
    const opf = await z.file('OEBPS/content.opf').async('string');
    expect(opf).toContain('<dc:title>Kardiyoloji Çalışması Raporu</dc:title>');
    expect(opf).toContain('properties="nav"');
    const b1 = await z.file('OEBPS/bolum-1.xhtml').async('string');
    expect(b1).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(b1).not.toMatch(/<img[^>]*[^/]>/); // img etiketleri kapalı (XHTML)
    expect(Object.keys(z.files).some((k) => k.startsWith('OEBPS/images/'))).toBe(true);
  });

  it('geçersiz biçimde hata verir', async () => {
    await expect(pdfdenMetin(await wordTestPdf({ sayfa: 1 }), 'x.pdf', { bicim: 'doc' })).rejects.toThrow(/biçimi/);
  });
});
