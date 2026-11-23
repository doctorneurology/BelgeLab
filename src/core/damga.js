// Görünür imza (çizilmiş/resim) ve metin kutusu ekleme.
//
// ÖNEMLİ: Burada eklenen imza yalnızca GÖRÜNÜR bir imzadır (sayfaya konan bir resim/yazı).
// Dijital (kriptografik) imza DEĞİLDİR, hukuki "güvenli elektronik imza" yerine geçmez.

import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yaziTipiGom, metniDogrula, VARSAYILAN_AILE } from './fonts.js';
import { yeniIslem, SayfaCizici, kutuSatirlari } from './cizim.js';
import { resimTuru } from './resim-pdf.js';

/**
 * @param ogeler [{ sayfa (0 tabanlı), tur: 'metin'|'resim', x, y, genislik, yukseklik, ... }]
 *   Koordinatlar: sayfanın EKRANDA görünen sol-alt köşesinden, nokta (pt) cinsinden.
 *   metin: { metin, aile, kalin, italik, boyut, renk, arkaPlan, cerceve, opaklik }
 *   resim: { bayt (PNG/JPEG), opaklik }
 */
export async function damgaEkle(bayt, ogeler) {
  if (!ogeler?.length) throw new PdfHatasi('Eklenecek bir imza veya metin kutusu yok.');
  const doc = await pdfAc(bayt);
  const n = doc.getPageCount();
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  const islem = yeniIslem(doc, 'damga');
  const ciziciler = new Map();
  const cizici = (i) => {
    if (!ciziciler.has(i)) ciziciler.set(i, new SayfaCizici(islem, doc.getPage(i)));
    return ciziciler.get(i);
  };

  for (const o of ogeler) {
    if (!Number.isInteger(o.sayfa) || o.sayfa < 0 || o.sayfa >= n) {
      throw new PdfHatasi(`Sayfa ${o.sayfa + 1} yok; bu belgede ${n} sayfa var.`);
    }
    if (!(o.genislik > 0 && o.yukseklik > 0)) throw new PdfHatasi('Kutu boyutu geçersiz.');
    const c = cizici(o.sayfa);
    if (o.x < -1 || o.y < -1 || o.x + o.genislik > c.genislik + 1 || o.y + o.yukseklik > c.yukseklik + 1) {
      uyarilar.push(`Sayfa ${o.sayfa + 1}: bir öğe sayfa sınırının dışına taşıyor; taşan kısım görünmez.`);
    }
    if (o.tur === 'resim') {
      const tur = resimTuru(o.bayt);
      const img = tur === 'png' ? await doc.embedPng(o.bayt) : tur === 'jpeg' ? await doc.embedJpg(o.bayt) : null;
      if (!img) throw new PdfHatasi('İmza resmi PNG veya JPEG olmalı.');
      c.resim({ resim: img, x: o.x, y: o.y, w: o.genislik, h: o.yukseklik, opaklik: o.opaklik ?? 1 });
    } else if (o.tur === 'metin') {
      const { metin = '', aile = VARSAYILAN_AILE, kalin = false, italik = false, boyut = 12, renk = '#000000', arkaPlan = null, cerceve = null } = o;
      if (!String(metin).trim()) throw new PdfHatasi('Metin kutusu boş.');
      await metniDogrula(aile, { kalin, italik }, metin);
      const font = await yaziTipiGom(doc, aile, { kalin, italik });
      const bosluk = Math.min(6, boyut * 0.4);
      c.dikdortgen({ x: o.x, y: o.y, w: o.genislik, h: o.yukseklik, dolgu: arkaPlan, cizgi: cerceve, opaklik: o.opaklik ?? 1 });
      const satirlar = kutuSatirlari(font, metin, boyut, o.genislik - 2 * bosluk);
      const gerekli = satirlar.length * boyut * 1.2 + 2 * bosluk - boyut * 0.2;
      if (gerekli > o.yukseklik + 0.5) {
        uyarilar.push(`Sayfa ${o.sayfa + 1}: metin kutuya sığmıyor (taşıyor); kutuyu büyütün ya da yazıyı küçültün.`);
      }
      const ilkTaban = o.y + o.yukseklik - bosluk - font.heightAtSize(boyut, { descender: false });
      c.metin({ font, metin: satirlar.join('\n'), boyut, x: o.x + bosluk, y: ilkTaban, renk, opaklik: o.opaklik ?? 1 });
    } else {
      throw new PdfHatasi('Bilinmeyen öğe türü.');
    }
  }
  for (const c of ciziciler.values()) c.bitir('ust');
  return { bayt: await kaydet(doc), sayfaSayisi: n, eklenen: ogeler.length, uyarilar };
}
