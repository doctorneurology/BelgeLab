// Yazı düzeltme motorunun dışarıya açılan kapısı.
//
//   yaziAnalizEt(bayt)            → satırlar, korumalar, yazı tipi eşlemeleri (arayüz için)
//   yaziDuzelt(bayt, secenekler)  → yeni PDF + sayfa raporu + uyarılar
//   yazilariKaldir(bayt)          → tüm yazıları çıkarılmış PDF (doğrulama için)

import { pdfAc, kaydet, belgeOzellikleri } from '../belge.js';
import { PdfHatasi } from '../hatalar.js';
import { belgeAnaliz, analizOzeti, KORUMA_ADI } from './analiz.js';
import {
  kararlar, aynenCizimleri, duzenlemeCizimleri, degisiklikleriUygula, kullanilmayanlariSil, imzalariKaldir,
} from './yeniden.js';

const ISARET = '% PDF Araclari: bu sayfanin yazilari yazi duzeltme motoruyla yeniden yazildi';

function dizinler(doc, sayfalar) {
  if (!sayfalar) return null;
  return sayfalar.filter((i) => i >= 0 && i < doc.getPageCount());
}

/** Belgeyi analiz eder ve arayüze uygun özet verir. */
export async function yaziAnalizEt(bayt, { sayfalar = null, esleme = null } = {}) {
  const doc = await pdfAc(bayt);
  const ozellik = belgeOzellikleri(doc);
  const analiz = await belgeAnaliz(doc, { sayfaDizinleri: dizinler(doc, sayfalar), esleme });
  const ozet = analizOzeti(analiz, esleme);
  const yaziVar = analiz.sayfalar.some((s) => s.parcalar.length);
  return { ...ozet, sayfaSayisi: doc.getPageCount(), imzali: ozellik.imzali, yaziVar };
}

/**
 * @param {Uint8Array} bayt
 * @param {{sayfalar?:number[], degisiklikler?:Object<string,{metin?,aile?,boyut?,renk?,kalin?,italik?}>,
 *          kilitAcik?:string[], esleme?:Object<string,{aile,kalin,italik}>}} secenekler
 */
