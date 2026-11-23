// Ana sayfa: sade; yalnızca iki büyük düğme.
import { kabukKur } from './ui/kabuk.js';
import { h } from './ui/yardim.js';
import { BOLUMLER, SITE_ADI } from './araclar.js';

const main = kabukKur({});
document.title = SITE_ADI;
main.classList.add('ana-sayfa');
main.append(
  h('div', { class: 'ana-dugmeler' }, ...BOLUMLER.map((b) =>
    h('a', { class: `ana-dugme ana-${b.id}`, href: b.sayfa },
      h('span', { class: 'ana-ikon', 'aria-hidden': 'true' }, b.ikon),
      h('span', { class: 'ana-yazi' }, b.ad)))));
