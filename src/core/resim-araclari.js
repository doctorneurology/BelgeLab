// Resim araçları: boyutlandır, sıkıştır, JPG/PNG/WebP dönüştür. Tarayıcıda canvas ile; hiçbir şey dışarı gönderilmez.
// NOT: JPEG fotoğraflardaki EXIF yönelimi (telefonla çekilmiş dik fotoğraf) tarayıcı çözücüsü tarafından uygulanır; EXIF
// üstverisi (konum, cihaz) çıktıya TAŞINMAZ — yeniden kodlanan resim temizdir.
import { resimCoz, tuvalOlustur, tuvaliBayta } from './render.js';
import { resimTuru } from './resim-pdf.js';
import { PdfHatasi } from './hatalar.js';
import { dosyaAdiTuret } from './util.js';

const UZANTI = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const MIME_TUR = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };

/** Büyük küçültmelerde kaliteyi korumak için kademeli (yarıya) küçültme. */
function kucult(kaynak, w0, h0, w, h) {
  let tuval = tuvalOlustur(w0, h0); tuval.getContext('2d').drawImage(kaynak, 0, 0);
  let cw = w0, ch = h0;
  while (cw / 2 >= w && ch / 2 >= h) {
    const nw = Math.round(cw / 2), nh = Math.round(ch / 2);
    const t = tuvalOlustur(nw, nh); const g = t.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(tuval, 0, 0, nw, nh);
    tuval = t; cw = nw; ch = nh;
  }
  const son = tuvalOlustur(w, h); const g = son.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(tuval, 0, 0, w, h);
  return son;
}

/**
 * @param secenek.genislik / yukseklik  piksel (biri boşsa oran korunur); secenek.yuzde: orana göre küçült/büyüt
 * @param secenek.bicim    'jpeg' | 'png' | 'webp' | 'ayni'
 * @param secenek.kalite   0.1–1 (jpeg/webp)
 * @param secenek.hedefKB  verilirse kalite, çıktı bu boyutun altına inene kadar düşürülür (jpeg/webp)
 * @param secenek.arkaPlan saydam resim JPEG'e çevrilirken zemin rengi
 * @returns {{ad, bayt, genislik, yukseklik, bicim, uyarilar}}
 */
export async function resimIsle(bayt, dosyaAdi = 'resim.png', { genislik, yukseklik, yuzde, bicim = 'ayni', kalite = 0.85, hedefKB, arkaPlan = '#ffffff' } = {}) {
  const tur = resimTuru(bayt);
  if (!tur) throw new PdfHatasi('Bu dosya desteklenen bir resim gibi görünmüyor (JPG, PNG, WebP, GIF, BMP).');
  const hedefBicim = bicim === 'ayni' ? (['jpeg', 'png', 'webp'].includes(tur) ? tur : 'png') : bicim;
  if (!UZANTI[hedefBicim]) throw new PdfHatasi('Çıktı biçimi jpeg, png ya da webp olmalı.');
  const r = await resimCoz(bayt);
  const w0 = r.genislik, h0 = r.yukseklik;
  let w = w0, h = h0;
  if (yuzde) { w = Math.round((w0 * yuzde) / 100); h = Math.round((h0 * yuzde) / 100); }
  else if (genislik && yukseklik) { w = Math.round(genislik); h = Math.round(yukseklik); }
  else if (genislik) { w = Math.round(genislik); h = Math.round((h0 * genislik) / w0); }
  else if (yukseklik) { h = Math.round(yukseklik); w = Math.round((w0 * yukseklik) / h0); }
  if (!(w >= 1 && h >= 1) || w * h > 80_000_000) throw new PdfHatasi('Çıktı boyutu geçersiz ya da çok büyük (en çok 80 megapiksel).');
  const uyarilar = [];
  if (w > w0 || h > h0) uyarilar.push('Resim büyütüldü; yeni ayrıntı eklenmez, bulanıklık artabilir.');
  let tuval;
  if (w === w0 && h === h0) { tuval = tuvalOlustur(w, h); tuval.getContext('2d').drawImage(r.cizilebilir, 0, 0); }
  else if (w < w0 || h < h0) tuval = kucult(r.cizilebilir, w0, h0, w, h);
  else { tuval = tuvalOlustur(w, h); const g = tuval.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(r.cizilebilir, 0, 0, w, h); }
  if (hedefBicim === 'jpeg') { // JPEG saydamlık bilmez: zemin rengiyle doldur
    const z = tuvalOlustur(w, h); const g = z.getContext('2d'); g.fillStyle = arkaPlan; g.fillRect(0, 0, w, h); g.drawImage(tuval, 0, 0); tuval = z;
  }
  let q = Math.min(1, Math.max(0.05, kalite));
  let cikti = await tuvaliBayta(tuval, hedefBicim, q);
  if (hedefKB && hedefBicim !== 'png') {
    const hedef = hedefKB * 1024;
    let lo = 0.05, hi = q;
    if (cikti.length > hedef) {
      let en = null;
      for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; const c = await tuvaliBayta(tuval, hedefBicim, m); if (c.length <= hedef) { en = c; lo = m; } else hi = m; }
      if (en) cikti = en; else { cikti = await tuvaliBayta(tuval, hedefBicim, 0.05); uyarilar.push(`Hedef boyuta (${hedefKB} KB) bu boyutta ulaşılamadı; en düşük kalite kullanıldı. Resmi küçültmeyi deneyin.`); }
    }
  } else if (hedefKB && hedefBicim === 'png') uyarilar.push('PNG kayıpsızdır; hedef boyut için kalite ayarlanamaz. JPEG ya da WebP seçin ya da resmi küçültün.');
  if (hedefBicim === 'png' && tur === 'jpeg' && bicim !== 'ayni') uyarilar.push('JPEG’den PNG’ye çevrilen resim kayıpsız saklanır ama dosya genellikle büyür.');
  return { ad: dosyaAdiTuret(dosyaAdi, w === w0 && h === h0 ? '' : `-${w}x${h}`, UZANTI[hedefBicim]), bayt: cikti, genislik: w, yukseklik: h, bicim: MIME_TUR[hedefBicim], uyarilar };
}
