// PDF onar: bozuk/açılmayan PDF'i kurtarmayı dener. Sonuç denetlenmeden "onarıldı" denmez.
import { aracKur } from '../ui/arac.js';
import { sifreModulu } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { pdfOnar } from '../core/onar.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'onar',
  dosya: { tur: 'pdf', bozukOlabilir: true },
  ayarBasligi: 'Hazır',
  dugme: 'Onarmayı dene',
  notlar: [kutu('bilgi', h('span', {}, 'Bozuk çapraz başvuru tablosu, sonu kesilmiş ya da başında çöp veri olan PDF’ler kurtarılmaya çalışılır. Sonuç pdf.js ile açılıp her sayfa çizilerek denetlenir. ',
    h('b', {}, 'Sınır: '), 'dosyanın büyük kısmı eksikse (sayfa verileri/yazı tipleri yoksa) kurtarma yapılamaz ve bu söylenir.'))],
  async calistir({ dosyalar, ilerleme }) {
    await sifreModulu();
    const d = dosyalar[0];
    const r = await pdfOnar(d.bayt, { ilerleme: (k, n, m) => ilerleme(k, n) });
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-onarilmis'), bayt: r.bayt }],
      mesaj: `Onarıldı: ${r.sayfa} sayfa açılıyor (yöntem: ${r.yontem}).`,
      uyarilar: r.uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['sikistir', 'ocr', 'sayfa-sil'])],
    };
  },
});
