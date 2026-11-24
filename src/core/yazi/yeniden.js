// Aşama 2 + 3 — Yazı kaldırma ve yeniden yazma.
//
// Yöntem: Her yazı komutu (Tj, TJ, ', ") İÇERİK AKIŞINDAKİ KENDİ YERİNDE değiştirilir. Böylece çizim sırası,
// kırpma alanı, saydamlık, katman (optional content) ve etiket yapısı aynen kalır. Diğer tüm komutlar
// bayt bayt aynı yazılır. Kaldırılan komutun yerine yalnızca "yazı imlecini" eski yerine götüren
// görünmez bir komut ([sayı] TJ) konur; böylece sonraki komutlar da yerinden oynamaz.
// Paylaşılan form nesneleri (üst/alt bilgi çoğu zaman buradadır) değiştirilecekse sayfaya özel kopyası
// çıkarılır; başka sayfalar etkilenmez. Sonunda hiçbir yerden kullanılmayan eski nesneler dosyadan silinir
// (eski yazı dosyanın içinde gizlice kalmasın).

import { PDFName, PDFDict, PDFArray, PDFRef, PDFStream } from 'pdf-lib';
import { carp, ters, sayiYaz, adYaz, birlestirBayt } from './akis.js';
import { kelimeler, kelimeSigdir, esleme, olcerAl, SINIR } from './analiz.js';
import { gorunurDonusum } from '../cizim.js';
import { yaziTipiGom } from '../fonts.js';
import { renkCoz } from '../util.js';

const ad = (s) => PDFName.of(s);
const m6 = (m) => m.map(sayiYaz).join(' ');

// ---- Kullanılmayan nesneleri silme ------------------------------------------------------------------

export function kullanilmayanlariSil(doc) {
  const ctx = doc.context;
  const ulasilan = new Set();
  const yigin = [];
  const ekle = (v) => {
    if (v instanceof PDFRef) { if (!ulasilan.has(v.tag)) { ulasilan.add(v.tag); yigin.push(ctx.lookup(v)); } }
    else if (v instanceof PDFArray) v.asArray().forEach(ekle);
    else if (v instanceof PDFDict) for (const x of v.values()) ekle(x);
    else if (v instanceof PDFStream) ekle(v.dict);
  };
  const t = ctx.trailerInfo;
  [t.Root, t.Info, t.Encrypt].forEach((x) => x && ekle(x));
  while (yigin.length) ekle(yigin.pop());
  let silinen = 0;
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!ulasilan.has(ref.tag)) { ctx.delete(ref); silinen++; }
  }
  return silinen;
}

// ---- Dijital imza ------------------------------------------------------------------------------------

/** İmza değerlerini kaldırır (imza alanının görünümü aynen kalır). Kaldırılan imza sayısını döndürür. */
export function imzalariKaldir(doc) {
  const ctx = doc.context;
  const acro = ctx.lookup(doc.catalog.get(ad('AcroForm')));
  let say = 0;
  const gez = (dizi, d = 0) => {
    if (!(dizi instanceof PDFArray) || d > 12) return;
    for (const x of dizi.asArray()) {
      const f = ctx.lookup(x);
      if (!(f instanceof PDFDict)) continue;
      const ft = f.lookup(ad('FT'));
      if (ft instanceof PDFName && ft.decodeText() === 'Sig' && f.has(ad('V'))) { f.delete(ad('V')); f.delete(ad('Lock')); say++; }
      gez(f.lookup(ad('Kids')), d + 1);
    }
  };
  if (acro instanceof PDFDict) {
    gez(acro.lookup(ad('Fields')));
    if (say) acro.delete(ad('SigFlags'));
  }
  if (say) doc.catalog.delete(ad('Perms'));
  return say;
}

// ---- Kaynak sözlüğü yardımcıları -----------------------------------------------------------------------

function kaynakKlonla(ctx, kaynak) {
  const k = kaynak instanceof PDFDict ? kaynak.clone(ctx) : ctx.obj({});
  for (const alt of ['Font', 'XObject']) {
    const d = k.lookup(ad(alt));
    k.set(ad(alt), d instanceof PDFDict ? d.clone(ctx) : ctx.obj({}));
  }
  return k;
}

