import { aracKur } from '../ui/arac.js';
import { izgaraAyari } from '../ui/izgara-arac.js';
import { sayfaSil } from '../core/sayfalar.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-sil',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Silinecek sayfaları seçin',
  dugme: 'Seçili sayfaları sil',
  ayar: izgaraAyari({
    mod: 'sil',
    aralikEtiketi: 'Silinecek sayfalar (isterseniz yazın)',
    yardim: 'Sayfaların üzerine dokunarak seçin; seçilenler kırmızı olur. Silinen sayfaların içeriği dosyadan tamamen kaldırılır.',
  }),
  async calistir({ dosyalar, ayarlar }) {
    if (!ayarlar.secilenler.length) throw new PdfHatasi('Silinecek en az bir sayfa seçin.');
    const d = dosyalar[0];
    const s = await sayfaSil(d.bayt, ayarlar.metin);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-sayfalar-silindi'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.silinen} sayfa silindi; ${s.sayfaSayisi} sayfa kaldı.`,
    };
  },
});
