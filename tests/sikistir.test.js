import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { sikistir } from '../src/core/sikistir.js';
import { sifreEkle } from '../src/core/sifre.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { ornekPdf, pngUret } from './yardimci/pdf-uret.js';

/** Fotoğrafa benzer test resmi: yumuşak renk geçişleri, şekiller ve hafif gürültü. */
async function fotoUret(w, h, bicim = 'jpeg') {
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#3a6ea5'); gr.addColorStop(0.5, '#e8c07d'); gr.addColorStop(1, '#7a2e4d');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1d3b2a'; g.beginPath(); g.arc(w * 0.3, h * 0.55, h * 0.28, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2f2f2'; g.fillRect(w * 0.55, h * 0.2, w * 0.3, h * 0.35);
  const d = g.getImageData(0, 0, w, h);
  let s = 12345;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = ((s >> 16) % 13) - 6;
    d.data[i] = Math.max(0, Math.min(255, d.data[i] + n));
    d.data[i + 1] = Math.max(0, Math.min(255, d.data[i + 1] + n));
    d.data[i + 2] = Math.max(0, Math.min(255, d.data[i + 2] + n));
  }
  g.putImageData(d, 0, 0);
  const b = bicim === 'jpeg' ? await c.encode('jpeg', 97) : await c.encode('png');
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

async function fotoluPdf({ bicim = 'jpeg', w = 2800, h = 1900 } = {}) {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, 'liberation-sans');
  const resim = bicim === 'jpeg' ? await doc.embedJpg(await fotoUret(w, h)) : await doc.embedPng(await fotoUret(w, h, 'png'));
  const p = doc.addPage([595.28, 841.89]);
  p.drawText('Fotoğraflı rapor: ğüşıöç İĞÜŞÖÇ', { x: 72, y: 780, size: 14, font: f });
  p.drawImage(resim, { x: 72, y: 380, width: 450, height: 450 * h / w });
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('İkinci sayfa yalnızca yazı içerir.', { x: 72, y: 780, size: 12, font: f });
  return new Uint8Array(await doc.save());
}

function psnr(a, b) {
  let t = 0, n = 0;
  for (let i = 0; i < a.veri.length; i += 4) for (let k = 0; k < 3; k++) { const e = a.veri[i + k] - b.veri[i + k]; t += e * e; n++; }
  const mse = t / n;
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
}

