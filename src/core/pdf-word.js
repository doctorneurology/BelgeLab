// PDF → Word (.docx). "En iyi çaba" dönüştürücü: paragrafları, başlıkları (yazı boyutundan), resimleri,
// madde işaretlerini ve düzenli hizalı basit tabloları aktarır. Taranmış sayfalarda önce OCR kullanılır.
//
// DÜRÜSTLÜK: PDF "sayfa üzerine yerleştirilmiş yazı parçaları"dır; Word ise "akan metin"dir. Bu yüzden
// karmaşık düzenlerde (iç içe tablo, metin kutuları, formüller, sayfa düzeni sanatı) sonuç ORİJİNALİN AYNISI olmaz.
// Burada yapılan her tahmin (sütun, tablo, başlık, birleştirilen tireli kelime…) sonuçta `uyarilar`/`bilgi` içinde bildirilir.

import { belgeAc } from './render.js';
import { sayfaYazilari, sayfaResimleri } from './sayfa-icerik.js';
import { sayfaOcr, sayfadaYaziVarMi } from './ocr.js';
import { sayfaSecimi } from './util.js';
import { PdfHatasi } from './hatalar.js';

const ORTANCA = (d) => { if (!d.length) return 0; const s = [...d].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const YUZDELIK = (d, p) => { if (!d.length) return 0; const s = [...d].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const CUMLE_SONU = /[.!?:;…”"»)\]]\s*$/;
const MADDE = /^\s*[•●▪◦‣·▪●•]\s*/;

// ---------------------------------------------------------------------------------------------------------
// 1) Parçalardan satır kurma
// ---------------------------------------------------------------------------------------------------------

/** Aynı taban çizgisindeki parçaları satırlara birleştirir. parcalar: {metin,x0,x1,y,boyut,kalin,italik,sabit,serifli,kelime?,paragraf?} */
export function satirlariKur(parcalar) {
  const sirali = [...parcalar].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const gruplar = [];
  for (const p of sirali) {
    const g = gruplar.find((x) => Math.abs(x.y - p.y) <= 0.4 * Math.max(x.boyut, p.boyut));
    if (g) { g.parcalar.push(p); g.boyut = Math.max(g.boyut, p.boyut); } else gruplar.push({ y: p.y, boyut: p.boyut, parcalar: [p] });
  }
  return gruplar.map((g) => {
    const ps = g.parcalar.sort((a, b) => a.x0 - b.x0);
    const runs = [];
    const segmentler = [];
    let onceki = null;
    let seg = null;
    for (const p of ps) {
      let metin = p.metin;
      if (onceki) {
        const bosluk = p.x0 - onceki.x1;
        const yapisik = /\s$/.test(onceki.metin) || /^\s/.test(metin);
        if (!yapisik && (p.kelime || onceki.kelime || bosluk > 0.12 * Math.min(p.boyut, onceki.boyut))) metin = ` ${metin}`;
        if (bosluk >= 1.5 * Math.max(p.boyut, onceki.boyut)) { segmentler.push(seg); seg = null; }
      }
      const son = runs[runs.length - 1];
      const bicim = { kalin: p.kalin, italik: p.italik, sabit: p.sabit, serifli: p.serifli, boyut: Math.round(p.boyut * 2) / 2, url: p.url };
      if (son && son.kalin === bicim.kalin && son.italik === bicim.italik && son.sabit === bicim.sabit && son.boyut === bicim.boyut && son.url === bicim.url) son.metin += metin;
      else runs.push({ metin, ...bicim });
      if (!seg) seg = { x0: p.x0, x1: p.x1, metin: p.metin.trimStart() };
      else { seg.x1 = p.x1; seg.metin += metin; }
      onceki = p;
    }
    if (seg) segmentler.push(seg);
    const metin = runs.map((r) => r.metin).join('').replace(/\s+/g, ' ').trim();
    // satırın baskın boyutu: harf sayısına göre ağırlıklı
    const agirlik = new Map();
    for (const r of runs) agirlik.set(r.boyut, (agirlik.get(r.boyut) ?? 0) + r.metin.length);
    const boyut = [...agirlik.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.boyut;
    return {
      x0: ps[0].x0, x1: Math.max(...ps.map((p) => p.x1)), y: g.y, boyut, runs, metin, segmentler,
      paragraf: ps[0].paragraf, tamBoyut: g.boyut,
    };
  }).filter((l) => l.metin);
}

// ---------------------------------------------------------------------------------------------------------
// 2) Sütun (iki sütunlu sayfa) tespiti
// ---------------------------------------------------------------------------------------------------------

export function sutunAyiraciBul(parcalar, genislik) {
  if (parcalar.length < 20) return null;
  const kutu = new Uint16Array(Math.ceil(genislik) + 2);
  for (const p of parcalar) for (let x = Math.max(0, Math.floor(p.x0)); x <= Math.min(kutu.length - 1, Math.ceil(p.x1)); x++) kutu[x]++;
  const tol = Math.max(1, Math.floor(parcalar.length * 0.03));
  let en = null;
  for (let x = Math.floor(genislik * 0.3); x <= Math.floor(genislik * 0.7);) {
    if (kutu[x] > tol) { x++; continue; }
    let y = x;
    while (y <= genislik * 0.7 && kutu[y + 1] <= tol) y++;
    if (y - x >= 8 && (!en || y - x > en.g)) en = { x0: x, x1: y, g: y - x };
    x = y + 1;
  }
  if (!en) return null;
  const merkez = (en.x0 + en.x1) / 2;
  const kesen = parcalar.filter((p) => p.x0 < en.x0 && p.x1 > en.x1);
  if (kesen.length > parcalar.length * 0.15) return null;
  const sol = parcalar.filter((p) => p.x1 <= en.x0 + 1);
  const sag = parcalar.filter((p) => p.x0 >= en.x1 - 1);
  if (sol.length < parcalar.length * 0.25 || sag.length < parcalar.length * 0.25) return null;
  // iki yan da "akan yazı" olmalı (tablo hücreleri kısa satırlardır)
  const ortUzunluk = (ps) => { const s = satirlariKur(ps); return s.length ? s.reduce((t, l) => t + l.metin.length, 0) / s.length : 0; };
  if (ortUzunluk(sol) < 28 || ortUzunluk(sag) < 28) return null;
  return { x0: en.x0, x1: en.x1, merkez };
}

// ---------------------------------------------------------------------------------------------------------
// 3) Tablo tespiti (hizalı sütunlardan)
// ---------------------------------------------------------------------------------------------------------

const kesisim = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);

function tabloKur(satirlar) {
  const kolonlar = [];
  const segs = satirlar.flatMap((l) => l.segmentler).sort((a, b) => a.x0 - b.x0);
  for (const s of segs) {
    const k = kolonlar.find((c) => kesisim(c, s) > 0);
    if (k) { k.x0 = Math.min(k.x0, s.x0); k.x1 = Math.max(k.x1, s.x1); } else kolonlar.push({ x0: s.x0, x1: s.x1 });
  }
  for (let degisti = true; degisti;) {
    degisti = false;
    kolonlar.sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i + 1 < kolonlar.length; i++) {
      if (kesisim(kolonlar[i], kolonlar[i + 1]) > 0) {
        kolonlar[i].x1 = Math.max(kolonlar[i].x1, kolonlar[i + 1].x1);
        kolonlar.splice(i + 1, 1);
        degisti = true;
      }
    }
  }
  const satirHucre = (l) => {
    const h = kolonlar.map(() => []);
    for (const s of l.segmentler) {
      let en = 0, enK = 0;
      kolonlar.forEach((k, i) => { const o = kesisim(k, s); if (o > en) { en = o; enK = i; } });
      h[enK].push(s.metin);
    }
    return h.map((x) => x.join(' ').trim());
  };
  return { kolonSayisi: kolonlar.length, satirlar: satirlar.map(satirHucre) };
}

/**
 * Satır dizisinde i. satırdan başlayan bir tablo var mı? En az 2 satır ve 2 sütun.
 * @returns {{tablo, bitis:number}|null}
 */
function tabloBul(satirlar, i) {
  const cok = (l) => l.segmentler.length >= 2;
  if (!cok(satirlar[i])) return null;
  let j = i;
  const secilen = [satirlar[i]];
  while (j + 1 < satirlar.length) {
    const s = satirlar[j + 1], onc = satirlar[j];
    const aralik = onc.y - s.y;
    if (aralik > 2.4 * Math.max(onc.boyut, s.boyut)) break;
    if (cok(s)) { secilen.push(s); j++; } else break;
  }
  if (secilen.length < 2) return null;
  const t = tabloKur(secilen);
  if (t.kolonSayisi < 2 || t.kolonSayisi > 12) return null;
  // Gerçekten sütunlu mu? Satırların çoğu sütun sayısının en az yarısını doldurmalı.
  const dolu = t.satirlar.filter((r) => r.filter(Boolean).length >= Math.max(2, Math.ceil(t.kolonSayisi / 2))).length;
  if (dolu < secilen.length * 0.6) return null;
  return { tablo: t, bitis: j };
}

// ---------------------------------------------------------------------------------------------------------
// 4) Sayfa düzeni: okuma sırası, tablo, paragraf, başlık
// ---------------------------------------------------------------------------------------------------------

/** Sayfanın satırlarını (ve resimleri) okuma sırasına koyar. @returns {{ogeler:object[], sutunlu:boolean}} */
function okumaSirasi(satirlarIcin, parcalar, genislik, resimler) {
  const ayirac = sutunAyiraciBul(parcalar, genislik);
  if (!ayirac) {
    const ogeler = [
      ...satirlarIcin(parcalar).map((l) => ({ tur: 'satir', ...l, grup: '0' })),
      ...resimler.map((r) => ({ tur: 'resim', ...r, y: r.y1, grup: '0' })),
    ].sort((a, b) => b.y - a.y);
    return { ogeler, sutunlu: false };
  }
  const tamP = parcalar.filter((p) => p.x0 < ayirac.x0 && p.x1 > ayirac.x1);
  const solP = parcalar.filter((p) => !tamP.includes(p) && (p.x0 + p.x1) / 2 < ayirac.merkez);
  const sagP = parcalar.filter((p) => !tamP.includes(p) && (p.x0 + p.x1) / 2 >= ayirac.merkez);
  const tam = satirlarIcin(tamP);
  const tamAlti = (y) => tam.filter((t) => t.y > y + 0.5).length;
  const ogeler = [];
  tam.forEach((l) => ogeler.push({ tur: 'satir', ...l, tamSatir: true, anahtar: [tamAlti(l.y), 2, -l.y], grup: `t${tamAlti(l.y)}` }));
  [[satirlarIcin(solP), 0], [satirlarIcin(sagP), 1]].forEach(([ls, k]) => ls.forEach((l) => ogeler.push({ tur: 'satir', ...l, anahtar: [tamAlti(l.y), k, -l.y], grup: `b${tamAlti(l.y)}-${k}` })));
  for (const r of resimler) {
    const kesen = r.x0 < ayirac.x0 && r.x1 > ayirac.x1;
    const k = kesen ? 2 : (r.x0 + r.x1) / 2 < ayirac.merkez ? 0 : 1;
    ogeler.push({ tur: 'resim', ...r, y: r.y1, anahtar: [tamAlti(r.y1), k, -r.y1], grup: kesen ? `t${tamAlti(r.y1)}` : `b${tamAlti(r.y1)}-${k}` });
  }
  ogeler.sort((a, b) => a.anahtar[0] - b.anahtar[0] || a.anahtar[1] - b.anahtar[1] || a.anahtar[2] - b.anahtar[2]);
  return { ogeler, sutunlu: true };
}

function listeMi(metin) { return MADDE.test(metin); }

/** Bir grup satırdan (aynı sütun) blokları (paragraf/tablo) üretir. */
function bloklariKur(satirlar, ctx) {
  const bloklar = [];
  if (!satirlar.length) return bloklar;
  const sol = YUZDELIK(satirlar.map((l) => l.x0), 0.1);
  const sag = YUZDELIK(satirlar.map((l) => l.x1), 0.97);
  const genis = Math.max(1, sag - sol);
  let cur = null;
  const bitir = () => { if (cur) { bloklar.push(cur); cur = null; } };
  for (let i = 0; i < satirlar.length; i++) {
    const t = tabloBul(satirlar, i);
    if (t) {
      bitir();
      bloklar.push({ tur: 'tablo', tablo: t.tablo, y: satirlar[i].y });
      ctx.tabloSayisi++;
      i = t.bitis;
      continue;
    }
    const L = satirlar[i];
    const baslik = L.boyut >= ctx.govdeBoyut * 1.15 && L.metin.length <= 250;
    const madde = listeMi(L.metin);
    if (cur) {
      const P = cur.satirlar[cur.satirlar.length - 1];
      const aralik = P.y - L.y;
      const kisa = (sag - P.x1) > 0.3 * genis;
      // "bölün-" / "müş…": tireyle biten satırın ardından küçük harfle başlayan satır, aynı cümlenin devamıdır
      const tireliDevam = !baslik && /\p{L}-$/u.test(P.metin) && /^\p{Ll}/u.test(L.metin);
      const kesilir = madde || baslik !== cur.baslik
        || (!tireliDevam && (Math.abs(L.boyut - P.boyut) > 0.12 * P.boyut
        || aralik > 1.65 * Math.max(L.boyut, P.boyut)
        || (L.paragraf != null && P.paragraf != null && L.paragraf !== P.paragraf)
        || (L.x0 > sol + 1.2 * L.boyut && P.x0 <= sol + 0.5 * L.boyut && !cur.baslik)
        || (kisa && !cur.baslik)
        || (cur.merkezli !== undefined && cur.merkezli !== (Math.abs((L.x0 + L.x1) / 2 - (sol + sag) / 2) < 0.03 * genis && L.x0 > sol + 0.08 * genis))));
      if (!kesilir) { cur.satirlar.push(L); continue; }
      bitir();
    }
    const merkezli = Math.abs((L.x0 + L.x1) / 2 - (sol + sag) / 2) < 0.03 * genis && L.x0 > sol + 0.08 * genis;
    cur = { tur: 'p', satirlar: [L], baslik, madde, merkezli, y: L.y };
  }
  bitir();
  return bloklar;
}

// ---------------------------------------------------------------------------------------------------------
// 5) Sayfa üst/alt bilgi ve sayfa numarası ayıklama
// ---------------------------------------------------------------------------------------------------------

const SAYFA_NO = /^(?:[-–—\s]*\d{1,4}[-–—\s]*|sayfa\s*\d+(?:\s*\/\s*\d+)?|page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\/\s*\d+|[ivxlcdm]{1,6})$/i;
const anahtarla = (m) => m.toLocaleLowerCase('tr').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function ustAltAyikla(sayfalar) {
  const bolge = (s, l) => l.y > s.yukseklik * 0.93 || l.y < s.yukseklik * 0.07;
  const sayac = new Map();
  for (const s of sayfalar) {
    const gordu = new Set();
    for (const l of s.satirlar) if (bolge(s, l)) gordu.add(anahtarla(l.metin));
    for (const k of gordu) sayac.set(k, (sayac.get(k) ?? 0) + 1);
  }
  const tekrar = sayfalar.length >= 3 ? Math.max(3, Math.ceil(sayfalar.length * 0.4)) : Infinity;
  let silinen = 0;
  for (const s of sayfalar) {
    s.satirlar = s.satirlar.filter((l) => {
      if (!bolge(s, l)) return true;
      if (SAYFA_NO.test(l.metin.trim()) || (sayac.get(anahtarla(l.metin)) ?? 0) >= tekrar) { silinen++; return false; }
      return true;
    });
  }
  return silinen;
}

// ---------------------------------------------------------------------------------------------------------
// 6) Ana işlev
// ---------------------------------------------------------------------------------------------------------

/**
 * @param secenek.sayfalar  "1-3,5" (boş = hepsi)
 * @param secenek.ocr       'otomatik' (yazısı olmayan sayfalar OCR'lanır) | 'yok'
 * @param secenek.resimler  true: resimleri aktar
 * @param secenek.ustAltAtla true: tekrarlayan üst/alt bilgi ve sayfa numaralarını aktarma
 * @returns {{bayt:Uint8Array, uyarilar:string[], bilgi:{sayfa,paragraf,baslik,tablo,resim,ocrSayfa,sutunluSayfa}}}
 */
export async function pdfYapisi(bayt, {
  sayfalar = '', ocr = 'otomatik', resimler = true, ustAltAtla = true, dil = 'tur', ocrDpi = 250, ilerleme, dosyaAdi = 'belge',
} = {}) {
  const belge = await belgeAc(bayt, { ek: { fontExtraProperties: true } });
  const uyarilar = [];
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    const sayfaVerisi = [];
    const bilgi = { sayfa: secili.length, paragraf: 0, baslik: 0, tablo: 0, resim: 0, ocrSayfa: 0, sutunluSayfa: 0, madde: 0, ustAltSilinen: 0, tireBirlestirilen: 0 };
    let atlananResim = 0, dondurulmus = 0, taranmisResimAtlandi = false;

    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      ilerleme?.(k, secili.length, `Sayfa ${no} inceleniyor…`);
      const yaziVar = await sayfadaYaziVarMi(belge, no);
      let parcalar, genislik, yukseklik, resimListe = [];
      if (!yaziVar && ocr !== 'yok') {
        ilerleme?.(k, secili.length, `Sayfa ${no} okunuyor (OCR)…`);
        const o = await sayfaOcr(belge, no, { dpi: ocrDpi, dil });
        genislik = o.genislik; yukseklik = o.yukseklik;
        parcalar = [];
        for (const s of o.satirlar) {
          const h = Math.max(...s.kelimeler.map((w) => w.y1 - w.y0));
          const boyut = Math.max(4, h / 0.95);
          for (const w of s.kelimeler) {
            parcalar.push({ metin: w.metin, x0: w.x0, x1: w.x1, y: s.y0 + (s.y1 - s.y0) * 0.22, boyut, kalin: false, italik: false, sabit: false, serifli: false, kelime: true, paragraf: s.paragraf });
          }
        }
        bilgi.ocrSayfa++;
        taranmisResimAtlandi = taranmisResimAtlandi || resimler;
      } else {
        const y = await sayfaYazilari(belge, no);
        genislik = y.genislik; yukseklik = y.yukseklik; parcalar = y.parcalar; dondurulmus += y.dondurulmus;
        if (resimler) {
          const r = await sayfaResimleri(belge, no);
          atlananResim += r.atlanan;
          // sayfanın neredeyse tamamını kaplayan resim = arka plan/tarama; metin sayfasında aktarılmaz
          resimListe = r.resimler.filter((q) => {
            const buyuk = (q.x1 - q.x0) * (q.y1 - q.y0) > 0.85 * genislik * yukseklik;
            if (buyuk) atlananResim++;
            return !buyuk;
          });
        }
      }
      sayfaVerisi.push({ no, genislik, yukseklik, parcalar, resimListe, satirlar: null });
    }

    // Yazı boyutları ve ortak ölçüler (tüm sayfalar birlikte): gövde boyutu = en çok harf kullanılan boyut
    const harfBoyut = new Map();
    for (const s of sayfaVerisi) for (const p of s.parcalar) { const b = Math.round(p.boyut * 2) / 2; harfBoyut.set(b, (harfBoyut.get(b) ?? 0) + p.metin.length); }
    const govdeBoyut = [...harfBoyut.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;

    // Satırlar, okuma sırası
    for (const s of sayfaVerisi) {
      const sirali = okumaSirasi(satirlariKur, s.parcalar, s.genislik,
        s.resimListe.map((r) => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, png: r.png, piksel: r.piksel })));
      s.sirali = sirali;
      s.satirlar = sirali.ogeler.filter((o) => o.tur === 'satir');
      if (sirali.sutunlu) bilgi.sutunluSayfa++;
    }
    if (ustAltAtla) bilgi.ustAltSilinen = ustAltAyikla(sayfaVerisi);
    for (const s of sayfaVerisi) s.sirali.ogeler = s.sirali.ogeler.filter((o) => o.tur !== 'satir' || s.satirlar.includes(o));

    // Bloklar
    const ctx = { govdeBoyut, tabloSayisi: 0 };
    const butunBloklar = [];
    for (const s of sayfaVerisi) {
      const sayfaBloklari = [];
      let grup = [];
      let grupAdi = null;
      const bosalt = () => { if (grup.length) sayfaBloklari.push(...bloklariKur(grup, ctx)); grup = []; };
      for (const o of s.sirali.ogeler) {
        if (o.tur === 'resim') { bosalt(); grupAdi = null; sayfaBloklari.push({ tur: 'resim', ...o }); continue; }
        if (o.grup !== grupAdi) { bosalt(); grupAdi = o.grup; }
        grup.push(o);
      }
      bosalt();
      s.bloklar = sayfaBloklari;
      butunBloklar.push(...sayfaBloklari.map((b) => ({ ...b, sayfaNo: s.no })));
    }
    if (!butunBloklar.length) throw new PdfHatasi('Bu sayfalarda aktarılabilir yazı ya da resim bulunamadı. Belge boşsa ya da OCR kapalıysa bu olabilir.');

    // Başlık düzeyleri (belge geneli): gövdeden belirgin büyük boyutlar, büyükten küçüğe H1..H4
    const baslikBoyutlari = [...new Set(butunBloklar.filter((b) => b.tur === 'p' && b.baslik).map((b) => Math.round(Math.max(...b.satirlar.map((l) => l.boyut)) * 2) / 2))].sort((a, b) => b - a);
    const duzeyi = (b) => {
      const bs = Math.round(Math.max(...b.satirlar.map((l) => l.boyut)) * 2) / 2;
      return Math.min(4, baslikBoyutlari.indexOf(bs) + 1);
    };

    // Sayfalar arası paragraf birleştirme + metin hazırlama
    const nihai = [];
    let sonSayfaBlogu = null;
    for (const b of butunBloklar) {
      if (b.tur === 'p') {
        b.duzey = b.baslik ? duzeyi(b) : 0;
        const ilk = b.satirlar[0].metin;
        if (sonSayfaBlogu && sonSayfaBlogu.tur === 'p' && sonSayfaBlogu.sayfaNo !== b.sayfaNo && !sonSayfaBlogu.baslik && !sonSayfaBlogu.madde
          && !b.baslik && !b.madde && !CUMLE_SONU.test(sonSayfaBlogu.satirlar.at(-1).metin) && /^\p{Ll}/u.test(ilk)) {
          sonSayfaBlogu.satirlar.push(...b.satirlar);
          continue;
        }
      }
      nihai.push(b);
      sonSayfaBlogu = b;
    }

    return { nihai, bilgi, uyarilar, govdeBoyut, sayfaVerisi, dondurulmus, atlananResim };
  } finally {
    await belge.kapat();
  }
}

