// Node.js ortamında (testler ve komut satırı araçları) çizim ve şifreleme bileşenlerini hazırlar.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Tesseract from 'tesseract.js';
import { renderOrtamiAyarla } from '../src/core/render.js';
import { qpdfWasmAyarla } from '../src/core/sifre.js';
import { ocrOrtamiAyarla } from '../src/core/ocr.js';

const kok = fileURLToPath(new URL('../', import.meta.url));
const pdfjsKlasoru = `${kok}node_modules/pdfjs-dist/`;

let hazir = false;
export function nodeOrtaminiKur() {
  if (hazir) return;
  hazir = true;
  qpdfWasmAyarla(`${kok}node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm`);
  // OCR: Türkçe dil verisi npm paketinden yerel diskten okunur (internet gerekmez).
  ocrOrtamiAyarla({
    createWorker: Tesseract.createWorker,
    // Önce sitenin kendi dil klasörü (tur + eng bir arada); yoksa npm paketindeki Türkçe verisi
    secenekler: { langPath: existsSync(`${kok}public/tesseract/lang/eng.traineddata.gz`) ? `${kok}public/tesseract/lang` : `${kok}node_modules/@tesseract.js-data/tur/4.0.0_best_int` },
  });
  renderOrtamiAyarla({
    pdfjs,
    tuvalOlustur: (w, h) => createCanvas(w, h),
    resimCoz: async (bayt) => {
      const im = await loadImage(Buffer.from(bayt.buffer, bayt.byteOffset, bayt.byteLength));
      return { genislik: im.width, yukseklik: im.height, cizilebilir: im };
    },
    tuvaliBayta: async (tuval, bicim, kalite) => {
      const b = bicim === 'jpeg' ? await tuval.encode('jpeg', Math.round(kalite * 100)) : bicim === 'webp' ? await tuval.encode('webp', Math.round(kalite * 100)) : await tuval.encode('png');
      return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    },
    belgeSecenekleri: {
      standardFontDataUrl: `${pdfjsKlasoru}standard_fonts/`,
      cMapUrl: `${pdfjsKlasoru}cmaps/`,
      cMapPacked: true,
      wasmUrl: `${pdfjsKlasoru}wasm/`,
      iccUrl: `${pdfjsKlasoru}iccs/`,
      useSystemFonts: false,
    },
  });
}
