// PDF form alanlarını listeleme ve doldurma.

import {
  PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, PDFButton, PDFSignature, PDFName, PDFArray,
} from 'pdf-lib';
import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yaziTipiGom, metniDogrula, VARSAYILAN_AILE } from './fonts.js';

function alanTuru(f) {
  if (f instanceof PDFTextField) return 'metin';
  if (f instanceof PDFCheckBox) return 'onay';
  if (f instanceof PDFRadioGroup) return 'secenek';
  if (f instanceof PDFDropdown) return 'acilir';
  if (f instanceof PDFOptionList) return 'liste';
  if (f instanceof PDFButton) return 'dugme';
  if (f instanceof PDFSignature) return 'imza';
  return 'bilinmeyen';
}

function sayfaHaritasi(doc) {
  const harita = new Map();
  doc.getPages().forEach((p, i) => {
    const annots = p.node.Annots();
    if (annots instanceof PDFArray) {
      for (let k = 0; k < annots.size(); k++) {
        const r = annots.get(k);
        if (r?.tag) harita.set(r.tag, i);
      }
    }
  });
  return harita;
}

/** Belgedeki form alanlarını, doldurma arayüzünün kullanacağı sade bir listeye çevirir. */
export async function formAlanlari(bayt) {
  const doc = await pdfAc(bayt);
  const ozellik = belgeOzellikleri(doc);
  const uyarilar = ozellikUyarilari(ozellik, 'yerinde');
  const form = doc.getForm();
  const harita = sayfaHaritasi(doc);
  const alanlar = [];
  for (const f of form.getFields()) {
    const tur = alanTuru(f);
    let sayfa = null;
    try {
      for (const w of f.acroField.getWidgets()) {
        const ref = doc.context.getObjectRef(w.dict);
        if (ref && harita.has(ref.tag)) { sayfa = harita.get(ref.tag); break; }
      }
    } catch { /* sayfa bulunamadı */ }
    const a = { ad: f.getName(), tur, sayfa, salt: f.isReadOnly(), zorunlu: f.isRequired() };
    if (tur === 'metin') { a.deger = f.getText() ?? ''; a.cokSatir = f.isMultiline(); a.enCok = f.getMaxLength() ?? null; }
    else if (tur === 'onay') a.deger = f.isChecked();
    else if (tur === 'secenek') { a.deger = f.getSelected() ?? ''; a.secenekler = f.getOptions(); }
    else if (tur === 'acilir') { a.deger = f.getSelected()[0] ?? ''; a.secenekler = f.getOptions(); }
    else if (tur === 'liste') { a.deger = f.getSelected(); a.secenekler = f.getOptions(); }
    alanlar.push(a);
  }
  return { alanlar, uyarilar, xfa: ozellik.xfa, imzali: ozellik.imzali };
}

/**
 * @param degerler { [alanAdi]: string | boolean | string[] }
 * @param secenek.duzlestir  true → alanlar kalıcı olarak sayfaya işlenir, artık doldurulamaz
 */
export async function formDoldur(bayt, degerler, { duzlestir = false, aile = VARSAYILAN_AILE } = {}) {
  const doc = await pdfAc(bayt);
  const ozellik = belgeOzellikleri(doc);
  const uyarilar = ozellikUyarilari(ozellik, 'yerinde');
  const form = doc.getForm();
  if (!form.getFields().length) throw new PdfHatasi('Bu belgede doldurulabilir form alanı bulunamadı.');
  const font = await yaziTipiGom(doc, aile);

  let doldurulan = 0;
  for (const [ad, deger] of Object.entries(degerler)) {
    let f;
    try { f = form.getField(ad); } catch { throw new PdfHatasi(`"${ad}" adlı form alanı bulunamadı.`); }
    if (f.isReadOnly()) { uyarilar.push(`"${ad}" alanı salt okunur olduğu için değiştirilmedi.`); continue; }
    const tur = alanTuru(f);
    try {
      if (tur === 'metin') {
        const m = String(deger ?? '');
        if (m) await metniDogrula(aile, {}, m);
        const enCok = f.getMaxLength();
        if (enCok != null && m.length > enCok) throw new PdfHatasi(`"${ad}" alanına en fazla ${enCok} karakter yazılabilir.`);
        if (m === '') f.setText(undefined); else f.setText(m);
      } else if (tur === 'onay') {
        if (deger) f.check(); else f.uncheck();
      } else if (tur === 'secenek') {
        if (deger) f.select(String(deger));
      } else if (tur === 'acilir') {
        if (deger) f.select(String(deger));
      } else if (tur === 'liste') {
        const d = Array.isArray(deger) ? deger : deger ? [String(deger)] : [];
        if (d.length) f.select(d);
      } else {
        uyarilar.push(`"${ad}" alanı (${tur}) doldurulamaz, atlandı.`);
        continue;
      }
      doldurulan++;
    } catch (e) {
      if (e instanceof PdfHatasi) throw e;
      throw new PdfHatasi(`"${ad}" alanı doldurulamadı: ${e?.message ?? e}`);
    }
  }
  form.updateFieldAppearances(font);
  if (duzlestir) {
    form.flatten({ updateFieldAppearances: false });
    uyarilar.push('Form düzleştirildi: alanlar artık sayfanın bir parçası; tekrar doldurulamaz.');
  }
  return { bayt: await kaydet(doc), doldurulan, uyarilar };
}

export { PDFName };
