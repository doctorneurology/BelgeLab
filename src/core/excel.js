// Excel işlemleri: birleştirme ve hasta başvuru analizi. Tarayıcıda ve Node'da aynı kod (SheetJS / xlsx, yerel paket).
// Kaynak: kullanıcının kendi HBYS çalışması için hazırladığı "excel html" aracı; mantığı korunmuş, şu eklemeler yapılmıştır:
//  - Dosya sırası KORUNUR (eskiden dosyalar hangisi önce okunursa o önce eklenirdi; ilk dosyanın başlığı karışabilirdi).
//  - Atlanacak üst satır sayıları ayarlanabilir (varsayılan: ilk dosya 3, diğerleri 4).
//  - Anlaşılır uyarılar: yetersiz satırlı dosya, farklı sütun sayısı, TC/ad sütunu bulunamayan dosya, atlanan satırlar.
//  - Okunamayan dosya tüm işlemi bozmaz; hangi dosyanın sorunlu olduğu söylenir.

import * as XLSX from 'xlsx';
import { PdfHatasi } from './hatalar.js';

/** Eski sistemlerden gelen bozuk Türkçe karakterleri düzeltir (Ð→Ğ, Ý→İ, Þ→Ş …). Sayıları ve boşları metne çevirir. */
export function turkceDuzelt(deger) {
  if (deger === null || deger === undefined) return '';
  return String(deger)
    .replace(/Ð/g, 'Ğ').replace(/ð/g, 'ğ')
    .replace(/Ý/g, 'İ').replace(/ý/g, 'ı')
    .replace(/Þ/g, 'Ş').replace(/þ/g, 'ş');
}

