// Sayfa küçük resimleri ızgarası: seçme, sıralama ve döndürme için ortak bileşen.
import { h } from './yardim.js';
import { belgeAc, sayfaCiz } from '../core/render.js';

/**
 * @param secenek.bayt    PDF baytları (şifresiz)
 * @param secenek.mod     'sec' | 'sil' (seçilenler kırmızı) | 'sirala' | 'dondur'
 * @param secenek.degisti her değişiklikte çağrılır
 */
export function sayfaIzgarasi({ bayt, mod, degisti = () => {} }) {
  const el = h('div', { class: 'izgara', role: 'list' });
  let belge = null;
  let kapali = false;
  let ogeler = []; // ekranda görünen sırayla: {indeks, don, secili, kart}
  const kuyruk = [];
  let calisiyor = false;

  const gozlemci = 'IntersectionObserver' in window
    ? new IntersectionObserver((girisler) => {
      for (const g of girisler) if (g.isIntersecting) { gozlemci.unobserve(g.target); kuyruk.push(g.target._oge); }
      kuyrukIsle();
    }, { rootMargin: '300px' })
    : null;

  async function kuyrukIsle() {
    if (calisiyor) return;
    calisiyor = true;
    while (kuyruk.length && !kapali) {
      const o = kuyruk.shift();
      try {
        const { tuval } = await sayfaCiz(belge, o.indeks + 1, { olcek: 0.3 });
        tuval.style.width = '';
        tuval.setAttribute('aria-hidden', 'true');
        o.sahne.replaceChildren(tuval);
        o.tuval = tuval;
        don_uygula(o);
      } catch {
        o.sahne.textContent = '?';
      }
    }
    calisiyor = false;
  }

  function don_uygula(o) {
    if (!o.tuval) return;
    const yan = o.don % 180 !== 0;
    o.tuval.style.transform = o.don ? `rotate(${o.don}deg)${yan ? ' scale(0.72)' : ''}` : '';
  }

  function kartKur(o) {
    o.sahne = h('div', { class: 'kucuk-sahne' }, '…');
    const etiket = h('span', { class: 'sayfa-etiket' });
    o.etiket = etiket;
    let kart;
    if (mod === 'sec' || mod === 'sil') {
      kart = h('button', {
        type: 'button', class: `sayfa-kart ${mod === 'sil' ? 'silinecek' : ''}`, role: 'listitem',
        'aria-pressed': 'false',
        onclick: () => { o.secili = !o.secili; yenile(); degisti(); },
      }, h('span', { class: 'secim-imi', 'aria-hidden': 'true' }, '✓'), o.sahne, etiket);
    } else {
      const kontrol = h('div', { class: 'sayfa-kontrol' });
      kart = h('div', { class: 'sayfa-kart', role: 'listitem' }, o.sahne, etiket, kontrol);
      if (mod === 'sirala') {
        kart.draggable = true;
        kontrol.append(
          h('button', { type: 'button', 'aria-label': 'Başa taşı', title: 'En başa', onclick: () => tasiMutlak(o, 0) }, '⏮'),
          h('button', { type: 'button', 'aria-label': 'Bir geri taşı', title: 'Bir geri', onclick: () => tasi(o, -1) }, '◀'),
          h('button', { type: 'button', 'aria-label': 'Bir ileri taşı', title: 'Bir ileri', onclick: () => tasi(o, 1) }, '▶'),
          h('button', { type: 'button', 'aria-label': 'Sona taşı', title: 'En sona', onclick: () => tasiMutlak(o, ogeler.length - 1) }, '⏭'));
        kart.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(o.indeks)); kart.classList.add('surukleniyor'); el._suruklenen = o; });
        kart.addEventListener('dragend', () => { kart.classList.remove('surukleniyor'); ogeler.forEach((x) => x.kart.classList.remove('hedef')); });
        kart.addEventListener('dragover', (e) => { e.preventDefault(); kart.classList.add('hedef'); });
        kart.addEventListener('dragleave', () => kart.classList.remove('hedef'));
        kart.addEventListener('drop', (e) => {
          e.preventDefault();
          kart.classList.remove('hedef');
          const s = el._suruklenen;
          if (s && s !== o) tasiMutlak(s, ogeler.indexOf(o));
        });
      } else if (mod === 'dondur') {
        kontrol.append(
          h('button', { type: 'button', 'aria-label': `Sayfa ${o.indeks + 1}: saat yönünün tersine döndür`, onclick: () => dondur(o, -90) }, '↺'),
          h('button', { type: 'button', 'aria-label': `Sayfa ${o.indeks + 1}: saat yönünde döndür`, onclick: () => dondur(o, 90) }, '↻'));
      }
    }
    kart._oge = o;
    o.kart = kart;
    return kart;
  }

  function yenile() {
    ogeler.forEach((o, i) => {
      if (mod === 'sec' || mod === 'sil') {
        o.kart.setAttribute('aria-pressed', String(o.secili));
        o.etiket.textContent = `Sayfa ${o.indeks + 1}`;
        o.kart.setAttribute('aria-label', `Sayfa ${o.indeks + 1}${o.secili ? ' (seçili)' : ''}`);
      } else if (mod === 'sirala') {
        o.etiket.textContent = `${i + 1}. sırada (eski ${o.indeks + 1})`;
      } else {
        o.etiket.textContent = `Sayfa ${o.indeks + 1}${o.don ? ` · ${(o.don + 360) % 360}°` : ''}`;
      }
    });
    el.replaceChildren(...ogeler.map((o) => o.kart));
  }

  function tasi(o, yon) { tasiMutlak(o, ogeler.indexOf(o) + yon); }
  function tasiMutlak(o, hedef) {
    const i = ogeler.indexOf(o);
    hedef = Math.max(0, Math.min(ogeler.length - 1, hedef));
    if (i === hedef) return;
    ogeler.splice(i, 1);
    ogeler.splice(hedef, 0, o);
    yenile();
    degisti();
    o.kart.querySelector('button')?.focus?.();
  }
  function dondur(o, aci) {
    o.don = (((o.don + aci) % 360) + 360) % 360;
    don_uygula(o);
    yenile();
    degisti();
  }

  (async () => {
    try {
      belge = await belgeAc(bayt);
      ogeler = Array.from({ length: belge.numPages }, (_, indeks) => ({ indeks, don: 0, secili: false }));
      ogeler.forEach(kartKur);
      yenile();
      ogeler.forEach((o) => (gozlemci ? gozlemci.observe(o.kart) : kuyruk.push(o)));
      if (!gozlemci) kuyrukIsle();
      degisti();
    } catch (e) {
      el.replaceChildren(h('p', { class: 'soluk' }, `Sayfalar gösterilemedi: ${e.message}`));
    }
  })();

  return {
    el,
    sayfaSayisi: () => ogeler.length,
    secilenler: () => ogeler.filter((o) => o.secili).map((o) => o.indeks).sort((a, b) => a - b),
    secimiAyarla(dizinler) {
      const k = new Set(dizinler);
      ogeler.forEach((o) => { o.secili = k.has(o.indeks); });
      if (ogeler.length) yenile();
    },
    tumunuSec() { ogeler.forEach((o) => { o.secili = true; }); yenile(); degisti(); },
    temizle() { ogeler.forEach((o) => { o.secili = false; }); yenile(); degisti(); },
    tersSec() { ogeler.forEach((o) => { o.secili = !o.secili; }); yenile(); degisti(); },
    sira: () => ogeler.map((o) => o.indeks),
    tersCevir() { ogeler.reverse(); yenile(); degisti(); },
    donusler: () => Object.fromEntries(ogeler.filter((o) => o.don).map((o) => [o.indeks, o.don])),
    tumunuDondur(aci) { ogeler.forEach((o) => { o.don = (((o.don + aci) % 360) + 360) % 360; don_uygula(o); }); yenile(); degisti(); },
    sifirla() { ogeler.forEach((o) => { o.don = 0; don_uygula(o); }); yenile(); degisti(); },
    kapat() { kapali = true; gozlemci?.disconnect(); belge?.kapat?.(); },
  };
}
