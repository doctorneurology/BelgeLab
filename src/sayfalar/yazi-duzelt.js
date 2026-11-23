// Yazı düzelt: sayfadaki yazıya tıkla, düzelt; sayfa düzeni (logo, çizgi, imza alanı...) aynen kalır.
import { aracKur } from '../ui/arac.js';
import { h, kutu, boyamaBekle } from '../ui/yardim.js';
import { belgeAc } from '../core/render.js';
import { sayfayiCiz } from '../ui/onizleme.js';
import { yaziAnalizEt, yaziDuzelt } from '../core/yazi/motor.js';
import { dogrula } from '../core/yazi/dogrulama.js';
import { SINIR } from '../core/yazi/analiz.js';
import { YAZI_AILELERI, yaziTipiOlcer } from '../core/fonts.js';
import { dosyaAdiTuret, sayfaSecimi } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

const COK_SAYFA = 40;
const aileSecenekleri = (secili) => Object.entries(YAZI_AILELERI).map(([k, a]) => h('option', { value: k, selected: k === secili }, `${a.ad} — ${a.benzer}`));
const pt = (x) => `${x.toFixed(1).replace('.', ',')} pt`;

let sonOrijinal = null;

aracKur({
  slug: 'yazi-duzelt',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Yazıya tıklayın ve düzeltin',
  dugme: 'Düzeltilmiş PDF’i oluştur',
  notlar: [kutu('bilgi', h('span', {},
    'Sayfanın kendisi (boyut, kenar boşlukları, logo, çizgiler, arka plan, imza ve form alanları, bağlantılar) değişmez. ',
    'Yalnızca yazılar, orijinal yazı tipinin ölçü uyumlu açık karşılığıyla aynı yerlerine yeniden yazılır. ',
    'Taranmış (resim) belgeler henüz desteklenmiyor.'))],
  ayar() {
    const st = {
      bayt: null, ad: '', ozet: null, belge: null, no: 1, secili: null,
      degisiklikler: {}, kilitAcik: new Set(), esleme: {}, sayfalar: null, aktifId: null,
    };
    const el = h('div', { class: 'yd' });
    const durumAlani = h('div', { 'aria-live': 'polite' });
    const aralikGirdi = h('input', { type: 'text', id: 'yd-aralik', placeholder: 'ör. 1-20', inputmode: 'numeric' });
    const aralikAlani = h('div', { class: 'alan', hidden: true },
      h('label', { for: 'yd-aralik' }, 'Düzeltilecek sayfalar'),
      h('div', { class: 'eylem' }, aralikGirdi, h('button', { type: 'button', onclick: () => analizEt() }, 'Bu sayfaları aç')),
      h('small', { class: 'soluk' }, 'Çok sayfalı belgelerde yalnızca seçtiğiniz sayfalar incelenir; diğer sayfalara dokunulmaz.'));
    const fontAlani = h('details', { class: 'yd-fontlar' });
    const etiket = h('span', { 'aria-live': 'polite' });
    const geri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Önceki sayfa', onclick: () => git(st.no - 1) }, '‹');
    const ileri = h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': 'Sonraki sayfa', onclick: () => git(st.no + 1) }, '›');
    const gezgin = h('div', { class: 'onizleme-kontrol' }, geri, etiket, ileri);
    const lejant = h('p', { class: 'yd-lejant soluk' },
      h('span', { class: 'yd-ornek yd-normal' }), ' düzeltilebilir  ',
      h('span', { class: 'yd-ornek yd-duzenlendi' }), ' değiştirildi  ',
      h('span', { class: 'yd-ornek yd-kontrol' }), ' kontrol gerekli  ',
      h('span', { class: 'yd-ornek yd-korumali' }), ' korumalı (orijinal kalır)');
    const sahne = h('div', { class: 'sahne-kap yd-sahne' });
    const panel = h('div', { class: 'yd-panel', hidden: true });
    const liste = h('div', { class: 'yd-liste' });
    el.append(durumAlani, aralikAlani, fontAlani, lejant, gezgin, h('div', { class: 'sahne-orta' }, sahne), panel, liste);
    el.hidden = true;

    // ---- Analiz --------------------------------------------------------------------------------
    async function analizEt() {
      durumAlani.replaceChildren(h('p', { class: 'soluk' }, 'Belgedeki yazılar inceleniyor…'));
      await boyamaBekle();
      try {
        st.sayfalar = aralikAlani.hidden || !aralikGirdi.value.trim() ? (st.sayfaSayisi > COK_SAYFA ? sayfaSecimi(`1-${COK_SAYFA}`, st.sayfaSayisi) : null)
          : sayfaSecimi(aralikGirdi.value, st.sayfaSayisi);
        st.ozet = await yaziAnalizEt(st.bayt, { sayfalar: st.sayfalar, esleme: Object.keys(st.esleme).length ? st.esleme : null });
      } catch (e) {
        durumAlani.replaceChildren(kutu('hata', e.message ?? String(e)));
        return;
      }
      const tum = st.ozet.sayfalar.flatMap((s) => s.satirlar);
      const korumali = tum.filter((l) => l.koruma && l.koruma !== 'cozulemedi').length;
      const kontrol = tum.filter((l) => l.koruma === 'cozulemedi' || (!l.koruma && l.uyum && !l.uyum.tamam)).length;
      const parcalar = [];
      if (!st.ozet.yaziVar) parcalar.push(kutu('uyari', 'Bu sayfalarda düzeltilebilir yazı bulunamadı. Belge taranmış (resim) olabilir; taranmış belgeler için destek bir sonraki sürümde gelecek.'));
      if (st.ozet.imzali) parcalar.push(kutu('uyari', h('span', {}, h('b', {}, 'Bu belge dijital olarak imzalı. '), 'Yazı değiştirilince imza geçersiz olur. Çıktı İMZASIZ yeni bir dosya olacaktır; imza alanının görünümü sayfada kalır ama dijital imza değildir.')));
      parcalar.push(kutu('bilgi', `${tum.length} satır bulundu. ${korumali} satır korumalı (üst/alt bilgi, logo, süslü ya da döndürülmüş yazı) ve orijinal kalacak.`
        + (kontrol ? ` ${kontrol} satır yeni yazı tipine sığmadığı için orijinal bırakılacak (turuncu).` : '')));
      durumAlani.replaceChildren(...parcalar);
      fontlariGoster();
      if (!st.ozet.sayfalar.find((s) => s.no === st.no)) st.no = st.ozet.sayfalar[0]?.no ?? 1;
      await git(st.no);
      listeyiGoster();
    }

    function fontlariGoster() {
      const satirlar = st.ozet.yaziTipleri.map((f) => {
        const sec = h('select', { 'aria-label': `${f.ad} yerine kullanılacak yazı tipi` }, ...aileSecenekleri(f.secili.aile));
        const kalin = h('input', { type: 'checkbox', checked: !!f.secili.kalin, 'aria-label': 'Kalın' });
        const italik = h('input', { type: 'checkbox', checked: !!f.secili.italik, 'aria-label': 'İtalik' });
        const degisti = () => { st.esleme[f.anahtar] = { aile: sec.value, kalin: kalin.checked, italik: italik.checked }; analizEt(); };
        sec.onchange = degisti; kalin.onchange = degisti; italik.onchange = degisti;
        const tanim = { olcu: 'ölçü uyumlu', yakin: 'en yakın', tahmin: 'tahmin (genişliğe göre)' }[f.secili.tanindi] ?? 'sizin seçiminiz';
        return h('tr', {}, h('td', {}, f.ad), h('td', {}, sec), h('td', {}, h('label', { class: 'onay-satiri' }, kalin, 'K')), h('td', {}, h('label', { class: 'onay-satiri' }, italik, 'İ')), h('td', { class: 'soluk' }, tanim));
      });
      fontAlani.replaceChildren(
        h('summary', {}, `Yazı tipleri (${st.ozet.yaziTipleri.length}) — orijinal → kullanılacak açık karşılığı`),
        h('div', { class: 'tablo-kap' }, h('table', { class: 'yd-tablo' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Belgedeki'), h('th', {}, 'Yerine'), h('th', {}, 'Kalın'), h('th', {}, 'İtalik'), h('th', {}, 'Nasıl seçildi'))),
          h('tbody', {}, ...satirlar))));
    }

    // ---- Sayfa görünümü ---------------------------------------------------------------------------
    const sayfaOzet = () => st.ozet?.sayfalar.find((s) => s.no === st.no);
    function sinif(l) {
      if (st.degisiklikler[l.id]) return 'yd-duzenlendi';
      if (l.koruma && !(l.koruma === 'ustalt' && st.kilitAcik.has(l.id))) return l.koruma === 'cozulemedi' ? 'yd-kontrol' : 'yd-korumali';
      if (l.uyum && !l.uyum.tamam) return 'yd-kontrol';
      return 'yd-normal';
    }
    async function git(no) {
      const sayfalar = st.ozet?.sayfalar ?? [];
      const k = sayfalar.findIndex((s) => s.no === no);
      if (k < 0) return;
      st.no = no;
      geri.disabled = k <= 0; ileri.disabled = k >= sayfalar.length - 1;
      etiket.textContent = `Sayfa ${no} / ${st.sayfaSayisi}`;
      const r = await sayfayiCiz(st.belge, no, Math.min(820, sahne.parentElement.clientWidth || 640));
      r.tuval.setAttribute('aria-hidden', 'true');
      sahne.replaceChildren(r.tuval);
      kutulariCiz();
    }
    function kutulariCiz() {
      const s = sayfaOzet();
      if (!s) return;
      sahne.querySelectorAll('.yd-kutu').forEach((x) => x.remove());
      for (const l of s.satirlar) {
        const k = l.kutu;
        const b = h('button', {
          type: 'button', class: `yd-kutu ${sinif(l)}${st.secili === l.id ? ' yd-secili' : ''}`,
          title: l.koruma ? `${l.korumaAdi}` : 'Düzeltmek için tıklayın',
          'aria-label': `${st.degisiklikler[l.id]?.metin ?? l.metin}${l.koruma ? ` (korumalı: ${l.korumaAdi})` : ''}`,
          stil: {
            left: `${(k.x0 / s.genislik) * 100}%`, top: `${((s.yukseklik - k.y1) / s.yukseklik) * 100}%`,
            width: `${((k.x1 - k.x0) / s.genislik) * 100}%`, height: `${((k.y1 - k.y0) / s.yukseklik) * 100}%`,
          },
          onclick: () => sec(l.id),
        });
        sahne.append(b);
      }
    }

    // ---- Düzenleme paneli ------------------------------------------------------------------------
    function satirBul(id) {
      for (const s of st.ozet.sayfalar) { const l = s.satirlar.find((x) => x.id === id); if (l) return l; }
      return null;
    }
    function fontSecimi(l) { return st.ozet.yaziTipleri.find((f) => f.anahtar === l.yaziTipi)?.secili ?? { aile: 'liberation-sans' }; }

    function sec(id) {
      st.secili = id;
      kutulariCiz();
      const l = satirBul(id);
      if (!l) { panel.hidden = true; return; }
      const d = st.degisiklikler[id] ?? {};
      const f = fontSecimi(l);
      const baslik = h('h3', {}, `Sayfa ${l.sayfa} · satır`);
      const parcalar = [baslik, h('p', { class: 'yd-orijinal' }, h('span', { class: 'soluk' }, 'Orijinal: '), l.metin)];
      const korumali = l.koruma && !(l.koruma === 'ustalt' && st.kilitAcik.has(id));
      if (l.koruma === 'ustalt') {
        const kilit = h('input', { type: 'checkbox', id: 'yd-kilit', checked: st.kilitAcik.has(id) });
        kilit.onchange = () => { if (kilit.checked) st.kilitAcik.add(id); else { st.kilitAcik.delete(id); delete st.degisiklikler[id]; } sec(id); listeyiGoster(); };
        parcalar.push(kutu('bilgi', h('div', {}, h('p', {}, '🔒 Bu satır üst/alt bilgi (her sayfada aynı yerde tekrar ediyor). Varsayılan olarak kilitlidir; değiştirmezseniz orijinal kalır.'),
          h('div', { class: 'onay-satiri' }, kilit, h('label', { for: 'yd-kilit' }, 'Kilidi aç, bu sayfadaki satırı düzenleyeceğim')))));
      } else if (korumali) {
        parcalar.push(kutu('bilgi', `🔒 ${l.korumaAdi}. Bu satır orijinal hâliyle kalır ve düzenlenemez.`));
      }
      if (!korumali) {
        if (l.uyum && !l.uyum.tamam) parcalar.push(kutu('uyari', `${l.uyum.neden}. Bu satırı düzenlerseniz seçilen yazı tipiyle yeniden yazılır; görünümü orijinalden biraz farklı olabilir.`));
        const metin = h('input', { type: 'text', id: 'yd-metin', value: d.metin ?? l.metin });
        const aile = h('select', { id: 'yd-aile' }, ...aileSecenekleri(d.aile ?? f.aile));
        const boyut = h('input', { type: 'number', id: 'yd-boyut', min: 3, max: 200, step: 0.1, value: (d.boyut ?? Math.round(l.boyut * 10) / 10) });
        const renk = h('input', { type: 'color', id: 'yd-renk', value: d.renk ?? l.renk });
        const kalin = h('input', { type: 'checkbox', id: 'yd-kalin', checked: d.kalin ?? !!f.kalin });
        const italik = h('input', { type: 'checkbox', id: 'yd-italik', checked: d.italik ?? !!f.italik });
        const sigma = h('div', { 'aria-live': 'polite' });
        const oku = () => {
          const y = {};
          if (metin.value !== l.metin) y.metin = metin.value;
          if (aile.value !== f.aile) y.aile = aile.value;
          const b = Number(boyut.value);
          if (Number.isFinite(b) && Math.abs(b - l.boyut) > 0.05) y.boyut = b;
          if (renk.value.toLowerCase() !== l.renk.toLowerCase()) y.renk = renk.value;
          if (kalin.checked !== !!f.kalin) y.kalin = kalin.checked;
          if (italik.checked !== !!f.italik) y.italik = italik.checked;
          return y;
        };
        const kontrolEt = async () => {
          const y = oku();
          const yazi = y.metin ?? l.metin;
          const o = await yaziTipiOlcer(y.aile ?? f.aile, { kalin: y.kalin ?? f.kalin, italik: y.italik ?? f.italik });
          const eksik = o.eksik(yazi);
          if (eksik.length) { sigma.replaceChildren(kutu('hata', `Seçilen yazı tipinde şu karakterler yok: ${[...new Set(eksik)].join(' ')}`)); return; }
          const W = (o.genislik(yazi) / 1000) * (y.boyut ?? l.boyut);
          const s = l.sinir ?? { x0: l.x0, x1: l.x1 };
          const alan = l.hizalama === 'iki-yana' ? l.x1 - l.x0 : l.hizalama === 'sag' ? l.x1 - Math.min(l.x0, s.x0) : Math.max(l.x1, s.x1) - l.x0;
          if (W > alan * (1 + SINIR.olcek)) sigma.replaceChildren(kutu('uyari', `Yeni yazı satıra sığmıyor (yaklaşık ${pt(W - alan)} taşıyor). Kısaltın ya da yazı boyutunu küçültün.`));
          else sigma.replaceChildren(h('p', { class: 'soluk' }, `Sığıyor. Hizalama: ${{ sol: 'sola dayalı', sag: 'sağa dayalı', orta: 'ortalı', 'iki-yana': 'iki yana yaslı' }[l.hizalama]}.`));
        };
        [metin, aile, boyut, renk, kalin, italik].forEach((x) => x.addEventListener('input', kontrolEt));
        const kaydet = h('button', {
          type: 'button', class: 'birincil', onclick: () => {
            const y = oku();
            if (Object.keys(y).length) st.degisiklikler[id] = y; else delete st.degisiklikler[id];
            kutulariCiz(); listeyiGoster(); sec(id);
          },
        }, 'Değişikliği kaydet');
        const geriAl = h('button', { type: 'button', onclick: () => { delete st.degisiklikler[id]; kutulariCiz(); listeyiGoster(); sec(id); } }, 'Orijinale döndür');
        parcalar.push(h('div', { class: 'alanlar' },
          h('div', { class: 'alan genis' }, h('label', { for: 'yd-metin' }, 'Yeni yazı'), metin),
          h('div', { class: 'alan' }, h('label', { for: 'yd-aile' }, 'Yazı tipi'), aile),
          h('div', { class: 'alan' }, h('label', { for: 'yd-boyut' }, 'Boyut (pt)'), boyut),
          h('div', { class: 'alan' }, h('label', { for: 'yd-renk' }, 'Renk'), renk),
          h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, kalin, h('label', { for: 'yd-kalin' }, 'Kalın')),
            h('div', { class: 'onay-satiri' }, italik, h('label', { for: 'yd-italik' }, 'İtalik')))),
        sigma, h('div', { class: 'eylem' }, kaydet, geriAl));
        kontrolEt();
        setTimeout(() => metin.focus(), 0);
      }
      parcalar.push(h('div', { class: 'eylem' }, h('button', { type: 'button', class: 'kucuk-dugme', onclick: () => { st.secili = null; panel.hidden = true; kutulariCiz(); } }, 'Kapat')));
      panel.replaceChildren(...parcalar);
      panel.hidden = false;
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function listeyiGoster() {
      const ids = Object.keys(st.degisiklikler);
      if (!ids.length) { liste.replaceChildren(h('p', { class: 'soluk' }, 'Henüz değişiklik yok. Sayfada düzeltmek istediğiniz yazıya tıklayın.')); return; }
      liste.replaceChildren(h('h3', {}, `Değişiklik listesi (${ids.length})`), h('ol', {}, ...ids.map((id) => {
        const l = satirBul(id);
        const d = st.degisiklikler[id];
        const ek = [d.aile && YAZI_AILELERI[d.aile].ad, d.boyut && pt(d.boyut), d.renk, d.kalin != null && (d.kalin ? 'kalın' : 'normal'), d.italik != null && (d.italik ? 'italik' : 'düz')].filter(Boolean);
        return h('li', {},
          h('span', { class: 'soluk' }, `Sayfa ${l?.sayfa ?? '?'}: `),
          h('del', {}, l?.metin ?? ''), ' → ', h('ins', {}, d.metin ?? l?.metin ?? ''),
          ek.length ? h('span', { class: 'soluk' }, ` (${ek.join(', ')})`) : '', ' ',
          h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => { if (l && l.sayfa !== st.no) await git(l.sayfa); sec(id); } }, 'Göster'),
          h('button', { type: 'button', class: 'kucuk-dugme', onclick: () => { delete st.degisiklikler[id]; kutulariCiz(); listeyiGoster(); if (st.secili === id) sec(id); } }, 'Sil'));
      })));
    }

    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { st.belge?.kapat?.(); st.belge = null; el.hidden = true; return; }
        if (st.aktifId === d.id && st.bayt === d.bayt) return;
        Object.assign(st, { aktifId: d.id, bayt: d.bayt, ad: d.ad, degisiklikler: {}, kilitAcik: new Set(), esleme: {}, secili: null, no: 1 });
        sonOrijinal = d.bayt;
        el.hidden = false; panel.hidden = true;
        st.belge?.kapat?.();
        st.belge = await belgeAc(d.bayt);
        st.sayfaSayisi = st.belge.numPages;
        aralikAlani.hidden = st.sayfaSayisi <= COK_SAYFA;
        if (!aralikAlani.hidden) aralikGirdi.value = `1-${COK_SAYFA}`;
        await analizEt();
      },
      oku() {
        if (!st.ozet) throw new PdfHatasi('Belge henüz incelenmedi.');
        return { degisiklikler: { ...st.degisiklikler }, kilitAcik: [...st.kilitAcik], esleme: Object.keys(st.esleme).length ? { ...st.esleme } : null, sayfalar: st.sayfalar };
      },
    };
  },
  async calistir({ dosyalar, ayarlar }) {
    const d = dosyalar[0];
    const r = await yaziDuzelt(d.bayt, ayarlar);
    const cikti = { ad: dosyaAdiTuret(d.ad, '-duzeltilmis'), bayt: r.bayt };
    const duzenlenen = r.rapor.reduce((t, s) => t + s.duzenlenen, 0);
    const kontrol = r.rapor.filter((s) => s.durum === 'kontrol');
    return {
      ciktilar: [cikti],
      mesaj: `${duzenlenen} satır değiştirildi; ${r.rapor.reduce((t, s) => t + s.yeniden, 0)} satır aynen yeniden yazıldı.`,
      uyarilar: r.uyarilar,
      ekler: [raporGoster(r.rapor, kontrol), dogrulamaBolumu(sonOrijinal ?? d.bayt, r.bayt, r.rapor)],
    };
  },
});

