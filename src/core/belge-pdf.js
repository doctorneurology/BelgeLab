// Genel "belge modeli → PDF" yerleştirme motoru. Word (docx), HTML ve Excel dönüştürücüleri aynı modeli üretir.
//
// MODEL
//   { sayfa:{genislik, yukseklik, kenar:{ust,alt,sol,sag}}, baslik?:string, bloklar:[Blok…] }
//   Blok:
//     { tur:'p', parcalar:[Parca], hiza:'sol'|'orta'|'sag'|'iki', girinti:pt, ilkSatirGirinti:pt, once:pt, sonra:pt,
//       madde?:string ('•' ya da '1.'), baslik?:1-6, sayfaSonuOnce?:bool, ustteTut?:bool }
//     { tur:'tablo', kolonlar:[oran…], satirlar:[[Hucre…]…], kenarlik:bool, boyut:pt }
//        Hucre = { bloklar:[p…], birlesim:1, baslik:bool, dolgu:'#rrggbb'|null }
//     { tur:'resim', bayt:Uint8Array, bicim:'png'|'jpeg', w:pt, h:pt, hiza }
//     { tur:'cizgi' }   { tur:'sayfaSonu' }
//   Parca = { metin, kalin, italik, altCizgi, boyut, renk:'#rrggbb', aile:'liberation-sans'…, url, kes:bool (zorunlu satır sonu) }
//
// Yazı tipi gömme: Liberation / Carlito / Caladea / Noto (Türkçe karakterler tam). Yazı tipinde olmayan karakter için Noto Sans
// denenir, o da yoksa "?" yazılır ve bu sonuçta bildirilir. Hiçbir şey sessizce atılmaz.

import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import { yaziTipiGom, yaziTipiOlcer, VARSAYILAN_AILE } from './fonts.js';
import { kaydet } from './belge.js';
import { renkCoz } from './util.js';
import { PdfHatasi } from './hatalar.js';

export const A4 = { genislik: 595.28, yukseklik: 841.89 };
const SATIR_ARALIGI = 1.22;

class Yazici {
  constructor(model) {
    this.model = model;
    this.doc = null;
    this.sayfa = null;
    this.y = 0;
    this.uyarilar = new Set();
    this.olcerler = new Map();
    this.yaziTipleri = new Map();
    this.baglantilar = [];
    const s = model.sayfa ?? {};
    this.G = s.genislik ?? A4.genislik;
    this.Y = s.yukseklik ?? A4.yukseklik;
    this.kenar = { ust: 56, alt: 56, sol: 56, sag: 56, ...(s.kenar ?? {}) };
    this.icG = this.G - this.kenar.sol - this.kenar.sag;
    if (!(this.icG > 40) || !(this.Y - this.kenar.ust - this.kenar.alt > 40)) throw new PdfHatasi('Sayfa ölçüleri/kenar boşlukları geçersiz.');
  }

  uyar(m) { this.uyarilar.add(m); }

  async yazi(aile, kalin, italik) {
    const k = `${aile}|${kalin ? 'b' : ''}${italik ? 'i' : ''}`;
    if (!this.yaziTipleri.has(k)) this.yaziTipleri.set(k, await yaziTipiGom(this.doc, aile, { kalin: !!kalin, italik: !!italik }));
    return this.yaziTipleri.get(k);
  }

  async olcer(aile, kalin, italik) {
    const k = `${aile}|${kalin ? 'b' : ''}${italik ? 'i' : ''}`;
    if (!this.olcerler.has(k)) this.olcerler.set(k, await yaziTipiOlcer(aile, { kalin: !!kalin, italik: !!italik }));
    return this.olcerler.get(k);
  }

  yeniSayfa() {
    this.sayfa = this.doc.addPage([this.G, this.Y]);
    this.y = this.Y - this.kenar.ust;
  }

