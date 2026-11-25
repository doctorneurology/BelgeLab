// Aşama 1 — Analiz: her sayfanın içerik akışını (ve iç içe form nesnelerini) adım adım yorumlar;
// her yazı komutunun konumunu, boyutunu, rengini, yazı tipini çıkarır; bunlardan satırları kurar.
// Üst/alt bilgi, logo yazısı, süslü yazı tipi, döndürülmüş/dikey yazı "korumalı" işaretlenir.

import { PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, PDFStream, PDFNumber, decodePDFRawStream } from 'pdf-lib';
import { akisCoz, carp, ters, uygula } from './akis.js';
import { yaziTipiCoz, aileOner, yaziTipiAdi } from './font.js';
import { gorunurDonusum } from '../cizim.js';
import { yaziTipiOlcer, YAZI_AILELERI } from '../fonts.js';

const ad = (s) => PDFName.of(s);
const MARKA = [37, 80, 68, 70, 65, 82, 65, 67, 76, 65, 82, 73]; // "%PDFARACLARI"

/** Kabul sınırları (pt / oran). Rapor ve testler bunları kullanır. */
export const SINIR = {
  olcek: 0.03, // en fazla %3 yatay ölçek / harf aralığı ayarı
  kelimeSapma: 0.3, // ölçek sonrası bir kelimenin bitişinde kalan en büyük fark (pt)
  konum: 0.5, // doğrulamada satır başlangıç / bitiş / taban çizgisi sapma sınırı (pt)
};

export const KORUMA_ADI = {
  ustalt: 'Üst/alt bilgi (sayfalar arasında tekrar ediyor)',
  logo: 'Logo yazısı (resimle iç içe)',
  suslu: 'Süslü / sembol yazı tipi',
  donuk: 'Döndürülmüş ya da eğik yazı',
  dikey: 'Dikey yazı',
  ozel: 'Özel efektli yazı (görünmez, kırpma ya da çizimle yazı tipi)',
  cozulemedi: 'Karakterleri çözülemedi',
};

export function akisBaytlari(nesne) {
  if (nesne instanceof PDFRawStream) return decodePDFRawStream(nesne).decode();
  if (nesne instanceof PDFStream) return nesne.getContents();
  return new Uint8Array(0);
}

function isaretliMi(b) {
  for (let k = 0; k < MARKA.length; k++) if (b[k] !== MARKA[k]) return false;
  return true;
}

/** Sayfanın içerik akışlarını gruplar: art arda gelen (bu programın işaretlemediği) akışlar bir grup. */
export function sayfaAkislari(doc, page) {
  page.node.normalize();
  const dizi = page.node.Contents();
  const duzen = []; // {tur:'grup', grup} | {tur:'isaretli', ref}
  const gruplar = [];
  if (!(dizi instanceof PDFArray)) return { duzen, gruplar };
  let akim = null;
  for (let i = 0; i < dizi.size(); i++) {
    const ref = dizi.get(i);
    const nesne = doc.context.lookup(ref);
    let bayt;
    try { bayt = akisBaytlari(nesne); } catch { bayt = new Uint8Array(0); }
    if (isaretliMi(bayt)) { duzen.push({ tur: 'isaretli', ref }); akim = null; continue; }
    if (!akim) { akim = { refler: [], parcalar: [] }; gruplar.push(akim); duzen.push({ tur: 'grup', grup: akim }); }
    akim.refler.push(ref);
    akim.parcalar.push(bayt);
  }
  for (const g of gruplar) {
    const top = g.parcalar.reduce((s, p) => s + p.length + 1, 0);
    g.bayt = new Uint8Array(top);
    let o = 0;
    for (const p of g.parcalar) { g.bayt.set(p, o); o += p.length; g.bayt[o++] = 10; }
    delete g.parcalar;
  }
  return { duzen, gruplar };
}

const sayiAl = (j, v = 0) => (j && j.t === 'sayi' ? j.v : v);
const hex2 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
const rgbHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function renkHex(uzay, degerler) {
  const d = degerler;
  if (uzay === 1 || d.length === 1) return rgbHex(d[0], d[0], d[0]);
  if (uzay === 3 || d.length === 3) return rgbHex(d[0], d[1], d[2]);
  if (uzay === 4 || d.length === 4) return rgbHex((1 - d[0]) * (1 - d[3]), (1 - d[1]) * (1 - d[3]), (1 - d[2]) * (1 - d[3]));
  return '#000000';
}

// ---- Yorumlayıcı -----------------------------------------------------------------------------------

class Yorumlayici {
  constructor(doc, sayfaNo, U2V, fontOnbellek) {
    this.doc = doc;
    this.ctx = doc.context;
    this.sayfaNo = sayfaNo;
    this.U2V = U2V;
    this.fontlar = fontOnbellek;
    this.parcalar = [];
    this.resimler = [];
    this.dugumler = [];
  }

  fontGetir(kaynak, isim) {
    const F = kaynak?.lookup(ad('Font'));
    const ref = F instanceof PDFDict ? F.get(ad(isim)) : null;
    if (!ref) return null;
    const anahtar = ref instanceof PDFRef ? ref.tag : ref;
    if (!this.fontlar.has(anahtar)) this.fontlar.set(anahtar, yaziTipiCoz(this.ctx, ref));
    const f = this.fontlar.get(anahtar);
    if (!f.anahtar) f.anahtar = `d${this.fontlar.size}`;
    return f;
  }

