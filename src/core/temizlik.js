// Üstveri, gizli bilgi temizliği, formu düzleştirme, açıklama ve resim kaldırma.
// Kaldırılan her şey dosyadan GERÇEKTEN silinir: erişilemeyen nesneler temizlenir (pdf-lib normalde yetim nesneleri dosyada bırakır).
import { PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, PDFStream, PDFString, PDFHexString, decodePDFRawStream } from 'pdf-lib';
import { pdfAc, kaydet } from './belge.js';
import { kullanilmayanlariSil } from './yazi/yeniden.js';
import { akisCoz } from './yazi/akis.js';
import { PdfHatasi } from './hatalar.js';

const ad = (s) => PDFName.of(s);
const ara = (ctx, v) => (v instanceof PDFRef ? ctx.lookup(v) : v);

// ---- Üstveri --------------------------------------------------------------------------------------
export async function ustveriOku(bayt) {
  const doc = await pdfAc(bayt);
  const t = (d) => (d ? d.toISOString() : '');
  return {
    baslik: doc.getTitle() ?? '', yazar: doc.getAuthor() ?? '', konu: doc.getSubject() ?? '',
    anahtar: (doc.getKeywords() ?? ''), olusturan: doc.getCreator() ?? '', uretici: doc.getProducer() ?? '',
    olusturma: t(doc.getCreationDate()), degistirme: t(doc.getModificationDate()),
    xmp: !!doc.catalog.get(ad('Metadata')), sayfa: doc.getPageCount(),
    javascript: javascriptSay(doc), ek: ekSay(doc),
  };
}

function ekSay(doc) {
  const ctx = doc.context; let n = 0;
  const adlar = ara(ctx, doc.catalog.get(ad('Names')));
  const ef = adlar instanceof PDFDict ? ara(ctx, adlar.get(ad('EmbeddedFiles'))) : null;
  if (ef instanceof PDFDict) { const dizi = ara(ctx, ef.get(ad('Names'))); if (dizi instanceof PDFArray) n += Math.floor(dizi.size() / 2); else n += 1; }
  for (const p of doc.getPages()) for (const a of aciklamalar(doc, p)) if (a.get(ad('Subtype'))?.toString() === '/FileAttachment') n++;
  return n;
}
function javascriptSay(doc) {
  const ctx = doc.context; let n = 0;
  const adlar = ara(ctx, doc.catalog.get(ad('Names')));
  if (adlar instanceof PDFDict && adlar.get(ad('JavaScript'))) n++;
  const oa = ara(ctx, doc.catalog.get(ad('OpenAction')));
  if (oa instanceof PDFDict && oa.get(ad('S'))?.toString() === '/JavaScript') n++;
  for (const p of doc.getPages()) for (const a of aciklamalar(doc, p)) { if (a.get(ad('AA'))) n++; const e = ara(ctx, a.get(ad('A'))); if (e instanceof PDFDict && e.get(ad('S'))?.toString() === '/JavaScript') n++; }
  return n;
}
function aciklamalar(doc, page) {
  const ctx = doc.context;
  const dizi = ara(ctx, page.node.get(ad('Annots')));
  if (!(dizi instanceof PDFArray)) return [];
  return dizi.asArray().map((r) => ara(ctx, r)).filter((x) => x instanceof PDFDict);
}

/**
 * @param alanlar  { baslik, yazar, konu, anahtar, olusturan } (verilenler yazılır; undefined dokunmaz)
 * @param temizle  { tumUstveri, xmp, javascript, ekler, kucukResim, ozelVeri }
 * @returns {{bayt, uyarilar, ozet}}
 */
