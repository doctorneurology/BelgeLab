// PDF → TXT / HTML / EPUB. Sayfa ya da dosya sınırı yoktur.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenMetin } from '../core/pdf-metin.js';
import { ocrKapat } from '../core/ocr.js';

aracKur({
  slug: 'pdf-metin',
  topluBitti: () => ocrKapat(),
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Dönüştür',
  onizleme: false,
  notlar: [
    kutu('bilgi', h('span', {}, h('b', {}, 'Sayfa ve dosya sınırı yok. '), 'Başlıklar, paragraflar, madde işaretleri, tablolar ve resimler aktarılır; taranmış sayfalar OCR ile okunur. EPUB, telefon/e-okuyucu için kitap biçimidir (içindekiler dahil).')),
    kutu('uyari', 'PDF’ten yapı tahmin edilir; iki sütunlu sayfalar, birleştirilmiş hücreli tablolar ve formüller bozulabilir. Çıktıyı gözden geçirin.'),
  ],
  alanlar: [
    { id: 'bicim', tur: 'secim', etiket: 'Çıktı biçimi', varsayilan: 'html', secenekler: [{ deger: 'html', ad: 'HTML (web sayfası)' }, { deger: 'epub', ad: 'EPUB (e-kitap)' }, { deger: 'txt', ad: 'TXT (düz metin)' }] },
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-50, 80' },
    { id: 'resimler', tur: 'secim', etiket: 'Resimler', varsayilan: 'dosya', goster: (d) => d.bicim !== 'txt', secenekler: [{ deger: 'dosya', ad: 'Ayrı PNG dosyaları (önerilen)' }, { deger: 'gomulu', ad: 'HTML içine gömülü (tek dosya, büyük olabilir)' }, { deger: 'yok', ad: 'Resimleri alma' }] },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku' }, { deger: 'yok', ad: 'Okuma; yalnızca gerçek yazıyı al' }] },
    { id: 'dil', tur: 'secim', etiket: 'OCR dili', varsayilan: 'tur+eng', secenekler: [{ deger: 'tur+eng', ad: 'Türkçe + İngilizce (önerilen)' }, { deger: 'tur', ad: 'Yalnız Türkçe' }, { deger: 'eng', ad: 'Yalnız İngilizce' }] },
    { id: 'ayirac', tur: 'onay', etiket: 'Sayfa ayracı ekle', varsayilan: false, goster: (d) => d.bicim !== 'epub' },
    { id: 'ustAlt', tur: 'onay', etiket: 'Sayfa numaralarını ve tekrarlanan üst/alt bilgiyi atla', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    if (a.ocr !== 'yok') await ocrHazirla();
    try {
      const r = await pdfdenMetin(d.bayt, d.ad, { bicim: a.bicim, sayfalar: a.sayfalar, ocr: a.ocr, dil: a.dil, resimler: a.resimler, ustAltAtla: a.ustAlt, sayfaAyirac: a.ayirac, ilerleme: (k, n) => ilerleme(k, n) });
      return {
        ciktilar: r.dosyalar,
        mesaj: `${a.bicim.toUpperCase()} hazır: ${r.bilgi.paragraf ?? 0} paragraf, ${r.bilgi.baslik ?? 0} başlık, ${r.bilgi.tablo ?? 0} tablo${a.bicim === 'txt' ? '' : `, ${r.dosyalar.length > 1 ? r.dosyalar.length - 1 : 0} ayrı resim`}.`,
        uyarilar: r.uyarilar,
        ekler: [hizliGecis('Hızlı geçiş', ['pdf-markdown', 'pdf-word', 'ocr'])],
      };
    } finally { if (!toplu) await ocrKapat(); }
  },
});