/** PDF → Word (.docx). Ayrıntı için dosya başındaki dürüstlük notuna bakın. */
export async function pdfdenWord(bayt, secenek = {}) {
  const { dosyaAdi = 'belge' } = secenek;
  const { nihai, bilgi, uyarilar, govdeBoyut, sayfaVerisi, dondurulmus, atlananResim } = await pdfYapisi(bayt, secenek);
  {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } = docx;
    const yazi = (r) => (r.sabit ? 'Courier New' : r.serifli ? 'Times New Roman' : 'Arial');
    const sizePt = (b) => Math.max(8, Math.min(144, Math.round(b * 2)));
    const BASLIKLAR = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

    const calismalar = (satirlar, o = {}) => paragrafParcalari(satirlar, o, bilgi);
    const run = (r, ek = {}) => {
      const t = new TextRun({ text: r.metin, bold: r.kalin, italics: r.italik, size: sizePt(r.boyut), font: yazi(r), ...(r.url ? { style: 'Hyperlink' } : {}), ...ek });
      return r.url ? new ExternalHyperlink({ children: [t], link: r.url }) : t;
    };

    const govde = [];
    for (const b of nihai) {
      if (b.tur === 'p') {
        const rs = calismalar(b.satirlar, { baslik: b.baslik, maddeAt: b.madde });
        if (!rs.length || !rs.some((r) => r.metin.trim())) continue;
        const opt = { children: rs.map((r) => run(r)), spacing: { after: b.baslik ? 120 : 100, before: b.baslik ? 200 : 0 } };
        if (b.baslik) { opt.heading = BASLIKLAR[b.duzey - 1] ?? HeadingLevel.HEADING_4; bilgi.baslik++; }
        if (b.madde) { opt.bullet = { level: 0 }; bilgi.madde++; }
        if (b.merkezli) opt.alignment = AlignmentType.CENTER;
        govde.push(new Paragraph(opt));
        bilgi.paragraf++;
      } else if (b.tur === 'tablo') {
        const kenar = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
        const kenarlar = { top: kenar, bottom: kenar, left: kenar, right: kenar };
        const satirlarW = b.tablo.satirlar.map((hucreler, ri) => new TableRow({
          children: hucreler.map((m) => new TableCell({
            borders: kenarlar,
            width: { size: Math.floor(100 / b.tablo.kolonSayisi), type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: m, size: sizePt(govdeBoyut), font: 'Arial', bold: ri === 0 && false })] })],
          })),
        }));
        govde.push(new Table({ rows: satirlarW, width: { size: 100, type: WidthType.PERCENTAGE } }));
        govde.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        bilgi.tablo++;
      } else if (b.tur === 'resim') {
        let w = ((b.x1 - b.x0) * 96) / 72, h = ((b.y1 - b.y0) * 96) / 72;
        const enCok = 600;
        if (w > enCok) { h *= enCok / w; w = enCok; }
        govde.push(new Paragraph({
          children: [new ImageRun({ type: 'png', data: b.png, transformation: { width: Math.max(8, Math.round(w)), height: Math.max(8, Math.round(h)) }, altText: { title: 'Resim', description: `PDF sayfa ${b.sayfaNo} resmi`, name: `resim-${bilgi.resim + 1}` } })],
          spacing: { after: 120 },
        }));
        bilgi.resim++;
      }
    }

    // Sayfa boyutu ve kenar boşlukları (ilk sayfaya göre; metin kenarlarından tahmin)
    const ilk = sayfaVerisi[0];
    const tumSatirlar = sayfaVerisi.flatMap((s) => s.satirlar);
    const kenarPt = (v, alt = 36, ust = 108) => Math.round(Math.max(alt, Math.min(ust, v)));
    const sol = kenarPt(YUZDELIK(tumSatirlar.map((l) => l.x0), 0.05));
    const sag = kenarPt(ilk.genislik - YUZDELIK(tumSatirlar.map((l) => l.x1), 0.95));
    const ust = kenarPt(ilk.yukseklik - YUZDELIK(tumSatirlar.map((l) => l.y), 0.98));
    const alt = kenarPt(YUZDELIK(tumSatirlar.map((l) => l.y), 0.02));
    const dokuman = new Document({
      creator: 'BelgeLab (açık kaynak)',
      title: String(dosyaAdi).replace(/\.pdf$/i, ''),
      description: 'PDF dosyasından otomatik dönüştürüldü; düzen aslından farklı olabilir.',
      styles: { default: { document: { run: { font: 'Arial', size: sizePt(govdeBoyut), language: { value: 'tr-TR' } } } } },
      sections: [{
        properties: { page: { size: { width: Math.round(ilk.genislik * 20), height: Math.round(ilk.yukseklik * 20) }, margin: { left: sol * 20, right: sag * 20, top: ust * 20, bottom: alt * 20 } } },
        children: govde.length ? govde : [new Paragraph('')],
      }],
    });
    const cikti = new Uint8Array(await Packer.toArrayBuffer(dokuman));

    // ---- Dürüst bilgilendirme ----
    uyarilar.push('PDF ile Word farklı mantıkta çalışır: PDF’te yazılar sayfaya tek tek yerleştirilmiştir, Word’de ise metin akar. Bu yüzden sonuç orijinalin birebir aynısı OLMAZ; paragraf, başlık, tablo ve resimler tahmin edilerek yeniden kuruldu. Word’de açıp kontrol edin.');
    if (bilgi.sutunluSayfa) uyarilar.push(`${bilgi.sutunluSayfa} sayfada iki sütunlu düzen algılandı; metin önce sol, sonra sağ sütun olarak sıralandı. Bu tahmin yanlış olabilir.`);
    if (bilgi.tablo) uyarilar.push(`${bilgi.tablo} tablo, yazıların hizasından tahmin edilerek kuruldu (çizgiler algılanmaz). Birleştirilmiş hücreli ya da iç içe tablolar bozuk çıkabilir.`);
    if (bilgi.ocrSayfa) uyarilar.push(`${bilgi.ocrSayfa} sayfa taranmış olduğu için OCR ile okundu. Okunan yazıda hata olabilir; yazı tipi, kalınlık ve taranmış sayfadaki resimler/şekiller aktarılmaz.`);
    if (bilgi.tireBirlestirilen) uyarilar.push(`Satır sonunda tireyle bölünmüş ${bilgi.tireBirlestirilen} kelime birleştirildi (ör. “bölün-” + “müş” → “bölünmüş”). Gerçek tireli bir sözcük etkilenmiş olabilir.`);
    if (bilgi.ustAltSilinen) uyarilar.push(`${bilgi.ustAltSilinen} satır (sayfa numaraları ve her sayfada tekrarlanan üst/alt bilgi) aktarılmadı.`);
    if (dondurulmus) uyarilar.push(`${dondurulmus} döndürülmüş (dikey/eğik) yazı parçası atlandı.`);
    if (atlananResim) uyarilar.push(`${atlananResim} resim aktarılamadı ya da atlandı (çok küçük, sayfa boyunda arka plan veya desteklenmeyen resim türü).`);
    uyarilar.push('Matematik formülleri, metin kutuları, dipnotların yerleşimi ve özel yazı tipleri Word’de farklı görünebilir; yazı tipleri Arial/Times New Roman/Courier olarak eşlendi.');
    return { bayt: cikti, uyarilar, bilgi };
}
}

