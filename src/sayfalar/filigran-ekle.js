import { aracKur } from '../ui/arac.js';
import { filigranEkle } from '../core/filigran.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';
import { kutu } from '../ui/yardim.js';

aracKur({
  slug: 'filigran-ekle',
  dosya: { tur: 'pdf' },
  dugme: 'Filigranı ekle',
  notlar: [kutu('bilgi', 'Bu site, eklediği filigranı işaretler; böylece “Filigranı geri al” aracı yalnızca bu siteyle eklenmiş filigranı kaldırabilir. Başkasının koyduğu filigran ya da telif işaretleri kaldırılamaz.')],
  alanlar: [
    {
      id: 'tur', tur: 'secim', etiket: 'Filigran türü', varsayilan: 'metin',
      secenekler: [{ deger: 'metin', ad: 'Yazı' }, { deger: 'resim', ad: 'Resim (logo vb.)' }],
    },
    { id: 'metin', tur: 'metin', etiket: 'Yazı', varsayilan: 'TASLAK', goster: (d) => d.tur === 'metin', genis: true },
    { id: 'aile', tur: 'yazitipi', etiket: 'Yazı tipi', varsayilan: 'liberation-sans', goster: (d) => d.tur === 'metin' },
    { id: 'kalin', tur: 'onay', etiket: 'Kalın yazı', varsayilan: true, goster: (d) => d.tur === 'metin' },
    { id: 'boyut', tur: 'sayi', etiket: 'Yazı boyutu', varsayilan: 72, min: 8, max: 300, adim: 1, birim: 'pt', goster: (d) => d.tur === 'metin' },
    { id: 'renk', tur: 'renk', etiket: 'Renk', varsayilan: '#808080', goster: (d) => d.tur === 'metin' },
    { id: 'resimDosya', tur: 'dosya', etiket: 'Resim dosyası (PNG ya da JPEG)', kabul: 'image/png,image/jpeg', goster: (d) => d.tur === 'resim', genis: true },
    { id: 'resimGenislik', tur: 'aralik', etiket: 'Resim genişliği (sayfa genişliğinin yüzdesi)', min: 5, max: 100, adim: 1, varsayilan: 50, birim: '%', goster: (d) => d.tur === 'resim' },
    { id: 'opaklik', tur: 'aralik', etiket: 'Görünürlük (düşük = silik)', min: 5, max: 100, adim: 5, varsayilan: 25, birim: '%' },
    { id: 'aci', tur: 'aralik', etiket: 'Eğim', min: -90, max: 90, adim: 5, varsayilan: 45, birim: '°' },
    {
      id: 'konum', tur: 'secim', etiket: 'Yerleşim', varsayilan: 'orta',
      secenekler: [{ deger: 'orta', ad: 'Sayfanın ortasında, tek' }, { deger: 'doseme', ad: 'Sayfayı kaplayacak şekilde tekrarlı' }],
    },
    {
      id: 'katman', tur: 'secim', etiket: 'Katman', varsayilan: 'ust',
      secenekler: [{ deger: 'ust', ad: 'İçeriğin üstünde' }, { deger: 'alt', ad: 'İçeriğin arkasında (opak resimlerin arkasında kalabilir)' }],
    },
    { id: 'sayfalar', tur: 'metin', etiket: 'Hangi sayfalar? (boş = hepsi)', ipucu: 'örn. 1-3, 5' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    if (a.tur === 'resim' && !a.resimDosya) throw new PdfHatasi('Bir resim dosyası seçin.');
    const s = await filigranEkle(d.bayt, {
      metin: a.tur === 'metin' ? a.metin : '',
      resim: a.tur === 'resim' ? { bayt: a.resimDosya.bayt } : null,
      aile: a.aile, kalin: a.kalin, boyut: a.boyut, renk: a.renk,
      opaklik: a.opaklik / 100, aci: a.aci, konum: a.konum, katman: a.katman, sayfalar: a.sayfalar,
      resimGenislikOrani: a.resimGenislik / 100,
    });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-filigranli'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.islenen} sayfaya filigran eklendi. Bu filigranı daha sonra “Filigranı geri al” aracıyla kaldırabilirsiniz.`,
    };
  },
});
