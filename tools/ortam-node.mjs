// Node.js ortamında (testler ve komut satırı araçları) çizim ve şifreleme bileşenlerini hazırlar.
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'node:url';
import { renderOrtamiAyarla } from '../src/core/render.js';
import { qpdfWasmAyarla } from '../src/core/sifre.js';

const kok = fileURLToPath(new URL('../', import.meta.url));
const pdfjsKlasoru = `${kok}node_modules/pdfjs-dist/`;

let hazir = false;
export function nodeOrtaminiKur() {
  if (hazir) return;
  hazir = true;
  qpdfWasmAyarla(`${kok}node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm`);
  renderOrtamiAyarla({
    pdfjs,
    tuvalOlustur: (w, h) => createCanvas(w, h),
    tuvaliBayta: async (tuval, bicim, kalite) => {
      const b = bicim === 'jpeg' ? await tuval.encode('jpeg', Math.round(kalite * 100)) : await tuval.encode('png');
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
