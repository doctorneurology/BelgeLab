import { aracKur } from '../ui/arac.js';
import { birlestir } from '../core/sayfalar.js';

aracKur({
  slug: 'birlestir',
  dosya: { tur: 'pdf', coklu: true, enAz: 2 },
  ayarBasligi: 'Sıra',
  notlar: [],
  dugme: 'PDF’leri birleştir',
  alanlar: [],
  async calistir({ dosyalar }) {
    const s = await birlestir(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt })));
    return {
      ciktilar: [{ ad: 'birlesik.pdf', bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${dosyalar.length} dosya listedeki sırayla birleştirildi (toplam ${s.sayfaSayisi} sayfa). Sırayı değiştirmek için dosya listesindeki ↑ ↓ düğmelerini kullanın.`,
    };
  },
});
