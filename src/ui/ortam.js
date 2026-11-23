// Tarayıcı ortamı: pdf.js (çizim), qpdf (şifre) ve tuval ayarları. Her araç sayfasında bir kez kurulur.
import * as pdfjs from 'pdfjs-dist';
import isciUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { renderOrtamiAyarla } from '../core/render.js';

pdfjs.GlobalWorkerOptions.workerSrc = isciUrl;

const vp = (yol) => new URL(`pdfjs/${yol}`, document.baseURI).href;

renderOrtamiAyarla({
  pdfjs,
  tuvalOlustur: (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
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
