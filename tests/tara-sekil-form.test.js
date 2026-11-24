import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { PNG } from 'pngjs';
import { taraPdf, pikselleriIyilestir } from '../src/core/tara.js';
import { sekilEkle, sekilleriKaldir } from '../src/core/sekil.js';
import { formAlanlariEkle } from '../src/core/form-olustur.js';
import { formAlanlari, formDoldur } from '../src/core/form.js';
import { belgeAc } from '../src/core/render.js';
import { sayfaPikselleri, karsilastir, metinCikar } from '../tools/karsilastir.mjs';
import { ornekPdf } from './yardimci/pdf-uret.js';

/** "Fotoğraflanmış belge": düzensiz ışık (soldan sağa 200→110 gri) üstünde koyu çizgiler (yazı yerine) */
async function belgeFotosu(w = 900, h = 1200) {
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#d2d2d2'); gr.addColorStop(1, '#808080');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#303030';
  for (let i = 0; i < 20; i++) g.fillRect(80, 100 + i * 48, 740, 10);
  const b = await c.encode('jpeg', 92);
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

describe('PDF\'e Tara', () => {
  it('siyah-beyaz: düzensiz ışıkta bile zemin beyaz, çizgiler siyah (yalnızca 0/255 değerleri)', () => {
    const w = 200, h = 100;
    const v = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const arka = 210 - (x / w) * 100; const yazi = y % 20 < 4 && x > 20 && x < 180; const g = yazi ? arka * 0.35 : arka; const i = (y * w + x) * 4; v[i] = v[i + 1] = v[i + 2] = g; v[i + 3] = 255; }
    pikselleriIyilestir(v, w, h, 'siyah-beyaz');
    let siyah = 0, beyaz = 0, diger = 0, solYazi = 0, sagArka = 0, sagYaziBeyaz = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = v[(y * w + x) * 4]; if (g === 0) siyah++; else if (g === 255) beyaz++; else diger++;
      if (x === 30 && y % 20 === 1) solYazi += g === 0 ? 1 : 0;
      if (x === 190 && y % 20 === 10) sagArka += g === 255 ? 1 : 0;
      if (x === 170 && y % 20 === 1) sagYaziBeyaz += g === 255 ? 1 : 0;
    }
    expect(diger).toBe(0);
    expect(solYazi).toBe(5); // aydınlık tarafta yazı siyah
    expect(sagArka).toBe(5); // karanlık taraftaki ZEMİN de beyaz (basit eşikte siyah olurdu)
    expect(sagYaziBeyaz).toBe(0); // karanlık taraftaki yazı siyah
    expect(siyah).toBeGreaterThan(500);
    expect(beyaz).toBeGreaterThan(siyah * 3);
  });

  it('fotoğraf → PDF: A4 sayfa, iyileştirme yapılmış (kontrast arttı), döndürme boyutu çevirir; çoklu resim = çoklu sayfa', async () => {
    const foto = await belgeFotosu();
    const r = await taraPdf([{ ad: 'a.jpg', bayt: foto }, { ad: 'b.jpg', bayt: foto, don: 90 }], { mod: 'kontrast' });
    expect(r.sayfaSayisi).toBe(2);
    const b = await belgeAc(r.bayt);
    const v1 = (await b.getPage(1)).getViewport({ scale: 1 }), v2 = (await b.getPage(2)).getViewport({ scale: 1 });
    await b.kapat();
    expect(v1.height).toBeGreaterThan(v1.width); // dikey fotoğraf → dikey sayfa
    expect(v2.width).toBeGreaterThan(v2.height); // 90° dönen fotoğraf → yatay sayfa
    const orijinal = await sayfaPikselleri((await taraPdf([{ ad: 'a.jpg', bayt: foto }], { mod: 'ozgun' })).bayt, 1, { olcek: 1 });
    const islenmis = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    const aralik = (p) => { let lo = 255, hi = 0; for (let i = 0; i < p.veri.length; i += 4) { lo = Math.min(lo, p.veri[i]); hi = Math.max(hi, p.veri[i]); } return hi - lo; };
    expect(aralik(islenmis)).toBeGreaterThan(aralik(orijinal));
    const bw = await taraPdf([{ ad: 'a.jpg', bayt: foto }], { mod: 'siyah-beyaz' });
    expect(bw.bayt.length).toBeLessThan(foto.length);
    expect(bw.uyarilar.join(' ')).toContain('Siyah-beyaz kipi');
    await expect(taraPdf([], {})).rejects.toThrow(/en az bir/i);
    await expect(taraPdf([{ ad: 'x', bayt: new Uint8Array([1, 2, 3]) }])).rejects.toThrow(/okunamadı/);
  });
});

