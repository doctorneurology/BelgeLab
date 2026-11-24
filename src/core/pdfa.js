// PDF/A (arşiv PDF'i) — DENEYSEL. İki işlev: (1) pdfaDenetle: dosyadaki bilinen PDF/A engellerini (gömülü olmayan yazı tipi, şifre,
// JavaScript, saydamlık, XMP/OutputIntent eksikliği…) listeler; (2) pdfaDonustur: sayfaları resme çevirip görünmez yazı katmanı,
// XMP üstverisi (pdfaid) ve sRGB OutputIntent ekleyerek PDF/A-2b'ye YAKLAŞAN bir dosya üretir.
//
// DÜRÜSTLÜK: Burada yapılan denetim kısmidir ve çıktı resmî bir PDF/A doğrulayıcısıyla (ör. veraPDF) SINANMAMIŞTIR. Bu yüzden
// çıktının PDF/A "uyumlu" olduğu garanti edilmez; kurumsal arşivleme/şartname için veraPDF ile doğrulayın. Dönüştürme sayfaları
// resme çevirdiği için dosya büyür ve orijinal yazı tipleri/vektörler kaybolur (yazı aranabilir katman olarak korunur).

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFStream, PDFHexString, PDFString, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { belgeAc } from './render.js';
import { pdfAc, URETICI } from './belge.js';
import { sayfayiResmeCevir, sayfaYaziKutulari } from './sayfa-resim.js';
import { gorunmezKatmanEkle } from './ocr.js';
import { SifreliPdfHatasi, PdfHatasi } from './hatalar.js';

const ad = (s) => PDFName.of(s);

