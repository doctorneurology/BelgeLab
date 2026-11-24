// PDF → Word (.docx): en iyi çaba dönüştürme. Sonuç orijinalin birebir aynısı olmaz; ekranda bu açıkça söylenir.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenWord } from '../core/pdf-word.js';
import { ocrKapat } from '../core/ocr.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'pdf-word',
  topluBitti: () => ocrKapat(), // toplu kipte OCR motoru bir kez açılır, en sonda kapatılır
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Word’e çevir',
  onizleme: false,
  notlar: [
    kutu('uyari', h('span', {},
      h('b', {}, 'Sonuç birebir aynı olmaz. '),
      'PDF’te yazılar sayfaya tek tek yerleştirilmiştir, Word’de ise metin akar. Paragraflar, başlıklar (yazı boyutundan), resimler, madde işaretleri ve düzenli hizalı basit tablolar aktarılmaya çalışılır. ',
      'İki sütunlu sayfalar, birleştirilmiş hücreli tablolar, metin kutuları ve formüller bozulabilir. Çıktıyı Word’de mutlaka kontrol edin.')),
    kutu('bilgi', 'Taranmış (resim) sayfalar önce OCR ile okunur; bu sayfalarda yazı tipi/kalınlık ve sayfadaki resimler aktarılmaz, okuma hataları olabilir.'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-5, 8' },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku (Türkçe)' }, { deger: 'yok', ad: 'Okuma; yalnızca gerçek yazıyı al' }] },
    { id: 'resimler', tur: 'onay', etiket: 'Resimleri aktar', varsayilan: true },
    { id: 'ustAlt', tur: 'onay', etiket: 'Sayfa numaralarını ve her sayfada tekrarlanan üst/alt bilgiyi atla', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    if (a.ocr !== 'yok') await ocrHazirla();
    try {
      const r = await pdfdenWord(d.bayt, {
        sayfalar: a.sayfalar, ocr: a.ocr, resimler: a.resimler, ustAltAtla: a.ustAlt, dosyaAdi: d.ad,
        ilerleme: (k, n) => ilerleme(k, n),
      });
      const b = r.bilgi;
      const parcalar = [`${b.paragraf} paragraf`, b.baslik && `${b.baslik} başlık`, b.madde && `${b.madde} madde`, b.tablo && `${b.tablo} tablo`, b.resim && `${b.resim} resim`].filter(Boolean);
      return {
        ciktilar: [{ ad: dosyaAdiTuret(d.ad, '', 'docx'), bayt: r.bayt }],
        mesaj: `Word dosyası hazır: ${parcalar.join(', ')}. Word’de açıp kontrol edin; gerekirse düzeltin.`,
        uyarilar: r.uyarilar,
        ekler: [hizliGecis('Hızlı geçiş', ['ocr', 'sikistir'], '(isterseniz önce PDF’i sadeleştirin)')],
      };
    } finally {
      if (!toplu) await ocrKapat();
    }
  },
});
