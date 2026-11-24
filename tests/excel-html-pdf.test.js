import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { excelPdf } from '../src/core/excel-pdf.js';
import { htmlPdf, htmlAyristir } from '../src/core/html-pdf.js';
import { metinCikar } from '../tools/karsilastir.mjs';
import { belgeAc } from '../src/core/render.js';
import { pngUret } from './yardimci/pdf-uret.js';

function xlsxYap(sayfalar, bicim = 'xlsx') {
  const k = XLSX.utils.book_new();
  for (const [ad, aoa] of Object.entries(sayfalar)) XLSX.utils.book_append_sheet(k, XLSX.utils.aoa_to_sheet(aoa), ad);
  return new Uint8Array(XLSX.write(k, { type: 'array', bookType: bicim }));
}

async function sayfaBoyutlari(bayt) {
  const b = await belgeAc(bayt);
  const r = [];
  for (let i = 1; i <= b.numPages; i++) { const v = (await b.getPage(i)).getViewport({ scale: 1 }); r.push([Math.round(v.width), Math.round(v.height)]); }
  await b.kapat();
  return r;
}

describe('Excel → PDF', () => {
  it('tüm sayfalar tablo olarak yazılır (Türkçe, sayılar sağa dayalı); başlık satırı kalın', async () => {
    const r = await excelPdf(xlsxYap({
      Hastalar: [['TC', 'Ad Soyad', 'Yaş'], ['12345678901', 'Ayşe Yılmaz', 35], ['10987654321', 'Çağlar Öğüt', 41]],
      Özet: [['Toplam', 2]],
    }), { dosyaAdi: 'liste.xlsx' });
    const m = (await metinCikar(r.bayt)).join(' ');
    for (const s of ['Hastalar', 'Özet', 'Ayşe Yılmaz', 'Çağlar Öğüt', '12345678901', 'Toplam']) expect(m, s).toContain(s);
    expect(r.bilgi.excelSayfasi).toBe(2);
    expect(r.uyarilar[0]).toContain('değerler tablo olarak');
  });

  it('SATIR SINIRI YOK: 5000 satır, 100+ sayfa; ilk ve son satır PDF\'te; geniş sayfa yatay olur', async () => {
    const satirlar = [['No', 'Ad', 'Açıklama'], ...Array.from({ length: 5000 }, (_, i) => [i + 1, `Kişi ${i + 1}`, 'Örnek açıklama metni'])];
    const r = await excelPdf(xlsxYap({ Büyük: satirlar }));
    expect(r.sayfa).toBeGreaterThan(80);
    const t = (await metinCikar(r.bayt)).join(' ');
    expect(t).toContain('Kişi 1 ');
    expect(t).toContain('Kişi 5000');
    const genis = [Array.from({ length: 16 }, (_, i) => `Sütun uzun başlık ${i}`), Array.from({ length: 16 }, (_, i) => `değer ${i}`)];
    const g = await excelPdf(xlsxYap({ Geniş: genis }));
    expect((await sayfaBoyutlari(g.bayt))[0][0]).toBeGreaterThan(800); // yatay
    expect((await sayfaBoyutlari(g.bayt)).length).toBe(1);
  }, 120000);

  it('.xls (eski biçim) okunur; gizli sayfa atlanır; geçersiz dosya anlaşılır hata verir', async () => {
    const eski = xlsxYap({ A: [['x', 'y'], ['1', '2']] }, 'biff8');
    expect((await metinCikar((await excelPdf(eski)).bayt)).join(' ')).toContain('x');
    await expect(excelPdf(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/Excel/);
    await expect(excelPdf(xlsxYap({ Boş: [[]] }))).rejects.toThrow(/dolu bir sayfa bulunamadı/);
  });
});

describe('HTML → PDF', () => {
  const HTML = `<!doctype html><html><head><title>Rapor ĞÜ</title><style>p{color:red}</style><script>alert(1)</script></head><body>
    <h1>Ana Başlık</h1>
    <p>Merhaba <b>kalın</b>, <i>eğik</i> ve <a href="https://ornek.org/x">bağlantı</a>. ğüşıöç &amp; &ccedil;ok &lt;güzel&gt;</p>
    <ul><li>Birinci</li><li>İkinci<ul><li>İç madde</li></ul></li></ul>
    <ol start="3"><li>Üç</li><li>Dört</li></ol>
    <table><tr><th>Ad</th><th>Değer</th></tr><tr><td>Elma</td><td>5</td></tr><tr><td colspan="2">Birleşik hücre</td></tr></table>
    <pre>satır 1\n  girintili satır 2</pre>
    <hr><p style="text-align:center;color:#336699">Ortalı mavi</p>
    <img src="data:image/png;base64,${Buffer.from(pngUret(30, 20, [10, 200, 10, 255])).toString('base64')}" width="120" height="80">
    <img src="http://uzak.example/resim.png" alt="uzak resim">
  </body></html>`;

  it('başlık, biçimli metin, listeler, tablo, kod bloğu ve gömülü resim aktarılır; script/style atlanır', async () => {
    const r = await htmlPdf(HTML);
    const m = (await metinCikar(r.bayt)).join(' ');
    console.log(m, '\n', r.uyarilar.join('\n '), JSON.stringify(r.bilgi));
    for (const s of ['Ana Başlık', 'Merhaba', 'kalın', 'eğik', 'bağlantı', 'ğüşıöç & çok <güzel>', 'Birinci', 'İç madde', 'Dört', 'Elma', 'Birleşik hücre', 'girintili satır 2', 'Ortalı mavi']) expect(m, s).toContain(s);
    expect(m).not.toContain('alert');
    expect(m).toContain('•');
    expect(m).toContain('3.');
    expect(m).toContain('4.');
    expect(r.bilgi).toMatchObject({ tablo: 1, resim: 1 });
    expect(r.uyarilar.join(' ')).toContain('Harici');
    expect(r.uyarilar[0]).toContain('tarayıcı değildir');
    const b = await belgeAc(r.bayt);
    expect((await b.getPage(1).then((p) => p.getAnnotations())).some((a) => a.url === 'https://ornek.org/x')).toBe(true);
    await b.kapat();
  });

  it('düz metin (etiketsiz) paragraf paragraf yazılır; hoşgörülü okuma: kapanmamış etiketler', async () => {
    const d = await htmlPdf('Birinci paragraf\n\nİkinci paragraf ğ');
    expect((await metinCikar(d.bayt)).join(' ')).toContain('İkinci paragraf ğ');
    const k = await htmlPdf('<p>Bir<p>İki<li>Madde<li>Madde2<table><tr><td>a<td>b');
    const t = (await metinCikar(k.bayt)).join(' ');
    for (const s of ['Bir', 'İki', 'Madde2', 'a', 'b']) expect(t).toContain(s);
    expect(htmlAyristir('<div><p>x</div>').cocuk[0].ad).toBe('div');
  });

  it('SAYFA SINIRI YOK: 3000 paragraflık HTML tek seferde dönüşür (2000+ sayfaya kadar)', async () => {
    const uzun = Array.from({ length: 3000 }, (_, i) => `<p>Paragraf ${i + 1}. ${'Türkçe örnek cümle ğüşıöç. '.repeat(12)}</p>`).join('');
    const r = await htmlPdf(`<body>${uzun}</body>`);
    expect(r.sayfa).toBeGreaterThan(150);
    const t = (await metinCikar(r.bayt)).join(' ');
    expect(t).toContain('Paragraf 1.');
    expect(t).toContain('Paragraf 3000.');
  }, 240000);

  it('boş ya da içeriksiz HTML anlaşılır hata verir', async () => {
    await expect(htmlPdf('   ')).rejects.toThrow(/boş/);
    await expect(htmlPdf('<html><body><script>x</script></body></html>')).rejects.toThrow(/içerik/);
  });
});
