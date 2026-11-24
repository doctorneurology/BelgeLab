// HTML → PDF. Küçük, hoşgörülü bir HTML okuyucu (DOM gerektirmez) ile başlık, paragraf, liste, tablo, bağlantı, kalın/italik,
// kod bloğu ve gömülü (data:) resimleri PDF'e yazar. Tamamen tarayıcıda; hiçbir sayfa/URL internetten çekilmez.
//
// DÜRÜSTLÜK: Bu bir tarayıcı işleme motoru DEĞİLDİR. CSS (düzen, kayan kutular, ızgara, arka plan, yazı tipleri), JavaScript,
// harici stil/resim dosyaları ve <iframe>/<canvas>/<svg> desteklenmez. Yalnızca temel satır içi stiller (renk, kalın, eğik,
// hizalama, yazı boyutu) okunur. Adresten (URL) çevirme yapılmaz; sayfayı HTML olarak kaydedip yükleyin.

import { varlikCoz } from './xml.js';
import { modeldenPdf, A4 } from './belge-pdf.js';
import { PdfHatasi } from './hatalar.js';

const ADLI = {
  nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  bull: '•', middot: '·', euro: '€', pound: '£', yen: '¥', deg: '°', plusmn: '±', times: '×', divide: '÷', sect: '§', para: '¶',
  Ccedil: 'Ç', ccedil: 'ç', Ouml: 'Ö', ouml: 'ö', Uuml: 'Ü', uuml: 'ü', Gbreve: 'Ğ', gbreve: 'ğ', Scedil: 'Ş', scedil: 'ş', Idot: 'İ', inodot: 'ı',
};
const HTML_VARLIK = (s) => varlikCoz(s.replace(/&([a-zA-Z]+);/g, (m, a) => ADLI[a] ?? m));

const BOS = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'col', 'area', 'base', 'wbr', 'source']);
const KAPATIR = {
  p: ['p'], li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'],
  thead: ['tbody', 'tfoot', 'thead'], tbody: ['tbody', 'tfoot', 'thead'], tfoot: ['tbody', 'tfoot', 'thead'], option: ['option'],
};
const BLOK_ETIKET = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'ul', 'ol', 'li', 'table', 'pre', 'blockquote', 'form', 'fieldset', 'figure', 'figcaption', 'address', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dl', 'dt', 'dd', 'hr', 'body', 'html']);

export function htmlAyristir(kaynak) {
  const kok = { ad: '#kok', oz: {}, cocuk: [] };
  const yigin = [kok];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  let son = 0;
  const metinEkle = (t) => { if (t) yigin[yigin.length - 1].cocuk.push({ ad: '#metin', metin: t }); };
  for (let m = re.exec(kaynak); m; m = re.exec(kaynak)) {
    metinEkle(kaynak.slice(son, m.index));
    son = re.lastIndex;
    if (!m[2]) continue;
    const ad = m[2].toLowerCase();
    if (m[1]) { // kapanış
      const i = yigin.map((d) => d.ad).lastIndexOf(ad);
      if (i > 0) yigin.length = i;
      continue;
    }
    if (ad === 'script' || ad === 'style' || ad === 'noscript') {
      const k = kaynak.toLowerCase().indexOf(`</${ad}`, son);
      son = k < 0 ? kaynak.length : kaynak.indexOf('>', k) + 1 || kaynak.length;
      re.lastIndex = son;
      continue;
    }
    for (const k of KAPATIR[ad] ?? []) {
      const ust = yigin[yigin.length - 1];
      if (ust.ad === k) yigin.pop();
    }
    const oz = {};
    m[3].replace(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (_, k, a, b, c) => { oz[k.toLowerCase()] = HTML_VARLIK(a ?? b ?? c ?? ''); return ''; });
    const d = { ad, oz, cocuk: [] };
    yigin[yigin.length - 1].cocuk.push(d);
    if (!BOS.has(ad) && !m[4]) yigin.push(d);
  }
  metinEkle(kaynak.slice(son));
  return kok;
}

function renkCoz(c) {
  if (!c) return undefined;
  const s = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  const m = /^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(s);
  if (m) return `#${[m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('')}`;
  return { black: '#000000', white: '#ffffff', red: '#cc0000', green: '#008000', blue: '#0000cc', gray: '#808080', grey: '#808080', orange: '#ff8c00', purple: '#800080', navy: '#000080', maroon: '#800000' }[s];
}

