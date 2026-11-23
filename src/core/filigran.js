// Filigran ekleme ve YALNIZCA bu programın eklediği filigranı geri alma.
//
// Geri alma kuralı: Başka bir program/kişi tarafından konmuş filigran ya da telif işareti için
// hiçbir şey yapılmaz. Bu program, eklediği filigranı kendi işaretiyle (bkz. cizim.js) etiketler;
// "geri al" yalnızca bu etiketli içerikleri kaldırır.

import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yaziTipiGom, metniDogrula, VARSAYILAN_AILE } from './fonts.js';
import { yeniIslem, SayfaCizici, eklenenleriBul, eklenenleriKaldir } from './cizim.js';
import { sayfaSecimi } from './util.js';
import { resimTuru } from './resim-pdf.js';

const TUR = 'filigran';
const EN_COK_TEKRAR = 600;

/**
 * @param secenek.metin           yazı filigranı (ya da)
 * @param secenek.resim           {bayt} PNG/JPEG resim filigranı
 * @param secenek.konum           'orta' | 'doseme'
 * @param secenek.katman          'ust' (içeriğin üstünde) | 'alt' (içeriğin altında; opak içerik örtebilir)
 */
export async function filigranEkle(bayt, secenek) {
  const {
    metin = '', resim = null, aile = VARSAYILAN_AILE, kalin = true, italik = false, boyut = 64,
    renk = '#808080', opaklik = 0.25, aci = 45, konum = 'orta', katman = 'ust',
    sayfalar = '', resimGenislikOrani = 0.5, aralikX = 1.0, aralikY = 1.0,
  } = secenek;
  const yaziMi = String(metin).trim() !== '';
  if (!yaziMi && !resim) throw new PdfHatasi('Filigran için bir metin yazın ya da bir resim seçin.');
  if (!(opaklik > 0 && opaklik <= 1)) throw new PdfHatasi('Saydamlık 0 ile 1 arasında olmalı.');

  const doc = await pdfAc(bayt);
  const secili = sayfaSecimi(sayfalar, doc.getPageCount());
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  const islem = yeniIslem(doc, TUR);
  const t = (aci * Math.PI) / 180;
  const cos = Math.cos(t), sin = Math.sin(t);

  let font = null, resimNesnesi = null, metinTemiz = '';
  if (yaziMi) {
    metinTemiz = String(metin).replace(/\s*\n\s*/g, ' ').trim();
    await metniDogrula(aile, { kalin, italik }, metinTemiz);
    font = await yaziTipiGom(doc, aile, { kalin, italik });
  } else {
    const tur = resimTuru(resim.bayt);
    if (tur === 'png') resimNesnesi = await doc.embedPng(resim.bayt);
    else if (tur === 'jpeg') resimNesnesi = await doc.embedJpg(resim.bayt);
    else throw new PdfHatasi('Filigran resmi PNG veya JPEG olmalı.');
  }

  for (const i of secili) {
    const page = doc.getPage(i);
    const c = new SayfaCizici(islem, page);
    // Öğenin boyutu ve merkezden sol-alt köşeye kaydırma
    let gen, yuk;
    if (font) { gen = font.widthOfTextAtSize(metinTemiz, boyut); yuk = boyut * 0.7; }
    else { gen = c.genislik * resimGenislikOrani; yuk = gen * (resimNesnesi.height / resimNesnesi.width); }

    const yerles = (cx, cy) => {
      const ox = -gen / 2, oy = -yuk / 2;
      const x = cx + ox * cos - oy * sin;
      const y = cy + ox * sin + oy * cos;
      if (font) c.metin({ font, metin: metinTemiz, boyut, x, y, aci, renk, opaklik });
      else c.resim({ resim: resimNesnesi, x, y, w: gen, h: yuk, aci, opaklik });
    };

    if (konum === 'orta') {
      yerles(c.genislik / 2, c.yukseklik / 2);
    } else {
      const adimX = gen + gen * 0.5 * aralikX + 20;
      const adimY = yuk + yuk * 2 * aralikY + 20;
      // Sayfayı kaplayan döndürülmüş ızgara
      const yaricap = Math.hypot(c.genislik, c.yukseklik) / 2;
      const nx = Math.ceil(yaricap / adimX), ny = Math.ceil(yaricap / adimY);
      if ((2 * nx + 1) * (2 * ny + 1) > EN_COK_TEKRAR * 4) {
        throw new PdfHatasi('Döşeme çok sık; yazıyı büyütün ya da aralığı artırın.');
      }
      let adet = 0;
      for (let a = -nx; a <= nx; a++) {
        for (let b = -ny; b <= ny; b++) {
          const lx = a * adimX + (b % 2 ? adimX / 2 : 0), ly = b * adimY;
          const cx = c.genislik / 2 + lx * cos - ly * sin;
          const cy = c.yukseklik / 2 + lx * sin + ly * cos;
          if (cx < -gen || cx > c.genislik + gen || cy < -gen || cy > c.yukseklik + gen) continue;
          yerles(cx, cy);
          adet++;
        }
      }
      if (adet > EN_COK_TEKRAR) throw new PdfHatasi('Döşeme çok sık; yazıyı büyütün ya da aralığı artırın.');
    }
    c.bitir(katman);
  }
  return { bayt: await kaydet(doc), sayfaSayisi: doc.getPageCount(), islenen: secili.length, uyarilar };
}

/** Belgede, bu program tarafından eklenmiş kaç filigran içerik akışı var? */
export async function filigranSay(bayt) {
  const doc = await pdfAc(bayt);
  const bulunan = eklenenleriBul(doc, TUR);
  return { adet: bulunan.length, sayfa: new Set(bulunan.map((b) => b.sayfaNo)).size, islem: new Set(bulunan.map((b) => b.id)).size };
}

/**
 * Yalnızca bu programın eklediği filigranı kaldırır.
 * Hiç yoksa belgeye dokunmaz (bayt aynen döner) ve bulunan = 0 olur.
 */
export async function filigranGeriAl(bayt) {
  const doc = await pdfAc(bayt);
  const sonuc = eklenenleriKaldir(doc, TUR);
  if (!sonuc.kaldirilan) {
    return { bayt, bulunan: 0, sayfa: 0, uyarilar: [] };
  }
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  return { bayt: await kaydet(doc), bulunan: sonuc.kaldirilan, sayfa: sonuc.sayfa, uyarilar };
}
