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
        { deger: 'boyut', ad: 'Dosya boyutuna göre (her parça en çok X MB)' },
        { deger: 'yerimi', ad: 'Yer imlerine (bölümlere) göre' },
      ],
    },
    {
      id: 'araliklar', tur: 'metin', etiket: 'Aralıklar', ipucu: '1-3; 4-6; 7-', genis: true,
      aciklama: 'Her ";" ile ayrılan parça ayrı bir dosya olur. Bir parçada virgülle birden çok sayfa yazabilirsiniz: 1-3, 5',
      goster: (d) => d.mod === 'aralik',
    },
    { id: 'hedefMB', tur: 'sayi', etiket: 'Her dosya en çok kaç MB olsun?', varsayilan: 10, min: 0.01, adim: 0.5, goster: (d) => d.mod === 'boyut', aciklama: 'Gerçek dosya boyutu ölçülerek bölünür; tek başına hedeften büyük sayfa kendi dosyası olur.' },
    { id: 'duzey', tur: 'sayi', etiket: 'Yer imi düzeyi', varsayilan: 1, min: 1, max: 6, adim: 1, goster: (d) => d.mod === 'yerimi', aciklama: '1 = ana bölümler, 2 = alt başlıklara kadar. Dosya adına bölüm başlığı yazılır.' },
    { id: 'n', tur: 'sayi', etiket: 'Kaç sayfada bir?', varsayilan: 10, min: 1, adim: 1, goster: (d) => d.mod === 'her-n' },
  ],
  async calistir({ dosyalar, ayarlar }) {
    const d = dosyalar[0];
    const s = await bol(d.bayt, d.ad, { mod: ayarlar.mod, araliklar: ayarlar.araliklar, n: ayarlar.n, hedefMB: ayarlar.hedefMB, duzey: ayarlar.duzey });
    return {
      ciktilar: s.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })),
      uyarilar: s.uyarilar,
      mesaj: `${s.dosyalar.length} dosya oluşturuldu.`,
    };
  },
});