export function baslikTemizle(anahtar) {
  if (!anahtar) return '';
  return turkceDuzelt(anahtar).toUpperCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tcMi(deger) {
  if (!deger) return false;
  const s = String(deger).trim();
  if (/^\d{2}\*{9}\d{2}$/.test(s)) return true;
  if (/^\d{11}$/.test(s)) return true;
  return s.includes('*') && (s.match(/\*/g) ?? []).length >= 7 && /\d/.test(s);
}

export function adMi(deger) {
  if (!deger) return false;
  const s = String(deger).trim();
  return /[a-zA-ZğĞıİöÖçÇşŞþÞðÐýÝ]/.test(s) && !tcMi(s);
}

function excelImzasiVarMi(b) {
  const zip = b[0] === 0x50 && b[1] === 0x4b; // .xlsx / .xlsm (ZIP)
  const eski = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // .xls (OLE2)
  return zip || eski;
}

function calismaKitabiOku(bayt, secenek) {
  if (!excelImzasiVarMi(bayt)) throw new PdfHatasi('Bu dosya geçerli bir Excel (.xlsx / .xls) dosyası gibi görünmüyor.', 'EXCEL');
  try {
    return XLSX.read(bayt, { type: 'array', ...secenek });
  } catch (e) {
    throw new PdfHatasi(`Excel dosyası okunamadı: ${e?.message ?? e}`, 'EXCEL');
  }
}

/** İlk sayfanın ham satırları (dizi dizisi). */
export function ilkSayfaSatirlari(bayt) {
  const kitap = calismaKitabiOku(bayt, { raw: true, cellDates: false });
  const ad = kitap.SheetNames[0];
  if (!ad) throw new PdfHatasi('Dosyada hiç sayfa yok.', 'EXCEL');
  return XLSX.utils.sheet_to_json(kitap.Sheets[ad], { header: 1, defval: '', blankrows: false });
}

const bosMu = (satir) => !satir.some((h) => h !== null && h !== undefined && String(h).trim() !== '');

/**
 * @param dosyalar [{ad, bayt}] — SIRA önemlidir
 * @param secenek.ilkAtla    ilk dosyadan atlanacak üst satır sayısı (başlık bölgesi; varsayılan 3)
 * @param secenek.digerAtla  diğer dosyalardan atlanacak üst satır sayısı (varsayılan 4)
 * @returns {{bayt:Uint8Array, satir:number, dosya:number, sutun:number, onizleme:string[][], uyarilar:string[]}}
 */
export function excelBirlestir(dosyalar, { ilkAtla = 3, digerAtla = 4, sayfaAdi = 'Birlestirilmis_Veri' } = {}) {
  if (!dosyalar?.length) throw new PdfHatasi('Birleştirmek için en az bir Excel dosyası seçin.');
  for (const [ad, d] of [['ilk dosya', ilkAtla], ['diğer dosyalar', digerAtla]]) {
    if (!Number.isInteger(d) || d < 0 || d > 1000) throw new PdfHatasi(`Atlanacak satır sayısı (${ad}) 0 ile 1000 arasında tam sayı olmalı.`);
  }
  const uyarilar = [];
  const satirlar = [];
  let enCokSutun = 0;
  const sutunlar = new Map();
  dosyalar.forEach((d, i) => {
    let ham;
    try { ham = ilkSayfaSatirlari(d.bayt); } catch (e) { throw new PdfHatasi(`“${d.ad}” okunamadı: ${e.message}`); }
    const atla = i === 0 ? ilkAtla : digerAtla;
    if (ham.length <= atla) {
      uyarilar.push(`“${d.ad}”: ${ham.length} satır var, ${atla} satır atlanacağı için bu dosyadan hiç satır alınmadı.`);
      return;
    }
    let alinan = 0;
    for (const satir of ham.slice(atla)) {
      if (bosMu(satir)) continue;
      enCokSutun = Math.max(enCokSutun, satir.length);
      satirlar.push(satir.map(turkceDuzelt));
      alinan++;
    }
    sutunlar.set(d.ad, Math.max(...ham.slice(atla).map((s) => s.length), 0));
    if (!alinan) uyarilar.push(`“${d.ad}”: atlanan satırlardan sonra dolu satır kalmadı.`);
  });
  if (!satirlar.length) throw new PdfHatasi('Birleştirilecek veri satırı bulunamadı. Atlanacak satır sayılarını kontrol edin.');
  const farkli = new Set([...sutunlar.values()]);
  if (farkli.size > 1) uyarilar.push(`Dosyaların sütun sayısı farklı (${[...farkli].join(', ')}); sütunlar yan yana hizalanarak birleştirildi. Başlıkların aynı sırada olduğundan emin olun.`);
  const sayfa = XLSX.utils.aoa_to_sheet(satirlar);
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, sayfaAdi);
  const bayt = new Uint8Array(XLSX.write(kitap, { type: 'array', bookType: 'xlsx' }));
  return { bayt, satir: satirlar.length, dosya: dosyalar.length, sutun: enCokSutun, onizleme: satirlar.slice(0, 50), uyarilar };
}

// ---------------------------------------------------------------------------------------------------
// Analiz
// ---------------------------------------------------------------------------------------------------

function sutunBul(anahtarlar, uygun) {
  return anahtarlar.find((k) => uygun(baslikTemizle(k)));
}
const TC_ANAHTAR = (k) => k.includes('TC') || k.includes('T C') || k.includes('KIMLIK') || k.includes('KİMLİK');
const AD_ANAHTAR = (k) => k.includes('AD SOYAD') || k.includes('ADI SOYADI') || k.includes('HASTA AD') || k.includes('HASTA ADI');
const BASVURU_ANAHTAR = (k) => k.includes('BASVURU') || k.includes('BAŞVURU') || k.includes('PROTOKOL') || k.includes('TAKIP NO') || k.includes('TAKİP NO');
const YAS_ANAHTAR = (k) => ['YAS', 'YAŞ', 'YASI', 'YAŞI', 'AGE'].includes(k);
const RAPOR_ANAHTAR = (k) => k.includes('RAPOR');

