// PDF'e gömülü resimleri ayıklar (her biri PNG dosyası olarak). Sayfa/resim sayısı sınırı yoktur.
import { belgeAc } from './render.js';
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
    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      ilerleme?.(k, secili.length, `Sayfa ${no} taranıyor…`);
      const r = await sayfaResimleri(belge, no, { enCok: Infinity, enAz: 1 });
      atlanan += r.atlanan;
      let sira = 0;
      for (const q of r.resimler) {
        if (Math.min(q.piksel.g, q.piksel.y) < enAzPiksel) { atlanan++; continue; }
        sira++;
        dosyalar.push({ ad: dosyaAdiTuret(dosyaAdi, `-sayfa-${String(no).padStart(hane, '0')}-resim-${sira}`, 'png'), bayt: q.png, sayfa: no, genislik: q.piksel.g, yukseklik: q.piksel.y });
      }
    }
    const uyarilar = [];
    if (atlanan) uyarilar.push(`${atlanan} resim atlandı (çok küçük simge/süs, saydamlık maskesi gibi desteklenmeyen tür ya da okunamayan).`);
    uyarilar.push('Resimler PNG olarak kaydedilir (kalite kaybı yok, dosya boyutu özgün JPEG’den büyük olabilir). Sayfaya birden çok kez konan aynı resim her seferinde ayrı dosya olur.');
    return { dosyalar, atlanan, uyarilar };
  } finally { await belge.kapat(); }
}
