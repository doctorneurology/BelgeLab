import { kabukKur } from './ui/kabuk.js';
import { h } from './ui/yardim.js';
import { ARACLAR, GRUPLAR } from './araclar.js';

const main = kabukKur({});
document.title = 'PDF Araçları — tarayıcıda çalışan, gizli ve ücretsiz';

main.append(
  h('section', { class: 'kahraman' },
    h('h1', {}, 'PDF işlerinizi tarayıcınızda halledin'),
    h('p', {}, 'PDF’leri birleştirin, bölün, sayfa ekleyip silin, imza ve filigran koyun, şifreleyin. Dosyalarınız cihazınızdan hiç çıkmaz: yükleme yok, hesap yok, izleme yok.'),
    h('ul', { class: 'guven', 'aria-label': 'Öne çıkan özellikler' },
      h('li', {}, '🔒 Dosyalar cihazınızda kalır'),
      h('li', {}, '📱 Telefonda da çalışır'),
      h('li', {}, '🧾 Açık kaynak (MIT)'),
      h('li', {}, '🇹🇷 Türkçe karakter desteği'))),
  ...GRUPLAR.map((g) => h('section', { class: 'grup', 'aria-labelledby': `g-${g.id}` },
    h('h2', { id: `g-${g.id}` }, g.ad),
    h('p', { class: 'soluk', stil: { margin: 0 } }, g.aciklama),
    h('div', { class: 'kartlar' }, ...ARACLAR.filter((a) => a.grup === g.id).map((a) =>
      h('a', { class: 'kart', href: `${a.slug}.html` },
        h('span', { class: 'kart-ikon', 'aria-hidden': 'true' }, a.ikon),
        h('span', {}, h('b', {}, a.ad), h('span', {}, a.kisa))))))),
  h('p', { class: 'soluk', stil: { marginTop: '28px' } },
    'Yazı düzeltme (metni doğrudan düzenleme) gibi gelişmiş araçlar ileride eklenecek. ', h('a', { href: 'hakkinda.html' }, 'İlkelerimizi okuyun.')));
