// Excel ek işlemleri: CSV ↔ XLSX dönüştürme ve yinelenen satırları silme. SheetJS (xlsx, yerel paket); hepsi cihazda.
import * as XLSX from 'xlsx';
import { PdfHatasi } from './hatalar.js';
import { sayiyaCevir } from './pdf-excel.js';
import { dosyaAdiTuret } from './util.js';

const AYIRAC_ADI = { ';': 'noktalı virgül', ',': 'virgül', '\t': 'sekme' };

/** Metni çözer: UTF-8 (BOM'lu olabilir); geçersizse Windows-1254 (eski Türkçe Excel CSV'leri). */
export function metinCoz(bayt) {
  try { return { metin: new TextDecoder('utf-8', { fatal: true }).decode(bayt).replace(/^﻿/, ''), kodlama: 'UTF-8' }; }
  catch { return { metin: new TextDecoder('windows-1254').decode(bayt), kodlama: 'Windows-1254' }; }
}

/** İlk birkaç satırdaki en tutarlı ayırıcıyı bulur. */
export function ayiriciBul(metin) {
  const satirlar = metin.split(/\r?\n/).filter((s) => s.trim()).slice(0, 12);
  let en = ';', enSkor = -1;
  for (const a of [';', ',', '\t']) {
    const sayilar = satirlar.map((s) => { let n = 0, tirnak = false; for (const c of s) { if (c === '"') tirnak = !tirnak; else if (c === a && !tirnak) n++; } return n; });
    const ilk = sayilar[0] ?? 0;
    if (!ilk) continue;
    const tutarli = sayilar.filter((n) => n === ilk).length;
    const skor = tutarli * 1000 + ilk;
    if (skor > enSkor) { enSkor = skor; en = a; }
  }
  return en;
}

/** Tırnaklı alanları, çok satırlı hücreleri ve "" kaçışını destekleyen CSV ayrıştırıcı. */
export function csvAyristir(metin, ayirac) {
  const satirlar = []; let satir = [], alan = '', tirnak = false, i = 0;
  const n = metin.length;
  while (i < n) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"') { if (metin[i + 1] === '"') { alan += '"'; i += 2; continue; } tirnak = false; i++; continue; }
      alan += c; i++; continue;
    }
    if (c === '"' && alan === '') { tirnak = true; i++; continue; }
    if (c === ayirac) { satir.push(alan); alan = ''; i++; continue; }
    if (c === '\r' || c === '\n') { if (c === '\r' && metin[i + 1] === '\n') i++; satir.push(alan); satirlar.push(satir); satir = []; alan = ''; i++; continue; }
    alan += c; i++;
  }
  if (alan !== '' || satir.length) { satir.push(alan); satirlar.push(satir); }
  while (satirlar.length && satirlar.at(-1).every((x) => x === '')) satirlar.pop();
  return satirlar;
}

const csvHucre = (v, ayirac) => {
  let s = v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  if (s.includes('"') || s.includes(ayirac) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

/**
 * XLSX/XLS → CSV (her sayfa ayrı dosya).
 * @param secenek.ayirac ';' | ',' | '\t'   (Türkiye'de Excel varsayılanı ';')
 * @param secenek.bom    true → UTF-8 BOM (Excel'de Türkçe karakterler bozulmasın)
 */
export function xlsxCsv(bayt, dosyaAdi, { ayirac = ';', bom = true, degerler = 'gorunen' } = {}) {
  let kitap;
  try { kitap = XLSX.read(bayt, { type: 'array', cellDates: true }); } catch (e) { throw new PdfHatasi(`Excel dosyası okunamadı: ${e?.message ?? e}`); }
  if (!kitap.SheetNames.length) throw new PdfHatasi('Excel dosyasında sayfa yok.');
  const dosyalar = [];
  for (const ad of kitap.SheetNames) {
    const ws = kitap.Sheets[ad];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: degerler !== 'gorunen', defval: '', blankrows: true, dateNF: 'yyyy-mm-dd' });
    while (aoa.length && aoa.at(-1).every((x) => x === '' || x == null)) aoa.pop();
    const csv = aoa.map((r) => r.map((v) => csvHucre(v, ayirac)).join(ayirac)).join('\r\n') + '\r\n';
    const govde = new TextEncoder().encode(csv);
    const cikti = bom ? new Uint8Array([0xef, 0xbb, 0xbf, ...govde]) : govde;
    dosyalar.push({ ad: dosyaAdiTuret(dosyaAdi, kitap.SheetNames.length > 1 ? `-${ad.replace(/[\\/:*?"<>|]+/g, '_')}` : '', 'csv'), bayt: cikti, satir: aoa.length });
  }
  return { dosyalar, uyarilar: [kitap.SheetNames.length > 1 ? `${kitap.SheetNames.length} sayfa ayrı CSV dosyalarına yazıldı.` : null, 'CSV yalnızca değerleri taşır; formüller, biçimlendirme, renk ve birleştirilmiş hücreler kaybolur.'].filter(Boolean) };
}

/**
 * CSV/TSV/TXT → XLSX.
 * @param secenek.ayirac 'otomatik' | ';' | ',' | '\t'
 * @param secenek.sayilar true → sayıya benzeyen hücreler sayı yapılır (baştaki sıfırlı değerler metin kalır)
 */
