import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { sayfaSil, sayfaSirala, sayfaDondur, sayfaDondurSecim, sayfaCikar } from '../src/core/sayfalar.js';
import { sayfaPikselleri, metinCikar, karsilastir, sayfaSayisiOku } from '../tools/karsilastir.mjs';
import { ornekPdf, gizliIsaretEkle, baytIcerir, formluPdf } from './yardimci/pdf-uret.js';

const baslik = (m) => m.split(' Pijamalı')[0];

describe('Sayfa sil', () => {
  it('seçilen sayfaları siler, kalanlar görsel olarak aynen korunur', async () => {
    const pdf = await ornekPdf({ sayfa: 5 });
    const s = await sayfaSil(pdf, '2, 4-5');
    expect(s.silinen).toBe(3);
    expect((await metinCikar(s.bayt)).map(baslik)).toEqual(['Sayfa 1 / 5', 'Sayfa 3 / 5']);
    const fark = karsilastir(await sayfaPikselleri(s.bayt, 2), await sayfaPikselleri(pdf, 3));
    expect(fark.farkliPiksel).toBe(0);
  });

  it('silinen sayfanın içeriği dosyada gizli kalmaz', async () => {
    let pdf = await ornekPdf({ sayfa: 3 });
    pdf = await gizliIsaretEkle(pdf, 1, 'GIZLI-ISARET-SAYFA-2');
    pdf = await gizliIsaretEkle(pdf, 0, 'KALAN-ISARET-SAYFA-1');
    expect(baytIcerir(pdf, 'GIZLI-ISARET-SAYFA-2')).toBe(true); // giriş dosyasında var
    const s = await sayfaSil(pdf, '2');
    expect(baytIcerir(s.bayt, 'GIZLI-ISARET-SAYFA-2')).toBe(false); // çıktıdan tamamen gitmiş
    expect(baytIcerir(s.bayt, 'KALAN-ISARET-SAYFA-1')).toBe(true);
  });

  it('tüm sayfaları silmeye izin vermez', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    await expect(sayfaSil(pdf, '1-2')).rejects.toThrow(/en az bir sayfa kalmalı/);
  });
});

describe('Sayfa sırala', () => {
  it('sayfaları yeni sıraya dizer', async () => {
    const pdf = await ornekPdf({ sayfa: 4 });
    const s = await sayfaSirala(pdf, [3, 0, 2, 1]);
    expect((await metinCikar(s.bayt)).map(baslik)).toEqual(['Sayfa 4 / 4', 'Sayfa 1 / 4', 'Sayfa 3 / 4', 'Sayfa 2 / 4']);
  });
  it('eksik/tekrarlı sıralamayı reddeder', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    await expect(sayfaSirala(pdf, [0, 1])).rejects.toThrow(/tüm 3 sayfayı/);
    await expect(sayfaSirala(pdf, [0, 0, 1])).rejects.toThrow(/tüm 3 sayfayı/);
  });
});

describe('Sayfa döndür', () => {
  it('90° döndürünce sayfa boyutu yer değiştirir; 4×90° özgün haline döner', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const once = await sayfaPikselleri(pdf, 1);
    const s = await sayfaDondur(pdf, { 0: 90 });
    const sonra = await sayfaPikselleri(s.bayt, 1);
    expect([sonra.genislik, sonra.yukseklik]).toEqual([once.yukseklik, once.genislik]);
    // 2. sayfa dokunulmamış
    expect(karsilastir(await sayfaPikselleri(s.bayt, 2), await sayfaPikselleri(pdf, 2)).farkliPiksel).toBe(0);
    let t = pdf;
    for (let i = 0; i < 4; i++) t = (await sayfaDondur(t, { 0: 90 })).bayt;
    expect(karsilastir(await sayfaPikselleri(t, 1), once).farkliPiksel).toBe(0);
  });

  it('saat yönünün tersi (-90 = 270) ve seçili sayfalar', async () => {
    const pdf = await ornekPdf({ sayfa: 3 });
    const s = await sayfaDondurSecim(pdf, -90, '2-3');
    const d = await PDFDocument.load(s.bayt);
    expect(d.getPages().map((p) => p.getRotation().angle)).toEqual([0, 270, 270]);
  });

  it('formu ve içeriği olduğu gibi korur (belgenin kalanına dokunmaz)', async () => {
    const f = await formluPdf();
    const s = await sayfaDondur(f, { 0: 180 });
    const d = await PDFDocument.load(s.bayt);
    expect(d.getForm().getFields().map((x) => x.getName()).sort()).toEqual(['ad', 'adres', 'cinsiyet', 'il', 'kisa', 'onay']);
  });

  it('90\'ın katı olmayan açıyı reddeder', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(sayfaDondur(pdf, { 0: 45 })).rejects.toThrow(/90/);
  });
});

describe('Sayfa çıkar', () => {
  it('seçilen sayfaları yazılan sırayla yeni PDF yapar', async () => {
    const pdf = await ornekPdf({ sayfa: 6 });
    const s = await sayfaCikar(pdf, '5, 2-3');
    expect(await sayfaSayisiOku(s.bayt)).toBe(3);
    expect((await metinCikar(s.bayt)).map(baslik)).toEqual(['Sayfa 5 / 6', 'Sayfa 2 / 6', 'Sayfa 3 / 6']);
  });
  it('olmayan sayfa için hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    await expect(sayfaCikar(pdf, '3')).rejects.toThrow(/Sayfa 3 yok/);
  });
});
