// Yer imleri (içindekiler): okuma, yazma, silme ve başlıklardan otomatik üretme; "başlığa göre ad" bulma.
import { PDFName, PDFDict, PDFArray, PDFHexString, PDFRef } from 'pdf-lib';
import { belgeAc } from './render.js';
import { pdfAc, kaydet } from './belge.js';
import { PdfHatasi } from './hatalar.js';

const ad = (s) => PDFName.of(s);

/** Mevcut yer imleri: [{ baslik, duzey (1…), sayfa (0 tabanlı | null) }] */
export async function yerimleriOku(bayt) {
  const belge = await belgeAc(bayt);
  try {
    const kok = await belge.getOutline();
    if (!kok?.length) return [];
    const sonuc = [];
    const gez = async (liste, duzey) => {
      for (const o of liste) {
        let sayfa = null;
        try {
          let d = o.dest;
          if (typeof d === 'string') d = await belge.getDestination(d);
          if (Array.isArray(d)) { const r = d[0]; sayfa = typeof r === 'object' && r !== null ? await belge.getPageIndex(r) : r; }
        } catch { sayfa = null; }
        sonuc.push({ baslik: String(o.title ?? '').trim(), duzey, sayfa });
        if (o.items?.length) await gez(o.items, duzey + 1);
      }
    };
    await gez(kok, 1);
    return sonuc;
  } finally { await belge.kapat(); }
}

/** Metin satırlarından liste: "düzey | sayfa | başlık" (sayfa 1 tabanlı). Boş/yorum (#) satırları atlanır. */
export function yerimiMetniCoz(metin, sayfaSayisi) {
  const liste = [];
  String(metin ?? '').split(/\r?\n/).forEach((satir, i) => {
    const s = satir.trim();
    if (!s || s.startsWith('#')) return;
    const m = /^(\d{1,2})\s*\|\s*(\d{1,6})\s*\|\s*(.+)$/.exec(s);
    if (!m) throw new PdfHatasi(`${i + 1}. satır anlaşılamadı: “${s.slice(0, 40)}”. Biçim: düzey | sayfa | başlık  (örn. 1 | 5 | Giriş)`);
    const sayfa = Number(m[2]);
    if (sayfa < 1 || sayfa > sayfaSayisi) throw new PdfHatasi(`${i + 1}. satırdaki sayfa (${sayfa}) belgede yok (1–${sayfaSayisi}).`);
    liste.push({ duzey: Math.max(1, Number(m[1])), sayfa: sayfa - 1, baslik: m[3].trim() });
  });
  return liste;
}
export const yerimiMetni = (liste) => liste.map((y) => `${y.duzey} | ${(y.sayfa ?? 0) + 1} | ${y.baslik}`).join('\n');

