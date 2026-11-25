// OCR (taranmış sayfadaki yazıyı okuma) ve görünmez yazı katmanı ekleme.
//
// Taranmış bir PDF'in sayfası aslında bir resimdir. OCR, bu resimdeki yazıyı okur; biz de okunan yazıyı
// sayfanın ÜSTÜNE görünmez olarak (çizim kipi 3) yerleştiririz. Sayfanın görünüşü bire bir aynı kalır,
// ama yazı aranabilir ve kopyalanabilir olur. Tesseract.js, tarayıcıda ve Node'da aynı kodla çalışır;
// ortama özgü kısımlar `ocrOrtamiAyarla` ile dışarıdan verilir.
//
// DÜRÜSTLÜK: OCR hata yapar (özellikle bulanık, eğik, lekeli taramalarda). Okunan yazı yalnızca ARAMA için
// görünmez katman olarak eklenir; belgenin görünen hâline hiçbir zaman otomatik yazı yazılmaz.

import { belgeAc, sayfaCiz, tuvaliBayta, EN_COK_PIKSEL } from './render.js';
import { pdfAc, kaydet } from './belge.js';
import { yeniIslem, SayfaCizici, eklenenleriBul, eklenenleriKaldir } from './cizim.js';
import { yaziTipiGom, yaziTipiOlcer } from './fonts.js';
import { PdfHatasi } from './hatalar.js';
import { sayfaSecimi, eszamanliCalistir } from './util.js';

let ORTAM = null;
/**
 * @param o.createWorker  tesseract.js'in createWorker işlevi
 * @param o.secenekler    createWorker'a verilecek seçenekler (langPath, corePath, workerPath, cacheMethod…)
 */
export function ocrOrtamiAyarla(o) {
  ORTAM = o;
}
export const ocrHazirMi = () => !!ORTAM;

// OCR işçi havuzu: birden çok sayfa AYNI ANDA okunabilsin diye birkaç Tesseract işçisi açılır (işlemci çekirdeklerine göre).
// İşçiler ilk ihtiyaçta, en çok "hedefBoyut" kadar açılır; boşta olan işçi sıradaki sayfayı alır. Tek sayfa kullanımında 1 işçi açılır.
let havuz = []; // { w, mesgul }
let havuzDili = null;
let olusturuluyor = 0;
let hedefBoyut = 1;
const bekleyenler = [];

/** Bu cihaz için önerilen eşzamanlı OCR işçisi sayısı (çekirdek ve bellek sınırlı). */
export function ocrOnerilenBoyut() {
  const cekirdek = globalThis.navigator?.hardwareConcurrency ?? 4;
  const bellek = globalThis.navigator?.deviceMemory ?? 8; // GB; bilinmiyorsa 8 varsay
  const ust = bellek >= 8 ? 6 : bellek > 4 ? 4 : 2;
  return Math.max(1, Math.min(ust, Math.floor(cekirdek / 2)));
}
/** En çok kaç OCR işçisi açılacağını ayarlar (açık olanlar kapatılmaz). */
export function ocrHavuzBoyutu(n) {
  hedefBoyut = Math.max(1, Math.floor(n) || 1);
}

async function isciOlustur(dil) {
  const w = await ORTAM.createWorker(dil, 1, { cacheMethod: 'none', gzip: true, ...ORTAM.secenekler });
  await w.setParameters({ user_defined_dpi: '300', preserve_interword_spaces: '1' });
  return w;
}

/** Boşta bir işçi verir (gerekirse yeni açar, yoksa sıra bekler). Mutlaka isciBirak çağrılmalı. */
async function isciAl(dil) {
  if (!ORTAM) throw new PdfHatasi('OCR bileşeni hazır değil.');
  if (havuzDili !== null && havuzDili !== dil) await ocrKapat();
  havuzDili = dil;
  for (;;) {
    const bos = havuz.find((i) => !i.mesgul);
    if (bos) { bos.mesgul = true; return bos; }
    if (havuz.length + olusturuluyor < hedefBoyut) {
      olusturuluyor++;
      try {
        const kayit = { w: await isciOlustur(dil), mesgul: true };
        havuz.push(kayit);
        return kayit;
      } catch (e) {
        if (!havuz.length) throw new PdfHatasi(`OCR başlatılamadı: ${e?.message ?? e}`, 'OCR');
        // Başka işçi zaten çalışıyor: yeni açılamadıysa onların boşalmasını bekle.
        hedefBoyut = Math.max(1, havuz.length);
      } finally { olusturuluyor--; }
      continue;
    }
    await new Promise((coz) => bekleyenler.push(coz));
  }
}
function isciBirak(kayit) {
  kayit.mesgul = false;
  const siradaki = bekleyenler.shift();
  if (siradaki) siradaki();
}

