import { aracKur } from '../ui/arac.js';
import { izgaraAyari } from '../ui/izgara-arac.js';
import { sayfaCikar } from '../core/sayfalar.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-cikar',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Çıkarılacak sayfaları seçin',
  dugme: 'Seçili sayfalardan PDF yap',
  ayar: izgaraAyari({
    mod: 'sec',
    aralikEtiketi: 'Çıkarılacak sayfalar (isterseniz yazın)',
    yardim: 'Sayfaların üzerine dokunarak seçin. Yeni PDF yalnızca seçtiğiniz sayfaları içerir; özgün dosya değişmez.',
  }),
  async calistir({ dosyalar, ayarlar }) {
    if (!ayarlar.secilenler.length) throw new PdfHatasi('Çıkarılacak en az bir sayfa seçin.');
    const d = dosyalar[0];
    const s = await sayfaCikar(d.bayt, ayarlar.metin);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-secili-sayfalar'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.sayfaSayisi} sayfalık yeni PDF hazır.`,
    };
  },
});
