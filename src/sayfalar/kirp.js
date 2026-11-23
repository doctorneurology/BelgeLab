import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { belgeAc } from '../core/render.js';
import { sayfayiCiz } from '../ui/onizleme.js';
import { kirp } from '../core/kirp.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

const MM = 72 / 25.4; // 1 mm = 2.835 pt

aracKur({
  slug: 'kirp',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Kesilecek kenarları ayarlayın',
  dugme: 'Kırp',
  notlar: [kutu('uyari', 'Kırpılan bölgedeki içerik dosyadan silinmez, yalnızca görünmez olur. Gizli kalması gereken bilgileri kırparak saklamayın.')],
  ayar() {
    const el = h('div', {});
    let belge = null, aktifId = null, aktifBayt = null;
    let sayfaNo = 1, n = 1, ptW = 595, ptH = 842, olcek = 1;
    const deger = { ust: 0, alt: 0, sol: 0, sag: 0 }; // mm
    const sahne = h('div', { class: 'sahne-kap' });
    const sahneKap = h('div', { class: 'sahne-orta' }, sahne);
    const etiket = h('span', { 'aria-live': 'polite' });
    const geri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Önceki sayfa', onclick: () => git(sayfaNo - 1) }, '‹');
    const ileri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Sonraki sayfa', onclick: () => git(sayfaNo + 1) }, '›');
    const nav = h('div', { class: 'onizleme-kontrol' }, geri, etiket, ileri);
    const karart = ['ust', 'alt', 'sol', 'sag'].reduce((o, k) => ({ ...o, [k]: h('div', { class: 'kirp-karart' }) }), {});
    const cerceve = h('div', { class: 'kirp-cerceve' });
    const sliderlar = {};
    const sliderAlani = h('div', { class: 'alanlar' });
    const kapsam = h('select', { id: 'kirp-kapsam' },
      h('option', { value: 'hepsi' }, 'Tüm sayfalar'),
      h('option', { value: 'bu' }, 'Yalnızca önizlemedeki sayfa'),
      h('option', { value: 'aralik' }, 'Yazacağım sayfalar'));
    const aralik = h('input', { type: 'text', id: 'kirp-aralik', placeholder: 'örn. 2-5, 8', hidden: true, 'aria-label': 'Kırpılacak sayfalar' });
    kapsam.addEventListener('change', () => { aralik.hidden = kapsam.value !== 'aralik'; });

    for (const [k, ad] of [['ust', 'Üstten'], ['alt', 'Alttan'], ['sol', 'Soldan'], ['sag', 'Sağdan']]) {
      const cikti = h('output', { class: 'soluk' }, '0 mm');
      const g = h('input', { type: 'range', id: `kirp-${k}`, min: 0, max: 50, step: 1, value: 0 });
      g.addEventListener('input', () => { deger[k] = Number(g.value); cikti.textContent = `${g.value} mm`; yerlestir(); });
      sliderlar[k] = g;
      sliderAlani.append(h('div', { class: 'alan' }, h('label', { for: `kirp-${k}` }, `${ad} kes`), g, cikti));
    }

    sahne.append(karart.ust, karart.alt, karart.sol, karart.sag, cerceve);
    el.append(
      h('p', { class: 'soluk' }, 'Kaydırıcılarla kesilecek kenar genişliğini ayarlayın; kırmızı çerçevenin dışı kesilir.'),
      sliderAlani,
      h('div', { class: 'alanlar', stil: { marginTop: '12px' } },
        h('div', { class: 'alan' }, h('label', { for: 'kirp-kapsam' }, 'Hangi sayfalara uygulansın?'), kapsam, aralik)),
      nav, sahneKap);

    function yerlestir() {
      const s = olcek * MM;
      const w = ptW * olcek, hh = ptH * olcek;
      const u = Math.min(deger.ust * s, hh), a = Math.min(deger.alt * s, hh), l = Math.min(deger.sol * s, w), r = Math.min(deger.sag * s, w);
      Object.assign(karart.ust.style, { left: '0', top: '0', width: `${w}px`, height: `${u}px` });
      Object.assign(karart.alt.style, { left: '0', bottom: '0', width: `${w}px`, height: `${a}px` });
      Object.assign(karart.sol.style, { left: '0', top: `${u}px`, width: `${l}px`, height: `${Math.max(0, hh - u - a)}px` });
      Object.assign(karart.sag.style, { right: '0', top: `${u}px`, width: `${r}px`, height: `${Math.max(0, hh - u - a)}px` });
      Object.assign(cerceve.style, { left: `${l}px`, top: `${u}px`, width: `${Math.max(0, w - l - r)}px`, height: `${Math.max(0, hh - u - a)}px` });
      // Kaydırıcı üst sınırları sayfa boyutuna göre
      sliderlar.ust.max = sliderlar.alt.max = String(Math.max(1, Math.floor(ptH / MM / 2 - 3)));
      sliderlar.sol.max = sliderlar.sag.max = String(Math.max(1, Math.floor(ptW / MM / 2 - 3)));
    }

    async function git(no) {
      if (!belge || no < 1 || no > n) return;
      sayfaNo = no;
      geri.disabled = no <= 1;
      ileri.disabled = no >= n;
      etiket.textContent = `Önizleme: sayfa ${no} / ${n}`;
      try {
        const r = await sayfayiCiz(belge, no, Math.min(560, sahneKap.clientWidth || 560));
        r.tuval.setAttribute('aria-label', `${no}. sayfa önizlemesi`);
        olcek = r.olcek; ptW = r.ptGenislik; ptH = r.ptYukseklik;
        sahne.querySelector('canvas')?.remove();
        sahne.prepend(r.tuval);
        yerlestir();
      } catch (e) {
        etiket.textContent = `Önizleme gösterilemedi: ${e.message}`;
      }
    }

    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { belge?.kapat?.(); belge = null; aktifId = null; el.hidden = !!d?.sifreli; return; }
        el.hidden = false;
        if (aktifId === d.id && aktifBayt === d.bayt) return;
        aktifId = d.id; aktifBayt = d.bayt;
        belge?.kapat?.();
        belge = await belgeAc(d.bayt);
        n = belge.numPages;
        await git(1);
      },
      oku() {
        const pt = (k) => deger[k] * MM;
        if (!(deger.ust || deger.alt || deger.sol || deger.sag)) throw new PdfHatasi('Önce en az bir kenar için kesilecek miktarı ayarlayın.');
        const sayfalar = kapsam.value === 'hepsi' ? '' : kapsam.value === 'bu' ? String(sayfaNo) : aralik.value;
        if (kapsam.value === 'aralik' && !aralik.value.trim()) throw new PdfHatasi('Kırpılacak sayfaları yazın.');
        return { ust: pt('ust'), alt: pt('alt'), sol: pt('sol'), sag: pt('sag'), sayfalar };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const s = await kirp(d.bayt, a);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-kirpilmis'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.islenen} sayfa kırpıldı.`,
    };
  },
});
