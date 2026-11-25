// PDF → Excel: PDF'teki tabloları Excel'e aktarır. Sayfa/dosya sınırı yok.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenExcel } from '../core/pdf-excel.js';
import { ocrKapat } from '../core/ocr.js';
import { dosyaAdiTuret } from '../core/util.js';

/** Bulunan tabloların ilk satırları: indirmeden önce doğru tablo mu, sütunlar yerinde mi diye bakılır. */
function tabloOnizleme(liste = []) {
  if (!liste.length) return '';
  return h('details', { class: 'yd-rapor', open: true },
    h('summary', {}, 'Bulunan tablolar (önizleme — indirmeden önce kontrol edin)'),
    ...liste.map((t, i) => h('div', { class: 'tablo-kap' },
      h('p', { class: 'soluk' }, 'Tablo ' + (i + 1) + ' — sayfa ' + t.sayfaNo + ' · ' + t.satirSayisi + ' satır × ' + t.kolon + ' sütun' + (t.satirSayisi > t.ilkSatirlar.length ? ' (ilk ' + t.ilkSatirlar.length + ' satır)' : '')),
      h('table', { class: 'yd-tablo' }, h('tbody', {}, ...t.ilkSatirlar.map((r) => h('tr', {}, ...Array.from({ length: t.kolon }, (_, k) => h('td', {}, String(r[k] ?? ''))))))))));
}

aracKur({
  slug: 'pdf-excel',
  topluBitti: () => ocrKapat(), // toplu kipte OCR motoru bir kez açılır, en sonda kapatılır
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'Excel’e çevir',
  onizleme: false,
  notlar: [
    kutu('bilgi', 'Tablolar, yazıların düzgün hizalı sütunlarından bulunur. Sayfa ve dosya sınırı yoktur. Taranmış sayfalar OCR ile okunur.'),
    kutu('uyari', 'Çizgiler okunmaz: tablo hizadan TAHMİN edilir. Birleştirilmiş hücreli, iç içe ya da hizasız tablolar bozuk çıkabilir; Excel’de kontrol edin.'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-20, 25' },
    { id: 'duzen', tur: 'secim', etiket: 'Excel sayfaları', varsayilan: 'sayfa', secenekler: [{ deger: 'sayfa', ad: 'Her PDF sayfası bir Excel sayfası' }, { deger: 'tablo', ad: 'Her tablo ayrı bir Excel sayfası' }, { deger: 'tek', ad: 'Tüm tablolar tek sayfada alt alta' }] },
    { id: 'tabloDisi', tur: 'onay', etiket: 'Tablo olmayan metin satırlarını da aktar (A sütununa)', varsayilan: false },
    { id: 'sayilar', tur: 'onay', etiket: 'Sayıya benzeyen hücreleri sayı yap', varsayilan: true, aciklama: 'Baştaki sıfırlı değerler (TC no, telefon) metin kalır.' },
    { id: 'ondalik', tur: 'secim', etiket: 'Sayı biçimi', varsayilan: 'tr', secenekler: [{ deger: 'tr', ad: 'Türkçe: 1.234,5' }, { deger: 'en', ad: 'İngilizce: 1,234.5' }], goster: (d) => d.sayilar },
    { id: 'ocr', tur: 'secim', etiket: 'Taranmış sayfalar', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'OCR ile oku' }, { deger: 'yok', ad: 'Okuma' }] },
    { id: 'dil', tur: 'secim', etiket: 'OCR dili', varsayilan: 'tur+eng', secenekler: [{ deger: 'tur+eng', ad: 'Türkçe + İngilizce (önerilen)' }, { deger: 'tur', ad: 'Yalnız Türkçe' }, { deger: 'eng', ad: 'Yalnız İngilizce' }], aciklama: 'Yalnızca taranmış sayfalarda kullanılır.' },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme, toplu = false }) {
    const d = dosyalar[0];
    if (a.ocr !== 'yok') await ocrHazirla();
    try {
      const r = await pdfdenExcel(d.bayt, { sayfalar: a.sayfalar, duzen: a.duzen, tabloDisi: a.tabloDisi, sayilar: a.sayilar, ondalik: a.ondalik, ocr: a.ocr, dil: a.dil, ilerleme: (k, n) => ilerleme(k, n) });
      return {
        ciktilar: [{ ad: dosyaAdiTuret(d.ad, '', 'xlsx'), bayt: r.bayt }],
        mesaj: `${r.bilgi.tablo} tablo bulundu: ${r.bilgi.sayfa} Excel sayfası, ${r.bilgi.satir} satır.`,
        uyarilar: r.uyarilar,
        ekler: [tabloOnizleme(r.onizleme), hizliGecis('Hızlı geçiş', ['pdf-word', 'pdf-markdown', 'excel-analiz'])],
      };
    } finally { if (!toplu) await ocrKapat(); }
  },
});
