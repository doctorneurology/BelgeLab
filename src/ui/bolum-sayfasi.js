// "PDF düzenleme" ve "Excel düzenleme" bölüm sayfaları: o bölümün araçlarını gruplar hâlinde listeler.
import { kabukKur } from './kabuk.js';
import { h } from './yardim.js';
import { ARACLAR, GRUPLAR, BOLUMLER, grupBolumu, SITE_ADI } from '../araclar.js';

export function bolumSayfasi(bolumId) {
  const bolum = BOLUMLER.find((b) => b.id === bolumId);
  const main = kabukKur({});
  document.title = `${bolum.ad} — ${SITE_ADI}`;
  const gruplar = GRUPLAR.filter((g) => grupBolumu(g) === bolumId);
  main.append(
    h('div', { class: 'arac-baslik' }, h('h1', {}, h('span', { class: 'ikon', 'aria-hidden': 'true' }, bolum.ikon), ' ', bolum.ad)),
    ...gruplar.map((g) => h('section', { class: 'grup', 'aria-labelledby': `g-${g.id}` },
      gruplar.length > 1 ? h('h2', { id: `g-${g.id}` }, g.ad) : '',
      h('div', { class: 'kartlar' }, ...ARACLAR.filter((a) => a.grup === g.id).map((a) =>
        h('a', { class: 'kart', href: `${a.slug}.html` },
          h('span', { class: 'kart-ikon', 'aria-hidden': 'true' }, a.ikon),
          h('span', {}, h('b', {}, a.ad), h('span', {}, a.kisa))))))));
}
