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
    kutu('bilgi', h('span', {}, h('b', {}, 'Sayfa ve dosya sınırı yok. '), 'Başlıklar (yazı boyutundan), paragraflar, kalın/italik, madde işaretleri, bağlantılar, basit tablolar aktarılır. Resimler aktarılmaz: çıktı yalnızca tek bir .md dosyasıdır (bu sayede dönüştürme de çok daha hızlıdır). Taranmış sayfalar OCR ile okunur. Yapay zekâ/LLM kullanımına uygun, temiz bir metin üretir.')),
    kutu('uyari', 'PDF’ten yapı tahmin edilir; iki sütunlu sayfalar, birleştirilmiş hücreli tablolar ve formüller bozulabilir. Çıktıyı gözden geçirin.'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-50, 80', aciklama: 'Sayfa sınırı yoktur; yüzlerce sayfa tek seferde dönüşür.' },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku' }, { deger: 'yok', ad: 'Okuma; yalnızca gerçek yazıyı al' }] },
    { id: 'dil', tur: 'secim', etiket: 'OCR dili', varsayilan: 'tur+eng', secenekler: [{ deger: 'tur+eng', ad: 'Türkçe + İngilizce (önerilen)' }, { deger: 'tur', ad: 'Yalnız Türkçe' }, { deger: 'eng', ad: 'Yalnız İngilizce' }], aciklama: 'Yalnızca taranmış sayfalarda kullanılır.' },
    { id: 'ayirac', tur: 'onay', etiket: 'Sayfa ayracı ekle (<!-- Sayfa N --> ve çizgi)', varsayilan: false },
    { id: 'ustAlt', tur: 'onay', etiket: 'Sayfa numaralarını ve tekrarlanan üst/alt bilgiyi atla', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    if (a.ocr !== 'yok') await ocrHazirla();
    try {
      const adTaban = dosyaAdiTuret(d.ad, '', 'md');
      const klasor = adTaban.replace(/\.md$/, '') + '-resimler';
      const r = await pdfdenMarkdown(d.bayt, { sayfalar: a.sayfalar, resimler: 'yok', ocr: a.ocr, dil: a.dil, sayfaAyirac: a.ayirac, ustAltAtla: a.ustAlt, resimKlasoru: klasor, ilerleme: (k, n) => ilerleme(k, n) });
      const ciktilar = [{ ad: adTaban, bayt: new TextEncoder().encode(r.md) }]; // yalnızca .md
      const b = r.bilgi;
      return {
        ciktilar,
        mesaj: `Markdown hazır: ${b.paragraf ?? 0} paragraf, ${b.baslik ?? 0} başlık, ${b.madde ?? 0} madde, ${b.tablo ?? 0} tablo (${(r.md.length / 1024).toFixed(0)} KB metin).`,
        uyarilar: r.uyarilar,
        ekler: [onizleme(r.md), hizliGecis('Hızlı geçiş', ['pdf-word', 'pdf-excel', 'ocr'])],
      };
    } finally { if (!toplu) await ocrKapat(); }
  },
});