export async function yaziDuzelt(bayt, { sayfalar = null, degisiklikler = {}, kilitAcik = [], esleme = null } = {}) {
  const doc = await pdfAc(bayt);
  const ozellik = belgeOzellikleri(doc);
  const analiz = await belgeAnaliz(doc, { sayfaDizinleri: dizinler(doc, sayfalar), esleme });
  const tum = analiz.sayfalar.flatMap((s) => s.satirlar);
  const satirBul = new Map(tum.map((l) => [l.id, l]));
  const uyarilar = [];
  const satirUyari = new Map(); // satirId → [mesaj]
  const uyariEkle = (l, m) => { if (!satirUyari.has(l.id)) satirUyari.set(l.id, []); satirUyari.get(l.id).push(m); };

  // Düzenlemeleri önceden hazırla (hata varsa o düzenleme uygulanmaz, sebebi bildirilir)
  const gecerli = {};
  const duzenCizim = new Map();
  for (const [id, d] of Object.entries(degisiklikler ?? {})) {
    const l = satirBul.get(id);
    if (!l || !d) continue;
    if (l.koruma && !(l.koruma === 'ustalt' && kilitAcik.includes(id))) { gecerli[id] = d; continue; }
    const r = await duzenlemeCizimleri(l, d, esleme);
    if (r.hata) { uyariEkle(l, r.hata); continue; }
    if (d.renk && r.cizimler.length) {
      const p = l.segs[0].parca;
      if (p.renk.adli && p.renk.ham.some((h) => h.dugum !== p.dugum)) { uyariEkle(l, 'Bu satırın rengi değiştirilemiyor (özel renk alanı).'); continue; }
    }
    r.uyarilar.forEach((m) => uyariEkle(l, m));
    gecerli[id] = d;
    duzenCizim.set(l, r);
  }

  const k = kararlar(analiz, { degisiklikler: gecerli, kilitAcik });
  for (const u of k.uyarilar) uyariEkle(satirBul.get(u.satirId), u.mesaj);

  // Komut → yeni çizimler
  const yerine = new Map();
  const ekle = (p, c) => {
    if (!yerine.has(p)) yerine.set(p, { cizimler: [] });
    if (c) yerine.get(p).cizimler.push(...c);
  };
  for (const l of tum) {
    const mod = k.satirMod.get(l);
    if (mod === 'koru') continue;
    if (mod === 'duzenle') {
      const capa = l.segs[0].parca;
      for (const s of l.segs) ekle(s.parca);
      ekle(capa, duzenCizim.get(l).cizimler);
    } else {
      const c = await aynenCizimleri(l, esleme);
      for (const s of l.segs) ekle(s.parca, c.filter((x) => x.parca === s.parca && !yerine.get(s.parca)?.cizimler.includes(x)));
    }
  }
  // Korunan satırla komut paylaşan bir komut yerine konmamalı (kararlar bunu zaten çözer; emniyet)
  for (const [p, set] of k.parcaSatir) if ([...set].some((l) => k.satirMod.get(l) === 'koru')) yerine.delete(p);

  let imzaKaldirilan = 0;
  if (ozellik.imzali) {
    imzaKaldirilan = imzalariKaldir(doc);
    uyarilar.push('Bu belgede dijital imza vardı. Belge değiştirildiği için imza artık geçerli olamaz; çıktı İMZASIZ yeni bir dosyadır. '
      + 'İmza alanının görünümü sayfada durur ama dijital imza değildir. Gerekirse belgeyi yeniden imzalatın.');
  }
  if (ozellik.xfa) uyarilar.push('Bu belgede XFA türü form var; çıktıda çalışmayabilir.');

  await degisiklikleriUygula(analiz, yerine, { isaret: ISARET });
  kullanilmayanlariSil(doc);
  const cikti = await kaydet(doc);

  // Sayfa raporu
  const rapor = analiz.sayfalar.map((s) => {
    const r = { no: s.no, satir: s.satirlar.length, yeniden: 0, duzenlenen: 0, korunan: 0, kontrol: [] };
    for (const l of s.satirlar) {
      const mod = k.satirMod.get(l);
      if (mod === 'duzenle') r.duzenlenen++;
      else if (mod === 'yeniden') r.yeniden++;
      else if (l.koruma && l.koruma !== 'cozulemedi') r.korunan++;
      const nedenler = [...(satirUyari.get(l.id) ?? [])];
      if (mod === 'koru' && !l.koruma && l.uyum && !l.uyum.tamam) nedenler.push(l.uyum.neden);
      if (l.koruma === 'cozulemedi') nedenler.push(`${KORUMA_ADI.cozulemedi}; satır orijinal bırakıldı`);
      if (nedenler.length) r.kontrol.push({ satirId: l.id, nedenler, kutu: l.kutu });
    }
    r.durum = r.kontrol.length ? 'kontrol' : 'temiz';
    r.ozet = r.kontrol.length ? `Sayfa ${s.no}: ${r.kontrol.length} satır kontrol gerekli` : `Sayfa ${s.no} temiz`;
    return r;
  });
  return { bayt: cikti, rapor, uyarilar, imzaKaldirilan };
}

/** Seçilen sayfalardaki (boşsa tümü) bütün yazı komutlarını kaldırır. Resim/çizim/açıklamalar kalır. */
export async function yazilariKaldir(bayt, { sayfalar = null } = {}) {
  const doc = await pdfAc(bayt);
  const analiz = await belgeAnaliz(doc, { sayfaDizinleri: dizinler(doc, sayfalar), sadeceYorumla: true });
  const yerine = new Map();
  for (const s of analiz.sayfalar) for (const p of s.parcalar) yerine.set(p, { cizimler: [] });
  await degisiklikleriUygula(analiz, yerine);
  kullanilmayanlariSil(doc);
  return kaydet(doc);
}

export { PdfHatasi };
