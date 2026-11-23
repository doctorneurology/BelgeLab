// Sayfa sil / çıkar / sırala / döndür araçlarının ortak ayar arayüzü (küçük resim ızgarası + araç çubuğu).
import { h, kutu, aralikMetni } from './yardim.js';
import { sayfaIzgarasi } from './sayfa-izgarasi.js';
import { sayfaAraligiCoz } from '../core/util.js';

/**
 * @param secenek.mod 'sil' | 'sec' | 'sirala' | 'dondur'
 * @param secenek.aralikEtiketi  varsa "1-3, 5" biçiminde yazılabilen bir kutu da gösterilir (sil/çıkar)
 */
export function izgaraAyari({ mod, aralikEtiketi, yardim }) {
  return () => {
    const kap = h('div', {});
    let izgara = null;
    let aktif = null;
    let eskiBayt = null;
    let metinGirdi = null;
    let hataYazi = null;
    let ozet = null;

    const guncelleOzet = () => {
      if (!izgara) return;
      if (mod === 'sil' || mod === 'sec') {
        const s = izgara.secilenler();
        ozet.textContent = s.length
          ? `${s.length} sayfa seçili${mod === 'sil' ? ` — silinecek; ${izgara.sayfaSayisi() - s.length} sayfa kalacak` : ''}.`
          : 'Henüz sayfa seçilmedi.';
        if (metinGirdi && document.activeElement !== metinGirdi) metinGirdi.value = aralikMetni(s);
      } else if (mod === 'dondur') {
        const n = Object.keys(izgara.donusler()).length;
        ozet.textContent = n ? `${n} sayfa döndürülecek.` : 'Henüz döndürülen sayfa yok.';
      } else {
        ozet.textContent = 'Sayfaları sürükleyin ya da ◀ ▶ düğmeleriyle taşıyın.';
      }
    };

    function kur(dosya) {
      izgara?.kapat();
      aktif = dosya.id;
      eskiBayt = dosya.bayt;
      kap.replaceChildren();
      ozet = h('p', { class: 'soluk', 'aria-live': 'polite' });
      izgara = sayfaIzgarasi({ bayt: dosya.bayt, mod, degisti: guncelleOzet });
      const cubuk = h('div', { class: 'arac-cubugu' });
      if (mod === 'sil' || mod === 'sec') {
        cubuk.append(
          h('button', { type: 'button', onclick: () => izgara.tumunuSec() }, 'Tümünü seç'),
          h('button', { type: 'button', onclick: () => izgara.temizle() }, 'Seçimi temizle'),
          h('button', { type: 'button', onclick: () => izgara.tersSec() }, 'Seçimi ters çevir'));
      } else if (mod === 'sirala') {
        cubuk.append(h('button', { type: 'button', onclick: () => izgara.tersCevir() }, '⇅ Sırayı tersine çevir'));
      } else if (mod === 'dondur') {
        cubuk.append(
          h('button', { type: 'button', onclick: () => izgara.tumunuDondur(-90) }, '↺ Hepsini sola 90°'),
          h('button', { type: 'button', onclick: () => izgara.tumunuDondur(90) }, '↻ Hepsini sağa 90°'),
          h('button', { type: 'button', onclick: () => izgara.tumunuDondur(180) }, '180°'),
          h('button', { type: 'button', onclick: () => izgara.sifirla() }, 'Sıfırla'));
      }
      if (aralikEtiketi) {
        metinGirdi = h('input', { type: 'text', id: 'aralik-metni', placeholder: 'örn. 1-3, 5, 8-', autocomplete: 'off' });
        hataYazi = h('small', { class: 'tehlike', role: 'alert' });
        metinGirdi.addEventListener('input', () => {
          hataYazi.textContent = '';
          if (!metinGirdi.value.trim()) { izgara.secimiAyarla([]); guncelleOzet(); return; }
          try {
            izgara.secimiAyarla(sayfaAraligiCoz(metinGirdi.value, izgara.sayfaSayisi()));
            guncelleOzet();
          } catch (e) { hataYazi.textContent = e.message; }
        });
        kap.append(h('div', { class: 'alan' }, h('label', { for: 'aralik-metni' }, aralikEtiketi), metinGirdi, hataYazi));
      }
      kap.append(yardim ? h('p', { class: 'soluk' }, yardim) : '', cubuk, ozet, izgara.el);
    }

    return {
      el: kap,
      dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) {
          izgara?.kapat();
          izgara = null;
          aktif = null;
          kap.replaceChildren(d?.sifreli ? kutu('bilgi', 'Önce şifreyi girin.') : '');
          return;
        }
        if (aktif === d.id && eskiBayt === d.bayt) return;
        kur(d);
      },
      oku() {
        if (!izgara) throw new Error('Önce bir PDF seçin.');
        return {
          secilenler: izgara.secilenler(),
          metin: metinGirdi?.value ?? aralikMetni(izgara.secilenler()),
          sira: izgara.sira(),
          donusler: izgara.donusler(),
          sayfaSayisi: izgara.sayfaSayisi(),
        };
      },
    };
  };
}