function yeniAd(sozluk, onek) {
  for (let i = 1; ; i++) {
    const a = `${onek}${i}`;
    if (!sozluk.has(ad(a))) return a;
  }
}

// ---- Karar verme ----------------------------------------------------------------------------------

function degisiklikVar(l, d) {
  if (!d) return false;
  return (d.metin != null && d.metin !== l.metin) || d.aile || d.boyut != null || d.renk || d.kalin != null || d.italik != null;
}

/**
 * Her satır için: 'koru' (orijinal kalır), 'yeniden' (aynı yazı yeni yazı tipiyle), 'duzenle' (kullanıcı değiştirdi).
 */
export function kararlar(analiz, { degisiklikler = {}, kilitAcik = [] } = {}) {
  const acik = new Set(kilitAcik);
  const uyarilar = [];
  const satirMod = new Map();
  const tum = analiz.sayfalar.flatMap((s) => s.satirlar);
  for (const l of tum) {
    const d = degisiklikler[l.id];
    const degisti = degisiklikVar(l, d);
    const korumali = l.koruma && !(l.koruma === 'ustalt' && acik.has(l.id));
    if (korumali) {
      if (degisti) uyarilar.push({ satirId: l.id, sayfa: l.sayfa, mesaj: `Korumalı satır değiştirilmedi (${l.koruma === 'ustalt' ? 'üst/alt bilgi kilitli' : 'korumalı yazı'}).` });
      satirMod.set(l, 'koru');
    } else if (degisti) satirMod.set(l, 'duzenle');
    else satirMod.set(l, l.uyum?.tamam ? 'yeniden' : 'koru');
  }
  // Bir yazı komutu birden çok satıra dağılmışsa, satırlardan biri korunuyorsa komut da korunur.
  const parcaSatir = new Map();
  for (const l of tum) for (const s of l.segs) {
    if (!parcaSatir.has(s.parca)) parcaSatir.set(s.parca, new Set());
    parcaSatir.get(s.parca).add(l);
  }
  let degisen = true;
  while (degisen) {
    degisen = false;
    for (const set of parcaSatir.values()) {
      const modlar = [...set].map((l) => satirMod.get(l));
      if (!modlar.includes('koru')) continue;
      for (const l of set) {
        const m = satirMod.get(l);
        if (m === 'koru') continue;
        if (m === 'duzenle') uyarilar.push({ satirId: l.id, sayfa: l.sayfa, mesaj: 'Bu satır, korunan başka bir yazıyla aynı komutta; değişiklik uygulanamadı.' });
        satirMod.set(l, 'koru');
        degisen = true;
      }
    }
  }
  return { satirMod, parcaSatir, uyarilar };
}

// ---- Çizim (yeni yazı) üretimi --------------------------------------------------------------------

function stilAnahtari(p) {
  return `${p.font.anahtar}|${p.boyut.toFixed(2)}|${p.renk.hex}|${p.yukselme.toFixed(2)}|${p.hOlcek.toFixed(3)}`;
}

/** Satırın biçim parçaları (aynı yazı tipi/boyut/renk/kayma). */
function satirRunlari(l) {
  const runlar = [];
  for (const h of l.harita) {
    const p = h.seg.parca;
    const son = runlar[runlar.length - 1];
    const ch = h.glif ? null : ' ';
    if (son && (h.sanal || stilAnahtari(son.parca) === stilAnahtari(p))) { son.uz++; continue; }
    runlar.push({ parca: p, uz: 1, ch });
  }
  let i = 0;
  for (const r of runlar) { r.metin = [...l.metin].slice(i, i + r.uz).join(''); i += r.uz; }
  return runlar.filter((r) => r.metin.length);
}