function buyukMu(eski, yeni) {
  if (!eski && yeni) return true;
  if (eski && !yeni) return false;
  if (!eski && !yeni) return false;
  const s1 = String(eski).trim(), s2 = String(yeni).trim();
  const n1 = parseFloat(s1.replace(/[^0-9.]/g, '')), n2 = parseFloat(s2.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(n1) && !Number.isNaN(n2)) return n2 > n1;
  return s2.localeCompare(s1, undefined, { numeric: true, sensitivity: 'base' }) > 0;
}

/**
 * Sayfayı "başlık satırı üstte" kabul ederek nesne satırlarına çevirir. Başlık satırı, ilk 15 satır içinde TC ya da ad soyad
 * sütunu başlığı içeren satır olarak OTOMATİK bulunur (üstte rapor başlığı/tarih satırları olabilir); bulunamazsa 1. satır başlıktır.
 */
function baslikSatiriBularakOku(sayfa) {
  const ham = XLSX.utils.sheet_to_json(sayfa, { header: 1, defval: '', blankrows: false });
  let b = ham.slice(0, 15).findIndex((r) => r.some((h) => { const k = baslikTemizle(h); return k && (TC_ANAHTAR(k) || AD_ANAHTAR(k)); }));
  if (b < 0) b = 0;
  const kullanilan = new Map();
  const basliklar = (ham[b] ?? []).map((h, i) => {
    let ad = String(h ?? '').trim() || `__EMPTY_${i}`;
    const n = kullanilan.get(ad) ?? 0;
    kullanilan.set(ad, n + 1);
    return n ? `${ad}_${n}` : ad;
  });
  return ham.slice(b + 1).map((r) => Object.fromEntries(basliklar.map((h, i) => [h, r[i] ?? ''])));
}

/**
 * Dosyalardaki TC / ad soyad / başvuru no sütunlarını (sütun sırasından bağımsız) otomatik bulur;
 * kişileri tekilleştirir, dosya başına başvuru sayısını ve çapraz varlığı hesaplar.
 * @param dosyalar [{ad, bayt}]
 */
