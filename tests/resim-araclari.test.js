import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { resimIsle } from '../src/core/resim-araclari.js';
import { resimTuru } from '../src/core/resim-pdf.js';
import { resimCoz } from '../src/core/render.js';

// Gürültülü, boyutu ancak kalite düşürülünce küçülen bir test resmi
async function fotograf(w = 800, h = 600, bicim = 'png') {
  const c = createCanvas(w, h); const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1e5aa8'); gr.addColorStop(1, '#e8a33d'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255},0.5)`; g.fillRect((i * 97) % w, (i * 61) % h, 14, 14); }
  return new Uint8Array(await c.encode(bicim === 'jpeg' ? 'jpeg' : 'png', 90));
}

describe('resim araçları', () => {
  it('oranı koruyarak boyutlandırır (genişlik, yüzde)', async () => {
    const b = await fotograf();
    const a = await resimIsle(b, 'foto.png', { genislik: 400 });
    expect([a.genislik, a.yukseklik]).toEqual([400, 300]);
    expect(a.ad).toBe('foto-400x300.png');
    const y = await resimIsle(b, 'foto.png', { yuzde: 25 });
    expect([y.genislik, y.yukseklik]).toEqual([200, 150]);
    const r = await resimCoz(y.bayt);
    expect([r.genislik, r.yukseklik]).toEqual([200, 150]);
    const buyut = await resimIsle(b, 'foto.png', { yuzde: 150 });
    expect(buyut.uyarilar.join(' ')).toMatch(/büyütüldü/);
  });

  it('biçim dönüştürür: PNG → JPEG / WebP, geri PNG', async () => {
    const b = await fotograf();
    const j = await resimIsle(b, 'foto.png', { bicim: 'jpeg', kalite: 0.8 });
    expect(resimTuru(j.bayt)).toBe('jpeg'); expect(j.ad).toBe('foto.jpg');
    const w = await resimIsle(b, 'foto.png', { bicim: 'webp', kalite: 0.8 });
    expect(new TextDecoder('latin1').decode(w.bayt.subarray(8, 12))).toBe('WEBP'); expect(w.ad).toBe('foto.webp');
    const p = await resimIsle(j.bayt, 'foto.jpg', { bicim: 'png' });
    expect(resimTuru(p.bayt)).toBe('png');
    expect(p.uyarilar.join(' ')).toMatch(/dosya genellikle büyür/);
  });

  it('sıkıştırır: kalite düşünce küçülür; hedef KB’ye iner', async () => {
    const b = await fotograf(1200, 900, 'jpeg');
    const yuksek = await resimIsle(b, 'f.jpg', { bicim: 'jpeg', kalite: 0.95 });
    const dusuk = await resimIsle(b, 'f.jpg', { bicim: 'jpeg', kalite: 0.3 });
    expect(dusuk.bayt.length).toBeLessThan(yuksek.bayt.length);
    const hedef = Math.round(yuksek.bayt.length / 1024 / 4);
    const h = await resimIsle(b, 'f.jpg', { bicim: 'jpeg', kalite: 0.95, hedefKB: hedef });
    expect(h.bayt.length).toBeLessThanOrEqual(hedef * 1024);
    expect(h.bayt.length).toBeGreaterThan(hedef * 1024 * 0.4); // gereğinden fazla bozmaz
  });

  it('PNG için hedef KB uyarı verir; saydam PNG → JPEG zemin rengiyle dolar; geçersiz dosya hata', async () => {
    const c = createCanvas(40, 40); const png = new Uint8Array(await c.encode('png')); // tamamen saydam
    const j = await resimIsle(png, 's.png', { bicim: 'jpeg', arkaPlan: '#ff0000' });
    const k = await resimCoz(j.bayt); const t = createCanvas(40, 40); t.getContext('2d').drawImage(k.cizilebilir, 0, 0);
    const px = t.getContext('2d').getImageData(20, 20, 1, 1).data;
    expect(px[0]).toBeGreaterThan(220); expect(px[1]).toBeLessThan(40);
    expect((await resimIsle(await fotograf(), 'f.png', { bicim: 'png', hedefKB: 5 })).uyarilar.join(' ')).toMatch(/kayıpsız/);
    await expect(resimIsle(new Uint8Array([1, 2, 3, 4]), 'x.bin')).rejects.toThrow(/resim/);
  });
});