  renkUzayi(kaynak, isim) {
    if (isim === 'DeviceGray' || isim === 'G') return 1;
    if (isim === 'DeviceRGB' || isim === 'RGB') return 3;
    if (isim === 'DeviceCMYK' || isim === 'CMYK') return 4;
    if (isim === 'Pattern') return -1;
    const CS = kaynak?.lookup(ad('ColorSpace'));
    const cs = CS instanceof PDFDict ? CS.lookup(ad(isim)) : null;
    if (cs instanceof PDFArray) {
      const tur = cs.lookup(0);
      const t = tur instanceof PDFName ? tur.decodeText() : '';
      if (t === 'ICCBased') {
        const s = cs.lookup(1);
        const n = s instanceof PDFStream ? s.dict.lookup(ad('N')) : null;
        return n instanceof PDFNumber ? n.asNumber() : 3;
      }
      if (t === 'Pattern') return -1;
      if (t === 'CalRGB' || t === 'Lab') return 3;
      if (t === 'CalGray') return 1;
      return 0; // Separation, DeviceN, Indexed: renk yaklaşık
    }
    return 0;
  }

  /** Bir akış düğümünü (sayfa grubu ya da form) yorumlar. */
  calistir(dugum, kaynak, gs, yigin = []) {
    this.dugumler.push(dugum);
    const ops = dugum.ops;
    const kayit = [];
    let T = null; // {Tlm, dx}
    let yol = []; // kırpma yolu (W) için biriken yol noktaları (görünür koordinat)
    for (let i = 0; i < ops.length; i++) {
      const { op, args } = ops[i];
      // Kırpma kutuları: bazı belgelerde her yazı parçası kendi dar hücresine kırpılır (W n). Düzeltilen satır o hücreye
      // sığmazsa görünmez kalırdı; bu yüzden etkin kırpma kutuları parçaya kaydedilir (bkz. yeniden.js → kirpmaKaldir).
      if (op === 'm' || op === 'l') { if (args.length >= 2) yol.push(uygula(gs.ctm, sayiAl(args[0]), sayiAl(args[1]))); }
      else if (op === 're' && args.length >= 4) {
        const [x, y, w, h] = args.map((a) => sayiAl(a));
        for (const [dx, dy] of [[0, 0], [w, 0], [0, h], [w, h]]) yol.push(uygula(gs.ctm, x + dx, y + dy));
      } else if (op === 'c' && args.length >= 6) { for (let k = 0; k < 6; k += 2) yol.push(uygula(gs.ctm, sayiAl(args[k]), sayiAl(args[k + 1]))); }
      else if (op === 'W' || op === 'W*') {
        if (yol.length) {
          const xs = yol.map((q) => q[0]), ys = yol.map((q) => q[1]);
          gs.kirplar = [...(gs.kirplar ?? []), { dugum, i, kutu: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } }];
        }
      } else if (['n', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'S', 's'].includes(op)) yol = [];
      switch (op) {
        case 'q': kayit.push(gsKopya(gs)); break;
        case 'Q': if (kayit.length) gs = kayit.pop(); break;
        case 'cm': if (args.length >= 6) gs.ctm = carp(args.slice(0, 6).map((a) => sayiAl(a)), gs.ctm); break;
        case 'g': case 'rg': case 'k': {
          const d = args.map((a) => sayiAl(a));
          gs.renk = { hex: renkHex(d.length, d), ham: [{ dugum, i, op }], adli: false, desen: false, uzay: d.length };
          break;
        }
        case 'cs': {
          const isim = args[0]?.v ?? '';
          const uzay = this.renkUzayi(kaynak, isim);
          const adli = !/^Device(Gray|RGB|CMYK)$/.test(isim);
          gs.renk = { hex: '#000000', ham: [{ dugum, i, op }], adli, desen: uzay === -1, uzay };
          break;
        }
        case 'sc': case 'scn': {
          const d = args.filter((a) => a.t === 'sayi').map((a) => a.v);
          const onceki = gs.renk.ham.filter((h) => h.op === 'cs');
          gs.renk = { ...gs.renk, hex: gs.renk.uzay > 0 ? renkHex(gs.renk.uzay, d) : gs.renk.hex, ham: [...onceki, { dugum, i, op }], desen: gs.renk.desen || args.some((a) => a.t === 'ad') };
          break;
        }
        case 'gs': {
          const E = kaynak?.lookup(ad('ExtGState'));
          const e = E instanceof PDFDict ? E.lookup(ad(args[0]?.v ?? '')) : null;
          if (e instanceof PDFDict && e.has(ad('Font'))) gs.gsFont = true;
          break;
        }
        case 'BT': T = { Tlm: [1, 0, 0, 1, 0, 0], dx: 0 }; break;
        case 'ET': T = null; break;
        case 'Tf': gs.fontAd = args[0]?.v ?? null; gs.font = gs.fontAd ? this.fontGetir(kaynak, gs.fontAd) : null; gs.Tfs = sayiAl(args[1]); break;
        case 'Tc': gs.Tc = sayiAl(args[0]); break;
        case 'Tw': gs.Tw = sayiAl(args[0]); break;
        case 'Tz': gs.Th = sayiAl(args[0], 100) / 100; break;
        case 'TL': gs.TL = sayiAl(args[0]); break;
        case 'Tr': gs.Tr = sayiAl(args[0]); break;
        case 'Ts': gs.Ts = sayiAl(args[0]); break;
        case 'Td': case 'TD':
          if (!T) break;
          if (op === 'TD') gs.TL = -sayiAl(args[1]);
          T.Tlm = carp([1, 0, 0, 1, sayiAl(args[0]), sayiAl(args[1])], T.Tlm); T.dx = 0; break;
        case 'Tm': if (T && args.length >= 6) { T.Tlm = args.slice(0, 6).map((a) => sayiAl(a)); T.dx = 0; } break;
        case 'T*': if (T) { T.Tlm = carp([1, 0, 0, 1, 0, -gs.TL], T.Tlm); T.dx = 0; } break;
        case "'": case '"': case 'Tj': case 'TJ': {
          if (!T) break;
          if (op === '"') { gs.Tw = sayiAl(args[0]); gs.Tc = sayiAl(args[1]); }
          if (op === "'" || op === '"') { T.Tlm = carp([1, 0, 0, 1, 0, -gs.TL], T.Tlm); T.dx = 0; }
          const ogeler = op === 'TJ' ? (args[0]?.t === 'dizi' ? args[0].v : []) : [args[args.length - 1]];
          this.yaziKaydet(dugum, i, op, ogeler, gs, T);
          break;
        }
        case 'Do': {
          const isim = args[0]?.v;
          const X = kaynak?.lookup(ad('XObject'));
          const ref = X instanceof PDFDict ? X.get(ad(isim)) : null;
          const x = ref ? this.ctx.lookup(ref) : null;
          if (!(x instanceof PDFStream)) break;
          const tur = x.dict.lookup(ad('Subtype'));
          if (tur instanceof PDFName && tur.decodeText() === 'Form') {
            const tag = ref instanceof PDFRef ? ref.tag : null;
            if (yigin.length > 12 || (tag && yigin.includes(tag))) break;
            const M = x.dict.lookup(ad('Matrix'));
            const mat = M instanceof PDFArray && M.size() === 6 ? M.asArray().map((v) => this.ctx.lookup(v)?.asNumber?.() ?? 0) : [1, 0, 0, 1, 0, 0];
            const r = x.dict.lookup(ad('Resources'));
            let bayt;
            try { bayt = akisBaytlari(x); } catch { break; }
            const alt = { id: `${dugum.id}/${i}`, tur: 'form', ref, isim, ust: dugum, doIdx: i, bayt, ops: akisCoz(bayt), kaynak: r instanceof PDFDict ? r : kaynak };
            const g2 = gsKopya(gs);
            g2.ctm = carp(mat, gs.ctm);
            this.calistir(alt, alt.kaynak, g2, tag ? [...yigin, tag] : yigin);
          } else {
            this.resimler.push(kutuDonustur(carp(gs.ctm, this.U2V)));
          }
          break;
        }
        case 'BI': this.resimler.push(kutuDonustur(carp(gs.ctm, this.U2V))); break;
        default: break;
      }
    }
  }

  yaziKaydet(dugum, opIdx, op, ogeler, gs, T) {
    const font = gs.font;
    if (!font) return;
    const L = carp(carp(T.Tlm, gs.ctm), this.U2V);
    const dx0 = T.dx;
    const glifler = [];
    const { Tfs, Th, Tc, Tw, Ts } = gs;
    for (const o of ogeler) {
      if (!o) continue;
      if (o.t === 'sayi') { T.dx -= (o.v / 1000) * Tfs * Th; continue; }
      if (o.t !== 'yazi') continue;
      for (const g of font.kodla(o.v)) {
        const tx = ((g.w / 1000) * Tfs + Tc + (g.bosluk && !font.cokBayt ? Tw : 0)) * Th;
        const [x, y] = uygula(L, T.dx, Ts);
        glifler.push({ uni: g.uni, x, y, adv: L[0] * tx, advY: L[1] * tx, bosluk: g.uni != null && g.uni.trim() === '' });
        T.dx += tx;
      }
    }
    const boyut = Math.hypot(L[2], L[3]) * Math.abs(Tfs);
    const yatay = Math.abs(L[1]) <= 1e-4 * Math.abs(L[0]) && Math.abs(L[2]) <= 1e-4 * Math.abs(L[3]) && L[0] > 0 && L[3] > 0 && Tfs > 0 && Th > 0;
    const [, yTaban] = uygula(L, dx0, 0);
    this.parcalar.push({
      no: this.parcalar.length, sayfa: this.sayfaNo, dugum, opIdx, op, font, fontAd: gs.fontAd,
      Tfs, Tc, Tw, Th, Ts, Tr: gs.Tr, Tlm: T.Tlm.slice(), dx0, dxSon: T.dx, ctm: gs.ctm.slice(),
      glifler, yatay, aci: (Math.atan2(L[1], L[0]) * 180) / Math.PI, boyut,
      hOlcek: yatay ? (L[0] * Tfs * Th) / boyut : 1, cVis: yatay ? Tc * Th * L[0] : 0,
      y: yatay ? yTaban + L[3] * Ts : 0, yukselme: yatay ? L[3] * Ts : 0,
      renk: gs.renk, gsFont: !!gs.gsFont, kirplar: gs.kirplar ?? [],
    });
  }
}