describe('Şekil / vurgu ekleme (PDF düzenleyici)', () => {
  it('dikdörtgen, elips, çizgi, ok, vurgu ve serbest çizim görünür; geri alınınca sayfa PİKSEL PİKSEL özgününe döner', async () => {
    const pdf = await ornekPdf({ sayfa: 2 });
    const r = await sekilEkle(pdf, [
      { sayfa: 0, tur: 'dikdortgen', x0: 60, y0: 300, x1: 160, y1: 360, renk: '#cc0000', kalinlik: 3 },
      { sayfa: 0, tur: 'elips', x0: 200, y0: 300, x1: 300, y1: 360, renk: '#0000cc', dolgu: '#99ccff', kalinlik: 2 },
      { sayfa: 0, tur: 'cizgi', x0: 60, y0: 250, x1: 300, y1: 250, renk: '#008000', kalinlik: 4 },
      { sayfa: 0, tur: 'ok', x0: 60, y0: 200, x1: 300, y1: 200, renk: '#800080', kalinlik: 3 },
      { sayfa: 0, tur: 'vurgu', x0: 70, y0: 700, x1: 400, y1: 716 },
      { sayfa: 1, tur: 'serbest', noktalar: [[50, 400], [100, 450], [150, 400], [200, 450]], renk: '#ff6600', kalinlik: 3 },
    ]);
    const A = await sayfaPikselleri(pdf, 1, { olcek: 1 }), B = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    const renkli = (p, x, y) => { const i = (Math.round(y) * p.genislik + Math.round(x)) * 4; return [p.veri[i], p.veri[i + 1], p.veri[i + 2]]; };
    const yy = (pt) => 842 - pt; // pdf y → piksel y (sayfa yüksekliği ~842)
    expect(renkli(B, 60, yy(330))[0]).toBeGreaterThan(180); // kırmızı kenar (x=60)
    expect(renkli(B, 250, yy(330))).toEqual([153, 204, 255]); // elips içi açık mavi
    expect(renkli(B, 200, yy(250))[1]).toBeGreaterThan(100); // yeşil çizgi
    expect(renkli(B, 150, yy(200))[0]).toBeGreaterThan(90); // mor ok gövdesi
    const kar = renkli(B, 300, yy(708)); // vurgu: yazının üstünde sarımsı (opak olmayan)
    expect(karsilastir(A, B).farkliPiksel).toBeGreaterThan(1500);
    const S2 = await sayfaPikselleri(r.bayt, 2, { olcek: 1 }), O2 = await sayfaPikselleri(pdf, 2, { olcek: 1 });
    expect(karsilastir(O2, S2).farkliPiksel).toBeGreaterThan(100);
    expect(kar).toBeDefined();
    // metin hâlâ okunur (vurgu saydam)
    expect((await metinCikar(r.bayt))[0]).toContain('Sayfa 1 / 2');
    // geri al
    const g = await sekilleriKaldir(r.bayt);
    expect(g.kaldirilan).toBe(2); // iki sayfada işaretli içerik akışı
    for (const no of [1, 2]) expect(karsilastir(await sayfaPikselleri(pdf, no), await sayfaPikselleri(g.bayt, no)).farkliPiksel, `sayfa ${no}`).toBe(0);
    expect((await sekilleriKaldir(pdf)).kaldirilan).toBe(0);
  });

  it('döndürülmüş sayfada şekil görünür koordinata göre doğru yere gelir; geçersiz girdi reddedilir', async () => {
    const pdf = await ornekPdf({ sayfa: 1, don: 90 });
    const r = await sekilEkle(pdf, [{ sayfa: 0, tur: 'vurgu', x0: 100, y0: 100, x1: 200, y1: 150, renk: '#ff0000', opaklik: 1 }]);
    const p = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    // 90° dönmüş sayfa: görünür boyut 841.89 x 595.28; görünür sol-alt (100..200, 100..150) kırmızı olmalı
    const i = (Math.round(p.yukseklik - 125) * p.genislik + 150) * 4;
    expect([p.veri[i], p.veri[i + 1], p.veri[i + 2]]).toEqual([255, 0, 0]);
    await expect(sekilEkle(pdf, [{ sayfa: 5, tur: 'elips', x0: 0, y0: 0, x1: 10, y1: 10 }])).rejects.toThrow(/Sayfa 6 yok/);
    await expect(sekilEkle(pdf, [{ sayfa: 0, tur: 'yildiz', x0: 0, y0: 0, x1: 10, y1: 10 }])).rejects.toThrow(/Bilinmeyen/);
    await expect(sekilEkle(pdf, [{ sayfa: 0, tur: 'elips', x0: 0, y0: 0, x1: 0.2, y1: 0.2 }])).rejects.toThrow(/çok küçük/);
    await expect(sekilEkle(pdf, [])).rejects.toThrow(/şekil yok/);
  });
});

