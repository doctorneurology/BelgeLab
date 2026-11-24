// Şekil ve vurgu ekle (PDF düzenleyici): sayfada sürükleyerek dikdörtgen, elips, çizgi, ok ve vurgulayıcı çizin.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { bolgeSecici } from '../ui/bolge-secici.js';
import { belgeAc } from '../core/render.js';
import { sekilEkle } from '../core/sekil.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

const TURLER = [['dikdortgen', '▭ Dikdörtgen'], ['elips', '⬭ Elips'], ['cizgi', '╱ Çizgi'], ['ok', '➚ Ok'], ['vurgu', '🖍️ Vurgulayıcı']];

aracKur({
  slug: 'isaretle',
  toplu: false, // dosyaya özel arayüz (sayfa/bölge seçimi); toplu kip yok
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Sayfaya çizin',
  dugme: 'Şekilleri ekle',
  notlar: [kutu('bilgi', 'Önce şekil türünü ve rengi seçin, sonra sayfada sürükleyerek çizin. Çizgi/ok, sürüklemenin başladığı noktadan bittiği noktaya gider. Eklenen şekiller sayfa içeriğinin üstüne konur; yazı/resim değişmez. (Yazı ve imza için “İmza / metin kutusu ekle”, serbest çizim için imza tahtası kullanılabilir.)')],
  ayar() {
    const st = { belge: null, aktifId: null };
    const tur = h('select', { id: 'is-tur' }, ...TURLER.map(([v, a]) => h('option', { value: v }, a)));
    const renk = h('input', { type: 'color', id: 'is-renk', value: '#d62828' });
    const dolguOn = h('input', { type: 'checkbox', id: 'is-dolgu-on' });
    const dolgu = h('input', { type: 'color', id: 'is-dolgu', value: '#ffe08a' });
    const kalin = h('input', { type: 'number', id: 'is-kalin', min: 0.5, max: 30, step: 0.5, value: 3 });
    const opak = h('input', { type: 'range', id: 'is-opak', min: 10, max: 100, step: 5, value: 100 });
    const liste = h('div', { class: 'bs-liste' });
    const secici = bolgeSecici({
      onDegisti: () => listele(),
      kutuSinifi: (k) => `bs-tur-${k.tur}`,
      yeniKutuVerisi: () => ({ tur: tur.value, renk: tur.value === 'vurgu' && renk.value === '#d62828' ? '#ffeb3b' : renk.value, dolgu: dolguOn.checked && ['dikdortgen', 'elips'].includes(tur.value) ? dolgu.value : null, kalinlik: Number(kalin.value) || 2, opaklik: tur.value === 'vurgu' ? 0.35 : Number(opak.value) / 100 }),
    });
    const ayarlar = h('div', { class: 'alanlar' },
      h('div', { class: 'alan' }, h('label', { for: 'is-tur' }, 'Şekil'), tur),
      h('div', { class: 'alan' }, h('label', { for: 'is-renk' }, 'Renk'), renk),
      h('div', { class: 'alan' }, h('label', { for: 'is-kalin' }, 'Çizgi kalınlığı (pt)'), kalin),
      h('div', { class: 'alan' }, h('label', { for: 'is-opak' }, 'Saydamlık'), opak),
      h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, dolguOn, h('label', { for: 'is-dolgu-on' }, 'İçini boya (dikdörtgen/elips)')), dolgu));
    const el = h('div', {}, ayarlar, secici.el, liste);
    el.hidden = true;
    function listele() {
      const k = secici.kutular();
      liste.replaceChildren(k.length ? h('div', {}, h('h3', {}, `Eklenecek şekiller (${k.length})`), h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => secici.temizle() }, 'Hepsini temizle')) : h('p', { class: 'soluk' }, 'Henüz şekil yok. Sayfa üzerinde sürükleyin.'));
    }
    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { st.belge?.kapat?.(); st.belge = null; el.hidden = true; return; }
        if (st.aktifId === d.id) return;
        st.aktifId = d.id; el.hidden = false;
        st.belge?.kapat?.();
        st.belge = await belgeAc(d.bayt);
        await secici.belgeAyarla(st.belge);
        listele();
      },
      oku() {
        const k = secici.kutular();
        if (!k.length) throw new PdfHatasi('Eklenecek şekil yok. Sayfada sürükleyerek çizin.');
        return {
          ogeler: k.map((x) => {
            const ortak = { sayfa: x.sayfa - 1, tur: x.tur, renk: x.renk, dolgu: x.dolgu, kalinlik: x.kalinlik, opaklik: x.opaklik };
            return ['cizgi', 'ok'].includes(x.tur) ? { ...ortak, x0: x.bas[0], y0: x.bas[1], x1: x.son[0], y1: x.son[1] } : { ...ortak, x0: x.x0, y0: x.y0, x1: x.x1, y1: x.y1 };
          }),
        };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const r = await sekilEkle(d.bayt, a.ogeler);
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-isaretli'), bayt: r.bayt }], mesaj: `${r.eklenen} şekil eklendi.`, uyarilar: r.uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['imza-metin', 'karart', 'sikistir'])] };
  },
});
