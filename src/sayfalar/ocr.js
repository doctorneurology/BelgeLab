// OCR: taranmış PDF'i aranabilir yap (Türkçe). Okunan yazı görünmez katman olarak eklenir; sayfanın görünüşü değişmez.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfOcr, ocrKapat } from '../core/ocr.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'ocr',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Yazıyı oku (OCR)',
  notlar: [
    kutu('bilgi', h('span', {},
      'Taranmış sayfalardaki yazı okunur ve sayfanın ÜSTÜNE görünmez olarak eklenir. Sayfa aynı görünür; ama yazı aranabilir ve kopyalanabilir olur. ',
      'Türkçe dil verisi bu sitenin içindedir; internetten bir şey indirilmez. İlk okuma birkaç saniye hazırlık gerektirir; sayfa başına yaklaşık 3–10 saniye sürer.')),
    kutu('uyari', 'OCR hata yapabilir (bulanık, eğik, soluk taramalarda daha çok). Okunan yazı belgeye “gerçek yazı” olarak yazılmaz; yalnızca arama için görünmez katmandır. Yanlış okunan kelime aramada çıkmayabilir.'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-5, 8', aciklama: 'Zaten seçilebilir yazısı olan sayfalar otomatik atlanır.' },
    { id: 'dpi', tur: 'secim', etiket: 'Okuma çözünürlüğü', varsayilan: '300', secenekler: [{ deger: '200', ad: '200 dpi (hızlı)' }, { deger: '300', ad: '300 dpi (önerilen)' }, { deger: '400', ad: '400 dpi (küçük yazılar, yavaş)' }] },
    { id: 'yine', tur: 'onay', etiket: 'Zaten yazısı olan sayfaları da oku', aciklama: 'Genellikle gerekmez; yazı iki kez bulunabilir.' },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    await ocrHazirla();
    try {
      const r = await pdfOcr(d.bayt, {
        sayfalar: a.sayfalar, dpi: Number(a.dpi), yaziVarsa: a.yine ? 'yine' : 'atla',
        ilerleme: (k, n) => ilerleme(k, n),
      });
      const tamam = r.rapor.filter((s) => s.durum === 'tamam');
      const kelime = tamam.reduce((t, s) => t + s.kelime, 0);
      const ort = tamam.length ? Math.round(tamam.reduce((t, s) => t + s.guven, 0) / tamam.length) : null;
      return {
        ciktilar: r.degisti ? [{ ad: dosyaAdiTuret(d.ad, '-aranabilir'), bayt: r.bayt }] : [],
        mesaj: r.degisti
          ? `${tamam.length} sayfa okundu, ${kelime} kelime bulundu (ortalama güven %${ort}). Dosya artık aranabilir.`
          : 'Hiçbir sayfada okunacak yazı bulunamadı; dosya değiştirilmedi.',
        uyarilar: r.uyarilar,
        ekler: [hizliGecis('Hızlı geçiş', ['taranmis-duzelt', 'pdf-word', 'sikistir', 'karart'], '(dosyayı o sayfada yeniden seçmeniz gerekir; dosyalarınız hiçbir yere gönderilmez)')],
      };
    } finally {
      await ocrKapat();
    }
  },
});