/** Satırları tek metne birleştirir (tireli bölünmeyi birleştirir) ve biçimli parçalara (run) böler. */
export function paragrafParcalari(satirlar, { baslik = false, maddeAt = false } = {}, bilgi = {}) {
  const out = [];
  const ekle = (metin, r) => {
    if (!metin) return;
    const son = out[out.length - 1];
    if (son && son.kalin === r.kalin && son.italik === r.italik && son.sabit === r.sabit && son.boyut === r.boyut && son.serifli === r.serifli && son.url === r.url) son.metin += metin;
    else out.push({ metin, kalin: r.kalin, italik: r.italik, sabit: r.sabit, boyut: r.boyut, serifli: r.serifli, url: r.url });
  };
  satirlar.forEach((l, i) => {
    l.runs.forEach((r, j) => {
      let metin = r.metin;
      if (i === 0 && j === 0 && maddeAt) metin = metin.replace(MADDE, '');
      if (i > 0 && j === 0) metin = metin.replace(/^\s+/, '');
      ekle(metin, r);
    });
    if (i < satirlar.length - 1) {
      const son = out[out.length - 1];
      const siradaki = satirlar[i + 1].metin;
      if (son && /\p{L}-$/u.test(son.metin.trimEnd()) && /^\p{Ll}/u.test(siradaki) && !baslik) {
        son.metin = son.metin.trimEnd().slice(0, -1);
        bilgi.tireBirlestirilen++;
      } else if (son) son.metin = `${son.metin.replace(/\s+$/, '')} `;
    }
  });
  if (out.length) out[out.length - 1].metin = out[out.length - 1].metin.replace(/\s+$/, '');
  return out;
}
