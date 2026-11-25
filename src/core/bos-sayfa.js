// Boş sayfaları bulur; siler ya da boş sayfalardan keserek böler.
// Boş = sayfada (neredeyse) hiç koyu piksel yok ve seçilebilir yazı yok. Taramalardaki toz/gürültü "hassasiyet" ile tolere edilir.
import { belgeAc, sayfaCiz, paralelSayfalar } from './render.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { PDFDocument } from 'pdf-lib';
import { dosyaAdiTuret } from './util.js';
import { PdfHatasi } from './hatalar.js';

// Koyu piksel oranı eşiği (kenar boşlukları hariç): bundan azsa boş sayılır
export const HASSASIYET = { yuksek: 0.0004, orta: 0.0025, dusuk: 0.008 };

/** @returns {{bos:number[], oranlar:number[], sayfaSayisi:number}}  bos: 0 tabanlı sayfa indeksleri */
export async function bosSayfalariBul(bayt, { hassasiyet = 'orta', yaziyiSay = true, ilerleme } = {}) {
  const esik = HASSASIYET[hassasiyet] ?? Number(hassasiyet);
  if (!(esik > 0)) throw new PdfHatasi('Hassasiyet geçersiz.');
  const belge = await belgeAc(bayt);
  try {
    const n = belge.numPages;
    let biten = 0;
    const sonuc = await paralelSayfalar(bayt, Array.from({ length: n }, (_, k) => k + 1), async (b, no) => {
      const { tuval, genislik: w, yukseklik: h } = await sayfaCiz(b, no, { olcek: 0.4 });
      const d = tuval.getContext('2d').getImageData(0, 0, w, h).data;
      const kx = Math.floor(w * 0.04), ky = Math.floor(h * 0.04); // kenar payı (tarama gölgeleri)
      let koyu = 0, toplam = 0;
      for (let y = ky; y < h - ky; y++) for (let x = kx; x < w - kx; x++) { const i = (y * w + x) * 4; toplam++; if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 200) koyu++; }
      let yazi = 0;
      if (yaziyiSay) { const s = await b.getPage(no); yazi = (await s.getTextContent()).items.reduce((t, o) => t + (o.str ?? '').replace(/\s+/g, '').length, 0); s.cleanup(); }
      ilerleme?.(++biten, n);
      return { oran: koyu / Math.max(1, toplam), yazi };
    }, { ilkBelge: belge });
    const oranlar = sonuc.map((s) => s.oran);
    const bos = sonuc.map((s, i) => (s.oran <= esik && s.yazi === 0 ? i : -1)).filter((i) => i >= 0);
    return { bos, oranlar, sayfaSayisi: n };
  } finally { await belge.kapat(); }
}

async function secilenlerleYeni(kaynak, indeksler) {
  const cikti = await PDFDocument.create();
  (await cikti.copyPages(kaynak, indeksler)).forEach((p) => cikti.addPage(p));
  return cikti;
}

/** Boş sayfaları siler. */
export async function bosSayfalariSil(bayt, secenek = {}) {
  const b = await bosSayfalariBul(bayt, secenek);
  if (!b.bos.length) return { bayt, degisti: false, silinen: 0, sayfaSayisi: b.sayfaSayisi, uyarilar: [] };
  if (b.bos.length === b.sayfaSayisi) throw new PdfHatasi('Tüm sayfalar boş görünüyor; hiçbir şey silinmedi. Hassasiyeti “yüksek” yapmayı deneyin.');
  const kaynak = await pdfAc(bayt);
  const tut = Array.from({ length: b.sayfaSayisi }, (_, i) => i).filter((i) => !b.bos.includes(i));
  const doc = await secilenlerleYeni(kaynak, tut);
  return {
    bayt: await kaydet(doc), degisti: true, silinen: b.bos.length, silinenSayfalar: b.bos.map((i) => i + 1), sayfaSayisi: tut.length,
    uyarilar: ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge'),
  };
}

/** Boş sayfalardan keserek böler (boş sayfalar hiçbir parçaya girmez). */
export async function bosSayfadanBol(bayt, dosyaAdi, secenek = {}) {
  const b = await bosSayfalariBul(bayt, secenek);
  const kaynak = await pdfAc(bayt);
  const gruplar = []; let sim = [];
  for (let i = 0; i < b.sayfaSayisi; i++) {
    if (b.bos.includes(i)) { if (sim.length) gruplar.push(sim); sim = []; } else sim.push(i);
  }
  if (sim.length) gruplar.push(sim);
  if (!b.bos.length || gruplar.length < 2) {
    return { dosyalar: [], bos: b.bos.map((i) => i + 1), uyarilar: [b.bos.length ? 'Boş sayfalar bulundu ama bölünecek ikinci bir bölüm oluşmadı.' : 'Hiç boş sayfa bulunamadı; dosya bölünmedi.'] };
  }
  const hane = Math.max(2, String(gruplar.length).length);
  const dosyalar = [];
  for (let g = 0; g < gruplar.length; g++) {
    dosyalar.push({ ad: dosyaAdiTuret(dosyaAdi, `-bolum-${String(g + 1).padStart(hane, '0')}`), bayt: await kaydet(await secilenlerleYeni(kaynak, gruplar[g])), sayfalar: gruplar[g].map((i) => i + 1) });
  }
  return { dosyalar, bos: b.bos.map((i) => i + 1), uyarilar: ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge') };
}
