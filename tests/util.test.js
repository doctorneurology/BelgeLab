import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { sayfaAraligiCoz, sayfaSecimi, romaRakami, renkCoz, dosyaAdiTuret } from '../src/core/util.js';
import { zipOlustur, crc32 } from '../src/core/zip.js';

describe('Sayfa aralığı çözümleme', () => {
  it('tek sayfa, aralık, açık uçlu aralık, "son"', () => {
    expect(sayfaAraligiCoz('1-3, 5', 10)).toEqual([0, 1, 2, 4]);
    expect(sayfaAraligiCoz('8-', 10)).toEqual([7, 8, 9]);
    expect(sayfaAraligiCoz('-3', 10)).toEqual([0, 1, 2]);
    expect(sayfaAraligiCoz('son', 10)).toEqual([9]);
    expect(sayfaAraligiCoz('2-son', 4)).toEqual([1, 2, 3]);
  });
  it('yazıldığı sırayı ve ters aralığı korur', () => {
    expect(sayfaAraligiCoz('3,1,2', 5)).toEqual([2, 0, 1]);
    expect(sayfaAraligiCoz('4-2', 5)).toEqual([3, 2, 1]);
  });
  it('tekrarsız seçenek', () => {
    expect(sayfaAraligiCoz('1,1,2', 5, { tekrarIzinli: false })).toEqual([0, 1]);
    expect(sayfaSecimi('3,1,3', 5)).toEqual([0, 2]);
    expect(sayfaSecimi('', 3)).toEqual([0, 1, 2]);
  });
  it('geçersiz girdilerde anlaşılır Türkçe hata verir', () => {
    expect(() => sayfaAraligiCoz('', 5)).toThrow(/boş/);
    expect(() => sayfaAraligiCoz('0', 5)).toThrow(/Sayfa 0 yok/);
    expect(() => sayfaAraligiCoz('9', 5)).toThrow(/5 sayfa var/);
    expect(() => sayfaAraligiCoz('a-b', 5)).toThrow(/geçerli/);
    expect(() => sayfaAraligiCoz('1-2-3', 5)).toThrow(/aralık/);
  });
});

describe('Küçük yardımcılar', () => {
  it('Roma rakamı', () => {
    expect(romaRakami(4)).toBe('IV');
    expect(romaRakami(1994)).toBe('MCMXCIV');
  });
  it('renk', () => {
    expect(renkCoz('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(() => renkCoz('kırmızı')).toThrow(/geçerli bir renk/);
  });
  it('türetilmiş dosya adı', () => {
    expect(dosyaAdiTuret('Rapor Ğ.pdf', '-bolum-01')).toBe('Rapor Ğ-bolum-01.pdf');
    expect(dosyaAdiTuret('a/b:c.pdf', '-x', 'png')).toBe('a_b_c-x.png');
  });
});

describe('ZIP yazıcı', () => {
  it('JSZip ile geri okunur, Türkçe dosya adları ve içerik bozulmaz', async () => {
    const a = new TextEncoder().encode('merhaba dünya ğüşiöç');
    const b = new Uint8Array([0, 1, 2, 3, 250, 251, 252]);
    const zip = zipOlustur([
      { ad: 'çok güzel.txt', bayt: a },
      { ad: 'ikili.bin', bayt: b },
      { ad: 'ikili.bin', bayt: b }, // aynı ad → (2) eklenmeli
    ]);
    const okunan = await JSZip.loadAsync(zip, { checkCRC32: true });
    expect(Object.keys(okunan.files).sort()).toEqual(['çok güzel.txt', 'ikili (2).bin', 'ikili.bin'].sort());
    expect(await okunan.file('çok güzel.txt').async('string')).toBe('merhaba dünya ğüşiöç');
    expect([...(await okunan.file('ikili.bin').async('uint8array'))]).toEqual([...b]);
  });
  it('CRC32 bilinen değerle uyuşur', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