  /** Parçayı, yazı tipinde bulunan/bulunmayan karakterlere göre alt parçalara böler (Noto yedek, son çare "?"). */
  async parcaBol(p) {
    const aile = p.aile ?? VARSAYILAN_AILE;
    const o = await this.olcer(aile, p.kalin, p.italik);
    const metin = String(p.metin).replace(/\t/g, '    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f​‌‍﻿]/g, '').replace(/ /g, ' ');
    const eksik = new Set(o.eksik(metin));
    if (!eksik.size) return [{ ...p, metin, aile }];
    const yedek = await this.olcer('noto-sans', p.kalin, p.italik);
    const yedekEksik = new Set(yedek.eksik([...eksik].join('')));
    const sonuc = [];
    let cur = '', curAile = aile;
    const ekle = () => { if (cur) sonuc.push({ ...p, metin: cur, aile: curAile }); cur = ''; };
    for (const ch of metin) {
      let hedefAile = aile, c = ch;
      if (eksik.has(ch)) {
        if (!yedekEksik.has(ch)) hedefAile = 'noto-sans';
        else { c = '?'; this.uyar('Bazı karakterler (ör. özel semboller, emoji) yazı tiplerinde bulunmadığı için “?” olarak yazıldı.'); }
      }
      if (hedefAile !== curAile) { ekle(); curAile = hedefAile; }
      cur += c;
    }
    ekle();
    return sonuc;
  }

  /**
   * Parçaları genişliğe göre satırlara böler. Çizim yapmaz.
   * @returns {{satirlar:{ogeler:{metin,font,boyut,renk,altCizgi,url,x,genislik}[], yukseklik, taban, genislik, bosluk, son}[], yukseklik}}
   */
  async satirKur(parcalar, genislik, { hiza = 'sol', ilkSatirGirinti = 0 } = {}) {
    // 1) kelimeler
    const kelimeler = []; // {segler:[{...parca, font, g}], g, bosluk}
    let kelime = null;
    const kelimeBitir = () => { if (kelime) { kelimeler.push(kelime); kelime = null; } };
    for (const p0 of parcalar) {
      if (p0.kes) { kelimeBitir(); kelimeler.push({ kes: true, boyut: p0.boyut ?? 11 }); continue; }
      for (const p of await this.parcaBol(p0)) {
        const font = await this.yazi(p.aile, p.kalin, p.italik);
        const boyut = p.boyut ?? 11;
        for (const t of p.metin.split(/(\s+|\n)/).filter((x) => x !== '')) {
          if (t === '\n') { kelimeBitir(); kelimeler.push({ kes: true, boyut }); continue; }
          if (/^\s+$/.test(t)) {
            kelimeBitir();
            kelimeler.push({ bosluk: true, segler: [{ ...p, metin: ' ', font, boyut, g: font.widthOfTextAtSize(' ', boyut) }], g: font.widthOfTextAtSize(' ', boyut) });
          } else {
            kelime ??= { segler: [], g: 0 };
            const g = font.widthOfTextAtSize(t, boyut);
            kelime.segler.push({ ...p, metin: t, font, boyut, g });
            kelime.g += g;
          }
        }
      }
    }
    kelimeBitir();

    // 2) satır kırma
    const satirlar = [];
    let cur = { oge: [], g: 0 };
    const satirBitir = (son = false, bosBoyut = 11) => {
      while (cur.oge.length && cur.oge.at(-1).bosluk) cur.oge.pop();
      const ogeler = cur.oge;
      const boyut = Math.max(...ogeler.flatMap((k) => k.segler.map((s) => s.boyut)), ogeler.length ? 0 : bosBoyut);
      const g = ogeler.reduce((t, k) => t + k.g, 0);
      satirlar.push({ ogeler, boyut, g, son });
      cur = { oge: [], g: 0 };
    };
    const kullan = (i) => genislik - (i === 0 ? ilkSatirGirinti : 0);
    for (const k of kelimeler) {
      if (k.kes) { satirBitir(true, k.boyut); continue; }
      if (k.bosluk && !cur.oge.length) continue;
      const kalan = kullan(satirlar.length);
      if (!k.bosluk && cur.g + k.g > kalan && cur.oge.length) satirBitir();
      if (!k.bosluk && k.g > kullan(satirlar.length)) {
        // tek kelime satırdan uzun: karakter karakter böl
        for (const seg of k.segler) {
          let parca = '';
          for (const ch of seg.metin) {
            const g = seg.font.widthOfTextAtSize(parca + ch, seg.boyut);
            if (cur.g + g > kullan(satirlar.length) && (parca || cur.oge.length)) {
              if (parca) { const gg = seg.font.widthOfTextAtSize(parca, seg.boyut); cur.oge.push({ segler: [{ ...seg, metin: parca, g: gg }], g: gg }); cur.g += gg; parca = ''; }
              satirBitir();
            }
            parca += ch;
          }
          if (parca) { const gg = seg.font.widthOfTextAtSize(parca, seg.boyut); cur.oge.push({ segler: [{ ...seg, metin: parca, g: gg }], g: gg }); cur.g += gg; }
        }
        continue;
      }
      cur.oge.push(k);
      cur.g += k.g;
    }
    if (cur.oge.length || !satirlar.length) satirBitir(true);
    else satirlar.at(-1).son = true;
    satirlar.forEach((s, i) => { s.hiza = hiza; s.girinti = i === 0 ? ilkSatirGirinti : 0; s.yukseklik = s.boyut * SATIR_ARALIGI; });
    return { satirlar, yukseklik: satirlar.reduce((t, s) => t + s.yukseklik, 0) };
  }

  /** Bir satırı (x, ustY) konumuna çizer; satır yüksekliğini döndürmez (çağıran bilir). */
  satirCiz(s, x, ustY, genislik) {
    const taban = ustY - s.boyut * 0.92;
    const bosluklar = s.ogeler.filter((k) => k.bosluk).length;
    let ekBosluk = 0, baslangic = x + s.girinti;
    const mevcut = genislik - s.girinti;
    if (s.hiza === 'iki' && !s.son && bosluklar > 0) ekBosluk = Math.max(0, (mevcut - s.g) / bosluklar);
    else if (s.hiza === 'orta') baslangic += Math.max(0, (mevcut - s.g) / 2);
    else if (s.hiza === 'sag') baslangic += Math.max(0, mevcut - s.g);
    let cx = baslangic;
    for (const k of s.ogeler) {
      for (const seg of k.segler) {
        if (seg.metin.trim()) {
          const renk = renkCoz(seg.renk ?? '#000000');
          this.sayfa.drawText(seg.metin, { x: cx, y: taban, size: seg.boyut, font: seg.font, color: rgb(renk.r, renk.g, renk.b) });
          if (seg.altCizgi || seg.url) {
            this.sayfa.drawLine({ start: { x: cx, y: taban - seg.boyut * 0.12 }, end: { x: cx + seg.g, y: taban - seg.boyut * 0.12 }, thickness: Math.max(0.5, seg.boyut / 20), color: seg.url ? rgb(0.05, 0.25, 0.8) : rgb(renk.r, renk.g, renk.b) });
          }
          if (seg.url) this.baglantilar.push({ sayfa: this.sayfa, url: seg.url, x0: cx, x1: cx + seg.g, y0: taban - seg.boyut * 0.25, y1: taban + seg.boyut * 0.9 });
        }
        cx += seg.g + (k.bosluk ? ekBosluk : 0);
      }
    }
  }

  yerVar(yukseklik) { return this.y - yukseklik >= this.kenar.alt; }

  async paragraf(b, { x = this.kenar.sol, genislik = this.icG, serbest = false } = {}) {
    const once = b.once ?? 0, sonra = b.sonra ?? 0;
    const girinti = b.girinti ?? 0;
    let govdeG = genislik - girinti;
    let maddeG = 0;
    if (b.madde) { maddeG = 16; govdeG -= maddeG; }
    const { satirlar, yukseklik } = await this.satirKur(b.parcalar, Math.max(20, govdeG), { hiza: b.hiza ?? 'sol', ilkSatirGirinti: b.ilkSatirGirinti ?? 0 });
    if (b.sayfaSonuOnce && !serbest) this.yeniSayfa();
    if (!serbest) {
      // başlık kendinden sonra en az 2 satır görmeden sayfa altında kalmasın
      const gerekli = b.baslik || b.ustteTut ? yukseklik + once + (satirlar[0]?.boyut ?? 11) * SATIR_ARALIGI * 2 : (satirlar[0]?.yukseklik ?? 0) + once;
      if (!this.yerVar(gerekli) && this.y < this.Y - this.kenar.ust - 1) this.yeniSayfa();
      else if (this.y !== this.Y - this.kenar.ust) this.y -= once;
    }
    let ilkSatir = true;
    for (const s of satirlar) {
      if (!serbest && !this.yerVar(s.yukseklik)) this.yeniSayfa();
      if (ilkSatir && b.madde) {
        const f0 = s.ogeler[0]?.segler[0];
        if (f0) this.sayfa.drawText(b.madde, { x: x + girinti, y: this.y - s.boyut * 0.92, size: s.boyut, font: f0.font, color: rgb(0, 0, 0) });
      }
      this.satirCiz(s, x + girinti + maddeG, this.y, govdeG);
      this.y -= s.yukseklik;
      ilkSatir = false;
    }
    if (!serbest) this.y -= sonra;
    return yukseklik;
  }

  async resim(b) {
    let w = b.w, h = b.h;
    const enG = this.icG, enY = this.Y - this.kenar.ust - this.kenar.alt;
    if (w > enG) { h *= enG / w; w = enG; }
    if (h > enY) { w *= enY / h; h = enY; }
    if (!this.yerVar(h)) this.yeniSayfa();
    let img;
    try { img = b.bicim === 'jpeg' ? await this.doc.embedJpg(b.bayt) : await this.doc.embedPng(b.bayt); } catch { this.uyar('Bazı resimler okunamadığı için atlandı.'); return; }
    const x = this.kenar.sol + (b.hiza === 'orta' ? (enG - w) / 2 : b.hiza === 'sag' ? enG - w : 0);
    this.sayfa.drawImage(img, { x, y: this.y - h, width: w, height: h });
    this.y -= h + 6;
  }

  async tablo(b) {
    const boyut = b.boyut ?? 10;
    const satirlar = b.satirlar;
    const kolonSayisi = Math.max(...satirlar.map((r) => r.reduce((t, h) => t + (h.birlesim ?? 1), 0)), 1);
    let oranlar = (b.kolonlar?.length === kolonSayisi ? b.kolonlar : Array(kolonSayisi).fill(1)).map((x) => Math.max(0.0001, x));
    const toplam = oranlar.reduce((a, c) => a + c, 0);
    const kg = oranlar.map((o) => (o / toplam) * this.icG);
    const pad = 3;
    const cizgi = rgb(0.55, 0.55, 0.55);
    for (const satir of satirlar) {
      // ölçüm
      let kol = 0;
      const olculen = [];
      let enYuksek = boyut * SATIR_ARALIGI + 2 * pad;
      for (const h of satir) {
        const bs = h.birlesim ?? 1;
        const gen = kg.slice(kol, kol + bs).reduce((a, c) => a + c, 0);
        let hy = 2 * pad;
        const kurulu = [];
        for (const blok of h.bloklar ?? []) {
          if (blok.tur !== 'p') continue;
          const par = h.baslik ? blok.parcalar.map((p) => ({ ...p, kalin: true })) : blok.parcalar;
          const k = await this.satirKur(par, Math.max(10, gen - 2 * pad), { hiza: blok.hiza ?? 'sol' });
          kurulu.push(k);
          hy += k.yukseklik;
        }
        olculen.push({ kol, bs, gen, hy, kurulu, h });
        enYuksek = Math.max(enYuksek, hy);
        kol += bs;
      }
      const sayfaIc = this.Y - this.kenar.ust - this.kenar.alt;
      if (enYuksek > sayfaIc) { enYuksek = sayfaIc; this.uyar('Sayfadan uzun tablo hücreleri kısaltıldı (taşan satırlar çizilmedi).'); }
      if (!this.yerVar(enYuksek)) this.yeniSayfa();
      let x = this.kenar.sol;
      let k0 = 0;
      for (const o of olculen) {
        const xh = this.kenar.sol + kg.slice(0, o.kol).reduce((a, c) => a + c, 0);
        if (o.h.dolgu || o.h.baslik) {
          const r = renkCoz(o.h.dolgu ?? '#eeeeee');
          this.sayfa.drawRectangle({ x: xh, y: this.y - enYuksek, width: o.gen, height: enYuksek, color: rgb(r.r, r.g, r.b) });
        }
        if (b.kenarlik !== false) this.sayfa.drawRectangle({ x: xh, y: this.y - enYuksek, width: o.gen, height: enYuksek, borderColor: cizgi, borderWidth: 0.5 });
        let cy = this.y - pad;
        for (const k of o.kurulu) {
          for (const s of k.satirlar) {
            if (cy - s.yukseklik < this.y - enYuksek - 0.5) break;
            this.satirCiz(s, xh + pad, cy, o.gen - 2 * pad);
            cy -= s.yukseklik;
          }
        }
        k0 += o.bs; x += o.gen;
      }
      this.y -= enYuksek;
    }
    this.y -= 8;
  }

  baglantilariYaz() {
    for (const l of this.baglantilar) {
      const ek = this.doc.context.obj({
        Type: 'Annot', Subtype: 'Link', Rect: [l.x0, l.y0, l.x1, l.y1], Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(l.url) },
      });
      const mevcut = l.sayfa.node.lookup(PDFName.of('Annots'));
      const ref = this.doc.context.register(ek);
      if (mevcut?.push) mevcut.push(ref);
      else l.sayfa.node.set(PDFName.of('Annots'), this.doc.context.obj([ref]));
    }
  }

