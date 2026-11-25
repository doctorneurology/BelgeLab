// "Bul ve değiştir": yazı düzelt motorunun çözümlediği satırlarda arama yapar ve yeni satır metinlerini hazırlar.
// Motorun kendisi değişmez: sonuç, `yaziDuzelt`in `degisiklikler` nesnesine konacak { satirId: { metin } } biçimindedir.
// Türkçe büyük/küçük harf (I/ı, İ/i) doğru işlenir. Düz yazı aranır (düzenli ifade yok); bir satırı bölen ifadeler bulunmaz.
import { PdfHatasi } from '../hatalar.js';

const kucult = (s, buyukKucuk) => (buyukKucuk ? s : s.toLocaleLowerCase('tr-TR'));
const HARF = /[\p{L}\p{N}_]/u;

/**
 * @param ozet       yaziAnalizEt sonucu
 * @param opt        { ara, yerine, buyukKucuk=false, tamKelime=false, mevcut={satirId:{metin}} }
 * @returns {{eslesmeler:{id,sayfa,once,sonra,adet}[], toplam:number, atlanan:number}}
 *   atlanan: aranan yazıyı içeren ama korumalı (üst/alt bilgi, logo…) olduğu için değiştirilemeyen satır sayısı
 */
export function bulEslesmeler(ozet, { ara, yerine = '', buyukKucuk = false, tamKelime = false, mevcut = {}, kilitAcik = [] } = {}) {
  if (!ara) throw new PdfHatasi('Aranacak yazıyı girin.');
  const igne = kucult(ara, buyukKucuk);
  const eslesmeler = [];
  let toplam = 0, atlanan = 0;
  for (const s of ozet.sayfalar) {
    for (const l of s.satirlar) {
      const metin = mevcut[l.id]?.metin ?? l.metin;
      const saman = kucult(metin, buyukKucuk);
      if (saman.length !== metin.length) continue; // büyük/küçük harf dönüşümü uzunluğu değiştirdiyse (çok nadir) güvenli değil
      let sonuc = '', son = 0, adet = 0;
      for (let i = saman.indexOf(igne); i >= 0; i = saman.indexOf(igne, i + 1)) {
        if (tamKelime && ((i > 0 && HARF.test(saman[i - 1])) || (i + igne.length < saman.length && HARF.test(saman[i + igne.length])))) continue;
        sonuc += metin.slice(son, i) + yerine;
        son = i + igne.length; adet++;
        i = son - 1;
      }
      if (!adet) continue;
      const korumali = l.koruma && l.koruma !== 'cozulemedi' && !(l.koruma === 'ustalt' && kilitAcik.includes(l.id));
      if (korumali || l.koruma === 'cozulemedi') { atlanan++; continue; }
      toplam += adet;
      eslesmeler.push({ id: l.id, sayfa: l.sayfa ?? s.no, once: metin, sonra: sonuc + metin.slice(son), adet });
    }
  }
  return { eslesmeler, toplam, atlanan };
}
