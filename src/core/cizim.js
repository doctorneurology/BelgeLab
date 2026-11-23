// Sayfa üzerine yazı / resim / çerçeve çizme altyapısı.
//
// - Tüm çizimler "görünür" koordinatlarda yapılır: orijin, sayfanın EKRANDA görünen sol-alt köşesidir
//   (sayfa döndürülmüş olsa da, kırpılmış olsa da). Kütüphane bunu PDF koordinatına çevirir.
// - Eklenen her içerik, kendi içerik akışında ve İŞARETLİ olarak saklanır. İşaret, yalnızca bu programın
//   eklediği şeyleri tanımamızı sağlar (ör. "filigranı geri al" yalnızca kendi eklediğimizi kaldırır).
//   İşaret gizli değildir; içerik akışının ilk satırında okunabilir bir yorum olarak durur.

import { PDFName, PDFArray, PDFDict, PDFRef, PDFRawStream, PDFStream } from 'pdf-lib';
import { PdfHatasi } from './hatalar.js';
import { sayi, renkCoz, rastgeleKimlik } from './util.js';

const MARKA = '%PDFARACLARI v1';

/** Sayfanın görünür alanı ve "görünür → PDF" dönüşüm matrisi. */
export function gorunurDonusum(page) {
  const kutu = page.getCropBox();
  const R = (((page.getRotation().angle % 360) + 360) % 360) | 0;
  const { x: x0, y: y0, width: w, height: h } = kutu;
  switch (R) {
    case 90: return { vw: h, vh: w, m: [0, 1, -1, 0, x0 + w, y0] };
    case 180: return { vw: w, vh: h, m: [-1, 0, 0, -1, x0 + w, y0 + h] };
    case 270: return { vw: h, vh: w, m: [0, -1, 1, 0, x0, y0 + h] };
    default: return { vw: w, vh: h, m: [1, 0, 0, 1, x0, y0] };
  }
}

