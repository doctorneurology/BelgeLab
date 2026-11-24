// Doldurulabilir form oluştur: sayfada alan kutuları çizip tür/ad verin.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { bolgeSecici } from '../ui/bolge-secici.js';
import { belgeAc } from '../core/render.js';
import { formAlanlariEkle } from '../core/form-olustur.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

const TURLER = [['metin', 'Metin kutusu'], ['cokSatir', 'Çok satırlı metin'], ['onay', 'Onay kutusu'], ['secenek', 'Seçenek düğmesi (radyo)'], ['liste', 'Açılır liste']];

aracKur({
  slug: 'form-olustur',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Form alanlarını çizin',
  dugme: 'Form alanlarını ekle',
  notlar: [kutu('bilgi', 'Alan türünü seçip sayfada sürükleyerek bir kutu çizin; sonra aşağıdaki kartta adını verin. Alanlar gerçek PDF form alanlarıdır (Acrobat, tarayıcılar ve bu sitenin “Form doldur” aracıyla doldurulabilir). Aynı adlı seçenek düğmeleri bir grup olur; her birine farklı bir “seçenek değeri” verin.')],
  ayar() {
    const st = { belge: null, aktifId: null, sayac: 0 };
    const tur = h('select', { id: 'fo-tur' }, ...TURLER.map(([v, a]) => h('option', { value: v }, a)));
    const liste = h('div', { class: 'td-liste' });
    const secici = bolgeSecici({
      onDegisti: () => kartlar(),
      yeniKutuVerisi: () => { st.sayac++; return { alanTuru: tur.value, ad: `${{ metin: 'metin', cokSatir: 'notlar', onay: 'onay', secenek: 'secim', liste: 'liste' }[tur.value]}${st.sayac}`, secenek: tur.value === 'secenek' ? `deger${st.sayac}` : '', secenekler: tur.value === 'liste' ? 'Seçenek 1, Seçenek 2, Seçenek 3' : '', varsayilan: '', zorunlu: false }; },
    });
    const el = h('div', {}, h('div', { class: 'alan' }, h('label', { for: 'fo-tur' }, 'Çizilecek alan türü'), tur), secici.el, liste);
    el.hidden = true;
    function kartlar() {
      const k = secici.kutular();
      if (!k.length) { liste.replaceChildren(h('p', { class: 'soluk' }, 'Henüz alan yok. Sayfa üzerinde sürükleyerek çizin.')); return; }
      liste.replaceChildren(h('h3', {}, `Alanlar (${k.length})`), ...k.map((x, i) => {
        const gir = (alan, etiket, ek = {}) => { const g = h('input', { type: 'text', value: x[alan] ?? '', ...ek }); g.addEventListener('input', () => { x[alan] = g.value; }); return h('div', { class: 'alan' }, h('label', {}, etiket), g); };
        const zor = h('input', { type: 'checkbox', checked: !!x.zorunlu }); zor.addEventListener('change', () => { x.zorunlu = zor.checked; });
        return h('div', { class: 'td-kart' },
          h('div', { class: 'td-baslik' }, h('b', {}, `${i + 1}. Sayfa ${x.sayfa} — ${TURLER.find(([v]) => v === x.alanTuru)?.[1]}`),
            h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => { await secici.git(x.sayfa); secici.sec(x.id); } }, 'Göster'),
            h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => secici.sil(x.id) }, 'Sil')),
          h('div', { class: 'alanlar' },
            gir('ad', 'Alan adı (benzersiz; seçenek düğmelerinde grup adı)'),
            x.alanTuru === 'secenek' ? gir('secenek', 'Seçenek değeri') : '',
            x.alanTuru === 'liste' ? gir('secenekler', 'Seçenekler (virgülle ayırın)') : '',
            ['metin', 'cokSatir', 'liste'].includes(x.alanTuru) ? gir('varsayilan', 'Başlangıç değeri (isteğe bağlı)') : '',
            h('div', { class: 'alan' }, h('div', { class: 'onay-satiri' }, zor, h('label', {}, 'Zorunlu alan')))));
      }));
    }
    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { st.belge?.kapat?.(); st.belge = null; el.hidden = true; return; }
        if (st.aktifId === d.id) return;
        st.aktifId = d.id; el.hidden = false;
        st.belge?.kapat?.();
        st.belge = await belgeAc(d.bayt);
        await secici.belgeAyarla(st.belge);
        kartlar();
      },
      oku() {
        const k = secici.kutular();
        if (!k.length) throw new PdfHatasi('Eklenecek alan yok. Sayfada sürükleyerek bir kutu çizin.');
        return {
          alanlar: k.map((x) => ({
            tur: x.alanTuru === 'cokSatir' ? 'metin' : x.alanTuru, cokSatir: x.alanTuru === 'cokSatir', ad: String(x.ad).trim(), sayfa: x.sayfa - 1,
            x0: x.x0, y0: x.y0, x1: x.x1, y1: x.y1, varsayilan: x.varsayilan || undefined, zorunlu: x.zorunlu, secenek: x.secenek || undefined,
            secenekler: x.alanTuru === 'liste' ? String(x.secenekler).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          })),
        };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const r = await formAlanlariEkle(d.bayt, a.alanlar);
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-form'), bayt: r.bayt }], mesaj: `${r.eklenen} form alanı eklendi. “Form doldur” aracıyla deneyebilirsiniz.`, uyarilar: r.uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['form-doldur', 'sifre-ekle', 'sikistir'])] };
  },
});
