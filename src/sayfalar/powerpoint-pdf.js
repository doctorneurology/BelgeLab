// PowerPoint (.pptx) → PDF
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { powerpointPdf } from '../core/powerpoint-pdf.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'powerpoint-pdf',
  dosya: { tur: 'sunum' },
  ayarBasligi: 'Hazır',
  dugme: 'PDF’e çevir',
  notlar: [
    kutu('uyari', h('span', {}, h('b', {}, 'Görünüm birebir olmaz. '), 'Her slayt bir PDF sayfası olur: arka plan rengi, dolgulu şekiller, metin kutuları, resimler ve basit tablolar yerleştirilir. Animasyon/geçiş, SmartArt, grafikler, gradyan dolgular ve döndürülmüş nesneler desteklenmez (sonuçta bildirilir). Dosyalar cihazınızdan çıkmaz; PowerPoint gerekmez. Eski .ppt desteklenmez.')),
  ],
  async calistir({ dosyalar, ilerleme }) {
    const ciktilar = [], uyarilar = [];
    let sayfa = 0;
    for (const d of dosyalar) {
      const r = await powerpointPdf(d.bayt, { dosyaAdi: d.ad, ilerleme: (k, n) => ilerleme(k, n) });
      ciktilar.push({ ad: dosyaAdiTuret(d.ad, ''), bayt: r.bayt });
      sayfa += r.sayfa;
      r.uyarilar.forEach((u) => uyarilar.push(dosyalar.length > 1 ? `${d.ad}: ${u}` : u));
    }
    return { ciktilar, mesaj: `${dosyalar.length} sunum, toplam ${sayfa} slayt PDF oldu.`, uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['sikistir', 'birlestir', 'sayfa-sil'])] };
  },
});
