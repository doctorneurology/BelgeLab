import { aracKur } from '../ui/arac.js';
import { izgaraAyari } from '../ui/izgara-arac.js';
import { sayfaSirala } from '../core/sayfalar.js';
import { PdfHatasi } from '../core/hatalar.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'sayfa-sirala',
  toplu: false, // dosyaya özel arayüz (sayfa/bölge seçimi); toplu kip yok
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Sayfaları istediğiniz sıraya dizin',
  dugme: 'Bu sırayla kaydet',
  ayar: izgaraAyari({
    mod: 'sirala',
    yardim: 'Bir sayfayı sürükleyip başka bir sayfanın üstüne bırakın (telefonda ◀ ▶ düğmelerini kullanın).',
  }),
  async calistir({ dosyalar, ayarlar }) {
    const eski = [...Array(ayarlar.sayfaSayisi).keys()];
    if (ayarlar.sira.every((v, i) => v === eski[i])) throw new PdfHatasi('Sıra değişmedi; önce sayfaları taşıyın.');
    const d = dosyalar[0];
    const s = await sayfaSirala(d.bayt, ayarlar.sira);
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-yeni-sira'), bayt: s.bayt }],
      uyarilar: s.uyarilar,
      mesaj: 'Sayfalar yeni sıraya dizildi.',
    };
  },
});
