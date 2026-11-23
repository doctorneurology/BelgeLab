import { describe, it, expect, afterAll } from 'vitest';
import { PDFDocument, PDFRawStream, StandardFonts, rgb, decodePDFRawStream } from 'pdf-lib';
import { karart, karartmaAra, HAZIR_DESENLER } from '../src/core/karart.js';
import { pdfOcr, ocrKapat } from '../src/core/ocr.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { sayfaPikselleri, metinCikar, karsilastir } from '../tools/karsilastir.mjs';
import { taramaPdf, TARAMA_SATIRLARI } from './yardimci/tarama.js';

afterAll(() => ocrKapat());

const GIZLI = 'GIZLI-12345';

/** PDF dosyasının her yerinde (ham bayt, açılmış akışlar, UTF-16, hex) bir metin geçiyor mu? */
async function dosyadaVarMi(bayt, metin) {
  const aranan = [
    Buffer.from(metin, 'latin1'),
    Buffer.from(metin, 'utf16le').swap16(),
    Buffer.from(Buffer.from(metin, 'latin1').toString('hex'), 'latin1'),
    Buffer.from(Buffer.from(metin, 'latin1').toString('hex').toUpperCase(), 'latin1'),
  ];
  const tara = (b) => aranan.some((a) => Buffer.from(b).includes(a));
  if (tara(bayt)) return 'ham dosya';
  const doc = await PDFDocument.load(bayt, { updateMetadata: false });
  for (const [, nesne] of doc.context.enumerateIndirectObjects()) {
    if (nesne instanceof PDFRawStream) {
      let acik = null;
      try { acik = decodePDFRawStream(nesne).decode(); } catch { /* resim vb. */ }
      if (acik && tara(acik)) return 'açılmış akış';
    }
  }
  return null;
}

