// PDF → PowerPoint (.pptx). Her PDF sayfası bir slayt olur.
//  - 'duzenlenebilir': slaytın arka planı sayfanın YAZISIZ görüntüsüdür (logo, çizgi, resim kalır); yazılar konumlarına
//    gerçek PowerPoint metin kutuları olarak konur (renk/boyut/kalın/italik korunur).
//  - 'resim': her sayfa tek resim (düzenlenemez, görünüm birebir).
// DÜRÜSTLÜK: Yazı tipleri ölçü uyumlu karşılıklara (Arial/Times New Roman/Courier New/Calibri/Cambria) eşlenir; PowerPoint'te
// satır kaymaları ve yazı tipi farkları olabilir. Taranmış sayfalar yalnızca resim olarak eklenir. SAYFA/DOSYA SINIRI YOKTUR.

import PptxGenJS from 'pptxgenjs';
import { belgeAc, sayfaCiz, tuvaliBayta } from './render.js';
import { yaziAnalizEt, yazilariKaldir } from './yazi/motor.js';
import { sayfaSecimi } from './util.js';
import { PdfHatasi } from './hatalar.js';

const FONT = {
  'liberation-sans': 'Arial', 'liberation-serif': 'Times New Roman', 'liberation-mono': 'Courier New',
  carlito: 'Calibri', caladea: 'Cambria', 'noto-sans': 'Arial', 'noto-serif': 'Times New Roman',
};

function base64(bayt) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bayt).toString('base64');
  let s = '';
  for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode(...bayt.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * @param secenek.mod   'duzenlenebilir' | 'resim'
 * @param secenek.dpi   arka plan çözünürlüğü (varsayılan 120)
 */
export async function pdfdenPowerPoint(bayt, { sayfalar = '', mod = 'duzenlenebilir', dpi = 120, ilerleme } = {}) {
  if (!['duzenlenebilir', 'resim'].includes(mod)) throw new PdfHatasi('Kip “duzenlenebilir” ya da “resim” olmalı.');
  const uyarilar = [];
  const belge = await belgeAc(bayt);
  let ozet = null, yaziSizBelge = null;
  try {
    const secili = sayfaSecimi(sayfalar, belge.numPages);
    if (mod === 'duzenlenebilir') {
      try {
        ozet = await yaziAnalizEt(bayt, { sayfalar: secili });
        if (ozet.yaziVar) yaziSizBelge = await belgeAc(await yazilariKaldir(bayt, { sayfalar: secili }));
      } catch (e) {
        uyarilar.push(`Yazılar çözümlenemedi (${e?.message ?? e}); slaytlar resim olarak eklendi.`);
        ozet = null;
      }
    }
    const pptx = new PptxGenJS();
    pptx.author = 'BelgeLab (açık kaynak)';
    pptx.title = 'PDF’ten dönüştürüldü';
    const ilk = await belge.getPage(secili[0] + 1);
    const vp0 = ilk.getViewport({ scale: 1 });
    ilk.cleanup();
    const W = vp0.width / 72, H = vp0.height / 72;
    pptx.defineLayout({ name: 'PDF', width: W, height: H });
    pptx.layout = 'PDF';

    let metinKutusu = 0, resimSlayt = 0, farkliBoyut = 0;
    for (let k = 0; k < secili.length; k++) {
      const no = secili[k] + 1;
      ilerleme?.(k, secili.length, `Sayfa ${no} işleniyor…`);
      const sayfaOzet = ozet?.sayfalar.find((s) => s.no === no);
      const yaziliSayfa = !!sayfaOzet?.satirlar.some((l) => l.metin?.trim());
      const kaynakBelge = mod === 'duzenlenebilir' && yaziliSayfa && yaziSizBelge ? yaziSizBelge : belge;
      const { tuval, genislik, yukseklik } = await sayfaCiz(kaynakBelge, no, { olcek: dpi / 72 });
      const sayfaPt = { w: genislik / (dpi / 72), h: yukseklik / (dpi / 72) };
      const png = await tuvaliBayta(tuval, 'png');
      const olcek = Math.min((W * 72) / sayfaPt.w, (H * 72) / sayfaPt.h);
      if (Math.abs(olcek - 1) > 0.01) farkliBoyut++;
      const ox = (W - (sayfaPt.w * olcek) / 72) / 2, oy = (H - (sayfaPt.h * olcek) / 72) / 2;
      const slayt = pptx.addSlide();
      slayt.addImage({ data: `image/png;base64,${base64(png)}`, x: ox, y: oy, w: (sayfaPt.w * olcek) / 72, h: (sayfaPt.h * olcek) / 72 });
      if (kaynakBelge === yaziSizBelge) {
        for (const l of sayfaOzet.satirlar) {
          const metin = String(l.metin ?? '').trim();
          if (!metin) continue;
          const f = ozet.yaziTipleri.find((x) => x.anahtar === l.yaziTipi)?.secili ?? {};
          const x = ox + (l.kutu.x0 * olcek) / 72, y = oy + ((sayfaPt.h - l.kutu.y1) * olcek) / 72;
          const w = ((l.kutu.x1 - l.kutu.x0) * olcek + 6) / 72, h = ((l.kutu.y1 - l.kutu.y0) * olcek) / 72;
          slayt.addText(metin, {
            x, y, w, h, margin: 0, valign: 'middle', align: l.hizalama === 'orta' ? 'center' : l.hizalama === 'sag' ? 'right' : 'left',
            fontFace: FONT[f.aile] ?? 'Arial', fontSize: Math.max(4, Math.round(l.boyut * olcek * 10) / 10), bold: !!f.kalin, italic: !!f.italik,
            color: String(l.renk ?? '#000000').replace('#', ''), wrap: false, fit: 'none',
          });
          metinKutusu++;
        }
      } else resimSlayt++;
    }
    const cikti = new Uint8Array(await pptx.write({ outputType: 'uint8array' }));
    uyarilar.unshift('PDF ile PowerPoint farklı çalışır; yazı tipleri benzer olanlarla değiştirildiği için satır genişlikleri/kaymaları olabilir. Slaytları PowerPoint’te kontrol edin.');
    if (mod === 'duzenlenebilir' && resimSlayt) uyarilar.push(`${resimSlayt} sayfada düzenlenebilir yazı bulunamadı (taranmış ya da yazı çözülemedi); bu slaytlar yalnızca resimdir. Taranmış sayfalar için önce OCR yapabilirsiniz.`);
    if (mod === 'resim') uyarilar.push('Her slayt tek bir resimdir; yazılar düzenlenemez.');
    if (farkliBoyut) uyarilar.push(`${farkliBoyut} sayfanın boyutu ilk sayfadan farklıydı; slayt boyutuna sığdırılıp ortalandı.`);
    return { bayt: cikti, uyarilar, bilgi: { slayt: secili.length, metinKutusu, resimSlayt } };
  } finally {
    await belge.kapat();
    await yaziSizBelge?.kapat?.();
  }
}
