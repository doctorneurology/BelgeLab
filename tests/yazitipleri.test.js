import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { YAZI_AILELERI, TURKCE_HARFLER, eksikKarakterler, yaziTipiGom, metniDogrula } from '../src/core/fonts.js';
import { metinCikar, sayfaPikselleri, doluluk } from '../tools/karsilastir.mjs';
import { TURKCE_CUMLE } from './yardimci/pdf-uret.js';

const stiller = [{}, { kalin: true }, { italik: true }, { kalin: true, italik: true }];

describe('Yazı tipleri: Türkçe karakter desteği ve lisans dosyaları', () => {
  for (const [aile, bilgi] of Object.entries(YAZI_AILELERI)) {
    it(`${bilgi.ad}: 4 stilde de ğ ş ı İ ö ü ç var`, async () => {
      for (const stil of stiller) {
        expect(await eksikKarakterler(aile, stil, TURKCE_HARFLER + 'ığüşöç İ')).toEqual([]);
      }
    });

    it(`${bilgi.ad}: lisans dosyası klasörde var`, () => {
      const klasor = fileURLToPath(new URL(`../public/fonts/${bilgi.klasor}/`, import.meta.url));
      expect(existsSync(klasor)).toBe(true);
      const dosyalar = readdirSync(klasor);
      expect(dosyalar.some((d) => /license|ofl/i.test(d))).toBe(true);
    });

    it(`${bilgi.ad}: PDF'e gömülür, metin geri okunur ve çizilir`, async () => {
      const doc = await PDFDocument.create();
      const font = await yaziTipiGom(doc, aile);
      const p = doc.addPage([500, 200]);
      p.drawText(TURKCE_CUMLE, { x: 10, y: 100, size: 12, font });
      const bayt = new Uint8Array(await doc.save());
      const [metin] = await metinCikar(bayt);
      expect(metin).toBe(TURKCE_CUMLE);
      expect(doluluk(await sayfaPikselleri(bayt, 1, { olcek: 1.5 }))).toBeGreaterThan(0.002);
    });
  }

  it('Yazı tipinde olmayan karakter (emoji) sessizce geçilmez, hata verir', async () => {
    await expect(metniDogrula('liberation-sans', {}, 'merhaba 😀')).rejects.toThrow(/karakterler yok/);
  });
});
