// PDF sayfalarını resme çizme (pdf.js ile). Tarayıcı ve Node'da aynı kod çalışsın diye
// pdf.js ve "tuval" (canvas) üretimi dışarıdan verilir:
//   renderOrtamiAyarla({ pdfjs, tuvalOlustur(w,h), tuvaliBayta(tuval, bicim, kalite), belgeSecenekleri })

import { PdfHatasi, SifreliPdfHatasi, YanlisSifreHatasi } from './hatalar.js';
import { sayfaSecimi, dosyaAdiTuret } from './util.js';

let ORTAM = null;
export function renderOrtamiAyarla(o) {
  ORTAM = o;
}
function ortam() {
  if (!ORTAM) throw new PdfHatasi('Çizim ortamı hazır değil.');
  return ORTAM;
}

/** pdf.js ile belgeyi açar. Şifreliyse SifreliPdfHatasi / YanlisSifreHatasi fırlatır. */
export async function belgeAc(bayt, { sifre, ek = {} } = {}) {
  const { pdfjs, belgeSecenekleri } = ortam();
  const gorev = pdfjs.getDocument({
    data: bayt.slice(), // pdf.js diziyi devralabilir; özgün veriyi koru
    password: sifre,
    isEvalSupported: false,
    verbosity: 0,
    ...belgeSecenekleri,
    ...ek, // ör. { fontExtraProperties: true } → gerçek yazı tipi adları
  });
  try {
    const belge = await gorev.promise;
    /** Belgeyi ve çalışan işçiyi kapatır (bellek serbest kalır). */
    belge.kapat = async () => { try { await gorev.destroy(); } catch { /* zaten kapalı */ } };
    return belge;
  } catch (e) {
    if (e?.name === 'PasswordException') {
      throw e.code === 2 ? new YanlisSifreHatasi() : new SifreliPdfHatasi();
    }
    throw new PdfHatasi(`PDF görüntülenemedi: ${e?.message ?? e}`, 'BOZUK');
  }
}

/** Çizilmiş bir tuvali PNG/JPEG baytlarına çevirir (ortama göre). */
export async function tuvaliBayta(tuval, bicim = 'png', kalite = 0.92) {
  return ortam().tuvaliBayta(tuval, bicim, kalite);
}

export const EN_COK_PIKSEL = 40_000_000;

/** Tek sayfayı çizer. sayfaNo 1 tabanlıdır. @returns {{tuval, genislik, yukseklik}} */
export async function sayfaCiz(belge, sayfaNo, { olcek = 1, arkaPlan = '#ffffff' } = {}) {
  const o = ortam();
  const sayfa = await belge.getPage(sayfaNo);
  const vp = sayfa.getViewport({ scale: olcek });
  const genislik = Math.max(1, Math.ceil(vp.width));
  const yukseklik = Math.max(1, Math.ceil(vp.height));
  if (genislik * yukseklik > EN_COK_PIKSEL) {
    throw new PdfHatasi(`Sayfa ${sayfaNo} bu çözünürlükte çok büyük (${genislik}×${yukseklik}). Daha düşük bir çözünürlük seçin.`, 'BUYUK');
  }
  const tuval = o.tuvalOlustur(genislik, yukseklik);
  const ctx = tuval.getContext('2d');
  if (arkaPlan) {
    ctx.fillStyle = arkaPlan;
    ctx.fillRect(0, 0, genislik, yukseklik);
  }
  await sayfa.render({ canvasContext: ctx, canvas: tuval, viewport: vp }).promise;
  sayfa.cleanup();
  return { tuval, genislik, yukseklik };
}

/**
 * Seçilen sayfaları PNG/JPEG olarak üretir.
 * @returns {{dosyalar:{ad,bayt,genislik,yukseklik,sayfa}[], uyarilar:string[]}}
 */
export async function pdfdenResimler(bayt, dosyaAdi, { sayfalar = '', dpi = 150, bicim = 'png', kalite = 0.92, sifre, ilerleme } = {}) {
  const o = ortam();
  if (!(dpi >= 36 && dpi <= 600)) throw new PdfHatasi('Çözünürlük 36 ile 600 dpi arasında olmalı.');
  if (!['png', 'jpeg'].includes(bicim)) throw new PdfHatasi('Biçim png veya jpeg olmalı.');
  const belge = await belgeAc(bayt, { sifre });
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    const hane = String(belge.numPages).length;
    const dosyalar = [];
    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      const { tuval, genislik, yukseklik } = await sayfaCiz(belge, no, { olcek: dpi / 72, arkaPlan: '#ffffff' });
      const resimBayt = await o.tuvaliBayta(tuval, bicim, kalite);
      dosyalar.push({
        ad: dosyaAdiTuret(dosyaAdi, `-sayfa-${String(no).padStart(hane, '0')}`, bicim === 'jpeg' ? 'jpg' : 'png'),
        bayt: resimBayt, genislik, yukseklik, sayfa: no,
      });
      ilerleme?.(k + 1, secili.length);
    }
    return { dosyalar, uyarilar: [] };
  } finally {
    await belge.kapat();
  }
}

/** pdf.js işlem kodları (OPS): sayfadaki resimlerin yerini bulmak için. */
export function pdfjsOps() {
  return ortam().pdfjs.OPS;
}

/** Tuval üretimi (ortama göre). Resim dönüştürme yardımcıları kullanır. */
export function tuvalOlustur(w, h) {
  return ortam().tuvalOlustur(w, h);
}

/**
 * Sıkıştırılmış resim baytlarını (JPEG/PNG) çözer. Ortam sağlar.
 * @returns {{genislik, yukseklik, cizilebilir}}  cizilebilir: tuvalin drawImage'ına verilebilir nesne
 */
export async function resimCoz(bayt) {
  const o = ortam();
  if (!o.resimCoz) throw new PdfHatasi('Resim çözme bileşeni hazır değil.');
  return o.resimCoz(bayt);
}
