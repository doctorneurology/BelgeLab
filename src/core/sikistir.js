// PDF sıkıştırma — KALİTEYİ KORUYARAK.
//
// Yaptıkları:
//  1. Yazılara, çizgilere, fontlara DOKUNMAZ (yazı kalitesi %100 aynı kalır; metin seçilebilir kalır).
//  2. Yalnızca fotoğraf türü resimleri yeniden kodlar: gereğinden yüksek çözünürlüklü (ör. 600 dpi) resimleri
//     seçilen düzeye indirir ve JPEG kalitesini ayarlar. Kazanç yeterli değilse (≥ %8) resme dokunmaz.
//  3. Kayıpsız temizlik: kullanılmayan nesneleri siler, nesne akışlarıyla sıkıştırır, sayfa küçük resimlerini atar.
//  4. Sonuç özgününden KÜÇÜK değilse özgün dosya aynen korunur (dosyayı asla büyütmez).
//
// Dokunulmayanlar: saydamlık maskeli (SMask/Mask) resimler, CMYK/indeksli/1 bit resimler, grafik (az renkli) resimler.

import {
  PDFName, PDFRef, PDFDict, PDFArray, PDFStream, PDFRawStream, PDFNumber, PDFBool, decodePDFRawStream,
} from 'pdf-lib';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { resimCoz, tuvalOlustur, tuvaliBayta } from './render.js';
import { PdfHatasi } from './hatalar.js';

export const DUZEYLER = {
  hafif: { ad: 'Hafif (görünür fark yok)', enCokDpi: 300, kalite: 0.92 },
  dengeli: { ad: 'Dengeli (öneri)', enCokDpi: 200, kalite: 0.82 },
  guclu: { ad: 'Güçlü (en küçük dosya)', enCokDpi: 130, kalite: 0.65 },
};

const ad = (s) => PDFName.of(s);
const sayiOku = (v) => (v instanceof PDFNumber ? v.asNumber() : null);

const carp = (m, c) => [
  m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3],
  m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3],
  m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5],
];

function icerikMetni(doc, page) {
  try {
    page.node.normalize();
    const dizi = page.node.Contents();
    const parcalar = [];
    for (let i = 0; i < (dizi?.size?.() ?? 0); i++) {
      const s = doc.context.lookup(dizi.get(i));
      if (s instanceof PDFRawStream) parcalar.push(new TextDecoder('latin1').decode(decodePDFRawStream(s).decode()));
    }
    return parcalar.join('\n');
  } catch { return ''; }
}

/** Her resim nesnesinin sayfalarda kaplayabildiği EN BÜYÜK genişlik (nokta). İçerik akışındaki cm/q/Q/Do işleçlerinden. */
function resimYerlesimleri(doc) {
  const sonuc = new Map(); // ref.tag → { genislik }
  for (const page of doc.getPages()) {
    let metin = icerikMetni(doc, page);
    if (!metin) continue;
    metin = metin.replace(/\bBI\b[\s\S]*?\bEI\b/g, ' ').replace(/\((?:\\.|[^\\()])*\)/g, ' ').replace(/<[0-9a-fA-F\s]*>/g, ' ');
    const xobj = page.node.Resources()?.lookup(ad('XObject'));
    if (!(xobj instanceof PDFDict)) continue;
    let ctm = [1, 0, 0, 1, 0, 0];
    const yigin = [];
    let sayilar = [];
    let onceki = '';
    for (const tok of metin.split(/\s+/)) {
      if (!tok) continue;
      if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) { sayilar.push(Number(tok)); continue; }
      if (tok === 'q') yigin.push(ctm);
      else if (tok === 'Q') ctm = yigin.pop() ?? ctm;
      else if (tok === 'cm' && sayilar.length >= 6) ctm = carp(sayilar.slice(-6), ctm);
      else if (tok === 'Do' && onceki.startsWith('/')) {
        const ref = xobj.get(ad(onceki.slice(1)));
        if (ref instanceof PDFRef) {
          const w = Math.hypot(ctm[0], ctm[1]);
          const k = sonuc.get(ref.tag) ?? { genislik: 0 };
          k.genislik = Math.max(k.genislik, w);
          sonuc.set(ref.tag, k);
        }
      }
      sayilar = tok.startsWith('/') ? sayilar : [];
      onceki = tok;
    }
  }
  return sonuc;
}

function filtreler(d) {
  const f = d.lookup(ad('Filter'));
  if (!f) return [];
  if (f instanceof PDFName) return [f.decodeText()];
  if (f instanceof PDFArray) return f.asArray().map((x) => d.context.lookup(x)?.decodeText?.() ?? '?');
  return ['?'];
}

