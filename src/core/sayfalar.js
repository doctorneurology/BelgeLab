// Birleştir, böl, sayfa sil / sırala / döndür / çıkar.
// Sayfalar yeni bir belgeye KOPYALANIR; böylece silinen sayfaların içeriği dosyada gizli kalmaz.

import { PDFDocument, degrees } from 'pdf-lib';
import { PdfHatasi, SifreliPdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { sayfaAraligiCoz, sayfaSecimi, dosyaAdiTuret } from './util.js';

function aciNormal(a) {
  const n = ((Math.round(a) % 360) + 360) % 360;
  if (n % 90 !== 0) throw new PdfHatasi('Döndürme açısı 90\'ın katı olmalı (90, 180, 270).');
  return n;
}

/**
 * Kaynak belgeden, verilen sırayla sayfaları alıp yeni bir belge üretir.
 * @param sira [{indeks, don}]  don: mevcut döndürmeye eklenecek açı
 */
async function yeniBelgeOlustur(kaynak, sira) {
  const cikti = await PDFDocument.create();
  const kopyalar = await cikti.copyPages(kaynak, sira.map((s) => s.indeks));
  kopyalar.forEach((p, i) => {
    const ek = aciNormal(sira[i].don ?? 0);
    if (ek) p.setRotation(degrees((p.getRotation().angle + ek) % 360));
    cikti.addPage(p);
  });
  return cikti;
}

/** @param girdiler [{ad, bayt}] */
export async function birlestir(girdiler) {
  if (!girdiler || girdiler.length < 2) throw new PdfHatasi('Birleştirmek için en az iki PDF seçin.');
  const cikti = await PDFDocument.create();
  const uyarilar = [];
  for (const g of girdiler) {
    let kaynak;
    try {
      kaynak = await pdfAc(g.bayt);
    } catch (e) {
      if (e instanceof SifreliPdfHatasi) e.message = `"${g.ad}" şifreli. Önce şifresini girip açın.`;
      else if (e instanceof PdfHatasi) e.message = `"${g.ad}" açılamadı. ${e.message}`;
      throw e;
    }
    ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge').forEach((u) => uyarilar.push(`${g.ad}: ${u}`));
    const kopyalar = await cikti.copyPages(kaynak, kaynak.getPageIndices());
    kopyalar.forEach((p) => cikti.addPage(p));
  }
  return { bayt: await kaydet(cikti), sayfaSayisi: cikti.getPageCount(), uyarilar };
}

/**
 * @param secenek.mod 'aralik' | 'her-n' | 'tek'
 *   aralik: secenek.araliklar = "1-3; 4-6; 8"  (her ";" ayrı bir dosya; dosya içinde virgülle sayfa listesi)
 *   her-n:  secenek.n = kaç sayfada bir bölüneceği
 *   tek:    her sayfa ayrı dosya
 * @returns {{dosyalar:{ad:string,bayt:Uint8Array,sayfalar:number[]}[], uyarilar:string[]}}
 */
export async function bol(bayt, dosyaAdi, secenek) {
  const kaynak = await pdfAc(bayt);
  const n = kaynak.getPageCount();
  const uyarilar = ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge');
  let gruplar;
  if (secenek.mod === 'tek') {
    gruplar = Array.from({ length: n }, (_, i) => [i]);
  } else if (secenek.mod === 'her-n') {
    const k = Math.floor(Number(secenek.n));
    if (!(k >= 1)) throw new PdfHatasi('Sayfa sayısı en az 1 olmalı.');
    gruplar = [];
    for (let i = 0; i < n; i += k) gruplar.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j));
  } else if (secenek.mod === 'aralik') {
    const parcalar = String(secenek.araliklar ?? '').split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parcalar.length) throw new PdfHatasi('Bölme aralığı boş. Örnek: 1-3; 4-6; 7-');
    gruplar = parcalar.map((p) => sayfaAraligiCoz(p, n));
  } else {
    throw new PdfHatasi('Bilinmeyen bölme türü.');
  }
  if (gruplar.length < 1) throw new PdfHatasi('Çıktı dosyası oluşmadı.');
  const hane = String(gruplar.length).length;
  const dosyalar = [];
  for (let g = 0; g < gruplar.length; g++) {
    const doc = await yeniBelgeOlustur(kaynak, gruplar[g].map((indeks) => ({ indeks })));
    const etiket = secenek.mod === 'tek'
      ? `-sayfa-${String(gruplar[g][0] + 1).padStart(String(n).length, '0')}`
      : `-bolum-${String(g + 1).padStart(Math.max(2, hane), '0')}`;
    dosyalar.push({
      ad: dosyaAdiTuret(dosyaAdi, etiket),
      bayt: await kaydet(doc),
      sayfalar: gruplar[g].map((i) => i + 1),
    });
  }
  return { dosyalar, uyarilar };
}