function stilOku(st) {
  const o = {};
  for (const par of String(st ?? '').split(';')) {
    const [k, ...v] = par.split(':');
    if (!k || !v.length) continue;
    o[k.trim().toLowerCase()] = v.join(':').trim();
  }
  return o;
}

function resimOlcusu(b, bicim) {
  if (bicim === 'png') return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const t = b[i + 1];
    if (t >= 0xc0 && t <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(t)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

function dataUri(src) {
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(src ?? '');
  if (!m) return null;
  try {
    const bin = typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(m[2], 'base64')) : Uint8Array.from(atob(m[2].replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return { bayt: bin, bicim: m[1].toLowerCase() === 'png' ? 'png' : 'jpeg' };
  } catch { return null; }
}

const BASLIK_BOYUT = [0, 24, 20, 17, 14, 12, 11];

/**
 * @param html  HTML metni (string) ya da baytlar. Etiket içermeyen düz metin paragraf paragraf yazılır.
 * @returns {{bayt, sayfa, uyarilar, bilgi}}
 */
export async function htmlPdf(html, { ilerleme, baslik = '' } = {}) {
  const kaynak = typeof html === 'string' ? html : new TextDecoder('utf-8').decode(html);
  if (!kaynak.trim()) throw new PdfHatasi('HTML içeriği boş.');
  const uyarilar = new Set();
  const bilgi = { paragraf: 0, tablo: 0, resim: 0, baslik: 0 };
  const etiketVar = /<[a-zA-Z][^>]*>/.test(kaynak);
  const agac = htmlAyristir(etiketVar ? kaynak : kaynak.split(/\n\s*\n/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join(''));
  const baslikEl = (function bul(d) { for (const c of d.cocuk ?? []) { if (c.ad === 'title') return c; const x = bul(c); if (x) return x; } return null; })(agac);
  const sayfaBasligi = baslik || (baslikEl ? HTML_VARLIK(baslikEl.cocuk.map((c) => c.metin ?? '').join('')).trim() : '');
  const bloklar = [];
  let gorulenIcerik = false;
  const ZEMIN = { aile: 'liberation-sans', boyut: 11 };

  /** Bir elemanın içeriğini bloklara çevirir. cikti: blok dizisi */
  function icerik(dugum, ctx, cikti, liste = null) {
    let parcalar = [];
    const bosalt = (ek = {}) => {
      // baş/son boşlukları temizle
      while (parcalar.length && !parcalar[0].kes && /^\s*$/.test(parcalar[0].metin)) parcalar.shift();
      while (parcalar.length && !parcalar.at(-1).kes && /^\s*$/.test(parcalar.at(-1).metin)) parcalar.pop();
      if (parcalar.length) {
        if (!parcalar[0].kes) parcalar[0] = { ...parcalar[0], metin: parcalar[0].metin.replace(/^\s+/, '') };
        cikti.push({ tur: 'p', parcalar, hiza: ctx.hiza ?? 'sol', once: 0, sonra: 6, girinti: ctx.girinti ?? 0, ...ek });
        bilgi.paragraf++;
        gorulenIcerik = true;
      }
      parcalar = [];
    };
    const gez = (d, c) => {
      if (d.ad === '#metin') {
        const t = c.onceden ? HTML_VARLIK(d.metin) : HTML_VARLIK(d.metin).replace(/\s+/g, ' ');
        if (t) {
          if (c.onceden) {
            t.split('\n').forEach((satir, i) => { if (i) parcalar.push({ kes: true, boyut: c.boyut }); if (satir) parcalar.push({ metin: satir, ...paraBicim(c) }); });
          } else parcalar.push({ metin: t, ...paraBicim(c) });
        }
        return;
      }
      const st = stilOku(d.oz.style);
      const yeni = { ...c };
      if (['b', 'strong', 'th'].includes(d.ad) || /^(bold|[6-9]00)$/.test(st['font-weight'] ?? '')) yeni.kalin = true;
      if (['i', 'em', 'cite', 'dfn'].includes(d.ad) || st['font-style'] === 'italic') yeni.italik = true;
      if (['u', 'ins'].includes(d.ad) || /underline/.test(st['text-decoration'] ?? '')) yeni.altCizgi = true;
      if (['code', 'kbd', 'samp', 'tt'].includes(d.ad)) yeni.aile = 'liberation-mono';
      if (d.ad === 'a' && /^(https?:|mailto:)/i.test(d.oz.href ?? '')) yeni.url = d.oz.href;
      const renk = renkCoz(st.color ?? d.oz.color);
      if (renk) yeni.renk = renk;
      const fs = /^([\d.]+)(px|pt)$/.exec(st['font-size'] ?? '');
      if (fs) yeni.boyut = Number(fs[1]) * (fs[2] === 'px' ? 0.75 : 1);
      if (['small', 'sub', 'sup'].includes(d.ad)) yeni.boyut = (c.boyut ?? 11) * 0.8;
      const hz = (st['text-align'] ?? d.oz.align ?? '').toLowerCase();
      if (hz) yeni.hiza = { center: 'orta', right: 'sag', justify: 'iki', left: 'sol' }[hz] ?? c.hiza;
      if (d.ad === 'center') yeni.hiza = 'orta';

      if (d.ad === 'br') { parcalar.push({ kes: true, boyut: c.boyut }); return; }
      if (d.ad === 'hr') { bosalt(); cikti.push({ tur: 'cizgi' }); return; }
      if (d.ad === 'img') {
        const r = dataUri(d.oz.src);
        if (r) {
          bosalt();
          const o = resimOlcusu(r.bayt, r.bicim) ?? { w: 200, h: 150 };
          const w = Number(String(d.oz.width ?? '').replace(/px$/, '')) || o.w, h = Number(String(d.oz.height ?? '').replace(/px$/, '')) || (o.h * (w / o.w));
          cikti.push({ tur: 'resim', bayt: r.bayt, bicim: r.bicim, w: w * 0.75, h: h * 0.75, hiza: yeni.hiza });
          bilgi.resim++; gorulenIcerik = true;
        } else {
          uyarilar.add('Harici (internetteki/dosyadaki) resimler aktarılmadı; yalnızca sayfaya gömülü (data:) PNG/JPEG resimler aktarılır.');
          if (d.oz.alt) parcalar.push({ metin: `[Resim: ${d.oz.alt}]`, ...paraBicim(yeni), italik: true });
        }
        return;
      }
      if (['svg', 'canvas', 'iframe', 'video', 'audio', 'object', 'embed', 'head', 'button', 'select', 'textarea'].includes(d.ad)) {
        if (['svg', 'canvas', 'iframe', 'video', 'object', 'embed'].includes(d.ad)) uyarilar.add('SVG, canvas, iframe ve video gibi nesneler aktarılmadı.');
        return;
      }
      if (/^h[1-6]$/.test(d.ad)) {
        bosalt();
        const n = Number(d.ad[1]);
        const alt = [];
        icerik(d, { ...yeni, kalin: true, boyut: BASLIK_BOYUT[n] }, alt);
        for (const b of alt) if (b.tur === 'p') { cikti.push({ ...b, baslik: n, once: 10, sonra: 6 }); bilgi.baslik++; } else cikti.push(b);
        return;
      }
      if (d.ad === 'ul' || d.ad === 'ol') {
        bosalt();
        let n = Number(d.oz.start ?? 1);
        for (const li of d.cocuk.filter((x) => x.ad === 'li')) {
          const alt = [];
          const derin = (c.liste ?? 0) + 1;
          icerik(li, { ...yeni, liste: derin }, alt);
          let ilk = true;
          for (const b of alt) {
            if (b.tur === 'p' && ilk) { cikti.push({ ...b, madde: d.ad === 'ul' ? (derin > 1 ? '–' : '•') : `${n}.`, girinti: 14 * (derin - 1) + 4, sonra: 2 }); ilk = false; } else if (b.tur === 'p') cikti.push({ ...b, girinti: 14 * derin + 4 }); else cikti.push(b);
          }
          n++;
        }
        cikti.push({ tur: 'p', parcalar: [], once: 0, sonra: 2 });
        return;
      }
      if (d.ad === 'table') { bosalt(); tabloCevir(d, yeni, cikti); return; }
      if (d.ad === 'pre') { bosalt(); const alt = []; icerik(d, { ...yeni, onceden: true, aile: 'liberation-mono', boyut: 9.5 }, alt); alt.forEach((b) => cikti.push(b.tur === 'p' ? { ...b, hiza: 'sol', sonra: 8 } : b)); return; }
      if (d.ad === 'blockquote') { bosalt(); const alt = []; icerik(d, { ...yeni, girinti: (c.girinti ?? 0) + 24, italik: true }, alt); alt.forEach((b) => cikti.push(b)); return; }
      if (BLOK_ETIKET.has(d.ad)) {
        bosalt();
        const alt = [];
        icerik(d, yeni, alt);
        alt.forEach((b) => cikti.push(b));
        return;
      }
      for (const k of d.cocuk) gez(k, yeni);
    };
    for (const k of dugum.cocuk) gez(k, ctx);
    bosalt();
  }

  function paraBicim(c) {
    return { kalin: !!c.kalin, italik: !!c.italik, altCizgi: !!c.altCizgi || !!c.url, boyut: c.boyut ?? ZEMIN.boyut, renk: c.renk ?? (c.url ? '#0b3fc4' : '#000000'), aile: c.aile ?? ZEMIN.aile, url: c.url };
  }

  function tabloCevir(t, ctx, cikti) {
    const satirDugumleri = [];
    const topla = (d) => { for (const c of d.cocuk) { if (c.ad === 'tr') satirDugumleri.push(c); else if (['thead', 'tbody', 'tfoot'].includes(c.ad)) topla(c); } };
    topla(t);
    const satirlar = [];
    let baslikliSatir = false;
    for (const tr of satirDugumleri) {
      const hucreler = [];
      for (const hc of tr.cocuk.filter((x) => x.ad === 'td' || x.ad === 'th')) {
        const alt = [];
        icerik(hc, { ...ctx, boyut: 10 }, alt);
        const bl = alt.filter((b) => b.tur === 'p').map((b) => ({ ...b, sonra: 2 }));
        if (alt.some((b) => b.tur !== 'p')) uyarilar.add('Tablo hücrelerindeki resimler/iç içe tablolar yalnızca metin olarak aktarıldı.');
        if (hc.ad === 'th') baslikliSatir = true;
        const st = stilOku(hc.oz.style);
        hucreler.push({ bloklar: bl.length ? bl : [{ tur: 'p', parcalar: [] }], birlesim: Math.max(1, Number(hc.oz.colspan ?? 1) || 1), baslik: hc.ad === 'th', dolgu: renkCoz(st['background-color'] ?? hc.oz.bgcolor) ?? null });
      }
      if (hucreler.length) satirlar.push(hucreler);
    }
    if (satirlar.length) { cikti.push({ tur: 'tablo', satirlar, boyut: 10, kenarlik: true }); bilgi.tablo++; gorulenIcerik = true; }
  }

  const govde = (function bul(d) { for (const c of d.cocuk ?? []) { if (c.ad === 'body') return c; const x = bul(c); if (x) return x; } return null; })(agac) ?? agac;
  icerik(govde, { ...ZEMIN }, bloklar);
  ilerleme?.(1, 2, 'Sayfalar yerleştiriliyor…');
  if (!gorulenIcerik) throw new PdfHatasi('HTML içinde aktarılabilir bir içerik (metin, tablo, resim) bulunamadı.');
  const r = await modeldenPdf({ sayfa: { genislik: A4.genislik, yukseklik: A4.yukseklik, kenar: { ust: 54, alt: 54, sol: 54, sag: 54 } }, baslik: sayfaBasligi, bloklar }, { ilerleme });
  r.uyarilar.forEach((u) => uyarilar.add(u));
  return {
    bayt: r.bayt, sayfa: r.sayfa, bilgi,
    uyarilar: ['Bu bir tarayıcı değildir: CSS düzeni, arka planlar, harici stil/resim dosyaları ve JavaScript uygulanmaz; yalnızca temel yapı ve satır içi biçimler aktarılır. Sonucun görünüşü web sayfasından farklı olacaktır.', ...uyarilar],
  };
}
