import fontkit from '@pdf-lib/fontkit';
import { PdfHatasi } from './hatalar.js';

/**
 * Projeye eklenen, açık lisanslı (SIL OFL 1.1) ve ölçü uyumlu yazı tipleri.
 * Dosyalar public/fonts/<klasor>/ altındadır; lisans dosyaları yanlarındadır.
 */
export const YAZI_AILELERI = {
  'liberation-sans': { ad: 'Liberation Sans', benzer: 'Arial ile ölçü uyumlu', klasor: 'liberation-sans', onek: 'LiberationSans' },
  'liberation-serif': { ad: 'Liberation Serif', benzer: 'Times New Roman ile ölçü uyumlu', klasor: 'liberation-serif', onek: 'LiberationSerif' },
  'liberation-mono': { ad: 'Liberation Mono', benzer: 'Courier New ile ölçü uyumlu', klasor: 'liberation-mono', onek: 'LiberationMono' },
  carlito: { ad: 'Carlito', benzer: 'Calibri ile ölçü uyumlu', klasor: 'carlito', onek: 'Carlito' },
  caladea: { ad: 'Caladea', benzer: 'Cambria ile ölçü uyumlu', klasor: 'caladea', onek: 'Caladea' },
  'noto-sans': { ad: 'Noto Sans', benzer: 'Geniş karakter desteği', klasor: 'noto-sans', onek: 'NotoSans' },
  'noto-serif': { ad: 'Noto Serif', benzer: 'Geniş karakter desteği (tırnaklı)', klasor: 'noto-serif', onek: 'NotoSerif' },
};

export const VARSAYILAN_AILE = 'liberation-sans';
export const TURKCE_HARFLER = 'ğĞşŞıİöÖüÜçÇâîûÂÎÛ';

export function stilSonEki({ kalin = false, italik = false } = {}) {
  if (kalin && italik) return 'BoldItalic';
  if (kalin) return 'Bold';
  if (italik) return 'Italic';
  return 'Regular';
}

function dosyaYolu(aile, stil) {
  const a = YAZI_AILELERI[aile];
  if (!a) throw new PdfHatasi(`Bilinmeyen yazı tipi: ${aile}`);
  return `${a.klasor}/${a.onek}-${stilSonEki(stil)}.ttf`;
}

let ozelYukleyici = null;
/** Testler/araçlar için yazı tipi okuma yöntemini değiştirir. fn(göreliYol) → Uint8Array */
export function yaziTipiYukleyiciAyarla(fn) {
  ozelYukleyici = fn;
}

async function varsayilanYukle(yol) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Node (testler, komut satırı araçları): diskten oku.
    const modul = 'node:fs/promises';
    const { readFile } = await import(/* @vite-ignore */ modul);
    const b = await readFile(new URL(`../../public/fonts/${yol}`, import.meta.url));
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const yanit = await fetch(new URL(`fonts/${yol}`, document.baseURI));
  if (!yanit.ok) throw new PdfHatasi(`Yazı tipi yüklenemedi (${yol}).`);
  return new Uint8Array(await yanit.arrayBuffer());
}

const bayt_onbellek = new Map();
export async function yaziTipiBaytlari(aile, stil = {}) {
  const yol = dosyaYolu(aile, stil);
  if (!bayt_onbellek.has(yol)) {
    bayt_onbellek.set(yol, (async () => (ozelYukleyici ?? varsayilanYukle)(yol))());
  }
  try {
    return await bayt_onbellek.get(yol);
  } catch (e) {
    bayt_onbellek.delete(yol);
    throw e;
  }
}

const fontkit_onbellek = new WeakMap();
async function fontkitNesnesi(aile, stil) {
  const bayt = await yaziTipiBaytlari(aile, stil);
  if (!fontkit_onbellek.has(bayt)) fontkit_onbellek.set(bayt, fontkit.create(bayt));
  return fontkit_onbellek.get(bayt);
}

/**
 * Yazı tipini PDF'e gömmeden ölçmek için: genislik(metin) → 1/1000 em cinsinden (pdf-lib'in
 * widthOfTextAtSize hesabıyla aynı yöntem), eksik(metin) → yazı tipinde olmayan karakterler.
 */
export async function yaziTipiOlcer(aile, stil = {}) {
  const f = await fontkitNesnesi(aile, stil);
  const olcek = 1000 / f.unitsPerEm;
  const onbellek = new Map();
  return {
    genislik(metin) {
      if (!onbellek.has(metin)) {
        const { glyphs } = f.layout(metin);
        let t = 0;
        for (const g of glyphs) t += g.advanceWidth;
        onbellek.set(metin, t * olcek);
      }
      return onbellek.get(metin);
    },
    eksik(metin) {
      const e = [];
      for (const ch of String(metin)) {
        if (ch === ' ' || ch === ' ') continue;
        if (!f.hasGlyphForCodePoint(ch.codePointAt(0))) e.push(ch);
      }
      return e;
    },
  };
}

/** Metindeki, bu yazı tipinde bulunmayan karakterlerin listesi. */
export async function eksikKarakterler(aile, stil, metin) {
  const f = await fontkitNesnesi(aile, stil);
  const eksik = new Set();
  for (const ch of String(metin)) {
    if (ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ') continue;
    if (!f.hasGlyphForCodePoint(ch.codePointAt(0))) eksik.add(ch);
  }
  return [...eksik];
}

const gomulu = new WeakMap();
/** PDF belgesine yazı tipini (alt küme olarak) gömer; aynı belgede tekrar gömmez. */
export async function yaziTipiGom(doc, aile = VARSAYILAN_AILE, stil = {}) {
  doc.registerFontkit(fontkit);
  if (!gomulu.has(doc)) gomulu.set(doc, new Map());
  const harita = gomulu.get(doc);
  const anahtar = dosyaYolu(aile, stil);
  if (!harita.has(anahtar)) {
    const bayt = await yaziTipiBaytlari(aile, stil);
    harita.set(anahtar, await doc.embedFont(bayt, { subset: true }));
  }
  return harita.get(anahtar);
}

/** Metin bu yazı tipinde çizilemiyorsa anlaşılır bir hata verir (sessizce bozmaz). */
export async function metniDogrula(aile, stil, metin) {
  const eksik = await eksikKarakterler(aile, stil, metin);
  if (eksik.length) {
    throw new PdfHatasi(
      `"${YAZI_AILELERI[aile].ad}" yazı tipinde şu karakterler yok: ${eksik.join(' ')}. ` +
        'Başka bir yazı tipi seçin (ör. Noto Sans) veya bu karakterleri kaldırın.',
      'EKSIK_KARAKTER',
    );
  }
}
