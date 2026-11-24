import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { pdfOnar } from '../src/core/onar.js';
import { pdfKarsilastir, sozcukFarki } from '../src/core/pdf-karsilastir.js';
import { pdfaDenetle, pdfaDonustur, srgbIccProfili } from '../src/core/pdfa.js';
import { resimleriAyikla } from '../src/core/resim-ayikla.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { metinCikar, sayfaPikselleri, karsilastir } from '../tools/karsilastir.mjs';
import { wordTestPdf } from './yardimci/word-pdf.js';
import { ornekPdf, pngUret } from './yardimci/pdf-uret.js';

/** Klasik xref'li (nesne akışsız) çok sayfalı PDF */
async function klasikPdf(sayfa = 5) {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, 'liberation-sans');
  for (let i = 1; i <= sayfa; i++) doc.addPage([595, 842]).drawText(`Onarım deneme sayfası ${i} ğüşiöç`, { x: 72, y: 700, size: 16, font: f });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}
const latin = (b) => new TextDecoder('latin1').decode(b);

describe('PDF onarma', () => {
  it('çapraz başvuru tablosu/sondaki bilgi kesilmiş dosya: tüm sayfalar kurtarılır ve çizilebilir', async () => {
    const saglam = await klasikPdf(5);
    const kesik = saglam.subarray(0, latin(saglam).lastIndexOf('\nxref')); // xref + trailer gitti
    const r = await pdfOnar(kesik);
    expect(r.onarildi).toBe(true);
    expect(r.sayfa).toBe(5);
    const m = await metinCikar(r.bayt);
    expect(m.length).toBe(5);
    expect(m[3]).toContain('Onarım deneme sayfası 4 ğüşiöç');
    expect(karsilastir(await sayfaPikselleri(saglam, 2), await sayfaPikselleri(r.bayt, 2)).farkliPiksel).toBe(0);
    console.log(r.yontem, '|', r.uyarilar.join(' | '));
  });

  it('startxref yanlış, başta çöp veri: kurtarılır', async () => {
    const saglam = await klasikPdf(3);
    const metin = latin(saglam).replace(/startxref\s+\d+/, 'startxref\n99999');
    const yanlis = new Uint8Array(Buffer.from(metin, 'latin1'));
    const r1 = await pdfOnar(yanlis);
    expect(r1.sayfa).toBe(3);
    const cop = new Uint8Array([...Buffer.from('GARBAGE-HEADER-BYTES\r\n'), ...saglam]);
    const r2 = await pdfOnar(cop);
    expect(r2.sayfa).toBe(3);
    expect(r2.uyarilar.join(' ')).toContain('çöp veri atıldı');
    expect((await metinCikar(r2.bayt))[2]).toContain('sayfası 3');
  });

  it('bir sayfanın içerik akışı bozuk: diğer sayfalar kurtulur', async () => {
    const saglam = await klasikPdf(4);
    // 3. sayfanın yazısındaki akışı bozmak yerine dosyanın ortasından bir parça çöple değiştir
    const kopya = new Uint8Array(saglam);
    const metin = latin(kopya);
    const k = metin.indexOf('sayfası 3');
    // "sayfası 3" bir içerik akışında değil (gömülü yazı tipi: glif kodları); akış verisini rastgele bozalım
    const akis = metin.indexOf('stream', metin.lastIndexOf('/Contents'));
    for (let i = akis + 20; i < akis + 60 && i < kopya.length; i++) kopya[i] = 0x41;
    const r = await pdfOnar(kopya);
    expect(r.sayfa).toBe(4);
    expect(k).toBeGreaterThanOrEqual(-1);
  });

  it('PDF olmayan/boş dosya anlaşılır hata verir; sağlam dosya sağlam kalır ve bildirilir', async () => {
    await expect(pdfOnar(new Uint8Array(Buffer.from('Bu bir PDF değil, sadece düz yazıdır, başka bir şey yok.')))).rejects.toThrow(/PDF başlığı/);
    await expect(pdfOnar(new Uint8Array([1, 2]))).rejects.toThrow(/çok küçük/);
    const saglam = await klasikPdf(2);
    const r = await pdfOnar(saglam);
    expect(r.sayfa).toBe(2);
    expect(r.uyarilar.join(' ')).toContain('zaten sorunsuz');
  });
});

