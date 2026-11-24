// PDF onarma: bozuk/yarım kalmış/çapraz başvuru tablosu hasarlı PDF'leri kurtarmaya çalışır.
// Yöntem 1: qpdf (WebAssembly) dosyayı tarayıp nesneleri yeniden bulur ve temiz bir PDF yazar (bozuk çapraz başvuru tablosu, çöp veri vb.).
// Yöntem 2 (yedek): pdf-lib hataları yok sayarak okunabilen sayfaları yeni belgeye kopyalar.
// Sonuç her zaman pdf.js ile açılıp sayfa sayısı ve çizilebilirliği DENETLENİR; denetimi geçmeyen çıktı "onarıldı" diye verilmez.
//
// SINIR: Dosyanın SONU (çapraz başvuru tablosu/trailer) kesilmişse pdf-lib yedeği genellikle kurtarır; ama sayfa ağacı/katalog ya da
// yazı tipleri de kesilen kısımdaysa (dosyanın büyük bölümü eksikse) kurtarma YAPILAMAZ ve bu açıkça bildirilir.
// DÜRÜSTLÜK: Veri gerçekten silinmişse (kesilmiş dosyanın eksik kısmı gibi) geri getirilemez; kurtarılabilen sayfalar verilir, kayıplar bildirilir.

import { PDFDocument } from 'pdf-lib';
import { qpdfCalistir } from './sifre.js';
import { belgeAc, sayfaCiz } from './render.js';
import { kaydet } from './belge.js';
import { PdfHatasi } from './hatalar.js';

/** Bayt dizisini pdf.js ile açıp her sayfayı küçük çözünürlükte çizerek denetler. */
async function denetle(bayt, { enCokSayfa = Infinity } = {}) {
  let belge;
  try { belge = await belgeAc(bayt); } catch (e) { return { acildi: false, hata: e?.message ?? String(e), sayfa: 0, bozukSayfalar: [] }; }
  try {
    const bozuk = [];
    const n = belge.numPages;
    for (let i = 1; i <= Math.min(n, enCokSayfa); i++) {
      try { await sayfaCiz(belge, i, { olcek: 0.2 }); } catch { bozuk.push(i); }
    }
    return { acildi: true, sayfa: n, bozukSayfalar: bozuk };
  } finally { await belge.kapat(); }
}

/**
 * @returns {{bayt:Uint8Array, onarildi:boolean, yontem:string, sayfa:number, uyarilar:string[], once:object, sonra:object}}
 */
export async function pdfOnar(bayt, { ilerleme } = {}) {
  if (!(bayt instanceof Uint8Array) || bayt.length < 16) throw new PdfHatasi('Dosya boş ya da çok küçük; PDF olarak onarılamaz.');
  const uyarilar = [];
  {
    // %PDF- başlığı baştan sonra başlıyorsa önündeki çöp veri atılır
    const bas = new TextDecoder('latin1').decode(bayt.subarray(0, Math.min(bayt.length, 4 * 1024 * 1024)));
    const k = bas.indexOf('%PDF-');
    if (k < 0) throw new PdfHatasi('Bu dosyada PDF başlığı (%PDF-) bulunamadı; PDF olmayabilir ya da başı tamamen yok olmuştur.');
    if (k > 0) { bayt = bayt.subarray(k); uyarilar.push(`Dosyanın başındaki ${k} bayt çöp veri atıldı.`); }
  }
  ilerleme?.(0, 4, 'Dosya inceleniyor…');
  const once = await denetle(bayt);
  ilerleme?.(1, 4, 'qpdf ile onarılıyor…');

  // 1) qpdf
  let aday = null, yontem = '';
  let sonra = null;
  try {
    const r = await qpdfCalistir(['/girdi.pdf', '/cikti.pdf'], bayt);
    if (r.cikti && r.cikti.length > 100) {
      const a = new Uint8Array(r.cikti);
      const dn = await denetle(a);
      if (dn.acildi && dn.sayfa > 0) { aday = a; yontem = 'qpdf (yapı yeniden kuruldu)'; sonra = dn; }
    }
  } catch { /* yedeğe geç */ }

  // 2) yedek: pdf-lib ile okunabilen sayfaları kopyala
  if (!sonra?.acildi || sonra.sayfa === 0 || (once.acildi && sonra.sayfa < once.sayfa)) {
    ilerleme?.(2, 4, 'Yedek yöntem deneniyor…');
    try {
      const kaynak = await PDFDocument.load(bayt, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
      const yeni = await PDFDocument.create();
      let kopya = 0, atlanan = 0;
      for (let i = 0; i < kaynak.getPageCount(); i++) {
        try { const [p] = await yeni.copyPages(kaynak, [i]); yeni.addPage(p); kopya++; } catch { atlanan++; }
      }
      if (kopya) {
        const yedek = await kaydet(yeni);
        const d = await denetle(yedek);
        if (d.acildi && d.sayfa > (sonra?.acildi ? sonra.sayfa : 0)) { aday = yedek; sonra = d; yontem = 'pdf-lib (okunabilen sayfalar yeni belgeye kopyalandı)'; if (atlanan) uyarilar.push(`${atlanan} sayfa okunamadığı için çıktıya alınamadı.`); }
      }
    } catch { /* kurtarılamadı */ }
  }
  ilerleme?.(3, 4, 'Sonuç denetleniyor…');
  if (!aday || !sonra?.acildi || sonra.sayfa === 0) {
    throw new PdfHatasi(`Dosya onarılamadı${once.hata ? ` (${once.hata})` : ''}. Sayfa verileri okunamayacak kadar hasarlı olabilir.`);
  }
  if (sonra.bozukSayfalar.length) uyarilar.push(`Onarım sonrasında ${sonra.bozukSayfalar.length} sayfa çizilemedi (sayfa ${sonra.bozukSayfalar.slice(0, 10).join(', ')}${sonra.bozukSayfalar.length > 10 ? '…' : ''}); bu sayfaların içeriği bozuk olabilir.`);
  if (once.acildi && !once.bozukSayfalar.length) uyarilar.push('Dosya zaten sorunsuz açılıyordu; yapısı yeniden yazıldı.');
  if (once.acildi && sonra.bozukSayfalar.length < once.bozukSayfalar.length) uyarilar.push(`Çizilemeyen sayfa sayısı ${once.bozukSayfalar.length} → ${sonra.bozukSayfalar.length} oldu.`);
  uyarilar.push('Silinmiş ya da dosyadan kesilmiş veriler geri getirilemez; yalnızca dosyada hâlâ bulunan içerik kurtarılabilir. Sonucu kontrol edin.');
  return { bayt: aday, onarildi: true, yontem, sayfa: sonra.sayfa, uyarilar, once, sonra };
}
