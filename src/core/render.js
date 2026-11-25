// PDF sayfalarını resme çizme (pdf.js ile). Tarayıcı ve Node'da aynı kod çalışsın diye
// pdf.js ve "tuval" (canvas) üretimi dışarıdan verilir:
//   renderOrtamiAyarla({ pdfjs, tuvalOlustur(w,h), tuvaliBayta(tuval, bicim, kalite), belgeSecenekleri })

import { PdfHatasi, SifreliPdfHatasi, YanlisSifreHatasi } from './hatalar.js';
import { sayfaSecimi, dosyaAdiTuret, eszamanliCalistir } from './util.js';

let ORTAM = null;
export function renderOrtamiAyarla(o) {
  ORTAM = o;
}
function ortam() {
  if (!ORTAM) throw new PdfHatasi('Çizim ortamı hazır değil.');
  return ORTAM;
}

/** pdf.js ile belgeyi açar. Şifreliyse SifreliPdfHatasi / YanlisSifreHatasi fırlatır. */
export async function belgeAc(bayt, { sifre, ek = {}, isciNo = 0 } = {}) {
  const { pdfjs, belgeSecenekleri } = ortam();
  const gorev = pdfjs.getDocument({
    data: bayt.slice(), // pdf.js diziyi devralabilir; özgün veriyi koru
    password: sifre,
    isEvalSupported: false,
    verbosity: 0,
    ...belgeSecenekleri,
    ...(ortam().isci ? { worker: ortam().isci(isciNo) } : {}), // tarayıcıda tek ortak işçi: yüzlerce belgede her seferinde yeni işçi başlatılmaz
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
export async function sayfaCiz(belge, sayfaNo, { olcek = 1, arkaPlan = '#ffffff', donus = 0 } = {}) {
  const o = ortam();
  const sayfa = await belge.getPage(sayfaNo);
  // donus: sayfanın kendi dönüşüne EK derece (0/90/180/270); OCR'da yan duran sayfayı dik okumak için
  const vp = sayfa.getViewport({ scale: olcek, ...(donus ? { rotation: (sayfa.rotate + donus) % 360 } : {}) });
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

/** Bu cihazda aynı anda kaç PDF okuyucu (ayrı işçi) kullanılsın; büyük dosyada bellek için azaltılır. */
export function okuyucuSayisi(baytBoyutu = 0, istenen = 4) {
  const cekirdek = globalThis.navigator?.hardwareConcurrency ?? 4;
  const bellek = globalThis.navigator?.deviceMemory ?? 8;
  let n = Math.min(istenen, Math.max(1, cekirdek - 1), bellek <= 4 ? 2 : 8);
  if (baytBoyutu > 150e6) n = Math.min(n, 2);
  else if (baytBoyutu > 60e6) n = Math.min(n, 3);
  return Math.max(1, n);
}

/**
 * Sayfaları BİRDEN ÇOK ayrı PDF okuyucuyla (her biri kendi işçisinde) aynı anda işler; sonuçlar sayfa sırasıyla döner.
 * Tek işçi darboğazı kalkar: pdf.js çözümleme, farklı çekirdeklerde paralel yürür.
 * @param kaynaklar  Uint8Array ya da { ana: bayt, ... }  (her kulvar gereken kaynağı kendi belgesiyle açar)
 * @param islem      async (belge, sayfaNo, sira, belgeAl) — belgeAl(ad) aynı kulvarın başka kaynağını verir
 * @param secenek.ilkBelge  zaten açık bir "ana" belge varsa 0. kulvar onu kullanır (kapatmayı çağıran yapar)
 * @param secenek.sinir     eşzamanlı sayfa (kulvar) sayısı; belge sayısı da bu kadar (en çok)
 */
export async function paralelSayfalar(kaynaklar, sayfaNolari, islem, { ilkBelge = null, sinir = 4, belgeSecenek = {}, baytBoyutu = 0 } = {}) {
  const kay = kaynaklar instanceof Uint8Array ? { ana: kaynaklar } : kaynaklar;
  const boyut = Math.max(...Object.values(kay).map((b) => b.length), baytBoyutu);
  const kulvar = Math.max(1, Math.min(sinir, sayfaNolari.length, okuyucuSayisi(boyut, sinir)));
  const acik = []; // kulvar → { ad → söz }
  const belgeAlCikar = (yuva) => (ad = 'ana') => {
    acik[yuva] ??= {};
    if (!acik[yuva][ad]) {
      acik[yuva][ad] = (yuva === 0 && ad === 'ana' && ilkBelge) ? Promise.resolve(ilkBelge) : belgeAc(kay[ad], { ...belgeSecenek, isciNo: yuva });
    }
    return acik[yuva][ad];
  };
  const alicilar = Array.from({ length: kulvar }, (_, y) => belgeAlCikar(y));
  const sonuc = new Array(sayfaNolari.length);
  try {
    await eszamanliCalistir(sayfaNolari.length, kulvar, async (i, yuva) => {
      const al = alicilar[yuva];
      sonuc[i] = await islem(await al('ana'), sayfaNolari[i], i, al);
    });
  } finally {
    await Promise.allSettled(acik.flatMap((o, y) => Object.entries(o ?? {})
      .filter(([ad]) => !(y === 0 && ad === 'ana' && ilkBelge))
      .map(async ([, soz]) => (await soz).kapat?.())));
  }
  return sonuc;
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
    let biten = 0;
    const dosyalar = await paralelSayfalar(bayt, secili.map((x) => x + 1), async (b, no) => {
      const { tuval, genislik, yukseklik } = await sayfaCiz(b, no, { olcek: dpi / 72, arkaPlan: '#ffffff' });
      const resimBayt = await o.tuvaliBayta(tuval, bicim, kalite);
      ilerleme?.(++biten, secili.length);
      return {
        ad: dosyaAdiTuret(dosyaAdi, `-sayfa-${String(no).padStart(hane, '0')}`, bicim === 'jpeg' ? 'jpg' : 'png'),
        bayt: resimBayt, genislik, yukseklik, sayfa: no,
      };
    }, { ilkBelge: belge, belgeSecenek: { sifre } });
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