export async function ustveriYaz(bayt, { alanlar = {}, temizle = {} } = {}) {
  const doc = await pdfAc(bayt);
  const ctx = doc.context;
  const ozet = [];
  if (temizle.tumUstveri) {
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator('');
    for (const k of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'CreationDate']) doc.context.lookup(doc.context.trailerInfo.Info)?.delete?.(ad(k));
    ozet.push('belge bilgileri (başlık, yazar, konu, anahtar sözcük…) boşaltıldı');
  } else {
    if (alanlar.baslik !== undefined) doc.setTitle(alanlar.baslik);
    if (alanlar.yazar !== undefined) doc.setAuthor(alanlar.yazar);
    if (alanlar.konu !== undefined) doc.setSubject(alanlar.konu);
    if (alanlar.anahtar !== undefined) doc.setKeywords(String(alanlar.anahtar).split(/[,;]+/).map((x) => x.trim()).filter(Boolean));
    if (alanlar.olusturan !== undefined) doc.setCreator(alanlar.olusturan);
  }
  if (temizle.xmp && doc.catalog.has(ad('Metadata'))) { doc.catalog.delete(ad('Metadata')); ozet.push('XMP üstverisi silindi'); }
  if (temizle.javascript) {
    let n = javascriptSay(doc);
    const adlar = ara(ctx, doc.catalog.get(ad('Names')));
    if (adlar instanceof PDFDict) adlar.delete(ad('JavaScript'));
    doc.catalog.delete(ad('OpenAction')); doc.catalog.delete(ad('AA'));
    for (const p of doc.getPages()) {
      p.node.delete(ad('AA'));
      for (const a of aciklamalar(doc, p)) { a.delete(ad('AA')); const e = ara(ctx, a.get(ad('A'))); if (e instanceof PDFDict && e.get(ad('S'))?.toString() === '/JavaScript') a.delete(ad('A')); }
    }
    if (n) ozet.push(`${n} JavaScript öğesi silindi`);
  }
  if (temizle.ekler) {
    const n = ekSay(doc);
    const adlar = ara(ctx, doc.catalog.get(ad('Names')));
    if (adlar instanceof PDFDict) adlar.delete(ad('EmbeddedFiles'));
    doc.catalog.delete(ad('AF'));
    for (const p of doc.getPages()) {
      const dizi = ara(ctx, p.node.get(ad('Annots')));
      if (dizi instanceof PDFArray) {
        for (let i = dizi.size() - 1; i >= 0; i--) { const a = ara(ctx, dizi.get(i)); if (a instanceof PDFDict && a.get(ad('Subtype'))?.toString() === '/FileAttachment') dizi.remove(i); }
      }
    }
    if (n) ozet.push(`${n} gömülü dosya/ek silindi`);
  }
  if (temizle.kucukResim) for (const p of doc.getPages()) p.node.delete(ad('Thumb'));
  if (temizle.ozelVeri) { doc.catalog.delete(ad('PieceInfo')); for (const p of doc.getPages()) p.node.delete(ad('PieceInfo')); }
  const silinen = kullanilmayanlariSil(doc);
  const cikti = await kaydet(doc);
  return {
    bayt: cikti, ozet,
    uyarilar: [
      'Çıktıdaki “Üretici” alanına dürüstçe bu sitenin adı yazılır ve değiştirilme tarihi güncellenir; bu iki alan boşaltılamaz.',
      ...(silinen ? [`${silinen} kullanılmayan nesne dosyadan tamamen silindi.`] : []),
      ...(temizle.tumUstveri || temizle.xmp ? ['Üstveri temizliği, belgenin İÇERİĞİNDEKİ yazıları (ör. gövdedeki yazar adı) ya da resimlerin EXIF bilgisini silmez.'] : []),
    ],
  };
}

// ---- Formu düzleştir -------------------------------------------------------------------------------
export async function formuDuzlestir(bayt) {
  const doc = await pdfAc(bayt);
  const form = doc.getForm();
  const alanSayisi = form.getFields().length;
  if (!alanSayisi) return { bayt, degisti: false, alan: 0, uyarilar: [] };
  form.flatten();
  const silinen = kullanilmayanlariSil(doc);
  return { bayt: await kaydet(doc), degisti: true, alan: alanSayisi, uyarilar: ['Form alanları artık doldurulamaz; değerler sayfaya yazı olarak işlendi.', ...(silinen ? [] : [])] };
}

// ---- Açıklamaları (notlar, vurgular, bağlantılar…) kaldır ---------------------------------------------
const TUR_GRUPLARI = {
  yorum: ['Text', 'FreeText', 'Popup', 'Stamp', 'Caret', 'Ink', 'Line', 'Square', 'Circle', 'Polygon', 'PolyLine', 'Sound', 'Redact'],
  vurgu: ['Highlight', 'Underline', 'StrikeOut', 'Squiggly'],
  baglanti: ['Link'],
  dosyaEki: ['FileAttachment'],
  form: ['Widget'],
};
/** @param turler ['yorum','vurgu','baglanti','dosyaEki','form']  */
export async function aciklamalariKaldir(bayt, { turler = ['yorum', 'vurgu'] } = {}) {
  const doc = await pdfAc(bayt);
  const ctx = doc.context;
  const kaldirilacak = new Set(turler.flatMap((t) => TUR_GRUPLARI[t] ?? []));
  const sayac = {}; let toplam = 0;
  for (const p of doc.getPages()) {
    const dizi = ara(ctx, p.node.get(ad('Annots')));
    if (!(dizi instanceof PDFArray)) continue;
    for (let i = dizi.size() - 1; i >= 0; i--) {
      const a = ara(ctx, dizi.get(i));
      const tur = a instanceof PDFDict ? a.get(ad('Subtype'))?.toString().slice(1) : null;
      if (tur && kaldirilacak.has(tur)) { dizi.remove(i); sayac[tur] = (sayac[tur] ?? 0) + 1; toplam++; }
    }
    if (dizi.size() === 0) p.node.delete(ad('Annots'));
  }
  if (!toplam) return { bayt, degisti: false, toplam: 0, sayac, uyarilar: [] };
  const uyarilar = [];
  if (turler.includes('form')) uyarilar.push('Form alanları kaldırıldı; belgedeki AcroForm tanımı kullanılmayan alanlarla kalmış olabilir.');
  kullanilmayanlariSil(doc);
  return { bayt: await kaydet(doc), degisti: true, toplam, sayac, uyarilar };
}