/** Görünür koordinattaki bir noktayı PDF koordinatına çevirir. */
export function noktaDonustur(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function yeniIslem(doc, tur) {
  const ctx = doc.context;
  const kimlik = rastgeleKimlik();
  const sarmalKaynak = (govde) => ctx.register(ctx.stream(`${MARKA} tur=sarmal id=${kimlik}\n${govde}\n`));
  return { doc, tur, kimlik, qRef: sarmalKaynak('q'), QRef: sarmalKaynak('Q') };
}

function icerikDizisi(page) {
  page.node.normalize();
  let dizi = page.node.Contents();
  if (!(dizi instanceof PDFArray)) {
    dizi = page.doc.context.obj([]);
    page.node.set(PDFName.of('Contents'), dizi);
  }
  return dizi;
}

/** Metni, verilen genişliğe sığacak satırlara böler (kelime sınırında; çok uzun kelime karakter karakter). */
export function kutuSatirlari(font, metin, boyut, genislik) {
  const sonuc = [];
  for (const paragraf of String(metin).replace(/\r\n?/g, '\n').split('\n')) {
    if (paragraf === '') { sonuc.push(''); continue; }
    let satir = '';
    for (const kelime of paragraf.split(/(\s+)/).filter((k) => k !== '')) {
      const dene = satir + kelime;
      if (font.widthOfTextAtSize(dene, boyut) <= genislik || satir === '') {
        if (font.widthOfTextAtSize(dene, boyut) > genislik && satir === '') {
          // tek kelime sığmıyor: karakter karakter böl
          let parca = '';
          for (const ch of kelime) {
            if (font.widthOfTextAtSize(parca + ch, boyut) > genislik && parca) { sonuc.push(parca); parca = ch; }
            else parca += ch;
          }
          satir = parca;
        } else satir = dene;
      } else {
        sonuc.push(satir.replace(/\s+$/, ''));
        satir = kelime.replace(/^\s+/, '');
      }
    }
    sonuc.push(satir.replace(/\s+$/, ''));
  }
  return sonuc;
}

export class SayfaCizici {
  constructor(islem, page) {
    this.islem = islem;
    this.page = page;
    this.doc = islem.doc;
    this.ctx = islem.doc.context;
    this.gorunur = gorunurDonusum(page);
    this.ops = [];
    this.kaynaklar = [];
    this.fontAdlari = new Map();
    this.resimAdlari = new Map();
    this.opaklikAdlari = new Map();
  }

  get genislik() { return this.gorunur.vw; }
  get yukseklik() { return this.gorunur.vh; }

  _opaklikAdi(o) {
    if (o == null || o >= 1) return null;
    const sinir = Math.max(0, Math.min(1, o));
    if (!this.opaklikAdlari.has(sinir)) {
      const dict = this.ctx.obj({ Type: 'ExtGState', ca: sinir, CA: sinir });
      const ad = this.page.node.newExtGState('PAG', dict).decodeText();
      this.kaynaklar.push(`ExtGState:${ad}`);
      this.opaklikAdlari.set(sinir, ad);
    }
    return this.opaklikAdlari.get(sinir);
  }

  _fontAdi(font) {
    if (!this.fontAdlari.has(font)) {
      const ad = this.page.node.newFontDictionary('PAF', font.ref).decodeText();
      this.kaynaklar.push(`Font:${ad}`);
      this.fontAdlari.set(font, ad);
    }
    return this.fontAdlari.get(font);
  }

  _resimAdi(resim) {
    if (!this.resimAdlari.has(resim)) {
      const ad = this.page.node.newXObject('PAI', resim.ref).decodeText();
      this.kaynaklar.push(`XObject:${ad}`);
      this.resimAdlari.set(resim, ad);
    }
    return this.resimAdlari.get(resim);
  }

  /** (x, y) = ilk satırın taban çizgisinin sol ucu. aci: derece (saat yönünün tersi). */
  metin({ font, metin, boyut, x, y, aci = 0, renk = '#000000', opaklik = 1, satirAraligi = 1.2 }) {
    const { r, g, b } = renkCoz(renk);
    const fAd = this._fontAdi(font);
    const gs = this._opaklikAdi(opaklik);
    const t = (aci * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    const satirlar = String(metin).split('\n');
    const op = ['q'];
    if (gs) op.push(`/${gs} gs`);
    op.push(`${sayi(r)} ${sayi(g)} ${sayi(b)} rg`);
    op.push(`${sayi(c)} ${sayi(s)} ${sayi(-s)} ${sayi(c)} ${sayi(x)} ${sayi(y)} cm`);
    satirlar.forEach((satir, i) => {
      if (satir === '') return;
      op.push('BT', `/${fAd} ${sayi(boyut)} Tf`, `1 0 0 1 0 ${sayi(-i * boyut * satirAraligi)} Tm`,
        `${font.encodeText(satir).toString()} Tj`, 'ET');
    });
    op.push('Q');
    this.ops.push(op.join('\n'));
  }

  /**
   * GÖRÜNMEZ yazı (çizim kipi 3): ekranda hiçbir şey çizmez ama aranabilir/seçilebilir. OCR katmanı için.
   * (x, y) = taban çizgisinin sol ucu; genislik verilirse yazı bu genişliğe (Tz ile) oturtulur.
   * Sonuna bir boşluk eklenir ki metin kopyalanırken kelimeler yapışmasın.
   */
  gorunmezMetin({ font, metin, boyut, x, y, genislik = 0 }) {
    const fAd = this._fontAdi(font);
    const olculen = font.widthOfTextAtSize(metin, boyut);
    const tz = genislik > 0 && olculen > 0 ? Math.max(10, Math.min(400, (genislik / olculen) * 100)) : 100;
    this.ops.push(['BT', '3 Tr', `/${fAd} ${sayi(boyut)} Tf`, `${sayi(tz)} Tz`, `1 0 0 1 ${sayi(x)} ${sayi(y)} Tm`,
      `${font.encodeText(`${metin} `).toString()} Tj`, 'ET'].join('\n'));
  }

  /** Sol-alt köşesi (x, y), boyutu (w, h) olan resim. aci: sol-alt köşe etrafında döndürme. */
  resim({ resim, x, y, w, h, aci = 0, opaklik = 1 }) {
    const ad = this._resimAdi(resim);
    const gs = this._opaklikAdi(opaklik);
    const t = (aci * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    const op = ['q'];
    if (gs) op.push(`/${gs} gs`);
    op.push(`${sayi(c)} ${sayi(s)} ${sayi(-s)} ${sayi(c)} ${sayi(x)} ${sayi(y)} cm`);
    op.push(`${sayi(w)} 0 0 ${sayi(h)} 0 0 cm`, `/${ad} Do`, 'Q');
    this.ops.push(op.join('\n'));
  }

  dikdortgen({ x, y, w, h, dolgu = null, cizgi = null, cizgiKalinligi = 1, opaklik = 1 }) {
    if (!dolgu && !cizgi) return;
    const gs = this._opaklikAdi(opaklik);
    const op = ['q'];
    if (gs) op.push(`/${gs} gs`);
    if (dolgu) { const { r, g, b } = renkCoz(dolgu); op.push(`${sayi(r)} ${sayi(g)} ${sayi(b)} rg`); }
    if (cizgi) { const { r, g, b } = renkCoz(cizgi); op.push(`${sayi(r)} ${sayi(g)} ${sayi(b)} RG`, `${sayi(cizgiKalinligi)} w`); }
    op.push(`${sayi(x)} ${sayi(y)} ${sayi(w)} ${sayi(h)} re`, dolgu && cizgi ? 'B' : dolgu ? 'f' : 'S', 'Q');
    this.ops.push(op.join('\n'));
  }

  /** Biriken çizimleri sayfaya işaretli bir içerik akışı olarak ekler. katman: 'ust' | 'alt' */
  bitir(katman = 'ust') {
    if (!this.ops.length) return false;
    const { islem } = this;
    const [a, b, c, d, e, f] = this.gorunur.m;
    const govde = [`q`, `${sayi(a)} ${sayi(b)} ${sayi(c)} ${sayi(d)} ${sayi(e)} ${sayi(f)} cm`, ...this.ops, 'Q'].join('\n');
    const baslik = `${MARKA} tur=${islem.tur} id=${islem.kimlik} kaynak=${this.kaynaklar.join(';')}\n`;
    const ref = this.ctx.register(this.ctx.stream(baslik + govde + '\n'));
    const dizi = icerikDizisi(this.page);
    if (katman === 'alt') {
      dizi.insert(0, ref);
    } else {
      dizi.insert(0, islem.qRef);
      dizi.push(islem.QRef);
      dizi.push(ref);
    }
    return true;
  }
}

// ---- Eklenenleri bulma / geri alma ---------------------------------------------------------------

function ilkBaytlar(nesne) {
  if (!(nesne instanceof PDFRawStream)) return null;
  if (nesne.dict.has(PDFName.of('Filter'))) return null; // bizim akışlarımız sıkıştırılmaz
  return new TextDecoder('latin1').decode(nesne.contents.subarray(0, 4096));
}

function isaretCoz(metin) {
  if (!metin || !metin.startsWith(MARKA)) return null;
  const satir = metin.split('\n', 1)[0];
  const tur = /\btur=(\S+)/.exec(satir)?.[1];
  const id = /\bid=(\S+)/.exec(satir)?.[1];
  const kaynak = /\bkaynak=(\S*)/.exec(satir)?.[1] ?? '';
  if (!tur || !id) return null;
  return { tur, id, kaynak: kaynak ? kaynak.split(';') : [] };
}

/** Belgede, bu program tarafından eklenmiş, belirtilen türdeki içerik akışlarını bulur. */
export function eklenenleriBul(doc, tur) {
  const ctx = doc.context;
  const bulunan = [];
  doc.getPages().forEach((page, sayfaNo) => {
    const dizi = page.node.Contents();
    if (!(dizi instanceof PDFArray)) return;
    for (let i = 0; i < dizi.size(); i++) {
      const ref = dizi.get(i);
      if (!(ref instanceof PDFRef)) continue;
      const isaret = isaretCoz(ilkBaytlar(ctx.lookup(ref)));
      if (isaret && isaret.tur === tur) bulunan.push({ sayfaNo, ref, ...isaret });
    }
  });
  return bulunan;
}

function agacSil(ctx, kok) {
  const ziyaret = new Set();
  const yigin = [kok];
  while (yigin.length) {
    const ref = yigin.pop();
    if (!(ref instanceof PDFRef) || ziyaret.has(ref.tag)) continue;
    ziyaret.add(ref.tag);
    const nesne = ctx.lookup(ref);
    if (!nesne) continue;
    const dict = nesne instanceof PDFStream ? nesne.dict : nesne instanceof PDFDict ? nesne : null;
    if (dict) {
      const tip = dict.get(PDFName.of('Type'));
      if (tip instanceof PDFName && ['Page', 'Pages', 'Catalog'].includes(tip.decodeText())) continue; // güvenlik
      for (const v of dict.values()) tara(v, yigin);
    } else if (nesne instanceof PDFArray) {
      for (const v of nesne.asArray()) tara(v, yigin);
    }
    ctx.delete(ref);
  }
}
function tara(v, yigin) {
  if (v instanceof PDFRef) yigin.push(v);
  else if (v instanceof PDFArray) v.asArray().forEach((x) => tara(x, yigin));
  else if (v instanceof PDFDict) for (const x of v.values()) tara(x, yigin);
}

/**
 * Bu program tarafından eklenmiş, belirtilen türdeki içerikleri kaldırır; kullandıkları
 * yazı tipi/resim kaynaklarını da dosyadan siler. Başka kaynaklardan gelen hiçbir şeye dokunmaz.
 * @returns {{kaldirilan:number, sayfa:number}}
 */
export function eklenenleriKaldir(doc, tur) {
  const ctx = doc.context;
  const bulunan = eklenenleriBul(doc, tur);
  if (!bulunan.length) return { kaldirilan: 0, sayfa: 0 };
  const kimlikler = new Set(bulunan.map((b) => b.id));
  const koklerSilinecek = [];
  const sayfalar = new Set();

  doc.getPages().forEach((page, sayfaNo) => {
    const dizi = page.node.Contents();
    if (!(dizi instanceof PDFArray)) return;
    const kaynaklar = page.node.Resources();
    for (let i = dizi.size() - 1; i >= 0; i--) {
      const ref = dizi.get(i);
      if (!(ref instanceof PDFRef)) continue;
      const isaret = isaretCoz(ilkBaytlar(ctx.lookup(ref)));
      if (!isaret || !kimlikler.has(isaret.id)) continue;
      if (isaret.tur === tur) {
        for (const k of isaret.kaynak) {
          const [kategori, ad] = k.split(':');
          const alt = kaynaklar?.lookup(PDFName.of(kategori));
          if (alt instanceof PDFDict) {
            const girdi = alt.get(PDFName.of(ad));
            if (girdi instanceof PDFRef) koklerSilinecek.push(girdi);
            alt.delete(PDFName.of(ad));
          }
        }
        sayfalar.add(sayfaNo);
      }
      if (isaret.tur === tur || isaret.tur === 'sarmal') {
        dizi.remove(i);
        koklerSilinecek.push(ref);
      }
    }
  });
  for (const k of koklerSilinecek) agacSil(ctx, k);
  return { kaldirilan: bulunan.length, sayfa: sayfalar.size };
}

export { PdfHatasi };
