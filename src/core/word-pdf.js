// Word (.docx) → PDF. docx'in içindeki XML okunur, paragraf/başlık/liste/tablo/resim/bağlantı modeline çevrilir ve
// genel yerleştirme motoruyla (belge-pdf.js) PDF'e yazılır. Tamamen tarayıcıda; Word ya da başka program gerekmez.
//
// DÜRÜSTLÜK: Bu bir Word işleme motoru DEĞİLDİR; sayfa düzeni Word'ün birebir aynısı olmaz (satır/sayfa sonları kayabilir).
// Desteklenmeyenler sonuçta bildirilir: üst/alt bilgi, dipnot, metin kutusu, şekil/SmartArt/grafik, denklem, yüzen (kayan) resimlerin
// konumu, sütunlu bölümler, değişiklik izleme, alan kodları (içindekiler tablosu eski hâliyle yazılır). Eski .doc desteklenmez.

import { unzipSync, strFromU8 } from 'fflate';
import { xmlAyristir, cocuk, cocuklar, hepsi } from './xml.js';
import { modeldenPdf } from './belge-pdf.js';
import { romaRakami } from './util.js';
import { PdfHatasi } from './hatalar.js';

const TWIP = 1 / 20;
const EMU = 1 / 12700;

export function aileEsle(ad = '') {
  if (/calibri|carlito/i.test(ad)) return 'carlito';
  if (/cambria|caladea/i.test(ad)) return 'caladea';
  if (/courier|consolas|mono|lucida console|menlo/i.test(ad)) return 'liberation-mono';
  if (/times|georgia|garamond|palatino|book antiqua|minion|serif/i.test(ad) && !/sans/i.test(ad)) return 'liberation-serif';
  return 'liberation-sans';
}

const acik = (d) => d && !['0', 'false', 'off', 'none'].includes(String(d.oz['w:val'] ?? 'true').toLowerCase());
const sayi = (v, bol = 1) => (v === undefined || v === null || v === '' ? undefined : Number(v) * bol);

function resimBicimi(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  return null;
}

/** w:rPr → { kalin, italik, altCizgi, boyut, renk, aile } (yalnızca belirtilenler) */
function rPrOku(rPr) {
  const o = {};
  if (!rPr) return o;
  const b = cocuk(rPr, 'w:b'); if (b) o.kalin = acik(b);
  const i = cocuk(rPr, 'w:i'); if (i) o.italik = acik(i);
  const u = cocuk(rPr, 'w:u'); if (u) o.altCizgi = u.oz['w:val'] !== 'none';
  const sz = cocuk(rPr, 'w:sz'); if (sz) o.boyut = sayi(sz.oz['w:val'], 0.5);
  const r = cocuk(rPr, 'w:color'); if (r && /^[0-9a-fA-F]{6}$/.test(r.oz['w:val'] ?? '')) o.renk = `#${r.oz['w:val']}`;
  const f = cocuk(rPr, 'w:rFonts'); if (f) o.aile = aileEsle(f.oz['w:ascii'] ?? f.oz['w:hAnsi'] ?? '');
  const va = cocuk(rPr, 'w:vertAlign'); if (va && /superscript|subscript/.test(va.oz['w:val'])) o.kucult = true;
  return o;
}

function pPrOku(pPr) {
  const o = {};
  if (!pPr) return o;
  const jc = cocuk(pPr, 'w:jc')?.oz['w:val'];
  if (jc) o.hiza = { center: 'orta', right: 'sag', end: 'sag', both: 'iki', distribute: 'iki' }[jc] ?? 'sol';
  const ind = cocuk(pPr, 'w:ind');
  if (ind) {
    o.sol = sayi(ind.oz['w:left'] ?? ind.oz['w:start'], TWIP);
    const fl = sayi(ind.oz['w:firstLine'], TWIP), ha = sayi(ind.oz['w:hanging'], TWIP);
    if (fl !== undefined) o.ilk = fl; else if (ha !== undefined) o.ilk = -ha;
  }
  const sp = cocuk(pPr, 'w:spacing');
  if (sp) { o.once = sayi(sp.oz['w:before'], TWIP); o.sonra = sayi(sp.oz['w:after'], TWIP); }
  const num = cocuk(pPr, 'w:numPr');
  if (num) o.num = { id: cocuk(num, 'w:numId')?.oz['w:val'], seviye: Number(cocuk(num, 'w:ilvl')?.oz['w:val'] ?? 0) };
  if (cocuk(pPr, 'w:pageBreakBefore')) o.sayfaSonuOnce = true;
  if (cocuk(pPr, 'w:keepNext')) o.ustteTut = true;
  const st = cocuk(pPr, 'w:pStyle')?.oz['w:val'];
  if (st) o.stil = st;
  return o;
}

