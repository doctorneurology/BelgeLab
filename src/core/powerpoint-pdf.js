// PowerPoint (.pptx) → PDF. Her slayt bir PDF sayfası olur: arka plan rengi, dolgulu şekiller, metin kutuları, resimler ve basit
// tablolar konumlarına yerleştirilir. Tamamen tarayıcıda.
//
// DÜRÜSTLÜK: Bu bir PowerPoint işleme motoru DEĞİLDİR. Desteklenmeyenler sonuçta bildirilir: animasyon/geçiş, SmartArt, grafikler,
// gradyan/desenli dolgular, gölge/yansıma, şekil geometrisi (hepsi dikdörtgen sayılır), döndürülmüş nesneler, WordArt, notlar,
// gömülü video/ses. Tema renkleri ve metin boyutları kalıtımdan (şablondan) yaklaşık okunur. Eski .ppt desteklenmez.

import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument, rgb } from 'pdf-lib';
import { xmlAyristir, cocuk, cocuklar, hepsi } from './xml.js';
import { Yazici } from './belge-pdf.js';
import { kaydet } from './belge.js';
import { renkCoz as hexRenk } from './util.js';
import { aileEsle } from './word-pdf.js';
import { PdfHatasi } from './hatalar.js';

const EMU = 1 / 12700;
const sayi = (v, k = 1) => (v === undefined || v === null || v === '' ? undefined : Number(v) * k);

function resimBicimi(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  return null;
}

function iliskiler(z, yol) {
  const m = new Map();
  if (z[yol]) for (const r of cocuklar(xmlAyristir(strFromU8(z[yol])), 'Relationship')) m.set(r.oz.Id, r.oz);
  return m;
}
const gerceYol = (taban, hedef) => {
  if (hedef.startsWith('/')) return hedef.slice(1);
  const p = taban.split('/').slice(0, -1);
  for (const s of hedef.split('/')) { if (s === '..') p.pop(); else if (s !== '.') p.push(s); }
  return p.join('/');
};
const relYolu = (yol) => yol.replace(/([^/]+)$/, '_rels/$1.rels');

function temaRenkleri(z) {
  const t = {};
  const yol = Object.keys(z).find((d) => /^ppt\/theme\/theme\d+\.xml$/.test(d));
  if (!yol) return t;
  const sema = hepsi(xmlAyristir(strFromU8(z[yol])), 'a:clrScheme')[0];
  for (const c of sema?.cocuk ?? []) {
    const ad = c.ad.replace('a:', '');
    const ic = c.cocuk[0];
    t[ad] = ic?.oz.val && /^[0-9a-fA-F]{6}$/.test(ic.oz.val) ? `#${ic.oz.val}` : ic?.oz.lastClr ? `#${ic.oz.lastClr}` : undefined;
  }
  return t;
}
const TEMA_ESLE = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };

function renkOku(dolgu, tema) {
  if (!dolgu) return null;
  const s = cocuk(dolgu, 'a:srgbClr');
  if (s && /^[0-9a-fA-F]{6}$/.test(s.oz.val ?? '')) return `#${s.oz.val}`;
  const t = cocuk(dolgu, 'a:schemeClr');
  if (t) return tema[TEMA_ESLE[t.oz.val] ?? t.oz.val] ?? null;
  const sy = cocuk(dolgu, 'a:sysClr');
  if (sy?.oz.lastClr) return `#${sy.oz.lastClr}`;
  return null;
}

/** xfrm → {x,y,w,h} pt (EMU / 12700) */
function xfrmOku(sp) {
  const x = hepsi({ cocuk: sp.cocuk }, 'a:xfrm')[0];
  if (!x) return null;
  const off = cocuk(x, 'a:off'), ext = cocuk(x, 'a:ext');
  if (!off || !ext) return null;
  return { x: sayi(off.oz.x, EMU), y: sayi(off.oz.y, EMU), w: sayi(ext.oz.cx, EMU), h: sayi(ext.oz.cy, EMU), don: Number(x.oz.rot ?? 0) };
}