function gsKopya(g) { return { ...g, ctm: g.ctm.slice(), renk: { ...g.renk } }; }

function kutuDonustur(M) {
  const n = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => uygula(M, x, y));
  const xs = n.map((p) => p[0]), ys = n.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function baslangicGs() {
  return {
    ctm: [1, 0, 0, 1, 0, 0], renk: { hex: '#000000', ham: [], adli: false, desen: false, uzay: 1 },
    font: null, fontAd: null, Tfs: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, Tr: 0, Ts: 0, gsFont: false,
  };
}

// ---- Satır kurma -------------------------------------------------------------------------------------

const BOSLUK_ESIGI = 0.15; // em: bu kadar boşluk varsa araya boşluk karakteri koy
const PARCA_BOLME = 1.2; // em: bir komut içinde bu kadar boşluk varsa ayrı parçalara böl

function segmentlereBol(p) {
  if (!p.yatay) return [{ parca: p, glifler: p.glifler.map((g, k) => ({ ...g, k })) }];
  const sonuc = [];
  let akim = null;
  p.glifler.forEach((g, k) => {
    const gg = { ...g, k };
    if (akim) {
      const son = akim.glifler[akim.glifler.length - 1];
      const bosluk = g.x - (son.x + son.adv);
      if (bosluk > PARCA_BOLME * p.boyut || bosluk < -0.5 * p.boyut) akim = null;
    }
    if (!akim) { akim = { parca: p, glifler: [] }; sonuc.push(akim); }
    akim.glifler.push(gg);
  });
  for (const s of sonuc) {
    const g0 = s.glifler[0], gs = s.glifler[s.glifler.length - 1];
    s.x0 = g0.x; s.x1 = gs.x + gs.adv; s.y = p.y; s.boyut = p.boyut;
  }
  return sonuc.filter((s) => s.glifler.some((g) => !g.bosluk));
}

