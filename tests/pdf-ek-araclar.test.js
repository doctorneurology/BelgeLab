import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, PDFName, PDFString } from 'pdf-lib';
import { bosSayfalariBul, bosSayfalariSil, bosSayfadanBol } from '../src/core/bos-sayfa.js';
import { bol } from '../src/core/sayfalar.js';
import { yerimleriYaz, yerimleriOku, yerimiMetniCoz, baslikBul } from '../src/core/yer-imi.js';
import { ustveriOku, ustveriYaz, formuDuzlestir, aciklamalariKaldir, resimleriKaldir } from '../src/core/temizlik.js';
import { belgeAc } from '../src/core/render.js';
import { ornekPdf, pngUret, formluPdf } from './yardimci/pdf-uret.js';

async function yazili(desen, { baslik } = {}) {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  desen.forEach((m, i) => { const p = doc.addPage([300, 400]); if (m) p.drawText(`${m} ${i + 1}`, { x: 40, y: 300, size: 24, font: f }); });
  if (baslik) doc.setTitle(baslik);
  return new Uint8Array(await doc.save());
}
const sayfaSay = async (b) => (await PDFDocument.load(b)).getPageCount();
const latin = (b) => new TextDecoder('latin1').decode(b);

describe('boş sayfalar', () => {
  it('bulur ve siler', async () => {
    const b = await yazili(['A', '', 'A', '', 'A']);
    const r = await bosSayfalariBul(b);
    expect(r.bos).toEqual([1, 3]);
    const s = await bosSayfalariSil(b);
    expect(s).toMatchObject({ silinen: 2, sayfaSayisi: 3, silinenSayfalar: [2, 4] });
    expect(await sayfaSay(s.bayt)).toBe(3);
  });
  it('hiç boş yoksa dokunmaz; hepsi boşsa hata', async () => {
    expect((await bosSayfalariSil(await yazili(['A', 'B']))).degisti).toBe(false);
    await expect(bosSayfalariSil(await yazili(['', '']))).rejects.toThrow(/boş/);
  });
  it('boş sayfalardan bölerken boş sayfalar çıktıya girmez', async () => {
    const r = await bosSayfadanBol(await yazili(['A', 'B', '', 'C', '', '', 'D']), 'x.pdf');
    expect(r.dosyalar.map((d) => d.sayfalar)).toEqual([[1, 2], [4], [7]]);
    expect(await sayfaSay(r.dosyalar[0].bayt)).toBe(2);
  });
});

describe('yer imleri', () => {
  it('yazar, okur, iç içe düzeyleri ve Türkçe başlıkları korur', async () => {
    const b = await yazili(['A', 'B', 'C', 'D', 'E', 'F']);
    const liste = [{ duzey: 1, sayfa: 0, baslik: 'Giriş' }, { duzey: 2, sayfa: 1, baslik: 'Yöntem ve şekiller' }, { duzey: 1, sayfa: 3, baslik: 'Sonuçlar ĞÜŞİÖÇ' }, { duzey: 3, sayfa: 4, baslik: 'Derin' }];
    const y = await yerimleriYaz(b, liste);
    expect(y.adet).toBe(4);
    const oku = await yerimleriOku(y.bayt);
    expect(oku.map((o) => [o.duzey, o.sayfa, o.baslik])).toEqual([[1, 0, 'Giriş'], [2, 1, 'Yöntem ve şekiller'], [1, 3, 'Sonuçlar ĞÜŞİÖÇ'], [2, 4, 'Derin']]);
    const bos = await yerimleriYaz(y.bayt, []);
    expect(bos.adet).toBe(0);
    expect(await yerimleriOku(bos.bayt)).toEqual([]);
  });
  it('metin biçimini çözer ve hatayı açıkça söyler', () => {
    expect(yerimiMetniCoz('# not\n1 | 2 | Giriş\n2|3|Alt', 5)).toEqual([{ duzey: 1, sayfa: 1, baslik: 'Giriş' }, { duzey: 2, sayfa: 2, baslik: 'Alt' }]);
    expect(() => yerimiMetniCoz('1 | 9 | X', 5)).toThrow(/belgede yok/);
    expect(() => yerimiMetniCoz('selam', 5)).toThrow(/anlaşılamadı/);
  });
  it('yer imlerine göre böler (bölüm adı dosya adında)', async () => {
    const b = await yazili(['A', 'B', 'C', 'D', 'E', 'F']);
    const y = await yerimleriYaz(b, [{ duzey: 1, sayfa: 1, baslik: 'Birinci/Bölüm' }, { duzey: 1, sayfa: 4, baslik: 'İkinci' }]);
    const r = await bol(y.bayt, 'k.pdf', { mod: 'yerimi', duzey: 1 });
    expect(r.dosyalar.map((d) => d.sayfalar)).toEqual([[1], [2, 3, 4], [5, 6]]);
    expect(r.dosyalar[1].ad).toMatch(/Birinci Bölüm/);
    await expect(bol(b, 'k.pdf', { mod: 'yerimi', duzey: 1 })).rejects.toThrow(/yer imi/);
  });
});

