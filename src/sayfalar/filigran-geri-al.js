import { aracKur } from '../ui/arac.js';
import { filigranGeriAl, filigranSay } from '../core/filigran.js';
import { dosyaAdiTuret } from '../core/util.js';
import { kutu } from '../ui/yardim.js';

aracKur({
  slug: 'filigran-geri-al',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ne yapılacak?',
  dugme: 'Filigranı geri al',
  notlar: [
    kutu('bilgi',
      'Bu araç YALNIZCA bu sitedeki “Filigran ekle” aracıyla eklenmiş filigranı kaldırır. Başka bir program ya da kişi tarafından konmuş filigranlar, logolar ve telif işaretleri kaldırılamaz; bunun için bir özellik yoktur.'),
  ],
  alanlar: [],
  async calistir({ dosyalar }) {
    const d = dosyalar[0];
    const sayim = await filigranSay(d.bayt);
    if (!sayim.adet) {
      return {
        ciktilar: [],
        bilgiler: ['Bu belgede, bu site tarafından eklenmiş bir filigran bulunamadı; dosyaya hiçbir değişiklik yapılmadı. Belgede görünen filigran başka bir kaynaktan geliyorsa kaldırılamaz.'],
      };
    }
    const s = await filigranGeriAl(d.bayt);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-filigransiz'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.sayfa} sayfadan bu siteyle eklenmiş filigran kaldırıldı.`,
    };
  },
});