function satirMetni(segs) {
  // Satırın gliflerini soldan sağa dizip metni ve karakter → glif eşlemesini kurar.
  let metin = '';
  const harita = []; // her karakter için {seg, glif}
  let onceki = null;
  for (const s of segs) {
    for (const g of s.glifler) {
      const boyut = s.parca.boyut;
      if (onceki) {
        const bosluk = g.x - onceki.son;
        const sonBosluk = /\s$/.test(metin);
        if (!sonBosluk && !g.bosluk && bosluk > BOSLUK_ESIGI * boyut) { metin += ' '; harita.push({ seg: onceki.seg, glif: null, sanal: true }); }
      }
      let u = g.uni ?? '�';
      u = u.replace(/[ﬀ-ﬆ]/g, (c) => c.normalize('NFKC'));
      if (g.bosluk) u = ' ';
      if (u === ' ' && /\s$/.test(metin)) { onceki = { son: g.x + g.adv, seg: s }; continue; }
      for (const ch of u) { metin += ch; harita.push({ seg: s, glif: g }); }
      onceki = { son: g.x + g.adv, seg: s };
    }
  }
  return { metin: metin.replace(/\s+$/, ''), harita };
}

function satirlariKur(parcalar, sayfaNo) {
  const segs = parcalar.flatMap(segmentlereBol);
  const yatay = segs.filter((s) => s.parca.yatay);
  const diger = segs.filter((s) => !s.parca.yatay);
  yatay.sort((a, b) => b.y - a.y || a.x0 - b.x0);

  // 1) Aynı taban çizgisindeki parçaları kümelere ayır
  const kumeler = [];
  for (const s of yatay) {
    let k = kumeler.find((c) => Math.abs(c.y - s.y) <= 0.2 * Math.min(c.boyut, s.boyut) && Math.abs(c.boyut - s.boyut) <= 0.35 * Math.max(c.boyut, s.boyut));
    if (!k) { k = { y: s.y, boyut: s.boyut, segs: [] }; kumeler.push(k); }
    k.segs.push(s);
  }
  // 2) Küme içinde soldan sağa, büyük boşlukta böl → satır adayları
  let adaylar = [];
  for (const k of kumeler) {
    k.segs.sort((a, b) => a.x0 - b.x0);
    // İki yana yaslı kısa satırlarda kelime araları geniş olabilir: aralıklar birbirine yakınsa
    // (düzenli) ve 2,5 em'i aşmıyorsa tek satır sayılır; düzensiz büyük boşluk ise sütun/tablo ayrımıdır.
    const gaps = [];
    for (let j = 1; j < k.segs.length; j++) gaps.push(k.segs[j].x0 - k.segs[j - 1].x1);
    const genis = gaps.filter((g) => g > 0.15 * k.boyut);
    const duzenli = genis.length >= 3 && Math.max(...genis) <= 1.6 * Math.min(...genis) && Math.max(...genis) <= 2.5 * k.boyut;
    let akim = null;
    for (const s of k.segs) {
      if (akim) {
        const bosluk = s.x0 - akim.x1;
        const sinir = (duzenli ? 2.5 : PARCA_BOLME) * Math.max(akim.boyut, s.boyut);
        if (bosluk > sinir || bosluk < -0.3 * Math.min(akim.boyut, s.boyut)) akim = null;
      }
      if (!akim) { akim = { segs: [], x0: s.x0, x1: s.x1, y: s.y, boyut: s.boyut }; adaylar.push(akim); }
      akim.segs.push(s);
      akim.x1 = Math.max(akim.x1, s.x1);
    }
  }
  // 3) Üst/alt simge (küçük, kaymış taban çizgisi) → bitişik satıra ekle
  adaylar.sort((a, b) => a.boyut - b.boyut);
  const birlesen = new Set();
  for (const a of adaylar) {
    const hedef = adaylar.find((b) => b !== a && !birlesen.has(b) && b.boyut >= a.boyut / 0.85 &&
      a.y - b.y <= 0.6 * b.boyut && b.y - a.y <= 0.4 * b.boyut &&
      a.x0 <= b.x1 + 0.5 * b.boyut && a.x1 >= b.x0 - 0.5 * b.boyut);
    if (hedef && !birlesen.has(a)) {
      hedef.segs.push(...a.segs);
      hedef.x0 = Math.min(hedef.x0, a.x0); hedef.x1 = Math.max(hedef.x1, a.x1);
      birlesen.add(a);
    }
  }
  adaylar = adaylar.filter((a) => !birlesen.has(a));
  for (const s of diger) adaylar.push({ segs: [s], x0: 0, x1: 0, y: 0, boyut: s.parca.boyut, donuk: true });

  adaylar.sort((a, b) => b.y - a.y || a.x0 - b.x0);
  return adaylar.map((a, k) => {
    a.segs.sort((p, q) => p.x0 - q.x0);
    const { metin, harita } = satirMetni(a.segs);
    const ana = a.segs.reduce((m, s) => (s.parca.boyut > m.parca.boyut + 0.01 ? s : m), a.segs[0]);
    let kutu;
    if (a.donuk) {
      const xs = [], ys = [];
      for (const g of a.segs[0].glifler) { xs.push(g.x, g.x + g.adv); ys.push(g.y, g.y + g.advY); }
      const b = a.boyut;
      kutu = { x0: Math.min(...xs) - b * 0.3, y0: Math.min(...ys) - b * 0.3, x1: Math.max(...xs) + b * 0.3, y1: Math.max(...ys) + b * 0.3 };
    } else {
      kutu = { x0: a.x0, x1: a.x1, y0: a.y - 0.25 * a.boyut, y1: a.y + 0.85 * a.boyut };
    }
    return {
      id: `s${sayfaNo}-${k + 1}`, sayfa: sayfaNo, segs: a.segs, harita, metin,
      x0: a.donuk ? kutu.x0 : a.x0, x1: a.donuk ? kutu.x1 : a.x1, y: a.donuk ? kutu.y0 : ana.y, boyut: ana.parca.boyut,
      renk: ana.parca.renk.hex, font: ana.parca.font, kutu, donuk: !!a.donuk,
      koruma: null, uyum: null, hizalama: 'sol',
    };
  });
}

