// Taranmış (resim) belgede, KULLANICININ SEÇTİĞİ bölgede yazı düzeltme: bölge zemin rengiyle örtülür,
// yeni yazı üstüne gerçek (seçilebilir) yazı olarak yazılır.
//
// DÜRÜSTLÜK / GÜVENLİK KURALLARI
//  - Hiçbir zaman tüm sayfa kendiliğinden yeniden yazılmaz: yalnızca kullanıcının işaretlediği bölgeler değişir
//    (OCR hata yapabilir; okunan yazı belgeye "gerçek yazı" olarak girmemelidir).
//  - "Örtme" kipinde eski görüntü dosyada kalır (yalnızca üstü kapatılır); bu açıkça uyarı olarak bildirilir.
//  - "Kalıcı" kipinde sayfa yeniden resimlenir: eski yazının pikselleri dosyadan gerçekten silinir.

import { PDFDocument } from 'pdf-lib';
import { belgeAc, sayfaCiz } from './render.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yeniIslem, SayfaCizici } from './cizim.js';
import { yaziTipiGom, yaziTipiOlcer, metniDogrula, VARSAYILAN_AILE, YAZI_AILELERI } from './fonts.js';
import { gorunmezKatmanEkle, ocrKatmanindanCikar } from './ocr.js';
import {
  sayfayiResmeCevir, kutuNormalle, kesisir, zeminRengi, yaziRengiTahmin, sayfaYaziKutulari,
} from './sayfa-resim.js';
import { PdfHatasi } from './hatalar.js';

const KENAR = 1.5; // örtünün bölgeden taşma payı (pt): yazının kenar yumuşatma artıklarını da kapatır
const TUR = 'duzeltme';

/**
 * @param duzeltmeler [{ sayfa (1 tabanlı), kutu:{x0,y0,x1,y1} (görünür nokta), metin, eskiMetin?, aile?, kalin?, italik?,
 *                       boyut? (pt; yoksa otomatik), renk? ('#rrggbb' | 'otomatik'), zemin? ('#rrggbb' | 'otomatik'), hizalama? }]
 * @param secenek.kalici  true → sayfa yeniden resimlenir, eski piksel kalmaz
 * @returns {{bayt, uyarilar:string[], rapor:{sayfa,metin,boyut,kucultme,tasma,zemin,renk}[]}}
 */