// ---- Sonuç: sayfa raporu ve doğrulama ----------------------------------------------------------

function raporGoster(rapor, kontrol) {
  return h('details', { class: 'yd-rapor', open: kontrol.length > 0 },
    h('summary', {}, kontrol.length ? `Sayfa raporu — ${kontrol.length} sayfada kontrol gerekli` : 'Sayfa raporu — tüm sayfalar temiz'),
    h('ul', {}, ...rapor.map((s) => h('li', { class: s.durum === 'temiz' ? 'yd-temiz' : 'yd-uyar' },
      `${s.durum === 'temiz' ? '✅' : '⚠️'} ${s.ozet}`,
      s.kontrol.length ? h('ul', {}, ...s.kontrol.map((k) => h('li', { class: 'soluk' }, k.nedenler.join(' · ')))) : ''))));
}

function dogrulamaBolumu(orijinal, cikti, rapor) {
  const kap = h('section', { class: 'yd-dogrula' });
  const sonuc = h('div', { 'aria-live': 'polite' });
  const dugme = h('button', { type: 'button', onclick: calistir }, 'Eski ile yeniyi karşılaştır (doğrula)');
  kap.append(h('h3', {}, 'Doğrulama'), h('p', { class: 'soluk' },
    'Yazılar çıkarılmış eski ve yeni sayfalar piksel piksel karşılaştırılır (logo, çizgi, imza alanı farkı SIFIR olmalı), satırların kayması ölçülür ve eski/yeni üst üste gösterilir.'),
  dugme, sonuc);
  async function calistir() {
    dugme.disabled = true;
    const sayfalar = rapor.map((s) => s.no).slice(0, 30);
    sonuc.replaceChildren(h('p', { class: 'soluk' }, `${sayfalar.length} sayfa karşılaştırılıyor…`));
    await boyamaBekle();
    try {
      const v = await dogrula(orijinal, cikti, { sayfalar, olcek: 1.25, bindirme: true });
      const satirlar = v.sayfalar.map((s) => {
        const a = s.pikselFark === 0, b = s.sapma.enBuyuk <= SINIR.konum;
        return h('li', {}, `${a && b ? '✅' : '⚠️'} Sayfa ${s.no}: logo/çizgi/resim farkı ${s.pikselFark} piksel; en büyük satır kayması ${pt(s.sapma.enBuyuk)} (sınır ${pt(SINIR.konum)}; ${s.sapma.eslesen} satır ölçüldü${s.sapma.eslesmeyen ? `, ${s.sapma.eslesmeyen} değişen satır` : ''})`);
      });
      const sec = h('select', { 'aria-label': 'Üst üste gösterilecek sayfa' }, ...v.sayfalar.map((s) => h('option', { value: s.no }, `Sayfa ${s.no}`)));
      const tuvalKap = h('div', { class: 'onizleme' });
      const goster = () => {
        const s = v.sayfalar.find((x) => x.no === Number(sec.value));
        const c = h('canvas', { width: s.bindirme.genislik, height: s.bindirme.yukseklik, class: 'yd-bindirme', role: 'img', 'aria-label': `Sayfa ${s.no}: eski ve yeni üst üste` });
        c.getContext('2d').putImageData(new ImageData(s.bindirme.veri, s.bindirme.genislik, s.bindirme.yukseklik), 0, 0);
        tuvalKap.replaceChildren(c);
      };
      sec.onchange = goster;
      sonuc.replaceChildren(
        kutu(v.gecti ? 'basari' : 'uyari', v.gecti ? 'Doğrulama geçti: sayfa düzeni birebir aynı, satırlar yerinde.' : 'Bazı sayfalarda fark var; aşağıya bakın.'),
        h('ul', {}, ...satirlar),
        h('p', {}, h('b', {}, 'Üst üste görünüm: '), h('span', { class: 'soluk' }, 'kırmızı = yalnız eskide, camgöbeği = yalnız yenide, siyah = ikisi aynı yerde. '), sec),
        tuvalKap);
      goster();
    } catch (e) {
      sonuc.replaceChildren(kutu('hata', `Doğrulama yapılamadı: ${e.message ?? e}`));
    } finally {
      dugme.disabled = false;
    }
  }
  return kap;
}
