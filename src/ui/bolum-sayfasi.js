// "PDF düzenleme" ve "Excel düzenleme" bölüm sayfaları: o bölümün araçlarını gruplar hâlinde listeler.
// Üstteki arama kutusu yazdıkça en uygun araçları gösterir; araç kendiliğinden AÇILMAZ, kullanıcı tıklayarak açar.
import { kabukKur } from './kabuk.js';
import { h } from './yardim.js';
import { ARACLAR, GRUPLAR, BOLUMLER, grupBolumu, SITE_ADI } from '../araclar.js';
import { araclariAra } from '../arama.js';

const kart = (a) => h('a', { class: 'kart', href: `${a.slug}.html` },
  h('span', { class: 'kart-ikon', 'aria-hidden': 'true' }, a.ikon),
  h('span', {}, h('b', {}, a.ad), h('span', {}, a.kisa)));

export function bolumSayfasi(bolumId) {
  const bolum = BOLUMLER.find((b) => b.id === bolumId);
  const main = kabukKur({});
  document.title = `${bolum.ad} — ${SITE_ADI}`;
  const gruplar = GRUPLAR.filter((g) => grupBolumu(g) === bolumId);
  const bolumAraclari = ARACLAR.filter((a) => gruplar.some((g) => g.id === a.grup));

  const girdi = h('input', {
    type: 'search', id: 'arac-ara', class: 'arac-ara-girdi', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Araç ara… (örn. pdftomd, birleştir, compress)', 'aria-label': `${bolum.ad} araçlarında ara`,
  });
  const durum = h('p', { class: 'arac-ara-durum', role: 'status', 'aria-live': 'polite' });
  const sonuclar = h('div', { class: 'kartlar', hidden: true });
  const tumu = h('div', { class: 'arac-tumu' },
    ...gruplar.map((g) => h('section', { class: 'grup', 'aria-labelledby': `g-${g.id}` },
      gruplar.length > 1 ? h('h2', { id: `g-${g.id}` }, g.ad) : '',
      h('div', { class: 'kartlar' }, ...ARACLAR.filter((a) => a.grup === g.id).map(kart)))));

  // Enter'a basınca hiçbir şey açılmaz; yalnızca liste süzülür.
  girdi.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  girdi.addEventListener('input', () => {
    const bulunan = araclariAra(bolumAraclari, girdi.value);
    if (bulunan === null) {
      tumu.hidden = false;
      sonuclar.hidden = true;
      durum.textContent = '';
      return;
    }
    tumu.hidden = true;
    sonuclar.hidden = false;
    sonuclar.replaceChildren(...bulunan.map((b) => kart(b.arac)));
    durum.textContent = bulunan.length
      ? `${bulunan.length} araç bulundu. Açmak için üzerine tıkla.`
      : 'Eşleşen araç bulunamadı. Başka bir yazılış dene (örn. “word”, “birleştir”).';
  });

  main.append(
    h('div', { class: 'arac-baslik' }, h('h1', {}, h('span', { class: 'ikon', 'aria-hidden': 'true' }, bolum.ikon), ' ', bolum.ad)),
    h('div', { class: 'arac-ara' }, girdi, durum),
    sonuclar, tumu);
}
