// Sayfa düzeni: bir sayfaya birden çok sayfa, kitapçık, tek uzun sayfa.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { birSayfayaCok, kitapcik, tekUzunSayfa, KAGITLAR } from '../core/sayfa-duzeni.js';
import { dosyaAdiTuret } from '../core/util.js';

const kagitSecenekleri = Object.keys(KAGITLAR).map((k) => ({ deger: k, ad: k }));

aracKur({
  slug: 'sayfa-duzeni',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Düzen',
  dugme: 'Düzeni uygula',
  notlar: [kutu('bilgi', 'Sayfalar küçültülüp yan yana dizilir (yazdırırken kâğıt tasarrufu), kitapçık sırasına konur ya da alt alta tek uzun sayfaya çevrilir. Yazı ve çizimler vektör olarak kalır; bağlantı, form alanı ve yer imi taşınmaz.')],
  alanlar: [
    {
      id: 'mod', tur: 'secim', etiket: 'Ne yapılsın?', varsayilan: 'nup',
      secenekler: [{ deger: 'nup', ad: 'Bir kâğıda birden çok sayfa' }, { deger: 'kitapcik', ad: 'Kitapçık (ortadan katlanır, zımbalanır)' }, { deger: 'uzun', ad: 'Tüm sayfaları alt alta tek uzun sayfa yap' }],
    },
    { id: 'adet', tur: 'secim', etiket: 'Kâğıt başına sayfa', varsayilan: '4', secenekler: ['2', '4', '6', '8', '9', '16'].map((x) => ({ deger: x, ad: x })), goster: (d) => d.mod === 'nup' },
    { id: 'kagit', tur: 'secim', etiket: 'Kâğıt boyutu', varsayilan: 'A4', secenekler: kagitSecenekleri, goster: (d) => d.mod !== 'uzun' },
    { id: 'yon', tur: 'secim', etiket: 'Yön', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'Otomatik' }, { deger: 'dikey', ad: 'Dikey' }, { deger: 'yatay', ad: 'Yatay' }], goster: (d) => d.mod === 'nup' },
    { id: 'cerceve', tur: 'onay', etiket: 'Sayfaların etrafına ince çerçeve çiz', varsayilan: true, goster: (d) => d.mod === 'nup' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    let r, ek, mesaj;
    if (a.mod === 'kitapcik') { r = await kitapcik(d.bayt, { kagit: a.kagit }); ek = '-kitapcik'; mesaj = `Kitapçık hazır: ${r.sayfaSayisi} kâğıt yüzü${r.bosEklenen ? `, ${r.bosEklenen} boş sayfa eklendi` : ''}.`; }
    else if (a.mod === 'uzun') { r = await tekUzunSayfa(d.bayt); ek = '-tek-sayfa'; mesaj = 'Tüm sayfalar tek uzun sayfaya birleştirildi.'; }
    else { r = await birSayfayaCok(d.bayt, { adet: Number(a.adet), kagit: a.kagit, yon: a.yon, cerceve: a.cerceve }); ek = `-${a.adet}li`; mesaj = `${r.sayfaSayisi} kâğıt yüzü oluştu (kâğıt başına ${a.adet} sayfa).`; }
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, ek), bayt: r.bayt }], mesaj, uyarilar: r.uyarilar };
  },
});