function stilleriOku(z) {
  const harita = new Map();
  let varsayilanR = {};
  if (!z['word/styles.xml']) return { harita, varsayilanR };
  const kok = xmlAyristir(strFromU8(z['word/styles.xml']));
  varsayilanR = rPrOku(cocuk(cocuk(cocuk(kok, 'w:docDefaults'), 'w:rPrDefault'), 'w:rPr'));
  for (const s of cocuklar(kok, 'w:style')) {
    harita.set(s.oz['w:styleId'], {
      ad: cocuk(s, 'w:name')?.oz['w:val'] ?? '', taban: cocuk(s, 'w:basedOn')?.oz['w:val'],
      p: pPrOku(cocuk(s, 'w:pPr')), r: rPrOku(cocuk(s, 'w:rPr')), tur: s.oz['w:type'],
    });
  }
  return { harita, varsayilanR };
}

function stilCoz(harita, id, alan, derinlik = 0) {
  const s = harita.get(id);
  if (!s || derinlik > 8) return {};
  return { ...stilCoz(harita, s.taban, alan, derinlik + 1), ...s[alan] };
}

function numaralandirmaOku(z) {
  const soyut = new Map(), numlar = new Map();
  if (!z['word/numbering.xml']) return { soyut, numlar };
  const kok = xmlAyristir(strFromU8(z['word/numbering.xml']));
  for (const a of cocuklar(kok, 'w:abstractNum')) {
    const seviyeler = {};
    for (const l of cocuklar(a, 'w:lvl')) seviyeler[l.oz['w:ilvl']] = { bicim: cocuk(l, 'w:numFmt')?.oz['w:val'] ?? 'decimal', baslangic: Number(cocuk(l, 'w:start')?.oz['w:val'] ?? 1) };
    soyut.set(a.oz['w:abstractNumId'], seviyeler);
  }
  for (const n of cocuklar(kok, 'w:num')) numlar.set(n.oz['w:numId'], cocuk(n, 'w:abstractNumId')?.oz['w:val']);
  return { soyut, numlar };
}

function isaret(bicim, n) {
  switch (bicim) {
    case 'bullet': return '•';
    case 'lowerLetter': return `${String.fromCharCode(96 + ((n - 1) % 26) + 1)})`;
    case 'upperLetter': return `${String.fromCharCode(64 + ((n - 1) % 26) + 1)}.`;
    case 'lowerRoman': return `${romaRakami(n).toLowerCase()}.`;
    case 'upperRoman': return `${romaRakami(n)}.`;
    case 'none': return '';
    default: return `${n}.`;
  }
}

/**
 * @returns {{bayt:Uint8Array, sayfa:number, uyarilar:string[], bilgi:object}}
 */
