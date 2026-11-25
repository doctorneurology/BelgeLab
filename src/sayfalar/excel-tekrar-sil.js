// Excel: yinelenen (tekrar eden) satırları sil.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { excelTekrarSil } from '../core/excel-ek.js';

aracKur({
  slug: 'excel-tekrar-sil',
  dosya: { tur: 'excel' },
  ayarBasligi: 'Hangi satırlar tekrar sayılsın?',
  dugme: 'Yinelenenleri sil',
  notlar: [kutu('uyari', 'Değerler yeni dosyaya yazılır; formüller, hücre biçimleri, renkler ve birleştirilmiş hücreler korunmaz. Özgün dosyanız değişmez; yine de önemli dosyalarda yedek alın.')],
  alanlar: [
    { id: 'sutunlar', tur: 'metin', etiket: 'Karşılaştırılacak sütunlar', ipucu: 'örn. TC, Ad Soyad   ya da   A, C', aciklama: 'Başlık adlarını ya da sütun harflerini virgülle yazın. Boş bırakırsanız TÜM sütunları aynı olan satırlar tekrar sayılır.' },
    { id: 'baslik', tur: 'onay', etiket: 'İlk satır başlıktır (silinmez, karşılaştırılmaz)', varsayilan: true },
    { id: 'tut', tur: 'secim', etiket: 'Tekrarlardan hangisi kalsın?', varsayilan: 'ilk', secenekler: [{ deger: 'ilk', ad: 'İlk satır' }, { deger: 'son', ad: 'Son satır' }] },
    { id: 'buyukKucuk', tur: 'onay', etiket: 'Büyük/küçük harf farkı önemli olsun', varsayilan: false },
    { id: 'kirp', tur: 'onay', etiket: 'Baştaki/sondaki boşlukları yok say', varsayilan: true },
    { id: 'sayfa', tur: 'metin', etiket: 'Sayfa adı (boş = tüm sayfalar)', ipucu: 'örn. Sayfa1' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    const r = excelTekrarSil(d.bayt, d.ad, { sutunlar: a.sutunlar, baslik: a.baslik, tut: a.tut, buyukKucuk: a.buyukKucuk, kirp: a.kirp, sayfa: a.sayfa?.trim() || 'hepsi' });
    return {
      ciktilar: [{ ad: r.ad, bayt: r.bayt }],
      mesaj: r.silinen ? `${r.silinen} yinelenen satır silindi.` : 'Yinelenen satır bulunamadı (dosya aynı değerlerle yeniden yazıldı).',
      uyarilar: r.uyarilar,
      ekler: [h('ul', {}, ...r.rapor.map((x) => h('li', {}, `${x.sayfa}: ${x.onceki} → ${x.sonraki} satır (${x.silinen} silindi)`)))],
    };
  },
});
