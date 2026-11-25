// Üst üste bindirme: antetli kâğıt, filigran ya da form şablonu gibi bir PDF'i başka bir PDF'in sayfalarına bindirir.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { ustUsteBindir } from '../core/sayfa-duzeni.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

aracKur({
  slug: 'ust-uste',
  dosya: { tur: 'pdf', coklu: true, enAz: 2 },
  ayarBasligi: 'Bindirme',
  dugme: 'Üst üste bindir',
  notlar: [kutu('bilgi', 'İki PDF seçin. Listedeki ilki ANA belge, ikincisi ÜZERİNE (ya da ARKASINA) konacak belgedir (↑ ↓ ile sırayı değiştirin). Antetli kâğıt, logo, form şablonu ya da filigran için kullanışlıdır. Bağlantı ve form alanları taşınmaz.')],
  alanlar: [
    { id: 'konum', tur: 'secim', etiket: 'İkinci PDF nereye konsun?', varsayilan: 'ust', secenekler: [{ deger: 'ust', ad: 'Ana belgenin ÜSTÜNE' }, { deger: 'arka', ad: 'Ana belgenin ARKASINA (antetli kâğıt gibi)' }] },
    { id: 'tekrar', tur: 'secim', etiket: 'İkinci PDF daha kısaysa', varsayilan: 'dongu', secenekler: [{ deger: 'dongu', ad: 'Baştan tekrarla (tek sayfalık filigran için)' }, { deger: 'son', ad: 'Son sayfasını kullan' }, { deger: 'yok', ad: 'Kalan sayfalara bindirme yapma' }] },
    { id: 'opaklik', tur: 'aralik', etiket: 'Bindirilen belgenin görünürlüğü (%)', varsayilan: 100, min: 10, max: 100, adim: 5, aciklama: 'Düşürürseniz bindirilen sayfa saydamlaşır (döndürülmüş sayfalarda uygulanmaz).' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    if (dosyalar.length !== 2) throw new PdfHatasi('Tam olarak iki PDF seçin: ana belge ve bindirilecek belge.');
    const r = await ustUsteBindir(dosyalar[0].bayt, dosyalar[1].bayt, { arkada: a.konum === 'arka', tekrar: a.tekrar, opaklik: Number(a.opaklik) / 100 });
    return { ciktilar: [{ ad: dosyaAdiTuret(dosyalar[0].ad, '-bindirilmis'), bayt: r.bayt }], mesaj: `${r.sayfaSayisi} sayfa üst üste bindirildi.`, uyarilar: r.uyarilar };
  },
});
