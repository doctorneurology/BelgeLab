import { aracKur } from '../ui/arac.js';
import { h, kutu, kullaniciMesaji } from '../ui/yardim.js';
import { formAlanlari, formDoldur } from '../core/form.js';
import { dosyaAdiTuret } from '../core/util.js';
import { YAZI_AILELERI } from '../core/fonts.js';

aracKur({
  slug: 'form-doldur',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Formu doldurun',
  dugme: 'Formu kaydet',
  ayar() {
    const el = h('div', {});
    const alanYeri = h('div', { class: 'form-alan-listesi' });
    const ustYer = h('div', {});
    const aile = h('select', { id: 'fd-aile' }, ...Object.entries(YAZI_AILELERI).map(([k, b]) => h('option', { value: k }, b.ad)));
    const duzlestir = h('input', { type: 'checkbox', id: 'fd-duzlestir' });
    const secenekler = h('div', { class: 'alanlar', stil: { marginTop: '14px' } },
      h('div', { class: 'alan' }, h('label', { for: 'fd-aile' }, 'Doldurulan yazıların yazı tipi'), aile),
      h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, duzlestir, h('label', { for: 'fd-duzlestir' }, 'Formu düzleştir (sonradan değiştirilemesin)')),
        h('small', {}, 'Alanlar sayfanın kalıcı bir parçası olur; tekrar doldurulamaz.')));
    el.append(ustYer, alanYeri, secenekler);
    let alanlar = [], okuyucular = {}, aktifId = null, aktifBayt = null;

    function girdiKur(a) {
      const id = `fd-${Math.random().toString(36).slice(2, 8)}`;
      const ek = a.salt ? ' (salt okunur)' : '';
      let g, oku;
      if (a.tur === 'metin') {
        g = a.cokSatir ? h('textarea', { id, rows: 4 }) : h('input', { type: 'text', id, maxlength: a.enCok ?? false });
        g.value = a.deger ?? '';
        oku = () => g.value;
      } else if (a.tur === 'onay') {
        g = h('input', { type: 'checkbox', id });
        g.checked = !!a.deger;
        oku = () => g.checked;
        return { kap: h('div', { class: 'onay-satiri' }, g, h('label', { for: id }, `${a.ad}${ek}`)), oku, g };
      } else if (a.tur === 'secenek') {
        const grup = h('fieldset', {}, h('legend', {}, `${a.ad}${ek}`),
          ...a.secenekler.map((s, i) => h('div', { class: 'onay-satiri' },
            h('input', { type: 'radio', name: id, id: `${id}-${i}`, value: s, checked: a.deger === s }),
            h('label', { for: `${id}-${i}` }, s))));
        oku = () => grup.querySelector('input:checked')?.value ?? '';
        return { kap: grup, oku, g: grup };
      } else if (a.tur === 'acilir') {
        g = h('select', { id }, h('option', { value: '' }, '— seçin —'), ...a.secenekler.map((s) => h('option', { value: s }, s)));
        g.value = a.deger ?? '';
        oku = () => g.value;
      } else if (a.tur === 'liste') {
        g = h('select', { id, multiple: true, size: Math.min(6, a.secenekler.length) }, ...a.secenekler.map((s) => h('option', { value: s, selected: (a.deger ?? []).includes(s) }, s)));
        oku = () => [...g.selectedOptions].map((o) => o.value);
      } else {
        return null; // düğme / imza vb.
      }
      g.disabled = !!a.salt;
      return { kap: h('div', { class: 'alan' }, h('label', { for: id }, `${a.ad}${ek}${a.sayfa != null ? ` · sayfa ${a.sayfa + 1}` : ''}`), g), oku, g };
    }

    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { aktifId = null; alanYeri.replaceChildren(); ustYer.replaceChildren(); return; }
        if (aktifId === d.id && aktifBayt === d.bayt) return;
        aktifId = d.id; aktifBayt = d.bayt;
        alanYeri.replaceChildren(); ustYer.replaceChildren(); okuyucular = {};
        try {
          const r = await formAlanlari(d.bayt);
          alanlar = r.alanlar;
          if (r.xfa) ustYer.append(kutu('uyari', 'Bu belgede XFA türü (dinamik) bir form var; bu tür formlar desteklenmez, alanlar doğru çalışmayabilir.'));
          r.uyarilar.forEach((u) => ustYer.append(kutu('uyari', u)));
          if (!alanlar.length) {
            ustYer.append(kutu('bilgi', 'Bu belgede doldurulabilir form alanı bulunamadı. (Düz bir PDF ise “İmza / metin kutusu ekle” aracıyla sayfaya yazı yerleştirebilirsiniz.)'));
            return;
          }
          for (const a of alanlar) {
            const k = girdiKur(a);
            if (!k) continue;
            okuyucular[a.ad] = { oku: k.oku, a };
            alanYeri.append(k.kap);
          }
        } catch (e) {
          ustYer.append(kutu('hata', kullaniciMesaji(e)));
        }
      },
      oku() {
        const degerler = {};
        for (const [ad, { oku, a }] of Object.entries(okuyucular)) {
          if (a.salt) continue;
          const v = oku();
          const eski = a.deger ?? (a.tur === 'onay' ? false : a.tur === 'liste' ? [] : '');
          if (JSON.stringify(v) !== JSON.stringify(eski)) degerler[ad] = v;
        }
        return { degerler, aile: aile.value, duzlestir: duzlestir.checked };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const s = await formDoldur(d.bayt, a.degerler, { duzlestir: a.duzlestir, aile: a.aile });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-doldurulmus'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: s.doldurulan ? `${s.doldurulan} alan dolduruldu.` : 'Hiçbir alan değiştirilmedi; dosya aynı içerikle kaydedildi.',
    };
  },
});
