// Hasta başvuru analizi: TC / ad soyad / başvuru no sütunlarını (sırası fark etmez) otomatik bulur, kişileri sayar.
import { aracKur } from '../ui/arac.js';
import { h, kutu, indir } from '../ui/yardim.js';
import { excelAnaliz, analizDisaAktar } from '../core/excel.js';
import { kullaniciMesaji } from '../ui/yardim.js';

const GOSTER = 500;

function analizPaneli(sonuc) {
  const tek = sonuc.dosyaAdlari.length === 1;
  const cok = sonuc.dosyaAdlari.length > 1;
  const capraz = sonuc.hastalar.filter((p) => p.dosyaSayisi > 1).length;
  const st = { sadeceCapraz: false, rapor: true, ara: '' };

  const kart = (etiket, deger, sinif = '') => h('div', { class: `ex-kart ${sinif}` }, h('div', { class: 'ex-deger' }, String(deger)), h('div', { class: 'soluk' }, etiket));
  const kartlar = h('div', { class: 'ex-kartlar' },
    kart('İşlenen dosya', sonuc.dosyaAdlari.length), kart('Tekil hasta', sonuc.hastalar.length), kart('Toplam kayıt / başvuru', sonuc.toplamKayit),
    cok ? kart('Çapraz varlık (iki+ dosyada)', capraz, 'vurgulu') : '');

  const onay = (id, etiket, baslangic, degisti) => {
    const g = h('input', { type: 'checkbox', id, checked: baslangic });
    g.addEventListener('change', () => degisti(g.checked));
    return h('div', { class: 'onay-satiri' }, g, h('label', { for: id }, etiket));
  };
  const araGirdi = h('input', { type: 'search', id: 'ex-ara', placeholder: 'Ad soyad ya da TC ara…', 'aria-label': 'Tabloda ara' });
  araGirdi.addEventListener('input', () => { st.ara = araGirdi.value; tabloyuCiz(); });
  const kontroller = h('div', { class: 'ex-kontrol' },
    cok ? onay('ex-capraz', 'Yalnızca birden fazla dosyada geçenleri göster', false, (v) => { st.sadeceCapraz = v; tabloyuCiz(); }) : '',
    sonuc.raporVar ? onay('ex-rapor', 'Rapor sütununu göster', true, (v) => { st.rapor = v; tabloyuCiz(); }) : '',
    araGirdi);

  const tablo = h('table', { class: 'yd-tablo ex-tablo' });
  const tabloKap = h('div', { class: 'tablo-kap ex-tablo-kap' }, tablo);
  const bilgi = h('p', { class: 'soluk', 'aria-live': 'polite' });
  const norm = (m) => String(m).toLocaleLowerCase('tr').replace(/ı/g, 'i');

  function suzulmus() {
    let l = st.sadeceCapraz ? sonuc.hastalar.filter((p) => p.dosyaSayisi > 1) : sonuc.hastalar;
    const q = norm(st.ara).trim();
    if (q) l = l.filter((p) => norm(p.ad).includes(q) || p.tc.includes(q));
    return l;
  }
  function tabloyuCiz() {
    const raporAktif = sonuc.raporVar && st.rapor;
    const liste = suzulmus();
    const baslik = ['TC KİMLİK', 'ADI SOYADI', 'BAŞVURU NO', ...(tek ? [] : sonuc.dosyaAdlari), 'TOPLAM BAŞVURU', ...(sonuc.yasVar ? ['YAŞI'] : []), ...(raporAktif ? ['RAPOR'] : [])];
    tablo.replaceChildren(
      h('thead', {}, h('tr', {}, ...baslik.map((b) => h('th', {}, b)))),
      h('tbody', {}, ...liste.slice(0, GOSTER).map((p) => h('tr', {},
        h('td', { class: 'ex-mono' }, p.tc || '-'), h('td', {}, p.ad), h('td', { class: 'ex-mono' }, p.enBuyukBasvuru || '-'),
        ...(tek ? [] : sonuc.dosyaAdlari.map((f) => h('td', { class: 'ex-orta' }, String(p.sayilar[f] ?? 0)))),
        h('td', { class: 'ex-orta ex-kalin' }, String(p.toplam)),
        ...(sonuc.yasVar ? [h('td', { class: 'ex-orta' }, p.yas || '-')] : []),
        ...(raporAktif ? [h('td', {}, p.rapor || '-')] : [])))));
    bilgi.textContent = `${liste.length} kişi listeleniyor${liste.length > GOSTER ? ` (ekranda ilk ${GOSTER}; Excel'e aktarınca hepsi gelir)` : ''}.`;
  }

  const hata = h('div', { 'aria-live': 'polite' });
  const aktar = h('button', { type: 'button', class: 'birincil', onclick: () => {
    try {
      const r = analizDisaAktar(sonuc, { sadeceCapraz: st.sadeceCapraz, rapor: st.rapor });
      const taban = sonuc.dosyaAdlari.join('_').slice(0, 100) || 'Hasta_Basvuru_Analiz';
      indir(r.bayt, `${taban}${st.sadeceCapraz ? '_capraz_varlik_analiz' : '_analiz'}.xlsx`);
      hata.replaceChildren();
    } catch (e) { hata.replaceChildren(kutu('hata', kullaniciMesaji(e))); }
  } }, '⬇ Excel olarak dışa aktar');

  tabloyuCiz();
  return h('section', { class: 'ex-analiz' }, kartlar, kontroller, h('div', { class: 'eylem' }, aktar), hata, bilgi, tabloKap);
}

aracKur({
  slug: 'excel-analiz',
  dosya: { tur: 'excel', coklu: true, enAz: 1 },
  ayarBasligi: 'Hazır',
  dugme: 'Analiz et',
  notlar: [kutu('bilgi', h('span', {}, h('b', {}, 'Analiz prensibi: '),
    'Sütun sırası (A, B, C…) ne olursa olsun TC kimlik, ad soyad ve başvuru no sütunları başlıklarından otomatik bulunur; kişiler tekilleştirilir, dosyalar arası çapraz varlık hesaplanır. Her dosyanın yalnızca ilk sayfası okunur. Hasta bilgileri cihazınızdan çıkmaz.'))],
  async calistir({ dosyalar }) {
    const s = excelAnaliz(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt })));
    if (!s.hastalar.length) {
      return { ciktilar: [], mesaj: '', uyarilar: s.uyarilar.length ? s.uyarilar : ['Hiçbir dosyada hasta kaydı bulunamadı.'], ekler: [] };
    }
    return {
      ciktilar: [],
      mesaj: `${s.hastalar.length} tekil hasta, ${s.toplamKayit} kayıt (${s.dosyaAdlari.length} dosya).`,
      uyarilar: s.uyarilar,
      ekler: [analizPaneli(s)],
    };
  },
});
