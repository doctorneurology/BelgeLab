import { describe, it, expect } from 'vitest';
import { bol } from '../src/core/sayfalar.js';
import { metinCikar, sayfaSayisiOku } from '../tools/karsilastir.mjs';
import { ornekPdf } from './yardimci/pdf-uret.js';

const baslik = (m) => m.split(' Pijamalı')[0];

describe('PDF böl', () => {
  it('aralıklara böler: "1-2; 3,5" → iki dosya', async () => {
    const pdf = await ornekPdf({ sayfa: 5 });
    const { dosyalar } = await bol(pdf, 'rapor.pdf', { mod: 'aralik', araliklar: '1-2; 3,5' });
    expect(dosyalar.map((d) => d.ad)).toEqual(['rapor-bolum-01.pdf', 'rapor-bolum-02.pdf']);
    expect((await metinCikar(dosyalar[0].bayt)).map(baslik)).toEqual(['Sayfa 1 / 5', 'Sayfa 2 / 5']);
    expect((await metinCikar(dosyalar[1].bayt)).map(baslik)).toEqual(['Sayfa 3 / 5', 'Sayfa 5 / 5']);
  });

  it('her N sayfada bir böler (5 sayfa, N=2 → 2+2+1)', async () => {
    const pdf = await ornekPdf({ sayfa: 5 });
    const { dosyalar } = await bol(pdf, 'x.pdf', { mod: 'her-n', n: 2 });
    expect(dosyalar.length).toBe(3);
    const sayilar = [];
    for (const d of dosyalar) sayilar.push(await sayfaSayisiOku(d.bayt));
    expect(sayilar).toEqual([2, 2, 1]);
    expect(dosyalar[2].sayfalar).toEqual([5]);
  });

  it('her sayfayı ayrı dosya yapar, dosya adları sıralı kalır', async () => {
    const pdf = await ornekPdf({ sayfa: 12 });
    const { dosyalar } = await bol(pdf, 'kitap.pdf', { mod: 'tek' });
    expect(dosyalar.length).toBe(12);
    expect(dosyalar[0].ad).toBe('kitap-sayfa-01.pdf');
    expect(dosyalar[11].ad).toBe('kitap-sayfa-12.pdf');
    expect((await metinCikar(dosyalar[6].bayt)).map(baslik)).toEqual(['Sayfa 7 / 12']);
  });

  it('geçersiz girdilerde hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    await expect(bol(pdf, 'x.pdf', { mod: 'aralik', araliklar: '1-9' })).rejects.toThrow(/Sayfa 9 yok/);
    await expect(bol(pdf, 'x.pdf', { mod: 'aralik', araliklar: '' })).rejects.toThrow(/boş/);
    await expect(bol(pdf, 'x.pdf', { mod: 'her-n', n: 0 })).rejects.toThrow(/en az 1/);
  });
});
