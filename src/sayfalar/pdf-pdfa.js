// PDF → PDF/A (DENEYSEL) ve PDF/A engel denetimi.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfaDonustur, pdfaDenetle } from '../core/pdfa.js';
import { dosyaAdiTuret } from '../core/util.js';

function sorunListesi(baslik, d) {
  return h('div', {}, h('b', {}, baslik),
    d.sorunlar.length
      ? h('ul', {}, ...d.sorunlar.map((s) => h('li', {}, `${s.onemli ? '⛔' : '⚠️'} ${s.ad}${s.sayi > 1 ? ` (${s.sayi} yerde)` : ''}`)))
      : h('p', { class: 'soluk' }, '✅ Bilinen engel görünmüyor (kısmi denetim).'));
}

aracKur({
  slug: 'pdf-pdfa',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'PDF/A’ya dönüştür (deneysel)',
  notlar: [
    kutu('uyari', h('span', {}, h('b', {}, 'Deneysel ve doğrulanmamış. '), 'Çıktı PDF/A-2b’ye yaklaşır ama resmî bir doğrulayıcıyla (veraPDF) sınanmamıştır; uyumlu olduğu GARANTİ EDİLMEZ. Kurumsal arşivleme için veraPDF ile doğrulayın.')),
    kutu('bilgi', 'Sayfalar resme çevrilir (dosya büyüyebilir, yazı tipleri/vektörler kalmaz); yazı aranabilir görünmez katman olarak korunur. Form, yer imi, bağlantı ve ek dosyalar taşınmaz. Sayfa/dosya sınırı yoktur.'),
  ],
  alanlar: [
    { id: 'dpi', tur: 'secim', etiket: 'Sayfa çözünürlüğü', varsayilan: '200', secenekler: [{ deger: '150', ad: '150 dpi (küçük dosya)' }, { deger: '200', ad: '200 dpi (önerilen)' }, { deger: '300', ad: '300 dpi (yüksek kalite, büyük dosya)' }] },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const r = await pdfaDonustur(d.bayt, { dpi: Number(a.dpi), ilerleme: (k, n) => ilerleme(k, n) });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-pdfa'), bayt: r.bayt }],
      mesaj: `${r.sayfa} sayfa dönüştürüldü. Bu çıktı PDF/A’ya yaklaşan DENEYSEL bir dosyadır; resmî doğrulama yapılmadı.`,
      uyarilar: r.uyarilar,
      ekler: [h('section', { class: 'yd-rapor' }, sorunListesi('Kaynak dosyadaki PDF/A engelleri', r.once), sorunListesi('Çıktıdaki kalan engeller (kendi basit denetimimiz)', r.sonra)), hizliGecis('Hızlı geçiş', ['sikistir', 'ocr'])],
    };
  },
});
