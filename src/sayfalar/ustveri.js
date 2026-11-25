// Üstveri (başlık, yazar…) görüntüle/düzenle ve gizli bilgi temizliği (JavaScript, ekler, XMP).
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { ustveriOku, ustveriYaz } from '../core/temizlik.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'ustveri',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Üstveri ve gizli bilgi',
  dugme: 'Uygula',
  notlar: [kutu('bilgi', 'PDF’in içinde görünmeyen bilgiler bulunabilir: yazar adı, programı, gömülü dosyalar, JavaScript. Paylaşmadan önce buradan görüp temizleyebilirsiniz. Temizlenen her şey dosyadan gerçekten silinir. Birden çok dosya seçerseniz yalnızca temizlik seçenekleri hepsine uygulanır; alanlar ilk dosyaya göre dolar.')],
  ayar() {
    const alan = (id, etiket) => { const g = h('input', { type: 'text', id }); return { g, kap: h('div', { class: 'alan genis' }, h('label', { for: id }, etiket), g) }; };
    const A = { baslik: alan('us-baslik', 'Başlık'), yazar: alan('us-yazar', 'Yazar'), konu: alan('us-konu', 'Konu'), anahtar: alan('us-anahtar', 'Anahtar sözcükler (virgülle)'), olusturan: alan('us-olusturan', 'Oluşturan program') };
    const onay = (id, etiket, varsayilan = false) => { const g = h('input', { type: 'checkbox', id, checked: varsayilan }); return { g, kap: h('div', { class: 'onay-satiri' }, g, h('label', { for: id }, etiket)) }; };
    const T = {
      tumUstveri: onay('us-tum', 'Başlık, yazar, konu, anahtar sözcük, oluşturan program alanlarını BOŞALT'),
      xmp: onay('us-xmp', 'XMP üstverisini sil (ek bilgi paketi)'),
      javascript: onay('us-js', 'JavaScript’i sil'),
      ekler: onay('us-ek', 'Gömülü dosyaları ve ekleri sil'),
      kucukResim: onay('us-kucuk', 'Sayfa küçük resimlerini sil'),
      ozelVeri: onay('us-ozel', 'Programlara özel gizli verileri sil (PieceInfo)'),
    };
    const bilgi = h('div', { 'aria-live': 'polite' });
    const el = h('div', {}, bilgi,
      h('div', { class: 'alanlar' }, ...Object.values(A).map((x) => x.kap)),
      h('div', { class: 'alan-baslik' }, 'Temizlik'),
      ...Object.values(T).map((x) => x.kap));
    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli) { bilgi.replaceChildren(); return; }
        try {
          const o = await ustveriOku(d.bayt);
          A.baslik.g.value = o.baslik; A.yazar.g.value = o.yazar; A.konu.g.value = o.konu; A.anahtar.g.value = o.anahtar; A.olusturan.g.value = o.olusturan;
          bilgi.replaceChildren(h('p', { class: 'soluk' }, `${o.sayfa} sayfa · Üretici: ${o.uretici || '—'} · Oluşturma: ${o.olusturma || '—'} · Değiştirme: ${o.degistirme || '—'} · XMP: ${o.xmp ? 'var' : 'yok'} · JavaScript: ${o.javascript} · Gömülü dosya/ek: ${o.ek}`));
        } catch (e) { bilgi.replaceChildren(kutu('uyari', e.message ?? String(e))); }
      },
      oku: () => ({ alanlar: Object.fromEntries(Object.entries(A).map(([k, x]) => [k, x.g.value])), temizle: Object.fromEntries(Object.entries(T).map(([k, x]) => [k, x.g.checked])) }),
    };
  },
  async calistir({ dosyalar, ayarlar, toplu = false, dosyaNo = 0 }) {
    const d = dosyalar[0];
    // Toplu işte alanlar yalnızca ilk dosyaya aittir; diğerlerine yalnızca temizlik uygulanır.
    const alanlar = toplu && dosyaNo > 0 ? {} : ayarlar.alanlar;
    const r = await ustveriYaz(d.bayt, { alanlar, temizle: ayarlar.temizle });
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-ustveri'), bayt: r.bayt }], mesaj: r.ozet.length ? `Yapılanlar: ${r.ozet.join('; ')}.` : 'Üstveri alanları güncellendi.', uyarilar: r.uyarilar };
  },
});
