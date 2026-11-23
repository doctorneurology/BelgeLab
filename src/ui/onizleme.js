// Sayfa çizimi ve önizleme yardımcıları (pdf.js).
import { h } from './yardim.js';
import { belgeAc, sayfaCiz } from '../core/render.js';

/**
 * Bir sayfayı, ekranda verilen genişliğe sığacak şekilde çizer.
 * Dönen tuval, sayfanın EKRANDA görünen yönündedir (döndürülmüş sayfalar dahil).
 */
export async function sayfayiCiz(belge, sayfaNo, hedefGenislikCss = 640) {
  const sayfa = await belge.getPage(sayfaNo);
  const vp1 = sayfa.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssOlcek = Math.min(hedefGenislikCss / vp1.width, 3);
  const { tuval } = await sayfaCiz(belge, sayfaNo, { olcek: cssOlcek * dpr });
  tuval.style.width = `${Math.round(vp1.width * cssOlcek)}px`;
  tuval.style.height = 'auto';
  return { tuval, olcek: cssOlcek, ptGenislik: vp1.width, ptYukseklik: vp1.height };
}

/** Sonuç PDF'inin sayfalarını gezilebilir küçük bir önizleme olarak gösterir. */
export function pdfOnizleme(bayt, { genislik = 520 } = {}) {
  const kap = h('div', { class: 'onizleme' });
  const sahne = h('div', {});
  const etiket = h('span', { 'aria-live': 'polite' }, '');
  let belge = null, no = 1, n = 1;
  const geri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Önceki sayfa', onclick: () => git(no - 1) }, '‹');
  const ileri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Sonraki sayfa', onclick: () => git(no + 1) }, '›');
  const kontrol = h('div', { class: 'onizleme-kontrol' }, geri, etiket, ileri);
  kap.append(sahne, kontrol);

  async function git(yeni) {
    if (!belge || yeni < 1 || yeni > n) return;
    no = yeni;
    geri.disabled = no <= 1;
    ileri.disabled = no >= n;
    etiket.textContent = `Önizleme: sayfa ${no} / ${n}`;
    try {
      const { tuval } = await sayfayiCiz(belge, no, Math.min(genislik, kap.clientWidth || genislik));
      tuval.setAttribute('role', 'img');
      tuval.setAttribute('aria-label', `Sonuç belgesinin ${no}. sayfası`);
      sahne.replaceChildren(tuval);
    } catch (e) {
      sahne.replaceChildren(h('p', { class: 'soluk' }, `Önizleme gösterilemedi: ${e.message}`));
    }
  }

  (async () => {
    try {
      belge = await belgeAc(bayt);
      n = belge.numPages;
      kontrol.hidden = n <= 1;
      await git(1);
    } catch {
      kap.replaceChildren(h('p', { class: 'soluk' }, 'Önizleme gösterilemedi (dosya yine de indirilebilir).'));
    }
  })();
  kap.kapat = () => belge?.kapat?.();
  return kap;
}
