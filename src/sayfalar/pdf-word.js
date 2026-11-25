// PDF → Word (.docx): iki kip. "Düzeni koru" sayfanın görünüşüne yakın Word üretir (GenOffice pdf2docx + PDFium);
// "Düzenlenebilir akış" metni akan, düzenlemesi kolay Word'e çevirir (OCR dahil). İkisi de en iyi çabadır; ekranda açıkça söylenir.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenWord } from '../core/pdf-word.js';
import { pdfdenWordDuzenli } from '../core/pdf-word-duzen.js';
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
    kutu('bilgi', h('span', {},
      h('b', {}, 'İki kip var. '), h('b', {}, 'Düzeni koru: '), 'sayfa görünüşüne en yakın Word (sütunlar, resim yerleri, kalın/italik/renk korunur); metin yüzen kutularla kurulduğu için düzenlemesi zordur. ',
      h('b', {}, 'Düzenlenebilir akış: '), 'metin Word’de akar, başlıklar gerçek başlık stilindedir, düzenlemesi kolaydır ama sayfa görünüşü korunmaz; taranmış sayfalar OCR ile okunur.')),
    kutu('uyari', 'Her iki kipte de sonuç birebir aynı olmaz; çıktıyı Word’de mutlaka kontrol edin. “Düzeni koru”da yazı tipleri belgedeki adlarıyla yazılır; bilgisayarınızda yoksa Word yedek yazı tipi kullanır ve satırlar kayabilir.'),
  ],
  alanlar: [
    {
      id: 'kip', tur: 'secim', etiket: 'Kip', varsayilan: 'duzen',
      secenekler: [{ deger: 'duzen', ad: 'Düzeni koru (görünüşe en yakın)' }, { deger: 'akis', ad: 'Düzenlenebilir akış (kolay düzenlenir, OCR dahil)' }],
    },
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-5, 8' },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku' }, { deger: 'yok', ad: 'Okuma; yalnızca gerçek yazıyı al' }], aciklama: '“Düzeni koru” kipinde taranmış belge algılanırsa otomatik olarak “Düzenlenebilir akış”a (OCR’lı) geçilir.' },
    { id: 'dil', tur: 'secim', etiket: 'OCR dili', varsayilan: 'tur+eng', secenekler: [{ deger: 'tur+eng', ad: 'Türkçe + İngilizce (önerilen)' }, { deger: 'tur', ad: 'Yalnız Türkçe' }, { deger: 'eng', ad: 'Yalnız İngilizce' }], aciklama: 'Yalnızca taranmış sayfalarda kullanılır.' },
    { id: 'resimler', tur: 'onay', etiket: 'Resimleri aktar', varsayilan: true, goster: (d) => d.kip === 'akis' },
    { id: 'ustAlt', tur: 'onay', etiket: 'Sayfa numaralarını ve her sayfada tekrarlanan üst/alt bilgiyi atla', varsayilan: true, goster: (d) => d.kip === 'akis' },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    const ad = dosyaAdiTuret(d.ad, a.kip === 'duzen' ? '' : '-akis', 'docx');
    let uyariOn = [];
    try {
      if (a.kip === 'duzen') {
        const r = await pdfdenWordDuzenli(d.bayt, { sayfalar: a.sayfalar, ilerleme: (k, n) => ilerleme(k, n) });
        if (!(r.bilgi.taranmis && a.ocr !== 'yok')) {
          return {
            ciktilar: [{ ad, bayt: r.bayt }],
            mesaj: `Word dosyası hazır (düzeni koru): ${r.bilgi.sayfa} sayfa. Word’de açıp kontrol edin.`,
            uyarilar: r.uyarilar,
            ekler: [hizliGecis('Hızlı geçiş', ['ocr', 'sikistir'], '(isterseniz önce PDF’i sadeleştirin)')],
          };
        }
        uyariOn = ['Bu belge taranmış (resim) görünüyor; “Düzeni koru” kipi OCR yapmaz. Bu yüzden otomatik olarak “Düzenlenebilir akış” kipi (OCR’lı) kullanıldı.'];
      }
      if (a.ocr !== 'yok') await ocrHazirla();
      const r = await pdfdenWord(d.bayt, {
        sayfalar: a.sayfalar, ocr: a.ocr, dil: a.dil, resimler: a.resimler ?? true, ustAltAtla: a.ustAlt ?? true, dosyaAdi: d.ad,
        ilerleme: (k, n) => ilerleme(k, n),
      });
      const b = r.bilgi;
      const parcalar = [`${b.paragraf} paragraf`, b.baslik && `${b.baslik} başlık`, b.madde && `${b.madde} madde`, b.tablo && `${b.tablo} tablo`, b.resim && `${b.resim} resim`].filter(Boolean);
      return {
        ciktilar: [{ ad: dosyaAdiTuret(d.ad, a.kip === 'duzen' ? '' : '-akis', 'docx'), bayt: r.bayt }],
        mesaj: `Word dosyası hazır (düzenlenebilir akış): ${parcalar.join(', ')}. Word’de açıp kontrol edin; gerekirse düzeltin.`,
        uyarilar: [...uyariOn, ...r.uyarilar],
        ekler: [hizliGecis('Hızlı geçiş', ['ocr', 'sikistir'], '(isterseniz önce PDF’i sadeleştirin)')],
      };
    } finally {
      if (!toplu) await ocrKapat();
    }
  },
});
