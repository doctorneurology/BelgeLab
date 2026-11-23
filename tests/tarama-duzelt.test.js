import { describe, it, expect, afterAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { bolgeDuzelt } from '../src/core/tarama-duzelt.js';
import { pdfOcr, goruntuOcr, ocrKapat } from '../src/core/ocr.js';
import { belgeAc, sayfaCiz, tuvaliBayta } from '../src/core/render.js';
import { eklenenleriKaldir } from '../src/core/cizim.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { taramaPdf, TARAMA_SATIRLARI, benzerlik } from './yardimci/tarama.js';

afterAll(() => ocrKapat());

const OLCEK = 2;

/** Satır kutusu (test üreticisinden) → düzeltme isteği */
function istek(kutular, i, yeni, ek = {}) {
  const k = kutular[0][i];
  return { sayfa: 1, kutu: { x0: k.x0 - 3, x1: k.x1 + 3, y0: k.y0, y1: k.y1 }, metin: yeni, eskiMetin: k.metin, aile: 'liberation-serif', ...ek };
}

/** Bölge dışındaki piksel farkı (bölge kutusu piksele çevrilip dışarıda bırakılır) */
function bolgeDisiFark(a, b, kutu, sayfaYuk, pay = 6) {
  let say = 0;
  const x0 = Math.floor((kutu.x0 - pay) * OLCEK), x1 = Math.ceil((kutu.x1 + pay) * OLCEK);
  const y0 = Math.floor((sayfaYuk - kutu.y1 - pay) * OLCEK), y1 = Math.ceil((sayfaYuk - kutu.y0 + pay) * OLCEK);
  for (let y = 0; y < a.yukseklik; y++) {
    for (let x = 0; x < a.genislik; x++) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
      const i = (y * a.genislik + x) * 4;
      if (a.veri[i] !== b.veri[i] || a.veri[i + 1] !== b.veri[i + 1] || a.veri[i + 2] !== b.veri[i + 2]) say++;
    }
  }
  return say;
}