/** Genel amaçlı: [{indeks, don}] listesine göre yeni belge. Diğer işlemler bunun üzerine kuruludur. */
export async function sayfaDuzenle(bayt, sira) {
  const kaynak = await pdfAc(bayt);
  const n = kaynak.getPageCount();
  if (!sira.length) throw new PdfHatasi('Çıktıda en az bir sayfa olmalı.');
  for (const s of sira) {
    if (!Number.isInteger(s.indeks) || s.indeks < 0 || s.indeks >= n) {
      throw new PdfHatasi(`Sayfa ${s.indeks + 1} yok; bu belgede ${n} sayfa var.`);
    }
  }
  const uyarilar = ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge');
  const doc = await yeniBelgeOlustur(kaynak, sira);
  return { bayt: await kaydet(doc), sayfaSayisi: doc.getPageCount(), uyarilar };
}

export async function sayfaSil(bayt, silinecekMetin) {
  const kaynak = await pdfAc(bayt);
  const n = kaynak.getPageCount();
  const sil = new Set(sayfaAraligiCoz(silinecekMetin, n));
  const kalan = [...Array(n).keys()].filter((i) => !sil.has(i));
  if (!kalan.length) throw new PdfHatasi('Tüm sayfaları silemezsiniz; en az bir sayfa kalmalı.');
  const sonuc = await sayfaDuzenle(bayt, kalan.map((indeks) => ({ indeks })));
  return { ...sonuc, silinen: sil.size };
}

/** yeniSira: 0 tabanlı dizinlerin, TÜM sayfaları içeren bir permütasyonu */
export async function sayfaSirala(bayt, yeniSira) {
  const kaynak = await pdfAc(bayt);
  const n = kaynak.getPageCount();
  const kume = new Set(yeniSira);
  if (yeniSira.length !== n || kume.size !== n || [...kume].some((i) => !(i >= 0 && i < n))) {
    throw new PdfHatasi(`Sıralama tüm ${n} sayfayı tam olarak bir kez içermeli.`);
  }
  return sayfaDuzenle(bayt, yeniSira.map((indeks) => ({ indeks })));
}

/**
 * Sayfaları döndürür; belgenin geri kalanına dokunmaz (form, yer imi vb. korunur).
 * @param donusler {[indeks:number]: ekAci} ya da (aci, secimMetni) kısayolu için dondurTumu
 */
export async function sayfaDondur(bayt, donusler) {
  const doc = await pdfAc(bayt);
  const n = doc.getPageCount();
  let degisen = 0;
  for (const [k, ek] of Object.entries(donusler)) {
    const i = Number(k);
    if (!(i >= 0 && i < n)) throw new PdfHatasi(`Sayfa ${i + 1} yok; bu belgede ${n} sayfa var.`);
    const a = aciNormal(ek);
    if (!a) continue;
    const p = doc.getPage(i);
    p.setRotation(degrees((p.getRotation().angle + a) % 360));
    degisen++;
  }
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');
  return { bayt: await kaydet(doc), sayfaSayisi: n, degisen, uyarilar };
}

/** Seçilen sayfaları (boşsa hepsini) aynı açıyla döndürür. */
export async function sayfaDondurSecim(bayt, aci, secimMetni = '') {
  const doc = await pdfAc(bayt);
  const idx = sayfaSecimi(secimMetni, doc.getPageCount());
  return sayfaDondur(bayt, Object.fromEntries(idx.map((i) => [i, aci])));
}

/** Yazılan aralıktaki sayfaları, yazıldığı sırayla yeni bir PDF yapar. */
export async function sayfaCikar(bayt, aralikMetni) {
  const kaynak = await pdfAc(bayt);
  const idx = sayfaAraligiCoz(aralikMetni, kaynak.getPageCount());
  return sayfaDuzenle(bayt, idx.map((indeks) => ({ indeks })));
}
