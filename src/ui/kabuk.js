// Sayfa kabuğu: üst çubuk (menü), ana alan ve alt bilgi. Her sayfada aynı.
import { h, $ } from './yardim.js';
import { ARACLAR, GRUPLAR, SITE_ADI, SLOGAN } from '../araclar.js';

export function kabukKur({ slug = '', baslik = '', kisa = '' } = {}) {
  const kok = $('#uygulama');
  kok.replaceChildren();

  const menuId = 'menu-panel';
  const panel = h('nav', { id: menuId, class: 'menu-panel', hidden: true, 'aria-label': 'Tüm araçlar' },
    ...GRUPLAR.map((g) => h('div', {},
      h('h2', {}, g.ad),
      h('ul', {}, ...ARACLAR.filter((a) => a.grup === g.id).map((a) =>
        h('li', {}, h('a', { href: `${a.slug}.html`, 'aria-current': a.slug === slug ? 'page' : false }, `${a.ikon} ${a.ad}`)))))));
  const menuDugme = h('button', {
    class: 'menu-dugme', type: 'button', 'aria-expanded': 'false', 'aria-controls': menuId,
    onclick: () => {
      const acik = panel.hidden;
      panel.hidden = !acik;
      menuDugme.setAttribute('aria-expanded', String(acik));
    },
  }, '☰ Tüm araçlar');

  const ust = h('header', { class: 'ustcubuk' },
    h('div', { class: 'ustcubuk-ic' },
      h('a', { class: 'logo', href: 'index.html' }, h('span', { class: 'logo-isaret', 'aria-hidden': 'true' }, 'PDF'), SITE_ADI),
      menuDugme),
    panel);

  const main = h('main', { id: 'icerik', tabindex: '-1' });
  const alt = h('footer', { class: 'altbilgi' },
    h('div', { class: 'altbilgi-ic' },
      h('span', {}, `🔒 ${SLOGAN}`),
      h('span', {}, h('a', { href: 'hakkinda.html' }, 'İlkeler ve gizlilik'), ' · Açık kaynak (MIT)')));

  kok.append(
    h('a', { href: '#icerik', class: 'sadece-okuyucu' }, 'Ana içeriğe geç'),
    ust, main, alt);

  if (baslik) document.title = `${baslik} — ${SITE_ADI}`;
  return main;
}