export function csvXlsx(bayt, dosyaAdi, { ayirac = 'otomatik', sayilar = true, ondalik = 'tr' } = {}) {
  const { metin, kodlama } = metinCoz(bayt);
  if (!metin.trim()) throw new PdfHatasi('Dosya boş.');
  const a = ayirac === 'otomatik' ? ayiriciBul(metin) : ayirac;
  const aoa = csvAyristir(metin, a).map((r) => r.map((v) => (sayilar ? sayiyaCevir(v, { ondalik }) : v)));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const gen = aoa.reduce((t, r) => { r.forEach((h, i) => { t[i] = Math.max(t[i] ?? 8, Math.min(60, String(h ?? '').length + 2)); }); return t; }, []);
  ws['!cols'] = gen.map((wch) => ({ wch }));
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, ws, 'Sayfa1');
  return {
    bayt: new Uint8Array(XLSX.write(kitap, { type: 'array', bookType: 'xlsx' })), satir: aoa.length, sutun: Math.max(0, ...aoa.map((r) => r.length)),
    ayirac: a, kodlama,
    uyarilar: [`Ayırıcı: ${AYIRAC_ADI[a] ?? a}; kodlama: ${kodlama}.${kodlama !== 'UTF-8' ? ' Türkçe karakterler bozuk görünüyorsa dosyanın kodlaması farklı olabilir.' : ''}`],
  };
}

const sutunNo = (s) => { let n = 0; for (const c of s.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/**
 * Yinelenen satırları siler (değerler yazılır; formül/biçim korunmaz).
 * @param secenek.sutunlar     "Ad, TC" ya da "A, C" (boş = TÜM sütunlar aynı olan satırlar)
 * @param secenek.baslik       ilk satır başlık mı (korunur, karşılaştırılmaz)
 * @param secenek.buyukKucuk   false → büyük/küçük harf farkı yok sayılır (Türkçe I/ı İ/i doğru)
 * @param secenek.kirp         baştaki/sondaki boşlukları yok say
 * @param secenek.tut          'ilk' | 'son'
 * @param secenek.sayfa        'hepsi' | sayfa adı
 */
export function excelTekrarSil(bayt, dosyaAdi, { sutunlar = '', baslik = true, buyukKucuk = false, kirp = true, tut = 'ilk', sayfa = 'hepsi' } = {}) {
  let kitap;
  try { kitap = XLSX.read(bayt, { type: 'array', cellDates: true }); } catch (e) { throw new PdfHatasi(`Excel dosyası okunamadı: ${e?.message ?? e}`); }
  const adlar = sayfa === 'hepsi' || !sayfa ? kitap.SheetNames : kitap.SheetNames.filter((a) => a === sayfa);
  if (!adlar.length) throw new PdfHatasi(`“${sayfa}” adlı sayfa yok. Sayfalar: ${kitap.SheetNames.join(', ')}`);
  const yeni = XLSX.utils.book_new();
  const rapor = []; const uyarilar = [];
  for (const ad of kitap.SheetNames) {
    const ws = kitap.Sheets[ad];
    if (!adlar.includes(ad)) { XLSX.utils.book_append_sheet(yeni, ws, ad); continue; }
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
    const bas = baslik && aoa.length ? aoa[0] : null;
    const veri = bas ? aoa.slice(1) : aoa;
    const maxSut = Math.max(0, ...aoa.map((r) => r.length));
    let secili = null;
    if (String(sutunlar).trim()) {
      secili = [];
      for (const p of String(sutunlar).split(/[,;]+/).map((x) => x.trim()).filter(Boolean)) {
        let k = -1;
        if (bas) k = bas.findIndex((b) => String(b).trim().toLocaleLowerCase('tr-TR') === p.toLocaleLowerCase('tr-TR'));
        if (k < 0 && /^[A-Za-z]{1,3}$/.test(p)) k = sutunNo(p);
        if (k < 0 || k >= maxSut) throw new PdfHatasi(`“${p}” sütunu “${ad}” sayfasında bulunamadı. Başlıklar: ${(bas ?? []).join(', ') || '(başlık satırı yok)'}`);
        secili.push(k);
      }
    }
    const anahtar = (r) => {
      const idx = secili ?? Array.from({ length: maxSut }, (_, i) => i);
      return idx.map((i) => { let v = r[i]; if (v instanceof Date) v = v.toISOString(); v = v == null ? '' : String(v); if (kirp) v = v.trim(); if (!buyukKucuk) v = v.toLocaleLowerCase('tr-TR'); return v; }).join('\u0001');
    };
    const sira = tut === 'son' ? [...veri.keys()].reverse() : [...veri.keys()];
    const goruldu = new Set(); const tutulan = new Set();
    for (const i of sira) { const a = anahtar(veri[i]); if (veri[i].every((x) => x === '' || x == null)) continue; if (!goruldu.has(a)) { goruldu.add(a); tutulan.add(i); } }
    const sonuc = veri.filter((_, i) => tutulan.has(i));
    const silinen = veri.filter((r) => !r.every((x) => x === '' || x == null)).length - sonuc.length;
    const yeniWs = XLSX.utils.aoa_to_sheet(bas ? [bas, ...sonuc] : sonuc, { cellDates: true });
    if (ws['!cols']) yeniWs['!cols'] = ws['!cols'];
    XLSX.utils.book_append_sheet(yeni, yeniWs, ad);
    rapor.push({ sayfa: ad, onceki: veri.length, sonraki: sonuc.length, silinen });
  }
  const toplam = rapor.reduce((t, r) => t + r.silinen, 0);
  uyarilar.push('Değerler yeni dosyaya yazılır; formüller, hücre biçimleri, renkler ve birleştirilmiş hücreler korunmaz.');
  return { bayt: new Uint8Array(XLSX.write(yeni, { type: 'array', bookType: 'xlsx' })), rapor, silinen: toplam, uyarilar, ad: dosyaAdiTuret(dosyaAdi, '-tekrarsiz', 'xlsx') };
}
