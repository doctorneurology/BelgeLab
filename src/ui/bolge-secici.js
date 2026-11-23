// Sayfa üzerinde fareyle / parmakla dikdörtgen bölge seçme bileşeni.
// Karartma ve taranmış belgede yazı düzeltme sayfaları kullanır. Koordinatlar "görünür sayfa noktası"dır
// (orijin ekranda görünen sol-alt köşe), böylece çekirdek işlevlere doğrudan verilebilir.
import { h } from './yardim.js';
import { sayfayiCiz } from './onizleme.js';

let sayac = 0;

/**
 * @param secenek.onDegisti  () => void  (kutu eklenince/silinince/değişince)
 * @param secenek.oneriler   (sayfaNo) => [{ id, kutu:{x0,y0,x1,y1}, baslik, sinif }]  tıklanabilir öneri kutuları (ör. OCR satırları)
 * @param secenek.onOneri    (oneri) => void
 * @param secenek.kutuSinifi (kutu) => string  kutuya eklenecek CSS sınıfı
 */
export function bolgeSecici({ onDegisti = () => {}, oneriler = () => [], onOneri = () => {}, onSec = () => {}, kutuSinifi = () => '' } = {}) {
  const st = { belge: null, sayfaSayisi: 0, no: 1, kutular: [], secili: null, ptW: 595, ptH: 842, olcek: 1, cizimModu: true };
  const sahne = h('div', { class: 'sahne-kap bs-sahne' });
  const etiket = h('span', { 'aria-live': 'polite' });
  const geri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Önceki sayfa', onclick: () => git(st.no - 1) }, '‹');
  const ileri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Sonraki sayfa', onclick: () => git(st.no + 1) }, '›');
  const mod = h('button', {
    type: 'button', class: 'kucuk-dugme', 'aria-pressed': 'true', title: 'Telefonda sayfayı kaydırmak için kapatın',
    onclick: () => { st.cizimModu = !st.cizimModu; moduGuncelle(); },
  }, '✏️ Bölge çiz: açık');
  const nav = h('div', { class: 'onizleme-kontrol' }, geri, etiket, ileri, mod);
  const ipucu = h('p', { class: 'soluk bs-ipucu' }, 'Sayfa üzerinde sürükleyerek bir dikdörtgen çizin. Çizdiğiniz alan kırmızı görünür; ✕ ile silebilirsiniz.');
  const el = h('div', { class: 'bs' }, ipucu, nav, h('div', { class: 'sahne-orta' }, sahne));

  function moduGuncelle() {
    mod.setAttribute('aria-pressed', String(st.cizimModu));
    mod.textContent = st.cizimModu ? '✏️ Bölge çiz: açık' : '✋ Kaydır (çizim kapalı)';
    sahne.classList.toggle('bs-kaydir', !st.cizimModu);
  }

  const pt = (px, py) => [px / st.olcek, st.ptH - py / st.olcek];

  async function git(no) {
    if (!st.belge || no < 1 || no > st.sayfaSayisi) return;
    st.no = no;
    geri.disabled = no <= 1;
    ileri.disabled = no >= st.sayfaSayisi;
    etiket.textContent = `Sayfa ${no} / ${st.sayfaSayisi}`;
    const r = await sayfayiCiz(st.belge, no, Math.min(820, el.clientWidth || 640));
    if (st.no !== no) return;
    r.tuval.setAttribute('aria-hidden', 'true');
    st.ptW = r.ptGenislik; st.ptH = r.ptYukseklik; st.olcek = r.olcek;
    sahne.replaceChildren(r.tuval);
    kutulariCiz();
  }

  function kutuYerlestir(e, k, sinif) {
    Object.assign(e.style, {
      left: `${(k.x0 / st.ptW) * 100}%`, top: `${((st.ptH - k.y1) / st.ptH) * 100}%`,
      width: `${((k.x1 - k.x0) / st.ptW) * 100}%`, height: `${((k.y1 - k.y0) / st.ptH) * 100}%`,
    });
    if (sinif) e.classList.add(...sinif.split(' ').filter(Boolean));
  }

  function kutulariCiz() {
    sahne.querySelectorAll('.bs-kutu, .bs-oneri, .bs-gecici').forEach((x) => x.remove());
    for (const o of oneriler(st.no) ?? []) {
      const b = h('button', { type: 'button', class: `bs-oneri ${o.sinif ?? ''}`, title: o.baslik ?? '', 'aria-label': o.baslik ?? 'Öneri', onclick: (ev) => { ev.stopPropagation(); onOneri(o); } });
      kutuYerlestir(b, o.kutu);
      sahne.append(b);
    }
    for (const k of st.kutular.filter((x) => x.sayfa === st.no)) {
      const b = h('div', { class: `bs-kutu${st.secili === k.id ? ' secili' : ''}`, 'data-id': k.id, tabindex: '0', role: 'button', 'aria-label': `Seçili bölge${k.etiket ? `: ${k.etiket}` : ''}`,
        onpointerdown: (ev) => ev.stopPropagation(),
        onclick: (ev) => { ev.stopPropagation(); sec(k.id); },
        onkeydown: (ev) => { if (ev.key === 'Delete' || ev.key === 'Backspace') sil(k.id); if (ev.key === 'Enter') sec(k.id); },
      }, h('button', { type: 'button', class: 'bs-sil', 'aria-label': 'Bu bölgeyi sil', onpointerdown: (ev) => ev.stopPropagation(), onclick: (ev) => { ev.stopPropagation(); sil(k.id); } }, '✕'));
      kutuYerlestir(b, k, kutuSinifi(k));
      sahne.append(b);
    }
  }

  // ---- Çizim (fare + dokunma) ----
  let cizim = null;
  sahne.addEventListener('pointerdown', (ev) => {
    if (!st.cizimModu || ev.button > 0 || !sahne.querySelector('canvas')) return;
    const r = sahne.getBoundingClientRect();
    cizim = { x: ev.clientX - r.left, y: ev.clientY - r.top, gecici: h('div', { class: 'bs-gecici' }) };
    sahne.append(cizim.gecici);
    sahne.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  sahne.addEventListener('pointermove', (ev) => {
    if (!cizim) return;
    const r = sahne.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left)), y = Math.max(0, Math.min(r.height, ev.clientY - r.top));
    Object.assign(cizim.gecici.style, { left: `${Math.min(cizim.x, x)}px`, top: `${Math.min(cizim.y, y)}px`, width: `${Math.abs(x - cizim.x)}px`, height: `${Math.abs(y - cizim.y)}px` });
    cizim.son = [x, y];
  });
  const bitir = (ev) => {
    if (!cizim) return;
    const { x, y, son, gecici } = cizim;
    cizim = null;
    gecici.remove();
    try { sahne.releasePointerCapture(ev.pointerId); } catch { /* yok */ }
    if (!son || Math.abs(son[0] - x) < 6 || Math.abs(son[1] - y) < 6) return;
    const r = sahne.getBoundingClientRect();
    // piksel → sayfa noktası (tuvalin gerçek gösterim boyutuna göre)
    const olcek = r.width / st.ptW;
    const [ax, ay] = [Math.min(x, son[0]) / olcek, Math.min(y, son[1]) / olcek];
    const [bx, by] = [Math.max(x, son[0]) / olcek, Math.max(y, son[1]) / olcek];
    ekle(st.no, { x0: ax, x1: bx, y0: st.ptH - by, y1: st.ptH - ay });
  };
  sahne.addEventListener('pointerup', bitir);
  sahne.addEventListener('pointercancel', bitir);

  function ekle(sayfa, kutu, veri = {}) {
    const k = { id: `b${++sayac}`, sayfa, ...kutu, ...veri };
    st.kutular.push(k);
    st.secili = k.id;
    kutulariCiz();
    onDegisti();
    onSec(k);
    return k;
  }
  function sil(id) {
    st.kutular = st.kutular.filter((k) => k.id !== id);
    if (st.secili === id) st.secili = null;
    kutulariCiz();
    onDegisti();
  }
  function sec(id) {
    st.secili = id;
    kutulariCiz();
    onSec(st.kutular.find((k) => k.id === id) ?? null);
  }

  return {
    el,
    durum: st,
    async belgeAyarla(belge) {
      st.belge = belge;
      st.sayfaSayisi = belge?.numPages ?? 0;
      st.kutular = []; st.secili = null; st.no = 1;
      if (belge) await git(1); else sahne.replaceChildren();
    },
    git,
    yenile: kutulariCiz,
    kutular: () => st.kutular,
    ekle, sil, sec,
    temizle() { st.kutular = []; st.secili = null; kutulariCiz(); onDegisti(); },
    guncelle(id, veri) { const k = st.kutular.find((x) => x.id === id); if (k) Object.assign(k, veri); kutulariCiz(); },
    ipucuAyarla(m) { ipucu.textContent = m; },
  };
}