// ---- Koruma kararları ----------------------------------------------------------------------------

const SUSLU = /script|brush|handwrit|comic|zapf|dingbat|wingding|webding|symbol|ornament|decor|fraktur|blackletter|calligra|vivaldi|edwardian|corsiva|mistral|pacifico|lobster|kunstler|chiller|jokerman|curlz|magneto|oldenglish|stencil|nuwave|cmsy|cmmi|cmex|msam|msbm|math|mtextra|euclid|marlett|emoji|fontawesome|commpi|greekwithmathpi|universal-/i;

function korumaBelirle(satir, resimler, sayfaAlani) {
  for (const s of satir.segs) {
    const p = s.parca;
    if (!p.yatay) return 'donuk';
    if (p.font.dikey) return 'dikey';
    if (p.font.type3 || p.gsFont || ![0, 1, 2].includes(p.Tr)) return 'ozel';
  }
  for (const s of satir.segs) {
    const f = s.parca.font;
    if (SUSLU.test(yaziTipiAdi(f).replace(/\s/g, '')) || f.bayrak & 8) return 'suslu';
  }
  for (const s of satir.segs) {
    if (s.parca.font.sorun || s.glifler.some((g) => g.uni == null || g.uni === '' || /[-�]/.test(g.uni))) return 'cozulemedi';
  }
  // Logo yazısı: satırın en az yarısı küçük bir resmin üstünde. Her sayfada aynı yerde duran resimler
  // (filigran/arka plan) sayılmaz; tekrar eden antetli logonun yazısı zaten üst/alt bilgi olarak korunur.
  const k = satir.kutu;
  const kAlan = (k.x1 - k.x0) * (k.y1 - k.y0);
  for (const r of resimler) {
    const alan = (r.x1 - r.x0) * (r.y1 - r.y0);
    if (alan <= 0 || alan > 0.25 * sayfaAlani || r.tekrar) continue;
    const ox = Math.min(k.x1, r.x1) - Math.max(k.x0, r.x0), oy = Math.min(k.y1, r.y1) - Math.max(k.y0, r.y0);
    if (ox > 0 && oy > 0 && ox * oy >= 0.5 * kAlan) return 'logo';
  }
  return null;
}

