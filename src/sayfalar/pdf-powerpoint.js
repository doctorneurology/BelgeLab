// PDF → PowerPoint. Sayfa/dosya sınırı yok.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfdenPowerPoint } from '../core/pdf-powerpoint.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'pdf-powerpoint',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Ayarlar',
  dugme: 'PowerPoint’e çevir',
  onizleme: false,
  notlar: [
    kutu('bilgi', h('span', {}, h('b', {}, 'Düzenlenebilir kip: '), 'slaydın arka planı sayfanın yazısız görüntüsü olur (logo, çizgi, resim kalır); yazılar konumlarına gerçek PowerPoint metin kutuları olarak konur. Sayfa sınırı yoktur.')),
    kutu('uyari', 'Yazı tipleri benzer olanlarla değiştirilir; PowerPoint’te satır kaymaları olabilir. Taranmış sayfalar yalnızca resim olur (önce OCR yapabilirsiniz).'),
  ],
  alanlar: [
    { id: 'sayfalar', tur: 'metin', etiket: 'Sayfalar', ipucu: 'Boş bırakırsanız tümü. Örnek: 1-30' },
    { id: 'mod', tur: 'secim', etiket: 'Kip', varsayilan: 'duzenlenebilir', secenekler: [{ deger: 'duzenlenebilir', ad: 'Düzenlenebilir (yazılar metin kutusu)' }, { deger: 'resim', ad: 'Resim (her slayt tek resim, görünüm birebir)' }] },
    { id: 'dpi', tur: 'secim', etiket: 'Arka plan çözünürlüğü', varsayilan: '120', secenekler: [{ deger: '96', ad: '96 dpi (küçük dosya)' }, { deger: '120', ad: '120 dpi (önerilen)' }, { deger: '200', ad: '200 dpi (yüksek)' }] },
  ],
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const r = await pdfdenPowerPoint(d.bayt, { sayfalar: a.sayfalar, mod: a.mod, dpi: Number(a.dpi), ilerleme: (k, n) => ilerleme(k, n) });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '', 'pptx'), bayt: r.bayt }],
      mesaj: `${r.bilgi.slayt} slayt hazır${r.bilgi.metinKutusu ? `, ${r.bilgi.metinKutusu} düzenlenebilir metin kutusu` : ''}.`,
      uyarilar: r.uyarilar,
      ekler: [hizliGecis('Hızlı geçiş', ['ocr', 'powerpoint-pdf', 'pdf-word'])],
    };
  },
});
