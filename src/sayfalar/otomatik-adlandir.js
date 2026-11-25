// Başlığa göre yeniden adlandır: dosya adını belgenin başlığından üretir (içerik değişmez). Toplu işte çok işe yarar.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { baslikBul } from '../core/yer-imi.js';

const temizAd = (s, en) => String(s).replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, en);

aracKur({
  slug: 'otomatik-adlandir',
  dosya: { tur: 'pdf' },
  dugme: 'Başlığa göre adlandır',
  notlar: [kutu('bilgi', h('span', {}, 'Dosya adı, önce belgenin üstveri “Başlık” alanından, yoksa ilk sayfadaki en büyük yazıdan üretilir. PDF’in içeriği hiç değişmez. ',
    'Klasör seçerek yüzlerce dosyayı bir seferde adlandırabilirsiniz; başlık bulunamayan dosya özgün adıyla kalır.'))],
  alanlar: [
    { id: 'en', tur: 'sayi', etiket: 'Ad en çok kaç karakter olsun?', varsayilan: 90, min: 20, max: 200, adim: 1 },
    { id: 'onek', tur: 'metin', etiket: 'Adın başına eklenecek yazı (isteğe bağlı)', ipucu: 'örn. Kılavuz - ' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const b = await baslikBul(d.bayt);
    const bulundu = b ? temizAd(`${a.onek ?? ''}${b.baslik}`, Math.round(a.en) || 90) : '';
    if (!bulundu) return { ciktilar: [{ ad: d.ad, bayt: d.bayt }], mesaj: `“${d.ad}” için başlık bulunamadı; özgün adıyla bırakıldı.`, uyarilar: ['Başlık bulunamayan dosyalar özgün adıyla kalır (taranmış ya da üstverisiz belgeler).'] };
    return { ciktilar: [{ ad: `${bulundu}.pdf`, bayt: d.bayt }], mesaj: `Yeni ad: ${bulundu}.pdf (kaynak: ${b.kaynak === 'ustveri' ? 'üstveri başlığı' : 'ilk sayfadaki büyük yazı'})` };
  },
});
