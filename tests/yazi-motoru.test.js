import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { yaziAnalizEt, yaziDuzelt, yazilariKaldir } from '../src/core/yazi/motor.js';
import { dogrula, pdfjsSatirlari } from '../src/core/yazi/dogrulama.js';
import { akisCoz } from '../src/core/yazi/akis.js';
import { cmapCoz, glifAdiUnicode } from '../src/core/yazi/font.js';
import { SINIR } from '../src/core/yazi/analiz.js';
import { belgeAc } from '../src/core/render.js';
import { metinCikar, sayfaPikselleri, karsilastir } from '../tools/karsilastir.mjs';
import { kurumsalPdf, tekSatirPdf, KENAR } from './yardimci/yazi-pdf.js';

let pdf, analiz;
const bul = (s, f) => analiz.sayfalar[s - 1].satirlar.find((l) => f(l.metin));

/** Dosyadaki tüm akışları açıp (sıkıştırmayı çözüp) metin olarak birleştirir. */
async function tumAkislar(bayt) {
  const d = await PDFDocument.load(bayt);
  let s = '';
  for (const [, o] of d.context.enumerateIndirectObjects()) {
    if (o instanceof PDFRawStream) { try { s += new TextDecoder('latin1').decode(decodePDFRawStream(o).decode()); } catch { /* resim */ } }
  }
  return s;
}

beforeAll(async () => {
  pdf = await kurumsalPdf();
  analiz = await yaziAnalizEt(pdf);
});

describe('Yazı motoru — akış okuyucu ve yazı tipi çözücü', () => {
  it('içerik akışını işleçlere ayırır (dizi, sözlük, hex, kaçışlı yazı, satır içi resim)', () => {
    const b = new TextEncoder().encode('q 1 0 0 1 5 5 cm BT /F1 12 Tf (a\\(b\\)c\\101) Tj [<0041> -20 (x)] TJ ET /P <</MCID 3>> BDC EMC BI /W 1 /H 1 ID \x00\xff EI Q');
    const ops = akisCoz(b);
    expect(ops.map((o) => o.op)).toEqual(['q', 'cm', 'BT', 'Tf', 'Tj', 'TJ', 'ET', 'BDC', 'EMC', 'BI', 'Q']);
    expect(new TextDecoder().decode(ops[4].args[0].v)).toBe('a(b)cA');
    expect(ops[5].args[0].v.map((x) => x.t)).toEqual(['yazi', 'sayi', 'yazi']);
  });

  it('ToUnicode CMap (bfchar/bfrange) ve glif adlarını Türkçe karakterlere çözer', () => {
    const c = cmapCoz('begincodespacerange <0000> <FFFF> endcodespacerange 2 beginbfchar <0003> <0020> <0011> <011F> endbfchar 1 beginbfrange <0020> <0022> <0130> endbfrange');
    expect(c.harita.get('2:17')).toBe('ğ');
    expect(c.harita.get('2:33')).toBe('ı');
    expect(['scedilla', 'Idotaccent', 'uni015E', 'f_i'].map(glifAdiUnicode)).toEqual(['ş', 'İ', 'Ş', 'fi']);
  });
});