describe('Taranmış belgede bölge düzeltme (kullanıcının seçtiği bölge)', () => {
  it('ÖRTME kipi: yalnızca seçilen bölge değişir; yeni yazı sayfada görünür ve gerçek (seçilebilir) yazıdır', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200, boyut: 14 });
    const r = await bolgeDuzelt(bayt, [istek(kutular, 1, 'Ağrı göğüs kafesinin sağ tarafında hissedilmiş,')]);
    // 1) bölge DIŞINDA tek piksel bile değişmedi
    const once = await sayfaPikselleri(bayt, 1, { olcek: OLCEK });
    const sonra = await sayfaPikselleri(r.bayt, 1, { olcek: OLCEK });
    expect(bolgeDisiFark(once, sonra, kutular[0][1], 841.89)).toBe(0);
    // 2) yeni yazı bölgede GÖRÜNÜYOR: çizilmiş sayfayı OCR'la oku
    const belge = await belgeAc(r.bayt);
    const { tuval } = await sayfaCiz(belge, 1, { olcek: 300 / 72 });
    const gorunen = (await goruntuOcr(await tuvaliBayta(tuval, 'png'))).metin.replace(/\s+/g, ' ');
    await belge.kapat();
    console.log('düzeltme sonrası görünen yazı (OCR ile):', gorunen);
    expect(benzerlik(gorunen, 'Hastanın şikâyetleri üç gündür devam etmektedir. Ağrı göğüs kafesinin sağ tarafında hissedilmiş, çabucak geçmiştir. Öğleden sonra kontrol önerildi. İstanbul’da yaşayan 54 yaşındaki hasta ilaçlarını düzenli kullanıyor.')).toBeGreaterThan(0.9);
    expect(gorunen).toContain('sağ tarafında');
    expect(gorunen).not.toContain('sol tarafında');
    // 3) yeni yazı seçilebilir gerçek yazı; diğer satırlar hâlâ yazısız (resim)
    const secilebilir = (await metinCikar(r.bayt))[0];
    expect(secilebilir).toContain('sağ tarafında');
    expect(secilebilir).not.toContain('Hastanın');
    // 4) eski görüntünün dosyada kaldığı dürüstçe söylenir
    expect(r.uyarilar.join(' ')).toContain('dosyada durmaya devam ediyor');
  });

  it('KALICI kip: eski yazının pikselleri dosyadan gerçekten silinir; diğer sayfalar bire bir aynı kalır', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI, ['İkinci sayfa hiç değişmeyecek.']], { dpi: 200, boyut: 14 });
    const r = await bolgeDuzelt(bayt, [istek(kutular, 1, 'Ağrı göğüs kafesinin sağ tarafında hissedilmiş,')], { kalici: true, dpi: 200, bicim: 'png' });
    // yeni (vektör) yazı katmanını ayıkla → altta kalan resimde eski yazıdan iz OLMAMALI
    const doc = await PDFDocument.load(r.bayt);
    expect(eklenenleriKaldir(doc, 'duzeltme').kaldirilan).toBeGreaterThan(0);
    const yalnizResim = new Uint8Array(await doc.save());
    const k = kutular[0][1];
    const px = await sayfaPikselleri(yalnizResim, 1, { olcek: OLCEK });
    let koyu = 0;
    const x0 = Math.floor(k.x0 * OLCEK) + 4, x1 = Math.floor(k.x1 * OLCEK) - 4;
    const y0 = Math.floor((841.89 - k.y1) * OLCEK) + 4, y1 = Math.floor((841.89 - k.y0) * OLCEK) - 4;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (px.veri[(y * px.genislik + x) * 4] < 200) koyu++;
    expect(koyu, 'bölgede eski yazıdan koyu piksel kalmamalı').toBe(0);
    // yeni yazı hâlâ okunur
    expect((await metinCikar(r.bayt))[0]).toContain('sağ tarafında');
    // dokunulmayan 2. sayfa özgünüyle aynı
    expect(karsilastir(await sayfaPikselleri(bayt, 2), await sayfaPikselleri(r.bayt, 2)).farkliPiksel).toBe(0);
    expect(r.uyarilar.join(' ')).toContain('tamamen silindi');
  });

  it('OCR katmanı olan sayfada: eski yazı arama katmanından da çıkar, diğer kelimeler aranabilir kalır', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200, boyut: 14 });
    const ocr = await pdfOcr(bayt, { dpi: 300 });
    expect((await metinCikar(ocr.bayt))[0]).toContain('sol tarafında');
    const r = await bolgeDuzelt(ocr.bayt, [istek(kutular, 1, 'Ağrı göğüs kafesinin sağ tarafında hissedilmiş,')]);
    const m = (await metinCikar(r.bayt))[0];
    expect(m).not.toContain('sol tarafında');
    expect(m).toContain('sağ tarafında');
    expect(m).toContain('Öğleden sonra'); // dokunulmayan satırlar hâlâ aranabilir
    expect(r.aramadanSilinen).toBeGreaterThan(3);
  });

  it('sığmayan yazı: otomatik boyutta küçültülür ve KULLANICIYA söylenir; çok uzun yazı sessizce bozulmaz', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 150, boyut: 14 });
    const r = await bolgeDuzelt(bayt, [istek(kutular, 0, 'Hastanın şikâyetleri üç gündür devam etmektedir ve giderek artmaktadır.')]);
    expect(r.rapor[0].kucultme).toBeLessThan(0.9);
    expect(r.uyarilar.join(' ')).toMatch(/sığmadığı için %\d+ küçültüldü/);
  });

  it('yazı tipinde olmayan karakter anlaşılır hata verir; geçersiz bölge/sayfa reddedilir', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 100 });
    await expect(bolgeDuzelt(bayt, [istek(kutular, 0, 'Merhaba ☃', { aile: 'liberation-serif' })])).rejects.toThrow(/yazı tipinde şu karakterler yok/);
    await expect(bolgeDuzelt(bayt, [{ sayfa: 9, kutu: { x0: 0, y0: 0, x1: 50, y1: 20 }, metin: 'x' }])).rejects.toThrow(/Sayfa 9 yok/);
    await expect(bolgeDuzelt(bayt, [{ sayfa: 1, kutu: { x0: 10, y0: 10, x1: 11, y1: 11 }, metin: 'x' }])).rejects.toThrow(/çok küçük/);
    await expect(bolgeDuzelt(bayt, [])).rejects.toThrow(/seçilmedi/);
  });

  it('koyu zeminli taramada zemin rengi otomatik bulunur (örtü, sayfanın rengiyle uyuşur)', async () => {
    const { bayt, kutular } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200, boyut: 14, arkaPlan: '#f3ead2', yaziRengi: '#222222' });
    const r = await bolgeDuzelt(bayt, [istek(kutular, 2, 'çabucak geçmiştir. Akşam kontrol önerildi.')]);
    expect(r.rapor[0].zemin).toMatch(/^#f[0-9a-f][e-f][0-9a-f][c-d][0-9a-f]$|^#f3ead2$/i);
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: OLCEK });
    const k = kutular[0][2];
    // örtünün sol-üst köşesi çevresiyle aynı renkte (leke yok)
    const i = (Math.floor((841.89 - k.y1 + 1) * OLCEK) * px.genislik + Math.floor((k.x0 - 2) * OLCEK)) * 4;
    expect(Math.abs(px.veri[i] - 0xf3)).toBeLessThan(8);
    expect(Math.abs(px.veri[i + 2] - 0xd2)).toBeLessThan(8);
  });
});
