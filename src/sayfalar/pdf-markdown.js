// PDF → Markdown. Sayfa ya da dosya sınırı yoktur; istediğiniz kadar sayfa dönüştürülür.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenMarkdown } from '../core/pdf-markdown.js';
import { ocrKapat } from '../core/ocr.js';
import { dosyaAdiTuret } from '../core/util.js';

function onizleme(md) {
  const kopya = h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => {
    try { await navigator.clipboard.writeText(md); kopya.textContent = '✔ Kopyalandı'; } catch { kopya.textContent = 'Kopyalanamadı'; }
  } }, '📋 Tümünü kopyala');
  return h('details', { class: 'yd-rapor', open: true },
    h('summary', {}, 'Önizleme (ilk 4000 karakter)'),
    h('div', { class: 'eylem' }, kopya),
    h('pre', { class: 'md-onizleme' }, md.slice(0, 4000) + (md.length > 4000 ? '\n…' : '')));
}

aracKur({
  slug: 'pdf-markdown',
  topluBitti: () => ocrKapat(), // toplu kipte OCR motoru bir kez açılır, en sonda kapatılır
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Markdown’a çevir',
  onizleme: false,
  notlar: [
    kutu('bilgi', h('span', {}, h('b', {}, 'Sayfa ve dosya sınırı yok. '), 'Başlıklar (yazı boyutundan), paragraflar, kalın/italik, madde işaretleri, bağlantılar, basit tablolar ve resimler aktarılır. Taranmış sayfalar OCR ile okunur. Yapay zekâ/LLM kullanımına uygun, temiz bir metin üretir.')),
    kutu('uyari', 'PDF’ten yapı tahmin edilir; iki sütunlu sayfalar, birleştirilmiş hücreli tablolar ve formüller bozulabilir. Çıktıyı gözden geçirin.'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-50, 80', aciklama: 'Sayfa sınırı yoktur; yüzlerce sayfa tek seferde dönüşür.' },
    { id: 'resimler', tur: 'secim', etiket: 'Resimler', varsayilan: 'dosya', secenekler: [{ deger: 'dosya', ad: 'Ayrı PNG dosyaları (ZIP içinde, önerilen)' }, { deger: 'gomulu', ad: 'Markdown içine gömülü (tek dosya, büyük olabilir)' }, { deger: 'yok', ad: 'Resimleri alma' }] },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku (Türkçe)' }, { deger: 'yok', ad: 'Okuma; yalnızca gerçek yazıyı al' }] },
    { id: 'ayirac', tur: 'onay', etiket: 'Sayfa ayracı ekle (<!-- Sayfa N --> ve çizgi)', varsayilan: false },
    { id: 'ustAlt', tur: 'onay', etiket: 'Sayfa numaralarını ve tekrarlanan üst/alt bilgiyi atla', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    if (a.ocr !== 'yok') await ocrHazirla();
    try {
      const adTaban = dosyaAdiTuret(d.ad, '', 'md');
      const klasor = adTaban.replace(/\.md$/, '') + '-resimler';
      const r = await pdfdenMarkdown(d.bayt, { sayfalar: a.sayfalar, resimler: a.resimler, ocr: a.ocr, sayfaAyirac: a.ayirac, ustAltAtla: a.ustAlt, resimKlasoru: klasor, ilerleme: (k, n) => ilerleme(k, n) });
      const ciktilar = [{ ad: adTaban, bayt: new TextEncoder().encode(r.md) }, ...r.resimler.map((x) => ({ ad: x.ad, bayt: x.bayt }))];
      const b = r.bilgi;
      return {
        ciktilar,
        mesaj: `Markdown hazır: ${b.paragraf ?? 0} paragraf, ${b.baslik ?? 0} başlık, ${b.madde ?? 0} madde, ${b.tablo ?? 0} tablo, ${b.resim ?? 0} resim (${(r.md.length / 1024).toFixed(0)} KB metin).${r.resimler.length ? ' Resimler “' + klasor + '” klasöründe; ZIP olarak indirirseniz bağlantılar çalışır.' : ''}`,
        uyarilar: r.uyarilar,
        ekler: [onizleme(r.md), hizliGecis('Hızlı geçiş', ['pdf-word', 'pdf-excel', 'ocr'])],
      };
    } finally { if (!toplu) await ocrKapat(); }
  },
});
