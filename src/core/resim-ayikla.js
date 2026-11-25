// PDF'e gömülü resimleri ayıklar (her biri PNG dosyası olarak). Sayfa/resim sayısı sınırı yoktur.
import { belgeAc, paralelSayfalar } from './render.js';
import { sayfaResimleri } from './sayfa-icerik.js';
import { sayfaSecimi, dosyaAdiTuret } from './util.js';

/**
 * @param secenek.enAzPiksel  bu değerden küçük kenarlı resimler (simge, süs) atlanır (varsayılan 32)
 * @returns {{dosyalar:{ad,bayt,sayfa,genislik,yukseklik}[], atlanan:number, uyarilar:string[]}}
 */
export async function resimleriAyikla(bayt, dosyaAdi = 'belge.pdf', { sayfalar = '', enAzPiksel = 32, ilerleme } = {}) {
  const belge = await belgeAc(bayt);
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    const dosyalar = [];
    let atlanan = 0;
    const hane = String(belge.numPages).length;
    let biten = 0;
    const sayfaSonuclari = await paralelSayfalar(bayt, secili.map((x) => x + 1), async (b, no) => {
      const r = await sayfaResimleri(b, no, { enCok: Infinity, enAz: 1 });
      ilerleme?.(++biten, secili.length, `Sayfa ${no} tarandı`);
      return r;
    }, { ilkBelge: belge });
    secili.forEach((sNo, k) => {
      const no = sNo + 1, r = sayfaSonuclari[k];
      atlanan += r.atlanan;
      let sira = 0;
      for (const q of r.resimler) {
        if (Math.min(q.piksel.g, q.piksel.y) < enAzPiksel) { atlanan++; continue; }
        sira++;
        dosyalar.push({ ad: dosyaAdiTuret(dosyaAdi, `-sayfa-${String(no).padStart(hane, '0')}-resim-${sira}`, 'png'), bayt: q.png, sayfa: no, genislik: q.piksel.g, yukseklik: q.piksel.y });
      }
    });
    const uyarilar = [];
    if (atlanan) uyarilar.push(`${atlanan} resim atlandı (çok küçük simge/süs, saydamlık maskesi gibi desteklenmeyen tür ya da okunamayan).`);
    uyarilar.push('Resimler PNG olarak kaydedilir (kalite kaybı yok, dosya boyutu özgün JPEG’den büyük olabilir). Sayfaya birden çok kez konan aynı resim her seferinde ayrı dosya olur.');
    return { dosyalar, atlanan, uyarilar };
  } finally { await belge.kapat(); }
}
