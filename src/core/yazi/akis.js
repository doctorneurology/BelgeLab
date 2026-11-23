// PDF içerik akışı (content stream) okuyucu.
// Akışı işleçlere (operator) ayırır; her işlecin akıştaki bayt aralığını da saklar. Böylece
// dokunulmayan işleçler çıktıya BAYT BAYT aynı yazılır (sayfanın geri kalanı hiç değişmez).

const BOSLUK = new Uint8Array(256);
for (const c of [0, 9, 10, 12, 13, 32]) BOSLUK[c] = 1;
const AYRAC = new Uint8Array(256);
for (const c of '()<>[]{}/%') AYRAC[c.charCodeAt(0)] = 1;

const latin1 = new TextDecoder('latin1');

/**
 * @typedef {{t:'sayi',v:number}|{t:'ad',v:string}|{t:'yazi',v:Uint8Array,hex:boolean}|{t:'dizi',v:Jeton[]}|
 *           {t:'sozluk',v:Map<string,Jeton>}|{t:'mantik',v:boolean}|{t:'bos'}} Jeton
 * @typedef {{op:string, args:Jeton[], bas:number, son:number}} Islec
 */

/** İçerik akışını işleçlere ayırır. */
export function akisCoz(b) {
  const n = b.length;
  let i = 0;
  const islecler = [];
  let args = [];
  let argBas = -1;

  const boslukAtla = () => {
    for (;;) {
      while (i < n && BOSLUK[b[i]]) i++;
      if (i < n && b[i] === 37) { // % yorum
        while (i < n && b[i] !== 10 && b[i] !== 13) i++;
        continue;
      }
      return;
    }
  };

  const kelime = () => {
    const s = i;
    while (i < n && !BOSLUK[b[i]] && !AYRAC[b[i]]) i++;
    return latin1.decode(b.subarray(s, i));
  };

  const yaziOku = () => { // ( ... ) — i, '(' üzerinde
    i++;
    const cikti = [];
    let derinlik = 1;
    while (i < n) {
      const c = b[i++];
      if (c === 92) { // ters bölü
        if (i >= n) break;
        const d = b[i++];
        if (d === 110) cikti.push(10);
        else if (d === 114) cikti.push(13);
        else if (d === 116) cikti.push(9);
        else if (d === 98) cikti.push(8);
        else if (d === 102) cikti.push(12);
        else if (d === 13) { if (b[i] === 10) i++; }
        else if (d === 10) { /* satır devamı */ }
        else if (d >= 48 && d <= 55) {
          let v = d - 48;
          for (let k = 0; k < 2 && i < n && b[i] >= 48 && b[i] <= 55; k++) v = v * 8 + (b[i++] - 48);
          cikti.push(v & 255);
        } else cikti.push(d);
      } else if (c === 40) { derinlik++; cikti.push(c); }
      else if (c === 41) { if (--derinlik === 0) break; cikti.push(c); }
      else cikti.push(c);
    }
    return { t: 'yazi', v: Uint8Array.from(cikti), hex: false };
  };

  const hexOku = () => { // < ... > — i, '<' üzerinde
    i++;
    const cikti = [];
    let yarim = -1;
    while (i < n && b[i] !== 62) {
      const c = b[i++];
      let v = -1;
      if (c >= 48 && c <= 57) v = c - 48;
      else if (c >= 65 && c <= 70) v = c - 55;
      else if (c >= 97 && c <= 102) v = c - 87;
      if (v < 0) continue;
      if (yarim < 0) yarim = v; else { cikti.push(yarim * 16 + v); yarim = -1; }
    }
    if (yarim >= 0) cikti.push(yarim * 16);
    i++;
    return { t: 'yazi', v: Uint8Array.from(cikti), hex: true };
  };

  const nesne = (derinlik = 0) => { // tek bir değer okur; işleç ise {t:'islec'}
    boslukAtla();
    if (i >= n) return null;
    const c = b[i];
    if (c === 40) return yaziOku();
    if (c === 60) {
      if (b[i + 1] === 60) { // sözlük
        i += 2;
        const m = new Map();
        for (;;) {
          boslukAtla();
          if (i >= n) break;
          if (b[i] === 62 && b[i + 1] === 62) { i += 2; break; }
          const k = nesne(derinlik + 1);
          if (!k) break;
          if (k.t !== 'ad') continue;
          const v = nesne(derinlik + 1);
          m.set(k.v, v ?? { t: 'bos' });
        }
        return { t: 'sozluk', v: m };
      }
      return hexOku();
    }
    if (c === 91) { // [
      i++;
      const d = [];
      for (;;) {
        boslukAtla();
        if (i >= n) break;
        if (b[i] === 93) { i++; break; }
        const x = nesne(derinlik + 1);
        if (!x) break;
        if (x.t === 'islec') { d.push({ t: 'bos' }); continue; } // bozuk dizi içi kelime
        d.push(x);
      }
      return { t: 'dizi', v: d };
    }
    if (c === 47) { // /Ad
      i++;
      const s = kelime();
      return { t: 'ad', v: s.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) };
    }
    if (c === 93 || c === 62 || c === 41 || c === 123 || c === 125) { i++; return nesne(derinlik); } // başıboş ayraç
    const k = kelime();
    if (k === '') { i++; return nesne(derinlik); }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(k)) return { t: 'sayi', v: Number(k) };
    if (/^[+-]?\d*\.?\d*$/.test(k)) return { t: 'sayi', v: Number(k) || 0 };
    if (k === 'true' || k === 'false') return { t: 'mantik', v: k === 'true' };
    if (k === 'null') return { t: 'bos' };
    return { t: 'islec', v: k };
  };

  for (;;) {
    boslukAtla();
    if (i >= n) break;
    const bas = i;
    const x = nesne();
    if (!x) break;
    if (argBas < 0) argBas = bas;
    if (x.t !== 'islec') { args.push(x); continue; }
    if (x.v === 'BI') { // satır içi resim: ID ... EI arasını ham olarak geç
      const idKonum = araKelime(b, i, 'ID');
      if (idKonum < 0) { i = n; break; }
      let j = idKonum + 2;
      if (BOSLUK[b[j]]) j++;
      const ei = eiBul(b, j);
      i = ei < 0 ? n : ei + 2;
      islecler.push({ op: 'BI', args: [], bas: argBas, son: i });
      args = []; argBas = -1;
      continue;
    }
    islecler.push({ op: x.v, args, bas: argBas, son: i });
    args = []; argBas = -1;
  }
  return islecler;
}

