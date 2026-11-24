// PDF düzenleyici: şekil, vurgu ve çizgi ekleme (dikdörtgen, elips, çizgi, ok, vurgulayıcı, serbest çizim).
// Eklenenler işaretli içerik akışı olarak (tur=sekil) saklanır; "sekilleriKaldir" yalnızca BU programın eklediği şekilleri geri alır.
// Koordinatlar: sayfanın EKRANDA görünen sol-alt köşesinden, nokta (pt). Döndürülmüş/kırpılmış sayfalar doğru yere gelir.

import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yeniIslem, SayfaCizici, eklenenleriKaldir, eklenenleriBul } from './cizim.js';

const TURLER = ['dikdortgen', 'elips', 'cizgi', 'ok', 'vurgu', 'serbest'];

/**
 * @param ogeler [{ sayfa (0 tabanlı), tur, x0,y0,x1,y1 | noktalar, renk?, dolgu?, kalinlik?, opaklik? }]
 *   vurgu: yarı saydam dolu dikdörtgen (varsayılan sarı, opaklık 0,35)
 */
export async function sekilEkle(bayt, ogeler) {
  if (!ogeler?.length) throw new PdfHatasi('Eklenecek bir şekil yok.');
  const doc = await pdfAc(bayt);
  const n = doc.getPageCount();
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  const islem = yeniIslem(doc, 'sekil');
  const ciziciler = new Map();
  for (const o of ogeler) {
    if (!Number.isInteger(o.sayfa) || o.sayfa < 0 || o.sayfa >= n) throw new PdfHatasi(`Sayfa ${o.sayfa + 1} yok; bu belgede ${n} sayfa var.`);
    if (!TURLER.includes(o.tur)) throw new PdfHatasi(`Bilinmeyen şekil türü: ${o.tur}`);
    if (!ciziciler.has(o.sayfa)) ciziciler.set(o.sayfa, new SayfaCizici(islem, doc.getPage(o.sayfa)));
    const c = ciziciler.get(o.sayfa);
    const opaklik = o.opaklik ?? (o.tur === 'vurgu' ? 0.35 : 1);
    if (!(opaklik > 0 && opaklik <= 1)) throw new PdfHatasi('Saydamlık 0 ile 1 arasında olmalı.');
    if (o.tur === 'serbest') {
      if (!o.noktalar || o.noktalar.length < 2) throw new PdfHatasi('Serbest çizim için en az iki nokta gerekir.');
      c.sekil({ tur: 'serbest', noktalar: o.noktalar, renk: o.renk ?? '#000000', kalinlik: o.kalinlik ?? 2, opaklik });
      continue;
    }
    const { x0, y0, x1, y1 } = o;
    if (![x0, y0, x1, y1].every(Number.isFinite)) throw new PdfHatasi('Şekil koordinatları geçersiz.');
    if (['dikdortgen', 'elips', 'vurgu'].includes(o.tur) && (Math.abs(x1 - x0) < 1 || Math.abs(y1 - y0) < 1)) throw new PdfHatasi('Şekil çok küçük.');
    if (Math.max(x0, x1) > c.genislik + 1 || Math.max(y0, y1) > c.yukseklik + 1 || Math.min(x0, x1) < -1 || Math.min(y0, y1) < -1) uyarilar.push(`Sayfa ${o.sayfa + 1}: bir şekil sayfa sınırının dışına taşıyor; taşan kısım görünmez.`);
    if (o.tur === 'dikdortgen') {
      c.dikdortgen({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), dolgu: o.dolgu ?? null, cizgi: o.renk ?? '#000000', cizgiKalinligi: o.kalinlik ?? 2, opaklik });
    } else if (o.tur === 'vurgu') {
      c.dikdortgen({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), dolgu: o.renk ?? '#ffeb3b', opaklik });
    } else {
      c.sekil({ tur: o.tur, x0, y0, x1, y1, renk: o.renk ?? '#000000', dolgu: o.dolgu ?? null, kalinlik: o.kalinlik ?? 2, opaklik });
    }
  }
  for (const c of ciziciler.values()) c.bitir('ust');
  return { bayt: await kaydet(doc), sayfaSayisi: n, eklenen: ogeler.length, uyarilar };
}

/** Bu programın eklediği şekilleri (yalnızca onları) kaldırır. */
export async function sekilleriKaldir(bayt) {
  const doc = await pdfAc(bayt);
  const bulunan = eklenenleriBul(doc, 'sekil').length;
  if (!bulunan) return { bayt, kaldirilan: 0, uyarilar: ['Bu program tarafından eklenmiş şekil bulunamadı; başka kaynaklardan gelen çizimlere dokunulmaz.'] };
  const r = eklenenleriKaldir(doc, 'sekil');
  return { bayt: await kaydet(doc), kaldirilan: r.kaldirilan, uyarilar: [] };
}