describe('Aşama 1 — Analiz', () => {
  it('satırların konumu, boyutu, rengi ve yazı tipi eşlemesi doğru', () => {
    const konu = bul(1, (m) => m.startsWith('Konu'));
    expect(konu.metin).toBe('Konu: Deneme yazısı birinci');
    expect(konu.x0).toBeCloseTo(72, 2);
    expect(konu.y).toBeCloseTo(650, 2);
    expect(konu.boyut).toBeCloseTo(12, 3);
    const tarih = bul(1, (m) => m.startsWith('Tarih'));
    expect(tarih.renk).toBe('#990000');
    expect(tarih.x1).toBeCloseTo(KENAR.sag, 1);
    const esle = (bas) => analiz.yaziTipleri.find((f) => f.ad.startsWith(bas)).secili;
    expect(esle('LiberationSerif-Bold')).toMatchObject({ aile: 'liberation-serif', kalin: true, tanindi: 'olcu' });
    expect(esle('Helvetica')).toMatchObject({ aile: 'liberation-sans', kalin: false, tanindi: 'olcu' });
  });

  it('hizalama: sola, ortalı, sağa ve iki yana yaslı satırları ayırt eder', () => {
    expect(bul(1, (m) => m.startsWith('Konu')).hizalama).toBe('sol');
    expect(bul(1, (m) => m.startsWith('Ortalanmış')).hizalama).toBe('orta');
    expect(bul(1, (m) => m.startsWith('Tarih')).hizalama).toBe('sag');
    expect(bul(1, (m) => m.startsWith('Bu satır iki yana')).hizalama).toBe('iki-yana');
    expect(bul(1, (m) => m.startsWith('son satır')).hizalama).toBe('sol');
  });

  it('üst/alt bilgi (form nesnesi içindeki başlık dahil), logo yazısı ve döndürülmüş yazı korumalı', () => {
    for (let s = 1; s <= 3; s++) {
      expect(bul(s, (m) => m.startsWith('ÖRNEK KURUM')).koruma, `başlık s${s}`).toBe('ustalt');
      expect(bul(s, (m) => m.startsWith('Sayfa ')).koruma, `sayfa no s${s}`).toBe('ustalt');
      expect(bul(s, (m) => m.includes('DÖNDÜRÜLMÜŞ')).koruma).toBe('donuk');
      expect(bul(s, (m) => m.startsWith('Konu')).koruma).toBeNull();
    }
    expect(bul(1, (m) => m === 'LOGO').koruma).toBe('logo');
  });

  it('metin tabanlı belgede tüm yazı çözülür: pdf.js metniyle aynı', async () => {
    const pj = await metinCikar(pdf);
    for (const s of analiz.sayfalar) {
      const biz = s.satirlar.map((l) => l.metin).join('').replace(/\s+/g, '');
      expect(biz.length).toBe(pj[s.no - 1].replace(/\s+/g, '').length);
    }
  });
});

describe('Aşama 2 — Yazı kaldırma', () => {
  it('tüm yazı gider; resim, çizgi, kutu ve bağlantı (açıklama) kalır; eski yazı dosyada okunamaz', async () => {
    const bos = await yazilariKaldir(pdf);
    expect((await metinCikar(bos)).join('').trim()).toBe('');
    const d = await PDFDocument.load(bos);
    expect(d.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray).size()).toBe(1);
    // Görüntüde: yazısız sayfa hâlâ logo/kutu/çizgi içerir
    const c = await sayfaPikselleri(bos, 1);
    const kirmizi = (x, y) => c.veri[(y * c.genislik + x) * 4] > 150 && c.veri[(y * c.genislik + x) * 4 + 1] < 80;
    expect(kirmizi(100, Math.round(841.89 - 700))).toBe(true);
    // Eski yazı komutları (kodlanmış hâlleri de) hiçbir akışta yok: yalnızca TJ ilerletme komutları kalır
    const akislar = await tumAkislar(bos);
    expect(akislar).not.toMatch(/<[0-9A-Fa-f]{4,}>\s*Tj/);
  });
});

