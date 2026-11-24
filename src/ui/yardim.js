// Küçük arayüz yardımcıları.

/** h('div', {class:'a', onclick: fn}, 'metin', başkaEleman) */
export function h(etiket, ozellikler = {}, ...cocuklar) {
  const el = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellikler ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'stil' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  ekle(el, cocuklar);
  return el;
}

export function ekle(el, cocuklar) {
  for (const c of cocuklar.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (s, k = document) => k.querySelector(s);
export const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tarayıcının boyayabilmesi için bir an ver. */
export const boyamaBekle = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function dosyaOku(dosya) {
  return new Uint8Array(await dosya.arrayBuffer());
}

const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', md: 'text/markdown;charset=utf-8', txt: 'text/plain;charset=utf-8' };
export function mimeBul(ad) {
  const u = String(ad).split('.').pop().toLowerCase();
  return MIME[u] ?? 'application/octet-stream';
}

const urller = new Set();
export function blobUrl(bayt, ad) {
  const url = URL.createObjectURL(new Blob([bayt], { type: mimeBul(ad) }));
  urller.add(url);
  return url;
}
export function urlleriTemizle() {
  for (const u of urller) URL.revokeObjectURL(u);
  urller.clear();
}

/** Dosyayı kullanıcının cihazına indirir (hiçbir yere yüklenmez). */
export function indir(bayt, ad) {
  const url = blobUrl(bayt, ad);
  const a = h('a', { href: url, download: ad, stil: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => a.remove(), 100);
}

/** Hata/uyarı/bilgi kutusu */
export function kutu(tur, ...icerik) {
  const simge = { hata: '⛔', uyari: '⚠️', bilgi: 'ℹ️', basari: '✅' }[tur] ?? '';
  return h('div', { class: `kutu kutu-${tur}`, role: tur === 'hata' ? 'alert' : 'status' },
    h('span', { class: 'kutu-simge', 'aria-hidden': 'true' }, simge),
    h('div', { class: 'kutu-icerik' }, ...icerik));
}

export function kullaniciMesaji(e) {
  if (e && (e.name === 'PdfHatasi' || e.name === 'SifreliPdfHatasi' || e.name === 'YanlisSifreHatasi')) return e.message;
  console.error(e);
  return `Beklenmeyen bir sorun oluştu. Dosya bozuk ya da çok büyük olabilir. (${e?.message ?? e})`;
}

export { bayt as boyutMetni, aralikMetni } from '../core/util.js';
