// PDF → Excel (.xlsx). PDF'teki tabloları yazıların hizasından tahmin ederek sayfalara/sütunlara döker.
// DÜRÜSTLÜK: PDF'te gerçek "tablo" nesnesi yoktur; hizalı sütunlar tahmin edilir. Çizgili ama hizasız, birleştirilmiş hücreli
// ya da iç içe tablolar doğru çıkmayabilir. SAYFA ya da DOSYA SINIRI YOKTUR.

import * as XLSX from 'xlsx';
import { pdfYapisi, paragrafParcalari } from './pdf-word.js';
import { PdfHatasi } from './hatalar.js';

/** "1.234,5" / "54,2" / "12" → sayı; baştaki sıfırlı (TC, telefon) ve belirsiz değerler METİN kalır. */
export function sayiyaCevir(metin, { ondalik = 'tr' } = {}) {
  const m = String(metin).trim();
  if (!m || /^0\d/.test(m) || m.length > 15) return metin;
  if (ondalik === 'tr') {
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(m)) return Number(m.replace(/\./g, '').replace(',', '.'));
    if (/^-?\d+(,\d+)?$/.test(m)) return Number(m.replace(',', '.'));
    return metin;
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(m)) return Number(m.replace(/,/g, ''));
  if (/^-?\d+(\.\d+)?$/.test(m)) return Number(m);
  return metin;
}

/**
 * @param secenek.duzen      'sayfa' (sayfa başına bir sayfa) | 'tablo' (tablo başına bir sayfa) | 'tek' (hepsi tek sayfada)
 * @param secenek.tabloDisi  true → tablo olmayan metin satırları da (A sütununa) aktarılır
 * @param secenek.sayilar    true → sayıya benzeyen hücreler sayı yapılır
 * @param secenek.ondalik    'tr' (1.234,5) | 'en' (1,234.5)
 */
export async function pdfdenExcel(bayt, {
  sayfalar = '', ocr = 'otomatik', duzen = 'sayfa', tabloDisi = false, sayilar = true, ondalik = 'tr', ocrDpi = 200, dil = 'tur', ilerleme,
} = {}) {
  const { nihai, bilgi } = await pdfYapisi(bayt, { sayfalar, ocr, resimler: false, ustAltAtla: false, ocrDpi, dil, ilerleme });
  const deger = (m) => (sayilar ? sayiyaCevir(m, { ondalik }) : m);
  const tablolar = []; // {sayfaNo, satirlar: any[][], tablo:boolean}
  const sayfaGrubu = new Map();
  for (const b of nihai) {
    let satirlar = null;
    if (b.tur === 'tablo') satirlar = b.tablo.satirlar.map((r) => r.map(deger));
    else if (b.tur === 'p' && tabloDisi) {
      const metin = paragrafParcalari(b.satirlar, { baslik: b.baslik, maddeAt: b.madde }, bilgi).map((r) => r.metin).join('').trim();
      if (metin) satirlar = [[metin]];
    }
    if (!satirlar) continue;
    tablolar.push({ sayfaNo: b.sayfaNo, satirlar, tablo: b.tur === 'tablo' });
    if (!sayfaGrubu.has(b.sayfaNo)) sayfaGrubu.set(b.sayfaNo, []);
    sayfaGrubu.get(b.sayfaNo).push(tablolar.at(-1));
  }
  const tabloSayisi = tablolar.filter((t) => t.tablo).length;
  if (!tabloSayisi) {
    throw new PdfHatasi('Bu sayfalarda tablo bulunamadı. Tablolar yazıların düzgün hizalı sütunlarından tahmin edilir. “Tablo olmayan satırları da aktar” seçeneğini açarak tüm metni Excel’e alabilirsiniz.');
  }

  const kitap = XLSX.utils.book_new();
  const ekle = (ad, satirlar) => {
    const sayfa = XLSX.utils.aoa_to_sheet(satirlar);
    const gen = satirlar.reduce((a, r) => { r.forEach((h, i) => { a[i] = Math.max(a[i] ?? 8, Math.min(60, String(h ?? '').length + 2)); }); return a; }, []);
    sayfa['!cols'] = gen.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(kitap, sayfa, ad.slice(0, 31));
  };
  if (duzen === 'tek') {
    const hepsi = [];
    tablolar.forEach((t, i) => { if (i) hepsi.push([]); hepsi.push(...t.satirlar); });
    ekle('Tablolar', hepsi);
  } else if (duzen === 'tablo') {
    const sayac = new Map();
    tablolar.filter((t) => t.tablo).forEach((t) => {
      const n = (sayac.get(t.sayfaNo) ?? 0) + 1; sayac.set(t.sayfaNo, n);
      ekle(`Sayfa${t.sayfaNo}_Tablo${n}`, t.satirlar);
    });
  } else {
    for (const [no, liste] of sayfaGrubu) {
      const satirlar = [];
      liste.forEach((t, i) => { if (i) satirlar.push([]); satirlar.push(...t.satirlar); });
      ekle(`Sayfa ${no}`, satirlar);
    }
  }
  const cikti = new Uint8Array(XLSX.write(kitap, { type: 'array', bookType: 'xlsx' }));
  const uyarilar = [
    'Tablolar, PDF’teki yazıların sütun hizasından TAHMİN edildi; çizgiler/hücre sınırları okunmaz. Birleştirilmiş hücreli, iç içe ya da hizasız tablolar bozuk çıkabilir. Excel’de kontrol edin.',
  ];
  if (sayilar) uyarilar.push(`Sayıya benzeyen hücreler sayı yapıldı (${ondalik === 'tr' ? '1.234,5 biçimi' : '1,234.5 biçimi'}); baştaki sıfırlı değerler (TC no, telefon) metin kalır.`);
  if (bilgi.ocrSayfa) uyarilar.push(`${bilgi.ocrSayfa} taranmış sayfa OCR ile okundu; okuma hataları olabilir.`);
  if (bilgi.sutunluSayfa) uyarilar.push(`${bilgi.sutunluSayfa} sayfada iki sütunlu metin düzeni algılandı; tablo bulma etkilenmiş olabilir.`);
  return { bayt: cikti, uyarilar, bilgi: { tablo: tabloSayisi, sayfa: kitap.SheetNames.length, satir: tablolar.reduce((t, x) => t + x.satirlar.length, 0) } };
}