/** Tüm OCR işçilerini kapatır (bellek serbest kalır). */
export async function ocrKapat() {
  const eski = havuz;
  havuz = [];
  havuzDili = null;
  while (bekleyenler.length) bekleyenler.shift()(); // bekleyenler yeniden dener
  await Promise.all(eski.map(async (i) => { try { await i.w.terminate(); } catch { /* zaten kapalı */ } }));
}

/**
 * Bir resimde (PNG baytları) yazıyı okur.
 * @returns {{metin:string, guven:number, paragraflar:{satirlar:{metin,guven,x0,y0,x1,y1,kelimeler:{metin,guven,x0,y0,x1,y1}[]}[]}[]}}
 *   Koordinatlar PİKSEL cinsindendir, orijin sol-üsttür (y aşağı doğru artar).
 */
export async function goruntuOcr(png, { dil = 'tur', sayfaBolme } = {}) {
  const kayit = await isciAl(dil);
  const w = kayit.w;
  let sonuc;
  try {
    if (sayfaBolme != null) await w.setParameters({ tessedit_pageseg_mode: String(sayfaBolme) });
    sonuc = await w.recognize(png, {}, { blocks: true, text: true });
  } catch (e) {
    throw new PdfHatasi(`OCR çalışırken hata oluştu: ${e?.message ?? e}`, 'OCR');
  } finally {
    try { if (sayfaBolme != null) await w.setParameters({ tessedit_pageseg_mode: '3' }); } catch { /* işçi kapanmış olabilir */ }
    isciBirak(kayit);
  }
  const veri = sonuc.data;
  const kutu = (b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  const paragraflar = [];
  for (const blok of veri.blocks ?? []) {
    for (const p of blok.paragraphs ?? []) {
      const satirlar = [];
      for (const s of p.lines ?? []) {
        const kelimeler = (s.words ?? [])
          .filter((k) => String(k.text ?? '').trim() !== '')
          .map((k) => ({ metin: k.text.trim(), guven: k.confidence, ...kutu(k.bbox) }));
        if (!kelimeler.length) continue;
        satirlar.push({ metin: kelimeler.map((k) => k.metin).join(' '), guven: s.confidence, ...kutu(s.bbox), kelimeler });
      }
      if (satirlar.length) paragraflar.push({ satirlar });
    }
  }
  return { metin: (veri.text ?? '').trim(), guven: veri.confidence ?? 0, paragraflar };
}

/** Piksel → "görünür" sayfa koordinatı (nokta; orijin sol-alt). olcek = nokta başına piksel. */
export function piksldenSayfaya(k, olcek, sayfaYuksekligi) {
  return { x0: k.x0 / olcek, x1: k.x1 / olcek, y0: sayfaYuksekligi - k.y1 / olcek, y1: sayfaYuksekligi - k.y0 / olcek };
}

/** Sayfada (taranmamış, gerçek) yazı var mı? Yaklaşık 20'den az harf varsa "yok" sayılır. */
export async function sayfadaYaziVarMi(belge, sayfaNo) {
  const sayfa = await belge.getPage(sayfaNo);
  const icerik = await sayfa.getTextContent();
  sayfa.cleanup();
  const harf = icerik.items.reduce((t, o) => t + (o.str ?? '').replace(/\s+/g, '').length, 0);
  return harf >= 20;
}

function dpiSinirla(sayfa, dpi) {
  const vp = sayfa.getViewport({ scale: 1 });
  let d = dpi;
  while ((vp.width * d / 72) * (vp.height * d / 72) > EN_COK_PIKSEL * 0.6 && d > 72) d -= 25;
  return Math.max(72, d);
}

/**
 * Tek sayfayı çizer ve okur. Sonuç koordinatları sayfa NOKTASI cinsindendir (orijin: görünür sol-alt).
 * @returns {{no, genislik, yukseklik, guven, satirlar:{metin,guven,x0,y0,x1,y1,paragraf,kelimeler}[], kelimeler:[], dpi}}
 */
export async function sayfaOcr(belge, no, { dpi = 300, dil = 'tur' } = {}) {
  const sayfa = await belge.getPage(no);
  const vp = sayfa.getViewport({ scale: 1 });
  const d = dpiSinirla(sayfa, dpi);
  sayfa.cleanup();
  const olcek = d / 72;
  const { tuval } = await sayfaCiz(belge, no, { olcek });
  const png = await tuvaliBayta(tuval, 'png');
  const r = await goruntuOcr(png, { dil });
  const satirlar = [];
  const kelimeler = [];
  r.paragraflar.forEach((p, pi) => {
    for (const s of p.satirlar) {
      const k = piksldenSayfaya(s, olcek, vp.height);
      const ks = s.kelimeler.map((w) => ({ metin: w.metin, guven: w.guven, ...piksldenSayfaya(w, olcek, vp.height) }));
      satirlar.push({ metin: s.metin, guven: s.guven, ...k, paragraf: pi, kelimeler: ks });
      kelimeler.push(...ks);
    }
  });
  return { no, genislik: vp.width, yukseklik: vp.height, guven: r.guven, satirlar, kelimeler, metin: r.metin, dpi: d };
}

/**
 * Görünmez yazı katmanını ekler (yerinde). kelimeler: görünür koordinatlı {metin,x0,y0,x1,y1}.
 * Yazı tipinde olmayan karakterler atlanır (sessizce kutu çizilmez).
 * @param sayfaKelimeleri [{ index:0 tabanlı sayfa, kelimeler:[...] }]
 * @returns {Promise<number>} yazılan kelime sayısı
 */
export async function gorunmezKatmanEkle(doc, sayfaKelimeleri, { aile = 'noto-sans', tur = 'ocr' } = {}) {
  const font = await yaziTipiGom(doc, aile);
  const olcer = await yaziTipiOlcer(aile);
  const islem = yeniIslem(doc, tur);
  let toplam = 0;
  for (const { index, kelimeler } of sayfaKelimeleri) {
    const page = doc.getPage(index);
    const c = new SayfaCizici(islem, page);
    for (const k of kelimeler) {
      const eksik = new Set(olcer.eksik(k.metin));
      const metin = [...k.metin].filter((ch) => !eksik.has(ch) && ch >= ' ').join('').trim();
      if (!metin) continue;
      const yuk = k.y1 - k.y0;
      const boyut = Math.max(2, Math.min(200, yuk * 0.8));
      c.gorunmezMetin({ font, metin, boyut, x: k.x0, y: k.y0 + yuk * 0.2, genislik: k.x1 - k.x0 });
      toplam++;
    }
    c.bitir('ust');
  }
  return toplam;
}

/**
 * Taranmış PDF'i aranabilir yapar: her sayfayı okur, okunan yazıyı görünmez katman olarak ekler.
 * @param secenek.sayfalar   "1-3,5" (boş = hepsi)
 * @param secenek.yaziVarsa  'atla' (varsayılan: zaten yazısı olan sayfaya dokunma) | 'yine'
 * @returns {{bayt, rapor:{no,durum,kelime,guven,dusukGuven}[], uyarilar:string[]}}
 */
export async function pdfOcr(bayt, { sayfalar = '', dpi = 300, dil = 'tur', yaziVarsa = 'atla', ilerleme } = {}) {
  const belge = await belgeAc(bayt);
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    // Sayfalar eşzamanlı okunur (OCR işçi havuzu); sonuçlar sayfa sırasıyla birleştirilir.
    const sonuclar = new Array(secili.length);
    let biten = 0;
    ocrHavuzBoyutu(ocrOnerilenBoyut());
    await eszamanliCalistir(secili.length, ocrOnerilenBoyut(), async (k) => {
      const no = secili[k] + 1;
      ilerleme?.(biten, secili.length, `Sayfa ${no} okunuyor…`);
      if (yaziVarsa === 'atla' && await sayfadaYaziVarMi(belge, no)) {
        sonuclar[k] = { rapor: { no, durum: 'atlandi', kelime: 0, guven: null, dusukGuven: 0 } };
      } else {
        const s = await sayfaOcr(belge, no, { dpi, dil });
        sonuclar[k] = s.kelimeler.length
          ? { rapor: { no, durum: 'tamam', kelime: s.kelimeler.length, guven: Math.round(s.guven), dusukGuven: s.kelimeler.filter((w) => w.guven < 60).length }, katman: { index: no - 1, kelimeler: s.kelimeler } }
          : { rapor: { no, durum: 'bos', kelime: 0, guven: null, dusukGuven: 0 } };
      }
      biten++;
      ilerleme?.(biten, secili.length, `Sayfa ${no} tamam`);
    });
    const rapor = sonuclar.map((x) => x.rapor);
    const katman = sonuclar.filter((x) => x.katman).map((x) => x.katman);
    ilerleme?.(secili.length, secili.length, 'Yazı katmanı ekleniyor…');
    const uyarilar = [];
    const atlanan = rapor.filter((r) => r.durum === 'atlandi').map((r) => r.no);
    const bos = rapor.filter((r) => r.durum === 'bos').map((r) => r.no);
    if (atlanan.length) uyarilar.push(`Sayfa ${atlanan.join(', ')} zaten seçilebilir yazı içerdiği için atlandı.`);
    if (bos.length) uyarilar.push(`Sayfa ${bos.join(', ')} içinde okunabilir yazı bulunamadı.`);
    if (!katman.length) return { bayt, rapor, uyarilar, degisti: false };
    const doc = await pdfAc(bayt);
    await gorunmezKatmanEkle(doc, katman);
    const cikti = await kaydet(doc);
    const dusuk = rapor.reduce((t, r) => t + r.dusukGuven, 0);
    if (dusuk) uyarilar.push(`${dusuk} kelimenin okunma güveni düşük (%60'ın altı). Arama sonuçlarında bu kelimeler eksik çıkabilir.`);
    uyarilar.push('Okunan yazı görünmezdir ve yalnızca arama/kopyalama içindir; sayfanın görünüşü değişmedi. OCR hata yapabilir (özellikle bulanık ya da eğik taramalarda).');
    return { bayt: cikti, rapor, uyarilar, degisti: true };
  } finally {
    await belge.kapat();
  }
}

