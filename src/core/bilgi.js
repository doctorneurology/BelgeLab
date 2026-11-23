// Sayfa numarası ve üst/alt bilgi ekleme.

import { PdfHatasi } from './hatalar.js';
import { pdfAc, kaydet, belgeOzellikleri, ozellikUyarilari } from './belge.js';
import { yaziTipiGom, metniDogrula, VARSAYILAN_AILE } from './fonts.js';
import { yeniIslem, SayfaCizici } from './cizim.js';
import { sayfaSecimi, romaRakami } from './util.js';

export const KONUMLAR = ['ust-sol', 'ust-orta', 'ust-sag', 'alt-sol', 'alt-orta', 'alt-sag'];

function sayiMetni(n, bicim) {
  if (bicim === 'roma') return romaRakami(n);
  if (bicim === 'roma-kucuk') return romaRakami(n).toLowerCase();
  return String(n);
}

function tarihMetni(tarih) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(tarih);
}

/**
 * @param secenek.alanlar  {'ust-sol':'metin', ...}  Metinde {n} {toplam} {tarih} {dosya} kullanılabilir.
 * @param secenek.sayfalar boşsa tüm sayfalar; "2-" gibi aralık
 * @param secenek.baslangicNo ilk numaralanan sayfanın numarası
 */
export async function bilgiEkle(bayt, secenek) {
  const {
    alanlar, sayfalar = '', baslangicNo = 1, numaraBicimi = 'arap',
    aile = VARSAYILAN_AILE, kalin = false, italik = false, boyut = 10, renk = '#000000',
    kenar = 28, dosyaAdi = '', tarih = new Date(),
  } = secenek;
  const dolu = Object.entries(alanlar ?? {}).filter(([k, v]) => KONUMLAR.includes(k) && String(v ?? '').trim() !== '');
  if (!dolu.length) throw new PdfHatasi('Eklenecek bir metin yazın.');
  if (!(boyut >= 4 && boyut <= 100)) throw new PdfHatasi('Yazı boyutu 4 ile 100 arasında olmalı.');

  const doc = await pdfAc(bayt);
  const secili = sayfaSecimi(sayfalar, doc.getPageCount());
  const stil = { kalin, italik };
  const font = await yaziTipiGom(doc, aile, stil);
  const sonNo = baslangicNo + secili.length - 1;
  const islem = yeniIslem(doc, 'bilgi');
  const uyarilar = ozellikUyarilari(belgeOzellikleri(doc), 'yerinde');

  // Karakter denetimi: şablon + olası rakamlar + tarih + dosya adı
  const ornek = dolu.map(([, v]) => v).join(' ') + ' 0123456789 IVXLCDM ivxlcdm ' + tarihMetni(tarih) + ' ' + dosyaAdi;
  await metniDogrula(aile, stil, ornek);

  secili.forEach((sayfaIdx, sira) => {
    const page = doc.getPage(sayfaIdx);
    const c = new SayfaCizici(islem, page);
    const no = baslangicNo + sira;
    for (const [konum, sablon] of dolu) {
      const metin = String(sablon)
        .replaceAll('{n}', sayiMetni(no, numaraBicimi))
        .replaceAll('{toplam}', sayiMetni(sonNo, numaraBicimi))
        .replaceAll('{tarih}', tarihMetni(tarih))
        .replaceAll('{dosya}', dosyaAdi);
      const genislik = font.widthOfTextAtSize(metin, boyut);
      const [dikey, yatay] = konum.split('-');
      const x = yatay === 'sol' ? kenar : yatay === 'sag' ? c.genislik - kenar - genislik : (c.genislik - genislik) / 2;
      const y = dikey === 'ust' ? c.yukseklik - kenar - font.heightAtSize(boyut, { descender: false }) : kenar;
      if (genislik > c.genislik - 2 * kenar + 0.5) {
        uyarilar.push(`Sayfa ${sayfaIdx + 1}: "${metin}" sayfaya sığmıyor olabilir.`);
      }
      c.metin({ font, metin, boyut, x, y, renk });
    }
    c.bitir('ust');
  });

  return { bayt: await kaydet(doc), sayfaSayisi: doc.getPageCount(), islenen: secili.length, uyarilar };
}

/** Yalnızca sayfa numarası ekleyen kısayol. */
export async function sayfaNumarasiEkle(bayt, secenek) {
  const { konum = 'alt-orta', bicim = '{n}', ...diger } = secenek;
  if (!KONUMLAR.includes(konum)) throw new PdfHatasi('Geçersiz konum.');
  return bilgiEkle(bayt, { ...diger, alanlar: { [konum]: bicim } });
}