function normalMetin(m) {
  return m.toLocaleLowerCase('tr').replace(/\d+/g, '#').replace(/\s+/g, '');
}

function ustAltBilgiBul(sayfalar) {
  if (sayfalar.length < 2) return;
  const hepsi = [];
  for (const s of sayfalar) for (const l of s.satirlar) if (!l.donuk && l.metin.trim()) hepsi.push({ s, l, n: normalMetin(l.metin) });
  for (const a of hepsi) {
    const tekrar = new Set([a.s.no]);
    for (const b of hepsi) {
      if (b.s === a.s || b.n !== a.n) continue;
      const ayniYer = Math.abs(a.l.y - b.l.y) <= 2 && (Math.abs(a.l.x0 - b.l.x0) <= 2 || Math.abs(a.l.x1 - b.l.x1) <= 2 ||
        Math.abs((a.l.x0 + a.l.x1) - (b.l.x0 + b.l.x1)) <= 4);
      if (ayniYer) tekrar.add(b.s.no);
    }
    const h = a.s.yukseklik;
    const kenarda = a.l.y > h * 0.8 || a.l.y < h * 0.2;
    if ((kenarda && tekrar.size >= 2) || tekrar.size >= Math.max(3, Math.ceil(sayfalar.length * 0.5))) a.l.ustalt = true;
  }
}

// ---- Hizalama ----------------------------------------------------------------------------------------

function hizalamaBul(satirlar, vw) {
  const yatay = satirlar.filter((l) => !l.donuk && !l.ustalt);
  if (!yatay.length) return;
  const solKenar = Math.min(...yatay.map((l) => l.x0));
  const sagKenar = Math.max(...yatay.map((l) => l.x1));
  // Bloklar: dikeyde yakın, yatayda örtüşen, benzer boyutlu satırlar
  const sirali = [...yatay].sort((a, b) => b.y - a.y);
  const bloklar = [];
  for (const l of sirali) {
    const blok = bloklar.find((b) => {
      const son = b[b.length - 1];
      return son.y - l.y > 0 && son.y - l.y <= 1.7 * Math.max(son.boyut, l.boyut) && Math.abs(son.boyut - l.boyut) <= 0.1 * son.boyut &&
        l.x0 < son.x1 && l.x1 > son.x0;
    });
    if (blok) blok.push(l); else bloklar.push([l]);
  }
  for (const b of bloklar) {
    const L = Math.min(...b.map((l) => l.x0)), R = Math.max(...b.map((l) => l.x1));
    const tol = (l) => Math.max(1, 0.3 * l.boyut);
    for (const l of b) { l.blok = { x0: L, x1: R }; }
    if (b.length >= 2) {
      const govde = b.slice(0, -1);
      const sagaDayali = govde.filter((l) => Math.abs(l.x1 - R) <= tol(l)).length;
      const solaDayali = b.filter((l) => Math.abs(l.x0 - L) <= tol(l)).length;
      const ortali = b.filter((l) => Math.abs((l.x0 + l.x1) / 2 - (L + R) / 2) <= tol(l)).length;
      for (const l of b) {
        const solda = Math.abs(l.x0 - L) <= tol(l), sagda = Math.abs(l.x1 - R) <= tol(l);
        if (solda && sagda && sagaDayali >= Math.max(1, govde.length * 0.5) && /\s/.test(l.metin)) l.hizalama = 'iki-yana';
        else if (!solda && sagda && solaDayali < b.length * 0.5) l.hizalama = 'sag';
        else if (!solda && ortali >= b.length * 0.6) l.hizalama = 'orta';
        else l.hizalama = 'sol';
      }
    } else {
      const l = b[0];
      const orta = (l.x0 + l.x1) / 2;
      if (Math.abs(orta - vw / 2) <= Math.max(2, 0.5 * l.boyut) && l.x0 > solKenar + 2 * l.boyut) l.hizalama = 'orta';
      else if (Math.abs(l.x1 - sagKenar) <= tol(l) && l.x0 > solKenar + 2 * l.boyut) l.hizalama = 'sag';
      else l.hizalama = 'sol';
    }
  }
  for (const l of yatay) l.sayfaKenar = { x0: solKenar, x1: sagKenar };
  // Düzenlemede kullanılabilir yatay alan: çok satırlı paragrafta paragraf kenarları, tek satırda yazı
  // alanının kenarları; aynı hizadaki komşu yazılara (ör. öteki sütun) taşmayacak şekilde daraltılır.
  for (const b of bloklar) {
    for (const l of b) {
      const s = b.length >= 2 ? { ...l.blok } : { x0: Math.min(l.x0, solKenar), x1: Math.max(l.x1, sagKenar) };
      for (const m of satirlar) {
        if (m === l || m.donuk) continue;
        if (m.kutu.y0 >= l.kutu.y1 || m.kutu.y1 <= l.kutu.y0) continue;
        if (m.x0 >= l.x1 - 0.1) s.x1 = Math.min(s.x1, m.x0 - 0.5 * l.boyut);
        else if (m.x1 <= l.x0 + 0.1) s.x0 = Math.max(s.x0, m.x1 + 0.5 * l.boyut);
      }
      l.sinir = { x0: Math.min(s.x0, l.x0), x1: Math.max(s.x1, l.x1) };
    }
  }
  for (const l of satirlar) if (!l.donuk && !l.sinir) l.sinir = { x0: Math.min(l.x0, solKenar), x1: Math.max(l.x1, sagKenar) };
}

