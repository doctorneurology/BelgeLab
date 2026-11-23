// PDF yazı tiplerini çözer: bayt kodlarını karakterlere (Unicode) ve genişliklere çevirir,
// orijinal yazı tipinin adına/özelliklerine bakarak ölçü uyumlu açık karşılığını önerir.

import { PDFName, PDFDict, PDFArray, PDFNumber, PDFRawStream, PDFStream, PDFRef, decodePDFRawStream } from 'pdf-lib';
import { Font as StdFont, FontNames, Encodings } from '@pdf-lib/standard-fonts';

const ad = (s) => PDFName.of(s);
const latin1 = new TextDecoder('latin1');

// ---- Glif adı → Unicode ---------------------------------------------------------------------------
const GLIF = new Map();
for (const enc of [Encodings.WinAnsi, Encodings.Symbol]) {
  for (const [cp, [, isim]] of Object.entries(enc.unicodeMappings)) if (!GLIF.has(isim)) GLIF.set(isim, String.fromCodePoint(Number(cp)));
}
Object.entries({
  gbreve: 'ğ', Gbreve: 'Ğ', scedilla: 'ş', Scedilla: 'Ş', dotlessi: 'ı', Idotaccent: 'İ', Idot: 'İ',
  scommaaccent: 'ș', Scommaaccent: 'Ș', fi: 'ﬁ', fl: 'ﬂ', ff: 'ﬀ', ffi: 'ﬃ', ffl: 'ﬄ',
  acircumflex: 'â', icircumflex: 'î', ucircumflex: 'û', Acircumflex: 'Â', Icircumflex: 'Î', Ucircumflex: 'Û',
  minus: '−', nbspace: ' ', sfthyphen: '­', hyphen: '-', space: ' ', periodcentered: '·',
  quoteleft: '‘', quoteright: '’', quotedblleft: '“', quotedblright: '”', endash: '–', emdash: '—', bullet: '•',
  ellipsis: '…', dagger: '†', daggerdbl: '‡', trademark: '™', fraction: '⁄', Euro: '€', ring: '˚',
}).forEach(([k, v]) => GLIF.set(k, v));

export function glifAdiUnicode(isim) {
  if (!isim) return null;
  if (GLIF.has(isim)) return GLIF.get(isim);
  const temel = isim.split('.')[0].split('_');
  if (temel.length > 1) { // f_i gibi bitişik harfler
    const p = temel.map(glifAdiUnicode);
    return p.every(Boolean) ? p.join('') : null;
  }
  let m = /^uni([0-9A-Fa-f]{4,})$/.exec(temel[0]);
  if (m && m[1].length % 4 === 0) {
    let s = '';
    for (let k = 0; k < m[1].length; k += 4) s += String.fromCharCode(parseInt(m[1].slice(k, k + 4), 16));
    return s;
  }
  m = /^u([0-9A-Fa-f]{4,6})$/.exec(temel[0]);
  if (m) return String.fromCodePoint(parseInt(m[1], 16));
  if (temel[0] !== isim) return glifAdiUnicode(temel[0]);
  return null;
}

// ---- Temel kodlamalar ----------------------------------------------------------------------------
function tabloKur(decoderAdi) {
  const d = new TextDecoder(decoderAdi);
  const t = new Array(256).fill(null);
  for (let k = 32; k < 256; k++) {
    const s = d.decode(Uint8Array.of(k));
    if (s !== '�' && !(decoderAdi === 'windows-1252' && [0x81, 0x8d, 0x8f, 0x90, 0x9d].includes(k))) t[k] = s;
  }
  return t;
}
const WIN = tabloKur('windows-1252');
const MAC = tabloKur('macintosh');
const STD = WIN.map((s, k) => (k < 127 ? s : null));
STD[0x27] = '’'; STD[0x60] = '‘';
const TEMEL = { WinAnsiEncoding: WIN, MacRomanEncoding: MAC, StandardEncoding: STD, PDFDocEncoding: WIN };

// Kodlama tablosundaki kod → glif adı (standart 14 yazı tipi genişliği için)
const WIN_AD = new Array(256).fill(null);
for (const [cp, [kod, isim]] of Object.entries(Encodings.WinAnsi.unicodeMappings)) if (kod < 256 && !WIN_AD[kod]) WIN_AD[kod] = isim;