export function excelAnaliz(dosyalar) {
  if (!dosyalar?.length) throw new PdfHatasi('Analiz için en az bir Excel dosyası seçin.');
  const hastalar = new Map();
  const dosyaAdlari = [];
  const uyarilar = [];
  let toplamKayit = 0, raporVar = false, yasVar = false;

  for (const d of dosyalar) {
    const dosyaAdi = d.ad.replace(/\.[^/.]+$/, '');
    if (!dosyaAdlari.includes(dosyaAdi)) dosyaAdlari.push(dosyaAdi);
    let satirlar;
    try {
      const kitap = calismaKitabiOku(d.bayt, {});
      satirlar = baslikSatiriBularakOku(kitap.Sheets[kitap.SheetNames[0]]);
    } catch (e) {
      uyarilar.push(`“${d.ad}” okunamadı ve atlandı: ${e.message}`);
      continue;
    }
    let taninan = 0, atlanan = 0;
    for (const satir of satirlar) {
      const anahtarlar = Object.keys(satir);
      const tcK = sutunBul(anahtarlar, TC_ANAHTAR), adK = sutunBul(anahtarlar, AD_ANAHTAR), bvK = sutunBul(anahtarlar, BASVURU_ANAHTAR);
      const yasK = sutunBul(anahtarlar, YAS_ANAHTAR), rpK = sutunBul(anahtarlar, RAPOR_ANAHTAR);
      if (rpK) raporVar = true;
      if (yasK) yasVar = true;
      if (!tcK && !adK) continue;
      let tc = tcK ? turkceDuzelt(satir[tcK]) : '';
      let ad = adK ? turkceDuzelt(satir[adK]) : '';
      if (!tcMi(tc)) { if (adMi(tc) && !ad) ad = tc; tc = ''; }
      const basvuru = bvK ? turkceDuzelt(satir[bvK]) : '';
      const yas = yasK ? turkceDuzelt(satir[yasK]) : '';
      const rapor = rpK ? turkceDuzelt(satir[rpK]) : '';
      if (!tc && !ad) { atlanan++; continue; }
      taninan++;
      const anahtar = `${tc.toLowerCase().replace(/\s+/g, '')}_${ad.toLowerCase().replace(/\s+/g, '')}`;
      toplamKayit++;
      let h = hastalar.get(anahtar);
      if (!h) {
        h = { tc, ad, enBuyukBasvuru: basvuru, yas, rapor, sayilar: {}, dosyaSayisi: 0, toplam: 0 };
        hastalar.set(anahtar, h);
      } else if (buyukMu(h.enBuyukBasvuru, basvuru)) {
        h.enBuyukBasvuru = basvuru; h.yas = yas || h.yas; h.rapor = rapor;
      } else if (!h.rapor && rapor) h.rapor = rapor;
      if (!h.sayilar[dosyaAdi]) h.dosyaSayisi++;
      h.sayilar[dosyaAdi] = (h.sayilar[dosyaAdi] ?? 0) + 1;
      h.toplam++;
    }
    if (!taninan) uyarilar.push(`“${d.ad}”: TC kimlik ya da ad soyad sütunu bulunamadı veya satırlar boş; bu dosyadan kayıt alınamadı. Başlıkları kontrol edin (ör. “TC KİMLİK NO”, “ADI SOYADI”).`);
    if (atlanan) uyarilar.push(`“${d.ad}”: ${atlanan} satırda TC ve ad soyad birlikte boş olduğu için kayıt alınmadı.`);
  }
  const liste = [...hastalar.values()].sort((a, b) => b.toplam - a.toplam);
  return { hastalar: liste, dosyaAdlari, toplamKayit, raporVar, yasVar, uyarilar };
}

/** Analiz sonucunu Excel dosyasına (xlsx) çevirir. */
export function analizDisaAktar(sonuc, { sadeceCapraz = false, rapor = true } = {}) {
  const tek = sonuc.dosyaAdlari.length === 1;
  const raporAktif = sonuc.raporVar && rapor;
  const liste = sadeceCapraz ? sonuc.hastalar.filter((h) => h.dosyaSayisi > 1) : sonuc.hastalar;
  if (!liste.length) throw new PdfHatasi('Dışa aktarılacak hasta kaydı bulunamadı.');
  const satirlar = liste.map((h) => {
    const s = { TC_KIMLIK: h.tc || '', ADI_SOYADI: h.ad, BASVURU_NO: h.enBuyukBasvuru || '' };
    if (!tek) for (const f of sonuc.dosyaAdlari) s[`${f} (Başvuru)`] = h.sayilar[f] ?? 0;
    s['TOPLAM BAŞVURU'] = h.toplam;
    if (sonuc.yasVar) s.YASI = h.yas || '';
    if (raporAktif) s.RAPOR = h.rapor || '';
    return s;
  });
  const sayfa = XLSX.utils.json_to_sheet(satirlar);
  const enUzunAd = satirlar.reduce((w, r) => Math.max(w, (r.ADI_SOYADI || '').length), 10);
  const sutun = [{ wch: 15 }, { wch: enUzunAd + 5 }, { wch: 18 }];
  if (!tek) sonuc.dosyaAdlari.forEach(() => sutun.push({ wch: 20 }));
  sutun.push({ wch: 18 });
  if (sonuc.yasVar) sutun.push({ wch: 10 });
  if (raporAktif) sutun.push({ wch: 30 });
  sayfa['!cols'] = sutun;
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, 'Hasta_Basvuru_Ozet');
  return { bayt: new Uint8Array(XLSX.write(kitap, { type: 'array', bookType: 'xlsx' })), satir: liste.length };
}
