// GERÇEK KARARTMA (redaksiyon): seçilen bölgelerdeki içerik hem görüntüden hem DOSYADAN silinir.
//
// Yöntem: karartma içeren her sayfa "ekranda göründüğü gibi" resme çevrilir, bölgeler resimde düz renge boyanır
// (pikseller kalıcı olarak yok edilir) ve sayfa bu resimle YENİ bir belgeye yazılır. Eski sayfanın içerik akışı,
// yazı tipleri, resimleri, açıklamaları, gizli yazıları yeni belgeye hiç taşınmaz → altında hiçbir şey kalmaz.
// (Siyah kutu çizip altını bırakmak karartma DEĞİLDİR; bu araç öyle yapmaz.)
//   - Karartma içermeyen sayfalar olduğu gibi kopyalanır (değişmez).
//   - Karartılan sayfalarda yazı yeniden aranabilir yapılır, ama karartılan alanla kesişen ya da aranan metni
//     içeren her yazı parçası dışarıda bırakılır (temkinli: gerekenden fazlası atılır).
//   - Belge bilgileri (başlık/yazar/konu/anahtar kelimeler) temizlenir; yer imleri, ekler ve form alanları
//     yeni belgeye taşınmaz (içlerinde gizli bilgi kalmasın) — bu sonuçta uyarı olarak gösterilir.
//   - Çıktı yeniden okunup doğrulanır: aranan metin ve karartılan alandaki yazı KALMAMIŞ olmalı.

import { PDFDocument } from 'pdf-lib';
import { belgeAc } from './render.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { sayfayiResmeCevir, sayfaYaziKutulari, kutuNormalle, kesisir } from './sayfa-resim.js';
import { gorunmezKatmanEkle, sayfaOcr, sayfadaYaziVarMi } from './ocr.js';
import { PdfHatasi } from './hatalar.js';
import { sayfaSecimi } from './util.js';

/** Hazır arama desenleri (kullanıcı arayüzündeki "kolay seçimler"). */
export const HAZIR_DESENLER = {
  eposta: { ad: 'E-posta adresleri', desen: '[\\p{L}0-9._%+-]+@[\\p{L}0-9.-]+\\.[\\p{L}]{2,}' },
  telefon: { ad: 'Telefon numaraları', desen: '(?:\\+90|0)?\\s?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{2}' },
  tc: { ad: '11 haneli sayılar (TC kimlik no benzeri)', desen: '(?<!\\d)\\d{11}(?!\\d)' },
  iban: { ad: 'IBAN numaraları', desen: 'TR\\d{2}(?:\\s?\\d{4}){5}\\s?\\d{2}' },
};

const sadelestir = (m) => String(m).toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/̇/g, '');

