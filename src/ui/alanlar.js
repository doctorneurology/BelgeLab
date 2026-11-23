// Bildirimli (declarative) ayar formu: alan tanımlarından giriş kutularını üretir.
import { h, dosyaOku } from './yardim.js';
import { YAZI_AILELERI } from '../core/fonts.js';

let sayac = 0;

/**
 * alanlar: [{ id, tur, etiket, ipucu, varsayilan, secenekler, min, max, adim, birim, goster(degerler), genis }]
 * tur: metin | uzunmetin | sayi | secim | onay | renk | sifre | aralik | yazitipi | dosya | baslik
 * @returns {{el:HTMLElement, oku:()=>Promise<object>|object, ayarla:(id,deger)=>void}}
 */
export function alanlariOlustur(alanlar) {
  const el = h('div', { class: 'alanlar' });
  const girdiler = {};
  const kapsayicilar = {};

  const guncelleGorunum = () => {
    const d = okuAnlik();
    for (const a of alanlar) {
      if (a.goster && kapsayicilar[a.id]) kapsayicilar[a.id].hidden = !a.goster(d);
    }
  };

  const okuAnlik = () => {
    const d = {};
    for (const a of alanlar) {
      const g = girdiler[a.id];
      if (!g) continue;
      if (a.tur === 'onay') d[a.id] = g.checked;
      else if (a.tur === 'sayi' || a.tur === 'aralik') d[a.id] = g.value === '' ? NaN : Number(g.value);
      else if (a.tur === 'dosya') d[a.id] = g._dosya ?? null;
      else d[a.id] = g.value;
    }
    return d;
  };

  for (const a of alanlar) {
    if (a.tur === 'baslik') {
      el.append(h('div', { class: 'alan-baslik' }, a.etiket));
      continue;
    }
    const id = `alan-${a.id}-${++sayac}`;
    let g;
    switch (a.tur) {
      case 'uzunmetin':
        g = h('textarea', { id, placeholder: a.ipucu ?? '', rows: 3 });
        g.value = a.varsayilan ?? '';
        break;
      case 'sayi':
        g = h('input', { id, type: 'number', inputmode: 'decimal', min: a.min, max: a.max, step: a.adim ?? 'any' });
        g.value = a.varsayilan ?? '';
        break;
      case 'aralik': {
        g = h('input', { id, type: 'range', min: a.min, max: a.max, step: a.adim ?? 1 });
        g.value = a.varsayilan ?? a.min;
        break;
      }
      case 'secim':
      case 'yazitipi': {
        const secenekler = a.tur === 'yazitipi'
          ? Object.entries(YAZI_AILELERI).map(([deger, b]) => ({ deger, ad: `${b.ad} — ${b.benzer}` }))
          : a.secenekler;
        g = h('select', { id }, ...secenekler.map((s) => h('option', { value: s.deger }, s.ad)));
        g.value = a.varsayilan ?? secenekler[0].deger;
        break;
      }
      case 'onay':
        g = h('input', { id, type: 'checkbox' });
        g.checked = !!a.varsayilan;
        break;
      case 'renk':
        g = h('input', { id, type: 'color' });
        g.value = a.varsayilan ?? '#000000';
        break;
      case 'sifre': {
        const kutu = h('input', { id, type: 'password', autocomplete: a.otomatik ?? 'off', placeholder: a.ipucu ?? '' });
        const goz = h('button', {
          type: 'button', class: 'kucuk-dugme', 'aria-label': 'Şifreyi göster', 'aria-pressed': 'false',
          onclick: () => {
            const goster = kutu.type === 'password';
            kutu.type = goster ? 'text' : 'password';
            goz.setAttribute('aria-pressed', String(goster));
            goz.textContent = goster ? 'Gizle' : 'Göster';
          },
        }, 'Göster');
        g = kutu;
        g._ek = h('div', { class: 'satirda' }, kutu, goz);
        break;
      }
      case 'dosya': {
        g = h('input', { id, type: 'file', accept: a.kabul ?? '*/*' });
        g.addEventListener('change', async () => {
          const f = g.files?.[0];
          g._dosya = f ? { ad: f.name, bayt: await dosyaOku(f) } : null;
          guncelleGorunum();
          a.degisti?.(g._dosya);
        });
        break;
      }
      default:
        g = h('input', { id, type: 'text', placeholder: a.ipucu ?? '', autocomplete: 'off' });
        g.value = a.varsayilan ?? '';
    }
    girdiler[a.id] = g;
    g.addEventListener('input', guncelleGorunum);
    g.addEventListener('change', guncelleGorunum);

    let cikti = null;
    if (a.tur === 'aralik') {
      cikti = h('output', { for: id, class: 'soluk' }, `${g.value}${a.birim ?? ''}`);
      g.addEventListener('input', () => { cikti.textContent = `${g.value}${a.birim ?? ''}`; });
    }

    const kap = a.tur === 'onay'
      ? h('div', { class: `alan ${a.genis ? 'genis' : ''}` },
        h('div', { class: 'onay-satiri' }, g, h('label', { for: id }, a.etiket)),
        a.aciklama && h('small', {}, a.aciklama))
      : h('div', { class: `alan ${a.genis ? 'genis' : ''}` },
        h('label', { for: id }, a.etiket, a.birim && a.tur === 'sayi' ? ` (${a.birim})` : ''),
        g._ek ?? g, cikti,
        a.aciklama && h('small', {}, a.aciklama));
    kapsayicilar[a.id] = kap;
    el.append(kap);
  }
  guncelleGorunum();

  return {
    el,
    oku: okuAnlik,
    ayarla(id, deger) {
      const g = girdiler[id];
      if (!g) return;
      if (g.type === 'checkbox') g.checked = !!deger;
      else g.value = deger;
      g.dispatchEvent(new Event('input'));
    },
  };
}