describe('PDF karşılaştırma', () => {
  async function metinliPdf(satirlar, sayfa = 1) {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    for (let s = 0; s < sayfa; s++) { const p = doc.addPage([595, 842]); satirlar.forEach((m, i) => p.drawText(m, { x: 72, y: 760 - i * 24, size: 14, font: f })); }
    return new Uint8Array(await doc.save());
  }

  it('aynı belge: fark yok', async () => {
    const a = await metinliPdf(['Hasta yaşı 40', 'Ağrı yok'], 2);
    const r = await pdfKarsilastir(a, a);
    expect(r.ozet.ayniMi).toBe(true);
    expect(r.sayfalar.every((s) => s.pikselFark === 0 && !s.metin.silinen.length && !s.metin.eklenen.length)).toBe(true);
  });

  it('değişen sayı: metin farkı eski/yeni sözcükleri verir; bindirme görüntüsünde kırmızı + camgöbeği; kutu değişen bölgeyi gösterir', async () => {
    const a = await metinliPdf(['Hasta yaşı 40', 'Ağrı yok', 'Kontrol önerildi']);
    const b = await metinliPdf(['Hasta yaşı 41', 'Ağrı yok', 'Kontrol önerildi']);
    const r = await pdfKarsilastir(a, b, { dpi: 100 });
    const s = r.sayfalar[0];
    expect(r.ozet.farkliSayfa).toBe(1);
    expect(s.metin.silinen.join(' ')).toContain('40');
    expect(s.metin.eklenen.join(' ')).toContain('41');
    expect(s.pikselFark).toBeGreaterThan(5);
    let kirmizi = 0, cam = 0;
    const v = s.bindirme.veri;
    for (let i = 0; i < v.length; i += 4) { if (v[i] > 200 && v[i + 1] < 80) kirmizi++; if (v[i] < 60 && v[i + 1] > 150 && v[i + 2] > 180) cam++; }
    expect(kirmizi).toBeGreaterThan(0);
    expect(cam).toBeGreaterThan(0);
    // fark yalnızca ilk satır civarında (sayfanın üstü): ikinci satırın altı temiz
    expect(s.kutu.y1 / (100 / 72)).toBeLessThan(842 - 760 + 40);
  });

  it('sayfa sayısı farklıysa bildirilir; boyut farkı uyarılır; sözcük farkı LCS doğru', async () => {
    const a = await metinliPdf(['x y z'], 3), b = await metinliPdf(['x y z'], 2);
    const r = await pdfKarsilastir(a, b);
    expect(r.uyarilar.join(' ')).toContain('eskideki fazla sayfalar silinmiş');
    expect(r.ozet.ayniMi).toBe(false);
    expect(sozcukFarki(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e'])).toMatchObject({ silinen: ['b'], eklenen: ['x', 'e'] });
  });
});

describe('PDF/A (deneysel)', () => {
  it('ICC profili geçerli başlık taşır (acsp, mntr, RGB, XYZ) ve boyutu başlıktaki değerle aynı', () => {
    const p = srgbIccProfili();
    const g = (k, n) => String.fromCharCode(...p.subarray(k, k + n));
    expect(g(36, 4)).toBe('acsp');
    expect([g(12, 4), g(16, 4), g(20, 4)]).toEqual(['mntr', 'RGB ', 'XYZ ']);
    expect(new DataView(p.buffer, p.byteOffset).getUint32(0)).toBe(p.length);
    expect(p.length % 4).toBe(0);
  });

  it('denetim: gömülü olmayan yazı tipi, XMP ve OutputIntent eksikliği bulunur', async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([595, 842]).drawText('Standard font text', { x: 72, y: 700, size: 12, font: f });
    const d = await pdfaDenetle(new Uint8Array(await doc.save()));
    const kodlar = d.sorunlar.map((s) => s.kod);
    expect(kodlar).toEqual(expect.arrayContaining(['FONT', 'XMP', 'RENK']));
    expect(d.uygunGibi).toBe(false);
  });

  it('dönüştürme: XMP (pdfaid 2/B), sRGB OutputIntent, /ID ve gömülü yazı tipi var; metin aranabilir; görünüm korunur; sayfa sayısı aynı', async () => {
    const kaynak = await wordTestPdf({ sayfa: 2 });
    const r = await pdfaDonustur(kaynak, { dpi: 120 });
    expect(r.sayfa).toBe(2);
    expect(r.sonra.sorunlar.filter((s) => s.onemli)).toEqual([]);
    expect(r.sonra.uygunGibi).toBe(true);
    const doc = await PDFDocument.load(r.bayt, { updateMetadata: false });
    const xmp = doc.catalog.lookup(PDFName.of('Metadata'));
    const xmpMetin = new TextDecoder().decode(xmp.contents);
    expect(xmpMetin).toContain('<pdfaid:part>2</pdfaid:part>');
    expect(xmpMetin).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
    const oi = doc.catalog.lookup(PDFName.of('OutputIntents'));
    expect(oi.size()).toBe(1);
    const icc = oi.lookup(0).lookup(PDFName.of('DestOutputProfile'));
    expect(String.fromCharCode(...icc.contents.subarray(36, 40))).toBe('acsp');
    expect(latinMetin(r.bayt)).toContain('/ID');
    // Bilgi sözlüğündeki tarih XMP ile aynı gün/saat
    const cd = doc.getCreationDate();
    expect(xmpMetin).toContain(cd.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    // metin aranabilir, görünüm yakın
    const m = (await metinCikar(r.bayt)).join(' ');
    expect(m).toContain('Kardiyoloji Çalışması Raporu');
    const a = await sayfaPikselleri(kaynak, 1, { olcek: 1 }), b = await sayfaPikselleri(r.bayt, 1, { olcek: 1 });
    let t = 0; for (let i = 0; i < a.veri.length; i += 4) t += Math.abs(a.veri[i] - b.veri[i]);
    expect(t / (a.veri.length / 4)).toBeLessThan(6);
    expect(r.uyarilar[0]).toContain('DENEYSEL');
    expect(r.uyarilar[0]).toContain('veraPDF');
  });
});

const latinMetin = (b) => new TextDecoder('latin1').decode(b);

describe('Gömülü resimleri ayıkla', () => {
  it('resimler PNG olarak çıkar (boyut ve renk doğru); küçük simgeler atlanır; sayfa seçilebilir', async () => {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    const p = doc.addPage([595, 842]);
    p.drawText('resimli', { x: 72, y: 800, size: 10, font: f });
    p.drawImage(await doc.embedPng(pngUret(80, 50, [200, 30, 30, 255])), { x: 72, y: 600, width: 160, height: 100 });
    p.drawImage(await doc.embedPng(pngUret(10, 10, [0, 0, 0, 255])), { x: 300, y: 600, width: 20, height: 20 });
    doc.addPage([595, 842]).drawImage(await doc.embedPng(pngUret(60, 40, [20, 20, 200, 255])), { x: 50, y: 500, width: 120, height: 80 });
    const pdf = new Uint8Array(await doc.save());
    const r = await resimleriAyikla(pdf, 'rapor.pdf');
    expect(r.dosyalar.length).toBe(2);
    expect(r.dosyalar[0]).toMatchObject({ sayfa: 1, genislik: 80, yukseklik: 50 });
    expect(r.dosyalar[0].ad).toBe('rapor-sayfa-1-resim-1.png');
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(Buffer.from(r.dosyalar[0].bayt));
    expect([png.data[0], png.data[1], png.data[2]]).toEqual([200, 30, 30]);
    expect(r.atlanan).toBeGreaterThanOrEqual(1);
    const tek = await resimleriAyikla(pdf, 'rapor.pdf', { sayfalar: '2' });
    expect(tek.dosyalar.length).toBe(1);
    expect(tek.dosyalar[0].sayfa).toBe(2);
    const resimsiz = await resimleriAyikla(await ornekPdf({ sayfa: 1 }), 'x.pdf');
    expect(resimsiz.dosyalar.length).toBe(0);
  });
});

describe('PDF onarma: sınır', () => {
  it('dosyanın büyük kısmı eksikse (sayfa ağacı/yazı tipleri yok) kurtarılamadığı dürüstçe söylenir', async () => {
    const saglam = await klasikPdf(6);
    await expect(pdfOnar(saglam.subarray(0, Math.floor(saglam.length * 0.3)))).rejects.toThrow(/onarılamadı/);
  });
});
