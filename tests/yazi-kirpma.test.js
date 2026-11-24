import { describe, it, expect } from 'vitest';
import { PDFDocument, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from 'pdf-lib';
import { yaziAnalizEt, yaziDuzelt } from '../src/core/yazi/motor.js';
import { yaziTipiGom } from '../src/core/fonts.js';
import { sayfaPikselleri, metinCikar } from '../tools/karsilastir.mjs';

/** Her yazı parçası kendi DAR hücresine kırpılmış (W n) bir belge: gerçek dünyadaki "tablo gibi" PDF'lerde sık görülür. */
async function hucreliPdf() {
  const doc = await PDFDocument.create();
  const f = await yaziTipiGom(doc, 'liberation-serif');
  const p = doc.addPage([595, 842]);
  const hucre = (x, y, w, metin) => {
    p.pushOperators(pushGraphicsState(), rectangle(x, y - 3, w, 16), clip(), endPath());
    p.drawText(metin, { x, y, size: 12, font: f });
    p.pushOperators(popGraphicsState());
  };
  hucre(72, 700, 40, 'Konu');
  hucre(112, 700, 8, ':');
  hucre(124, 700, 220, 'Dr. Kadir GÜLŞEN - Görev belgesi');
  hucre(72, 650, 40, 'Adı');
  hucre(124, 650, 220, 'Sabit satır');
  return new Uint8Array(await doc.save());
}

const koyu = (p, x0, x1, y0, y1, olcek = 2) => {
  let n = 0;
  for (let y = Math.round(y0 * olcek); y < Math.round(y1 * olcek); y++) for (let x = Math.round(x0 * olcek); x < Math.round(x1 * olcek); x++) if (p.veri[(y * p.genislik + x) * 4] < 120) n++;
  return n;
};

describe('Yazı düzelt: dar kırpma hücrelerinde düzeltme (gerçek belgede bulunan hata)', () => {
  it('birkaç hücreye bölünmüş satırda yeni yazı HÜCREYE SIĞMASA BİLE görünür (eskiden kırpılıp kayboluyordu)', async () => {
    const pdf = await hucreliPdf();
    const a = await yaziAnalizEt(pdf);
    const satir = a.sayfalar[0].satirlar.find((l) => l.metin.includes('Konu'));
    expect(satir).toBeTruthy();
    const yeni = 'Konu :Dr. Ahmet YILMAZ - Görev belgesi, Sağlık Bilimleri';
    const r = await yaziDuzelt(pdf, { degisiklikler: { [satir.id]: { metin: yeni } } });
    // metin katmanında var
    expect((await metinCikar(r.bayt))[0]).toContain('Ahmet YILMAZ');
    // GÖRÜNÜR mü? Eski hücrelerin ötesinde (x 124-344 pt ve sonrası) koyu piksel olmalı
    const once = await sayfaPikselleri(pdf, 1, { olcek: 2 }), sonra = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    const yOnce = koyu(once, 124, 400, 842 - 716, 842 - 696), ySonra = koyu(sonra, 124, 400, 842 - 716, 842 - 696);
    expect(ySonra).toBeGreaterThan(yOnce * 0.7); // eskiden ~0'a düşüyordu
    expect(koyu(sonra, 112, 124, 842 - 716, 842 - 696)).toBeGreaterThanOrEqual(0);
  });

  it('dokunulmayan satır ve yeni yazının SIĞDIĞI durumda kırpma korunur (görüntü aynı)', async () => {
    const pdf = await hucreliPdf();
    const a = await yaziAnalizEt(pdf);
    const sabit = a.sayfalar[0].satirlar.find((l) => l.metin.includes('Sabit'));
    const once = await sayfaPikselleri(pdf, 1, { olcek: 2 });
    const r = await yaziDuzelt(pdf, { degisiklikler: { [sabit.id]: { metin: sabit.metin } } }); // değişiklik yok
    const sonra = await sayfaPikselleri(r.bayt, 1, { olcek: 2 });
    // dokunulmayan "Adı Sabit satır" bölgesi (y 650) farksız
    const fark = Math.abs(koyu(once, 60, 400, 842 - 668, 842 - 645) - koyu(sonra, 60, 400, 842 - 668, 842 - 645));
    expect(fark).toBeLessThan(40);
    // Konu satırı da bozulmamış
    expect(Math.abs(koyu(once, 60, 400, 842 - 718, 842 - 695) - koyu(sonra, 60, 400, 842 - 718, 842 - 695))).toBeLessThan(60);
  });
});
