import { PdfHatasi } from './hatalar.js';

/**
 * "1-3, 5, 8-" gibi bir sayfa aralığı metnini 0 tabanlı sayfa dizinlerine çevirir.
 *  - "5"      → 5. sayfa
 *  - "3-7"    → 3'ten 7'ye (7-3 yazılırsa ters sırayla)
 *  - "8-"     → 8'den sona kadar
 *  - "-4"     → baştan 4'e kadar
 *  - "son"    → son sayfa ("son-2" yazılamaz; "3-son" yazılabilir)
 * Sıra, yazıldığı gibi korunur (sıralama aracı bunu kullanır).
 */
export function sayfaAraligiCoz(metin, sayfaSayisi, { tekrarIzinli = true } = {}) {
  const temiz = String(metin ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!temiz) throw new PdfHatasi('Sayfa aralığı boş. Örnek: 1-3,5,8-');
  const sonuc = [];
  const sayiCoz = (s) => {
    if (s === 'son') return sayfaSayisi;
    if (!/^\d+$/.test(s)) throw new PdfHatasi(`"${s}" geçerli bir sayfa numarası değil.`);
    return Number(s);
  };
  const kontrol = (n) => {
    if (n < 1 || n > sayfaSayisi) {
      throw new PdfHatasi(`Sayfa ${n} yok; bu belgede ${sayfaSayisi} sayfa var.`);
    }
    return n;
  };
  for (const parca of temiz.split(/[,;]+/).filter(Boolean)) {
    if (parca.includes('-')) {
      const [solMetin, sagMetin, fazla] = parca.split('-');
      if (fazla !== undefined) throw new PdfHatasi(`"${parca}" geçerli bir aralık değil.`);
      const bas = solMetin === '' ? 1 : kontrol(sayiCoz(solMetin));
      const son = sagMetin === '' ? sayfaSayisi : kontrol(sayiCoz(sagMetin));
      if (bas <= son) for (let i = bas; i <= son; i++) sonuc.push(i - 1);
      else for (let i = bas; i >= son; i--) sonuc.push(i - 1);
    } else {
      sonuc.push(kontrol(sayiCoz(parca)) - 1);
    }
  }
  if (!sonuc.length) throw new PdfHatasi('Hiç sayfa seçilmedi.');
  if (!tekrarIzinli) {
    const goruldu = new Set();
    return sonuc.filter((i) => (goruldu.has(i) ? false : goruldu.add(i)));
  }
  return sonuc;
}

/** [0,1,2,4,6,7] → "1-3, 5, 7-8" (0 tabanlı dizinlerden, insan okuyabilir aralık metni) */
export function aralikMetni(dizinler) {
  const s = [...new Set(dizinler)].sort((a, b) => a - b);
  const parcalar = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parcalar.push(j > i ? `${s[i] + 1}-${s[j] + 1}` : `${s[i] + 1}`);
    i = j + 1;
  }
  return parcalar.join(', ');
}

/** Boş bırakılırsa tüm sayfalar; yoksa aralık metninin dizinleri (tekrarsız, artan sırada). */
export function sayfaSecimi(metin, sayfaSayisi) {
  if (metin == null || String(metin).trim() === '') {
    return Array.from({ length: sayfaSayisi }, (_, i) => i);
  }
  return [...new Set(sayfaAraligiCoz(metin, sayfaSayisi))].sort((a, b) => a - b);
}

/** "#rrggbb" → {r,g,b} (0-1 arası) */
export function renkCoz(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) throw new PdfHatasi(`"${hex}" geçerli bir renk değil (örnek: #ff0000).`);
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** PDF içerik akışına yazılacak sayı (kısa ve güvenli). */
export function sayi(x) {
  if (!Number.isFinite(x)) throw new PdfHatasi('Geçersiz sayı değeri.');
  const s = (Math.round(x * 10000) / 10000).toString();
  return s.includes('e') ? '0' : s;
}

export function rastgeleKimlik() {
  const a = new Uint8Array(4);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** "rapor.pdf" + "-birlesik" → "rapor-birlesik.pdf" */
export function dosyaAdiTuret(ad, sonEk, uzanti = 'pdf') {
  const govde = String(ad ?? 'belge').replace(/\.[^.\\/]+$/, '') || 'belge';
  const guvenli = govde.replace(/[\\/:*?"<>|]+/g, '_');
  return `${guvenli}${sonEk}.${uzanti}`;
}

/** Roma rakamı (1-3999) */
export function romaRakami(n) {
  if (n < 1 || n > 3999) return String(n);
  const t = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let s = '';
  for (const [d, r] of t) while (n >= d) { s += r; n -= d; }
  return s;
}

export function bayt(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 0..n-1 numaralı işleri en çok `sinir` tanesi AYNI ANDA çalışacak şekilde yürütür (sırayla başlatır).
 * İlk hatada kalan işler başlatılmaz ve hata fırlatılır.
 */
export async function eszamanliCalistir(n, sinir, islem) {
  let siradaki = 0;
  let hata = null;
  const isci = async () => {
    while (!hata) {
      const k = siradaki++;
      if (k >= n) return;
      try { await islem(k); } catch (e) { hata ??= e; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(sinir, n)) }, isci));
  if (hata) throw hata;
}
