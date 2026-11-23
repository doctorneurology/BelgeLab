import { aracKur } from '../ui/arac.js';
import { sifreModulu } from '../ui/ortam.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';
import { kutu } from '../ui/yardim.js';

aracKur({
  slug: 'sifre-ekle',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Şifre belirleyin',
  dugme: 'Şifre koy',
  notlar: [kutu('uyari', 'Şifreyi unutursanız belgeyi kimse açamaz; bu site de kurtaramaz. Şifreyi güvenli bir yerde saklayın. Şifre yalnızca cihazınızda işlenir, hiçbir yere gönderilmez.')],
  alanlar: [
    { id: 'sifre', tur: 'sifre', etiket: 'Açma şifresi', otomatik: 'new-password' },
    { id: 'tekrar', tur: 'sifre', etiket: 'Açma şifresi (tekrar)', otomatik: 'new-password' },
    { id: 'b', tur: 'baslik', etiket: 'İzinler (isteğe bağlı)' },
    {
      id: 'yazdir', tur: 'secim', etiket: 'Yazdırma', varsayilan: 'tam',
      secenekler: [{ deger: 'tam', ad: 'İzinli' }, { deger: 'dusuk', ad: 'Yalnızca düşük kalite' }, { deger: 'yok', ad: 'Yasak' }],
    },
    {
      id: 'duzenle', tur: 'secim', etiket: 'Düzenleme', varsayilan: 'tam',
      secenekler: [{ deger: 'tam', ad: 'İzinli' }, { deger: 'yok', ad: 'Yasak' }],
    },
    { id: 'kopyala', tur: 'onay', etiket: 'Metin kopyalamaya izin ver', varsayilan: true },
    {
      id: 'sahip', tur: 'sifre', etiket: 'Yönetici şifresi (isteğe bağlı)', otomatik: 'new-password',
      aciklama: 'İzinleri sonradan değiştirmek için ayrı bir şifre. Boş bırakırsanız açma şifresi kullanılır.',
    },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    if (!a.sifre) throw new PdfHatasi('Bir şifre yazın.');
    if (a.sifre !== a.tekrar) throw new PdfHatasi('İki şifre aynı değil; lütfen tekrar kontrol edin.');
    const d = dosyalar[0];
    const { sifreEkle } = await sifreModulu();
    const s = await sifreEkle(d.bayt, {
      kullaniciSifresi: a.sifre, sahipSifresi: a.sahip,
      izinler: { yazdir: a.yazdir, duzenle: a.duzenle, kopyala: a.kopyala },
    });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-sifreli'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: 'Şifre konuldu (AES-256). Dosyayı açmayı deneyerek şifreyi doğrulayın.',
      onizlemeYok: true,
    };
  },
  onizleme: false,
});
