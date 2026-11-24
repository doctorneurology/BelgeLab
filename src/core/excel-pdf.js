// Excel (.xlsx / .xls) → PDF. Her (görünür) sayfa tablo olarak PDF'e yazılır; geniş sayfalar yatay yerleştirilir.
// DÜRÜSTLÜK: Hücre biçimleri (renk, kenarlık, birleştirilmiş hücre, grafikler, resimler, formül çubuğu) Excel'deki gibi
// çizilmez; değerler Excel'in gösterdiği biçimiyle (tarih, para birimi, yüzde…) yazılır. İlk satır başlık sayılır.
// SATIR / SAYFA / DOSYA SINIRI YOKTUR.

import * as XLSX from 'xlsx';
import { modeldenPdf, A4 } from './belge-pdf.js';
import { PdfHatasi } from './hatalar.js';

const SAYI = /^[-+(]?[$€₺£]?\s?\d[\d.,\s]*\s?[%$€₺£)]?$/;

function sutunGenislikleri(sayfa, satirlar, sutunSayisi) {
  const tanim = sayfa['!cols'] ?? [];
  return Array.from({ length: sutunSayisi }, (_, i) => {
    const wch = tanim[i]?.wch ?? tanim[i]?.wpx / 7;
    if (wch > 0) return Math.min(60, Math.max(4, wch));
    const enUzun = satirlar.slice(0, 200).reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 0);
    return Math.min(45, Math.max(5, enUzun + 1));
  });
}

/**
 * @param secenek.yon   'otomatik' | 'dikey' | 'yatay'
 * @param secenek.kenarlik  hücre çizgileri
 * @returns {{bayt, sayfa, uyarilar, bilgi:{excelSayfasi, satir}}}
 */
export async function excelPdf(bayt, { yon = 'otomatik', kenarlik = true, ilerleme, dosyaAdi = '' } = {}) {
  if (!(bayt[0] === 0x50 && bayt[1] === 0x4b) && !(bayt[0] === 0xd0 && bayt[1] === 0xcf)) throw new PdfHatasi('Bu dosya geçerli bir Excel (.xlsx / .xls) dosyası gibi görünmüyor.');
  let kitap;
  try { kitap = XLSX.read(bayt, { type: 'array', cellDates: true }); } catch (e) { throw new PdfHatasi(`Excel dosyası okunamadı: ${e?.message ?? e}`); }
  const uyarilar = new Set();
  const bloklar = [];
  let satirToplam = 0, sayfaSayisi = 0;
  const gizli = kitap.Workbook?.Sheets ?? [];
  kitap.SheetNames.forEach((ad, k) => {
    if (gizli[k]?.Hidden) { uyarilar.add('Gizli Excel sayfaları aktarılmadı.'); return; }
    const sayfa = kitap.Sheets[ad];
    if (sayfa['!merges']?.length) uyarilar.add('Birleştirilmiş hücreler ayrı hücreler olarak yazıldı.');
    let satirlar = XLSX.utils.sheet_to_json(sayfa, { header: 1, raw: false, defval: '', blankrows: false });
    // sağdaki ve alttaki boş alanları at
    let sutun = Math.max(0, ...satirlar.map((r) => { let n = r.length; while (n > 0 && String(r[n - 1]).trim() === '') n--; return n; }));
    satirlar = satirlar.map((r) => Array.from({ length: sutun }, (_, i) => String(r[i] ?? '')));
    if (!satirlar.length || !sutun) return;
    sayfaSayisi++;
    satirToplam += satirlar.length;
    const gen = sutunGenislikleri(sayfa, satirlar, sutun);
    const toplamGen = gen.reduce((a, c) => a + c, 0);
    // ~0,55 pt/karakter @10pt: sayfa içi genişlik
    const dikeyIc = A4.genislik - 72, yatayIc = A4.yukseklik - 72;
    const gerek = toplamGen * 5.2;
    const yatay = yon === 'yatay' || (yon === 'otomatik' && gerek > dikeyIc);
    const ic = yatay ? yatayIc : dikeyIc;
    const boyut = Math.max(5.5, Math.min(10, 10 * Math.min(1, ic / Math.max(gerek, 1)) + (gerek > ic ? 0 : 0)));
    if (gerek > ic * 1.8) uyarilar.add('Çok geniş sayfalarda yazı küçültüldü ve uzun değerler hücre içinde alt satıra kaydırıldı.');
    bloklar.push({ tur: 'sayfaAyari', genislik: yatay ? A4.yukseklik : A4.genislik, yukseklik: yatay ? A4.genislik : A4.yukseklik });
    bloklar.push({ tur: 'p', parcalar: [{ metin: ad, kalin: true, boyut: 12 }], once: 0, sonra: 6, baslik: 2 });
    bloklar.push({
      tur: 'tablo', kolonlar: gen, boyut, kenarlik,
      satirlar: satirlar.map((r, ri) => r.map((m) => ({
        baslik: ri === 0 && satirlar.length > 1,
        bloklar: [{ tur: 'p', parcalar: [{ metin: m, boyut, kalin: ri === 0 && satirlar.length > 1 }], hiza: SAYI.test(m.trim()) && ri > 0 ? 'sag' : 'sol' }],
      }))),
    });
    ilerleme?.(k, kitap.SheetNames.length, `“${ad}” yerleştiriliyor…`);
  });
  if (!bloklar.length) throw new PdfHatasi('Excel dosyasında aktarılacak dolu bir sayfa bulunamadı.');
  const r = await modeldenPdf({ sayfa: { genislik: A4.genislik, yukseklik: A4.yukseklik, kenar: { ust: 36, alt: 36, sol: 36, sag: 36 }, }, baslik: dosyaAdi.replace(/\.(xlsx|xls|xlsm)$/i, ''), bloklar }, { ilerleme });
  r.uyarilar.forEach((u) => uyarilar.add(u));
  return {
    bayt: r.bayt, sayfa: r.sayfa, bilgi: { excelSayfasi: sayfaSayisi, satir: satirToplam },
    uyarilar: ['Excel’deki renkler, kenarlıklar, grafikler ve resimler aktarılmaz; yalnızca değerler tablo olarak yazılır. Formüller sonuçlarıyla yazılır.', ...uyarilar],
  };
}
