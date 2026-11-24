// Taranmış (resim) belgede, YALNIZCA kullanıcının seçtiği bölgede yazı düzeltme.
// Bölge zemin rengiyle örtülür, yeni yazı üstüne yazılır. Tüm sayfa kendiliğinden yeniden yazılmaz.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu, boyamaBekle } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { bolgeSecici } from '../ui/bolge-secici.js';
import { belgeAc } from '../core/render.js';
import { sayfaOcr, ocrKapat } from '../core/ocr.js';
import { bolgeDuzelt } from '../core/tarama-duzelt.js';
import { YAZI_AILELERI } from '../core/fonts.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

const aileSecenekleri = (secili) => Object.entries(YAZI_AILELERI).map(([k, a]) => h('option', { value: k, selected: k === secili }, `${a.ad} — ${a.benzer}`));

aracKur({
  slug: 'taranmis-duzelt',
  toplu: false, // dosyaya özel arayüz (sayfa/bölge seçimi); toplu kip yok
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Düzeltilecek yeri seçin',
  dugme: 'Düzeltmeleri uygula',
  notlar: [
    kutu('bilgi', h('span', {},
      'Sayfada düzeltmek istediğiniz yazının üzerine bir dikdörtgen çizin; yeni yazıyı yazın. Seçtiğiniz bölge sayfanın zemin rengiyle örtülür ve yeni yazı üstüne yazılır. ',
      h('b', {}, 'Programın okuduğu (OCR) yazı belgeye kendiliğinden yazılmaz'),
      '; yalnızca sizin yazdığınız metin eklenir. İsterseniz sayfa sayfa OCR ile satırları görüp düzeltmek istediklerinize tıklayabilirsiniz.')),
    kutu('uyari', h('span', {}, h('b', {}, 'Örtme kipinde '), 'eski yazının görüntüsü dosyada durmaya devam eder (yalnızca üstü kapanır). Dosyayı başkalarına göndereceksek aşağıdaki “kalıcı” seçeneğini işaretleyin.')),
  ],
  ayar() {
    const st = { bayt: null, belge: null, aktifId: null, ocr: new Map() };
    const durum = h('div', { 'aria-live': 'polite' });
    const liste = h('div', { class: 'td-liste' });
    const secici = bolgeSecici({
      onDegisti: () => kartlariCiz(),
      oneriler: (no) => (st.ocr.get(no)?.satirlar ?? []).map((s, i) => ({
        id: `s${no}-${i}`, kutu: { x0: s.x0 - 1, x1: s.x1 + 1, y0: s.y0, y1: s.y1 }, baslik: `OCR: ${s.metin} (düzeltmek için tıklayın)`, sinif: 'bs-oneri-ocr', satir: s,
      })),
      onOneri: (o) => {
        if (secici.kutular().some((k) => k.satirId === o.id)) return;
        secici.ekle(secici.durum.no, o.kutu, { satirId: o.id, eskiMetin: o.satir.metin, metin: o.satir.metin, aile: 'liberation-serif' });
      },
    });
    const ocrDugme = h('button', { type: 'button', onclick: ocrOku }, '🔍 Bu sayfayı OCR ile oku ve satırları göster');
    const kalici = h('input', { type: 'checkbox', id: 'td-kalici' });
    const dpi = h('select', { id: 'td-dpi', 'aria-label': 'Kalıcı kipte çözünürlük' }, ...[['150', '150 dpi'], ['200', '200 dpi (önerilen)'], ['300', '300 dpi']].map(([v, a]) => h('option', { value: v, selected: v === '200' }, a)));
    const kaliciAlan = h('div', { class: 'alan genis' },
      h('div', { class: 'onay-satiri' }, kalici, h('label', { for: 'td-kalici' }, 'Kalıcı: eski yazının görüntüsünü dosyadan da sil (düzeltilen sayfalar yeniden resimlenir)')),
      h('div', { class: 'satirda' }, h('label', { for: 'td-dpi' }, 'Çözünürlük:'), dpi));
    const el = h('div', {}, durum, h('div', { class: 'eylem' }, ocrDugme), secici.el, liste, h('h3', {}, 'Seçenekler'), kaliciAlan);
    el.hidden = true;

    async function ocrOku() {
      const no = secici.durum.no;
      ocrDugme.disabled = true;
      durum.replaceChildren(h('p', { class: 'soluk' }, `Sayfa ${no} okunuyor… (ilk seferde hazırlık birkaç saniye sürer)`));
      await boyamaBekle();
      try {
        await ocrHazirla();
        const r = await sayfaOcr(st.belge, no, { dpi: 250 });
        st.ocr.set(no, r);
        secici.yenile();
        durum.replaceChildren(kutu('bilgi', `${r.satirlar.length} satır bulundu (mavi kesikli kutular). Düzeltmek istediğiniz satıra tıklayın. OCR yanlış okumuş olabilir: yeni yazıyı kendiniz gözden geçirip yazın.`));
      } catch (e) {
        durum.replaceChildren(kutu('hata', e.message ?? String(e)));
      } finally {
        ocrDugme.disabled = false;
        await ocrKapat();
      }
    }

    function kartlariCiz() {
      const k = secici.kutular();
      if (!k.length) { liste.replaceChildren(h('p', { class: 'soluk' }, 'Henüz düzeltilecek yer yok. Sayfada sürükleyerek bir alan çizin ya da OCR satırlarından birine tıklayın.')); return; }
      liste.replaceChildren(h('h3', {}, `Düzeltmeler (${k.length})`), ...k.map((x, i) => {
        const metin = h('input', { type: 'text', id: `td-m-${x.id}`, value: x.metin ?? '', placeholder: 'Yeni yazı (boş bırakırsanız bölge yalnızca örtülür)' });
        metin.addEventListener('input', () => { x.metin = metin.value; });
        const aile = h('select', { id: `td-a-${x.id}` }, ...aileSecenekleri(x.aile ?? 'liberation-sans'));
        aile.addEventListener('change', () => { x.aile = aile.value; });
        const kalin = h('input', { type: 'checkbox', id: `td-k-${x.id}`, checked: !!x.kalin });
        kalin.addEventListener('change', () => { x.kalin = kalin.checked; });
        const italik = h('input', { type: 'checkbox', id: `td-i-${x.id}`, checked: !!x.italik });
        italik.addEventListener('change', () => { x.italik = italik.checked; });
        const boyut = h('input', { type: 'number', id: `td-b-${x.id}`, min: 4, max: 120, step: 0.5, placeholder: 'otomatik', value: x.boyut ?? '' });
        boyut.addEventListener('input', () => { x.boyut = boyut.value ? Number(boyut.value) : undefined; });
        const hiza = h('select', { id: `td-h-${x.id}` }, ...[['sol', 'Sola dayalı'], ['orta', 'Ortalı'], ['sag', 'Sağa dayalı']].map(([v, a]) => h('option', { value: v, selected: (x.hizalama ?? 'sol') === v }, a)));
        hiza.addEventListener('change', () => { x.hizalama = hiza.value; });
        return h('div', { class: `td-kart${secici.durum.secili === x.id ? ' secili' : ''}` },
          h('div', { class: 'td-baslik' }, h('b', {}, `${i + 1}. Sayfa ${x.sayfa}`),
            h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => { await secici.git(x.sayfa); secici.sec(x.id); } }, 'Göster'),
            h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => secici.sil(x.id) }, 'Sil')),
          x.eskiMetin ? h('p', { class: 'soluk td-eski' }, 'OCR’ın okuduğu eski yazı: ', h('del', {}, x.eskiMetin)) : '',
          h('div', { class: 'alan genis' }, h('label', { for: `td-m-${x.id}` }, 'Yeni yazı'), metin),
          h('details', {}, h('summary', {}, 'Yazı tipi ve boyut (isteğe bağlı)'),
            h('div', { class: 'alanlar' },
              h('div', { class: 'alan' }, h('label', { for: `td-a-${x.id}` }, 'Yazı tipi'), aile),
              h('div', { class: 'alan' }, h('label', { for: `td-b-${x.id}` }, 'Boyut (pt)'), boyut),
              h('div', { class: 'alan' }, h('label', { for: `td-h-${x.id}` }, 'Hizalama'), hiza),
              h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, kalin, h('label', { for: `td-k-${x.id}` }, 'Kalın')), h('div', { class: 'onay-satiri' }, italik, h('label', { for: `td-i-${x.id}` }, 'İtalik'))))));
      }));
    }

    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { st.belge?.kapat?.(); st.belge = null; el.hidden = true; return; }
        if (st.aktifId === d.id && st.bayt === d.bayt) return;
        st.aktifId = d.id; st.bayt = d.bayt; st.ocr = new Map();
        el.hidden = false;
        durum.replaceChildren();
        st.belge?.kapat?.();
        st.belge = await belgeAc(d.bayt);
        await secici.belgeAyarla(st.belge);
        kartlariCiz();
      },
      oku() {
        const k = secici.kutular();
        if (!k.length) throw new PdfHatasi('Düzeltilecek bir yer seçilmedi. Sayfada sürükleyerek bir alan çizin.');
        return {
          duzeltmeler: k.map((x) => ({
            sayfa: x.sayfa, kutu: { x0: x.x0, y0: x.y0, x1: x.x1, y1: x.y1 }, metin: x.metin ?? '', eskiMetin: x.eskiMetin,
            aile: x.aile ?? 'liberation-sans', kalin: !!x.kalin, italik: !!x.italik, boyut: x.boyut, hizalama: x.hizalama ?? 'sol',
          })),
          kalici: kalici.checked, dpi: Number(dpi.value),
        };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const r = await bolgeDuzelt(d.bayt, a.duzeltmeler, { kalici: a.kalici, dpi: a.dpi });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-duzeltilmis'), bayt: r.bayt }],
      mesaj: `${a.duzeltmeler.length} bölge düzeltildi${a.kalici ? ' (kalıcı: eski görüntü dosyadan silindi)' : ' (örtme kipi: eski görüntü dosyada duruyor)'}. Önizlemede gözle kontrol edin.`,
      uyarilar: r.uyarilar,
      ekler: [hizliGecis('Hızlı geçiş', ['ocr', 'karart', 'sikistir', 'pdf-word'])],
    };
  },
});
