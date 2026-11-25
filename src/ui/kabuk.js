// Sayfa kabuğu: üst çubuk (menü), ana alan ve alt bilgi. Her sayfada aynı.
import { h, $ } from './yardim.js';
import { ARACLAR, GRUPLAR, SITE_ADI, SLOGAN } from '../araclar.js';
import { araclariAra } from '../arama.js';

export function kabukKur({ slug = '', baslik = '', kisa = '', anaSayfa = false } = {}) {
  const kok = $('#uygulama');
  kok.replaceChildren();

  const menuId = 'menu-panel';
  const baglanti = (a) => h('a', { href: `${a.slug}.html`, 'aria-current': a.slug === slug ? 'page' : false }, `${a.ikon} ${a.ad}`);
  // Menüdeki arama: yazdıkça uygun araçları listeler; araç kendiliğinden AÇILMAZ, tıklayarak açılır.
  const ara = h('input', { type: 'search', class: 'arac-ara-girdi', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Araç ara… (örn. pdftomd, birleştir, compress)', 'aria-label': 'Tüm araçlarda ara' });
  const araDurum = h('p', { class: 'arac-ara-durum', role: 'status', 'aria-live': 'polite' });
  const araSonuc = h('ul', { hidden: true });
  const gruplar = h('div', { class: 'menu-gruplar' },
    ...GRUPLAR.map((g) => h('div', {},
      h('h2', {}, g.ad),
      h('ul', {}, ...ARACLAR.filter((a) => a.grup === g.id).map((a) => h('li', {}, baglanti(a)))))));
  ara.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  ara.addEventListener('input', () => {
    const bulunan = araclariAra(ARACLAR, ara.value);
    gruplar.hidden = bulunan !== null;
    araSonuc.hidden = bulunan === null;
    araSonuc.replaceChildren(...(bulunan ?? []).map((b) => h('li', {}, baglanti(b.arac), h('span', { class: 'soluk menu-kisa' }, b.arac.kisa))));
    araDurum.textContent = bulunan === null ? '' : bulunan.length ? `${bulunan.length} araç bulundu. Açmak için üzerine tıklayın.` : 'Eşleşen araç bulunamadı. Başka bir yazılış deneyin (örn. “word”, “birleştir”).';
  });
  const panel = h('nav', { id: menuId, class: 'menu-panel', hidden: true, 'aria-label': 'Tüm araçlar' }, ara, araDurum, araSonuc, gruplar);
  const menuDugme = h('button', {
    class: 'menu-dugme', type: 'button', 'aria-expanded': 'false', 'aria-controls': menuId,
    onclick: () => {
      const acik = panel.hidden;
      panel.hidden = !acik;
      menuDugme.setAttribute('aria-expanded', String(acik));
      if (acik) ara.focus();
    },
  }, '☰ Tüm araçlar');

  // Hafıza bağlantısı: kayıtlı çıktı varsa sayısı yazılır (hafıza kullanılamıyorsa sessizce yalnızca bağlantı kalır).
  const hafizaBaglantisi = h('a', { class: 'hafiza-baglanti', href: 'hafiza.html', title: 'Ürettiğiniz çıktıların bu tarayıcıdaki kayıtlı kopyaları' }, '💾 Hafıza');
  import('../core/hafiza.js').then(({ hafiza }) => hafiza().listele()).then((l) => { if (l.length) hafizaBaglantisi.append(` (${l.length})`); }).catch(() => {});

  const ust = h('header', { class: 'ustcubuk' },
    h('div', { class: 'ustcubuk-ic' },
      h('a', { class: 'logo', href: 'index.html' }, h('span', { class: 'logo-isaret', 'aria-hidden': 'true' }, 'BL'), SITE_ADI),
      h('div', { class: 'ust-sag' },
        anaSayfa ? null : h('a', { class: 'ana-don', href: 'index.html' }, '← Ana sayfaya dön'),
        hafizaBaglantisi,
        menuDugme)),
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
