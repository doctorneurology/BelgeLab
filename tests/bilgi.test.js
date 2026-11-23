import { describe, it, expect } from 'vitest';
import { sayfaNumarasiEkle, bilgiEkle } from '../src/core/bilgi.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { ornekPdf } from './yardimci/pdf-uret.js';

describe('Sayfa numarası ekle', () => {
  it('her sayfaya doğru numarayı yazar; değişiklik yalnızca alt bölgede olur', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    const s = await sayfaNumarasiEkle(pdf, { konum: 'alt-orta', bicim: 'No: {n}/{toplam}' });
    const metin = await metinCikar(s.bayt);
    expect(metin[0]).toContain('No: 1/3');
    expect(metin[1]).toContain('No: 2/3');
    expect(metin[2]).toContain('No: 3/3');
    // Özgün içerik görsel olarak korunmuş: fark yalnızca sayfanın alt kenarında, ortada
    const once = await sayfaPikselleri(pdf, 1, { olcek: 1 });
    const sonra = await sayfaPikselleri(s.bayt, 1, { olcek: 1 });
    const fark = karsilastir(once, sonra);
    expect(fark.farkliPiksel).toBeGreaterThan(20);
    expect(fark.kutu.y0).toBeGreaterThan(once.yukseklik * 0.9);
    expect(fark.kutu.x0).toBeGreaterThan(once.genislik * 0.3);
    expect(fark.kutu.x1).toBeLessThan(once.genislik * 0.7);
  });

  it('başlangıç numarası ve sayfa aralığı (kapağı atla)', async () => {
    const pdf = await ornekPdf({ sayfa: 4 });
    const s = await sayfaNumarasiEkle(pdf, { bicim: 'Sayfa {n}-{toplam}', sayfalar: '2-', baslangicNo: 1 });
    const m = await metinCikar(s.bayt);
    expect(m[0]).not.toContain('Sayfa 1-');
    expect(m[1]).toContain('Sayfa 1-3');
    expect(m[3]).toContain('Sayfa 3-3');
  });

  it('Roma rakamı', async () => {
    const pdf = await ornekPdf({ sayfa: 4 });
    const s = await sayfaNumarasiEkle(pdf, { bicim: '{n}', numaraBicimi: 'roma', konum: 'alt-sag' });
    const m = await metinCikar(s.bayt);
    expect(m[3].endsWith('IV')).toBe(true);
  });

  it('döndürülmüş sayfada numara EKRANDA görünen alt-orta konuma gelir', async () => {
    for (const don of [90, 180, 270]) {
      const pdf = await ornekPdf({ sayfa: 1, don });
      const s = await sayfaNumarasiEkle(pdf, { konum: 'alt-orta', boyut: 28, bicim: 'Sayfa {n}' });
      const once = await sayfaPikselleri(pdf, 1);
      const sonra = await sayfaPikselleri(s.bayt, 1);
      const fark = karsilastir(once, sonra);
      expect(fark.farkliPiksel, `don=${don}`).toBeGreaterThan(5);
      expect(fark.kutu.y0, `don=${don}`).toBeGreaterThan(once.yukseklik * 0.9);
      const orta = (fark.kutu.x0 + fark.kutu.x1) / 2;
      expect(Math.abs(orta - once.genislik / 2), `don=${don}`).toBeLessThan(once.genislik * 0.05);
    }
  });

  it('Türkçe karakterli metin sorunsuz yazılır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await sayfaNumarasiEkle(pdf, { bicim: 'Sayfa {n} · ĞÜŞİÖÇ ığüşöç' });
    expect((await metinCikar(s.bayt))[0]).toContain('Sayfa 1 · ĞÜŞİÖÇ ığüşöç');
  });
});

describe('Üst / alt bilgi ekle', () => {
  it('altı alanı birden doldurur; {dosya} ve {tarih} yer tutucuları çalışır', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const s = await bilgiEkle(pdf, {
      alanlar: { 'ust-sol': 'Gizli — İçişleri', 'ust-sag': '{tarih}', 'alt-sol': '{dosya}', 'alt-sag': '{n}/{toplam}' },
      dosyaAdi: 'rapor.pdf', tarih: new Date(2026, 10, 23),
    });
    const m = (await metinCikar(s.bayt))[1];
    expect(m).toContain('Gizli — İçişleri');
    expect(m).toContain('23.11.2026');
    expect(m).toContain('rapor.pdf');
    expect(m).toContain('2/2');
  });

  it('boş alanlarla ve yazı tipinde olmayan karakterle hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(bilgiEkle(pdf, { alanlar: { 'ust-sol': '  ' } })).rejects.toThrow(/metin yazın/);
    await expect(bilgiEkle(pdf, { alanlar: { 'ust-sol': 'selam 😀' } })).rejects.toThrow(/karakterler yok/);
  });

  it('çıktıda üretici bilgisi dürüstçe yazılır (iz saklanmaz)', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await bilgiEkle(pdf, { alanlar: { 'alt-orta': 'x' } });
    const { PDFDocument } = await import('pdf-lib');
    const d = await PDFDocument.load(s.bayt, { updateMetadata: false });
    expect(d.getProducer()).toMatch(/PDF Araçları/);
  });
});