function araKelime(b, i, kel) {
  const k0 = kel.charCodeAt(0), k1 = kel.charCodeAt(1);
  for (let j = i; j < b.length - 1; j++) {
    if (b[j] === k0 && b[j + 1] === k1 && (j === 0 || BOSLUK[b[j - 1]]) && (j + 2 >= b.length || BOSLUK[b[j + 2]])) return j;
  }
  return -1;
}

function eiBul(b, j) {
  for (let k = j; k < b.length - 1; k++) {
    if (b[k] === 69 && b[k + 1] === 73 && BOSLUK[b[k - 1]] && (k + 2 >= b.length || BOSLUK[b[k + 2]] || AYRAC[b[k + 2]])) return k;
  }
  return -1;
}

// ---- Yazma yardımcıları --------------------------------------------------------------------------

export function sayiYaz(x) {
  if (!Number.isFinite(x)) return '0';
  const s = (Math.round(x * 100000) / 100000).toString();
  return s.includes('e') ? (Math.abs(x) < 1 ? '0' : x.toFixed(5)) : s;
}

export function hexYaz(bayt) {
  let s = '<';
  for (const x of bayt) s += x.toString(16).padStart(2, '0');
  return s + '>';
}

export function adYaz(ad) {
  return '/' + String(ad).replace(/[^!-~]|[#()<>[\]{}/%]/g, (c) => '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

/** Bir jetonu PDF sözdizimine geri çevirir. */
export function jetonYaz(j) {
  switch (j.t) {
    case 'sayi': return sayiYaz(j.v);
    case 'ad': return adYaz(j.v);
    case 'yazi': return hexYaz(j.v);
    case 'dizi': return '[' + j.v.map(jetonYaz).join(' ') + ']';
    case 'sozluk': return '<<' + [...j.v].map(([k, v]) => adYaz(k) + ' ' + jetonYaz(v)).join(' ') + '>>';
    case 'mantik': return String(j.v);
    default: return 'null';
  }
}

/** Parçalardan (Uint8Array veya dizgi) tek bir bayt dizisi üretir. */
export function birlestirBayt(parcalar) {
  const donusmus = parcalar.map((p) => (typeof p === 'string' ? latin1Bayt(p) : p));
  const top = donusmus.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(top);
  let o = 0;
  for (const p of donusmus) { out.set(p, o); o += p.length; }
  return out;
}

function latin1Bayt(s) {
  const out = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k) & 255;
  return out;
}

// ---- Matrisler (PDF satır-vektör düzeni: [a b c d e f]) ------------------------------------------

export function carp(m, n) { // m × n
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

export function ters(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return null;
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function uygula(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export const BIRIM = [1, 0, 0, 1, 0, 0];
