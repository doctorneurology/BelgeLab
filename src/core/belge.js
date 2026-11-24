import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString, EncryptedPDFError,
} from 'pdf-lib';
import { PdfHatasi, SifreliPdfHatasi } from './hatalar.js';

export const URETICI = 'BelgeLab (açık kaynak, tarayıcıda çalışır)';

/** PDF baytlarını açar. Şifreliyse SifreliPdfHatasi, bozuksa PdfHatasi fırlatır. */
export async function pdfAc(bayt) {
  if (!(bayt instanceof Uint8Array)) throw new PdfHatasi('Dosya içeriği okunamadı.');
  try {
    return await PDFDocument.load(bayt, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError || /encrypted/i.test(String(e?.message))) {
      throw new SifreliPdfHatasi();
    }
    throw new PdfHatasi(`Bu dosya geçerli bir PDF gibi açılamadı. (${e?.message ?? e})`, 'BOZUK');
  }
}

/** Kaydetmeden önce: üretici ve değişiklik tarihini DÜRÜSTÇE işler (iz saklanmaz). */
export function damgala(doc) {
  doc.setProducer(URETICI);
  doc.setModificationDate(new Date());
}

export async function kaydet(doc) {
  damgala(doc);
  return doc.save({ useObjectStreams: true });
}

const ad = (s) => PDFName.of(s);

function alanlariGez(baglam, dizi, f, derinlik = 0) {
  if (!(dizi instanceof PDFArray) || derinlik > 12) return;
  for (let i = 0; i < dizi.size(); i++) {
    const d = baglam.lookup(dizi.get(i));
    if (!(d instanceof PDFDict)) continue;
    f(d);
    const kids = baglam.lookup(d.get(ad('Kids')));
    if (kids instanceof PDFArray) alanlariGez(baglam, kids, f, derinlik + 1);
  }
}

/**
 * Belgenin, düzenleme sırasında zarar görebilecek özelliklerini tespit eder.
 * Sonuç, kullanıcıya gösterilecek uyarıları üretmek için kullanılır.
 */
export function belgeOzellikleri(doc) {
  const baglam = doc.context;
  const katalog = doc.catalog;
  const o = { form: false, formAlanSayisi: 0, imzali: false, xfa: false, yerImi: false, ekDosya: false };
  o.yerImi = katalog.has(ad('Outlines'));
  const acro = baglam.lookup(katalog.get(ad('AcroForm')));
  if (acro instanceof PDFDict) {
    if (acro.has(ad('XFA'))) o.xfa = true;
    alanlariGez(baglam, baglam.lookup(acro.get(ad('Fields'))), (d) => {
      const ft = baglam.lookup(d.get(ad('FT')));
      if (ft instanceof PDFName && ft.decodeText() === 'Sig') {
        if (d.has(ad('V'))) o.imzali = true;
      } else if (ft) {
        o.formAlanSayisi++;
      }
    });
    o.form = o.formAlanSayisi > 0;
  }
  const adlar = baglam.lookup(katalog.get(ad('Names')));
  if (adlar instanceof PDFDict && adlar.has(ad('EmbeddedFiles'))) o.ekDosya = true;
  return o;
}

/**
 * @param {ReturnType<typeof belgeOzellikleri>} o
 * @param {'yeniBelge'|'yerinde'} tur  yeniBelge: sayfalar yeni bir belgeye kopyalanıyor (form/yer imi kaybolur)
 */
export function ozellikUyarilari(o, tur) {
  const u = [];
  if (o.imzali) {
    u.push('Bu belgede dijital imza var. Belge değiştirildiği için imza geçersiz sayılacaktır.');
  }
  if (o.xfa) {
    u.push('Bu belgede XFA türü form var; bu tür formlar desteklenmez ve çıktıda çalışmayabilir.');
  }
  if (tur === 'yeniBelge') {
    if (o.form) u.push('Belgedeki doldurulabilir form alanları çıktıda korunmuyor olabilir; çıktıyı kontrol edin.');
    if (o.yerImi) u.push('Belgedeki yer imleri (içindekiler menüsü) çıktıya taşınmaz.');
    if (o.ekDosya) u.push('Belgeye gömülü ek dosyalar çıktıya taşınmaz.');
  }
  return u;
}

export function tekrarsiz(dizi) {
  return [...new Set(dizi)];
}

export { PDFString, PDFHexString, PDFRef };