/** Listeyi belgeye yer imi olarak yazar (mevcut yer imlerinin yerine). Boş liste = tüm yer imlerini siler. */
export async function yerimleriYaz(bayt, liste) {
  const doc = await pdfAc(bayt);
  const ctx = doc.context;
  const sayfalar = doc.getPages();
  doc.catalog.delete(ad('Outlines'));
  if (!liste.length) return { bayt: await kaydet(doc), adet: 0 };
  // Düzey atlamaları kapatılır (1 → 3 gibi): her öğe en çok bir önceki düzey + 1 olabilir.
  let onceki = 0;
  const duz = liste.map((y) => { const d = Math.min(Math.max(1, y.duzey), onceki + 1); onceki = d; return { ...y, duzey: d }; });
  const dugumler = duz.map((y) => ({ ...y, ref: ctx.nextRef(), cocuklar: [], ust: null }));
  const koku = []; const yigin = [];
  for (const d of dugumler) {
    while (yigin.length && yigin[yigin.length - 1].duzey >= d.duzey) yigin.pop();
    if (yigin.length) { d.ust = yigin[yigin.length - 1]; d.ust.cocuklar.push(d); } else koku.push(d);
    yigin.push(d);
  }
  const kokRef = ctx.nextRef();
  const toplamAlt = (d) => d.cocuklar.reduce((t, c) => t + 1 + toplamAlt(c), 0);
  for (const d of dugumler) {
    const sayfa = sayfalar[Math.min(Math.max(0, d.sayfa ?? 0), sayfalar.length - 1)];
    const sozluk = ctx.obj({
      Title: PDFHexString.fromText(d.baslik),
      Parent: d.ust ? d.ust.ref : kokRef,
      Dest: [sayfa.ref, ad('XYZ'), null, null, null],
    });
    const kardesler = d.ust ? d.ust.cocuklar : koku;
    const k = kardesler.indexOf(d);
    if (k > 0) sozluk.set(ad('Prev'), kardesler[k - 1].ref);
    if (k < kardesler.length - 1) sozluk.set(ad('Next'), kardesler[k + 1].ref);
    if (d.cocuklar.length) { sozluk.set(ad('First'), d.cocuklar[0].ref); sozluk.set(ad('Last'), d.cocuklar.at(-1).ref); sozluk.set(ad('Count'), ctx.obj(toplamAlt(d))); }
    ctx.assign(d.ref, sozluk);
  }
  ctx.assign(kokRef, ctx.obj({ Type: 'Outlines', First: koku[0].ref, Last: koku.at(-1).ref, Count: dugumler.length }));
  doc.catalog.set(ad('Outlines'), kokRef);
  // Yer imi paneli görünsün
  if (!doc.catalog.get(ad('PageMode'))) doc.catalog.set(ad('PageMode'), ad('UseOutlines'));
  return { bayt: await kaydet(doc), adet: dugumler.length };
}

/** Belgedeki başlıkları (yazı boyutundan) bulup yer imi listesi önerir. */
export async function basliklardanYerimi(bayt, { enCokDuzey = 3, sayfalar = '' } = {}) {
  const { pdfYapisi } = await import('./pdf-word.js');
  const Y = await pdfYapisi(bayt, { sayfalar, ocr: 'yok', resimler: false, ustAltAtla: true });
  const liste = [];
  for (const b of Y.nihai) {
    if (b.tur !== 'p' || !b.baslik) continue;
    const baslik = b.satirlar.map((s) => s.metin).join(' ').replace(/\s+/g, ' ').trim();
    if (baslik.length < 2 || baslik.length > 160 || /^\d+$/.test(baslik)) continue;
    const duzey = Math.min(Math.max(1, b.duzey || 1), enCokDuzey);
    liste.push({ baslik, duzey, sayfa: b.sayfaNo - 1 });
  }
  return liste;
}

/** Çıktı dosya adı için başlık: önce üstveri başlığı (anlamlıysa), yoksa ilk sayfadaki en büyük yazı. Bulunamazsa null. */
export async function baslikBul(bayt) {
  const doc = await pdfAc(bayt);
  const t = (doc.getTitle() ?? '').trim();
  const anlamli = (s) => s.length >= 4 && !/^(untitled|adsız|microsoft word|document\d*|başlıksız|\w+\.(docx?|pdf|tex|indd))/i.test(s);
  if (anlamli(t)) return { baslik: t, kaynak: 'ustveri' };
  const { sayfaYazilari } = await import('./sayfa-icerik.js');
  const belge = await belgeAc(bayt);
  try {
    const { parcalar } = await sayfaYazilari(belge, 1);
    if (!parcalar.length) return null;
    const enBuyuk = Math.max(...parcalar.map((p) => p.boyut));
    const secili = parcalar.filter((p) => p.boyut >= enBuyuk * 0.9).sort((a, b) => b.y - a.y || a.x0 - b.x0);
    // aynı baskın boyuttaki ilk satır(lar): en üstten başlayıp en çok iki satır
    const ilkY = secili[0].y;
    const satirlar = secili.filter((p) => Math.abs(p.y - ilkY) < enBuyuk * 1.8);
    const s = satirlar.map((p) => p.metin).join(' ').replace(/\s+/g, ' ').trim();
    return anlamli(s) ? { baslik: s, kaynak: 'ilk-sayfa' } : null;
  } finally { await belge.kapat(); }
}
export { PDFArray, PDFDict, PDFRef };
