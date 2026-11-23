import { aracKur } from '../ui/arac.js';
import { bilgiEkle } from '../core/bilgi.js';
import { dosyaAdiTuret } from '../core/util.js';

const yer = (id, etiket) => ({ id, tur: 'metin', etiket, ipucu: '' });

aracKur({
  slug: 'ust-alt-bilgi',
  dosya: { tur: 'pdf' },
  dugme: 'Bilgileri ekle',
  alanlar: [
    { id: 'b1', tur: 'baslik', etiket: 'Üst bilgi' },
    yer('ust-sol', 'Üst sol'), yer('ust-orta', 'Üst orta'), yer('ust-sag', 'Üst sağ'),
    { id: 'b2', tur: 'baslik', etiket: 'Alt bilgi' },
    yer('alt-sol', 'Alt sol'), yer('alt-orta', 'Alt orta'), yer('alt-sag', 'Alt sağ'),
    {
      id: 'ipucu', tur: 'baslik',
      etiket: 'Yer tutucular: {n} sayfa no · {toplam} son numara · {tarih} bugünün tarihi · {dosya} dosya adı',
    },
    { id: 'sayfalar', tur: 'metin', etiket: 'Hangi sayfalar? (boş = hepsi)', ipucu: 'örn. 2-' },
    { id: 'baslangicNo', tur: 'sayi', etiket: 'İlk numara ({n} için)', varsayilan: 1, min: 0, adim: 1 },
    { id: 'aile', tur: 'yazitipi', etiket: 'Yazı tipi', varsayilan: 'liberation-sans' },
    { id: 'boyut', tur: 'sayi', etiket: 'Yazı boyutu', varsayilan: 10, min: 5, max: 48, adim: 1, birim: 'pt' },
    { id: 'renk', tur: 'renk', etiket: 'Renk', varsayilan: '#000000' },
    { id: 'kenar', tur: 'sayi', etiket: 'Kenardan uzaklık', varsayilan: 28, min: 5, max: 120, adim: 1, birim: 'pt' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const alanlar = {};
    for (const k of ['ust-sol', 'ust-orta', 'ust-sag', 'alt-sol', 'alt-orta', 'alt-sag']) alanlar[k] = a[k];
    const s = await bilgiEkle(d.bayt, {
      alanlar, sayfalar: a.sayfalar, baslangicNo: a.baslangicNo, aile: a.aile, boyut: a.boyut, renk: a.renk, kenar: a.kenar,
      dosyaAdi: d.ad,
    });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-bilgili'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: `${s.islenen} sayfaya üst/alt bilgi eklendi.`,
    };
  },
});
