// PDF sıkıştır: yazı/çizgi kalitesine dokunmadan, fotoğraf türü resimleri küçülterek dosya boyutunu azaltır.
import { aracKur } from '../ui/arac.js';
import { h, kutu, boyutMetni } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { sikistir, DUZEYLER } from '../core/sikistir.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sikistir',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ne kadar küçültülsün?',
  dugme: 'Sıkıştır',
  notlar: [kutu('bilgi', h('span', {},
    'Yazılar, çizgiler ve yazı tipleri DEĞİŞMEZ (kalite %100 aynı, metin seçilebilir kalır). Yalnızca gereğinden yüksek çözünürlüklü fotoğraflar küçültülür. ',
    'Sonuç özgününden küçük değilse özgün dosya olduğu gibi verilir. Dosya yalnızca yazıdan oluşuyorsa kazanç az olabilir.'))],
  alanlar: [
    {
      id: 'duzey', tur: 'secim', etiket: 'Düzey', varsayilan: 'dengeli',
      secenekler: Object.entries(DUZEYLER).map(([deger, d]) => ({ deger, ad: `${d.ad} — fotoğraflar en çok ${d.enCokDpi} dpi, JPEG %${Math.round(d.kalite * 100)}` })),
    },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const r = await sikistir(d.bayt, { duzey: a.duzey, ilerleme: (k, n) => ilerleme(k, n) });
    const k = r.rapor;
    return {
      ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-kucuk'), bayt: r.bayt }] : [],
      mesaj: r.degisti
        ? `${boyutMetni(k.once)} → ${boyutMetni(k.sonra)}  (%${k.tasarrufYuzde.toString().replace('.', ',')} küçüldü). Resim: ${k.resimToplam} içinden ${k.resimYenilenen} tanesi yeniden kodlandı.`
        : 'Bu dosya zaten iyi sıkıştırılmış; daha küçük bir sürümü elde edilemedi.',
      uyarilar: r.uyarilar,
      ekler: [hizliGecis('Hızlı geçiş', ['pdf-word', 'karart', 'sayfa-sil'])],
    };
  },
});
