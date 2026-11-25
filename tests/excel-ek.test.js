import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { xlsxCsv, csvXlsx, csvAyristir, ayiriciBul, metinCoz, excelTekrarSil } from '../src/core/excel-ek.js';

const xlsx = (sayfalar) => { const k = XLSX.utils.book_new(); for (const [ad, aoa] of Object.entries(sayfalar)) XLSX.utils.book_append_sheet(k, XLSX.utils.aoa_to_sheet(aoa), ad); return new Uint8Array(XLSX.write(k, { type: 'array', bookType: 'xlsx' })); };
const oku = (bayt, ad = 0) => { const k = XLSX.read(bayt, { type: 'array' }); return XLSX.utils.sheet_to_json(k.Sheets[k.SheetNames[ad]], { header: 1, defval: '', blankrows: false }); };
const enc = (s) => new TextEncoder().encode(s);

describe('CSV ayrıştırma', () => {
  it('tırnak, kaçış, çok satırlı hücre ve CRLF', () => {
    expect(csvAyristir('a;"b;c";"d""e"\r\n1;"x\ny";3\r\n', ';')).toEqual([['a', 'b;c', 'd"e'], ['1', 'x\ny', '3']]);
  });
  it('ayırıcıyı bulur (tırnak içindekini saymaz)', () => {
    expect(ayiriciBul('a;b;c\n1;2;3')).toBe(';');
    expect(ayiriciBul('a,b,c\n1,2,3')).toBe(',');
    expect(ayiriciBul('a\tb\n1\t2')).toBe('\t');
    expect(ayiriciBul('"a,b";c\n"1,2";3')).toBe(';');
  });
  it('UTF-8 ve BOM; geçersizse Windows-1254', () => {
    expect(metinCoz(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('şğ')]))).toEqual({ metin: 'şğ', kodlama: 'UTF-8' });
    expect(metinCoz(new Uint8Array([0xfe, 0xf0, 0xdd])).metin).toBe('şğİ');
  });
});

describe('XLSX ↔ CSV', () => {
  it('XLSX → CSV: Türkçe, virgüllü sayı ve çok sayfa; BOM ve ayırıcı', () => {
    const b = xlsx({ Liste: [['Ad', 'Tutar', 'Not'], ['Şükrü', 1234.5, 'a;b'], ['İpek', 2, 'tamam']], Diğer: [['x'], ['y']] });
    const r = xlsxCsv(b, 'rapor.xlsx', { ayirac: ';' });
    expect(r.dosyalar.map((d) => d.ad)).toEqual(['rapor-Liste.csv', 'rapor-Diğer.csv']);
    const t = new TextDecoder().decode(r.dosyalar[0].bayt);
    expect(r.dosyalar[0].bayt.slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    expect(t).toContain('Ad;Tutar;Not');
    expect(t).toContain('Şükrü;1234.5;"a;b"');
    const tek = xlsxCsv(xlsx({ S: [['a', 'b']] }), 'x.xlsx', { ayirac: ',', bom: false });
    expect(tek.dosyalar[0].ad).toBe('x.csv');
    expect(tek.dosyalar[0].bayt[0]).toBe(0x61);
  });
  it('CSV → XLSX: sayılar sayı olur, baştaki sıfır korunur, Türkçe doğru', () => {
    const r = csvXlsx(enc('Ad;Tutar;TC\nŞükrü;1.234,5;01234567890\nİpek;2;98765432101\n'), 'v.csv');
    expect(r.ayirac).toBe(';'); expect(r.satir).toBe(3);
    const a = oku(r.bayt);
    expect(a[0]).toEqual(['Ad', 'Tutar', 'TC']);
    expect(a[1]).toEqual(['Şükrü', 1234.5, '01234567890']);
    expect(typeof a[2][2]).toBe('number'); // baştaki sıfırı olmayan 11 haneli sayı
    const metin = csvXlsx(enc('a;b\n007;1,5'), 'v.csv', { sayilar: false });
    expect(oku(metin.bayt)[1]).toEqual(['007', '1,5']);
    expect(() => csvXlsx(enc('   '), 'x.csv')).toThrow(/boş/);
  });
});

describe('yinelenen satırları sil', () => {
  const veri = [['Ad', 'TC', 'Tarih'], ['Ali', '1', 'x'], ['ali ', '1', 'y'], ['Veli', '2', 'z'], ['Ali', '3', 'w'], ['', '', ''], ['VELİ', '2', 'q']];
  it('seçilen sütuna göre, harf/boşluk farkını yok sayarak ilkini tutar', () => {
    const r = excelTekrarSil(xlsx({ S: veri }), 'k.xlsx', { sutunlar: 'Ad, TC' });
    expect(oku(r.bayt)).toEqual([['Ad', 'TC', 'Tarih'], ['Ali', '1', 'x'], ['Veli', '2', 'z'], ['Ali', '3', 'w']]);
    expect(r.silinen).toBe(2);
    expect(r.ad).toBe('k-tekrarsiz.xlsx');
  });
  it('son kaydı tutar; harf duyarlı; sütun harfiyle', () => {
    const son = excelTekrarSil(xlsx({ S: veri }), 'k.xlsx', { sutunlar: 'B', tut: 'son' });
    expect(oku(son.bayt).slice(1)).toEqual([['ali ', '1', 'y'], ['Ali', '3', 'w'], ['VELİ', '2', 'q']]); // özgün sıra korunur
    const duyarli = excelTekrarSil(xlsx({ S: veri }), 'k.xlsx', { sutunlar: 'Ad', buyukKucuk: true, kirp: false });
    expect(duyarli.silinen).toBe(1); // yalnızca iki "Ali"
  });
  it('sütun belirtilmezse tüm sütunlar aynı olan satırlar silinir; başlıksız kipte ilk satır da veridir', () => {
    const r = excelTekrarSil(xlsx({ S: [['a', 1], ['a', 1], ['b', 2], ['a', 1]] }), 'k.xlsx', { baslik: false });
    expect(oku(r.bayt)).toEqual([['a', 1], ['b', 2]]);
  });
  it('olmayan sütun/sayfa için anlaşılır hata; diğer sayfaya dokunmaz', () => {
    expect(() => excelTekrarSil(xlsx({ S: veri }), 'k.xlsx', { sutunlar: 'Yok' })).toThrow(/bulunamadı/);
    expect(() => excelTekrarSil(xlsx({ S: veri }), 'k.xlsx', { sayfa: 'Z' })).toThrow(/adlı sayfa yok/);
    const iki = excelTekrarSil(xlsx({ A: [['x'], ['x']], B: [['y'], ['y']] }), 'k.xlsx', { sayfa: 'A', baslik: false });
    expect(oku(iki.bayt, 0)).toEqual([['x']]);
    expect(oku(iki.bayt, 1)).toEqual([['y'], ['y']]);
  });
});
