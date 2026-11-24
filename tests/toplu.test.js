import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { topluIsle } from '../src/core/toplu.js';
import { sikistir } from '../src/core/sikistir.js';
import { bol } from '../src/core/sayfalar.js';
import { pdfOcr, ocrKapat } from '../src/core/ocr.js';
import { pdfdenMarkdown } from '../src/core/pdf-markdown.js';
import { karart } from '../src/core/karart.js';
import { dosyaAdiTuret } from '../src/core/util.js';
import { ornekPdf } from './yardimci/pdf-uret.js';
import { metinCikar } from '../tools/karsilastir.mjs';
import { taramaPdf, TARAMA_SATIRLARI } from './yardimci/tarama.js';

const dosya = (ad, bayt = new Uint8Array([1, 2, 3])) => ({ ad, bayt });
const icerik = (z) => unzipSync(z);

describe('Toplu işleme çekirdeği', () => {
  it('SAYI SINIRI YOK: 1200 dosya sırayla işlenir; hepsi ZIP\'te; sıra ve ilerleme doğru', async () => {
    const dosyalar = Array.from({ length: 1200 }, (_, i) => dosya(`rapor-${i + 1}.pdf`, new Uint8Array([i & 255])));
    const sira = [];
    const r = await topluIsle(dosyalar, async (d, i) => { sira.push(i); return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-kucuk'), bayt: d.bayt }] }; },
      { ilerleme: (i, n) => { expect(n).toBe(1200); } });
    expect(r.basarili).toBe(1200);
    expect(r.hatali).toBe(0);
    expect(sira).toEqual(Array.from({ length: 1200 }, (_, i) => i)); // sıralı
    expect(r.zipler.length).toBe(1);
    const z = icerik(r.zipler[0].bayt);
    expect(Object.keys(z).length).toBe(1200);
    expect(z['rapor-777-kucuk.pdf'][0]).toBe(776 & 255);
  });

  it('hatalı dosya atlanır, diğerleri sürer; neden kaydedilir; şifreli/atlanan dosya bildirilir', async () => {
    const dosyalar = [dosya('a.pdf'), dosya('bozuk.pdf'), dosya('sifreli.pdf'), dosya('b.pdf')];
    const r = await topluIsle(dosyalar, async (d) => {
      if (d.ad === 'bozuk.pdf') throw new Error('Dosya açılamadı');
      return { ciktilar: [{ ad: d.ad, bayt: d.bayt }] };
    }, { atla: (d) => (d.ad === 'sifreli.pdf' ? 'Şifreli' : null) });
    expect(r.basarili).toBe(2);
    expect(r.hatali).toBe(2);
    expect(r.sonuclar.map((s) => [s.ad, s.ok])).toEqual([['a.pdf', true], ['bozuk.pdf', false], ['sifreli.pdf', false], ['b.pdf', true]]);
    expect(r.sonuclar[1].neden).toBe('Dosya açılamadı');
    expect(Object.keys(icerik(r.zipler[0].bayt)).sort()).toEqual(['a.pdf', 'b.pdf']);
  });

  it('aynı adlı çıktılar ayrılır; bir dosyadan birden çok çıktı klasöre girer', async () => {
    const r = await topluIsle([dosya('x.pdf'), dosya('x.pdf'), dosya('klasor/y.pdf'), dosya('x.pdf')], async (d, i) => (
      d.ad === 'klasor/y.pdf' ? { ciktilar: [{ ad: 'sayfa-1.pdf', bayt: d.bayt }, { ad: 'sayfa-2.pdf', bayt: d.bayt }] } : { ciktilar: [{ ad: 'cikti.pdf', bayt: new Uint8Array([i]) }] }));
    expect(Object.keys(icerik(r.zipler[0].bayt)).sort()).toEqual(['cikti (2).pdf', 'cikti (3).pdf', 'cikti.pdf', 'klasor_y/sayfa-1.pdf', 'klasor_y/sayfa-2.pdf']);
  });

  it('ZIP parçalanır: sınır aşılınca yeni parça; hiçbir çıktı kaybolmaz', async () => {
    const dosyalar = Array.from({ length: 30 }, (_, i) => dosya(`d${i}.bin`, new Uint8Array(1000).fill(i)));
    const r = await topluIsle(dosyalar, async (d) => ({ ciktilar: [{ ad: d.ad, bayt: d.bayt }] }), { parcaSiniri: 8000, zipAdi: (n) => `p${n}.zip` });
    expect(r.zipler.map((z) => z.ad)).toEqual(['p1.zip', 'p2.zip', 'p3.zip', 'p4.zip']);
    const hepsi = r.zipler.flatMap((z) => Object.keys(icerik(z.bayt)));
    expect(hepsi.length).toBe(30);
    expect(new Set(hepsi).size).toBe(30);
  });

  it('iptal: kalan dosyalar işlenmez, o ana kadar olanlar verilir; uyarılar dosya sayısıyla birleşir', async () => {
    let islenen = 0;
    const r = await topluIsle(Array.from({ length: 10 }, (_, i) => dosya(`f${i}.pdf`)), async (d) => { islenen++; return { ciktilar: [{ ad: d.ad, bayt: d.bayt }], uyarilar: ['Aynı uyarı', `Özel ${d.ad}`] }; },
      { iptalMi: () => islenen >= 4 });
    expect(r.iptal).toBe(true);
    expect(r.sonuclar.length).toBe(4);
    expect(Object.keys(icerik(r.zipler[0].bayt)).length).toBe(4);
    const ortak = r.uyarilar.find((u) => u.metin === 'Aynı uyarı');
    expect(ortak.dosyalar.length).toBe(4);
    expect(r.uyarilar.length).toBe(5);
  });

  it('boş liste ve çıktı üretmeyen dosyalar sorun çıkarmaz', async () => {
    expect((await topluIsle([], async () => ({}))).zipler).toEqual([]);
    const r = await topluIsle([dosya('a'), dosya('b')], async () => ({ ciktilar: [] }));
    expect(r.zipler).toEqual([]);
    expect(r.basarili).toBe(2);
  });
});

describe('Gerçek araçlarla toplu işleme (her dosya ayrı çıktı)', () => {
  it('toplu PDF → Markdown: 25 farklı PDF, hepsi kendi .md dosyasına dönüşür', async () => {
    const dosyalar = [];
    for (let i = 1; i <= 25; i++) dosyalar.push({ ad: `belge-${i}.pdf`, bayt: await ornekPdf({ sayfa: 2, baslik: `Rapor${i}` }) });
    const r = await topluIsle(dosyalar, async (d) => {
      const m = await pdfdenMarkdown(d.bayt, { resimler: 'yok', ocr: 'yok' });
      return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '', 'md'), bayt: new TextEncoder().encode(m.md) }] };
    });
    expect(r.basarili).toBe(25);
    const z = icerik(r.zipler[0].bayt);
    expect(Object.keys(z).length).toBe(25);
    expect(strFromU8(z['belge-17.md'])).toContain('Rapor17 1 / 2');
    expect(strFromU8(z['belge-3.md'])).not.toContain('Rapor17');
  });

  it('toplu sıkıştır + bozuk dosya karışık: bozuk olan raporlanır, sağlamlar çıkar', async () => {
    const saglam = await ornekPdf({ sayfa: 2 });
    const dosyalar = [{ ad: 'a.pdf', bayt: saglam }, { ad: 'bozuk.pdf', bayt: new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3]) }, { ad: 'c.pdf', bayt: saglam }];
    const r = await topluIsle(dosyalar, async (d) => { const s = await sikistir(d.bayt, { duzey: 'dengeli' }); return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-kucuk'), bayt: s.bayt }] }; });
    expect(r.basarili).toBe(2);
    expect(r.sonuclar[1]).toMatchObject({ ad: 'bozuk.pdf', ok: false });
    expect(Object.keys(icerik(r.zipler[0].bayt)).sort()).toEqual(['a-kucuk.pdf', 'c-kucuk.pdf']);
  });

  it('toplu PDF böl: her dosyanın sayfaları kendi klasörüne girer', async () => {
    const dosyalar = [{ ad: 'bir.pdf', bayt: await ornekPdf({ sayfa: 3 }) }, { ad: 'iki.pdf', bayt: await ornekPdf({ sayfa: 2 }) }];
    const r = await topluIsle(dosyalar, async (d) => { const b = await bol(d.bayt, d.ad, { mod: 'tek' }); return { ciktilar: b.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })) }; });
    const ad = Object.keys(icerik(r.zipler[0].bayt));
    expect(ad.filter((x) => x.startsWith('bir/')).length).toBe(3);
    expect(ad.filter((x) => x.startsWith('iki/')).length).toBe(2);
  });

  it('toplu OCR: 3 taranmış belge okunur, hepsi aranabilir olur', async () => {
    const dosyalar = [];
    for (let i = 0; i < 3; i++) dosyalar.push({ ad: `tarama-${i}.pdf`, bayt: (await taramaPdf([TARAMA_SATIRLARI], { dpi: 200 })).bayt });
    const r = await topluIsle(dosyalar, async (d) => { const o = await pdfOcr(d.bayt, { dpi: 300 }); return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-aranabilir'), bayt: o.bayt }] }; });
    await ocrKapat();
    expect(r.basarili).toBe(3);
    const z = icerik(r.zipler[0].bayt);
    for (const ad of Object.keys(z)) expect((await metinCikar(z[ad]))[0]).toContain('göğüs kafesinin');
  });

  it('toplu KARARTMA güvenliği: aranan metin olmayan dosya "karartılmış" diye VERİLMEZ (bulunamayan dosya atlanır)', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const { yaziTipiGom } = await import('../src/core/fonts.js');
    const yap = async (m) => { const d = await PDFDocument.create(); const f = await yaziTipiGom(d, 'liberation-sans'); d.addPage([595, 842]).drawText(m, { x: 72, y: 700, size: 14, font: f }); return new Uint8Array(await d.save()); };
    const dosyalar = [{ ad: 'var1.pdf', bayt: await yap('Hasta: Ali Veli kontrol') }, { ad: 'yok.pdf', bayt: await yap('Burada aranan isim geçmiyor') }, { ad: 'var2.pdf', bayt: await yap('Ali Veli yine burada') }];
    const r = await topluIsle(dosyalar, async (d) => {
      const k = await karart(d.bayt, { ara: ['ali veli'] });
      if (!k.degisti) throw new Error('Karartılacak bir şey bulunamadı; çıktı verilmedi.');
      return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-karartilmis'), bayt: k.bayt }] };
    });
    expect(r.sonuclar.map((s) => s.ok)).toEqual([true, false, true]);
    const z = icerik(r.zipler[0].bayt);
    expect(Object.keys(z).sort()).toEqual(['var1-karartilmis.pdf', 'var2-karartilmis.pdf']);
    for (const ad of Object.keys(z)) expect((await metinCikar(z[ad])).join(' ')).not.toMatch(/ali veli/i);
  });
});
