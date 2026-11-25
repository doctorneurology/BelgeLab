// Formu düzleştir: doldurulmuş form alanlarını sayfaya kalıcı yazı olarak işler.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { formuDuzlestir } from '../core/temizlik.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'formu-duzlestir',
  dosya: { tur: 'pdf' },
  dugme: 'Formu düzleştir',
  notlar: [kutu('bilgi', 'Form alanlarındaki değerler sayfanın kendisine işlenir; alanlar artık doldurulamaz ya da değiştirilemez. Doldurup göndermeden önce “son hâli” sabitlemek için kullanışlıdır.')],
  async calistir({ dosyalar }) {
    const d = dosyalar[0];
    const r = await formuDuzlestir(d.bayt);
    return {
      ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-duzlestirilmis'), bayt: r.bayt }] : [],
      mesaj: r.degisti ? `${r.alan} form alanı düzleştirildi.` : 'Bu belgede form alanı yok; dosya değiştirilmedi.',
      uyarilar: r.uyarilar,
    };
  },
});