// ---- ToUnicode CMap ------------------------------------------------------------------------------
function utf16be(b) {
  let s = '';
  for (let k = 0; k + 1 < b.length; k += 2) s += String.fromCharCode((b[k] << 8) | b[k + 1]);
  return s;
}
function hexBayt(h) {
  const t = h.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.ceil(t.length / 2));
  for (let k = 0; k < out.length; k++) out[k] = parseInt(t.substr(k * 2, 2).padEnd(2, '0'), 16);
  return out;
}
const baytSayi = (b) => b.reduce((v, x) => v * 256 + x, 0);

/** ToUnicode / gömülü CMap metnini çözer. */
export function cmapCoz(metin) {
  const harita = new Map(); // "uzunluk:kod" → unicode
  const kodAlani = []; // {uz, alt, ust}
  const cid = []; // {uz, alt, ust, cid}
  let m;
  const bolumler = (bas, son) => {
    const re = new RegExp(`begin${bas}([\\s\\S]*?)end${son}`, 'g');
    const r = [];
    while ((m = re.exec(metin))) r.push(m[1]);
    return r;
  };
  for (const blok of bolumler('codespacerange', 'codespacerange')) {
    const re = /<([0-9a-fA-F\s]*)>\s*<([0-9a-fA-F\s]*)>/g;
    while ((m = re.exec(blok))) {
      const a = hexBayt(m[1]), b = hexBayt(m[2]);
      kodAlani.push({ uz: a.length, alt: a, ust: b });
    }
  }
  for (const blok of bolumler('bfchar', 'bfchar')) {
    const re = /<([0-9a-fA-F\s]*)>\s*(<[0-9a-fA-F\s]*>|\/[^\s<>[\]/]+)/g;
    while ((m = re.exec(blok))) {
      const k = hexBayt(m[1]);
      const hedef = m[2].startsWith('/') ? glifAdiUnicode(m[2].slice(1)) : utf16be(hexBayt(m[2].slice(1, -1)));
      if (hedef != null) harita.set(`${k.length}:${baytSayi(k)}`, hedef);
    }
  }
  for (const blok of bolumler('bfrange', 'bfrange')) {
    const re = /<([0-9a-fA-F\s]*)>\s*<([0-9a-fA-F\s]*)>\s*(<[0-9a-fA-F\s]*>|\[[^\]]*\])/g;
    while ((m = re.exec(blok))) {
      const a = hexBayt(m[1]), b = hexBayt(m[2]);
      const uz = a.length, alt = baytSayi(a), ust = baytSayi(b);
      if (ust - alt > 65535 || ust < alt) continue;
      if (m[3].startsWith('[')) {
        const ogeler = [...m[3].matchAll(/<([0-9a-fA-F\s]*)>/g)].map((x) => utf16be(hexBayt(x[1])));
        for (let k = 0; k <= ust - alt && k < ogeler.length; k++) harita.set(`${uz}:${alt + k}`, ogeler[k]);
      } else {
        const h = hexBayt(m[3].slice(1, -1));
        for (let k = 0; k <= ust - alt; k++) {
          const hh = h.slice();
          let tasima = k;
          for (let j = hh.length - 1; j >= 0 && tasima; j--) { const t = hh[j] + tasima; hh[j] = t & 255; tasima = t >> 8; }
          harita.set(`${uz}:${alt + k}`, utf16be(hh));
        }
      }
    }
  }
  for (const blok of bolumler('cidrange', 'cidrange')) {
    const re = /<([0-9a-fA-F\s]*)>\s*<([0-9a-fA-F\s]*)>\s*(\d+)/g;
    while ((m = re.exec(blok))) {
      const a = hexBayt(m[1]), b = hexBayt(m[2]);
      cid.push({ uz: a.length, alt: baytSayi(a), ust: baytSayi(b), cid: Number(m[3]) });
    }
  }
  for (const blok of bolumler('cidchar', 'cidchar')) {
    const re = /<([0-9a-fA-F\s]*)>\s*(\d+)/g;
    while ((m = re.exec(blok))) {
      const a = hexBayt(m[1]);
      cid.push({ uz: a.length, alt: baytSayi(a), ust: baytSayi(a), cid: Number(m[2]) });
    }
  }
  const usecmap = /\/([^\s/]+)\s+usecmap/.exec(metin)?.[1] ?? null;
  return { harita, kodAlani, cid, usecmap };
}

function akisMetni(nesne) {
  try {
    if (nesne instanceof PDFRawStream) return latin1.decode(decodePDFRawStream(nesne).decode());
    if (nesne instanceof PDFStream) return latin1.decode(nesne.getContents());
  } catch { /* çözülemedi */ }
  return null;
}

