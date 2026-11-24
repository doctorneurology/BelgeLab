// Excel → PDF
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { excelPdf } from '../core/excel-pdf.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'excel-pdf',
  dosya: { tur: 'excel' },
  ayarBasligi: 'Ayarlar',
  dugme: 'PDF’e çevir',
  notlar: [
    kutu('bilgi', h('span', {}, 'Her görünür Excel sayfası tablo olarak yazılır; geniş tablolar otomatik yatay yerleşir. Satır/sayfa sınırı yoktur. Değerler Excel’in gösterdiği biçimle (tarih, para birimi…) yazılır; renkler, kenarlıklar, grafikler ve resimler aktarılmaz.')),
  ],
  alanlar: [
    { id: 'yon', tur: 'secim', etiket: 'Sayfa yönü', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'Otomatik (geniş tablo yatay)' }, { deger: 'dikey', ad: 'Hep dikey' }, { deger: 'yatay', ad: 'Hep yatay' }] },
    { id: 'kenarlik', tur: 'onay', etiket: 'Hücre çizgileri', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const ciktilar = [], uyarilar = [];
    let sayfa = 0;
    for (const d of dosyalar) {
      const r = await excelPdf(d.bayt, { yon: a.yon, kenarlik: a.kenarlik, dosyaAdi: d.ad, ilerleme: (k, n) => ilerleme(k, n) });
      ciktilar.push({ ad: dosyaAdiTuret(d.ad, ''), bayt: r.bayt });
      sayfa += r.sayfa;
      r.uyarilar.forEach((u) => uyarilar.push(dosyalar.length > 1 ? `${d.ad}: ${u}` : u));
    }
    return { ciktilar, mesaj: `${dosyalar.length} dosya, toplam ${sayfa} PDF sayfası.`, uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['birlestir', 'sikistir', 'sifre-ekle'])] };
  },
});
