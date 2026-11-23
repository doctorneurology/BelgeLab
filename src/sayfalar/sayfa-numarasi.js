import { aracKur } from '../ui/arac.js';
import { sayfaNumarasiEkle } from '../core/bilgi.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-numarasi',
  dosya: { tur: 'pdf' },
  dugme: 'Numaraları ekle',
  alanlar: [
    {
      id: 'konum', tur: 'secim', etiket: 'Konum', varsayilan: 'alt-orta',
      secenekler: [
        { deger: 'alt-orta', ad: 'Alt orta' }, { deger: 'alt-sag', ad: 'Alt sağ' }, { deger: 'alt-sol', ad: 'Alt sol' },
        { deger: 'ust-orta', ad: 'Üst orta' }, { deger: 'ust-sag', ad: 'Üst sağ' }, { deger: 'ust-sol', ad: 'Üst sol' },
      ],
    },
    {
      id: 'bicim', tur: 'secim', etiket: 'Yazı biçimi', varsayilan: '{n}',
      secenekler: [
        { deger: '{n}', ad: '1' }, { deger: 'Sayfa {n}', ad: 'Sayfa 1' }, { deger: '{n} / {toplam}', ad: '1 / 10' },
        { deger: 'Sayfa {n} / {toplam}', ad: 'Sayfa 1 / 10' }, { deger: '- {n} -', ad: '- 1 -' }, { deger: 'ozel', ad: 'Kendim yazacağım…' },
      ],
    },
    {
      id: 'ozel', tur: 'metin', etiket: 'Özel biçim', varsayilan: 'Sayfa {n}', genis: true,
      aciklama: '{n} = sayfa numarası, {toplam} = son numara. Örnek: Rapor — {n}', goster: (d) => d.bicim === 'ozel',
    },
    {
      id: 'numaraBicimi', tur: 'secim', etiket: 'Rakam türü', varsayilan: 'arap',
      secenekler: [{ deger: 'arap', ad: '1, 2, 3' }, { deger: 'roma', ad: 'I, II, III' }, { deger: 'roma-kucuk', ad: 'i, ii, iii' }],
    },
    { id: 'baslangicNo', tur: 'sayi', etiket: 'İlk numara', varsayilan: 1, min: 0, adim: 1, aciklama: 'İlk numaralanan sayfaya hangi numara yazılsın?' },
    { id: 'sayfalar', tur: 'metin', etiket: 'Hangi sayfalar? (boş = hepsi)', ipucu: 'örn. 2- (kapağı atla)', aciklama: 'Numaralar yalnızca bu sayfalara yazılır ve saymaya buradan başlanır.' },
    { id: 'baslik1', tur: 'baslik', etiket: 'Görünüm' },
    { id: 'aile', tur: 'yazitipi', etiket: 'Yazı tipi', varsayilan: 'liberation-sans' },
    { id: 'boyut', tur: 'sayi', etiket: 'Yazı boyutu', varsayilan: 11, min: 5, max: 48, adim: 1, birim: 'pt' },
    { id: 'renk', tur: 'renk', etiket: 'Renk', varsayilan: '#000000' },
    { id: 'kenar', tur: 'sayi', etiket: 'Kenardan uzaklık', varsayilan: 28, min: 5, max: 120, adim: 1, birim: 'pt' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const s = await sayfaNumarasiEkle(d.bayt, {
      konum: a.konum, bicim: a.bicim === 'ozel' ? a.ozel : a.bicim, numaraBicimi: a.numaraBicimi,
      baslangicNo: a.baslangicNo, sayfalar: a.sayfalar, aile: a.aile, boyut: a.boyut, renk: a.renk, kenar: a.kenar,
    });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-numarali'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.islenen} sayfaya numara eklendi.`,
    };
  },
});
