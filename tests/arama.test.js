import { describe, it, expect } from 'vitest';
import { araclariAra, sadelestir } from '../src/arama.js';
import { ARACLAR } from '../src/araclar.js';

const ilk = (q) => araclariAra(ARACLAR, q)?.[0]?.arac.slug;
const slugs = (q) => (araclariAra(ARACLAR, q) ?? []).map((b) => b.arac.slug);

describe('araç arama', () => {
  it('Türkçe harfleri ve işaretleri sadeleştirir', () => {
    expect(sadelestir('PDF → Markdown')).toBe('pdftomarkdown');
    expect(sadelestir('Birleştir İŞ')).toBe('birlestiris');
  });

  it('boş sorguda null döner (hepsi gösterilir)', () => {
    expect(araclariAra(ARACLAR, '')).toBeNull();
    expect(araclariAra(ARACLAR, '   ')).toBeNull();
  });

  it('pdftomd → PDF → Markdown', () => {
    expect(ilk('pdftomd')).toBe('pdf-markdown');
    expect(ilk('pdf to md')).toBe('pdf-markdown');
    expect(ilk('pdf markdown')).toBe('pdf-markdown');
  });

  it('kısaltmalar ve İngilizce adlar', () => {
    expect(ilk('pdftoword')).toBe('pdf-word');
    expect(ilk('wordtopdf')).toBe('word-pdf');
    expect(ilk('ppt to pdf')).toBe('powerpoint-pdf');
    expect(ilk('compress')).toBe('sikistir');
    expect(ilk('merge')).toBe('birlestir');
    expect(ilk('split')).toBe('bol');
    expect(ilk('watermark')).toBe('filigran-ekle');
    expect(ilk('jpg to pdf')).toBe('resimden-pdf');
  });

  it('Türkçe yazılışta harf farkı önemsenmez', () => {
    expect(ilk('birlestir')).toBe('birlestir');
    expect(ilk('sikistir')).toBe('sikistir');
    expect(ilk('SIFRE')).toMatch(/^sifre-/);
    expect(slugs('filigran')).toEqual(expect.arrayContaining(['filigran-ekle', 'filigran-geri-al']));
  });

  it('eksik harfle de tahmin eder', () => {
    expect(ilk('pdfexcl')).toBe('pdf-excel');
    expect(ilk('karrt')).toBe('karart');
  });

  it('alakasız yazıda sonuç dönmez', () => {
    expect(araclariAra(ARACLAR, 'zzzqqq')).toEqual([]);
  });
});

describe('yeni araçlar aranabilir', () => {
  it('İngilizce ve kısa yazılışlar', () => {
    expect(ilk('remove duplicates')).toBe('excel-tekrar-sil');
    expect(ilk('csv to excel')).toBe('excel-csv');
    expect(ilk('booklet')).toBe('sayfa-duzeni');
    expect(ilk('metadata')).toBe('ustveri');
    expect(ilk('bookmarks')).toBe('yer-imi');
    expect(ilk('pdf to epub')).toBe('pdf-metin');
    expect(ilk('markdown editor')).toBe('markdown-editor');
    expect(ilk('compress image')).toBe('resim-araclari');
    expect(ilk('flatten')).toBe('formu-duzlestir');
  });
});
