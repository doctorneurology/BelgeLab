import { aracKur } from '../ui/arac.js';
import { pdfdenResimler } from '../core/render.js';

aracKur({
  slug: 'pdften-resim',
  dosya: { tur: 'pdf' },
  dugme: 'Resimlere çevir',
  alanlar: [
    {
      id: 'bicim', tur: 'secim', etiket: 'Resim biçimi', varsayilan: 'png',
      secenekler: [{ deger: 'png', ad: 'PNG (kayıpsız, büyük)' }, { deger: 'jpeg', ad: 'JPEG (küçük dosya)' }],
    },
    {
      id: 'dpi', tur: 'secim', etiket: 'Çözünürlük', varsayilan: '150',
      secenekler: [
        { deger: '72', ad: '72 dpi — ekran, küçük' }, { deger: '110', ad: '110 dpi — hafif' },
        { deger: '150', ad: '150 dpi — dengeli' }, { deger: '200', ad: '200 dpi — iyi' }, { deger: '300', ad: '300 dpi — baskı kalitesi' },
      ],
    },
    { id: 'sayfalar', tur: 'metin', etiket: 'Hangi sayfalar? (boş = hepsi)', ipucu: 'örn. 1-3, 7', genis: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const s = await pdfdenResimler(d.bayt, d.ad, { sayfalar: a.sayfalar, dpi: Number(a.dpi), bicim: a.bicim, ilerleme });
    return {
      ciktilar: s.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })),
      uyarilar: s.uyarilar,
      mesaj: `${s.dosyalar.length} resim oluşturuldu (${s.dosyalar[0].genislik}×${s.dosyalar[0].yukseklik} piksel).`,
    };
  },
});