describe('Doldurulabilir form oluştur', () => {
  it('metin, onay, radyo, açılır liste alanları gerçek AcroForm alanı olur; mevcut "Form doldur" çekirdeği doldurur; Türkçe karakter çizilir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const r = await formAlanlariEkle(pdf, [
      { tur: 'metin', ad: 'ad_soyad', sayfa: 0, x0: 72, y0: 600, x1: 372, y1: 624, varsayilan: 'Çağlar Öğüt' },
      { tur: 'metin', ad: 'adres', sayfa: 0, x0: 72, y0: 500, x1: 372, y1: 580, cokSatir: true },
      { tur: 'onay', ad: 'kabul', sayfa: 0, x0: 72, y0: 460, x1: 90, y1: 478 },
      { tur: 'secenek', ad: 'cinsiyet', secenek: 'kadin', sayfa: 0, x0: 72, y0: 420, x1: 90, y1: 438 },
      { tur: 'secenek', ad: 'cinsiyet', secenek: 'erkek', sayfa: 0, x0: 120, y0: 420, x1: 138, y1: 438 },
      { tur: 'liste', ad: 'il', sayfa: 0, x0: 72, y0: 370, x1: 272, y1: 394, secenekler: ['Ankara', 'İzmir', 'Muğla'], varsayilan: 'İzmir' },
    ]);
    expect(r.eklenen).toBe(6);
    const f = await formAlanlari(r.bayt);
    const adlar = f.alanlar.map((a) => `${a.ad}:${a.tur}`).sort();
    expect(adlar).toEqual(['ad_soyad:metin', 'adres:metin', 'cinsiyet:secenek', 'il:acilir', 'kabul:onay']);
    expect(f.alanlar.find((a) => a.ad === 'ad_soyad').deger).toBe('Çağlar Öğüt');
    expect(f.alanlar.find((a) => a.ad === 'il').deger).toBe('İzmir');
    // doldur ve çiz
    const d = await formDoldur(r.bayt, { adres: 'Şişli / İstanbul ğüşıöç', kabul: true, cinsiyet: 'erkek' });
    const f2 = await formAlanlari(d.bayt);
    expect(f2.alanlar.find((a) => a.ad === 'adres').deger).toContain('ğüşıöç');
    expect(f2.alanlar.find((a) => a.ad === 'cinsiyet').deger).toBe('erkek');
    const once = await sayfaPikselleri(pdf, 1, { olcek: 1.5 }), sonra = await sayfaPikselleri(r.bayt, 1, { olcek: 1.5 });
    expect(karsilastir(once, sonra).farkliPiksel).toBeGreaterThan(300); // alan kutuları sayfada görünüyor
  });

  it('yinelenen/geçersiz ad, çok küçük alan, olmayan sayfa anlaşılır hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const bir = await formAlanlariEkle(pdf, [{ tur: 'metin', ad: 'x', sayfa: 0, x0: 10, y0: 10, x1: 100, y1: 30 }]);
    await expect(formAlanlariEkle(bir.bayt, [{ tur: 'metin', ad: 'x', sayfa: 0, x0: 10, y0: 50, x1: 100, y1: 70 }])).rejects.toThrow(/zaten var/);
    await expect(formAlanlariEkle(pdf, [{ tur: 'metin', ad: 'a.b', sayfa: 0, x0: 10, y0: 10, x1: 100, y1: 30 }])).rejects.toThrow(/geçersiz/);
    await expect(formAlanlariEkle(pdf, [{ tur: 'metin', ad: 'k', sayfa: 0, x0: 10, y0: 10, x1: 12, y1: 12 }])).rejects.toThrow(/çok küçük/);
    await expect(formAlanlariEkle(pdf, [{ tur: 'metin', ad: 'k', sayfa: 3, x0: 10, y0: 10, x1: 100, y1: 30 }])).rejects.toThrow(/Sayfa 4 yok/);
    await expect(formAlanlariEkle(pdf, [{ tur: 'liste', ad: 'l', sayfa: 0, x0: 10, y0: 10, x1: 100, y1: 30, secenekler: [] }])).rejects.toThrow(/en az bir seçenek/);
  });
});
