// PDF'teki gömülü resimleri ayıkla (PNG). Sayfa/resim sınırı yok.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { resimleriAyikla } from '../core/resim-ayikla.js';

aracKur({
  slug: 'resim-ayikla',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Resimleri ayıkla',
  notlar: [kutu('bilgi', 'PDF’e gömülü fotoğraf ve çizimler PNG olarak çıkarılır (sayfa görüntüsü değil, belgedeki asıl resimler). Birden çok dosya olursa ZIP olarak indirebilirsiniz.')],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-20' },
    { id: 'enAz', tur: 'sayi', etiket: 'En küçük resim kenarı (piksel)', varsayilan: 32, min: 1, max: 5000, aciklama: 'Bundan küçük simge/süs resimleri atlanır.' },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const r = await resimleriAyikla(d.bayt, d.ad, { sayfalar: a.sayfalar, enAzPiksel: Math.max(1, Math.round(a.enAz || 32)), ilerleme: (k, n) => ilerleme(k, n) });
    return {
      ciktilar: r.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })),
      mesaj: r.dosyalar.length ? `${r.dosyalar.length} resim ayıklandı.` : 'Bu sayfalarda ayıklanacak resim bulunamadı.',
      uyarilar: r.uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['pdften-resim', 'sikistir'])],
    };
  },
});
