import { describe, it, expect } from 'vitest';
import { bulEslesmeler } from '../src/core/yazi/bul.js';
import { yaziAnalizEt, yaziDuzelt } from '../src/core/yazi/motor.js';
import { belgeAc } from '../src/core/render.js';
import { kurumsalPdf } from './yardimci/yazi-pdf.js';

async function tumMetin(bayt) {
  const b = await belgeAc(bayt);
  let s = '';
  for (let i = 1; i <= b.numPages; i++) { const p = await b.getPage(i); s += (await p.getTextContent()).items.map((o) => o.str).join(' ') + '\n'; }
  await b.kapat();
  return s;
}
const sahte = (satirlar) => ({ sayfalar: [{ no: 1, satirlar: satirlar.map((m, i) => ({ id: `s${i}`, sayfa: 1, metin: m, koruma: null })) }] });

describe('bul ve değiştir (çekirdek)', () => {
  it('büyük/küçük harf duyarsız, Türkçe I/ı ve İ/i doğru', () => {
    const o = sahte(['İstanbul ışık ISIK', 'Başka']);
    expect(bulEslesmeler(o, { ara: 'istanbul', yerine: 'Ankara' }).eslesmeler[0].sonra).toBe('Ankara ışık ISIK');
    expect(bulEslesmeler(o, { ara: 'ISIK', yerine: 'x' }).eslesmeler[0].sonra).toBe('İstanbul ışık x');
    expect(bulEslesmeler(sahte(['IŞIK ışık']), { ara: 'ışık', yerine: 'y' }).eslesmeler[0].adet).toBe(2);
  });
  it('büyük/küçük harf duyarlı, tam kelime ve çoklu eşleşme', () => {
    const o = sahte(['kedi kediler Kedi kedi']);
    expect(bulEslesmeler(o, { ara: 'kedi', yerine: 'it', buyukKucuk: true }).eslesmeler[0]).toMatchObject({ sonra: 'it itler Kedi it', adet: 3 });
    expect(bulEslesmeler(o, { ara: 'kedi', yerine: 'it', tamKelime: true }).eslesmeler[0]).toMatchObject({ sonra: 'it kediler it it', adet: 3 });
  });
  it('korumalı satırı değiştirmez ama sayar; boş aramada hata', () => {
    const o = sahte(['abc']); o.sayfalar[0].satirlar[0].koruma = 'logo';
    expect(bulEslesmeler(o, { ara: 'abc', yerine: 'x' })).toMatchObject({ toplam: 0, atlanan: 1 });
    expect(() => bulEslesmeler(o, { ara: '' })).toThrow();
  });
  it('yerine metni düz yazıdır ($& gibi kalıplar çalışmaz)', () => {
    expect(bulEslesmeler(sahte(['a b']), { ara: 'a', yerine: '$&$&' }).eslesmeler[0].sonra).toBe('$&$& b');
  });
});

describe('bul ve değiştir → gerçek PDF', () => {
  it('tüm sayfalardaki eşleşmeler değişir, çıktıda yeni yazı var', async () => {
    const bayt = await kurumsalPdf();
    const oz = await yaziAnalizEt(bayt);
    const r = bulEslesmeler(oz, { ara: 'Deneme yazısı', yerine: 'Sınama metni' });
    expect(r.eslesmeler.length).toBe(3);
    const degisiklikler = Object.fromEntries(r.eslesmeler.map((e) => [e.id, { metin: e.sonra }]));
    const cikti = await yaziDuzelt(bayt, { degisiklikler });
    const m = await tumMetin(cikti.bayt);
    expect(m).toContain('Sınama metni birinci');
    expect(m).toContain('Sınama metni üçüncü');
    expect(m).not.toContain('Deneme yazısı');
  });
});
