import { describe, it, expect, afterAll } from 'vitest';
import { pdfdenWord } from '../src/core/pdf-word.js';
import { ocrKapat } from '../src/core/ocr.js';
import { wordTestPdf, ikiSutunPdf, docxOku, pngPikseli } from './yardimci/word-pdf.js';
import { taramaPdf, TARAMA_SATIRLARI, benzerlik } from './yardimci/tarama.js';
import { ornekPdf } from './yardimci/pdf-uret.js';

afterAll(() => ocrKapat());

describe('PDF → Word: metin tabanlı PDF', () => {
  let r, d;
  it('docx üretilir; başlıklar yazı boyutundan, paragraflar satır satır değil bütün olarak aktarılır', async () => {
    const pdf = await wordTestPdf({ sayfa: 3 });
    r = await pdfdenWord(pdf, { dosyaAdi: 'bulten.pdf' });
    d = await docxOku(r.bayt);
    console.log('bilgi:', JSON.stringify(r.bilgi));
    console.log('paragraflar:\n  ' + d.metinler.filter(Boolean).join('\n  '));
    expect(d.xml.startsWith('<?xml')).toBe(true);
    expect((d.xml.match(/<w:p[ >]/g) ?? []).length).toBe((d.xml.match(/<\/w:p>/g) ?? []).length);
    const baslik1 = d.paragraflar.findIndex((p) => /Heading1/.test(p) && /Kardiyoloji Çalışması Raporu/.test(p));
    const baslik2 = d.paragraflar.findIndex((p) => /Heading2/.test(p) && /Bulgular ve Tartışma/.test(p));
    expect(baslik1, 'en büyük yazı → Başlık 1').toBeGreaterThanOrEqual(0);
    expect(baslik2, 'ikinci büyük yazı → Başlık 2').toBeGreaterThan(baslik1);
    // paragraf bir bütün: giriş paragrafının birden çok satırı tek <w:p> içinde
    const giris = d.metinler.find((m) => m.startsWith('Kalp ve damar hastalıkları'));
    expect(giris).toContain('literatürle karşılaştırılmıştır');
    expect(giris).toContain('tablo hâlinde sunulmuştur');
    // Türkçe karakterler
    expect(d.metinler.join(' ')).toContain('ığüşöç karakter denemesi');
  });

  it('satır sonundaki tireli kelime birleşir ve kullanıcıya bildirilir', () => {
    expect(d.metinler.join('\n')).toContain('bölünmüş olup bulgular');
    expect(d.metinler.join('\n')).not.toContain('bölün-');
    expect(r.uyarilar.join(' ')).toContain('tireyle bölünmüş');
  });

  it('sayfadan sayfaya devam eden paragraf tek paragraf olur', () => {
    const p = d.metinler.find((m) => m.startsWith('Sonuç olarak ilk kontrol'));
    expect(p).toContain('bununla birlikte izlem süresinin uzatılması gerekmektedir');
  });

  it('madde işaretleri liste olur (işaret metinden ayıklanır)', () => {
    const maddeler = d.paragraflar.filter((p) => /<w:numPr>/.test(p));
    expect(maddeler.length).toBe(3);
    expect(d.metinler.filter((m) => m.startsWith('İlk madde')).length).toBe(1);
    expect(d.metinler.some((m) => m.startsWith('•'))).toBe(false);
  });

  it('resim aktarılır: PNG olarak, boyutu ve rengi doğru', async () => {
    expect(r.bilgi.resim).toBe(1);
    expect(d.medya.length).toBe(1);
    const png = await d.zip.file(d.medya[0]).async('uint8array');
    const px = pngPikseli(png, 10, 10);
    expect([px.genislik, px.yukseklik]).toEqual([60, 40]);
    expect(Math.abs(px.rgba[0] - 200)).toBeLessThan(3);
    expect(px.rgba[3]).toBe(255);
    expect(d.xml).toContain('<w:drawing>');
  });

  it('basit tablo (hizalı sütunlar) Word tablosu olur: 4 satır × 3 sütun, değerler yerinde', () => {
    expect(r.bilgi.tablo).toBe(1);
    expect((d.xml.match(/<w:tbl>/g) ?? []).length).toBe(1);
    const satirlar = [...d.xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
    expect(satirlar.length).toBe(4);
    const hucreler = satirlar.map((s) => [...s.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => [...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((x) => x[1]).join('')));
    expect(hucreler).toEqual([['Grup', 'Hasta sayısı', 'Ortalama yaş'], ['Kontrol', '120', '54,2'], ['Hasta', '98', '61,7'], ['Toplam', '218', '57,6']]);
  });

  it('tekrarlayan üst bilgi ve sayfa numaraları aktarılmaz (ve bu söylenir)', () => {
    expect(d.metinler.join(' ')).not.toContain('Örnek Kurum Bülteni');
    expect(d.metinler.join(' ')).not.toMatch(/Sayfa \d/);
    expect(r.bilgi.ustAltSilinen).toBeGreaterThanOrEqual(6);
    expect(r.uyarilar.join(' ')).toContain('aktarılmadı');
  });

  it('DÜRÜST uyarı her zaman gösterilir: sonuç birebir aynı olmaz', () => {
    expect(r.uyarilar[0]).toContain('birebir aynısı OLMAZ');
  });

  it('iki sütunlu sayfa: önce sol sütun, sonra sağ sütun; geniş başlık en başta', async () => {
    const pdf = await ikiSutunPdf();
    const s = await pdfdenWord(pdf);
    const m = (await docxOku(s.bayt)).metinler.filter(Boolean);
    const sira = (a) => m.findIndex((x) => x.includes(a));
    expect(sira('İki Sütunlu Makale Başlığı')).toBe(0);
    expect(sira('SOLSUTUN-A')).toBeGreaterThan(0);
    expect(sira('SAGSUTUN-B')).toBeGreaterThan(sira('SOLSUTUN-A'));
    // sol sütunun SON paragrafı, sağ sütunun İLK paragrafından önce gelir
    const sonSol = Math.max(...m.map((x, i) => (x.includes('Kalp ve damar') || x.includes('Çalışmaya alınan') ? i : -1)));
    expect(sira('SAGSUTUN-B')).toBeGreaterThan(sira('SOLSUTUN-A'));
    expect(sonSol).toBeGreaterThan(0);
    expect(s.bilgi.sutunluSayfa).toBe(1);
    expect(s.uyarilar.join(' ')).toContain('iki sütunlu');
  });

  it('sayfa seçimi: yalnızca seçilen sayfa aktarılır', async () => {
    const pdf = await ornekPdf({ sayfa: 3, baslik: 'Bölüm' });
    const s = await pdfdenWord(pdf, { sayfalar: '2' });
    const m = (await docxOku(s.bayt)).metinler.join(' ');
    expect(m).toContain('Bölüm 2 / 3');
    expect(m).not.toContain('Bölüm 1 / 3');
    expect(s.bilgi.sayfa).toBe(1);
  });
});

describe('PDF → Word: taranmış PDF (OCR ile)', () => {
  it('taranmış sayfa OCR ile okunur ve Word paragrafı olarak aktarılır; kullanıcı bilgilendirilir', async () => {
    const { bayt } = await taramaPdf([{ baslik: 'Hasta Epikrizi', satirlar: TARAMA_SATIRLARI }], { dpi: 200, boyut: 12 });
    const r = await pdfdenWord(bayt, { ocrDpi: 300 });
    const d = await docxOku(r.bayt);
    const metin = d.metinler.filter(Boolean);
    console.log('OCR→Word paragraflar:\n  ' + metin.join('\n  '));
    expect(r.bilgi.ocrSayfa).toBe(1);
    expect(d.paragraflar.some((p) => /Heading/.test(p) && /Hasta Epikrizi/.test(p))).toBe(true);
    expect(benzerlik(metin.filter((m) => !m.includes('Epikriz')).join(' '), TARAMA_SATIRLARI.join(' '))).toBeGreaterThan(0.93);
    expect(r.uyarilar.join(' ')).toContain('OCR ile okundu');
  });

  it('OCR kapalıyken taranmış sayfa için anlaşılır hata verir (boş Word üretmez)', async () => {
    const { bayt } = await taramaPdf([TARAMA_SATIRLARI], { dpi: 100 });
    await expect(pdfdenWord(bayt, { ocr: 'yok' })).rejects.toThrow(/aktarılabilir yazı ya da resim bulunamadı/);
  });
});