function aramaBicimleri(terimler) {
  return (terimler ?? []).map((t) => {
    if (typeof t === 'string') {
      const metin = sadelestir(t).replace(/\s+/g, ' ').trim();
      if (!metin) return null;
      return { ad: t, regex: new RegExp(metin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu') };
    }
    try { return { ad: t.ad ?? t.desen, regex: new RegExp(t.desen, 'giu') }; } catch { throw new PdfHatasi(`“${t.ad ?? t.desen}” geçerli bir arama deseni değil.`); }
  }).filter(Boolean);
}

/** Bir sayfanın yazı parçalarında (dar dikey kutularla) terimleri arar. */
function parcalardaAra(parcalar, bicimler) {
  const idler = [];
  let tam = '';
  parcalar.forEach((p, i) => {
    const m = sadelestir(p.metin).replace(/\s+/g, ' ');
    idler.push({ i, bas: tam.length, bit: tam.length + m.length, uzunluk: m.length || 1 });
    tam += `${m} `;
  });
  const sonuc = [];
  for (const b of bicimler) {
    b.regex.lastIndex = 0;
    for (let m = b.regex.exec(tam); m; m = b.regex.exec(tam)) {
      if (m[0].length === 0) { b.regex.lastIndex++; continue; }
      const a = m.index, z = m.index + m[0].length;
      for (const o of idler) {
        if (o.bit <= a || o.bas >= z) continue;
        const p = parcalar[o.i];
        const bas = Math.max(a, o.bas) - o.bas, bit = Math.min(z, o.bit) - o.bas;
        const harfG = (p.x1 - p.x0) / o.uzunluk;
        const tamParca = bas <= 0 && bit >= o.uzunluk - 1;
        // tahmin: harf genişlikleri orantılı varsayılır; hata payı olarak her iki yana 1,5 harf + 1 pt
        const pay = tamParca ? 1 : 1.5 * harfG + 1;
        const x0 = Math.max(p.x0 - 1, p.x0 + bas * harfG - pay);
        const x1 = Math.min(p.x1 + 1, p.x0 + bit * harfG + pay);
        const h = p.boyut || (p.y1 - p.y0);
        sonuc.push({ terim: b.ad, parca: o.i, metin: m[0], kutu: { x0: tamParca ? p.x0 - 1 : x0, x1: tamParca ? p.x1 + 1 : x1, y0: p.y0 + 0.03 * h, y1: p.y1 - 0.03 * h } });
      }
    }
  }
  return sonuc;
}

async function sayfaParcalari(belge, no, { ocr = false, dil = 'tur' } = {}) {
  if (!ocr || await sayfadaYaziVarMi(belge, no)) return { parcalar: await sayfaYaziKutulari(belge, no), ocrYapildi: false };
  const o = await sayfaOcr(belge, no, { dil });
  return { parcalar: o.kelimeler.map((k) => ({ metin: k.metin, x0: k.x0, x1: k.x1, y0: k.y0, y1: k.y1, boyut: k.y1 - k.y0 })), ocrYapildi: true };
}

/**
 * Terimleri (metin ya da {desen}) sayfalarda arar ve karartılacak kutuları önerir (henüz hiçbir şey değiştirmez).
 * @returns {{eslesmeler:{sayfa,terim,metin,kutu}[], ocrSayfa:number}}
 */
export async function karartmaAra(bayt, terimler, { sayfalar = '', ocr = false, dil = 'tur', ilerleme } = {}) {
  const bicimler = aramaBicimleri(terimler);
  if (!bicimler.length) throw new PdfHatasi('Aranacak bir metin yazın.');
  const belge = await belgeAc(bayt);
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    const eslesmeler = [];
    let ocrSayfa = 0;
    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      ilerleme?.(k, secili.length, `Sayfa ${no} taranıyor…`);
      const { parcalar, ocrYapildi } = await sayfaParcalari(belge, no, { ocr, dil });
      if (ocrYapildi) ocrSayfa++;
      for (const e of parcalardaAra(parcalar, bicimler)) eslesmeler.push({ sayfa: no, terim: e.terim, metin: e.metin, kutu: e.kutu });
    }
    return { eslesmeler, ocrSayfa };
  } finally {
    await belge.kapat();
  }
}

/**
 * @param secenek.kutular  [{sayfa (1 tabanlı), x0,y0,x1,y1}] görünür nokta koordinatlı, orijin sol-alt
 * @param secenek.ara      aranacak metinler / {desen}: bulunan her yer karartılır
 * @param secenek.ocr      true: yazısız (taranmış) sayfalarda arama için OCR kullan
 * @param secenek.renk     '#000000' (siyah) ya da '#ffffff' (beyaz)
 * @param secenek.aranabilirKalsin  karartılan sayfalarda kalan yazı yeniden aranabilir olsun
 * @returns {{bayt, degisti, uyarilar:string[], rapor:{kutu,sayfa,eslesme,dogrulama:{kalanEslesme,kutuIciYazi,gecti}}}}
 */
