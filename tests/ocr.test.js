import { describe, it, expect, afterAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pdfOcr, ocrKatmaniniKaldir, ocrKapat } from '../src/core/ocr.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { taramaPdf, TARAMA_SATIRLARI, benzerlik } from './yardimci/tarama.js';
import { ornekPdf } from './yardimci/pdf-uret.js';

afterAll(() => ocrKapat());

describe('OCR: taranmış PDF\'i aranabilir yapma (Türkçe)', () => {
  it('taranmış sayfada seçilebilir yazı yoktur; OCR sonrası yazı aranabilir ve Türkçe karakterler doğru okunur', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 });
    expect((await metinCikar(bayt))[0]).toBe(''); // öncesi: yazı yok
    const r = await pdfOcr(bayt, { dpi: 300 });
    expect(r.degisti).toBe(true);
    expect(r.rapor[0]).toMatchObject({ no: 1, durum: 'tamam' });
    const metin = (await metinCikar(r.bayt))[0];
    const benz = benzerlik(metin, TARAMA_SATIRLARI.join(' '));
    console.log(`OCR benzerliği: %${(benz * 100).toFixed(1)}  güven: %${r.rapor[0].guven}\n  okunan: ${metin}`);
    expect(benz).toBeGreaterThan(0.93);
    // Türkçe harfler kaybolmamış olmalı
    for (const kelime of ['şikâyetleri', 'göğüs', 'çabucak', 'Öğleden', 'ilaçlarını']) {
      expect(metin.toLocaleLowerCase('tr'), kelime).toContain(kelime.toLocaleLowerCase('tr'));
    }
  });

  it('OCR sayfanın GÖRÜNÜŞÜNÜ değiştirmez (piksel piksel aynı) ve katman geri alınabilir', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 150, jpeg: true });
    const r = await pdfOcr(bayt, { dpi: 300 });
    const once = await sayfaPikselleri(bayt, 1, { olcek: 1.5 });
    const sonra = await sayfaPikselleri(r.bayt, 1, { olcek: 1.5 });
    expect(karsilastir(once, sonra).farkliPiksel).toBe(0);

    const geri = await ocrKatmaniniKaldir(r.bayt);
    expect(geri.kaldirilan).toBe(1);
    expect((await metinCikar(geri.bayt))[0]).toBe('');
    expect(karsilastir(once, await sayfaPikselleri(geri.bayt, 1, { olcek: 1.5 })).farkliPiksel).toBe(0);
  });

  it('kelimeler okundukları YERDE durur (aranan kelimenin kutusu sayfadaki konumla uyuşur)', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 });
    const r = await pdfOcr(bayt, { dpi: 300 });
    const { belgeAc } = await import('../src/core/render.js');
    const belge = await belgeAc(r.bayt);
    const sayfa = await belge.getPage(1);
    const ic = await sayfa.getTextContent();
    const oge = ic.items.find((o) => o.str.toLocaleLowerCase('tr').includes('çabucak'));
    expect(oge, 'çabucak bulunmalı').toBeTruthy();
    const x = oge.transform[4];
    const y = oge.transform[5];
    // "çabucak geçmiştir…" satırı 3. satır: sol kenar 72 pt, taban çizgisi civarı
    const k = kutular[0][2];
    expect(Math.abs(x - k.x0)).toBeLessThan(6);
    expect(Math.abs(y - (841.89 - k.taban))).toBeLessThan(6);
    await belge.kapat();
  });

  it('zaten seçilebilir yazısı olan sayfayı atlar (yazıyı ikiye katlamaz); istenirse yine okur', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const r = await pdfOcr(pdf, { dpi: 150 });
    expect(r.degisti).toBe(false);
    expect(r.rapor.every((s) => s.durum === 'atlandi')).toBe(true);
    expect(r.bayt).toBe(pdf);
    const zorla = await pdfOcr(pdf, { sayfalar: '1', dpi: 200, yaziVarsa: 'yine' });
    expect(zorla.rapor[0].durum).toBe('tamam');
    expect(zorla.degisti).toBe(true);
  });

  it('sayfa seçimi: yalnızca seçilen sayfa okunur', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI, ['İkinci sayfada başka bir cümle yazıyor.']], { dpi: 200 });
    const r = await pdfOcr(bayt, { sayfalar: '2', dpi: 300 });
    const m = await metinCikar(r.bayt);
    expect(m[0]).toBe('');
    expect(m[1].toLocaleLowerCase('tr')).toContain('ikinci sayfada');
    const d = await PDFDocument.load(r.bayt);
    expect(d.getPageCount()).toBe(2);
  });

  it('boş (beyaz) sayfa: hata vermez, "yazı bulunamadı" uyarısı verir', async () => {
    const { bayt } = await taramaPdf([[]], { dpi: 100 });
    const r = await pdfOcr(bayt, { dpi: 200 });
    expect(r.degisti).toBe(false);
    expect(r.rapor[0].durum).toBe('bos');
    expect(r.uyarilar.join(' ')).toContain('okunabilir yazı bulunamadı');
  });
});