export async function bolgeDuzelt(bayt, duzeltmeler, { kalici = false, dpi = 200, bicim = 'jpeg', kalite = 0.9 } = {}) {
  if (!Array.isArray(duzeltmeler) || !duzeltmeler.length) throw new PdfHatasi('Düzeltilecek bölge seçilmedi.');
  const belge = await belgeAc(bayt);
  try {
    const kaynak = await pdfAc(bayt);
    const n = kaynak.getPageCount();
    const uyarilar = [];
    const rapor = [];

    // ---- Doğrulama ve normalleştirme ----
    const sayfaOlculeri = new Map();
    const boyutlar = async (no) => {
      if (!sayfaOlculeri.has(no)) {
        const s = await belge.getPage(no);
        const vp = s.getViewport({ scale: 1 });
        s.cleanup();
        sayfaOlculeri.set(no, { g: vp.width, y: vp.height });
      }
      return sayfaOlculeri.get(no);
    };
    const liste = [];
    for (const d of duzeltmeler) {
      if (!Number.isInteger(d.sayfa) || d.sayfa < 1 || d.sayfa > n) throw new PdfHatasi(`Sayfa ${d.sayfa} yok; bu belgede ${n} sayfa var.`);
      const o = await boyutlar(d.sayfa);
      const kutu = kutuNormalle(d.kutu ?? {}, o.g, o.y);
      if (kutu.x1 - kutu.x0 < 3 || kutu.y1 - kutu.y0 < 3) throw new PdfHatasi('Seçilen bölge çok küçük. Düzeltilecek yazıyı kapsayan bir alan seçin.');
      const aile = d.aile ?? VARSAYILAN_AILE;
      if (!YAZI_AILELERI[aile]) throw new PdfHatasi(`Bilinmeyen yazı tipi: ${aile}`);
      const stil = { kalin: !!d.kalin, italik: !!d.italik };
      const metin = String(d.metin ?? '').replace(/\s+/g, ' ').trim();
      if (metin) await metniDogrula(aile, stil, metin);
      liste.push({ ...d, kutu, aile, stil, metin });
    }

    // ---- Zemin ve yazı rengi örnekleme (sayfa başına bir kez çizilir) ----
    const ornekCizimi = new Map();
    for (const d of liste) {
      const gerek = (d.zemin ?? 'otomatik') === 'otomatik' || (d.renk ?? 'otomatik') === 'otomatik';
      if (gerek && !ornekCizimi.has(d.sayfa)) ornekCizimi.set(d.sayfa, (await sayfaCiz(belge, d.sayfa, { olcek: 110 / 72 })).tuval);
      const o = sayfaOlculeri.get(d.sayfa);
      d.zeminRenk = (d.zemin ?? 'otomatik') === 'otomatik' ? zeminRengi(ornekCizimi.get(d.sayfa), d.kutu, 110 / 72, o.y) : d.zemin;
      d.yaziRenk = (d.renk ?? 'otomatik') === 'otomatik' ? yaziRengiTahmin(ornekCizimi.get(d.sayfa), d.kutu, 110 / 72, o.y, d.zeminRenk) : d.renk;
    }

    // ---- Yazı yerleşimi (boyut / sığma) ----
    const yerlestir = async (d) => {
      const olcer = await yaziTipiOlcer(d.aile, d.stil);
      const kutuG = d.kutu.x1 - d.kutu.x0 - 2 * KENAR;
      const yuk = d.kutu.y1 - d.kutu.y0;
      const otomatik = !(d.boyut > 0);
      let boyut = d.boyut;
      if (otomatik) {
        boyut = yuk * 0.8;
        if (d.eskiMetin) {
          const w = olcer.genislik(String(d.eskiMetin)) / 1000;
          if (w > 0) boyut = Math.min(kutuG / w, yuk * 1.05);
        }
      }
      const ilk = boyut;
      const w1 = (olcer.genislik(d.metin) / 1000) * boyut;
      let tasma = 0, kucultme = 1;
      if (d.metin && w1 > kutuG) {
        if (otomatik) {
          kucultme = kutuG / w1;
          boyut *= kucultme;
          if (kucultme < 0.6) tasma = 1; // çok fazla küçültmek gerekti → yazı çok kısalmış görünür
        } else {
          tasma = w1 - kutuG;
        }
      }
      const w = (olcer.genislik(d.metin) / 1000) * boyut;
      const hiza = d.hizalama ?? 'sol';
      const x = hiza === 'orta' ? d.kutu.x0 + KENAR + Math.max(0, (kutuG - w) / 2) : hiza === 'sag' ? d.kutu.x1 - KENAR - w : d.kutu.x0 + KENAR;
      const y = (d.kutu.y0 + d.kutu.y1) / 2 - boyut * 0.3;
      return { boyut, x, y, ilk, kucultme, tasma };
    };
    for (const d of liste) {
      d.yer = await yerlestir(d);
      rapor.push({ sayfa: d.sayfa, metin: d.metin, boyut: Math.round(d.yer.boyut * 10) / 10, kucultme: d.yer.kucultme, tasma: d.yer.tasma, zemin: d.zeminRenk, renk: d.yaziRenk });
      if (d.metin && d.yer.kucultme < 0.85) uyarilar.push(`Sayfa ${d.sayfa}: yeni yazı seçilen alana sığmadığı için %${Math.round((1 - d.yer.kucultme) * 100)} küçültüldü. Daha geniş bir alan seçerseniz özgün boyutta yazılır.`);
      if (d.metin && d.yer.tasma && d.yer.kucultme >= 0.6) uyarilar.push(`Sayfa ${d.sayfa}: yeni yazı seçilen alandan yaklaşık ${Math.round(d.yer.tasma)} pt taşıyor; yanındaki yazıyı örtüyor olabilir. Kontrol edin.`);
    }

    const sayfaGruplari = new Map();
    for (const d of liste) {
      if (!sayfaGruplari.has(d.sayfa)) sayfaGruplari.set(d.sayfa, []);
      sayfaGruplari.get(d.sayfa).push(d);
    }
    const ortu = (d) => ({ x0: Math.max(0, d.kutu.x0 - KENAR), x1: d.kutu.x1 + KENAR, y0: Math.max(0, d.kutu.y0 - KENAR), y1: d.kutu.y1 + KENAR });

    const yazilariCiz = async (doc, page, gruplar, islem) => {
      const c = new SayfaCizici(islem, page);
      for (const d of gruplar) {
        if (!kalici) {
          const k = ortu(d);
          c.dikdortgen({ x: k.x0, y: k.y0, w: k.x1 - k.x0, h: k.y1 - k.y0, dolgu: d.zeminRenk });
        }
        if (d.metin) {
          const font = await yaziTipiGom(doc, d.aile, d.stil);
          c.metin({ font, metin: d.metin, boyut: d.yer.boyut, x: d.yer.x, y: d.yer.y, renk: d.yaziRenk });
        }
      }
      c.bitir('ust');
    };

    let cikti;
    let aramadanSilinen = 0;
    if (!kalici) {
      // ---- Örtme kipi: sayfa yerinde düzenlenir, eski görüntü altta kalır ----
      uyarilar.push(...ozellikUyarilari(belgeOzellikleri(kaynak), 'yerinde'));
      const islem = yeniIslem(kaynak, TUR);
      let temizlenen = 0;
      for (const [no, gruplar] of sayfaGruplari) {
        await yazilariCiz(kaynak, kaynak.getPage(no - 1), gruplar, islem);
        temizlenen += ocrKatmanindanCikar(kaynak, no - 1, gruplar.map((d) => d.kutu));
      }
      uyarilar.unshift('Eski yazının görüntüsü dosyada durmaya devam ediyor; yalnızca üstü örtüldü. Dosyayı başkalarıyla paylaşacaksanız “kalıcı” seçeneğini kullanın.');
      cikti = await kaydet(kaynak);
      // Arama katmanında (başka bir programın OCR'ı gibi) eski yazı kalmış mı?
      const sonBelge = await belgeAc(cikti);
      try {
        for (const [no, gruplar] of sayfaGruplari) {
          const kutular = await sayfaYaziKutulari(sonBelge, no);
          const artik = kutular.filter((q) => gruplar.some((d) => kesisir(q, d.kutu) && !d.metin.includes(q.metin.trim()) && !q.metin.includes(d.metin)));
          if (artik.length) uyarilar.push(`Sayfa ${no}: seçilen bölgede arama katmanında eski yazı kalmış olabilir (“${artik[0].metin.trim().slice(0, 40)}”). Tamamen kaldırmak için “kalıcı” seçeneğini kullanın.`);
        }
      } finally { await sonBelge.kapat(); }
      aramadanSilinen = temizlenen;
    } else {
      // ---- Kalıcı kip: düzeltilen sayfalar yeniden resimlenir; eski piksel dosyada kalmaz ----
      uyarilar.push(...ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge'));
      const cikis = await PDFDocument.create();
      const islem = yeniIslem(cikis, TUR);
      for (let i = 0; i < n; i++) {
        const gruplar = sayfaGruplari.get(i + 1);
        if (!gruplar) {
          const [p] = await cikis.copyPages(kaynak, [i]);
          cikis.addPage(p);
          continue;
        }
        const yaziKutulari = await sayfaYaziKutulari(belge, i + 1);
        const korunan = yaziKutulari.filter((q) => !gruplar.some((d) => kesisir(q, ortu(d))));
        const r = await sayfayiResmeCevir(belge, i + 1, {
          dpi, bicim, kalite, kutular: gruplar.map((d) => ({ ...ortu(d), renk: d.zeminRenk })),
        });
        const resim = bicim === 'png' ? await cikis.embedPng(r.bayt) : await cikis.embedJpg(r.bayt);
        const p = cikis.addPage([r.genislik, r.yukseklik]);
        p.drawImage(resim, { x: 0, y: 0, width: r.genislik, height: r.yukseklik });
        await yazilariCiz(cikis, p, gruplar, islem);
        if (korunan.length) await gorunmezKatmanEkle(cikis, [{ index: i, kelimeler: korunan }]);
      }
      cikti = await kaydet(cikis);
      uyarilar.unshift(`Düzeltilen sayfalar ${dpi} dpi çözünürlükte yeniden resimlendi; eski yazının görüntüsü dosyadan tamamen silindi. Bu sayfalardaki diğer içerik de resme dönüştü (yazı arama katmanı olarak korundu).`);
    }
    uyarilar.push('Değiştirilen yazılar sizin yazdığınız metindir; programın OCR ile okuduğu bir şey belgeye otomatik yazılmaz. Çıktıyı gözle kontrol edin.');
    return { bayt: cikti, uyarilar, rapor, aramadanSilinen };
  } finally {
    await belge.kapat();
  }
}
