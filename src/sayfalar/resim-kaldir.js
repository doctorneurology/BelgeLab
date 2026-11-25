// Sayfalardaki resimleri kaldır (yazı ve çizimler kalır; dosya küçülür).
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { resimleriKaldir } from '../core/temizlik.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'resim-kaldir',
  dosya: { tur: 'pdf' },
  dugme: 'Resimleri kaldır',
  notlar: [kutu('uyari', 'Sayfalardaki TÜM resimler (fotoğraf, logo, taranmış sayfa görüntüsü) kaldırılır. Taranmış bir belgede sayfa tamamen boş kalır. Yazı ve çizgi çizimleri kalır. Özgün dosyanızı saklayın.')],
  async calistir({ dosyalar }) {
    const d = dosyalar[0];
    const r = await resimleriKaldir(d.bayt);
    return {
      ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-resimsiz'), bayt: r.bayt }] : [],
      mesaj: r.degisti ? `${r.adet} resim çizimi kaldırıldı; dosya yüzde ${Math.max(0, Math.round((1 - r.bayt.length / d.bayt.length) * 100))} küçüldü.` : 'Kaldırılacak resim bulunamadı; dosya değiştirilmedi.',
      uyarilar: r.uyarilar,
    };
  },
});
