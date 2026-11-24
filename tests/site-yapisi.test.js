import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARACLAR, GRUPLAR } from '../src/araclar.js';

const yol = (g) => fileURLToPath(new URL(`../${g}`, import.meta.url));

describe('Site yapısı: her araç için sayfa ve betik var', () => {
  it('araç kimlikleri tekil, grupları geçerli', () => {
    const slugs = ARACLAR.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ARACLAR) expect(GRUPLAR.map((g) => g.id)).toContain(a.grup);
    expect(ARACLAR.length).toBe(39);
  });

  for (const a of ARACLAR) {
    it(`${a.ad}: HTML sayfası ve betiği mevcut, Türkçe`, () => {
      expect(existsSync(yol(`${a.slug}.html`)), `${a.slug}.html`).toBe(true);
      expect(existsSync(yol(`src/sayfalar/${a.slug}.js`)), `src/sayfalar/${a.slug}.js`).toBe(true);
      const html = readFileSync(yol(`${a.slug}.html`), 'utf8');
      expect(html).toContain('<html lang="tr">');
      expect(html).toContain(`./src/sayfalar/${a.slug}.js`);
      expect(html).toContain('width=device-width');
    });
  }

  it('ana sayfa ve hakkında sayfası var; kişisel örnek PDF\'ler depoda yok', () => {
    expect(existsSync(yol('index.html'))).toBe(true);
    expect(existsSync(yol('hakkinda.html'))).toBe(true);
    for (const b of ['pdf.html', 'excel.html']) expect(existsSync(yol(b)), b).toBe(true);
    const pdfler = readdirSync(yol('.')).filter((d) => d.toLowerCase().endsWith('.pdf'));
    expect(pdfler).toEqual([]);
  });

  it('lisans ve notlar dosyaları var', () => {
    for (const d of ['LICENSE', 'README.md', 'PROJE_NOTLARI.md', 'THIRD_PARTY_LICENSES.md']) {
      expect(existsSync(yol(d)), d).toBe(true);
    }
    expect(readFileSync(yol('LICENSE'), 'utf8')).toContain('MIT License');
  });
});
