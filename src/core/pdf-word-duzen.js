// PDF → Word, "DÜZENİ KORU" kipi. GenOffice'in pdf2docx kodunu (Apache-2.0, vendor/genoffice) ve PDFium'u (WASM) kullanır.
// Sayfa görünümüne mümkün olduğunca yakın Word üretir: çok sütunlu düzen, yüzen resimler, kalın/italik/renk, belgedeki yazı tipi adları.
// Mevcut "düzenlenebilir akış" kipinden (pdf-word.js) farkı: Word'de metin akışı değil sayfanın görünüşü esas alınır.
//
// DÜRÜSTLÜK: Yazı tipleri belgedeki adlarıyla yazılır; bilgisayarınızda yoksa Word yedek bir yazı tipi kullanır ve satırlar kayabilir.
// Taranmış (resim) sayfalar bu kipte OCR'lanmaz — onlar için "düzenlenebilir akış" kipini (OCR'lı) kullanın.
import { PDFDocument } from 'pdf-lib';
import { PdfHatasi, SifreliPdfHatasi, YanlisSifreHatasi } from './hatalar.js';
import { pdfAc } from './belge.js';
import { sayfaSecimi } from './util.js';

let ORTAM = null;
/** @param o.wasmYukle  async () => Uint8Array | ArrayBuffer  (pdfium.wasm içeriği)   @param o.ek  init'e eklenecek seçenekler (Node'da yol sabitleme) */
export function pdfiumOrtamiAyarla(o) { ORTAM = o; modul = null; }
export const pdfiumHazirMi = () => !!ORTAM;

let modul = null;
async function pdfiumHazirla() {
  if (modul) return modul;
  if (!ORTAM) throw new PdfHatasi('PDFium bileşeni hazır değil.');
  // GenOffice kodundaki hata ayıklama bayrakları process.env'e bakar; tarayıcıda process yoktur.
  globalThis.process ??= { env: {} };
  globalThis.process.env ??= {};
  const veri = await ORTAM.wasmYukle();
  const wasmBinary = veri instanceof Uint8Array ? veri.buffer.slice(veri.byteOffset, veri.byteOffset + veri.byteLength) : veri;
  const { init } = await import('@embedpdf/pdfium');
  const sarili = await init({ wasmBinary, ...(ORTAM.ek ?? {}) });
  const m = sarili.pdfium ?? sarili;
  m._PDFiumExt_Init();
  modul = m;
  return m;
}

/**
 * @param secenek.sayfalar "1-5,8" (boş = tümü)
 * @param secenek.sifre    şifreli PDF için
 * @returns {{bayt:Uint8Array, uyarilar:string[], bilgi:{sayfa:number, taranmis:boolean}}}
 */
export async function pdfdenWordDuzenli(bayt, { sayfalar = '', sifre, ilerleme } = {}) {
  const pdfium = await pdfiumHazirla();
  let girdi = bayt;
  let secilen = null;
  if (String(sayfalar).trim()) {
    const kaynak = await pdfAc(bayt);
    secilen = sayfaSecimi(sayfalar, kaynak.getPageCount());
    const yeni = await PDFDocument.create();
    (await yeni.copyPages(kaynak, secilen)).forEach((p) => yeni.addPage(p));
    girdi = new Uint8Array(await yeni.save());
  }
  const { convertPdfToDocx } = await import('../../vendor/genoffice/packages/pdf2docx/src/index.ts');
  let r;
  try {
    r = await convertPdfToDocx(girdi, { pdfium, password: sifre, onProgress: (k, n) => ilerleme?.(k, n) });
  } catch (e) {
    if (e?.name === 'PdfLoadError' || e?.code) {
      if (/password/i.test(String(e.code ?? e.message))) throw (sifre ? new YanlisSifreHatasi() : new SifreliPdfHatasi());
      throw new PdfHatasi(`PDF bu kipte açılamadı: ${e.message ?? e}`, 'BOZUK');
    }
    throw e;
  }
  const uyarilar = [
    'Bu kip sayfanın GÖRÜNÜŞÜNÜ korumaya çalışır; metin Word’de sütunlar ve yüzen kutularla kurulduğu için düzenlemesi “düzenlenebilir akış” kipinden zordur.',
    'Yazı tipleri belgedeki adlarıyla yazılır. Bilgisayarınızda yoksa Word yedek bir yazı tipi kullanır; bu durumda satırlar ve sayfa sayısı kayabilir.',
  ];
  if (r.scannedDocument) uyarilar.unshift('Bu belgenin çoğu sayfası taranmış (resim) görünüyor. Bu kip OCR yapmaz; yazı gerekiyorsa “Düzenlenebilir akış” kipini (OCR’lı) kullanın.');
  const bosUyari = r.warnings?.length ?? 0;
  if (bosUyari) uyarilar.push(`${bosUyari} sayfada/öğede basitleştirme yapıldı (karmaşık çizim ya da yazı tipi sorunları resim olarak aktarılmış olabilir).`);
  return { bayt: r.docx, uyarilar, ayrintilar: r.warnings ?? [], bilgi: { sayfa: r.pages, taranmis: !!r.scannedDocument } };
}