// ---- Uyum (sığdırma) hesabı -------------------------------------------------------------------------

/** Bir parçayı kelimelere ayırır (boşluk glifinde ve belirgin aralıkta). */
export function kelimeler(seg) {
  const p = seg.parca;
  const out = [];
  let akim = null;
  for (const g of seg.glifler) {
    if (g.bosluk) { akim = null; continue; }
    if (akim) {
      const son = akim.glifler[akim.glifler.length - 1];
      if (Math.abs(g.x - (son.x + son.adv)) > 0.1 * p.boyut) akim = null;
    }
    if (!akim) { akim = { glifler: [] }; out.push(akim); }
    akim.glifler.push(g);
  }
  for (const k of out) {
    k.x0 = k.glifler[0].x;
    const s = k.glifler[k.glifler.length - 1];
    k.x1 = s.x + s.adv;
    k.metin = k.glifler.map((g) => (g.uni ?? '').replace(/[ﬀ-ﬆ]/g, (c) => c.normalize('NFKC'))).join('');
  }
  return out;
}

/** Kelimenin yeni yazı tipiyle sığdırma ölçeğini ve kalan farkı hesaplar. */
export function kelimeSigdir(k, p, olcer) {
  const n = [...k.metin].length;
  const dogal = (olcer.genislik(k.metin) / 1000) * p.boyut; // ölçeksiz genişlik (pt)
  const hedef = k.x1 - k.x0 - n * p.cVis;
  if (dogal <= 0 || hedef <= 0) return { f: 1, sapma: Math.abs(k.x1 - k.x0 - (dogal * p.hOlcek + n * p.cVis)), dogal, n };
  const f = hedef / (dogal * p.hOlcek);
  const fs = Math.min(1 + SINIR.olcek, Math.max(1 - SINIR.olcek, f));
  return { f: fs, ham: f, sapma: Math.abs(hedef - dogal * p.hOlcek * fs), dogal, n };
}

export function esleme(f, ozel) {
  return ozel?.[f.anahtar] ?? f.oneri;
}

const olcerOnbellek = new Map();
export async function olcerAl(e) {
  const k = `${e.aile}|${e.kalin}|${e.italik}`;
  if (!olcerOnbellek.has(k)) olcerOnbellek.set(k, yaziTipiOlcer(e.aile, { kalin: e.kalin, italik: e.italik }));
  return olcerOnbellek.get(k);
}

async function enYakinAile(f, satirlar) {
  const sinif = f.oneri.aile === 'liberation-mono' ? ['liberation-mono']
    : f.oneri.tanindi === 'tahmin' ? ['liberation-serif', 'caladea', 'noto-serif', 'liberation-sans', 'carlito', 'noto-sans']
      : f.oneri.aile === 'liberation-serif' ? ['liberation-serif', 'caladea', 'noto-serif'] : ['liberation-sans', 'carlito', 'noto-sans'];
  let en = null;
  for (const aile of sinif) {
    const e = { ...f.oneri, aile };
    const o = await olcerAl(e);
    let top = 0, say = 0;
    for (const l of satirlar) for (const s of l.segs) {
      if (s.parca.font !== f) continue;
      for (const k of kelimeler(s)) {
        if (k.metin.length < 3 || o.eksik(k.metin).length) continue;
        const r = kelimeSigdir(k, s.parca, o);
        top += Math.abs((r.ham ?? 1) - 1); say++;
        if (say > 400) break;
      }
    }
    const ort = say ? top / say : 1;
    if (!en || ort < en.ort) en = { aile, ort };
  }
  return en?.aile ?? f.oneri.aile;
}

/** Satırın, yeni yazı tipiyle aynı yere oturup oturmadığını hesaplar (değiştirilmemiş satır için). */
export async function satirUyumu(satir, ozelEsleme) {
  let enOran = 0, enSapma = 0;
  for (const s of satir.segs) {
    const p = s.parca;
    const e = esleme(p.font, ozelEsleme);
    const o = await olcerAl(e);
    const eksik = o.eksik(s.glifler.map((g) => g.uni ?? '').join('').replace(/[ﬀ-ﬆ]/g, (c) => c.normalize('NFKC')));
    if (eksik.length) {
      return { tamam: false, oran: 0, sapma: 0, neden: `Yeni yazı tipinde olmayan karakter: ${[...new Set(eksik)].join(' ')}` };
    }
    for (const k of kelimeler(s)) {
      const r = kelimeSigdir(k, p, o);
      enOran = Math.max(enOran, Math.abs((r.ham ?? r.f) - 1));
      enSapma = Math.max(enSapma, r.sapma);
    }
  }
  const tamam = enSapma <= SINIR.kelimeSapma;
  return {
    tamam, oran: enOran, sapma: enSapma,
    neden: tamam ? null : `Yazı tipi genişlik farkı %${(enOran * 100).toFixed(1)} (izin verilen en fazla %${SINIR.olcek * 100}); satır orijinal bırakıldı`,
  };
}

