// Doldurulabilir PDF formu oluşturma: sayfaya metin kutusu, onay kutusu, seçenek düğmeleri ve açılır liste alanları ekler.
// Alanlar gerçek AcroForm alanlarıdır (Acrobat, tarayıcı, Preview vb. ile doldurulabilir; bu sitenin "Form doldur" aracıyla da).
// Koordinatlar: sayfanın EKRANDA görünen sol-alt köşesinden, nokta (pt).
//
// SINIRLAR: Döndürülmüş sayfalarda alan kutusu doğru yere gelir ama içindeki yazı sayfa yönüne göre dönmez. JavaScript'li alan
// biçimlendirme/doğrulama yoktur. Dijital imza alanı eklenmez.

import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yaziTipiGom, metniDogrula, VARSAYILAN_AILE } from './fonts.js';
import { gorunurDonusum, noktaDonustur } from './cizim.js';

/**
 * @param alanlar [{ tur:'metin'|'onay'|'secenek'|'liste', ad, sayfa (0 tabanlı), x0,y0,x1,y1,
 *                   varsayilan?, cokSatir?, secenekler? (liste/secenek için), zorunlu?, salt?, boyut? }]
 *   'secenek' (radyo düğmeleri): aynı `ad` ile birden çok alan = aynı grup; her biri { secenek:'deger' } taşır.
 */
export async function formAlanlariEkle(bayt, alanlar, { aile = VARSAYILAN_AILE } = {}) {
  if (!alanlar?.length) throw new PdfHatasi('Eklenecek bir form alanı yok.');
  const doc = await pdfAc(bayt);
  const n = doc.getPageCount();
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  const form = doc.getForm();
  const font = await yaziTipiGom(doc, aile); // Türkçe karakterler için gömülü yazı tipi (varsayılan Helvetica ğ/ş/ı çizemez)
  const mevcut = new Set(form.getFields().map((f) => f.getName()));
  const radyolar = new Map();
  let donukUyari = false;

  for (const a of alanlar) {
    if (!a.ad || !/^[^\s.][^.]*$/.test(a.ad)) throw new PdfHatasi(`Alan adı geçersiz: “${a.ad ?? ''}” (boş olamaz, nokta içeremez).`);
    if (!Number.isInteger(a.sayfa) || a.sayfa < 0 || a.sayfa >= n) throw new PdfHatasi(`Sayfa ${a.sayfa + 1} yok; bu belgede ${n} sayfa var.`);
    const sayfa = doc.getPage(a.sayfa);
    const g = gorunurDonusum(sayfa);
    const [px0, py0] = noktaDonustur(g.m, Math.min(a.x0, a.x1), Math.min(a.y0, a.y1));
    const [px1, py1] = noktaDonustur(g.m, Math.max(a.x0, a.x1), Math.max(a.y0, a.y1));
    const kutu = { x: Math.min(px0, px1), y: Math.min(py0, py1), width: Math.abs(px1 - px0), height: Math.abs(py1 - py0) };
    if (kutu.width < 4 || kutu.height < 4) throw new PdfHatasi(`“${a.ad}” alanı çok küçük.`);
    if (g.m[0] !== 1 || g.m[3] !== 1) donukUyari = true;
    const secenek = { ...kutu, borderWidth: 1, font };
    if (a.tur !== 'secenek' && mevcut.has(a.ad)) throw new PdfHatasi(`“${a.ad}” adında bir alan zaten var; alan adları benzersiz olmalı.`);

    if (a.tur === 'metin') {
      const f = form.createTextField(a.ad);
      if (a.cokSatir) f.enableMultiline();
      if (a.varsayilan) { await metniDogrula(aile, {}, a.varsayilan); f.setText(String(a.varsayilan)); }
      if (a.zorunlu) f.enableRequired();
      if (a.salt) f.enableReadOnly();
      if (a.boyut) f.setFontSize(a.boyut);
      f.addToPage(sayfa, secenek);
      mevcut.add(a.ad);
    } else if (a.tur === 'onay') {
      const f = form.createCheckBox(a.ad);
      if (a.varsayilan) f.check();
      if (a.zorunlu) f.enableRequired();
      f.addToPage(sayfa, secenek);
      mevcut.add(a.ad);
    } else if (a.tur === 'secenek') {
      if (!a.secenek) throw new PdfHatasi(`“${a.ad}” seçenek düğmesi için “secenek” değeri gerekli.`);
      let grup = radyolar.get(a.ad);
      if (!grup) {
        if (mevcut.has(a.ad)) throw new PdfHatasi(`“${a.ad}” adında bir alan zaten var; alan adları benzersiz olmalı.`);
        grup = form.createRadioGroup(a.ad);
        radyolar.set(a.ad, grup);
        if (a.zorunlu) grup.enableRequired();
        mevcut.add(a.ad);
      }
      grup.addOptionToPage(String(a.secenek), sayfa, secenek);
      if (a.varsayilan) grup.select(String(a.secenek));
    } else if (a.tur === 'liste') {
      if (!a.secenekler?.length) throw new PdfHatasi(`“${a.ad}” açılır listesi için en az bir seçenek gerekli.`);
      for (const s of a.secenekler) await metniDogrula(aile, {}, s);
      const f = form.createDropdown(a.ad);
      f.addOptions(a.secenekler.map(String));
      if (a.varsayilan) f.select(String(a.varsayilan));
      if (a.zorunlu) f.enableRequired();
      f.addToPage(sayfa, secenek);
      mevcut.add(a.ad);
    } else {
      throw new PdfHatasi(`Bilinmeyen alan türü: ${a.tur}`);
    }
  }
  form.updateFieldAppearances(font);
  if (donukUyari) uyarilar.push('Döndürülmüş sayfalarda alan kutusu doğru yere gelir ama içindeki yazı sayfa yönüne göre dönmez.');
  const adet = alanlar.length;
  return { bayt: await kaydet(doc), eklenen: adet, uyarilar };
}