/** Eski metinden yeni metne geçişi (ortak baş/son) biçim parçalarına uygular. */
function runlaraUygula(runlar, eski, yeni) {
  const E = [...eski], Y = [...yeni];
  let bas = 0;
  while (bas < E.length && bas < Y.length && E[bas] === Y[bas]) bas++;
  let son = 0;
  while (son < E.length - bas && son < Y.length - bas && E[E.length - 1 - son] === Y[Y.length - 1 - son]) son++;
  // karakter → run dizini
  const sahip = [];
  runlar.forEach((r, k) => { for (let j = 0; j < [...r.metin].length; j++) sahip.push(k); });
  const ekRun = sahip[Math.min(bas, sahip.length - 1)] ?? 0;
  const cikti = [];
  const ekle = (k, ch) => {
    const s = cikti[cikti.length - 1];
    if (s && s.k === k) s.metin += ch; else cikti.push({ k, metin: ch, parca: runlar[k].parca });
  };
  for (let j = 0; j < bas; j++) ekle(sahip[j], E[j]);
  for (let j = bas; j < Y.length - son; j++) ekle(ekRun, Y[j]);
  for (let j = E.length - son; j < E.length; j++) ekle(sahip[j], E[j]);
  return cikti;
}

async function duzenlemeCizimleri(l, d, ozel) {
  const uyarilar = [];
  const runlar = satirRunlari(l);
  const yeniMetin = d.metin != null ? d.metin.replace(/[\r\n]+/g, ' ') : l.metin;
  const parcalar = runlaraUygula(runlar, l.metin, yeniMetin);
  const olcekBoyut = d.boyut != null && l.boyut > 0 ? d.boyut / l.boyut : 1;
  let W = 0;
  const ogeler = [];
  for (const pr of parcalar) {
    const p = pr.parca;
    const e0 = esleme(p.font, ozel);
    const e = { aile: d.aile ?? e0.aile, kalin: d.kalin ?? e0.kalin, italik: d.italik ?? e0.italik };
    const o = await olcerAl(e);
    const eksik = o.eksik(pr.metin);
    if (eksik.length) return { hata: `Seçilen yazı tipinde şu karakterler yok: ${[...new Set(eksik)].join(' ')}` };
    const boyut = p.boyut * olcekBoyut;
    const gen = (o.genislik(pr.metin) / 1000) * boyut * p.hOlcek;
    ogeler.push({ metin: pr.metin, parca: p, e, o, boyut, gen, yukselme: p.yukselme * olcekBoyut, renk: d.renk ?? null });
    W += gen;
  }
  const sinir = l.sinir ?? l.blok ?? l.sayfaKenar ?? { x0: l.x0, x1: l.x1 };
  let hiz = l.hizalama;
  const bosluklar = ogeler.reduce((s, g) => s + (g.metin.match(/ /g)?.length ?? 0), 0);
  const hedefW = l.x1 - l.x0;
  if (hiz === 'iki-yana' && (W < 0.75 * hedefW || !bosluklar)) hiz = 'sol';
  // Kullanılabilir alan
  let solSinir = l.x0, sagSinir = Math.max(l.x1, sinir.x1);
  if (hiz === 'sag') { solSinir = Math.min(l.x0, sinir.x0); sagSinir = l.x1; }
  if (hiz === 'orta') { const ort = (l.x0 + l.x1) / 2; const yar = Math.min(ort - Math.min(l.x0, sinir.x0), Math.max(l.x1, sinir.x1) - ort); solSinir = ort - yar; sagSinir = ort + yar; }
  if (hiz === 'iki-yana') { solSinir = l.x0; sagSinir = l.x1; }
  const alan = sagSinir - solSinir;
  let tz = 1;
  let sigmadi = false;
  if (W > alan + 0.25) {
    if (W <= alan * (1 + SINIR.olcek)) tz = alan / W;
    else { sigmadi = true; uyarilar.push(`Yeni yazı satıra sığmıyor (${(W - alan).toFixed(1)} pt taşıyor).`); }
  }
  const Wt = W * tz;
  let x;
  if (hiz === 'sag') x = l.x1 - Wt;
  else if (hiz === 'orta') x = (l.x0 + l.x1) / 2 - Wt / 2;
  else x = l.x0;
  const ekBosluk = hiz === 'iki-yana' && Wt < hedefW ? (hedefW - Wt) / bosluklar : 0;
  const cizimler = [];
  const anaRenk = l.segs[0].parca.renk.hex;
  for (const g of ogeler) {
    const p = g.parca;
    const temelY = l.y + (p.y - l.y) * olcekBoyut; // üst/alt simge kayması korunur
    if (!g.renk && p.renk.hex !== anaRenk) g.renk = p.renk.hex;
    if (ekBosluk > 0) {
      for (const kel of g.metin.split(/( )/)) {
        if (kel === '') continue;
        const w = (g.o.genislik(kel) / 1000) * g.boyut * p.hOlcek * tz;
        if (kel !== ' ') cizimler.push({ metin: kel, x, y: temelY, boyut: g.boyut, tz: p.hOlcek * tz, tc: 0, e: g.e, renk: g.renk, parca: p });
        x += w + (kel === ' ' ? ekBosluk : 0);
      }
    } else {
      cizimler.push({ metin: g.metin, x, y: temelY, boyut: g.boyut, tz: p.hOlcek * tz, tc: 0, e: g.e, renk: g.renk, parca: p });
      x += g.gen * tz;
    }
  }
  return { cizimler, uyarilar, sigmadi, hizalama: hiz, genislik: Wt, alan };
}

