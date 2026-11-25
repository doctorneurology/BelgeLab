// Tarayıcı ortamı: pdf.js (çizim), qpdf (şifre) ve tuval ayarları. Her araç sayfasında bir kez kurulur.
import * as pdfjs from 'pdfjs-dist';
import isciUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { renderOrtamiAyarla } from '../core/render.js';
import { tuvaldenPng } from '../core/png.js';
import { pdfiumOrtamiAyarla } from '../core/pdf-word-duzen.js';

pdfjs.GlobalWorkerOptions.workerSrc = isciUrl;

// pdf.js, sayfayı çizerken her parçada requestAnimationFrame bekler. Sekme arka plandayken (ya da pencere gizliyken) bu çağrı
// hiç/çok seyrek (saniyede ~1) çalışır; yüzlerce sayfalık dönüştürmede sayfa başına ~1 sn boş bekleme ve sekme değişince DONMA demektir.
// Burada çizim zamanlaması MessageChannel ile yapılır (arka planda kısılmaz). Gerçek rAF, ekranın boyanmasını beklemek için saklanır.
window.__gercekRaf = window.requestAnimationFrame.bind(window);
{
  const kanal = new MessageChannel();
  const bekleyen = new Map();
  let sayac = 0;
  kanal.port1.onmessage = (e) => { const f = bekleyen.get(e.data); if (f) { bekleyen.delete(e.data); f(performance.now()); } };
  window.requestAnimationFrame = (f) => { const id = ++sayac; bekleyen.set(id, f); kanal.port2.postMessage(id); return id; };
  window.cancelAnimationFrame = (id) => { bekleyen.delete(id); };
}

const vp = (yol) => new URL(`pdfjs/${yol}`, document.baseURI).href;

const iscilar = []; // her PDF okuyucu kulvarı kendi pdf.js işçisini (ayrı iş parçacığı) kullanır
renderOrtamiAyarla({
  pdfjs,
  isci: (no = 0) => (iscilar[no] ??= new pdfjs.PDFWorker({ name: `isci-${no}` })),
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
  tuvaliBayta: async (tuval, bicim, kalite) => {
    // PNG: tuval.toBlob çok yavaş ve ana iş parçacığını tutar; hızlı yazıcı (sıkıştırma ayrı işçide) kullanılır.
    if (bicim === 'png') { try { return await tuvaldenPng(tuval); } catch { /* bellek/destek sorunu: tarayıcı kodlayıcısına dön */ } }
    return new Promise((coz, red) => {
      tuval.toBlob(
        async (b) => (b ? coz(new Uint8Array(await b.arrayBuffer())) : red(new Error('Resim üretilemedi (sayfa çok büyük olabilir).'))),
        bicim === 'jpeg' ? 'image/jpeg' : bicim === 'webp' ? 'image/webp' : 'image/png',
        kalite,
      );
    });
  },
  belgeSecenekleri: {
    standardFontDataUrl: vp('standard_fonts/'),
    cMapUrl: vp('cmaps/'),
    cMapPacked: true,
    wasmUrl: vp('wasm/'),
    iccUrl: vp('iccs/'),
  },
});

// PDFium WASM (PDF → Word "düzeni koru" kipi): yalnızca kullanılınca indirilir, sitenin kendi klasöründedir.
pdfiumOrtamiAyarla({ wasmYukle: async () => new Uint8Array(await (await fetch(new URL(pdfiumWasmUrl, document.baseURI))).arrayBuffer()) });

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
