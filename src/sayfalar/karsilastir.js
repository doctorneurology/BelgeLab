// PDF karşılaştır: iki sürümün görsel ve metin farkı.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfKarsilastir } from '../core/pdf-karsilastir.js';
import { PdfHatasi } from '../core/hatalar.js';

function sonucPaneli(r) {
  const farkli = r.sayfalar.filter((s) => s.pikselFark > 0 || s.metin.silinen.length || s.metin.eklenen.length);
  const sec = h('select', { 'aria-label': 'Sayfa seç' }, ...r.sayfalar.map((s) => h('option', { value: s.no }, `Sayfa ${s.no}${farkli.includes(s) ? ' ⚠️ fark var' : ' ✅'}`)));
  const tuvalKap = h('div', { class: 'onizleme' });
  const metinKap = h('div', {});
  const goster = () => {
    const s = r.sayfalar.find((x) => x.no === Number(sec.value));
    const c = h('canvas', { width: s.bindirme.genislik, height: s.bindirme.yukseklik, class: 'yd-bindirme', role: 'img', 'aria-label': `Sayfa ${s.no}: eski ve yeni üst üste` });
    c.getContext('2d').putImageData(new ImageData(s.bindirme.veri, s.bindirme.genislik, s.bindirme.yukseklik), 0, 0);
    tuvalKap.replaceChildren(c);
    const liste = (ad, l, sinif) => (l.length ? h('div', {}, h('b', {}, ad), h('ul', {}, ...l.slice(0, 60).map((m) => h('li', { class: sinif }, m)), l.length > 60 ? h('li', { class: 'soluk' }, `… ${l.length - 60} değişiklik daha`) : '')) : '');
    metinKap.replaceChildren(
      h('p', { class: 'soluk' }, `Görsel fark: ${s.pikselFark} piksel (%${(s.oran * 100).toFixed(2)}).${s.boyutFarkli ? ' Sayfa boyutu farklı!' : ''}`),
      liste('Eskide olup yenide olmayan yazı', s.metin.silinen, 'ex-sil'), liste('Yenide olup eskide olmayan yazı', s.metin.eklenen, 'ex-ekle'),
      !s.metin.silinen.length && !s.metin.eklenen.length ? h('p', { class: 'soluk' }, 'Yazıda fark yok.') : '');
  };
  sec.onchange = goster;
  if (farkli.length) sec.value = farkli[0].no;
  goster();
  return h('section', {},
    kutu(r.ozet.ayniMi ? 'basari' : 'uyari', r.ozet.ayniMi ? 'İki belge aynı görünüyor: fark bulunamadı.' : `${r.ozet.farkliSayfa} / ${r.ozet.karsilastirilan} sayfada fark var.`),
    h('p', {}, h('b', {}, 'Üst üste görünüm: '), h('span', { class: 'soluk' }, 'kırmızı = yalnız eskide, camgöbeği = yalnız yenide, açık gri = ortak. '), sec),
    tuvalKap, metinKap);
}

aracKur({
  slug: 'karsilastir',
  dosya: { tur: 'pdf', coklu: true, enAz: 2 },
  ayarBasligi: 'İki sürümü karşılaştır',
  dugme: 'Karşılaştır',
  notlar: [kutu('bilgi', 'İki PDF seçin. Listedeki ilki ESKİ, ikincisi YENİ sürüm sayılır (↑ ↓ ile sırayı değiştirin). Sayfa sınırı yoktur.')],
  alanlar: [
    { id: 'dpi', tur: 'secim', etiket: 'Görsel karşılaştırma çözünürlüğü', varsayilan: '100', secenekler: [{ deger: '72', ad: '72 dpi (hızlı)' }, { deger: '100', ad: '100 dpi (önerilen)' }, { deger: '150', ad: '150 dpi (ince farklar)' }] },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    if (dosyalar.length !== 2) throw new PdfHatasi('Tam olarak iki PDF seçin (eski ve yeni sürüm).');
    const r = await pdfKarsilastir(dosyalar[0].bayt, dosyalar[1].bayt, { dpi: Number(a.dpi), ilerleme: (k, n) => ilerleme(k, n) });
    return { ciktilar: [], mesaj: '', uyarilar: r.uyarilar, ekler: [sonucPaneli(r), hizliGecis('Hızlı geçiş', ['yazi-duzelt', 'birlestir'])] };
  },
});
