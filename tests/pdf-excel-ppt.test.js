import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { unzipSync, strFromU8 } from 'fflate';
import { PNG } from 'pngjs';
import { pdfdenExcel, sayiyaCevir } from '../src/core/pdf-excel.js';
import { pdfdenPowerPoint } from '../src/core/pdf-powerpoint.js';
import { wordTestPdf } from './yardimci/word-pdf.js';
import { ornekPdf } from './yardimci/pdf-uret.js';
import { sayfaPikselleri } from '../tools/karsilastir.mjs';

describe('PDF → Excel', () => {
  it('sayı çevirme: Türkçe/İngilizce ondalık; baştaki sıfırlı değerler metin kalır', () => {
    expect(sayiyaCevir('54,2')).toBe(54.2);
    expect(sayiyaCevir('1.234,5')).toBe(1234.5);
    expect(sayiyaCevir('120')).toBe(120);
    expect(sayiyaCevir('05321234567')).toBe('05321234567');
    expect(sayiyaCevir('Kontrol')).toBe('Kontrol');
    expect(sayiyaCevir('1,234.5', { ondalik: 'en' })).toBe(1234.5);
  });

  it('tablo bulunur ve hücreler yerinde: başlık metin, sayılar sayı', async () => {
    const pdf = await wordTestPdf({ sayfa: 3 });
    const r = await pdfdenExcel(pdf);
    expect(r.bilgi.tablo).toBe(1);
    const kitap = XLSX.read(r.bayt, { type: 'array' });
    expect(kitap.SheetNames).toEqual(['Sayfa 1']);
    const s = XLSX.utils.sheet_to_json(kitap.Sheets['Sayfa 1'], { header: 1 });
    expect(s).toEqual([['Grup', 'Hasta sayısı', 'Ortalama yaş'], ['Kontrol', 120, 54.2], ['Hasta', 98, 61.7], ['Toplam', 218, 57.6]]);
    expect(r.uyarilar[0]).toContain('TAHMİN');
  });

  it('düzen seçenekleri ve "tablo olmayan satırlar da" seçeneği; tablo yoksa anlaşılır hata', async () => {
    const pdf = await wordTestPdf({ sayfa: 3 });
    const t = XLSX.read((await pdfdenExcel(pdf, { duzen: 'tablo' })).bayt, { type: 'array' });
    expect(t.SheetNames).toEqual(['Sayfa1_Tablo1']);
    const tek = XLSX.read((await pdfdenExcel(pdf, { duzen: 'tek', tabloDisi: true })).bayt, { type: 'array' });
    const hucreler = XLSX.utils.sheet_to_json(tek.Sheets.Tablolar, { header: 1 }).flat();
    expect(hucreler).toContain('Bulgular ve Tartışma');
    expect(hucreler).toContain(120);
    const duz = await ornekPdf({ sayfa: 2 });
    await expect(pdfdenExcel(duz)).rejects.toThrow(/tablo bulunamadı/);
  });
});

describe('PDF → PowerPoint', () => {
  it('düzenlenebilir: her sayfa bir slayt; yazılar gerçek metin kutusu; arka plan YAZISIZ görüntü', async () => {
    const pdf = await ornekPdf({ sayfa: 3, baslik: 'Bölüm' });
    const r = await pdfdenPowerPoint(pdf, { dpi: 100 });
    expect(r.bilgi.slayt).toBe(3);
    expect(r.bilgi.metinKutusu).toBeGreaterThanOrEqual(6);
    const z = unzipSync(r.bayt);
    const slaytlar = Object.keys(z).filter((d) => /^ppt\/slides\/slide\d+\.xml$/.test(d)).sort();
    expect(slaytlar.length).toBe(3);
    const xml1 = strFromU8(z['ppt/slides/slide1.xml']);
    expect(xml1).toContain('Bölüm 1 / 3');
    expect(xml1).toContain('ĞÜŞİÖÇ');
    expect(xml1).toContain('<p:pic>');
    const medya = Object.keys(z).filter((d) => /^ppt\/media\/.+\.png$/.test(d)).sort();
    expect(medya.length).toBeGreaterThanOrEqual(3);
    const arka = PNG.sync.read(Buffer.from(z[medya[0]]));
    const koyu = (veri) => { let n = 0; for (let i = 0; i < veri.length; i += 4) if (veri[i] < 60 && veri[i + 1] < 60 && veri[i + 2] < 60) n++; return n; };
    const ozgun = await sayfaPikselleri(pdf, 1, { olcek: 100 / 72 });
    expect(koyu(arka.data)).toBeLessThan(koyu(ozgun.veri) * 0.3);
    expect(r.uyarilar[0]).toContain('PowerPoint’te kontrol');
  });

  it('resim kipi: yazı kutusu yok, sayfa görüntüsü var; geçersiz kip reddedilir; sayfa seçimi', async () => {
    const pdf = await ornekPdf({ sayfa: 4 });
    const r = await pdfdenPowerPoint(pdf, { mod: 'resim', dpi: 72, sayfalar: '2-3' });
    expect(r.bilgi).toMatchObject({ slayt: 2, metinKutusu: 0 });
    const z = unzipSync(r.bayt);
    expect(Object.keys(z).filter((d) => /^ppt\/slides\/slide\d+\.xml$/.test(d)).length).toBe(2);
    await expect(pdfdenPowerPoint(pdf, { mod: 'x' })).rejects.toThrow(/Kip/);
  });
});
