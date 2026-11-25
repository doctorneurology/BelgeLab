// Resim araçları: boyutlandır, sıkıştır, JPG/PNG/WebP dönüştür. Birden çok resim seçilirse hepsi aynı ayarla işlenir.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { resimIsle } from '../core/resim-araclari.js';

aracKur({
  slug: 'resim-araclari',
  dosya: { tur: 'resim' },
  ayarBasligi: 'Ne yapılsın?',
  dugme: 'Resmi işle',
  notlar: [kutu('bilgi', h('span', {}, 'Resimler cihazınızda işlenir; hiçbir yere yüklenmez. Yeniden kodlanan resimden konum/cihaz gibi EXIF üstverisi silinir. Birden çok resim ya da klasör seçerseniz hepsi aynı ayarla dönüştürülür ve ZIP olarak indirilir.'))],
  alanlar: [
    { id: 'b1', tur: 'baslik', etiket: 'Boyut' },
    { id: 'boyutMod', tur: 'secim', etiket: 'Boyutlandırma', varsayilan: 'ayni', secenekler: [{ deger: 'ayni', ad: 'Boyutu değiştirme' }, { deger: 'genislik', ad: 'Genişliğe göre (oran korunur)' }, { deger: 'yukseklik', ad: 'Yüksekliğe göre (oran korunur)' }, { deger: 'yuzde', ad: 'Yüzdeyle küçült/büyüt' }, { deger: 'tam', ad: 'Tam ölçü (oran bozulabilir)' }] },
    { id: 'genislik', tur: 'sayi', etiket: 'Genişlik (piksel)', varsayilan: 1600, min: 1, max: 20000, adim: 1, goster: (d) => d.boyutMod === 'genislik' || d.boyutMod === 'tam' },
    { id: 'yukseklik', tur: 'sayi', etiket: 'Yükseklik (piksel)', varsayilan: 1200, min: 1, max: 20000, adim: 1, goster: (d) => d.boyutMod === 'yukseklik' || d.boyutMod === 'tam' },
    { id: 'yuzde', tur: 'sayi', etiket: 'Ölçek (%)', varsayilan: 50, min: 1, max: 800, adim: 1, goster: (d) => d.boyutMod === 'yuzde' },
    { id: 'b2', tur: 'baslik', etiket: 'Biçim ve sıkıştırma' },
    { id: 'bicim', tur: 'secim', etiket: 'Çıktı biçimi', varsayilan: 'ayni', secenekler: [{ deger: 'ayni', ad: 'Aynı kalsın (JPG/PNG/WebP)' }, { deger: 'jpeg', ad: 'JPG' }, { deger: 'png', ad: 'PNG (kayıpsız)' }, { deger: 'webp', ad: 'WebP (küçük dosya)' }] },
    { id: 'kalite', tur: 'aralik', etiket: 'Kalite (%)', varsayilan: 85, min: 10, max: 100, adim: 1, aciklama: 'JPG ve WebP için. Düşük kalite = küçük dosya.', goster: (d) => d.bicim !== 'png' },
    { id: 'hedefKB', tur: 'sayi', etiket: 'Hedef dosya boyutu (KB, isteğe bağlı)', ipucu: 'örn. 200', min: 1, adim: 1, aciklama: 'Doldurursanız kalite, dosya bu boyutun altına inene kadar otomatik düşürülür (JPG/WebP).', goster: (d) => d.bicim !== 'png' },
    { id: 'arkaPlan', tur: 'renk', etiket: 'Saydam alanların rengi (JPG için)', varsayilan: '#ffffff', goster: (d) => d.bicim === 'jpeg' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const g = Number(a.genislik) || undefined, y = Number(a.yukseklik) || undefined;
    const o = { bicim: a.bicim, kalite: (Number(a.kalite) || 85) / 100, hedefKB: Number(a.hedefKB) || undefined, arkaPlan: a.arkaPlan || '#ffffff' };
    if (a.boyutMod === 'genislik') o.genislik = g;
    else if (a.boyutMod === 'yukseklik') o.yukseklik = y;
    else if (a.boyutMod === 'yuzde') o.yuzde = Number(a.yuzde);
    else if (a.boyutMod === 'tam') { o.genislik = g; o.yukseklik = y; }
    const r = await resimIsle(d.bayt, d.ad, o);
    const azalma = Math.round((1 - r.bayt.length / d.bayt.length) * 100);
    return {
      ciktilar: [{ ad: r.ad, bayt: r.bayt }],
      mesaj: `${r.genislik}×${r.yukseklik} ${r.bicim}, ${(r.bayt.length / 1024).toFixed(0)} KB (özgün ${(d.bayt.length / 1024).toFixed(0)} KB${azalma > 0 ? `, %${azalma} küçüldü` : azalma < 0 ? `, %${-azalma} büyüdü` : ''}).`,
      uyarilar: r.uyarilar,
    };
  },
});