// ---- sRGB benzeri ICC profili (matris/TRC, v2.1) ---------------------------------------------------------------------------
function s15(x) { const v = Math.round(x * 65536); return [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
const ascii = (s) => [...s].map((c) => c.charCodeAt(0) & 127);

export function srgbIccProfili() {
  const xyz = (x, y, z) => [...ascii('XYZ '), 0, 0, 0, 0, ...s15(x), ...s15(y), ...s15(z)];
  const egri = [...ascii('curv'), 0, 0, 0, 0, ...u32(1), 0x02, 0x33, 0, 0]; // gama 2.2 (u8Fixed8)
  const metin = (s) => { const b = [...ascii('text'), 0, 0, 0, 0, ...ascii(s), 0]; while (b.length % 4) b.push(0); return b; };
  const aciklama = (s) => {
    const a = [...ascii('desc'), 0, 0, 0, 0, ...u32(s.length + 1), ...ascii(s), 0, ...u32(0), ...u32(0), 0, 0, 0, ...new Array(67).fill(0)];
    while (a.length % 4) a.push(0);
    return a;
  };
  const etiketler = [
    ['desc', aciklama('sRGB-uyumlu profil (PDF Araçları)')], ['cprt', metin('Kamu malı (public domain)')],
    ['wtpt', xyz(0.9642, 1.0, 0.8249)],
    ['rXYZ', xyz(0.4360747, 0.2225045, 0.0139322)], ['gXYZ', xyz(0.3850649, 0.7168786, 0.0971045)], ['bXYZ', xyz(0.1430804, 0.0606169, 0.7141733)],
    ['rTRC', egri], ['gTRC', egri], ['bTRC', egri],
  ];
  const tabloBoyu = 4 + etiketler.length * 12;
  let ofset = 128 + tabloBoyu;
  const tablo = [...u32(etiketler.length)];
  const govde = [];
  for (const [imza, veri] of etiketler) {
    tablo.push(...ascii(imza), ...u32(ofset), ...u32(veri.length));
    govde.push(...veri);
    ofset += veri.length;
  }
  const baslik = new Array(128).fill(0);
  const yaz = (k, dizi) => dizi.forEach((v, i) => { baslik[k + i] = v; });
  yaz(0, u32(ofset)); yaz(8, [2, 0x10, 0, 0]);
  yaz(12, ascii('mntr')); yaz(16, ascii('RGB ')); yaz(20, ascii('XYZ '));
  yaz(24, [0x07, 0xea, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]); // 2026-01-01
  yaz(36, ascii('acsp'));
  yaz(68, s15(0.9642)); yaz(72, s15(1.0)); yaz(76, s15(0.8249));
  return new Uint8Array([...baslik, ...tablo, ...govde]);
}

// ---- Denetim ---------------------------------------------------------------------------------------------------------------
function ozyinele(doc, f) {
  const ctx = doc.context;
  const gorulen = new Set();
  const gez = (v) => {
    if (v instanceof PDFRef) { if (gorulen.has(v.tag)) return; gorulen.add(v.tag); gez(ctx.lookup(v)); return; }
    if (v instanceof PDFStream) { f(v.dict, v); gez(v.dict); return; }
    if (v instanceof PDFDict) { f(v); for (const x of v.values()) gez(x); return; }
    if (v instanceof PDFArray) v.asArray().forEach(gez);
  };
  gez(ctx.trailerInfo.Root);
}

/** @returns {{sorunlar:{kod,ad,sayi,onemli:boolean}[], uygunGibi:boolean, sayfa:number}} */
export async function pdfaDenetle(bayt) {
  let doc;
  try { doc = await pdfAc(bayt); } catch (e) {
    if (e instanceof SifreliPdfHatasi) return { sorunlar: [{ kod: 'SIFRE', ad: 'Belge şifreli (PDF/A şifreye izin vermez)', sayi: 1, onemli: true }], uygunGibi: false, sayfa: 0 };
    throw e;
  }
  const say = { yaziTipiGomulmemis: 0, js: 0, saydam: 0, lzw: 0, ek: 0, harici: 0 };
  ozyinele(doc, (d) => {
    const tur = d.lookup?.(ad('Type'))?.decodeText?.();
    const alt = d.lookup?.(ad('Subtype'))?.decodeText?.();
    if (tur === 'Font' && alt && alt !== 'Type3' && alt !== 'Type0') {
      const fd = d.lookup(ad('FontDescriptor'));
      if (!(fd instanceof PDFDict) || !(fd.has(ad('FontFile')) || fd.has(ad('FontFile2')) || fd.has(ad('FontFile3')))) say.yaziTipiGomulmemis++;
    }
    if (tur === 'Font' && alt === 'Type0') {
      const soy = d.lookup(ad('DescendantFonts'));
      const c = soy instanceof PDFArray ? soy.lookup(0) : null;
      const fd = c instanceof PDFDict ? c.lookup(ad('FontDescriptor')) : null;
      if (!(fd instanceof PDFDict) || !(fd.has(ad('FontFile')) || fd.has(ad('FontFile2')) || fd.has(ad('FontFile3')))) say.yaziTipiGomulmemis++;
    }
    if (d.lookup?.(ad('S'))?.decodeText?.() === 'JavaScript' || d.has?.(ad('JS'))) say.js++;
    const ca = d.lookup?.(ad('ca')), CA = d.lookup?.(ad('CA'));
    if ((ca && Number(ca.asNumber?.() ?? 1) < 1) || (CA && Number(CA.asNumber?.() ?? 1) < 1)) say.saydam++;
    const sm = d.lookup?.(ad('SMask'));
    if (sm && !(sm instanceof PDFName)) say.saydam++;
    const f = d.lookup?.(ad('Filter'));
    if ((f instanceof PDFName && f.decodeText() === 'LZWDecode') || (f instanceof PDFArray && f.asArray().some((x) => x?.decodeText?.() === 'LZWDecode'))) say.lzw++;
    if (tur === 'Filespec' && d.has(ad('EF'))) say.ek++;
    if (d.has?.(ad('F')) && alt === 'XObject' ) say.harici++;
  });
  const kat = doc.catalog;
  const meta = kat.lookup(ad('Metadata'));
  let xmpTamam = false;
  if (meta instanceof PDFRawStream) {
    try { xmpTamam = /pdfaid:part/.test(new TextDecoder().decode(decodePDFRawStream(meta).decode())); } catch { /* yok */ }
  }
  const oi = kat.lookup(ad('OutputIntents'));
  const sorunlar = [];
  const ekle = (kod, adi, sayi, onemli = true) => { if (sayi) sorunlar.push({ kod, ad: adi, sayi, onemli }); };
  ekle('FONT', 'Gömülü olmayan yazı tipi (PDF/A tüm yazı tiplerinin gömülü olmasını ister)', say.yaziTipiGomulmemis);
  ekle('JS', 'JavaScript / etkin içerik', say.js);
  ekle('SAYDAM', 'Saydamlık (ExtGState alfa / SMask) — PDF/A-1 yasaklar, PDF/A-2 sınırlı izin verir', say.saydam, false);
  ekle('LZW', 'LZW sıkıştırması (PDF/A yasaklar)', say.lzw);
  ekle('EK', 'Gömülü ek dosyalar (PDF/A-2b yasaklar)', say.ek);
  if (!xmpTamam) ekle('XMP', 'PDF/A kimlik üstverisi (XMP “pdfaid”) yok', 1);
  if (!(oi instanceof PDFArray) || oi.size() === 0) ekle('RENK', 'Çıktı niyeti (OutputIntent / renk profili) yok', 1);
  return { sorunlar, uygunGibi: !sorunlar.some((s) => s.onemli), sayfa: doc.getPageCount() };
}

// ---- Dönüştürme ------------------------------------------------------------------------------------------------------------
const xmlKac = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

function xmpPaketi({ baslik, yazar, uretici, tarih }) {
  const t = iso(tarih);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlKac(baslik)}</rdf:li></rdf:Alt></dc:title>${yazar ? `<dc:creator><rdf:Seq><rdf:li>${xmlKac(yazar)}</rdf:li></rdf:Seq></dc:creator>` : ''}</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${xmlKac(uretici)}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>${t}</xmp:CreateDate><xmp:ModifyDate>${t}</xmp:ModifyDate><xmp:MetadataDate>${t}</xmp:MetadataDate></rdf:Description>
</rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

/** @returns {{bayt, sayfa, uyarilar, once:object, sonra:object}} */
export async function pdfaDonustur(bayt, { dpi = 200, bicim = 'jpeg', kalite = 0.9, ilerleme } = {}) {
  const once = await pdfaDenetle(bayt);
  const kaynak = await pdfAc(bayt);
  const belge = await belgeAc(bayt);
  try {
    const cikis = await PDFDocument.create();
    const n = belge.numPages;
    let yaziliSayfa = 0;
    for (let i = 1; i <= n; i++) {
      ilerleme?.(i - 1, n, `Sayfa ${i} dönüştürülüyor…`);
      const parcalar = await sayfaYaziKutulari(belge, i);
      const r = await sayfayiResmeCevir(belge, i, { dpi, bicim, kalite });
      const resim = bicim === 'png' ? await cikis.embedPng(r.bayt) : await cikis.embedJpg(r.bayt);
      const p = cikis.addPage([r.genislik, r.yukseklik]);
      p.drawImage(resim, { x: 0, y: 0, width: r.genislik, height: r.yukseklik });
      if (parcalar.length) { await gorunmezKatmanEkle(cikis, [{ index: i - 1, kelimeler: parcalar }]); yaziliSayfa++; }
    }
    // üstveri (Bilgi sözlüğü ile XMP aynı değerleri taşımalıdır)
    const tarih = new Date(Math.floor(Date.now() / 1000) * 1000);
    const baslik = kaynak.getTitle() || 'PDF/A belge';
    const yazar = kaynak.getAuthor() || '';
    cikis.setTitle(baslik); if (yazar) cikis.setAuthor(yazar);
    cikis.setProducer(URETICI); cikis.setCreationDate(tarih); cikis.setModificationDate(tarih);
    const ctx = cikis.context;
    const xmp = ctx.stream(xmpPaketi({ baslik, yazar, uretici: URETICI, tarih }), { Type: 'Metadata', Subtype: 'XML' });
    cikis.catalog.set(ad('Metadata'), ctx.register(xmp));
    const icc = ctx.stream(srgbIccProfili(), { N: 3, Alternate: 'DeviceRGB' });
    const niyet = ctx.obj({
      Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: PDFString.of('sRGB'), Info: PDFString.of('sRGB uyumlu profil'),
      DestOutputProfile: ctx.register(icc),
    });
    cikis.catalog.set(ad('OutputIntents'), ctx.obj([ctx.register(niyet)]));
    const kimlik = PDFHexString.of([...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join(''));
    ctx.trailerInfo.ID = ctx.obj([kimlik, kimlik]);
    const cikti = new Uint8Array(await cikis.save({ useObjectStreams: false }));
    const sonra = await pdfaDenetle(cikti);
    const uyarilar = [
      'DENEYSEL: Bu çıktı PDF/A-2b’ye yaklaşır ama resmî bir doğrulayıcıyla (ör. veraPDF) SINANMAMIŞTIR; PDF/A uyumlu olduğu garanti edilmez. Kurumsal arşivleme için veraPDF ile doğrulayın.',
      `Tüm sayfalar ${dpi} dpi resme çevrildi; orijinal yazı tipleri/vektör çizimler kalmadı (dosya büyüyebilir). ${yaziliSayfa} sayfada yazı aranabilir görünmez katman olarak korundu.`,
      'Form alanları, yer imleri, bağlantılar, ekler ve dijital imzalar taşınmaz.',
    ];
    if (once.sorunlar.length) uyarilar.push(`Kaynak dosyadaki bilinen PDF/A engelleri: ${once.sorunlar.map((s) => s.ad.split(' (')[0]).join('; ')}.`);
    if (!sonra.uygunGibi) uyarilar.push(`Çıktıda hâlâ sorun görünüyor: ${sonra.sorunlar.map((s) => s.ad).join('; ')}.`);
    return { bayt: cikti, sayfa: n, uyarilar, once, sonra };
  } finally { await belge.kapat(); }
}

export { PdfHatasi };