// ---- Resimleri kaldır --------------------------------------------------------------------------------
function resimAdlari(ctx, kaynak) {
  const adlar = new Set(), formlar = [];
  const xo = ara(ctx, kaynak?.get?.(ad('XObject')));
  if (xo instanceof PDFDict) {
    for (const [k, v] of xo.entries()) {
      const nesne = ara(ctx, v);
      const d = nesne instanceof PDFStream ? nesne.dict : nesne;
      const alt = d?.get?.(ad('Subtype'))?.toString();
      if (alt === '/Image') adlar.add(k.toString().slice(1));
      else if (alt === '/Form' && v instanceof PDFRef) formlar.push(v);
    }
  }
  return { adlar, formlar };
}
function resimTanimlariniSil(ctx, kaynak, adlar) {
  const xo = ara(ctx, kaynak?.get?.(ad('XObject')));
  if (xo instanceof PDFDict) for (const a of adlar) xo.delete(ad(a));
}
function akisBayti(nesne) {
  if (nesne instanceof PDFRawStream) return decodePDFRawStream(nesne).decode();
  return nesne.getContents?.() ?? new Uint8Array();
}
/** Bir içerik akışından resim çizim komutlarını (Do + satır içi) çıkarır. */
function akistanResimSil(bayt, resimAd) {
  const op = akisCoz(bayt);
  const sil = [];
  for (const o of op) {
    if (o.op === 'BI') sil.push([o.bas, o.son]);
    else if (o.op === 'Do' && o.args[0]?.t === 'ad' && resimAd.has(o.args[0].v)) sil.push([o.bas, o.son]);
  }
  if (!sil.length) return { bayt, adet: 0 };
  const parca = []; let konum = 0;
  for (const [b, s] of sil) { parca.push(bayt.subarray(konum, b)); parca.push(new Uint8Array([10])); konum = s; }
  parca.push(bayt.subarray(konum));
  const n = parca.reduce((t, p) => t + p.length, 0), cikti = new Uint8Array(n);
  let k = 0; for (const p of parca) { cikti.set(p, k); k += p.length; }
  return { bayt: cikti, adet: sil.length };
}
export async function resimleriKaldir(bayt) {
  const doc = await pdfAc(bayt);
  const ctx = doc.context;
  let toplam = 0, formResmi = 0;
  const gorulen = new Set();
  const formIsle = (ref) => {
    if (gorulen.has(ref.tag)) return; gorulen.add(ref.tag);
    const f = ctx.lookup(ref);
    if (!(f instanceof PDFStream)) return;
    const { adlar, formlar } = resimAdlari(ctx, ara(ctx, f.dict.get(ad('Resources'))));
    const formKaynak = ara(ctx, f.dict.get(ad('Resources')));
    const s = akistanResimSil(akisBayti(f), adlar);
    if (s.adet) {
      resimTanimlariniSil(ctx, formKaynak, adlar);
      const d = PDFDict.withContext(ctx);
      for (const [k, v] of f.dict.entries()) { const n = k.toString(); if (!['/Filter', '/DecodeParms', '/Length'].includes(n)) d.set(k, v); }
      ctx.assign(ref, PDFRawStream.of(d, s.bayt)); toplam += s.adet; formResmi += s.adet;
    }
    formlar.forEach(formIsle);
  };
  for (const p of doc.getPages()) {
    const kaynak = ara(ctx, p.node.Resources());
    const { adlar, formlar } = resimAdlari(ctx, kaynak);
    const icerik = ara(ctx, p.node.get(ad('Contents')));
    const refler = icerik instanceof PDFArray ? icerik.asArray() : (p.node.get(ad('Contents')) ? [p.node.get(ad('Contents'))] : []);
    const yeniler = []; let degisti = false;
    for (const r of refler) {
      const nesne = ara(ctx, r);
      if (!(nesne instanceof PDFStream)) { yeniler.push(r); continue; }
      const s = akistanResimSil(akisBayti(nesne), adlar);
      if (s.adet) { yeniler.push(ctx.register(ctx.stream(s.bayt))); toplam += s.adet; degisti = true; } else yeniler.push(r);
    }
    if (degisti) p.node.set(ad('Contents'), ctx.obj(yeniler));
    formlar.forEach(formIsle);
    resimTanimlariniSil(ctx, kaynak, adlar);
  }
  if (!toplam) return { bayt, degisti: false, adet: 0, uyarilar: ['Sayfa içeriğinde kaldırılacak resim bulunamadı (resimler desen, gölgeleme ya da açıklama içinde olabilir).'] };
  kullanilmayanlariSil(doc);
  return {
    bayt: await kaydet(doc), degisti: true, adet: toplam,
    uyarilar: [`${toplam} resim çizimi kaldırıldı${formResmi ? ` (${formResmi} tanesi iç içe form nesnelerinde)` : ''}. Resim verisi dosyadan da silindi. Desen/gölgeleme içindeki ya da açıklama (not) görünümlerindeki resimler kaldırılmaz.`],
  };
}

export { PdfHatasi };
