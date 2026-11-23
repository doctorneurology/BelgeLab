import { aracKur } from '../ui/arac.js';
import { bol } from '../core/sayfalar.js';

aracKur({
  slug: 'bol',
  dosya: { tur: 'pdf' },
  dugme: 'PDF’i böl',
  alanlar: [
    {
      id: 'mod', tur: 'secim', etiket: 'Nasıl bölünsün?', varsayilan: 'aralik',
      secenekler: [
        { deger: 'aralik', ad: 'Yazdığım sayfa aralıklarına göre' },
        { deger: 'her-n', ad: 'Her N sayfada bir' },
        { deger: 'tek', ad: 'Her sayfa ayrı bir dosya olsun' },
      ],
    },
    {
      id: 'araliklar', tur: 'metin', etiket: 'Aralıklar', ipucu: '1-3; 4-6; 7-', genis: true,
      aciklama: 'Her ";" ile ayrılan parça ayrı bir dosya olur. Bir parçada virgülle birden çok sayfa yazabilirsiniz: 1-3, 5',
      goster: (d) => d.mod === 'aralik',
    },
    { id: 'n', tur: 'sayi', etiket: 'Kaç sayfada bir?', varsayilan: 10, min: 1, adim: 1, goster: (d) => d.mod === 'her-n' },
  ],
  async calistir({ dosyalar, ayarlar }) {
    const d = dosyalar[0];
    const s = await bol(d.bayt, d.ad, { mod: ayarlar.mod, araliklar: ayarlar.araliklar, n: ayarlar.n });
    return {
      ciktilar: s.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })),
      uyarilar: s.uyarilar,
      mesaj: `${s.dosyalar.length} dosya oluşturuldu.`,
    };
  },
});