export async function karart(bayt, {
  kutular = [], ara = [], ocr = false, dil = 'tur', renk = '#000000', dpi = 200, bicim = 'otomatik', kalite = 0.9,
  aranabilirKalsin = true, ilerleme,
} = {}) {
  if (!['#000000', '#ffffff'].includes(String(renk).toLowerCase())) throw new PdfHatasi('Karartma rengi siyah ya da beyaz olabilir.');
  if (!(dpi >= 72 && dpi <= 400)) throw new PdfHatasi('Çözünürlük 72 ile 400 dpi arasında olmalı.');
  const bicimler = aramaBicimleri(ara);
  const belge = await belgeAc(bayt);
  try {
    const kaynak = await pdfAc(bayt);
    const n = kaynak.getPageCount();
    const uyarilar = [];
    const sayfaKutulari = new Map(); // sayfa → [{x0..y1}]
    const oturanParcalar = new Map(); // sayfa → parçalar (katman için)
    const eslesenParcalar = new Map(); // sayfa → Set(parça indisi): aranan metni içeren parçalar katmana alınmaz
    const ekle = (no, k) => { if (!sayfaKutulari.has(no)) sayfaKutulari.set(no, []); sayfaKutulari.get(no).push(k); };

    const olculer = new Map();
    for (const k of kutular) {
      if (!Number.isInteger(k.sayfa) || k.sayfa < 1 || k.sayfa > n) throw new PdfHatasi(`Sayfa ${k.sayfa} yok; bu belgede ${n} sayfa var.`);
      if (!olculer.has(k.sayfa)) { const s = await belge.getPage(k.sayfa); const vp = s.getViewport({ scale: 1 }); s.cleanup(); olculer.set(k.sayfa, vp); }
      const vp = olculer.get(k.sayfa);
      const nk = kutuNormalle(k, vp.width, vp.height);
      if (nk.x1 - nk.x0 < 1 || nk.y1 - nk.y0 < 1) throw new PdfHatasi('Karartılacak bölge çok küçük.');
      ekle(k.sayfa, nk);
    }
    let eslesme = 0;
    let ocrSayfa = 0;
    if (bicimler.length) {
      for (let i = 0; i < n; i++) {
        ilerleme?.(i, n, `Sayfa ${i + 1} taranıyor…`);
        const { parcalar, ocrYapildi } = await sayfaParcalari(belge, i + 1, { ocr, dil });
        if (ocrYapildi) ocrSayfa++;
        oturanParcalar.set(i + 1, parcalar);
        const bulunan = parcalardaAra(parcalar, bicimler);
        eslesme += bulunan.length;
        for (const e of bulunan) {
          ekle(i + 1, e.kutu);
          if (!eslesenParcalar.has(i + 1)) eslesenParcalar.set(i + 1, new Set());
          eslesenParcalar.get(i + 1).add(e.parca);
        }
      }
    }
    if (!sayfaKutulari.size) {
      return { bayt, degisti: false, uyarilar: [bicimler.length ? 'Aranan metin belgede bulunamadı; hiçbir şey karartılmadı. (Taranmış belgede “OCR ile ara” seçeneğini deneyin.)' : 'Karartılacak bölge seçilmedi.'], rapor: { kutu: 0, sayfa: 0, eslesme: 0, dogrulama: { kalanEslesme: 0, kutuIciYazi: 0, gecti: true } } };
    }

    uyarilar.push(...ozellikUyarilari(belgeOzellikleri(kaynak), 'yeniBelge'));
    const cikis = await PDFDocument.create();
    const boya = String(renk).toLowerCase();
    let sirada = 0;
    for (let i = 0; i < n; i++) {
      const kutuListesi = sayfaKutulari.get(i + 1);
      if (!kutuListesi) {
        const [p] = await cikis.copyPages(kaynak, [i]);
        cikis.addPage(p);
        continue;
      }
      ilerleme?.(sirada++, sayfaKutulari.size, `Sayfa ${i + 1} karartılıyor…`);
      const parcalar = oturanParcalar.get(i + 1) ?? (aranabilirKalsin ? (await sayfaParcalari(belge, i + 1, { ocr: false })).parcalar : []);
      const yasak = eslesenParcalar.get(i + 1) ?? new Set();
      const korunan = parcalar.filter((p, k) => !yasak.has(k) && !kutuListesi.some((q) => kesisir(p, q)));
      let r = await sayfayiResmeCevir(belge, i + 1, { dpi, bicim: bicim === 'jpeg' ? 'jpeg' : 'png', kalite, kutular: kutuListesi.map((q) => ({ ...q, renk: boya })) });
      let kullanilan = bicim === 'jpeg' ? 'jpeg' : 'png';
      if (bicim === 'otomatik' && r.bayt.length > 600 * 1024) {
        const j = await sayfayiResmeCevir(belge, i + 1, { dpi, bicim: 'jpeg', kalite, kutular: kutuListesi.map((q) => ({ ...q, renk: boya })) });
        if (j.bayt.length < r.bayt.length * 0.6) { r = j; kullanilan = 'jpeg'; }
      }
      const resim = kullanilan === 'png' ? await cikis.embedPng(r.bayt) : await cikis.embedJpg(r.bayt);
      const p = cikis.addPage([r.genislik, r.yukseklik]);
      p.drawImage(resim, { x: 0, y: 0, width: r.genislik, height: r.yukseklik });
      if (aranabilirKalsin && korunan.length) await gorunmezKatmanEkle(cikis, [{ index: cikis.getPageCount() - 1, kelimeler: korunan }]);
    }
    // Belge bilgileri: özgün bilgiler taşınmadı (yeni belge); açıkça boşalt
    cikis.setTitle(''); cikis.setAuthor(''); cikis.setSubject(''); cikis.setKeywords([]); cikis.setCreator('');
    const cikti = await kaydet(cikis);

    // ---- Doğrulama: çıktıyı yeniden oku ----
    const dogrulama = { kalanEslesme: 0, kutuIciYazi: 0, gecti: true };
    const sonBelge = await belgeAc(cikti);
    try {
      for (const [no, kutuListesi] of sayfaKutulari) {
        const parcalar = await sayfaYaziKutulari(sonBelge, no);
        dogrulama.kutuIciYazi += parcalar.filter((p) => kutuListesi.some((q) => kesisir(p, q))).length;
        if (bicimler.length) dogrulama.kalanEslesme += parcalardaAra(parcalar, bicimler).length;
      }
    } finally { await sonBelge.kapat(); }
    dogrulama.gecti = dogrulama.kalanEslesme === 0 && dogrulama.kutuIciYazi === 0;
    if (!dogrulama.gecti) uyarilar.unshift(`DOĞRULAMA BAŞARISIZ: karartılan alanda ${dogrulama.kutuIciYazi} yazı parçası, ${dogrulama.kalanEslesme} eşleşme kalmış görünüyor. Bu dosyayı paylaşmayın.`);

    uyarilar.push(`${sayfaKutulari.size} sayfa ${dpi} dpi çözünürlükte yeniden resimlendi; karartılan alandaki yazı/görüntü dosyadan kalıcı olarak silindi ve geri getirilemez. Özgün dosyanızı saklayın.`);
    if (aranabilirKalsin) uyarilar.push('Bu sayfalardaki karartılmayan yazı aranabilir bırakıldı (karartılan alanla kesişen ya da aranan metni içeren parçalar hariç).');
    else uyarilar.push('Karartılan sayfalardaki yazı artık seçilemez/aranamaz (sayfa resim oldu).');
    uyarilar.push('Belge bilgileri (başlık, yazar, konu, anahtar kelimeler) temizlendi. Yer imleri, ekler ve form alanları yeni dosyaya taşınmadı.');
    if (eslesme) uyarilar.push(`Aranan metin ${eslesme} yerde bulundu. Kutular yazı konumundan TAHMİN edildi; sonucu gözle kontrol edin (özellikle uzun satırların ortasındaki kelimelerde).`);
    if (ocrSayfa) uyarilar.push(`${ocrSayfa} taranmış sayfada arama için OCR kullanıldı; OCR bir kelimeyi yanlış okuduysa o kelime bulunamamış olabilir. Hassas bilgi için kutuları elle de işaretleyin.`);
    const toplamKutu = [...sayfaKutulari.values()].reduce((t, d) => t + d.length, 0);
    return { bayt: cikti, degisti: true, uyarilar, rapor: { kutu: toplamKutu, sayfa: sayfaKutulari.size, eslesme, dogrulama } };
  } finally {
    await belge.kapat();
  }
}