/** Standart (gömülmemiş) yazı tipiyle: yazı içerik akışında DÜZ METİN olarak durur. */
async function gizliPdf() {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle(`Rapor ${GIZLI}`); doc.setAuthor('Dr. Gizli Yazar');
  const p1 = doc.addPage([595, 842]);
  const satirlar = [
    [760, 'Hasta: Ali Veli  TC: 12345678901'],
    [730, 'E-posta: ali.veli@ornek.com ve telefon 0532 123 45 67'],
    [700, `Not: ${GIZLI} aciklama burada devam ediyor`],
    [670, 'Bu satir herkese aciktir ve aynen kalmalidir.'],
  ];
  for (const [y, m] of satirlar) p1.drawText(m, { x: 72, y, size: 12, font: f });
  p1.drawRectangle({ x: 72, y: 500, width: 100, height: 40, color: rgb(0.1, 0.5, 0.2) });
  const p2 = doc.addPage([595, 842]);
  p2.drawText('Ikinci sayfa hicbir gizli bilgi icermez.', { x: 72, y: 760, size: 12, font: f });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

const kutuAl = (y, x0 = 66, x1 = 560) => ({ x0, x1, y0: y - 4, y1: y + 12 });

describe('Gerçek karartma (redaksiyon): yazı hem görüntüden hem dosyadan silinir', () => {
  it('KONTROL: özgün dosyada gizli metin düz olarak bulunur (test düzeneği doğru)', async () => {
    const pdf = await gizliPdf();
    expect(await dosyadaVarMi(pdf, GIZLI)).not.toBeNull();
    expect((await metinCikar(pdf))[0]).toContain(GIZLI);
  });

  it('elle seçilen bölge: görüntüde siyah, çıkarılan metinde yok, DOSYANIN HİÇBİR YERİNDE yok (ham bayt / akış / UTF-16 / hex / belge bilgisi)', async () => {
    const pdf = await gizliPdf();
    const r = await karart(pdf, { kutular: [{ sayfa: 1, ...kutuAl(700) }] });
    expect(r.degisti).toBe(true);
    expect(r.rapor.dogrulama.gecti).toBe(true);
    // 1) metin çıkarma
    const metin = (await metinCikar(r.bayt))[0];
    expect(metin).not.toContain(GIZLI);
    expect(metin).not.toContain('aciklama burada');
    // 2) dosyada hiçbir biçimde yok (başlıktaki kopya dahil)
    expect(await dosyadaVarMi(r.bayt, GIZLI)).toBeNull();
    expect(await dosyadaVarMi(r.bayt, 'aciklama burada')).toBeNull();
    expect(await dosyadaVarMi(r.bayt, 'Gizli Yazar')).toBeNull();
    // 3) görüntüde: kutu simsiyah
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    const k = kutuAl(700);
    let siyah = 0, toplam = 0;
    for (let y = Math.floor((842 - k.y1) * 2) + 3; y < Math.floor((842 - k.y0) * 2) - 3; y++) {
      for (let x = Math.floor(k.x0 * 2) + 3; x < Math.floor(k.x1 * 2) - 3; x++) { toplam++; if (px.veri[(y * px.genislik + x) * 4] < 12) siyah++; }
    }
    expect(siyah / toplam).toBeGreaterThan(0.99);
    // 4) Belge bilgileri temizlendi
    const d = await PDFDocument.load(r.bayt, { updateMetadata: false });
    expect(d.getTitle() ?? '').toBe('');
    expect(d.getAuthor() ?? '').toBe('');
  });

  it('karartılmayan yazı yerinde ve görünür kalır; yazı hâlâ aranabilir; dokunulmayan sayfa piksel piksel aynı', async () => {
    const pdf = await gizliPdf();
    const r = await karart(pdf, { kutular: [{ sayfa: 1, ...kutuAl(700) }] });
    expect((await metinCikar(r.bayt))[0]).toContain('Bu satir herkese aciktir ve aynen kalmalidir.');
    expect((await metinCikar(r.bayt))[0]).toContain('Hasta: Ali Veli');
    // görünür satır özgünüyle neredeyse aynı (karartılan 3. satırın dışında)
    const once = await sayfaPikselleri(pdf, 1, { olcek: 2 }), sonra = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    let say = 0, fark = 0;
    for (let y = Math.floor((842 - 680) * 2); y < Math.floor((842 - 662) * 2); y++) for (let x = 0; x < once.genislik; x++) { const i = (y * once.genislik + x) * 4; say++; fark += Math.abs(once.veri[i] - sonra.veri[i]); }
    expect(fark / say).toBeLessThan(1.5);
    // 2. sayfa (karartma yok) birebir
    expect(karsilastir(await sayfaPikselleri(pdf, 2), await sayfaPikselleri(r.bayt, 2)).farkliPiksel).toBe(0);
    expect((await metinCikar(r.bayt))[1]).toContain('Ikinci sayfa');
  });

  it('metin araması: bulunan yerler karartılır (kutu tahmini), doğrulama geçer, eşleşen yazı dosyada kalmaz', async () => {
    const pdf = await gizliPdf();
    const onizleme = await karartmaAra(pdf, [GIZLI, 'ali.veli@ornek.com']);
    expect(onizleme.eslesmeler.length).toBe(2);
    const r = await karart(pdf, { ara: [GIZLI, 'ali.veli@ornek.com'] });
    expect(r.rapor.eslesme).toBe(2);
    expect(r.rapor.dogrulama).toMatchObject({ kalanEslesme: 0, kutuIciYazi: 0, gecti: true });
    expect(await dosyadaVarMi(r.bayt, GIZLI)).toBeNull();
    expect(await dosyadaVarMi(r.bayt, 'ali.veli@ornek.com')).toBeNull();
    // aynı satırdaki başka yazı korunmuş olmalı (Not: ... aciklama): eşleşen PARÇA tümüyle atılır, yani aranabilir katmanda olmaz ama...
    const metin = (await metinCikar(r.bayt))[0];
    expect(metin).toContain('Bu satir herkese aciktir');
    expect(r.uyarilar.join(' ')).toContain('TAHMİN edildi');
    // kutu çevresi: görüntüde GIZLI bölgesi örtülü mü? (satırın başındaki "Not:" okunur kalabilir, GIZLI-12345 kısmı siyah)
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    const mi = onizleme.eslesmeler.find((e) => e.metin.toLowerCase() === GIZLI.toLowerCase());
    let siyah = 0, say = 0;
    for (let y = Math.floor((842 - mi.kutu.y1) * 2) + 2; y < Math.floor((842 - mi.kutu.y0) * 2) - 2; y++) for (let x = Math.floor(mi.kutu.x0 * 2) + 2; x < Math.floor(mi.kutu.x1 * 2) - 2; x++) { say++; if (px.veri[(y * px.genislik + x) * 4] < 12) siyah++; }
    expect(siyah / say).toBeGreaterThan(0.99);
  });

  it('hazır desenler: e-posta, 11 haneli numara, telefon bulunur; metin çıkarmada hiçbiri kalmaz', async () => {
    const pdf = await gizliPdf();
    const desenler = [HAZIR_DESENLER.eposta, HAZIR_DESENLER.tc, HAZIR_DESENLER.telefon];
    const b = await karartmaAra(pdf, desenler);
    const bulunan = b.eslesmeler.map((e) => e.metin);
    expect(bulunan).toContain('ali.veli@ornek.com');
    expect(bulunan).toContain('12345678901');
    expect(bulunan.some((m) => m.replace(/\s/g, '').endsWith('5321234567') || m.replace(/\s/g, '').endsWith('05321234567'))).toBe(true);
    const r = await karart(pdf, { ara: desenler });
    const m = (await metinCikar(r.bayt))[0];
    expect(m).not.toContain('12345678901');
    expect(m).not.toContain('ali.veli');
    expect(r.rapor.dogrulama.gecti).toBe(true);
  });

  it('Türkçe aramada büyük/küçük ve i/İ/ı ayrımı yapılmaz; gömülü yazı tipli PDF\'te de çalışır', async () => {
    const doc = await PDFDocument.create();
    const f = await yaziTipiGom(doc, 'liberation-sans');
    doc.addPage([595, 842]).drawText('Hasta Işıl ŞAHİN İstanbul\'da yaşıyor. ĞÜŞİÖÇ', { x: 72, y: 700, size: 12, font: f });
    const pdf = new Uint8Array(await doc.save());
    const b = await karartmaAra(pdf, ['işıl şahin']);
    expect(b.eslesmeler.length).toBe(1);
    const r = await karart(pdf, { ara: ['işıl şahin'] });
    expect((await metinCikar(r.bayt))[0]).not.toMatch(/ışıl|şahin/i);
  });

  it('bulunamayan metin: hiçbir şey değişmez, kullanıcı bilgilendirilir', async () => {
    const pdf = await gizliPdf();
    const r = await karart(pdf, { ara: ['YOKBOYLEBIRSEY'] });
    expect(r.degisti).toBe(false);
    expect(r.bayt).toBe(pdf);
    expect(r.uyarilar[0]).toContain('bulunamadı');
  });

  it('TARANMIŞ belge: OCR ile arama; karartılan bölgede resim pikselleri siyah, yazı katmanında yok', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 200, boyut: 14 });
    const b = await karartmaAra(bayt, ['sol tarafında'], { ocr: true });
    expect(b.eslesmeler.length).toBe(2); // iki kelime = iki kutu (sol, tarafında)
    expect(b.ocrSayfa).toBe(1);
    const r = await karart(bayt, { ara: ['sol tarafında'], ocr: true, dpi: 200 });
    expect(r.rapor.dogrulama.gecti).toBe(true);
    const px = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    for (const e of b.eslesmeler) {
      const k = e.kutu;
      let siyah = 0, say = 0;
      for (let y = Math.floor((842 - k.y1) * 2) + 3; y < Math.floor((842 - k.y0) * 2) - 3; y++) for (let x = Math.floor(k.x0 * 2) + 3; x < Math.floor(k.x1 * 2) - 3; x++) { say++; if (px.veri[(y * px.genislik + x) * 4] < 20) siyah++; }
      expect(siyah / say, e.metin).toBeGreaterThan(0.98);
    }
    // OCR ile yeniden okuyunca karartılan kelimeler okunmaz
    const yeniOcr = await pdfOcr(r.bayt, { dpi: 300, yaziVarsa: 'yine' });
    const yazi = (await metinCikar(yeniOcr.bayt)).join(' ');
    expect(yazi).not.toContain('sol tarafında');
    expect(yazi).toContain('Öğleden');
  });

  it('geçersiz girdiler anlaşılır hata verir', async () => {
    const pdf = await gizliPdf();
    await expect(karart(pdf, { kutular: [{ sayfa: 7, x0: 0, y0: 0, x1: 10, y1: 10 }] })).rejects.toThrow(/Sayfa 7 yok/);
    await expect(karart(pdf, { kutular: [{ sayfa: 1, x0: 5, y0: 5, x1: 5.2, y1: 5.2 }] })).rejects.toThrow(/çok küçük/);
    await expect(karart(pdf, { renk: '#ff0000', ara: ['x'] })).rejects.toThrow(/siyah ya da beyaz/);
    await expect(karartmaAra(pdf, [''])).rejects.toThrow(/Aranacak bir metin/);
  });
});