describe('Aşama 3 + 5 — Yeniden yazma ve doğrulama', () => {
  it('değişiklik yoksa: (a) yazısız karşılaştırma SIFIR fark, (b) satır sapması sınırın altında, metin aynı', async () => {
    const r = await yaziDuzelt(pdf);
    const v = await dogrula(pdf, r.bayt, { sayfalar: [1, 2, 3] });
    for (const s of v.sayfalar) {
      expect(s.pikselFark, `sayfa ${s.no} piksel`).toBe(0);
      expect(s.sapma.enBuyuk, `sayfa ${s.no} sapma`).toBeLessThanOrEqual(SINIR.konum);
      expect(s.sapma.eslesmeyen).toBe(0);
    }
    expect(v.gecti).toBe(true);
    expect((await metinCikar(r.bayt)).map((x) => x.replace(/\s+/g, ''))).toEqual((await metinCikar(pdf)).map((x) => x.replace(/\s+/g, '')));
    // yazılar gerçekten yeni yazı tipleriyle yazıldı
    const d = await PDFDocument.load(r.bayt);
    const fontlar = d.getPage(0).node.Resources().lookup(PDFName.of('Font'), PDFDict);
    expect(fontlar.keys().map((k) => k.decodeText()).some((k) => k.startsWith('PAY'))).toBe(true);
    expect(r.rapor.map((x) => x.ozet)).toEqual(['Sayfa 1 temiz', 'Sayfa 2 temiz', 'Sayfa 3 temiz']);
  });

  it('başka sayfalara dokunulmaz; paylaşılan başlık nesnesi kilidi açılıp yalnızca 2. sayfada düzeltilebilir', async () => {
    const a2 = bul(2, (m) => m.startsWith('ÖRNEK KURUM'));
    const r = await yaziDuzelt(pdf, { degisiklikler: { [a2.id]: { metin: 'ÖRNEK KURUM — Bilgi İşlem Dairesi' } }, kilitAcik: [a2.id] });
    const m = await metinCikar(r.bayt);
    expect(m[1]).toContain('Bilgi İşlem Dairesi');
    expect(m[0]).toContain('Bilgi İşlem Daire Başkanlığı');
    expect(m[2]).toContain('Bilgi İşlem Daire Başkanlığı');
    const v = await dogrula(pdf, r.bayt, { sayfalar: [1, 2, 3] });
    expect(v.sayfalar.map((s) => s.pikselFark)).toEqual([0, 0, 0]);
  });

  it('kilitli üst bilgi değiştirilmek istenirse değiştirilmez ve uyarılır', async () => {
    const a1 = bul(1, (m) => m.startsWith('ÖRNEK KURUM'));
    const r = await yaziDuzelt(pdf, { degisiklikler: { [a1.id]: { metin: 'DEĞİŞTİ' } } });
    expect((await metinCikar(r.bayt))[0]).not.toContain('DEĞİŞTİ');
    expect(r.rapor[0].kontrol.find((k) => k.satirId === a1.id).nedenler[0]).toMatch(/kilitli/);
  });

  it('düzeltme: eski yazı dosyadan tamamen silinir, yeni yazı aynı yerde; hizalama korunur', async () => {
    const konu = bul(1, (m) => m.startsWith('Konu'));
    const tarih = bul(1, (m) => m.startsWith('Tarih'));
    const orta = bul(1, (m) => m.startsWith('Ortalanmış'));
    const yasli = bul(1, (m) => m.startsWith('Bu satır iki yana'));
    const r = await yaziDuzelt(pdf, {
      degisiklikler: {
        [konu.id]: { metin: 'Konu: Düzeltilmiş ve biraz daha uzatılmış deneme yazısı 1' },
        [tarih.id]: { metin: 'Tarih: 1.12.2026' },
        [orta.id]: { metin: 'Kısa başlık' },
        [yasli.id]: { metin: 'Bu satır iki yana yaslı paragrafın ilk satırıdır ve sağ kenara kadar gider ikinci' },
      },
    });
    expect(r.rapor[0].duzenlenen).toBe(4);
    expect(r.rapor[0].kontrol, 'uzayan sola dayalı satır sayfa kenarına kadar sığar').toHaveLength(0);
    const satirlar = await pdfjsSatirlari(await belgeAc(r.bayt), 1);
    const s = (bas) => satirlar.find((l) => l.anahtar.startsWith(bas.replace(/\s+/g, '')));
    expect(s('Konu: Düzeltilmiş').x0).toBeCloseTo(konu.x0, 1);
    expect(s('Konu: Düzeltilmiş').y).toBeCloseTo(konu.y, 1);
    expect(s('Tarih: 1.12.2026').x1).toBeCloseTo(tarih.x1, 0);
    const k = s('Kısa başlık');
    expect((k.x0 + k.x1) / 2).toBeCloseTo((orta.x0 + orta.x1) / 2, 0);
    const y = s('Bu satır iki yana');
    expect(y.x0).toBeCloseTo(yasli.x0, 1);
    expect(y.x1).toBeCloseTo(yasli.x1, 0);
    // Eski yazının kodlanmış hâli dosyada kalmamalı: yeniden analizde eski metin yok
    const yeni = await yaziAnalizEt(r.bayt);
    const tum = yeni.sayfalar[0].satirlar.map((l) => l.metin).join('\n');
    expect(tum).not.toContain('Deneme yazısı birinci');
    expect(tum).not.toContain('23.11.2026');
    // (a) yine sıfır fark
    const v = await dogrula(pdf, r.bayt, { sayfalar: [1] });
    expect(v.sayfalar[0].pikselFark).toBe(0);
  });

  it('yazı tipi / boyut / renk seçimi uygulanır', async () => {
    const konu = bul(1, (m) => m.startsWith('Konu'));
    const r = await yaziDuzelt(pdf, { degisiklikler: { [konu.id]: { aile: 'carlito', boyut: 14, renk: '#0000ff', kalin: true } } });
    const a = await yaziAnalizEt(r.bayt, { sayfalar: [0] });
    const l = a.sayfalar[0].satirlar.find((x) => x.metin.startsWith('Konu'));
    expect(l.boyut).toBeCloseTo(14, 2);
    expect(l.renk).toBe('#0000ff');
    expect(a.yaziTipleri.find((f) => f.anahtar === l.yaziTipi).ad).toMatch(/Carlito-Bold/);
    // Sonraki satırın rengi bozulmadı (renk geri yüklendi)
    expect(a.sayfalar[0].satirlar.find((x) => x.metin.startsWith('Ortalanmış')).renk).toBe('#000000');
  });

  it('sığmayan yazı ve yazı tipinde olmayan karakter için uyarı verir', async () => {
    const tarih = bul(1, (m) => m.startsWith('Tarih'));
    const konu = bul(1, (m) => m.startsWith('Konu'));
    const uzun = 'Konu: ' + 'çok uzun bir metin '.repeat(12);
    const r = await yaziDuzelt(pdf, { degisiklikler: { [konu.id]: { metin: uzun }, [tarih.id]: { metin: 'Tarih: 😀' } } });
    const k = r.rapor[0].kontrol;
    expect(k.find((x) => x.satirId === konu.id).nedenler.join()).toMatch(/sığmıyor/);
    expect(k.find((x) => x.satirId === tarih.id).nedenler.join()).toMatch(/karakter/);
    expect((await metinCikar(r.bayt))[0]).toContain('Tarih (birinci): 23.11.2026');
    expect(r.rapor[0].ozet).toBe('Sayfa 1: 2 satır kontrol gerekli');
  });

  it('genişliği %3ten fazla farklı yazı tipiyle sığmayan satır orijinal bırakılır ve işaretlenir', async () => {
    const tek = await tekSatirPdf('liberation-mono', 'Eşit aralıklı yazı');
    const a = await yaziAnalizEt(tek);
    const f = a.yaziTipleri[0].anahtar;
    const r = await yaziDuzelt(tek, { esleme: { [f]: { aile: 'liberation-sans', kalin: false, italik: false } } });
    expect(r.rapor[0].kontrol).toHaveLength(1);
    expect(r.rapor[0].kontrol[0].nedenler[0]).toMatch(/genişlik farkı/);
    const fark = karsilastir(await sayfaPikselleri(tek, 1), await sayfaPikselleri(r.bayt, 1));
    expect(fark.farkliPiksel).toBe(0); // satır olduğu gibi kaldı
  });
});

describe('Aşama 6 — İmzalı PDF', () => {
  it('dijital imza algılanır, uyarı verilir, çıktı imzasızdır; imza alanının görünümü kalır', async () => {
    const imzali = await kurumsalPdf({ imzali: true });
    const a = await yaziAnalizEt(imzali);
    expect(a.imzali).toBe(true);
    const r = await yaziDuzelt(imzali);
    expect(r.uyarilar.join(' ')).toMatch(/imza/i);
    expect(r.imzaKaldirilan).toBe(1);
    const d = await PDFDocument.load(r.bayt);
    const acro = d.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    const alan = acro.lookup(PDFName.of('Fields'), PDFArray).lookup(0, PDFDict);
    expect(alan.has(PDFName.of('V'))).toBe(false);
    expect(acro.has(PDFName.of('SigFlags'))).toBe(false);
    expect(new TextDecoder('latin1').decode(r.bayt)).not.toContain('GIZLI-IMZA-VERISI');
    const v = await dogrula(imzali, r.bayt, { sayfalar: [1] });
    expect(v.sayfalar[0].pikselFark).toBe(0);
  });
});