async function aynenCizimleri(l, ozel) {
  const cizimler = [];
  for (const s of l.segs) {
    const p = s.parca;
    const e = esleme(p.font, ozel);
    const o = await olcerAl(e);
    for (const k of kelimeler(s)) {
      const r = kelimeSigdir(k, p, o);
      const tz = p.hOlcek * r.f;
      cizimler.push({ metin: k.metin, x: k.x0, y: p.y, boyut: p.boyut, tz, tc: tz ? p.cVis / tz : 0, e, renk: null, parca: p });
    }
    // Boşluk karakterleri de kendi yerine yazılır (görünmezler; metin seçme/kopyalama ve satır sonu korunur)
    const bw = (o.genislik(' ') / 1000) * p.boyut;
    for (const g of s.glifler) {
      if (!g.bosluk || g.adv <= 0 || bw <= 0) continue;
      cizimler.push({ metin: ' ', x: g.x, y: p.y, boyut: p.boyut, tz: g.adv / bw, tc: 0, e, renk: null, parca: p });
    }
  }
  return cizimler;
}

// ---- Akış yazma ----------------------------------------------------------------------------------

function renkKomutu(hex) {
  const { r, g, b } = renkCoz(hex);
  return `${sayiYaz(r)} ${sayiYaz(g)} ${sayiYaz(b)} rg`;
}

function renkGeriYukle(p, dugum) {
  const ham = p.renk.ham;
  if (!ham.length) return '0 g';
  if (p.renk.adli && ham.some((h) => h.dugum !== dugum)) return null;
  return ham.map((h) => new TextDecoder('latin1').decode(h.dugum.bayt.subarray(h.dugum.ops[h.i].bas, h.dugum.ops[h.i].son))).join('\n');
}

/** Bir yazı komutunun yerine konacak içerik. */
function komutYerine(p, cizimler, fontAdi, V2U) {
  const parcalar = [];
  const { op } = p;
  const islec = p.dugum.ops[p.opIdx];
  if (op === "'") parcalar.push('T*');
  if (op === '"') parcalar.push(`${sayiYaz(islec.args[0]?.v ?? 0)} Tw ${sayiYaz(islec.args[1]?.v ?? 0)} Tc T*`);
  const ilerle = (dx) => {
    const bolen = p.Tfs * p.Th;
    if (!bolen || Math.abs(dx) < 1e-9) return null;
    return `[${sayiYaz((-dx * 1000) / bolen)}] TJ`;
  };
  if (!cizimler.length) {
    const s = ilerle(p.dxSon - p.dx0);
    if (s) parcalar.push(s);
    return parcalar.join('\n');
  }
  const ctmTers = ters(p.ctm);
  const temel = carp(V2U, ctmTers);
  let renkDegisti = false;
  for (const c of cizimler) {
    if (!c.metin) continue;
    const Tm = carp([1, 0, 0, 1, c.x, c.y], temel);
    if (c.renk) { parcalar.push(renkKomutu(c.renk)); renkDegisti = true; }
    parcalar.push(`${m6(Tm)} Tm`, `${adYaz(fontAdi(c.e))} ${sayiYaz(c.boyut)} Tf`, `${sayiYaz(c.tc)} Tc`, `${sayiYaz(c.tz * 100)} Tz`,
      `${c.pdfFont.encodeText(c.metin).toString()} Tj`);
  }
  if (renkDegisti) parcalar.push(renkGeriYukle(p, p.dugum) ?? '0 g');
  parcalar.push(`${adYaz(p.fontAd)} ${sayiYaz(p.Tfs)} Tf`, `${sayiYaz(p.Tc)} Tc`, `${sayiYaz(p.Th * 100)} Tz`, `${m6(p.Tlm)} Tm`);
  const s = ilerle(p.dxSon);
  if (s) parcalar.push(s);
  return parcalar.join('\n');
}