export async function wordPdf(bayt, { ilerleme, dosyaAdi = '' } = {}) {
  if (!(bayt[0] === 0x50 && bayt[1] === 0x4b)) {
    throw new PdfHatasi('Bu dosya .docx (Word 2007+) gibi görünmüyor. Eski .doc dosyalarını önce Word’de “Farklı kaydet → .docx” ile kaydedin.');
  }
  let z;
  try { z = unzipSync(bayt); } catch (e) { throw new PdfHatasi(`Word dosyası açılamadı: ${e?.message ?? e}`); }
  if (!z['word/document.xml']) throw new PdfHatasi('Bu dosyada Word belgesi (word/document.xml) bulunamadı.');
  const uyarilar = new Set();
  const doc = xmlAyristir(strFromU8(z['word/document.xml']));
  const govde = cocuk(doc, 'w:body');
  const { harita, varsayilanR } = stilleriOku(z);
  const { soyut, numlar } = numaralandirmaOku(z);
  const iliskiler = new Map();
  if (z['word/_rels/document.xml.rels']) {
    for (const r of cocuklar(xmlAyristir(strFromU8(z['word/_rels/document.xml.rels'])), 'Relationship')) iliskiler.set(r.oz.Id, r.oz);
  }
  const sayaclar = new Map();
  const bilgi = { paragraf: 0, tablo: 0, resim: 0, baslik: 0, madde: 0 };

  // Sayfa
  const sect = cocuk(govde, 'w:sectPr');
  const pg = cocuk(sect, 'w:pgSz'), mar = cocuk(sect, 'w:pgMar');
  const sayfa = {
    genislik: sayi(pg?.oz['w:w'], TWIP) ?? 595.28, yukseklik: sayi(pg?.oz['w:h'], TWIP) ?? 841.89,
    kenar: { ust: Math.max(18, sayi(mar?.oz['w:top'], TWIP) ?? 72), alt: Math.max(18, sayi(mar?.oz['w:bottom'], TWIP) ?? 72), sol: Math.max(18, sayi(mar?.oz['w:left'], TWIP) ?? 72), sag: Math.max(18, sayi(mar?.oz['w:right'], TWIP) ?? 72) },
  };
  if (Object.keys(z).some((d) => /^word\/(header|footer)\d*\.xml$/.test(d))) uyarilar.add('Üst bilgi / alt bilgi (sayfa numaraları dahil) aktarılmadı.');
  if (z['word/footnotes.xml'] && hepsi(xmlAyristir(strFromU8(z['word/footnotes.xml'])), 'w:footnote').length > 2) uyarilar.add('Dipnotlar/sonnotlar aktarılmadı.');

  const gorselOku = (r) => {
    const blip = hepsi(r, 'a:blip')[0];
    const id = blip?.oz['r:embed'];
    const hedef = id ? iliskiler.get(id)?.Target : null;
    if (!hedef) return null;
    const yol = hedef.startsWith('/') ? hedef.slice(1) : `word/${hedef}`.replace(/\/\.\//g, '/');
    const veri = z[yol];
    if (!veri) return null;
    const bicim = resimBicimi(veri);
    if (!bicim) { uyarilar.add('PNG/JPEG dışındaki resimler (GIF, EMF, WMF, WebP…) aktarılmadı.'); return null; }
    const ext = hepsi(r, 'wp:extent')[0];
    const w = ext ? Number(ext.oz.cx) * EMU : 200, h = ext ? Number(ext.oz.cy) * EMU : 150;
    return { tur: 'resim', bayt: veri, bicim, w, h };
  };

  /** w:p → bloklar (metin paragrafı + araya giren resimler) */
  const paragrafCevir = (p) => {
    const pp = pPrOku(cocuk(p, 'w:pPr'));
    const stilP = stilCoz(harita, pp.stil, 'p'), stilR = stilCoz(harita, pp.stil, 'r');
    const efP = { ...stilP, ...pp };
    const stilAdi = (harita.get(pp.stil)?.ad ?? pp.stil ?? '').toLowerCase();
    const baslikM = /^(?:heading|başlık)\s*(\d)/.exec(stilAdi) ?? (stilAdi === 'title' ? [null, '1'] : null);
    const baslik = baslikM ? Math.min(6, Number(baslikM[1])) : 0;
    const bloklar = [];
    let parcalar = [];
    let sayfaSonuOnce = efP.sayfaSonuOnce;
    const baz = { ...varsayilanR, ...stilR };
    const boyutVarsayilan = baslik ? [0, 20, 16, 14, 12, 11, 11][baslik] : 11;

    const akit = () => {
      if (!parcalar.length && !bloklar.some((b) => b.tur === 'p') && bloklar.length) return;
      let madde;
      if (efP.num && efP.num.id !== '0') {
        const a = soyut.get(numlar.get(efP.num.id)) ?? {};
        const sv = a[String(efP.num.seviye)] ?? { bicim: 'decimal', baslangic: 1 };
        const anahtar = `${efP.num.id}`;
        const c = sayaclar.get(anahtar) ?? {};
        c[efP.num.seviye] = (c[efP.num.seviye] ?? sv.baslangic - 1) + 1;
        for (const k of Object.keys(c)) if (Number(k) > efP.num.seviye) delete c[k];
        sayaclar.set(anahtar, c);
        madde = isaret(sv.bicim, c[efP.num.seviye]);
        if (sv.bicim === 'bullet' && efP.num.seviye > 0) madde = '–';
        bilgi.madde++;
      }
      const sol = efP.sol ?? (madde ? 18 * (efP.num.seviye + 1) : 0);
      bloklar.push({
        tur: 'p', parcalar, hiza: efP.hiza ?? 'sol', girinti: madde ? Math.max(0, sol - 18) : Math.max(0, sol),
        ilkSatirGirinti: madde ? 0 : Math.max(-sol, efP.ilk ?? 0), once: efP.once ?? 0, sonra: efP.sonra ?? 6,
        madde: madde || undefined, baslik: baslik || undefined, sayfaSonuOnce, ustteTut: efP.ustteTut,
      });
      if (baslik) bilgi.baslik++;
      bilgi.paragraf++;
      sayfaSonuOnce = false;
      parcalar = [];
    };

    const kosu = (r, url, ekRpr = {}) => {
      const rp = rPrOku(cocuk(r, 'w:rPr'));
      const stilRun = rp; // karakter stili (w:rStyle) basit tutuldu
      const ef = { ...baz, ...ekRpr, ...stilRun };
      const boyut = (ef.boyut ?? boyutVarsayilan) * (ef.kucult ? 0.7 : 1);
      const bicim = { kalin: baslik ? ef.kalin !== false : !!ef.kalin, italik: !!ef.italik, altCizgi: !!ef.altCizgi, boyut: baslik && !ef.boyut ? boyutVarsayilan : boyut, renk: ef.renk, aile: ef.aile ?? 'liberation-sans', url };
      for (const c of r.cocuk) {
        if (c.ad === 'w:t') parcalar.push({ ...bicim, metin: c.metin });
        else if (c.ad === 'w:tab') parcalar.push({ ...bicim, metin: '\t' });
        else if (c.ad === 'w:noBreakHyphen') parcalar.push({ ...bicim, metin: '-' });
        else if (c.ad === 'w:br' || c.ad === 'w:cr') {
          if (c.oz['w:type'] === 'page') { akit(); sayfaSonuOnce = true; if (!bloklar.length || bloklar.at(-1).tur === 'p') bloklar.push({ tur: 'sayfaSonu' }); } else parcalar.push({ kes: true, boyut: bicim.boyut });
        } else if (c.ad === 'w:drawing' || c.ad === 'w:pict' || c.ad === 'mc:AlternateContent') {
          const g = gorselOku(c.ad === 'mc:AlternateContent' ? (cocuk(c, 'mc:Choice') ?? c) : c);
          if (g) { akit(); bloklar.push(g); bilgi.resim++; }
          else if (hepsi(c, 'w:txbxContent').length) uyarilar.add('Metin kutularındaki yazılar aktarılmadı.');
          else if (!hepsi(c, 'a:blip').length) uyarilar.add('Şekiller, grafikler ve SmartArt nesneleri aktarılmadı.');
        }
      }
    };

    const gez = (dugum, url) => {
      for (const c of dugum.cocuk) {
        if (c.ad === 'w:r') kosu(c, url);
        else if (c.ad === 'w:hyperlink') {
          const id = c.oz['r:id'];
          const ham = id ? iliskiler.get(id)?.Target : null;
          const adres = ham && /^(https?:|mailto:)/i.test(ham) ? ham : undefined;
          gez(c, adres ?? url);
        } else if (['w:ins', 'w:smartTag', 'w:fldSimple', 'w:sdt', 'w:sdtContent', 'w:customXml'].includes(c.ad)) gez(c, url);
        else if (c.ad === 'w:oMath' || c.ad === 'm:oMath' || c.ad === 'm:oMathPara') uyarilar.add('Denklemler aktarılmadı.');
      }
    };
    gez(p, undefined);
    akit();
    return bloklar.filter((b, i, d) => !(b.tur === 'p' && !b.parcalar.length && i < d.length - 1 && d[i + 1].tur === 'resim'));
  };

  const tabloCevir = (t) => {
    const izgara = cocuklar(cocuk(t, 'w:tblGrid'), 'w:gridCol').map((g) => Number(g.oz['w:w'] ?? 1));
    const satirlar = [];
    for (const tr of cocuklar(t, 'w:tr')) {
      const hucreler = [];
      const baslik = !!cocuk(cocuk(tr, 'w:trPr'), 'w:tblHeader');
      for (const tc of cocuklar(tr, 'w:tc')) {
        const tcPr = cocuk(tc, 'w:tcPr');
        const bs = Number(cocuk(tcPr, 'w:gridSpan')?.oz['w:val'] ?? 1);
        const fill = cocuk(tcPr, 'w:shd')?.oz['w:fill'];
        const bl = [];
        for (const c of tc.cocuk) {
          if (c.ad === 'w:p') bl.push(...paragrafCevir(c).filter((b) => b.tur === 'p').map((b) => ({ ...b, sonra: Math.min(b.sonra ?? 0, 2), once: 0 })));
          else if (c.ad === 'w:tbl') uyarilar.add('İç içe tablolar düz metne çevrildi.');
        }
        hucreler.push({ bloklar: bl.length ? bl : [{ tur: 'p', parcalar: [] }], birlesim: bs, baslik, dolgu: fill && /^[0-9a-fA-F]{6}$/.test(fill) ? `#${fill}` : null });
      }
      if (hucreler.length) satirlar.push(hucreler);
    }
    if (hepsi(t, 'w:vMerge').length) uyarilar.add('Dikey birleştirilmiş tablo hücreleri tam yansıtılamadı.');
    bilgi.tablo++;
    return { tur: 'tablo', kolonlar: izgara.length ? izgara : undefined, satirlar, boyut: 10, kenarlik: true };
  };

  const bloklar = [];
  const dugumler = govde?.cocuk ?? [];
  dugumler.forEach((c, i) => {
    if (i % 100 === 0) ilerleme?.(i, dugumler.length, 'Word belgesi okunuyor…');
    if (c.ad === 'w:p') bloklar.push(...paragrafCevir(c));
    else if (c.ad === 'w:tbl') bloklar.push(tabloCevir(c));
    else if (c.ad === 'w:sdt') for (const p of hepsi(c, 'w:p')) bloklar.push(...paragrafCevir(p));
  });
  if (!bloklar.length) throw new PdfHatasi('Word belgesinde aktarılabilir içerik bulunamadı.');
  if (hepsi(cocuk(govde, 'w:sectPr') ?? { cocuk: [] }, 'w:cols').some((c) => Number(c.oz['w:num'] ?? 1) > 1)) uyarilar.add('Sütunlu bölümler tek sütun olarak yerleştirildi.');

  const r = await modeldenPdf({ sayfa, baslik: dosyaAdi.replace(/\.docx$/i, ''), bloklar }, { ilerleme });
  r.uyarilar.forEach((u) => uyarilar.add(u));
  return {
    bayt: r.bayt, sayfa: r.sayfa, bilgi,
    uyarilar: ['Sayfa düzeni Word’ün birebir aynısı olmaz: satır ve sayfa sonları, yazı tipi ölçüleri farklı olabilir (Calibri→Carlito, Cambria→Caladea, Arial→Liberation Sans gibi ölçü uyumlu yazı tipleri kullanılır). Sonucu kontrol edin.', ...uyarilar],
  };
}
