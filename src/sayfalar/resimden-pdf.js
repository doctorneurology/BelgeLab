import { aracKur } from '../ui/arac.js';
import { resimlerdenPdf } from '../core/resim-pdf.js';

aracKur({
  slug: 'resimden-pdf',
  dosya: { tur: 'resim', coklu: true, enAz: 1 },
  ayarBasligi: 'Sayfa düzeni',
  dugme: 'PDF oluştur',
  alanlar: [
    {
      id: 'sayfaBoyutu', tur: 'secim', etiket: 'Sayfa boyutu', varsayilan: 'A4',
      secenekler: [
        { deger: 'A4', ad: 'A4' }, { deger: 'A3', ad: 'A3' }, { deger: 'A5', ad: 'A5' },
        { deger: 'Letter', ad: 'Letter' }, { deger: 'Legal', ad: 'Legal' }, { deger: 'resim', ad: 'Resmin kendi boyutu' },
      ],
    },
    {
      id: 'yon', tur: 'secim', etiket: 'Sayfa yönü', varsayilan: 'otomatik',
      secenekler: [{ deger: 'otomatik', ad: 'Resme göre otomatik' }, { deger: 'dikey', ad: 'Hep dikey' }, { deger: 'yatay', ad: 'Hep yatay' }],
      goster: (d) => d.sayfaBoyutu !== 'resim',
    },
    {
      id: 'kenar', tur: 'secim', etiket: 'Kenar boşluğu', varsayilan: 'kucuk',
      secenekler: [{ deger: 'yok', ad: 'Yok' }, { deger: 'kucuk', ad: 'Küçük' }, { deger: 'orta', ad: 'Orta' }, { deger: 'buyuk', ad: 'Büyük' }],
      goster: (d) => d.sayfaBoyutu !== 'resim',
    },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const s = await resimlerdenPdf(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt })), a);
    return {
      ciktilar: [{ ad: 'resimler.pdf', bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.sayfaSayisi} sayfalık PDF oluşturuldu. Resimlerin sırası listedeki sıradır.`,
    };
  },
});