describe('boyuta göre bölme', () => {
  it('her parça hedef boyutu aşmaz, tüm sayfalar sırayla korunur', async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 40; i++) { const p = doc.addPage([300, 400]); for (let k = 0; k < 40; k++) p.drawText(`satir ${i}-${k} ${Math.random()}`, { x: 20, y: 380 - k * 9, size: 7, font: f }); }
    const b = new Uint8Array(await doc.save({ useObjectStreams: false }));
    const hedef = 12 * 1024;
    const r = await bol(b, 'b.pdf', { mod: 'boyut', hedefMB: hedef / 1048576 });
    expect(r.dosyalar.length).toBeGreaterThan(2);
    for (const d of r.dosyalar) expect(d.bayt.length).toBeLessThanOrEqual(hedef + 1);
    expect(r.dosyalar.flatMap((d) => d.sayfalar)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });
});

describe('üstveri ve gizli bilgi', () => {
  it('okur, yazar, temizler; ek ve JavaScript dosyadan gerçekten silinir', async () => {
    const doc = await PDFDocument.create(); doc.addPage([200, 200]);
    doc.setTitle('Gizli Başlık'); doc.setAuthor('Dr. Örnek'); doc.setKeywords(['a', 'b']);
    await doc.attach(new TextEncoder().encode('COK-GIZLI-EK-ICERIGI-12345'), 'ek.txt', { mimeType: 'text/plain' });
    const js = doc.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') });
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.register(js));
    const b = new Uint8Array(await doc.save({ useObjectStreams: false }));
    const o = await ustveriOku(b);
    expect(o).toMatchObject({ baslik: 'Gizli Başlık', yazar: 'Dr. Örnek', ek: 1, javascript: 1 });
    const y = await ustveriYaz(b, { alanlar: { baslik: 'Yeni' } });
    expect((await ustveriOku(y.bayt)).baslik).toBe('Yeni');
    const t = await ustveriYaz(b, { temizle: { tumUstveri: true, xmp: true, javascript: true, ekler: true } });
    expect(await ustveriOku(t.bayt)).toMatchObject({ baslik: '', yazar: '', ek: 0, javascript: 0 });
    const nesneler = async (x) => { const d = await PDFDocument.load(x); return [...d.context.enumerateIndirectObjects()].map(([, o]) => (o.dict ?? o)).filter((o) => o?.get).map((o) => (o.get(PDFName.of('Type'))?.toString() ?? '') + (o.get(PDFName.of('S'))?.toString() ?? '')).join(' '); };
    const once = await nesneler(b), sonra = await nesneler(t.bayt);
    expect(once).toContain('/EmbeddedFile'); expect(once).toContain('/JavaScript');
    expect(sonra).not.toContain('/EmbeddedFile'); expect(sonra).not.toContain('/JavaScript'); expect(sonra).not.toContain('/Filespec');
    expect(t.uyarilar.join(' ')).toMatch(/Üretici/);
  });
});