/**
 * Analiz edilmiş belgeye karar ve çizimleri uygular (belge yerinde değişir).
 * yerine: Map<parca, {cizimler}> — burada olmayan parça komutlarına dokunulmaz.
 */
async function uygula(analiz, yerine, { isaret = null } = {}) {
  const { doc } = analiz;
  const ctx = doc.context;
  // Yazı tiplerini göm
  const fontOnbellek = new Map();
  for (const { cizimler } of yerine.values()) {
    for (const c of cizimler) {
      const k = `${c.e.aile}|${!!c.e.kalin}|${!!c.e.italik}`;
      if (!fontOnbellek.has(k)) fontOnbellek.set(k, await yaziTipiGom(doc, c.e.aile, { kalin: !!c.e.kalin, italik: !!c.e.italik }));
      c.pdfFont = fontOnbellek.get(k);
    }
  }

  for (const s of analiz.sayfalar) {
    const V2U = gorunurDonusum(s.page).m;
    const dugumDegisim = new Map(); // dugum → Map(opIdx → metin)
    for (const p of s.parcalar) {
      const y = yerine.get(p);
      if (!y) continue;
      if (!dugumDegisim.has(p.dugum)) dugumDegisim.set(p.dugum, { komut: new Map(), cizimler: [] });
      dugumDegisim.get(p.dugum).komut.set(p.opIdx, { p, cizimler: y.cizimler });
      // Yeni yazı, parçanın dar kırpma hücresine (tek satırlık W n kutusu) sığmıyorsa o kırpma kaldırılır; yoksa taşan yazı
      // görünmez kalır. Yalnızca yazısı gerçekten sığmayan parçalar etkilenir; dokunulmayan satırlar bayt bayt aynı kalır.
      for (const c of y.cizimler) {
        if (!c.metin || !c.pdfFont) continue;
        const gen = (c.pdfFont.widthOfTextAtSize(c.metin, c.boyut) * (c.tz ?? 1));
        for (const k of p.kirplar ?? []) {
          const dar = k.kutu.y1 - k.kutu.y0 <= 3 * Math.max(p.boyut, 1);
          if (dar && (c.x + gen > k.kutu.x1 + 0.5 || c.x < k.kutu.x0 - 0.5)) {
            if (!dugumDegisim.has(k.dugum)) dugumDegisim.set(k.dugum, { komut: new Map(), cizimler: [] });
            dugumDegisim.get(k.dugum).komut.set(k.i, { kirpmaKaldir: true });
          }
        }
      }
    }
    if (!dugumDegisim.size) continue;
    // Değişen düğümlerin üstlerini de değişmiş say (Do adı değişecek)
    for (const d of [...dugumDegisim.keys()]) {
      let u = d.ust;
      while (u) { if (!dugumDegisim.has(u)) dugumDegisim.set(u, { komut: new Map(), cizimler: [] }); u = u.ust; }
    }
    // En derinden başlayarak yaz
    const sirali = [...dugumDegisim.keys()].sort((a, b) => b.id.split('/').length - a.id.split('/').length);
    const yeniRef = new Map(); // form dugum → {ad, ref}
    const kaynakKlon = new Map();
    const kaynakAl = (d) => {
      if (!kaynakKlon.has(d)) kaynakKlon.set(d, kaynakKlonla(ctx, d.kaynak));
      return kaynakKlon.get(d);
    };
    // Sayfa grupları ortak kaynak sözlüğünü paylaşır
    const sayfaKaynak = kaynakKlonla(ctx, s.page.node.Resources());
    for (const d of s.dugumler) if (d.tur === 'sayfa') kaynakKlon.set(d, sayfaKaynak);

    for (const d of sirali) {
      const kaynak = kaynakAl(d);
      const fontSoz = kaynak.lookup(ad('Font'));
      const xoSoz = kaynak.lookup(ad('XObject'));
      const fontAdlari = new Map();
      const fontAdi = (e) => {
        const k = `${e.aile}|${!!e.kalin}|${!!e.italik}`;
        if (!fontAdlari.has(k)) {
          const a = yeniAd(fontSoz, 'PAY');
          fontSoz.set(ad(a), fontOnbellek.get(k).ref);
          fontAdlari.set(k, a);
        }
        return fontAdlari.get(k);
      };
      const { komut } = dugumDegisim.get(d);
      const cocuklar = new Map();
      for (const [alt, bilgi] of yeniRef) if (alt.ust === d) cocuklar.set(alt.doIdx, bilgi);
      const parcalar = [];
      let onceki = 0;
      const ekle = (k, metin) => {
        const o = d.ops[k];
        if (o.bas > onceki) parcalar.push(d.bayt.subarray(onceki, o.bas));
        parcalar.push(`\n${metin}\n`);
        onceki = o.son;
      };
      const indeksler = [...new Set([...komut.keys(), ...cocuklar.keys()])].sort((a, b) => a - b);
      for (const k of indeksler) {
        if (komut.has(k)) {
          const e = komut.get(k);
          if (e.kirpmaKaldir) { ekle(k, ''); continue; } // "W" işleci kalkar, ardından gelen "n" yolu kırpmadan bitirir
          ekle(k, komutYerine(e.p, e.cizimler, fontAdi, V2U));
        } else {
          const c = cocuklar.get(k);
          xoSoz.set(ad(c.ad), c.ref);
          ekle(k, `${adYaz(c.ad)} Do`);
        }
      }
      if (onceki < d.bayt.length) parcalar.push(d.bayt.subarray(onceki));
      // Kopyası çıkarılan form nesnesinin eski adı artık kullanılmıyorsa kaynaktan çıkar
      // (yoksa eski nesne — eski yazısıyla — dosyada kalır).
      for (const k of cocuklar.keys()) {
        const eskiAd = [...yeniRef.keys()].find((x) => x.ust === d && x.doIdx === k)?.isim;
        if (!eskiAd) continue;
        const halaKullanilan = d.ops.some((o, j) => o.op === 'Do' && !cocuklar.has(j) && o.args[0]?.v === eskiAd);
        if (!halaKullanilan) xoSoz.delete(ad(eskiAd));
      }
      if (isaret && d.tur === 'sayfa') parcalar.unshift(`${isaret}\n`);
      const bayt = birlestirBayt(parcalar);
      if (d.tur === 'form') {
        const eski = ctx.lookup(d.ref);
        const sozluk = eski.dict.clone(ctx);
        for (const k of ['Filter', 'DecodeParms', 'Length']) sozluk.delete(ad(k));
        sozluk.set(ad('Resources'), kaynak);
        const yeni = ctx.flateStream(bayt, Object.fromEntries([...sozluk.entries()].map(([k, v]) => [k.decodeText(), v])));
        const ref = ctx.register(yeni);
        const ustKaynak = kaynakAl(d.ust);
        yeniRef.set(d, { ad: yeniAd(ustKaynak.lookup(ad('XObject')), 'PAX'), ref });
      } else {
        d.yeniRef = ctx.register(ctx.flateStream(bayt));
      }
    }
    // Sayfanın içerik dizisini kur
    const dizi = ctx.obj([]);
    for (const g of s.duzen) {
      if (g.tur === 'isaretli') dizi.push(g.ref);
      else {
        const d = s.dugumler.find((x) => x.tur === 'sayfa' && x.grup === g.grup);
        if (d?.yeniRef) dizi.push(d.yeniRef); else g.grup.refler.forEach((r) => dizi.push(r));
      }
    }
    s.page.node.set(ad('Contents'), dizi);
    s.page.node.set(ad('Resources'), sayfaKaynak);
  }
}

export { uygula as degisiklikleriUygula, duzenlemeCizimleri, aynenCizimleri };
