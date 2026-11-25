// Açıklamaları (notlar, vurgular, çizimler, bağlantılar…) kaldır.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { aciklamalariKaldir } from '../core/temizlik.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'aciklama-kaldir',
  dosya: { tur: 'pdf' },
  dugme: 'Açıklamaları kaldır',
  notlar: [kutu('bilgi', 'Sayfanın asıl içeriği (yazı, resim) değişmez; yalnızca üzerine eklenmiş açıklamalar silinir.')],
  alanlar: [
    { id: 'yorum', tur: 'onay', etiket: 'Notlar, yorum kutuları, damgalar, serbest çizimler ve şekiller', varsayilan: true },
    { id: 'vurgu', tur: 'onay', etiket: 'Vurgulayıcı, altı çizili, üstü çizili', varsayilan: true },
    { id: 'baglanti', tur: 'onay', etiket: 'Bağlantılar (tıklanabilir alanlar)', varsayilan: false },
    { id: 'dosyaEki', tur: 'onay', etiket: 'Dosya ekleri (ataçlar)', varsayilan: false },
    { id: 'form', tur: 'onay', etiket: 'Form alanları (doldurulacak kutular)', varsayilan: false },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const turler = ['yorum', 'vurgu', 'baglanti', 'dosyaEki', 'form'].filter((t) => a[t]);
    const r = await aciklamalariKaldir(d.bayt, { turler });
    return {
      ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-aciklamasiz'), bayt: r.bayt }] : [],
      mesaj: r.degisti ? `${r.toplam} açıklama kaldırıldı.` : 'Seçilen türde açıklama bulunamadı; dosya değiştirilmedi.',
      uyarilar: r.uyarilar,
    };
  },
});
