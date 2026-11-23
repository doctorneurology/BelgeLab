// Araç sayfalarında "şunu da deneyin" bağlantıları (hızlı geçiş).
import { h } from './yardim.js';
import { ARACLAR } from '../araclar.js';

/**
 * @param baslik  bölüm başlığı
 * @param slugs   araç kimlikleri (araclar.js)
 * @param not     isteğe bağlı kısa açıklama
 */
export function hizliGecis(baslik, slugs, not = '') {
  const liste = slugs.map((s) => ARACLAR.find((a) => a.slug === s)).filter(Boolean);
  return h('nav', { class: 'hizli-gecis', 'aria-label': baslik },
    h('b', {}, baslik),
    not ? h('span', { class: 'soluk' }, ` ${not}`) : '',
    h('ul', {}, ...liste.map((a) => h('li', {}, h('a', { href: `${a.slug}.html`, title: a.kisa }, `${a.ikon} ${a.ad}`)))));
}