function renkUzayi(d) {
  const cs = d.lookup(ad('ColorSpace'));
  if (cs instanceof PDFName) {
    const n = cs.decodeText();
    if (n === 'DeviceRGB') return { n: 3 };
    if (n === 'DeviceGray') return { n: 1 };
    return null;
  }
  if (cs instanceof PDFArray && cs.size() >= 2 && cs.lookup(0) instanceof PDFName && cs.lookup(0).decodeText() === 'ICCBased') {
    const prof = cs.lookup(1);
    const n = prof instanceof PDFStream ? sayiOku(prof.dict.lookup(ad('N'))) : null;
    return n === 3 || n === 1 ? { n } : null;
  }
  return null;
}

/** Resmi (cizilebilir) hedef boyuta kaliteli küçültür: büyük oranlarda yarıya bölerek (kenar tırtıklanmasın). */
function kucult(cizilebilir, w, h, hw, hh) {
  let kaynak = cizilebilir, kw = w, kh = h;
  while (kw / 2 >= hw && kh / 2 >= hh) {
    const t = tuvalOlustur(Math.ceil(kw / 2), Math.ceil(kh / 2));
    const g = t.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(kaynak, 0, 0, t.width, t.height);
    kaynak = t; kw = t.width; kh = t.height;
  }
  const son = tuvalOlustur(hw, hh);
  const g = son.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, hw, hh);
  g.imageSmoothingQuality = 'high';
  g.drawImage(kaynak, 0, 0, hw, hh);
  return son;
}

/** Flate resmin ham pikselinden (RGB/gri) tuval; "fotoğraf mı?" sezgisi: örneklenen piksellerin ne kadarı birbirinden farklı renkte (fotoğrafta çoğu, grafikte azı). */
function hamdenTuval(ham, w, h, n) {
  const t = tuvalOlustur(w, h);
  const g = t.getContext('2d');
  const kare = g.createImageData(w, h);
  const d = kare.data;
  const farkli = new Set();
  let ornek = 0;
  const adim = Math.max(1, Math.floor((w * h) / 6000));
  for (let i = 0; i < w * h; i++) {
    const r = n === 3 ? ham[i * 3] : ham[i];
    const gg = n === 3 ? ham[i * 3 + 1] : ham[i];
    const b = n === 3 ? ham[i * 3 + 2] : ham[i];
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    if (i % adim === 0) { farkli.add((r << 16) | (gg << 8) | b); ornek++; }
  }
  g.putImageData(kare, 0, 0);
  return { tuval: t, renkCesidi: ornek ? farkli.size / ornek : 0 };
}

