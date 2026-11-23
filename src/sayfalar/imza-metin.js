import { aracKur } from '../ui/arac.js';
import { h, kutu, dosyaOku, kullaniciMesaji } from '../ui/yardim.js';
import { belgeAc } from '../core/render.js';
import { sayfayiCiz } from '../ui/onizleme.js';
import { damgaEkle } from '../core/damga.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';
import { YAZI_AILELERI } from '../core/fonts.js';
import { destekliResim, resimOlculeri } from '../ui/resim-yardim.js';

const CSS_AILE = {
  'liberation-serif': 'serif', caladea: 'serif', 'noto-serif': 'serif', 'liberation-mono': 'monospace',
};

aracKur({
  slug: 'imza-metin',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ekleyin ve yerleştirin',
  dugme: 'Belgeye uygula',
  notlar: [kutu('uyari', h('span', {}, h('b', {}, 'Bu bir görünür imzadır. '), 'Sayfaya konan bir resim ya da yazıdır; dijital (elektronik) imza değildir ve tek başına hukuki geçerlilik sağlamaz.'))],
  ayar() {
    const el = h('div', {});
    const durum = { ogeler: [], secili: null, sayac: 0, sekme: 'metin', cizim: null };
    let belge = null, aktifId = null, aktifBayt = null;
    let sayfaNo = 1, n = 1, ptW = 595, ptH = 842, olcek = 1;
    const urller = [];

    // ---- Sekmeler ----
    const sekmeAd = { metin: 'Metin kutusu', ciz: 'İmzamı çiz', resim: 'Resim yükle' };
    const sekmeDugmeleri = Object.entries(sekmeAd).map(([k, ad]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(k === 'metin'), onclick: () => sekmeSec(k),
    }, ad));
    const sekmeler = h('div', { class: 'sekmeler', role: 'tablist', 'aria-label': 'Eklenecek öğe türü' }, ...sekmeDugmeleri);

    // Metin paneli
    const metinGirdi = h('textarea', { id: 'dm-metin', rows: 3, placeholder: 'Örn. Onaylıdır — 23.11.2026' });
    const aileSecim = h('select', { id: 'dm-aile' }, ...Object.entries(YAZI_AILELERI).map(([k, b]) => h('option', { value: k }, b.ad)));
    const boyutGirdi = h('input', { type: 'number', id: 'dm-boyut', min: 6, max: 72, value: 14 });
    const renkGirdi = h('input', { type: 'color', id: 'dm-renk', value: '#000000' });
    const kalinOnay = h('input', { type: 'checkbox', id: 'dm-kalin' });
    const arkaOnay = h('input', { type: 'checkbox', id: 'dm-arka' });
    const arkaRenk = h('input', { type: 'color', id: 'dm-arka-renk', value: '#ffffcc' });
    const cerceveOnay = h('input', { type: 'checkbox', id: 'dm-cerceve' });
    const metinPanel = h('div', { class: 'alanlar' },
      h('div', { class: 'alan genis' }, h('label', { for: 'dm-metin' }, 'Yazı'), metinGirdi),
      h('div', { class: 'alan' }, h('label', { for: 'dm-aile' }, 'Yazı tipi'), aileSecim),
      h('div', { class: 'alan' }, h('label', { for: 'dm-boyut' }, 'Boyut (pt)'), boyutGirdi),
      h('div', { class: 'alan' }, h('label', { for: 'dm-renk' }, 'Yazı rengi'), renkGirdi),
      h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, kalinOnay, h('label', { for: 'dm-kalin' }, 'Kalın'))),
      h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, arkaOnay, h('label', { for: 'dm-arka' }, 'Arka plan rengi')), arkaRenk),
      h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, cerceveOnay, h('label', { for: 'dm-cerceve' }, 'Çerçeve çiz'))));

    // Çizim paneli
    const pad = h('canvas', { class: 'imza-tahtasi', width: 960, height: 320, 'aria-label': 'İmza çizim alanı. Parmağınızla ya da fareyle çizin.' });
    const padRenk = h('select', { id: 'dm-pad-renk', 'aria-label': 'Kalem rengi' },
      h('option', { value: '#000000' }, 'Siyah'), h('option', { value: '#1b3fa0' }, 'Lacivert'), h('option', { value: '#0b6b2e' }, 'Yeşil'));
    const padTemizle = h('button', { type: 'button', onclick: () => { pad.getContext('2d').clearRect(0, 0, pad.width, pad.height); durum.cizim = null; } }, 'Temizle');
    const cizPanel = h('div', { hidden: true }, h('p', { class: 'soluk' }, 'Aşağıdaki alana parmağınızla ya da fareyle imzanızı çizin.'), pad,
      h('div', { class: 'eylem' }, padRenk, padTemizle));
    padKur();

    // Resim paneli
    const resimGirdi = h('input', { type: 'file', id: 'dm-resim', accept: 'image/*' });
    const resimPanel = h('div', { hidden: true }, h('div', { class: 'alan' }, h('label', { for: 'dm-resim' }, 'İmza ya da resim dosyası (PNG, JPEG ve diğerleri)'), resimGirdi,
      h('small', {}, 'Saydam arka planlı PNG en iyi sonucu verir.')));

    const ekleDugme = h('button', { type: 'button', class: 'birincil', onclick: ekle }, '＋ Bu sayfaya ekle');
    const hataYer = h('div', { 'aria-live': 'polite' });

    // ---- Önizleme ----
    const sahne = h('div', { class: 'sahne-kap' });
    const sahneKap = h('div', { class: 'sahne-orta' }, sahne);
    const etiket = h('span', { 'aria-live': 'polite' });
    const geri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Önceki sayfa', onclick: () => git(sayfaNo - 1) }, '‹');
    const ileri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Sonraki sayfa', onclick: () => git(sayfaNo + 1) }, '›');
    const nav = h('div', { class: 'onizleme-kontrol' }, geri, etiket, ileri);
    const liste = h('ul', { class: 'yerlesim-liste', 'aria-label': 'Eklenen öğeler' });
    const secimKontrol = h('div', { class: 'alanlar', hidden: true });

    el.append(
      h('h3', {}, 'Eklenecek öğe'), sekmeler, metinPanel, cizPanel, resimPanel,
      h('div', { class: 'eylem', stil: { marginTop: '12px' } }, ekleDugme), hataYer,
      h('h3', { stil: { marginTop: '20px' } }, 'Yerleştirme'),
      h('p', { class: 'soluk' }, 'Eklediğiniz öğeyi sayfa üzerinde sürükleyerek istediğiniz yere taşıyın. Boyutunu aşağıdan ayarlayın.'),
      nav, sahneKap, secimKontrol, liste);

    function sekmeSec(k) {
      durum.sekme = k;
      sekmeDugmeleri.forEach((b, i) => b.setAttribute('aria-selected', String(Object.keys(sekmeAd)[i] === k)));
      metinPanel.hidden = k !== 'metin';
      cizPanel.hidden = k !== 'ciz';
      resimPanel.hidden = k !== 'resim';
    }

    // ---- Çizim tahtası ----
    function padKur() {
      const g = pad.getContext('2d');
      let cizim = false, son = null;
      const nokta = (e) => {
        const r = pad.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * pad.width, ((e.clientY - r.top) / r.height) * pad.height];
      };
      pad.addEventListener('pointerdown', (e) => {
        cizim = true; son = nokta(e); pad.setPointerCapture(e.pointerId);
        g.fillStyle = padRenk.value; g.beginPath(); g.arc(son[0], son[1], 3, 0, 7); g.fill();
        durum.cizim = true;
      });
      pad.addEventListener('pointermove', (e) => {
        if (!cizim) return;
        const p = nokta(e);
        g.strokeStyle = padRenk.value; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(son[0], son[1]); g.lineTo(p[0], p[1]); g.stroke();
        son = p;
      });
      const bitir = () => { cizim = false; };
      pad.addEventListener('pointerup', bitir);
      pad.addEventListener('pointercancel', bitir);
    }

    async function padPngYap() {
      const g = pad.getContext('2d');
      const { data, width, height } = g.getImageData(0, 0, pad.width, pad.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) throw new PdfHatasi('Önce imzanızı çizin.');
      const m = 6;
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(width - 1, x1 + m); y1 = Math.min(height - 1, y1 + m);
      const c = document.createElement('canvas');
      c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
      c.getContext('2d').drawImage(pad, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return { bayt: new Uint8Array(await blob.arrayBuffer()), oran: c.height / c.width };
    }

    // ---- Öğe ekleme ----
    async function ekle() {
      hataYer.replaceChildren();
      try {
        if (!belge) throw new PdfHatasi('Önce bir PDF seçin.');
        const o = { id: ++durum.sayac, sayfa: sayfaNo - 1 };
        if (durum.sekme === 'metin') {
          const metin = metinGirdi.value;
          if (!metin.trim()) throw new PdfHatasi('Önce eklenecek yazıyı girin.');
          const boyut = Math.max(6, Number(boyutGirdi.value) || 14);
          const satir = metin.split('\n').length;
          Object.assign(o, {
            tur: 'metin', metin, aile: aileSecim.value, kalin: kalinOnay.checked, boyut, renk: renkGirdi.value,
            arkaPlan: arkaOnay.checked ? arkaRenk.value : null, cerceve: cerceveOnay.checked ? '#000000' : null,
            genislik: Math.min(ptW - 20, Math.max(120, Math.max(...metin.split('\n').map((s) => s.length)) * boyut * 0.6 + 16)),
            yukseklik: Math.min(ptH - 20, satir * boyut * 1.35 + 14),
          });
        } else {
          let bayt, oran;
          if (durum.sekme === 'ciz') ({ bayt, oran } = await padPngYap());
          else {
            const f = resimGirdi.files?.[0];
            if (!f) throw new PdfHatasi('Önce bir resim dosyası seçin.');
            bayt = await destekliResim(await dosyaOku(f));
            const b = await resimOlculeri(bayt);
            oran = b.yukseklik / b.genislik;
          }
          const genislik = Math.min(ptW * 0.4, 180);
          Object.assign(o, { tur: 'resim', bayt, oran, genislik, yukseklik: genislik * oran });
          o.url = URL.createObjectURL(new Blob([bayt], { type: 'image/png' }));
          urller.push(o.url);
        }
        o.x = Math.max(0, (ptW - o.genislik) / 2);
        o.y = Math.max(0, (ptH - o.yukseklik) / 2);
        durum.ogeler.push(o);
        durum.secili = o.id;
        ciz();
      } catch (e) {
        hataYer.replaceChildren(kutu('hata', kullaniciMesaji(e)));
      }
    }

    // ---- Çizim (yerleşimler) ----
    function ciz() {
      sahne.querySelectorAll('.yerlesim').forEach((x) => x.remove());
      for (const o of durum.ogeler.filter((x) => x.sayfa === sayfaNo - 1)) {
        const kutuEl = h('div', {
          class: `yerlesim ${o.id === durum.secili ? 'secili' : ''}`, tabindex: '0', role: 'group',
          'aria-label': `${o.tur === 'metin' ? 'Metin kutusu' : 'Resim'}, sürükleyerek taşıyın`,
        });
        Object.assign(kutuEl.style, {
          left: `${o.x * olcek}px`, top: `${(ptH - o.y - o.yukseklik) * olcek}px`,
          width: `${o.genislik * olcek}px`, height: `${o.yukseklik * olcek}px`,
        });
        if (o.tur === 'resim') kutuEl.append(h('img', { src: o.url, alt: '' }));
        else {
          Object.assign(kutuEl.style, {
            fontSize: `${o.boyut * olcek}px`, color: o.renk, background: o.arkaPlan ?? 'rgba(255,255,255,0)',
            border: o.cerceve ? `1px solid ${o.cerceve}` : '2px solid var(--vurgu)', fontWeight: o.kalin ? '700' : '400',
            fontFamily: CSS_AILE[o.aile] ?? 'sans-serif', padding: `${Math.min(6, o.boyut * 0.4) * olcek}px`, whiteSpace: 'pre-wrap',
          });
          kutuEl.textContent = o.metin;
        }
        surukleKur(kutuEl, o);
        sahne.append(kutuEl);
      }
      listeCiz();
    }

    function surukleKur(kutuEl, o) {
      let bas = null;
      kutuEl.addEventListener('pointerdown', (e) => {
        durum.secili = o.id;
        bas = { px: e.clientX, py: e.clientY, x: o.x, y: o.y };
        kutuEl.setPointerCapture(e.pointerId);
        e.preventDefault();
        listeCiz();
      });
      kutuEl.addEventListener('pointermove', (e) => {
        if (!bas) return;
        const r = sahne.querySelector('canvas').getBoundingClientRect();
        const pxPt = (ptW * olcek) / r.width; // ekran pikseli → "kendi" piksel
        o.x = Math.min(Math.max(0, bas.x + ((e.clientX - bas.px) * pxPt) / olcek), ptW - o.genislik);
        o.y = Math.min(Math.max(0, bas.y - ((e.clientY - bas.py) * pxPt) / olcek), ptH - o.yukseklik);
        kutuEl.style.left = `${o.x * olcek}px`;
        kutuEl.style.top = `${(ptH - o.y - o.yukseklik) * olcek}px`;
      });
      const bit = () => { bas = null; };
      kutuEl.addEventListener('pointerup', bit);
      kutuEl.addEventListener('pointercancel', bit);
      kutuEl.addEventListener('keydown', (e) => {
        const adim = e.shiftKey ? 10 : 2;
        const d = { ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, adim], ArrowDown: [0, -adim] }[e.key];
        if (!d) return;
        e.preventDefault();
        o.x = Math.min(Math.max(0, o.x + d[0]), ptW - o.genislik);
        o.y = Math.min(Math.max(0, o.y + d[1]), ptH - o.yukseklik);
        kutuEl.style.left = `${o.x * olcek}px`;
        kutuEl.style.top = `${(ptH - o.y - o.yukseklik) * olcek}px`;
      });
    }

    function listeCiz() {
      liste.replaceChildren(...durum.ogeler.map((o) => h('li', {},
        h('button', { type: 'button', class: 'kucuk-dugme', 'aria-pressed': String(o.id === durum.secili), onclick: () => { durum.secili = o.id; git(o.sayfa + 1); } },
          `Sayfa ${o.sayfa + 1}: ${o.tur === 'metin' ? `“${o.metin.slice(0, 24)}${o.metin.length > 24 ? '…' : ''}”` : 'resim / imza'}`),
        h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => { durum.ogeler = durum.ogeler.filter((x) => x.id !== o.id); if (durum.secili === o.id) durum.secili = null; ciz(); } }, 'Sil'))));
      const s = durum.ogeler.find((o) => o.id === durum.secili);
      secimKontrol.hidden = !s;
      secimKontrol.replaceChildren();
      if (s) {
        const gen = h('input', { type: 'range', id: 'dm-gen', min: 20, max: Math.round(ptW), value: Math.round(s.genislik) });
        gen.addEventListener('input', () => {
          s.genislik = Number(gen.value);
          if (s.tur === 'resim') s.yukseklik = s.genislik * s.oran;
          s.x = Math.min(s.x, ptW - s.genislik); s.y = Math.min(s.y, ptH - s.yukseklik);
          ciz();
        });
        secimKontrol.append(h('div', { class: 'alan' }, h('label', { for: 'dm-gen' }, 'Seçili öğenin genişliği'), gen));
        if (s.tur === 'metin') {
          const yuk = h('input', { type: 'range', id: 'dm-yuk', min: 10, max: Math.round(ptH / 2), value: Math.round(s.yukseklik) });
          yuk.addEventListener('input', () => { s.yukseklik = Number(yuk.value); s.y = Math.min(s.y, ptH - s.yukseklik); ciz(); });
          secimKontrol.append(h('div', { class: 'alan' }, h('label', { for: 'dm-yuk' }, 'Seçili öğenin yüksekliği'), yuk));
        }
      }
    }

    async function git(no) {
      if (!belge || no < 1 || no > n) return;
      sayfaNo = no;
      geri.disabled = no <= 1;
      ileri.disabled = no >= n;
      etiket.textContent = `Sayfa ${no} / ${n}`;
      try {
        const r = await sayfayiCiz(belge, no, Math.min(560, sahneKap.clientWidth || 560));
        r.tuval.setAttribute('aria-label', `${no}. sayfa`);
        olcek = r.olcek; ptW = r.ptGenislik; ptH = r.ptYukseklik;
        sahne.querySelector('canvas')?.remove();
        sahne.prepend(r.tuval);
        ciz();
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
        durum.ogeler = []; durum.secili = null;
        belge?.kapat?.();
        belge = await belgeAc(d.bayt);
        n = belge.numPages;
        await git(1);
      },
      oku() {
        if (!durum.ogeler.length) throw new PdfHatasi('Önce sayfaya bir imza, resim ya da metin kutusu ekleyin.');
        return {
          ogeler: durum.ogeler.map((o) => ({
            sayfa: o.sayfa, tur: o.tur, x: o.x, y: o.y, genislik: o.genislik, yukseklik: o.yukseklik,
            metin: o.metin, aile: o.aile, kalin: o.kalin, boyut: o.boyut, renk: o.renk, arkaPlan: o.arkaPlan, cerceve: o.cerceve, bayt: o.bayt,
          })),
        };
      },
    };
  },
  async calistir({ dosyalar, ayarlar }) {
    const d = dosyalar[0];
    const s = await damgaEkle(d.bayt, ayarlar.ogeler);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-imzali'), bayt: s.bayt }],
      uyarilar: ['Eklenen imza görünür bir resim/yazıdır; dijital imza değildir.', ...s.uyarilar],
      mesaj: `${s.eklenen} öğe belgeye eklendi.`,
    };
  },
});
