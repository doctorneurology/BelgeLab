// Tarayıcı ortamı: pdf.js (çizim), qpdf (şifre) ve tuval ayarları. Her araç sayfasında bir kez kurulur.
import * as pdfjs from 'pdfjs-dist';
import isciUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { renderOrtamiAyarla } from '../core/render.js';

pdfjs.GlobalWorkerOptions.workerSrc = isciUrl;

const vp = (yol) => new URL(`pdfjs/${yol}`, document.baseURI).href;

let ortakIsci = null;
renderOrtamiAyarla({
  pdfjs,
  isci: () => { ortakIsci ??= new pdfjs.PDFWorker({ name: 'ortak' }); return ortakIsci; },
  tuvalOlustur: (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
  resimCoz: async (bayt) => {
    const im = await createImageBitmap(new Blob([bayt]));
    return { genislik: im.width, yukseklik: im.height, cizilebilir: im };
  },
  tuvaliBayta: (tuval, bicim, kalite) =>
    new Promise((coz, red) => {
      tuval.toBlob(
        async (b) => (b ? coz(new Uint8Array(await b.arrayBuffer())) : red(new Error('Resim üretilemedi (sayfa çok büyük olabilir).'))),
        bicim === 'jpeg' ? 'image/jpeg' : 'image/png',
        kalite,
      );
    }),
  belgeSecenekleri: {
    standardFontDataUrl: vp('standard_fonts/'),
    cMapUrl: vp('cmaps/'),
    cMapPacked: true,
    wasmUrl: vp('wasm/'),
    iccUrl: vp('iccs/'),
  },
});

/** Şifre bileşenini (qpdf) yalnızca gerektiğinde yükler. */
export async function sifreModulu() {
  const m = await import('../core/sifre.js');
  m.qpdfWasmAyarla(new URL(qpdfWasmUrl, document.baseURI).href);
  return m;
}

let ocrHazirMi = false;
/**
 * OCR bileşenini (tesseract.js + Türkçe dil verisi) yalnızca gerektiğinde yükler.
 * Tüm dosyalar sitenin kendi klasöründedir (public/tesseract); internetten bir şey indirilmez.
 */
export async function ocrHazirla() {
  if (ocrHazirMi) return;
  const [{ ocrOrtamiAyarla }, T] = await Promise.all([import('../core/ocr.js'), import('tesseract.js')]);
  const mutlak = (yol) => new URL(`tesseract/${yol}`, document.baseURI).href;
  ocrOrtamiAyarla({
    createWorker: T.createWorker ?? T.default?.createWorker,
    secenekler: { workerPath: mutlak('worker.min.js'), corePath: mutlak('core'), langPath: mutlak('lang'), cacheMethod: 'none', gzip: true },
  });
  ocrHazirMi = true;
}
