// Sayfa boyutu / ölçek: her sayfayı yeni kâğıt boyutuna ya da yüzdeye göre ölçekler.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { sayfaBoyutuDegistir, KAGITLAR } from '../core/sayfa-duzeni.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-boyutu',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Yeni boyut',
  dugme: 'Boyutu değiştir',
  notlar: [kutu('bilgi', 'Her sayfa yeni boyuta ölçeklenir ve ortalanır. Yazı ve çizimler vektör olarak kalır; bağlantı, form alanı ve yer imi taşınmaz.')],
  alanlar: [
    {
      id: 'boyut', tur: 'secim', etiket: 'Hedef', varsayilan: 'A4',
      secenekler: [...Object.keys(KAGITLAR).map((k) => ({ deger: k, ad: `${k} (${KAGITLAR[k][0]}×${KAGITLAR[k][1]} mm)` })), { deger: 'yuzde', ad: 'Yüzdeyle küçült/büyüt' }, { deger: 'ozel', ad: 'Özel boyut (mm)' }],
    },
    { id: 'yuzde', tur: 'sayi', etiket: 'Ölçek (%)', varsayilan: 70, min: 10, max: 1000, adim: 1, goster: (d) => d.boyut === 'yuzde' },
    { id: 'genislikMM', tur: 'sayi', etiket: 'Genişlik (mm)', varsayilan: 210, min: 20, adim: 1, goster: (d) => d.boyut === 'ozel' },
    { id: 'yukseklikMM', tur: 'sayi', etiket: 'Yükseklik (mm)', varsayilan: 297, min: 20, adim: 1, goster: (d) => d.boyut === 'ozel' },
    { id: 'yon', tur: 'secim', etiket: 'Yön', varsayilan: 'kendi', secenekler: [{ deger: 'kendi', ad: 'Her sayfa kendi yönünü korusun' }, { deger: 'dikey', ad: 'Hepsi dikey' }, { deger: 'yatay', ad: 'Hepsi yatay' }], goster: (d) => d.boyut !== 'yuzde' },
    {
      id: 'uyum', tur: 'secim', etiket: 'Sığdırma', varsayilan: 'sigdir', goster: (d) => d.boyut !== 'yuzde',
      secenekler: [{ deger: 'sigdir', ad: 'Sığdır (oran korunur, kenarda boşluk kalabilir)' }, { deger: 'doldur', ad: 'Doldur (oran korunur, taşan kısım kesilir)' }, { deger: 'uzat', ad: 'Uzat (oran bozulur)' }],
    },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const r = await sayfaBoyutuDegistir(d.bayt, { boyut: a.boyut, yuzde: a.yuzde, genislikMM: a.genislikMM, yukseklikMM: a.yukseklikMM, yon: a.yon, uyum: a.uyum });
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, `-${a.boyut === 'yuzde' ? `%${a.yuzde}` : a.boyut}`), bayt: r.bayt }], mesaj: `${r.sayfaSayisi} sayfa yeniden boyutlandırıldı.`, uyarilar: r.uyarilar };
  },
});
