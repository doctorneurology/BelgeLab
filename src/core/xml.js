// Küçük, bağımsız XML okuyucu (DOM gerektirmez; tarayıcıda ve Node'da aynı). docx / pptx içindeki iyi biçimli XML için yeterlidir.
// Düğüm: { ad:'w:p', oz:{ 'w:val':'x' }, cocuk:[düğüm...], metin:'' }  (metin: doğrudan alt metinlerin birleşimi)

const VARLIKLAR = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function varlikCoz(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, a) => {
    if (a[0] === '#') {
      const n = a[1] === 'x' ? parseInt(a.slice(2), 16) : parseInt(a.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return VARLIKLAR[a] ?? m;
  });
}

export function xmlAyristir(kaynak) {
  const s = typeof kaynak === 'string' ? kaynak : new TextDecoder('utf-8').decode(kaynak);
  const kok = { ad: '#kok', oz: {}, cocuk: [], metin: '' };
  const yigin = [kok];
  const etiket = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let son = 0;
  for (let m = etiket.exec(s); m; m = etiket.exec(s)) {
    const ust = yigin[yigin.length - 1];
    if (m.index > son) ust.metin += varlikCoz(s.slice(son, m.index));
    son = etiket.lastIndex;
    if (m[1] !== undefined) { ust.metin += m[1]; continue; } // CDATA
    if (!m[3]) continue; // yorum, işlem yönergesi
    if (m[2]) { if (yigin.length > 1) yigin.pop(); continue; }
    const oz = {};
    m[4].replace(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, k, a, b) => { oz[k] = varlikCoz(a ?? b ?? ''); return ''; });
    const d = { ad: m[3], oz, cocuk: [], metin: '' };
    ust.cocuk.push(d);
    if (!m[5]) yigin.push(d);
  }
  return kok.cocuk[0] ?? kok;
}

/** Düğümün soyundaki ilk eşleşen düğüm (derinlik öncelikli) */
export function bul(d, ad) {
  if (!d) return null;
  for (const c of d.cocuk) {
    if (c.ad === ad) return c;
    const x = bul(c, ad);
    if (x) return x;
  }
  return null;
}
/** Doğrudan çocuklar arasında ada göre ilk düğüm */
export const cocuk = (d, ad) => d?.cocuk.find((c) => c.ad === ad) ?? null;
export const cocuklar = (d, ad) => (d?.cocuk ?? []).filter((c) => c.ad === ad);
/** Soyundaki tüm eşleşen düğümler */
export function hepsi(d, ad, dizi = []) {
  for (const c of d?.cocuk ?? []) { if (c.ad === ad) dizi.push(c); hepsi(c, ad, dizi); }
  return dizi;
}
