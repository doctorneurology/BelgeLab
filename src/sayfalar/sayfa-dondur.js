import { aracKur } from '../ui/arac.js';
import { izgaraAyari } from '../ui/izgara-arac.js';
import { sayfaDondur } from '../core/sayfalar.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-dondur',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Döndürülecek sayfaları ayarlayın',
  dugme: 'Döndürmeyi uygula',
  ayar: izgaraAyari({
    mod: 'dondur',
    yardim: 'Her sayfanın altındaki ↺ ↻ düğmeleriyle tek tek, ya da üstteki düğmelerle hepsini birden döndürün.',
  }),
  async calistir({ dosyalar, ayarlar }) {
    if (!Object.keys(ayarlar.donusler).length) throw new PdfHatasi('Hiçbir sayfa döndürülmedi; önce ↺ ya da ↻ düğmelerine basın.');
    const d = dosyalar[0];
    const s = await sayfaDondur(d.bayt, ayarlar.donusler);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-dondurulmus'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.degisen} sayfa döndürüldü. Belgenin geri kalanına dokunulmadı.`,
    };
  },
});