describe('Sıkıştırma (kaliteyi koruyarak)', () => {
  it('JPEG fotoğraf: dosya belirgin küçülür, görüntü kalitesi korunur (PSNR), yazı aynı kalır', async () => {
    const pdf = await fotoluPdf();
    const sonuclar = {};
    for (const duzey of ['hafif', 'dengeli', 'guclu']) {
      const r = await sikistir(pdf, { duzey });
      expect(r.degisti, duzey).toBe(true);
      const kalite = psnr(await sayfaPikselleri(pdf, 1, { olcek: 3 }), await sayfaPikselleri(r.bayt, 1, { olcek: 3 }));
      sonuclar[duzey] = { kb: Math.round(r.bayt.length / 1024), once: Math.round(pdf.length / 1024), tasarruf: r.rapor.tasarrufYuzde, psnr: Math.round(kalite * 10) / 10 };
      expect(await metinCikar(r.bayt)).toEqual(await metinCikar(pdf));
      expect(r.rapor.resimYenilenen).toBe(1);
    }
    console.log('Sıkıştırma sonuçları:', JSON.stringify(sonuclar));
    expect(sonuclar.hafif.tasarruf).toBeGreaterThan(20);
    expect(sonuclar.dengeli.tasarruf).toBeGreaterThan(sonuclar.hafif.tasarruf);
    expect(sonuclar.guclu.kb).toBeLessThan(sonuclar.dengeli.kb);
    expect(sonuclar.dengeli.tasarruf).toBeGreaterThan(70); // 540 dpi → 200 dpi
    expect(sonuclar.hafif.psnr).toBeGreaterThan(36);
    expect(sonuclar.dengeli.psnr).toBeGreaterThan(33);
    expect(sonuclar.guclu.psnr).toBeGreaterThan(30);
  });

  it('yazı sayfaları piksel piksel aynı kalır (yalnızca resim değişir)', async () => {
    const pdf = await fotoluPdf();
    const r = await sikistir(pdf, { duzey: 'dengeli' });
    expect(karsilastir(await sayfaPikselleri(pdf, 2), await sayfaPikselleri(r.bayt, 2)).farkliPiksel).toBe(0);
  });

  it('Flate (PNG) fotoğraf da JPEG\'e çevrilerek küçülür', async () => {
    const pdf = await fotoluPdf({ bicim: 'png', w: 1600, h: 1100 });
    const r = await sikistir(pdf, { duzey: 'dengeli' });
    expect(r.rapor.resimYenilenen).toBe(1);
    expect(r.rapor.tasarrufYuzde).toBeGreaterThan(60);
    const q = psnr(await sayfaPikselleri(pdf, 1, { olcek: 3 }), await sayfaPikselleri(r.bayt, 1, { olcek: 3 }));
    console.log(`PNG→JPEG PSNR ${q.toFixed(1)} dB, tasarruf %${r.rapor.tasarrufYuzde}`);
    expect(q).toBeGreaterThan(33);
  });

  it('grafik (az renkli) ve saydam maskeli resimlere DOKUNMAZ; açıklamasını verir', async () => {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    const p = doc.addPage([595, 842]);
    p.drawText('logo', { x: 50, y: 800, size: 10, font: f });
    p.drawImage(await doc.embedPng(pngUret(800, 600, [20, 90, 200, 255])), { x: 50, y: 500, width: 300, height: 225 }); // düz renk grafik
    p.drawImage(await doc.embedPng(pngUret(300, 200, [200, 30, 30, 128])), { x: 50, y: 250, width: 150, height: 100 }); // yarı saydam
    const pdf = new Uint8Array(await doc.save());
    const r = await sikistir(pdf, { duzey: 'guclu' });
    expect(r.rapor.resimYenilenen).toBe(0);
    expect(Object.keys(r.rapor.atlananlar).join(' ')).toMatch(/grafik/);
    expect(Object.keys(r.rapor.atlananlar).join(' ')).toMatch(/saydamlık/);
    expect(karsilastir(await sayfaPikselleri(pdf, 1), await sayfaPikselleri(r.bayt, 1)).farkliPiksel).toBe(0);
  });

  it('kullanılmayan (artık) nesneleri temizler: yalnızca yazılı belge bile küçülür, içerik aynı kalır', async () => {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    doc.addPage([595, 842]).drawText('Merhaba dünya', { x: 72, y: 700, size: 14, font: f });
    for (let i = 0; i < 40; i++) doc.context.register(doc.context.stream(new Uint8Array(20000).map((_, k) => (k * 7 + i * 13) % 251)));
    const pdf = new Uint8Array(await doc.save({ useObjectStreams: false }));
    const r = await sikistir(pdf, { duzey: 'hafif' });
    expect(r.degisti).toBe(true);
    expect(r.rapor.silinenNesne).toBeGreaterThanOrEqual(40);
    expect(r.bayt.length).toBeLessThan(pdf.length * 0.2);
    expect(await metinCikar(r.bayt)).toEqual(['Merhaba dünya']);
    expect(karsilastir(await sayfaPikselleri(pdf, 1), await sayfaPikselleri(r.bayt, 1)).farkliPiksel).toBe(0);
  });

  it('dosyayı ASLA büyütmez: kazanç yoksa özgün dosya aynen döner ve bu söylenir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    const r = await sikistir(pdf, { duzey: 'dengeli' });
    expect(r.bayt.length).toBeLessThanOrEqual(pdf.length);
    if (!r.degisti) {
      expect(r.bayt).toBe(pdf);
      expect(r.uyarilar.join(' ')).toContain('zaten iyi sıkıştırılmış');
    }
  });

  it('geçersiz düzey ve şifreli dosya anlaşılır hata verir', async () => {
    const pdf = await ornekPdf({ sayfa: 1 });
    await expect(sikistir(pdf, { duzey: 'cok' })).rejects.toThrow(/hafif, dengeli ya da güçlü/);
    const sifreli = (await sifreEkle(pdf, { kullaniciSifresi: 'abc123' })).bayt;
    await expect(sikistir(sifreli, {})).rejects.toThrow(/şifre/i);
  });
});