// ---- Yazı tipi eşleme ------------------------------------------------------------------------------
const SUSLU = /script|brush|hand(writ)?|comic|zapf|dingbat|wingding|webding|symbol|ornament|decor|fraktur|blackletter|calligra|vivaldi|edwardian|corsiva|mistral|pacifico|lobster|kunstler|chiller|jokerman|curlz|magneto|old ?english|bauhaus|stencil|impact|cmsy|cmmi|cmex|msam|msbm|math|mt ?extra|euclid|marlett|segoe ?ui ?(emoji|symbol)|emoji|icon|awesome/i;

const ESLEME = [
  [/times|tnr|liberationserif|tinos|nimbusrom|thorndale/i, 'liberation-serif'],
  [/arial|helvetica|liberationsans|arimo|nimbussan|albany/i, 'liberation-sans'],
  [/calibri|carlito/i, 'carlito'],
  [/cambria|caladea/i, 'caladea'],
  [/courier|liberationmono|cousine|nimbusmon|consolas|lucidaconsole|mono/i, 'liberation-mono'],
  [/notoserif/i, 'noto-serif'],
  [/notosans|opensans/i, 'noto-sans'],
];
// Tanınan ama ölçü uyumlu karşılığı olmayan; en yakın aile
const YAKIN = [
  [/georgia|garamond|minion|palatino|bookantiqua|book ?man|century|baskerville|caslon|bodoni|cmr|lmroman|sabon|utopia|charter|plantin|stix|cochin|didot|serif|roman|adv(ot|tt)?(?=.*(?:serif|times))/i, 'liberation-serif'],
  [/verdana|tahoma|segoe|trebuchet|myriad|frutiger|univers|futura|gill|dejavusans|roboto|lato|source ?sans|franklin|gotham|avenir|helv|sans|lucida|optima|candara|corbel|gothic/i, 'liberation-sans'],
];

export function yaziTipiAdi(f) {
  return (f.temelAd || '').replace(/^[A-Z]{6}\+/, '');
}

/** Orijinal yazı tipine en uygun aile ve kalın/italik bilgisi. */
export function aileOner(f) {
  const isim = yaziTipiAdi(f);
  const sade = isim.replace(/[\s_-]/g, '');
  let aile = null, tanindi = 'olcu';
  // Dar / ince / farklı kesimler ölçü uyumlu sayılmaz (ör. Helvetica Neue Condensed ≠ Arial)
  const farkliKesim = /cond|narrow|compress|neue|light|thin|medium|black|heavy|semi|demi|extra|ultra|book|wide|expand/i.test(sade);
  if (!farkliKesim) for (const [re, a] of ESLEME) if (re.test(sade)) { aile = a; break; }
  if (!aile && farkliKesim) for (const [re, a] of ESLEME) if (re.test(sade)) { aile = a; tanindi = 'yakin'; break; }
  if (!aile) {
    tanindi = 'yakin';
    for (const [re, a] of YAKIN) if (re.test(sade)) { aile = a; break; }
  }
  if (!aile) {
    tanindi = 'tahmin';
    aile = f.bayrak & 1 ? 'liberation-mono' : f.bayrak & 2 ? 'liberation-serif' : 'liberation-sans';
  }
  const kalin = /bold|black|heavy|semibold|demi|bd\b|\.b$/i.test(isim) || (f.agirlik ?? 0) >= 600 || !!(f.bayrak & (1 << 18));
  const italik = /italic|oblique|obl\b|obl$|,it\b|-it\b|\.i$|ital$/i.test(isim) || (f.italikAci ?? 0) !== 0 || !!(f.bayrak & 64);
  return { aile, kalin, italik, tanindi };
}

// ---- Yazı tipi nesnesi -----------------------------------------------------------------------------
function std14Bul(isim) {
  const s = isim.replace(/^[A-Z]{6}\+/, '').replace(/[\s]/g, '');
  const kalin = /bold/i.test(s), ital = /italic|oblique/i.test(s);
  let temel = null;
  if (/^(helvetica|arial)/i.test(s)) temel = 'Helvetica';
  else if (/^times/i.test(s)) temel = 'Times';
  else if (/^courier/i.test(s)) temel = 'Courier';
  else if (/^symbol/i.test(s)) return StdFont.load(FontNames.Symbol);
  else if (/^zapf/i.test(s)) return StdFont.load(FontNames.ZapfDingbats);
  if (!temel) return null;
  const adlar = {
    Helvetica: [FontNames.Helvetica, FontNames.HelveticaBold, FontNames.HelveticaOblique, FontNames.HelveticaBoldOblique],
    Times: [FontNames.TimesRoman, FontNames.TimesRomanBold, FontNames.TimesRomanItalic, FontNames.TimesRomanBoldItalic],
    Courier: [FontNames.Courier, FontNames.CourierBold, FontNames.CourierOblique, FontNames.CourierBoldOblique],
  }[temel];
  return StdFont.load(adlar[(kalin ? 1 : 0) + (ital ? 2 : 0)]);
}

