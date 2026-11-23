import { aracKur } from '../ui/arac.js';
import { sifreModulu } from '../ui/ortam.js';
import { dosyaAdiTuret } from '../core/util.js';
import { kutu } from '../ui/yardim.js';

aracKur({
  slug: 'sifre-kaldir',
  dosya: { tur: 'pdf', sifreliyiDogrudanAl: true },
  ayarBasligi: 'Şifreyi girin',
  dugme: 'Şifreyi kaldır',
  notlar: [
    kutu('bilgi',
      'Bu araç yalnızca şifreyi SİZ GİRERSENİZ çalışır. Şifre tahmin etme, deneme-yanılma ya da şifreyi kırma özelliği yoktur ve olmayacaktır. Şifreyi bilmiyorsanız belgenin sahibinden isteyin.'),
  ],
  alanlar: [
    { id: 'sifre', tur: 'sifre', etiket: 'PDF’in şifresi', otomatik: 'off', genis: true },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const { sifreKaldir } = await sifreModulu();
    const s = await sifreKaldir(d.bayt, a.sifre);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-sifresiz'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: 'Şifre kaldırıldı. Çıktı dosyası artık şifresiz açılır.',
    };
  },
});
