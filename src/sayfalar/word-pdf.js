// Word (.docx) → PDF
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { wordPdf } from '../core/word-pdf.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'word-pdf',
  dosya: { tur: 'word', coklu: true, enAz: 1 },
  ayarBasligi: 'Hazır',
  dugme: 'PDF’e çevir',
  notlar: [
    kutu('uyari', h('span', {}, h('b', {}, 'Sayfa düzeni Word’ün birebir aynısı olmaz. '), 'Paragraf, başlık, liste, tablo, resim ve bağlantılar aktarılır; üst/alt bilgi, dipnot, metin kutusu, şekil ve denklemler aktarılmaz (sonuçta bildirilir). Dosyalar cihazınızdan çıkmaz; Word gerekmez. Eski .doc desteklenmez.')),
  ],
  async calistir({ dosyalar, ilerleme }) {
    const ciktilar = [], uyarilar = [];
    let sayfa = 0;
    for (const d of dosyalar) {
      const r = await wordPdf(d.bayt, { dosyaAdi: d.ad, ilerleme: (k, n) => ilerleme(k, n) });
      ciktilar.push({ ad: dosyaAdiTuret(d.ad, ''), bayt: r.bayt });
      sayfa += r.sayfa;
      r.uyarilar.forEach((u) => uyarilar.push(dosyalar.length > 1 ? `${d.ad}: ${u}` : u));
    }
    return { ciktilar, mesaj: `${dosyalar.length} dosya, toplam ${sayfa} sayfa PDF oldu.`, uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['sikistir', 'sifre-ekle', 'birlestir'])] };
  },
});
