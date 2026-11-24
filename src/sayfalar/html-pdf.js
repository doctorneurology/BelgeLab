// HTML → PDF: HTML dosyası yükleyin ya da HTML/metin yapıştırın. Hiçbir adres internetten çekilmez.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { htmlPdf } from '../core/html-pdf.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

aracKur({
  slug: 'html-pdf',
  dosya: { tur: 'html', coklu: false, enAz: 0 },
  ayarBasligi: 'HTML dosyası seçin ya da yapıştırın',
  dugme: 'PDF’e çevir',
  notlar: [
    kutu('uyari', h('span', {}, h('b', {}, 'Bu bir tarayıcı değildir. '), 'Temel yapı (başlık, paragraf, liste, tablo, bağlantı, kalın/eğik, kod bloğu, gömülü data: resimler) aktarılır. CSS düzeni, arka planlar, harici stil/resim dosyaları, JavaScript, SVG/iframe uygulanmaz. Adresten (URL) çevirme yapılmaz: sayfayı “Farklı kaydet → HTML” ile kaydedip yükleyin ya da kodunu aşağıya yapıştırın.')),
  ],
  ayar() {
    const metin = h('textarea', { id: 'html-metin', rows: 10, placeholder: '<h1>Başlık</h1>\n<p>İçerik…</p>   (ya da düz metin)' });
    const el = h('div', { class: 'alan genis' }, h('label', { for: 'html-metin' }, 'Veya HTML / metin yapıştırın'), metin, h('small', {}, 'Bir dosya da seçtiyseniz dosya kullanılır.'));
    return { el, oku: () => ({ yapistirilan: metin.value }) };
  },
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const kaynak = d ? new TextDecoder('utf-8').decode(d.bayt) : a.yapistirilan;
    if (!String(kaynak ?? '').trim()) throw new PdfHatasi('Bir HTML dosyası seçin ya da HTML/metin yapıştırın.');
    const r = await htmlPdf(kaynak, { ilerleme: (k, n) => ilerleme(k, n) });
    return { ciktilar: [{ ad: d ? dosyaAdiTuret(d.ad, '') : 'html-belge.pdf', bayt: r.bayt }], mesaj: `${r.sayfa} sayfalık PDF hazır.`, uyarilar: r.uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['sikistir', 'sifre-ekle', 'filigran-ekle'])] };
  },
});
