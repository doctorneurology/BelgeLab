import { describe, it, expect } from 'vitest';
import { sifreEkle, sifreKaldir, sifreliMi, _testIcin } from '../src/core/sifre.js';
import { pdfAc } from '../src/core/belge.js';
import { SifreliPdfHatasi, YanlisSifreHatasi, PdfHatasi } from '../src/core/hatalar.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { birlestir } from '../src/core/sayfalar.js';
import { ornekPdf } from './yardimci/pdf-uret.js';

describe('Şifre ekle', () => {
  it('şifre eklenir: şifresiz açılamaz, doğru şifreyle açılır ve içerik aynıdır', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    expect(await sifreliMi(pdf)).toBe(false);
    const s = await sifreEkle(pdf, { kullaniciSifresi: 'Gizli123' });
    expect(await sifreliMi(s.bayt)).toBe(true);
    await expect(pdfAc(s.bayt)).rejects.toBeInstanceOf(SifreliPdfHatasi);
    await expect(metinCikar(s.bayt)).rejects.toBeInstanceOf(SifreliPdfHatasi);
    await expect(metinCikar(s.bayt, { sifre: 'yanlis' })).rejects.toBeInstanceOf(YanlisSifreHatasi);
    expect(await metinCikar(s.bayt, { sifre: 'Gizli123' })).toEqual(await metinCikar(pdf));
    const fark = karsilastir(await sayfaPikselleri(s.bayt, 1, { sifre: 'Gizli123' }), await sayfaPikselleri(pdf, 1));
    expect(fark.farkliPiksel).toBe(0);
  });

  it('metin içeriği şifreli dosyada düz metin olarak görünmez', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await sifreEkle(pdf, { kullaniciSifresi: 'abc' });
    expect(Buffer.from(s.bayt).includes(Buffer.from('/Encrypt'))).toBe(true);
    expect(Buffer.from(s.bayt).includes(Buffer.from('Pijamal'))).toBe(false);
  });

  it('Türkçe karakterli şifre çalışır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await sifreEkle(pdf, { kullaniciSifresi: 'şifre-ĞÜİ-1' });
    await expect(sifreKaldir(s.bayt, 'sifre-GUI-1')).rejects.toBeInstanceOf(YanlisSifreHatasi);
    const k = await sifreKaldir(s.bayt, 'şifre-ĞÜİ-1');
    expect(await sifreliMi(k.bayt)).toBe(false);
  });

  it('izin kısıtlamaları uyarı ile birlikte uygulanır; ayrı sahip şifresi çalışır', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await sifreEkle(pdf, {
      kullaniciSifresi: 'ac', sahipSifresi: 'sahip', izinler: { yazdir: 'yok', duzenle: 'yok', kopyala: false },
    });
    expect(s.uyarilar.join(' ')).toMatch(/yok sayılabilir/);
    const kayit = await _testIcin.calistir(['--password=ac', '--show-encryption', '/girdi.pdf'], s.bayt);
    expect(kayit.kayit).toMatch(/print high resolution: not allowed/);
    expect(kayit.kayit).toMatch(/extract for any purpose: not allowed/);
    // sahip şifresi de kaldırabilir
    expect(await sifreliMi((await sifreKaldir(s.bayt, 'sahip')).bayt)).toBe(false);
  });

  it('şifresiz (boş) şifre ve zaten şifreli belge reddedilir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(sifreEkle(pdf, { kullaniciSifresi: '' })).rejects.toThrow(/bir şifre yazın/);
    const s = await sifreEkle(pdf, { kullaniciSifresi: 'a' });
    await expect(sifreEkle(s.bayt, { kullaniciSifresi: 'b' })).rejects.toThrow(/zaten şifreli/);
  });

  it('şifreli dosya birleştirmeye girerse açıklayıcı hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const s = await sifreEkle(pdf, { kullaniciSifresi: 'a' });
    await expect(birlestir([{ ad: 'a.pdf', bayt: pdf }, { ad: 'gizli.pdf', bayt: s.bayt }])).rejects.toThrow(/"gizli.pdf" şifreli/);
  });
});

describe('Şifre kaldır (yalnızca şifre biliniyorsa)', () => {
  it('doğru şifreyle kaldırılır; içerik ve görünüm aynen korunur', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const { bayt } = await sifreEkle(pdf, { kullaniciSifresi: 'Parola42' });
    const k = await sifreKaldir(bayt, 'Parola42');
    expect(await sifreliMi(k.bayt)).toBe(false);
    expect(await metinCikar(k.bayt)).toEqual(await metinCikar(pdf));
    expect(karsilastir(await sayfaPikselleri(k.bayt, 2), await sayfaPikselleri(pdf, 2)).farkliPiksel).toBe(0);
  });

  it('YANLIŞ şifre denemesi reddedilir; çıktı üretilmez', async () => {
    const { bayt } = await sifreEkle(await ornekPdf({ sayfa: 1 }), { kullaniciSifresi: 'dogru' });
    for (const deneme of ['yanlis', 'Dogru', 'dogru ', '123456', 'password']) {
      await expect(sifreKaldir(bayt, deneme), deneme).rejects.toBeInstanceOf(YanlisSifreHatasi);
    }
  });

  it('şifre GİRİLMEZSE hiçbir şey yapılmaz', async () => {
    const { bayt } = await sifreEkle(await ornekPdf({ sayfa: 1 }), { kullaniciSifresi: 'dogru' });
    await expect(sifreKaldir(bayt, '')).rejects.toMatchObject({ kod: 'SIFRE_GEREKLI' });
    await expect(sifreKaldir(bayt, undefined)).rejects.toBeInstanceOf(PdfHatasi);
  });

  it('açma şifresi boş, yalnızca kısıtlama olan belge: rastgele bir metinle kısıtlama KALDIRILAMAZ', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const r = await _testIcin.calistir(['--encrypt', '', 'sahip-sifresi', '256', '--print=none', '--modify=none', '--', '/girdi.pdf', '/cikti.pdf'], pdf);
    expect(r.cikti).toBeTruthy();
    for (const deneme of ['', 'rastgele', 'sahip', 'x']) {
      await expect(sifreKaldir(r.cikti, deneme)).rejects.toBeInstanceOf(PdfHatasi);
    }
    // Yalnızca gerçek sahip şifresiyle kaldırılır
    const k = await sifreKaldir(r.cikti, 'sahip-sifresi');
    expect(await sifreliMi(k.bayt)).toBe(false);
  });

  it('zaten şifresiz belge için "zaten şifresiz" der', async () => {
    await expect(sifreKaldir(await ornekPdf({ sayfa: 1 }), 'x')).rejects.toThrow(/zaten şifresiz/);
  });
});
