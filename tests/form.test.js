import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { formAlanlari, formDoldur } from '../src/core/form.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { formluPdf, ornekPdf } from './yardimci/pdf-uret.js';

describe('Form doldur', () => {
  it('alanları tür ve seçenekleriyle listeler', async () => {
    const { alanlar } = await formAlanlari(await formluPdf());
    const tur = Object.fromEntries(alanlar.map((a) => [a.ad, a.tur]));
    expect(tur).toEqual({ ad: 'metin', kisa: 'metin', adres: 'metin', onay: 'onay', cinsiyet: 'secenek', il: 'acilir' });
    expect(alanlar.find((a) => a.ad === 'il').secenekler).toEqual(['Ankara', 'İzmir', 'Muğla']);
    expect(alanlar.find((a) => a.ad === 'adres').cokSatir).toBe(true);
    expect(alanlar.find((a) => a.ad === 'kisa').enCok).toBe(5);
    expect(alanlar.every((a) => a.sayfa === 0)).toBe(true);
  });

  it('tüm alan türlerini doldurur (Türkçe karakterler dahil); değerler geri okunur', async () => {
    const pdf = await formluPdf();
    const s = await formDoldur(pdf, {
      ad: 'Şükrü Çağlayan Öztürk İğdır', kisa: 'Ğüşiö', adres: 'Atatürk Cad. No:5\nÇankaya / Ankara',
      onay: true, cinsiyet: 'erkek', il: 'İzmir',
    });
    expect(s.doldurulan).toBe(6);
    const { alanlar } = await formAlanlari(s.bayt);
    const d = Object.fromEntries(alanlar.map((a) => [a.ad, a.deger]));
    expect(d).toEqual({
      ad: 'Şükrü Çağlayan Öztürk İğdır', kisa: 'Ğüşiö', adres: 'Atatürk Cad. No:5\nÇankaya / Ankara',
      onay: true, cinsiyet: 'erkek', il: 'İzmir',
    });
  });

  it('doldurulan metin sayfada GÖRÜNÜR (görünüm akışı oluşturulmuş)', async () => {
    const pdf = await formluPdf();
    const s = await formDoldur(pdf, { ad: 'Müşteri Adı Soyadı' });
    const fark = karsilastir(await sayfaPikselleri(pdf), await sayfaPikselleri(s.bayt), { esik: 0.02 });
    expect(fark.farkliPiksel).toBeGreaterThan(80);
    // Fark, "ad" alanının bulunduğu bölgede (x 50-350, yukarıdan 58-82 pt)
    expect(fark.kutu.x0).toBeGreaterThanOrEqual(48);
    expect(fark.kutu.x1).toBeLessThanOrEqual(352);
    expect(fark.kutu.y0).toBeGreaterThanOrEqual(842 - 786 - 2);
    expect(fark.kutu.y1).toBeLessThanOrEqual(842 - 758 + 2);
  });

  it('düzleştirme: alanlar sayfaya işlenir, metin okunur, form kalmaz', async () => {
    const pdf = await formluPdf();
    const s = await formDoldur(pdf, { ad: 'Düzleşmiş Ğ Metin' }, { duzlestir: true });
    expect((await metinCikar(s.bayt))[0]).toContain('Düzleşmiş Ğ Metin');
    const d = await PDFDocument.load(s.bayt);
    expect(d.getForm().getFields().length).toBe(0);
    expect(s.uyarilar.join(' ')).toMatch(/düzleştirildi/);
  });

  it('en çok karakter sınırı, olmayan alan, desteklenmeyen karakter için anlaşılır hata verir', async () => {
    const pdf = await formluPdf();
    await expect(formDoldur(pdf, { kisa: 'çok uzun metin' })).rejects.toThrow(/en fazla 5 karakter/);
    await expect(formDoldur(pdf, { yok: 'x' })).rejects.toThrow(/"yok" adlı form alanı bulunamadı/);
    await expect(formDoldur(pdf, { ad: 'selam 😀' })).rejects.toThrow(/karakterler yok/);
  });

  it('formu olmayan belgede açıklayıcı hata verir', async () => {
    await expect(formDoldur(await ornekPdf({ sayfa: 1 }), { a: 'b' })).rejects.toThrow(/form alanı bulunamadı/);
    const { alanlar } = await formAlanlari(await ornekPdf({ sayfa: 1 }));
    expect(alanlar).toEqual([]);
  });
});
