// OCR (taranmış sayfadaki yazıyı okuma) ve görünmez yazı katmanı ekleme.
//
// Taranmış bir PDF'in sayfası aslında bir resimdir. OCR, bu resimdeki yazıyı okur; biz de okunan yazıyı
// sayfanın ÜSTÜNE görünmez olarak (çizim kipi 3) yerleştiririz. Sayfanın görünüşü bire bir aynı kalır,
// ama yazı aranabilir ve kopyalanabilir olur. Tesseract.js, tarayıcıda ve Node'da aynı kodla çalışır;
// ortama özgü kısımlar `ocrOrtamiAyarla` ile dışarıdan verilir.
//
// DÜRÜSTLÜK: OCR hata yapar (özellikle bulanık, eğik, lekeli taramalarda). Okunan yazı yalnızca ARAMA için
// görünmez katman olarak eklenir; belgenin görünen hâline hiçbir zaman otomatik yazı yazılmaz.

import { belgeAc, sayfaCiz, tuvaliBayta, EN_COK_PIKSEL, paralelSayfalar } from './render.js';
import { PDFDocument, degrees } from 'pdf-lib';
import { pdfAc, kaydet } from './belge.js';
import { yeniIslem, SayfaCizici, eklenenleriBul, eklenenleriKaldir } from './cizim.js';
import { yaziTipiGom, yaziTipiOlcer } from './fonts.js';
import { PdfHatasi } from './hatalar.js';
import { sayfaSecimi } from './util.js';
import { egiklikAcisi, tuvaliDondur } from './egiklik.js';
import { iptalKontrol, iptalEdildiMi, iptalDinle, IptalHatasi } from './iptal.js';

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
  const ust = bellek >= 8 ? 8 : bellek > 4 ? 4 : 2;
  return Math.max(1, Math.min(ust, Math.floor(cekirdek * 0.6)));
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
  iptalKontrol();
  if (havuzDili !== null && havuzDili !== dil) await ocrKapat();
  havuzDili = dil;
  for (;;) {
    iptalKontrol();
    const bos = havuz.find((i) => !i.mesgul);
    if (bos) { bos.mesgul = true; return bos; }
    if (havuz.length + olusturuluyor < hedefBoyut) {
      olusturuluyor++;
      try {
        const yeniIsci = await isciOlustur(dil);
        if (iptalEdildiMi()) { try { await yeniIsci.terminate(); } catch { /* kapalı */ } throw new IptalHatasi(); }
        const kayit = { w: yeniIsci, mesgul: true };
        havuz.push(kayit);
        return kayit;
      } catch (e) {
        if (e?.name === 'IptalHatasi') throw e;
        if (iptalEdildiMi()) throw new IptalHatasi();
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

// İptal edilince çalışan OCR işçileri hemen kapatılır (sayfa okuması beklenmez).
iptalDinle(() => { ocrKapat(); });

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
  // İptalde işçi kapatılınca bekleyen recognize hiç dönmeyebilir; bu yüzden iptal sözüyle yarıştırılır.
  let iptalKaldir = () => {};
  const iptalSozu = new Promise((_, red) => { iptalKaldir = iptalDinle(() => red(new IptalHatasi())); });
  iptalSozu.catch(() => {});
  try {
    if (sayfaBolme != null) await w.setParameters({ tessedit_pageseg_mode: String(sayfaBolme) });
    sonuc = await Promise.race([w.recognize(png, {}, { blocks: true, text: true }), iptalSozu]);
  } catch (e) {
    if (iptalEdildiMi()) throw new IptalHatasi(); // iptalde işçiler kapatıldığı için hata normaldir
    throw new PdfHatasi(`OCR çalışırken hata oluştu: ${e?.message ?? e}`, 'OCR');
  } finally {
    iptalKaldir();
    if (!iptalEdildiMi()) { try { if (sayfaBolme != null) await w.setParameters({ tessedit_pageseg_mode: '3' }); } catch { /* işçi kapanmış olabilir */ } }
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
export async function sayfaOcr(belge, no, { dpi = 300, dil = 'tur', donus = 0, egiklikDuzelt = false } = {}) {
  const sayfa = await belge.getPage(no);
  const vp = sayfa.getViewport({ scale: 1, ...(donus ? { rotation: (sayfa.rotate + donus) % 360 } : {}) });
  const d = dpiSinirla(sayfa, dpi);
  sayfa.cleanup();
  const olcek = d / 72;
  let { tuval } = await sayfaCiz(belge, no, { olcek, donus });
  // Eğik tarama: açı bulunur, resim düzeltilir; OKUMA düzeltilmiş resimde yapılır, düzeltilmiş görüntü çağırana verilir.
  let duzeltilmis = null;
  if (egiklikDuzelt) {
    const e = egiklikAcisi(tuval);
    if (Math.abs(e.aci) >= 0.4 && e.guven >= 1.05) {
      tuval = tuvaliDondur(tuval, e.aci);
      duzeltilmis = { aci: e.aci, jpeg: await tuvaliBayta(tuval, 'jpeg', 0.88) };
    }
  }
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
  return { no, genislik: vp.width, yukseklik: vp.height, guven: r.guven, satirlar, kelimeler, metin: r.metin, dpi: d, donus, duzeltilmis };
}

/**
 * Sayfanın dik durması için gereken ek dönüş (0/90/180/270, saat yönü). Önce olduğu gibi okunur; okuma güvenilirse 0 döner.
 * Değilse dört yön düşük çözünürlükte denenir ve belirgin biçimde daha iyi okunan yön seçilir (zayıf sayfada 0 kalır).
 */
export async function sayfaYonuBul(belge, no, { dil = 'tur', dpi = 110 } = {}) {
  const skor = async (donus) => {
    const sayfa = await belge.getPage(no);
    const d = dpiSinirla(sayfa, dpi); sayfa.cleanup();
    const { tuval } = await sayfaCiz(belge, no, { olcek: d / 72, donus });
    const r = await goruntuOcr(await tuvaliBayta(tuval, 'png'), { dil });
    let guven = 0, kelime = 0;
    for (const p of r.paragraflar) for (const s of p.satirlar) for (const w of s.kelimeler) { guven += w.guven * w.metin.length; kelime++; }
    return { skor: guven, kelime, ort: kelime ? guven / kelime : 0 };
  };
  const s0 = await skor(0);
  if (s0.kelime >= 8 && s0.ort >= 120) return 0; // ortalama kelime başına güven×uzunluk yüksekse dik
  let en = { donus: 0, skor: s0.skor, kelime: s0.kelime };
  for (const dn of [90, 180, 270]) { const s = await skor(dn); if (s.skor > en.skor) en = { donus: dn, skor: s.skor, kelime: s.kelime }; }
  return en.donus !== 0 && en.kelime >= 6 && en.skor >= Math.max(1, s0.skor) * 1.6 ? en.donus : 0;
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
export async function pdfOcr(bayt, { sayfalar = '', dpi = 300, dil = 'tur', yaziVarsa = 'atla', yon = 'yok', egiklik = 'yok', yeniden = false, ilerleme } = {}) {
  const uyarilarOn = [];
  if (yeniden) {
    // Bu sitenin daha önce eklediği OCR katmanı silinir; sayfalar yeniden okunur (başka programın katmanına dokunulmaz).
    const eski = await pdfAc(bayt);
    const k = eklenenleriKaldir(eski, 'ocr');
    if (k.kaldirilan) { bayt = await kaydet(eski); uyarilarOn.push(`${k.sayfa} sayfadaki eski OCR katmanı silinip yeniden okundu.`); }
    else uyarilarOn.push('Bu site tarafından eklenmiş bir OCR katmanı bulunamadı; başka programın OCR katmanına dokunulmaz (o sayfalar “zaten yazısı var” sayılıp atlanır).');
  }
  const belge = await belgeAc(bayt);
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    // Sayfalar eşzamanlı okunur (OCR işçi havuzu); sonuçlar sayfa sırasıyla birleştirilir.
    const sonuclar = new Array(secili.length);
    let biten = 0;
    ocrHavuzBoyutu(ocrOnerilenBoyut());
    await paralelSayfalar(bayt, secili.map((x) => x + 1), async (belge, no, k) => {
      ilerleme?.(biten, secili.length, `Sayfa ${no} okunuyor…`);
      if (yaziVarsa === 'atla' && await sayfadaYaziVarMi(belge, no)) {
        sonuclar[k] = { rapor: { no, durum: 'atlandi', kelime: 0, guven: null, dusukGuven: 0 } };
      } else {
        const donus = yon === 'otomatik' ? await sayfaYonuBul(belge, no, { dil }) : 0;
        const s = await sayfaOcr(belge, no, { dpi, dil, donus, egiklikDuzelt: egiklik === 'duzelt' });
        sonuclar[k] = s.kelimeler.length
          ? { rapor: { no, durum: 'tamam', kelime: s.kelimeler.length, guven: Math.round(s.guven), dusukGuven: s.kelimeler.filter((w) => w.guven < 60).length, donus, egiklik: s.duzeltilmis?.aci ?? 0 }, katman: { index: no - 1, kelimeler: s.kelimeler }, donus, duzeltilmis: s.duzeltilmis, boyut: [s.genislik, s.yukseklik] }
          : { rapor: { no, durum: 'bos', kelime: 0, guven: null, dusukGuven: 0 } };
      }
      biten++;
      ilerleme?.(biten, secili.length, `Sayfa ${no} tamam`);
    }, { ilkBelge: belge, sinir: ocrOnerilenBoyut() });
    const rapor = sonuclar.map((x) => x.rapor);
    const katman = sonuclar.filter((x) => x.katman).map((x) => x.katman);
    ilerleme?.(secili.length, secili.length, 'Yazı katmanı ekleniyor…');
    const uyarilar = [...uyarilarOn];
    const atlanan = rapor.filter((r) => r.durum === 'atlandi').map((r) => r.no);
    const bos = rapor.filter((r) => r.durum === 'bos').map((r) => r.no);
    if (atlanan.length) uyarilar.push(`Sayfa ${atlanan.join(', ')} zaten seçilebilir yazı içerdiği için atlandı.`);
    if (bos.length) uyarilar.push(`Sayfa ${bos.join(', ')} içinde okunabilir yazı bulunamadı.`);
    if (!katman.length) return { bayt, rapor, uyarilar, degisti: false };
    let doc = await pdfAc(bayt);
    // Yön ve eğiklik düzeltmeleri, görünmez yazı katmanı eklenmeden ÖNCE uygulanır (koordinatlar düzeltilmiş görünüme göredir).
    const donenler = sonuclar.filter((x) => x.katman && x.donus && !x.duzeltilmis);
    for (const x of donenler) { const p = doc.getPage(x.katman.index); p.setRotation(degrees((p.getRotation().angle + x.donus) % 360)); }
    const duzeltilenler = sonuclar.filter((x) => x.katman && x.duzeltilmis);
    if (duzeltilenler.length) {
      for (const x of duzeltilenler) {
        const i = x.katman.index;
        const yeni = doc.insertPage(i, x.boyut);
        yeni.drawImage(await doc.embedJpg(x.duzeltilmis.jpeg), { x: 0, y: 0, width: x.boyut[0], height: x.boyut[1] });
        doc.removePage(i + 1);
      }
      // Eski sayfa nesneleri (özgün tarama) dosyada artık kullanılmadan kalmasın: yalnızca sayfalar yeni belgeye kopyalanır.
      const temiz = await PDFDocument.create();
      (await temiz.copyPages(doc, doc.getPageIndices())).forEach((p) => temiz.addPage(p));
      doc = temiz;
      uyarilar.push(`${duzeltilenler.length} sayfanın eğikliği düzeltildi (sayfa yeniden resimlendi; o sayfalardaki bağlantı/yer imi gibi öğeler ve belge bilgileri taşınmadı).`);
    }
    if (donenler.length) uyarilar.push(`${donenler.length} sayfa yan/ters duruyordu; dik görünecek şekilde döndürüldü.`);
    await gorunmezKatmanEkle(doc, katman);
    const cikti = await kaydet(doc);
    const dusuk = rapor.reduce((t, r) => t + r.dusukGuven, 0);
    if (dusuk) uyarilar.push(`${dusuk} kelimenin okunma güveni düşük (%60'ın altı). Arama sonuçlarında bu kelimeler eksik çıkabilir.`);
    uyarilar.push(`Okunan yazı görünmezdir ve yalnızca arama/kopyalama içindir${donenler.length || duzeltilenler.length ? ' (yön/eğiklik düzeltilen sayfalar dışında sayfa görünüşü değişmedi)' : '; sayfanın görünüşü değişmedi'}. OCR hata yapabilir (özellikle bulanık ya da eğik taramalarda).`);
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