describe('form düzleştir, açıklama ve resim kaldır', () => {
  it('formu düzleştirir', async () => {
    const r = await formuDuzlestir(await formluPdf());
    expect(r.degisti).toBe(true);
    expect(r.alan).toBeGreaterThan(0);
    expect((await PDFDocument.load(r.bayt)).getForm().getFields().length).toBe(0);
    expect((await formuDuzlestir(await ornekPdf())).degisti).toBe(false);
  });
  it('seçilen türdeki açıklamaları kaldırır, diğerlerine dokunmaz', async () => {
    const doc = await PDFDocument.create(); const p = doc.addPage([200, 200]);
    const a = (tur) => doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: tur, Rect: [10, 10, 50, 30] }));
    p.node.set(PDFName.of('Annots'), doc.context.obj([a('Highlight'), a('Text'), a('Link'), a('Link')]));
    const b = new Uint8Array(await doc.save());
    const r = await aciklamalariKaldir(b, { turler: ['yorum', 'vurgu'] });
    expect(r.sayac).toEqual({ Highlight: 1, Text: 1 });
    expect((await PDFDocument.load(r.bayt)).getPage(0).node.Annots().size()).toBe(2);
    expect((await aciklamalariKaldir(b, { turler: ['baglanti'] })).toplam).toBe(2);
  });
  it('sayfadaki resimleri kaldırır, yazı kalır, resim verisi dosyadan silinir', async () => {
    const doc = await PDFDocument.create(); const p = doc.addPage([300, 300]);
    const f = await doc.embedFont(StandardFonts.Helvetica);
    p.drawText('Yazi kalmali', { x: 20, y: 250, size: 20, font: f });
    const png = await doc.embedPng(pngUret(60, 60, [10, 200, 30, 255]));
    p.drawImage(png, { x: 20, y: 100, width: 100, height: 100 });
    p.drawImage(png, { x: 150, y: 100, width: 100, height: 100 });
    const b = new Uint8Array(await doc.save({ useObjectStreams: false }));
    const imgSay = (x) => (latin(x).match(/\/Subtype\s*\/Image/g) ?? []).length;
    expect(imgSay(b)).toBe(1);
    const r = await resimleriKaldir(b);
    expect(r).toMatchObject({ degisti: true, adet: 2 });
    expect(imgSay(r.bayt)).toBe(0);
    const belge = await belgeAc(r.bayt); const s = await belge.getPage(1);
    expect((await s.getTextContent()).items.map((o) => o.str).join('')).toContain('Yazi kalmali');
    await belge.kapat();
  });
});

describe('başlığa göre ad', () => {
  it('önce üstveri başlığı, yoksa ilk sayfadaki en büyük yazı', async () => {
    expect(await baslikBul(await yazili(['A'], { baslik: 'Akut İskemik İnme Kılavuzu' }))).toMatchObject({ baslik: 'Akut İskemik İnme Kılavuzu', kaynak: 'ustveri' });
    const doc = await PDFDocument.create(); const p = doc.addPage([400, 500]);
    const f = await doc.embedFont(StandardFonts.HelveticaBold), g = await doc.embedFont(StandardFonts.Helvetica);
    p.drawText('Serebrovaskuler Hastaliklar Rehberi', { x: 20, y: 440, size: 22, font: f });
    p.drawText('kucuk aciklama satiri burada duruyor', { x: 20, y: 400, size: 10, font: g });
    expect(await baslikBul(new Uint8Array(await doc.save()))).toMatchObject({ baslik: 'Serebrovaskuler Hastaliklar Rehberi', kaynak: 'ilk-sayfa' });
  });
});