// ---- Ana giriş ---------------------------------------------------------------------------------------

/**
 * Belgeyi analiz eder. doc: pdf-lib belgesi. sayfaDizinleri: 0 tabanlı (boşsa hepsi).
 * Dönen nesne hem arayüz için (satırlar) hem de yeniden yazma motoru için (iç ayrıntılar) kullanılır.
 */
// uyumHesapla=false: satırların "yeniden yazılabilir mi" denetimi (koruma/uyum) atlanır. Yalnızca konum/yazı tipi/renk gerekiyorsa
// (ör. PDF → PowerPoint) kullanılır; düzenleme ekranı için true kalmalıdır.
export async function belgeAnaliz(doc, { sayfaDizinleri = null, esleme: ozelEsleme = null, sadeceYorumla = false, uyumHesapla = true } = {}) {
  const pages = doc.getPages();
  const dizinler = sayfaDizinleri ?? pages.map((_, i) => i);
  const fontlar = new Map();
  const sayfalar = [];
  for (const i of dizinler) {
    const page = pages[i];
    const gor = gorunurDonusum(page);
    const U2V = ters(gor.m);
    const { duzen, gruplar } = sayfaAkislari(doc, page);
    const y = new Yorumlayici(doc, i + 1, U2V, fontlar);
    const gs = baslangicGs(); // gruplar arasında grafik durumu sürer (aynı sayfa içeriği gibi)
    const kaynak = page.node.Resources();
    gruplar.forEach((g, k) => {
      const dugum = { id: `g${k}`, tur: 'sayfa', grup: g, bayt: g.bayt, ops: akisCoz(g.bayt), kaynak };
      y.calistir(dugum, kaynak, gs);
    });
    const satirlar = sadeceYorumla ? [] : satirlariKur(y.parcalar, i + 1);
    sayfalar.push({ no: i + 1, dizin: i, page, genislik: gor.vw, yukseklik: gor.vh, U2V, duzen, gruplar, dugumler: y.dugumler, parcalar: y.parcalar, resimler: y.resimler, satirlar });
  }

  if (sadeceYorumla) return { doc, sayfalar, fontlar };
  // Yazı tipi önerileri (tanınmayanlar için genişlik ölçümüne göre en yakını)
  for (const f of fontlar.values()) f.oneri = aileOner(f);
  const tumSatirlar = sayfalar.flatMap((s) => s.satirlar);
  for (const f of fontlar.values()) {
    if (f.oneri.tanindi !== 'olcu' && !f.sorun) f.oneri = { ...f.oneri, aile: await enYakinAile(f, tumSatirlar) };
  }

  ustAltBilgiBul(sayfalar);
  const yakin = (a, b) => Math.abs(a.x0 - b.x0) <= 2 && Math.abs(a.y0 - b.y0) <= 2 && Math.abs(a.x1 - b.x1) <= 2 && Math.abs(a.y1 - b.y1) <= 2;
  for (const s of sayfalar) for (const r of s.resimler) r.tekrar = sayfalar.some((t) => t !== s && t.resimler.some((q) => yakin(q, r)));
  for (const s of sayfalar) {
    const alan = s.genislik * s.yukseklik;
    for (const l of s.satirlar) {
      if (!uyumHesapla) { l.koruma = null; continue; }
      l.koruma = korumaBelirle(l, s.resimler, alan) ?? (l.ustalt ? 'ustalt' : null);
      if (!l.koruma || l.koruma === 'ustalt' || l.koruma === 'logo') l.uyum = await satirUyumu(l, ozelEsleme);
    }
    hizalamaBul(s.satirlar, s.genislik);
  }
  return { doc, sayfalar, fontlar };
}

/** Arayüze/rapora verilecek sade özet (iç ayrıntılar olmadan). */
export function analizOzeti(analiz, ozelEsleme = null) {
  return {
    sayfalar: analiz.sayfalar.map((s) => ({
      no: s.no, genislik: s.genislik, yukseklik: s.yukseklik,
      satirlar: s.satirlar.map((l) => ({
        id: l.id, sayfa: l.sayfa, metin: l.metin, x0: l.x0, x1: l.x1, y: l.y, boyut: l.boyut, renk: l.renk, kutu: l.kutu,
        hizalama: l.hizalama, koruma: l.koruma, korumaAdi: l.koruma ? KORUMA_ADI[l.koruma] : null,
        uyum: l.uyum, yaziTipi: l.font.anahtar, sinir: l.sinir ?? null,
      })),
    })),
    yaziTipleri: [...analiz.fontlar.values()].map((f) => ({
      anahtar: f.anahtar, ad: yaziTipiAdi(f) || '(adsız)', oneri: f.oneri, secili: esleme(f, ozelEsleme),
      aileAdi: YAZI_AILELERI[esleme(f, ozelEsleme).aile]?.ad,
    })),
  };
}