const OCR_BLOK = /BT\n3 Tr\n[^\n]*\n[^\n]*\n1 0 0 1 (\S+) (\S+) Tm\n[^\n]*\nET\n?/g;

/**
 * Bu programın eklediği OCR katmanında, verilen bölgelerin içinde başlayan kelimeleri siler (yalnızca o sayfada).
 * Bölgesi düzeltilen taranmış belgede eski (yanlış) yazının arama katmanında kalmaması için.
 * @param kutular görünür koordinatlı [{x0,y0,x1,y1}]
 * @returns {number} silinen kelime sayısı
 */
export function ocrKatmanindanCikar(doc, sayfaIndeksi, kutular) {
  const ctx = doc.context;
  let silinen = 0;
  for (const b of eklenenleriBul(doc, 'ocr').filter((x) => x.sayfaNo === sayfaIndeksi)) {
    const nesne = ctx.lookup(b.ref);
    if (!nesne?.contents) continue;
    const metin = new TextDecoder('latin1').decode(nesne.contents);
    const yeni = metin.replace(OCR_BLOK, (blok, xs, ys) => {
      const x = Number(xs), y = Number(ys);
      const icinde = kutular.some((k) => x >= k.x0 - 1 && x <= k.x1 + 1 && y >= k.y0 - 2 && y <= k.y1 + 2);
      if (icinde) silinen++;
      return icinde ? '' : blok;
    });
    if (yeni !== metin) ctx.assign(b.ref, ctx.stream(yeni));
  }
  return silinen;
}

/** OCR katmanını (yalnızca bu programın eklediğini) kaldırır. */
export async function ocrKatmaniniKaldir(bayt) {
  const doc = await pdfAc(bayt);
  const r = eklenenleriKaldir(doc, 'ocr');
  return { bayt: r.kaldirilan ? await kaydet(doc) : bayt, kaldirilan: r.kaldirilan, sayfa: r.sayfa };
}