function kullanilmayanlariTemizle(doc) {
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

/**
 * @param secenek.duzey 'hafif' | 'dengeli' | 'guclu'
 * @returns {{bayt, degisti:boolean, uyarilar:string[], rapor:{once,sonra,tasarrufYuzde,resimToplam,resimYenilenen,resimKucultulen,atlananlar:Object,silinenNesne}}}
 */
export async function sikistir(bayt, { duzey = 'dengeli', ilerleme } = {}) {
  const ayar = DUZEYLER[duzey];
  if (!ayar) throw new PdfHatasi('Sıkıştırma düzeyi hafif, dengeli ya da güçlü olmalı.');
  const doc = await pdfAc(bayt);
  const ctx = doc.context;
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  const yerlesim = resimYerlesimleri(doc);
  const sayfaGenisligi = Math.max(...doc.getPages().map((p) => p.getWidth()), 1);

  const adaylar = [];
  for (const [ref, nesne] of ctx.enumerateIndirectObjects()) {
    if (nesne instanceof PDFRawStream && nesne.dict.lookup(ad('Subtype'))?.decodeText?.() === 'Image') adaylar.push([ref, nesne]);
  }
  const rapor = { once: bayt.length, sonra: bayt.length, tasarrufYuzde: 0, resimToplam: adaylar.length, resimYenilenen: 0, resimKucultulen: 0, atlananlar: {}, silinenNesne: 0 };
  const atla = (neden) => { rapor.atlananlar[neden] = (rapor.atlananlar[neden] ?? 0) + 1; };

  let k = 0;
  for (const [ref, nesne] of adaylar) {
    ilerleme?.(k++, adaylar.length, 'Resimler işleniyor…');
    const d = nesne.dict;
    try {
      const imMask = d.lookup(ad('ImageMask'));
      if (imMask instanceof PDFBool && imMask.asBoolean()) { atla('maske (1 bit)'); continue; }
      if (d.has(ad('SMask')) || d.has(ad('Mask'))) { atla('saydamlık maskeli'); continue; }
      if (d.has(ad('Decode'))) { atla('özel renk eşlemeli'); continue; }
      const bpc = sayiOku(d.lookup(ad('BitsPerComponent')));
      const w = sayiOku(d.lookup(ad('Width'))), h = sayiOku(d.lookup(ad('Height')));
      const uzay = renkUzayi(d);
      if (bpc !== 8 || !uzay || !(w > 0 && h > 0)) { atla('desteklenmeyen renk biçimi'); continue; }
      const f = filtreler(d);
      let cizilebilir, tuvalKaynak = null;
      if (f.length === 1 && f[0] === 'DCTDecode') {
        const c = await resimCoz(nesne.contents);
        if (c.genislik !== w || c.yukseklik !== h) { atla('boyut uyumsuz'); continue; }
        cizilebilir = c.cizilebilir;
      } else if (f.length === 1 && f[0] === 'FlateDecode') {
        const ham = decodePDFRawStream(nesne).decode();
        if (ham.length < w * h * uzay.n) { atla('okunamadı'); continue; }
        const r = hamdenTuval(ham, w, h, uzay.n);
        if (r.renkCesidi < 0.2) { atla('grafik/çizim (kayıpsız kalır)'); continue; }
        tuvalKaynak = r.tuval; cizilebilir = r.tuval;
      } else { atla(`desteklenmeyen sıkıştırma (${f.join('+') || 'yok'})`); continue; }

      // hedef boyut
      const yer = yerlesim.get(ref.tag);
      const gosterilenGenislik = yer?.genislik > 4 ? yer.genislik : sayfaGenisligi;
      const dpi = w / (gosterilenGenislik / 72);
      const oran = dpi > ayar.enCokDpi ? ayar.enCokDpi / dpi : 1;
      let nw = w, nh = h, kaynakTuval = tuvalKaynak;
      if (oran < 0.9) { nw = Math.max(8, Math.round(w * oran)); nh = Math.max(8, Math.round(h * oran)); kaynakTuval = kucult(cizilebilir, w, h, nw, nh); }
      else if (!kaynakTuval) {
        kaynakTuval = tuvalOlustur(w, h);
        const g = kaynakTuval.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.drawImage(cizilebilir, 0, 0);
      }
      const jpeg = await tuvaliBayta(kaynakTuval, 'jpeg', ayar.kalite);
      if (jpeg.length >= nesne.contents.length * 0.92) { atla('kazanç yetersiz'); continue; }
      const yeni = ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: nw, Height: nh, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' });
      ctx.assign(ref, PDFRawStream.of(yeni, jpeg));
      rapor.resimYenilenen++;
      if (nw !== w) rapor.resimKucultulen++;
    } catch (e) {
      atla(`işlenemedi (${String(e?.message ?? e).slice(0, 40)})`);
    }
  }

  // Kayıpsız temizlik
  for (const p of doc.getPages()) p.node.delete(ad('Thumb'));
  rapor.silinenNesne = kullanilmayanlariTemizle(doc);
  const cikti = await kaydet(doc);
  rapor.sonra = cikti.length;
  rapor.tasarrufYuzde = Math.round((1 - cikti.length / bayt.length) * 1000) / 10;

  if (cikti.length >= bayt.length) {
    uyarilar.unshift('Bu dosya zaten iyi sıkıştırılmış; daha küçük bir sürümü elde edilemedi. Özgün dosya olduğu gibi korundu.');
    return { bayt, degisti: false, uyarilar, rapor: { ...rapor, sonra: bayt.length, tasarrufYuzde: 0 } };
  }
  if (rapor.resimYenilenen) {
    uyarilar.push(`${rapor.resimYenilenen} fotoğraf türü resim ${duzey === 'hafif' ? 'hafifçe' : ''} yeniden kodlandı${rapor.resimKucultulen ? ` (${rapor.resimKucultulen} tanesi daha düşük çözünürlüğe indirildi)` : ''}. Yazılar ve çizgiler değişmedi.`.replace('  ', ' '));
  } else {
    uyarilar.push('Resim kalitesine dokunulmadı; yalnızca kullanılmayan veriler temizlendi.');
  }
  const atlanan = Object.entries(rapor.atlananlar).filter(([, n]) => n > 0);
  if (atlanan.length) uyarilar.push(`Dokunulmayan resimler: ${atlanan.map(([n, c]) => `${c} × ${n}`).join(', ')}.`);
  return { bayt: cikti, degisti: true, uyarilar, rapor };
}
