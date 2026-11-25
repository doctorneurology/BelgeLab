// Boş sayfaları sil ya da boş sayfalardan keserek böl.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { bosSayfalariSil, bosSayfadanBol } from '../core/bos-sayfa.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'bos-sayfa',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Boş sayfalar',
  dugme: 'Boş sayfaları bul ve uygula',
  notlar: [kutu('bilgi', h('span', {}, 'Sayfada neredeyse hiç koyu nokta yoksa ve seçilebilir yazı da yoksa “boş” sayılır. Taramalardaki toz/leke için hassasiyeti düşürün. ',
    'Birkaç dosyayı birden seçerseniz hepsi aynı ayarla işlenir.'))],
  alanlar: [
    { id: 'mod', tur: 'secim', etiket: 'Ne yapılsın?', varsayilan: 'sil', secenekler: [{ deger: 'sil', ad: 'Boş sayfaları sil' }, { deger: 'bol', ad: 'Boş sayfalardan keserek böl (ayırıcı sayfa olarak kullan)' }] },
    {
      id: 'hassasiyet', tur: 'secim', etiket: 'Boş sayma hassasiyeti', varsayilan: 'orta',
      secenekler: [{ deger: 'yuksek', ad: 'Yüksek — yalnızca tamamen temiz sayfalar' }, { deger: 'orta', ad: 'Orta (önerilen)' }, { deger: 'dusuk', ad: 'Düşük — az lekeli/gürültülü taramalar da boş sayılsın' }],
    },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const secenek = { hassasiyet: a.hassasiyet, ilerleme: (k, n) => ilerleme(k, n) };
    if (a.mod === 'bol') {
      const r = await bosSayfadanBol(d.bayt, d.ad, secenek);
      return {
        ciktilar: r.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })),
        mesaj: r.dosyalar.length ? `${r.bos.length} boş sayfadan kesildi; ${r.dosyalar.length} dosya oluştu.` : 'Bölünecek bir şey bulunamadı.',
        uyarilar: r.uyarilar,
      };
    }
    const r = await bosSayfalariSil(d.bayt, secenek);
    return {
      ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-bos-sayfasiz'), bayt: r.bayt }] : [],
      mesaj: r.degisti ? `${r.silinen} boş sayfa silindi (sayfa ${r.silinenSayfalar.join(', ')}); ${r.sayfaSayisi} sayfa kaldı.` : 'Boş sayfa bulunamadı; dosya değiştirilmedi.',
      uyarilar: r.uyarilar,
    };
  },
});