function yerTutucu(sp) {
  const ph = hepsi(cocuk(sp, 'p:nvSpPr') ?? { cocuk: [] }, 'p:ph')[0];
  return ph ? { tur: ph.oz.type ?? 'body', idx: ph.oz.idx } : null;
}

export async function powerpointPdf(bayt, { ilerleme, dosyaAdi = '' } = {}) {
  if (!(bayt[0] === 0x50 && bayt[1] === 0x4b)) throw new PdfHatasi('Bu dosya .pptx (PowerPoint 2007+) gibi görünmüyor. Eski .ppt dosyalarını önce PowerPoint’te “Farklı kaydet → .pptx” ile kaydedin.');
  let z;
  try { z = unzipSync(bayt); } catch (e) { throw new PdfHatasi(`PowerPoint dosyası açılamadı: ${e?.message ?? e}`); }
  if (!z['ppt/presentation.xml']) throw new PdfHatasi('Bu dosyada sunum (ppt/presentation.xml) bulunamadı.');
  const uyarilar = new Set();
  const bilgi = { slayt: 0, metinKutusu: 0, resim: 0, tablo: 0 };
  const sunum = xmlAyristir(strFromU8(z['ppt/presentation.xml']));
  const boyutEl = hepsi(sunum, 'p:sldSz')[0];
  const W = sayi(boyutEl?.oz.cx, EMU) ?? 720, H = sayi(boyutEl?.oz.cy, EMU) ?? 405;
  const tema = temaRenkleri(z);
  const sunumRel = iliskiler(z, 'ppt/_rels/presentation.xml.rels');
  const slaytYollari = hepsi(sunum, 'p:sldId').map((s) => gerceYol('ppt/presentation.xml', sunumRel.get(s.oz['r:id'])?.Target ?? '')).filter((y) => z[y]);
  if (!slaytYollari.length) throw new PdfHatasi('Sunumda slayt bulunamadı.');

  // Ana slayt metin stilleri (yaklaşık): başlık / gövde varsayılan yazı boyutu
  const metinStilleri = (kok) => {
    const o = {};
    for (const [anahtar, ad] of [['baslik', 'p:titleStyle'], ['govde', 'p:bodyStyle'], ['diger', 'p:otherStyle']]) {
      const lvl = {};
      for (let i = 1; i <= 5; i++) { const sz = hepsi(cocuk(hepsi(kok, ad)[0], `a:lvl${i}pPr`) ?? { cocuk: [] }, 'a:defRPr')[0]?.oz.sz; if (sz) lvl[i] = Number(sz) / 100; }
      o[anahtar] = lvl;
    }
    return o;
  };

  const y = new Yazici({ sayfa: { genislik: W, yukseklik: H, kenar: { ust: 0, alt: 0, sol: 0, sag: 0 } }, bloklar: [] });
  y.doc = await PDFDocument.create();
  y.doc.setTitle(dosyaAdi.replace(/\.pptx$/i, '').slice(0, 200));
  const donuk = { v: 0 };

  for (let si = 0; si < slaytYollari.length; si++) {
    ilerleme?.(si, slaytYollari.length, `Slayt ${si + 1} yerleştiriliyor…`);
    const yol = slaytYollari[si];
    const kok = xmlAyristir(strFromU8(z[yol]));
    const rel = iliskiler(z, relYolu(yol));
    const duzenYolu = [...rel.values()].find((r) => /slideLayout$/.test(r.Type ?? ''))?.Target;
    const duzenDosya = duzenYolu ? gerceYol(yol, duzenYolu) : null;
    const duzenKok = duzenDosya && z[duzenDosya] ? xmlAyristir(strFromU8(z[duzenDosya])) : null;
    const duzenRel = duzenDosya ? iliskiler(z, relYolu(duzenDosya)) : new Map();
    const anaYolu = [...duzenRel.values()].find((r) => /slideMaster$/.test(r.Type ?? ''))?.Target;
    const anaDosya = anaYolu ? gerceYol(duzenDosya, anaYolu) : null;
    const anaKok = anaDosya && z[anaDosya] ? xmlAyristir(strFromU8(z[anaDosya])) : null;
    const anaRel = anaDosya ? iliskiler(z, relYolu(anaDosya)) : new Map();
    const stiller = anaKok ? metinStilleri(anaKok) : { baslik: {}, govde: {}, diger: {} };

    // yer tutucu konumları (düzen ve ana slayttan)
    const phKonum = new Map();
    for (const k of [anaKok, duzenKok]) {
      if (!k) continue;
      for (const sp of hepsi(k, 'p:sp')) {
        const ph = yerTutucu(sp); const x = xfrmOku(cocuk(sp, 'p:spPr') ?? sp);
        if (ph && x) { phKonum.set(`${ph.tur}|${ph.idx ?? ''}`, x); phKonum.set(`${ph.tur}|`, x); if (ph.idx) phKonum.set(`idx|${ph.idx}`, x); }
      }
    }

    y.yeniSayfa();
    const sayfa = y.sayfa;
    // arka plan
    const bgDolgu = (k) => { const bg = hepsi(k ?? { cocuk: [] }, 'p:bg')[0]; return renkOku(hepsi(bg ?? { cocuk: [] }, 'a:solidFill')[0], tema); };
    const arka = bgDolgu(kok) ?? bgDolgu(duzenKok) ?? bgDolgu(anaKok) ?? (tema.lt1 ?? '#ffffff');
    { const r = hexRenk(arka); sayfa.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(r.r, r.g, r.b) }); }
    const bgGrad = hepsi(cocuk(kok, 'p:cSld') ?? { cocuk: [] }, 'a:gradFill').length;
    if (bgGrad) uyarilar.add('Gradyan/desenli dolgular düz renge çevrildi ya da atlandı.');

    const donusum = (g) => (g ? { x: g.x, y: g.y, w: g.w, h: g.h } : null);

    /** Bir şekil ağacındaki öğeleri çizer. dönüşüm: grup dönüşümü (x'=ox+(x-cx)*sx) */
    const agacCiz = async (sozcuk, rels, dosyaYolu, { yalnizDekor = false, don = { ox: 0, oy: 0, cx: 0, cy: 0, sx: 1, sy: 1 } } = {}) => {
      for (const o of sozcuk.cocuk) {
        if (o.ad === 'p:grpSp') {
          const gx = hepsi({ cocuk: cocuk(o, 'p:grpSpPr')?.cocuk ?? [] }, 'a:xfrm')[0];
          if (gx) {
            const off = cocuk(gx, 'a:off'), ext = cocuk(gx, 'a:ext'), co = cocuk(gx, 'a:chOff'), ce = cocuk(gx, 'a:chExt');
            const sx = ce && Number(ce.oz.cx) ? Number(ext.oz.cx) / Number(ce.oz.cx) : 1, sy = ce && Number(ce.oz.cy) ? Number(ext.oz.cy) / Number(ce.oz.cy) : 1;
            await agacCiz(o, rels, dosyaYolu, { yalnizDekor, don: { ox: Number(off.oz.x) * EMU, oy: Number(off.oz.y) * EMU, cx: Number(co?.oz.x ?? 0) * EMU, cy: Number(co?.oz.y ?? 0) * EMU, sx, sy } });
          } else await agacCiz(o, rels, dosyaYolu, { yalnizDekor, don });
          continue;
        }
        const uygula = (g) => (g ? { x: don.ox + (g.x - don.cx) * don.sx, y: don.oy + (g.y - don.cy) * don.sy, w: g.w * don.sx, h: g.h * don.sy, don: g.don } : null);
        if (o.ad === 'p:pic') {
          const g = uygula(xfrmOku(cocuk(o, 'p:spPr') ?? o));
          const id = hepsi(o, 'a:blip')[0]?.oz['r:embed'];
          const hedef = id ? rels.get(id)?.Target : null;
          const veri = hedef ? z[gerceYol(dosyaYolu, hedef)] : null;
          const bicim = veri ? resimBicimi(veri) : null;
          if (!g) continue;
          if (!bicim) { if (veri) uyarilar.add('PNG/JPEG dışındaki resimler (EMF, WMF, GIF, SVG…) aktarılmadı.'); continue; }
          try {
            const img = bicim === 'png' ? await y.doc.embedPng(veri) : await y.doc.embedJpg(veri);
            sayfa.drawImage(img, { x: g.x, y: H - g.y - g.h, width: g.w, height: g.h });
            bilgi.resim++;
          } catch { uyarilar.add('Bazı resimler okunamadığı için atlandı.'); }
          if (g.don) donuk.v++;
          continue;
        }
        if (o.ad === 'p:graphicFrame') {
          const tbl = hepsi(o, 'a:tbl')[0];
          const g = uygula(xfrmOku({ cocuk: [cocuk(o, 'p:xfrm') ? { ad: 'a:xfrm', oz: {}, cocuk: cocuk(o, 'p:xfrm').cocuk } : null].filter(Boolean) }) ?? null) ?? (() => { const x = cocuk(o, 'p:xfrm'); return x ? uygula({ x: sayi(cocuk(x, 'a:off').oz.x, EMU), y: sayi(cocuk(x, 'a:off').oz.y, EMU), w: sayi(cocuk(x, 'a:ext').oz.cx, EMU), h: sayi(cocuk(x, 'a:ext').oz.cy, EMU) }) : null; })();
          if (tbl && g && !yalnizDekor) {
            const kolonlar = cocuklar(cocuk(tbl, 'a:tblGrid'), 'a:gridCol').map((c) => Number(c.oz.w));
            const satirlar = cocuklar(tbl, 'a:tr').map((tr, ri) => cocuklar(tr, 'a:tc').map((tc) => {
              const parcalar = [];
              for (const p of hepsi(cocuk(tc, 'a:txBody') ?? { cocuk: [] }, 'a:p')) for (const r of cocuklar(p, 'a:r')) { const rp = cocuk(r, 'a:rPr'); parcalar.push({ metin: cocuk(r, 'a:t')?.metin ?? '', boyut: sayi(rp?.oz.sz, 0.01) ?? 12, kalin: rp?.oz.b === '1' || ri === 0, italik: rp?.oz.i === '1', aile: 'liberation-sans' }); }
              return { bloklar: [{ tur: 'p', parcalar, sonra: 0 }], birlesim: Number(tc.oz.gridSpan ?? 1), dolgu: renkOku(hepsi(cocuk(tc, 'a:tcPr') ?? { cocuk: [] }, 'a:solidFill')[0], tema) };
            }));
            const eskiKenar = { ...y.kenar }, eskiG = y.icG, eskiY = y.y, eskiYuk = y.Y;
            y.kenar = { ust: 0, alt: 0, sol: g.x, sag: 0 }; y.icG = g.w; y.y = H - g.y;
            await y.tablo({ kolonlar, satirlar, boyut: 12, kenarlik: true });
            y.kenar = eskiKenar; y.icG = eskiG; y.y = eskiY; y.Y = eskiYuk;
            bilgi.tablo++;
          } else if (!tbl) uyarilar.add('Grafikler, SmartArt ve diğer nesneler aktarılmadı.');
          continue;
        }
        if (o.ad === 'p:sp' || o.ad === 'p:cxnSp') {
          const ph = o.ad === 'p:sp' ? yerTutucu(o) : null;
          if (yalnizDekor && ph) continue;
          const spPr = cocuk(o, 'p:spPr');
          let g = uygula(xfrmOku(spPr ?? o));
          if (!g && ph) { const k = phKonum.get(`${ph.tur}|${ph.idx ?? ''}`) ?? phKonum.get(`idx|${ph.idx}`) ?? phKonum.get(`${ph.tur}|`) ?? (ph.tur === 'ctrTitle' ? phKonum.get('title|') : null); g = uygula(k); }
          if (!g) continue;
          if (g.don) donuk.v++;
          const dolgu = renkOku(cocuk(spPr, 'a:solidFill'), tema);
          if (cocuk(spPr, 'a:gradFill') || cocuk(spPr, 'a:pattFill')) uyarilar.add('Gradyan/desenli dolgular düz renge çevrildi ya da atlandı.');
          const cizgi = cocuk(spPr, 'a:ln') && !cocuk(cocuk(spPr, 'a:ln'), 'a:noFill') ? renkOku(cocuk(cocuk(spPr, 'a:ln'), 'a:solidFill'), tema) : null;
          if (dolgu || cizgi) {
            const d = dolgu ? hexRenk(dolgu) : null, c = cizgi ? hexRenk(cizgi) : null;
            sayfa.drawRectangle({ x: g.x, y: H - g.y - g.h, width: g.w, height: g.h, ...(d ? { color: rgb(d.r, d.g, d.b) } : {}), ...(c ? { borderColor: rgb(c.r, c.g, c.b), borderWidth: 0.75 } : {}) });
          }
          const tx = cocuk(o, 'p:txBody');
          if (tx && !yalnizDekor) await metinCiz(tx, g, ph, stiller);
          continue;
        }
      }
    };

    const metinCiz = async (tx, g, ph, stiller) => {
      const bp = cocuk(tx, 'a:bodyPr');
      const sol = sayi(bp?.oz.lIns, EMU) ?? 7.2, sag = sayi(bp?.oz.rIns, EMU) ?? 7.2, ust = sayi(bp?.oz.tIns, EMU) ?? 3.6, alt = sayi(bp?.oz.bIns, EMU) ?? 3.6;
      const olcek = (sayi(cocuk(bp, 'a:normAutofit')?.oz.fontScale, 0.00001) ?? 1);
      const baslikMi = ph && /title/i.test(ph.tur);
      const govdeMi = ph && !baslikMi;
      const iG = Math.max(10, g.w - sol - sag);
      const kurulu = [];
      let toplam = 0;
      for (const p of cocuklar(tx, 'a:p')) {
        const pPr = cocuk(p, 'a:pPr');
        const sv = Number(pPr?.oz.lvl ?? 0) + 1;
        const varsayilanBoyut = (baslikMi ? stiller.baslik[1] ?? 40 : govdeMi ? stiller.govde[sv] ?? 24 : stiller.diger[1] ?? 18);
        const parcalar = [];
        for (const c of p.cocuk) {
          if (c.ad === 'a:r' || c.ad === 'a:fld') {
            const rp = cocuk(c, 'a:rPr');
            const renk = renkOku(cocuk(rp, 'a:solidFill'), tema) ?? '#000000';
            const url = null;
            parcalar.push({
              metin: cocuk(c, 'a:t')?.metin ?? '', boyut: (sayi(rp?.oz.sz, 0.01) ?? varsayilanBoyut) * olcek, kalin: rp?.oz.b === '1' || (baslikMi && rp?.oz.b !== '0' && false), italik: rp?.oz.i === '1', altCizgi: !!rp?.oz.u && rp.oz.u !== 'none',
              renk, aile: aileEsle(cocuk(rp, 'a:latin')?.oz.typeface ?? ''), url,
            });
          } else if (c.ad === 'a:br') parcalar.push({ kes: true, boyut: varsayilanBoyut * olcek });
        }
        const buChar = cocuk(pPr, 'a:buChar')?.oz.char, buSayi = cocuk(pPr, 'a:buAutoNum');
        const madde = buChar ? (buChar === '' || buChar === '§' ? '•' : buChar) : buSayi ? '1.' : undefined;
        const hiza = { ctr: 'orta', r: 'sag', just: 'iki', l: 'sol' }[pPr?.oz.algn ?? 'l'] ?? 'sol';
        const k = await y.satirKur(parcalar, iG - (madde ? 16 : 0), { hiza });
        kurulu.push({ k, madde, parcalar });
        toplam += k.yukseklik;
      }
      // taşan metni kutuya sığacak kadar küçült (PowerPoint "otomatik sığdır" davranışı gibi), en fazla %55'e
      let oran = 1;
      if (toplam > g.h - ust - alt && toplam > 0) oran = Math.max(0.55, (g.h - ust - alt) / toplam);
      let yy = g.y + ust;
      const anchor = bp?.oz.anchor ?? 't';
      let yukseklik = toplam * oran;
      if (anchor === 'ctr') yy = g.y + Math.max(ust, (g.h - yukseklik) / 2); else if (anchor === 'b') yy = g.y + Math.max(ust, g.h - alt - yukseklik);
      for (const { k, madde, parcalar } of kurulu) {
        let kk = k;
        if (oran < 1) kk = await y.satirKur(parcalar.map((p) => (p.kes ? { ...p, boyut: p.boyut * oran } : { ...p, boyut: p.boyut * oran })), iG - (madde ? 16 : 0), { hiza: k.satirlar[0]?.hiza ?? 'sol' });
        let first = true;
        for (const s of kk.satirlar) {
          if (madde && first) { const f0 = s.ogeler[0]?.segler[0]; if (f0) sayfa.drawText(madde, { x: g.x + sol, y: H - yy - s.boyut * 0.92, size: s.boyut, font: f0.font }); }
          y.sayfa = sayfa;
          y.satirCiz(s, g.x + sol + (madde ? 16 : 0), H - yy, iG - (madde ? 16 : 0));
          yy += s.yukseklik;
          first = false;
        }
      }
      if (oran < 0.999) uyarilar.add('Kutuya sığmayan metinler küçültüldü (PowerPoint’teki “otomatik sığdır” gibi).');
      bilgi.metinKutusu++;
    };

    const slaytAgaci = hepsi(kok, 'p:spTree')[0];
    const gizliDekor = kok.oz.showMasterSp === '0';
    if (!gizliDekor) {
      if (anaKok) await agacCiz(hepsi(anaKok, 'p:spTree')[0], anaRel, anaDosya, { yalnizDekor: true });
      if (duzenKok) await agacCiz(hepsi(duzenKok, 'p:spTree')[0], duzenRel, duzenDosya, { yalnizDekor: true });
    }
    if (slaytAgaci) await agacCiz(slaytAgaci, rel, yol);
    y.baglantilar.length = 0;
    bilgi.slayt++;
  }
  if (donuk.v) uyarilar.add('Döndürülmüş nesneler döndürülmeden yerleştirildi.');
  if (Object.keys(z).some((d) => /^ppt\/(media|embeddings)\/.+\.(mp4|mov|wmv|mp3|wav)$/i.test(d))) uyarilar.add('Gömülü video/ses dosyaları aktarılmadı.');
  if (Object.keys(z).some((d) => /^ppt\/(charts|diagrams)\/[^/]+\.xml$/.test(d))) uyarilar.add('Grafikler ve SmartArt diyagramları aktarılmadı.');
  const cikti = await kaydet(y.doc);
  return {
    bayt: cikti, sayfa: bilgi.slayt, bilgi,
    uyarilar: ['PowerPoint’in görünümü birebir üretilmez: animasyonlar/geçişler yok sayılır, tema renkleri ve yazı boyutları şablondan yaklaşık okunur, şekiller dikdörtgen çizilir. Sonucu kontrol edin.', ...uyarilar],
  };
}