  async calistir(ilerleme) {
    this.doc = await PDFDocument.create();
    if (this.model.baslik) this.doc.setTitle(String(this.model.baslik).slice(0, 200));
    this.yeniSayfa();
    const n = this.model.bloklar.length;
    for (let i = 0; i < n; i++) {
      if (i % 25 === 0) ilerleme?.(i, n, 'Sayfalar yerleştiriliyor…');
      const b = this.model.bloklar[i];
      if (b.tur === 'p') await this.paragraf(b);
      else if (b.tur === 'tablo') await this.tablo(b);
      else if (b.tur === 'resim') await this.resim(b);
      else if (b.tur === 'sayfaAyari') {
        // bundan sonraki sayfaların boyutunu değiştirir (ör. Excel sayfaları için yatay)
        if (this.y === this.Y - this.kenar.ust && this.doc.getPageCount() === 1) this.doc.removePage(0);
        this.G = b.genislik; this.Y = b.yukseklik; this.icG = this.G - this.kenar.sol - this.kenar.sag;
        this.yeniSayfa();
      }
      else if (b.tur === 'sayfaSonu') { if (this.y < this.Y - this.kenar.ust - 1) this.yeniSayfa(); }
      else if (b.tur === 'cizgi') {
        if (!this.yerVar(10)) this.yeniSayfa();
        this.sayfa.drawLine({ start: { x: this.kenar.sol, y: this.y - 4 }, end: { x: this.kenar.sol + this.icG, y: this.y - 4 }, thickness: 0.7, color: rgb(0.6, 0.6, 0.6) });
        this.y -= 12;
      }
    }
    this.baglantilariYaz();
    return kaydet(this.doc);
  }
}

/** Modeli PDF'e yazar. @returns {{bayt:Uint8Array, sayfa:number, uyarilar:string[]}} */
export async function modeldenPdf(model, { ilerleme } = {}) {
  const y = new Yazici(model);
  const bayt = await y.calistir(ilerleme);
  return { bayt, sayfa: y.doc.getPageCount(), uyarilar: [...y.uyarilar] };
}

export { Yazici };