const num = (ctx, v, vars = 0) => {
  const x = ctx.lookup(v);
  return x instanceof PDFNumber ? x.asNumber() : vars;
};

/**
 * Bir yazı tipi sözlüğünü çözer.
 * @returns {{tur, temelAd, kodla(bayt):{kod,uz,uni,w,bosluk}[], sorun:string|null, ...}}
 */
export function yaziTipiCoz(ctx, sozluk) {
  const d = ctx.lookup(sozluk);
  const f = {
    tur: '?', temelAd: '', sorun: null, dikey: false, type3: false, bayrak: 0, agirlik: 0, italikAci: 0,
    uniHarita: null, kodla: null, cokBayt: false, anahtar: sozluk instanceof PDFRef ? sozluk.tag : null,
  };
  if (!(d instanceof PDFDict)) { f.sorun = 'Yazı tipi okunamadı'; f.kodla = () => []; return f; }
  f.tur = d.get(ad('Subtype'))?.decodeText?.() ?? '?';
  const bf = d.lookup(ad('BaseFont'));
  f.temelAd = bf instanceof PDFName ? bf.decodeText() : '';

  let tanim = d.lookup(ad('FontDescriptor'));
  let cidFont = null;
  if (f.tur === 'Type0') {
    const alt = d.lookup(ad('DescendantFonts'));
    cidFont = alt instanceof PDFArray ? ctx.lookup(alt.get(0)) : null;
    if (cidFont instanceof PDFDict) tanim = cidFont.lookup(ad('FontDescriptor'));
  }
  if (tanim instanceof PDFDict) {
    f.bayrak = num(ctx, tanim.get(ad('Flags')));
    f.agirlik = num(ctx, tanim.get(ad('FontWeight')));
    f.italikAci = num(ctx, tanim.get(ad('ItalicAngle')));
    const ff = tanim.lookup(ad('FontName'));
    if (!f.temelAd && ff instanceof PDFName) f.temelAd = ff.decodeText();
    f.gomulu = ['FontFile', 'FontFile2', 'FontFile3'].some((k) => tanim.has(ad(k)));
    f.eksikGen = num(ctx, tanim.get(ad('MissingWidth')));
  }

  const tu = d.lookup(ad('ToUnicode'));
  let tuCmap = null;
  if (tu instanceof PDFStream) {
    const m = akisMetni(tu);
    if (m) tuCmap = cmapCoz(m);
  }

  if (f.tur === 'Type3') { f.type3 = true; f.sorun = 'Çizimle oluşturulmuş (Type3) yazı tipi'; }

  if (f.tur === 'Type0') {
    f.cokBayt = true;
    const enc = d.lookup(ad('Encoding'));
    let kodAlani = [{ uz: 2 }];
    let cidBul = (kod) => kod;
    if (enc instanceof PDFName) {
      const e = enc.decodeText();
      if (e === 'Identity-V') f.dikey = true;
      else if (e !== 'Identity-H') f.sorun = `Desteklenmeyen karakter kodlaması (${e})`;
    } else if (enc instanceof PDFStream) {
      const c = akisMetni(enc) ? cmapCoz(akisMetni(enc)) : null;
      if (!c || !c.kodAlani.length || c.usecmap) f.sorun = 'Desteklenmeyen gömülü karakter kodlaması';
      else {
        kodAlani = c.kodAlani;
        cidBul = (kod, uz) => {
          for (const r of c.cid) if (r.uz === uz && kod >= r.alt && kod <= r.ust) return r.cid + (kod - r.alt);
          return 0;
        };
        if (/-V$/.test(enc.dict.lookup(ad('CMapName'))?.decodeText?.() ?? '')) f.dikey = true;
      }
    } else f.sorun = 'Karakter kodlaması belirsiz';
    if (f.dikey) f.sorun = 'Dikey yazı';

    // Genişlikler (W, DW)
    const gen = new Map();
    let dw = 1000;
    if (cidFont instanceof PDFDict) {
      dw = num(ctx, cidFont.get(ad('DW')), 1000);
      const W = cidFont.lookup(ad('W'));
      if (W instanceof PDFArray) {
        const a = W.asArray().map((x) => ctx.lookup(x));
        for (let k = 0; k < a.length;) {
          const bas = a[k] instanceof PDFNumber ? a[k].asNumber() : 0;
          if (a[k + 1] instanceof PDFArray) {
            a[k + 1].asArray().forEach((x, j) => gen.set(bas + j, num(ctx, x)));
            k += 2;
          } else {
            const son = a[k + 1] instanceof PDFNumber ? a[k + 1].asNumber() : bas;
            const w = num(ctx, a[k + 2]);
            for (let c = bas; c <= son && c - bas < 65536; c++) gen.set(c, w);
            k += 3;
          }
        }
      }
    }
    const tuUz = (kod, uz) => tuCmap?.harita.get(`${uz}:${kod}`) ?? null;
    f.kodla = (b) => {
      const sonuc = [];
      for (let i = 0; i < b.length;) {
        let uz = 0;
        for (const r of kodAlani) {
          if (!r.alt) { uz = r.uz; break; }
          if (i + r.uz > b.length) continue;
          let uyar = true;
          for (let j = 0; j < r.uz; j++) if (b[i + j] < r.alt[j] || b[i + j] > r.ust[j]) { uyar = false; break; }
          if (uyar) { uz = r.uz; break; }
        }
        if (!uz) uz = Math.min(2, b.length - i);
        const kod = baytSayi(b.subarray(i, i + uz));
        const c = cidBul(kod, uz);
        sonuc.push({ kod, uz, uni: tuUz(kod, uz), w: gen.has(c) ? gen.get(c) : dw, bosluk: false });
        i += uz;
      }
      return sonuc;
    };
    return f;
  }

  // Basit yazı tipleri (Type1, TrueType, Type3)
  const ilk = num(ctx, d.get(ad('FirstChar')));
  const Wd = d.lookup(ad('Widths'));
  const gen = Wd instanceof PDFArray ? Wd.asArray().map((x) => num(ctx, x)) : null;
  let fm = 0.001;
  if (f.type3) {
    const M = d.lookup(ad('FontMatrix'));
    if (M instanceof PDFArray) fm = num(ctx, M.get(0), 0.001);
  }
  const std = gen ? null : std14Bul(f.temelAd);
  if (!gen && !std && !f.type3) f.sorun = f.sorun ?? 'Karakter genişlikleri bilinmiyor';

  // Kodlama → glif adları ve Unicode
  const kodAd = new Array(256).fill(null);
  let temelTablo = null;
  const enc = d.lookup(ad('Encoding'));
  const sembolik = !!(f.bayrak & 4);
  if (enc instanceof PDFName) temelTablo = TEMEL[enc.decodeText()] ?? null;
  else if (enc instanceof PDFDict) {
    const be = enc.lookup(ad('BaseEncoding'));
    if (be instanceof PDFName) temelTablo = TEMEL[be.decodeText()] ?? null;
    const fark = enc.lookup(ad('Differences'));
    if (fark instanceof PDFArray) {
      let kod = 0;
      for (const x0 of fark.asArray()) {
        const x = ctx.lookup(x0);
        if (x instanceof PDFNumber) kod = x.asNumber();
        else if (x instanceof PDFName && kod < 256) kodAd[kod++] = x.decodeText();
      }
    }
  }
  if (!temelTablo && !(f.tur === 'TrueType' && sembolik)) temelTablo = f.tur === 'Type1' && f.gomulu ? STD : WIN;
  if (std && std.FontName === 'Symbol') temelTablo = null;

  const uniKod = new Array(256).fill(null);
  for (let k = 0; k < 256; k++) {
    const t = tuCmap?.harita.get(`1:${k}`) ?? null;
    if (t != null) uniKod[k] = t;
    else if (kodAd[k]) uniKod[k] = glifAdiUnicode(kodAd[k]);
    else if (temelTablo) uniKod[k] = temelTablo[k];
  }
  const stdGen = (k) => {
    const isim = kodAd[k] ?? (std?.FontName === 'Symbol' ? null : WIN_AD[k]);
    try { return isim ? std.getWidthOfGlyph(isim) ?? 0 : 0; } catch { return 0; }
  };
  f.kodla = (b) => {
    const sonuc = [];
    for (let i = 0; i < b.length; i++) {
      const k = b[i];
      let w;
      if (gen) w = k >= ilk && k - ilk < gen.length ? gen[k - ilk] : (f.eksikGen ?? 0);
      else if (std) w = stdGen(k);
      else w = 0;
      if (f.type3) w = w * fm * 1000;
      sonuc.push({ kod: k, uz: 1, uni: uniKod[k], w, bosluk: k === 32 });
    }
    return sonuc;
  };
  return f;
}

export { PDFRawStream };
