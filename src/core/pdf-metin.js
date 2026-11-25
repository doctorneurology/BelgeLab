// PDF → düz metin (TXT), HTML ve EPUB. Başlık/paragraf/liste/tablo/resim çözümü PDF→Word/Markdown ile ortaktır (pdfYapisi).
// DÜRÜSTLÜK: yapı yazı boyutu ve hizadan TAHMİN edilir; çok sütunlu/tablolu karmaşık sayfalarda sonuç aslına birebir uymaz.
import { pdfYapisi, paragrafParcalari } from './pdf-word.js';
import { zipOlustur } from './zip.js';
import { baslikBul } from './yer-imi.js';
import { dosyaAdiTuret } from './util.js';
import { PdfHatasi } from './hatalar.js';

const kac = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kodla = (s) => new TextEncoder().encode(s);

function parcalariHtml(parcalar) {
  let c = '';
  for (const r of parcalar) {
    const bosOnce = r.metin.match(/^\s*/)[0], bosSonra = r.metin.match(/\s*$/)[0], ic = r.metin.trim();
    if (!ic) { c += r.metin; continue; }
    let m = kac(ic);
    if (r.sabit) m = `<code>${m}</code>`;
    if (r.kalin) m = `<strong>${m}</strong>`;
    if (r.italik) m = `<em>${m}</em>`;
    if (r.url && /^(https?:|mailto:)/i.test(r.url)) m = `<a href="${kac(r.url)}">${m}</a>`;
    c += bosOnce + m + bosSonra;
  }
  return c.replace(/\s+/g, ' ').trim();
}
const duzMetin = (parcalar) => parcalar.map((r) => r.metin).join('').replace(/\s+/g, ' ').trim();

/** Bloklardan { html, txt, resimler } üretir. */
function bloklariCevir(nihai, bilgi, { resimler, resimKlasoru, sayfaAyirac }) {
  const html = [], txt = [], dosyalar = [], bolumler = [];
  let numara = 0, oncekiSayfa = null, liste = null;
  const listeKapat = () => { if (liste) { html.push('</ul>'); liste = null; } };
  for (const b of nihai) {
    if (sayfaAyirac && b.sayfaNo !== oncekiSayfa) { listeKapat(); html.push(`<hr class="sayfa" data-sayfa="${b.sayfaNo}">`); txt.push(`\n----- Sayfa ${b.sayfaNo} -----`); }
    oncekiSayfa = b.sayfaNo;
    if (b.tur === 'p') {
      const par = paragrafParcalari(b.satirlar, { baslik: b.baslik, maddeAt: b.madde }, bilgi);
      const h = parcalariHtml(par), t = duzMetin(par);
      if (!t) continue;
      if (b.baslik) { listeKapat(); const d = Math.max(1, Math.min(6, b.duzey || 1)); html.push(`<h${d}>${h.replace(/<\/?strong>/g, '')}</h${d}>`); txt.push(`${t}`); bolumler.push({ duzey: d, baslik: t, indeks: html.length - 1 }); }
      else if (b.madde) { if (!liste) { html.push('<ul>'); liste = true; } html.push(`<li>${h}</li>`); txt.push(`- ${t}`); }
      else { listeKapat(); html.push(`<p>${h}</p>`); txt.push(t); }
    } else if (b.tur === 'tablo' && b.tablo.satirlar.length) {
      listeKapat();
      const n = b.tablo.kolonSayisi;
      const satir = (r, th) => `<tr>${Array.from({ length: n }, (_, i) => `<${th ? 'th' : 'td'}>${kac(r[i] ?? '')}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
      html.push(`<table>${b.tablo.satirlar.map((r, i) => satir(r, i === 0)).join('')}</table>`);
      txt.push(b.tablo.satirlar.map((r) => Array.from({ length: n }, (_, i) => String(r[i] ?? '').replace(/\s+/g, ' ').trim()).join('\t')).join('\n'));
    } else if (b.tur === 'resim' && resimler !== 'yok') {
      listeKapat(); numara++;
      if (resimler === 'gomulu') {
        let s = ''; for (let i = 0; i < b.png.length; i += 0x8000) s += String.fromCharCode(...b.png.subarray(i, i + 0x8000));
        html.push(`<figure><img alt="Resim ${numara} (sayfa ${b.sayfaNo})" src="data:image/png;base64,${btoa(s)}"></figure>`);
      } else {
        const ad = `resim-${String(numara).padStart(3, '0')}.png`;
        dosyalar.push({ ad: `${resimKlasoru}/${ad}`, bayt: b.png });
        html.push(`<figure><img alt="Resim ${numara} (sayfa ${b.sayfaNo})" src="${resimKlasoru}/${ad}"></figure>`);
      }
    }
  }
  listeKapat();
  return { html, txt, dosyalar, bolumler, resimSayisi: numara };
}

const CSS = 'body{font-family:Georgia,"Times New Roman",serif;line-height:1.55;max-width:46em;margin:2em auto;padding:0 1em;color:#1b1f27}h1,h2,h3,h4{font-family:Arial,Helvetica,sans-serif;line-height:1.25}table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #bbb;padding:.3em .6em;vertical-align:top}th{background:#f0f2f5}figure{margin:1em 0}img{max-width:100%}hr.sayfa{border:0;border-top:1px dashed #bbb;margin:2em 0}';

/**
 * @param secenek.bicim 'txt' | 'html' | 'epub'
 * @param secenek.resimler 'dosya' | 'gomulu' | 'yok'   (txt'te resim yok)
 * @returns {{dosyalar:{ad,bayt}[], uyarilar:string[], bilgi:object}}
 */
export async function pdfdenMetin(bayt, dosyaAdi = 'belge.pdf', {
  bicim = 'html', sayfalar = '', ocr = 'otomatik', dil = 'tur', resimler = 'dosya', ustAltAtla = true, sayfaAyirac = false, ilerleme,
} = {}) {
  if (!['txt', 'html', 'epub'].includes(bicim)) throw new PdfHatasi('Çıktı biçimi txt, html ya da epub olmalı.');
  const resimKipi = bicim === 'txt' ? 'yok' : (bicim === 'epub' && resimler === 'gomulu' ? 'dosya' : resimler);
  const Y = await pdfYapisi(bayt, { sayfalar, ocr, dil, resimler: resimKipi !== 'yok', ustAltAtla, ilerleme });
  const { nihai, bilgi, uyarilar } = Y;
  const taban = dosyaAdiTuret(dosyaAdi, '', 'x').replace(/\.x$/, '');
  const klasor = bicim === 'epub' ? 'images' : `${taban}-resimler`;
  const c = bloklariCevir(nihai, bilgi, { resimler: resimKipi, resimKlasoru: klasor, sayfaAyirac });
  const b = await baslikBul(bayt).catch(() => null);
  const baslik = b?.baslik ?? taban;
  const u = ['PDF’ten yapı tahmin edilerek kuruldu; karmaşık düzenlerde (iç içe tablo, metin kutusu, formül, çok sütunlu sayfa) sonuç aslına birebir uymaz. Çıktıyı gözden geçirin.'];
  if (bilgi.sutunluSayfa) u.push(`${bilgi.sutunluSayfa} sayfada iki sütunlu düzen algılandı; metin önce sol, sonra sağ sütun sırasıyla alındı (yanlış olabilir).`);
  if (bilgi.ocrSayfa) u.push(`${bilgi.ocrSayfa} sayfa taranmış olduğu için OCR ile okundu; okuma hataları olabilir.`);
  if (bilgi.ustAltSilinen) u.push(`${bilgi.ustAltSilinen} satır (sayfa numarası / tekrarlayan üst-alt bilgi) aktarılmadı.`);

  if (bicim === 'txt') {
    return { dosyalar: [{ ad: dosyaAdiTuret(dosyaAdi, '', 'txt'), bayt: kodla(`${c.txt.join('\n\n')}\n`) }], uyarilar: u, bilgi };
  }
  if (bicim === 'html') {
    const doc = `<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${kac(baslik)}</title><style>${CSS}</style></head><body>\n${c.html.join('\n')}\n</body></html>\n`;
    const ana = { ad: dosyaAdiTuret(dosyaAdi, '', 'html'), bayt: kodla(doc) };
    return { dosyalar: [ana, ...c.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt }))], uyarilar: c.dosyalar.length ? [...u, `Resimler “${klasor}” klasöründedir; HTML dosyasıyla aynı yerde tutun (ZIP olarak indirirseniz bağlantılar çalışır).`] : u, bilgi };
  }
  // EPUB: bölümler 1. düzey başlıklara göre; hiç başlık yoksa tek bölüm
  const kesimler = []; let simdiki = { baslik: baslik, govde: [] };
  c.html.forEach((satir, i) => {
    const bolum = c.bolumler.find((x) => x.indeks === i && x.duzey === 1);
    if (bolum && simdiki.govde.length) { kesimler.push(simdiki); simdiki = { baslik: bolum.baslik, govde: [] }; } else if (bolum) simdiki.baslik = bolum.baslik;
    simdiki.govde.push(satir);
  });
  kesimler.push(simdiki);
  const kimlik = `urn:uuid:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const xhtml = (ad, govde) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="tr" xml:lang="tr"><head><meta charset="utf-8"/><title>${kac(ad)}</title><link rel="stylesheet" type="text/css" href="stil.css"/></head><body>\n${govde}\n</body></html>\n`;
  const kapak = (s) => s.replace(/<hr class="sayfa"[^>]*>/g, '<hr/>').replace(/<img([^>]*?)>/g, '<img$1/>').replace(/<br>/g, '<br/>');
  const dosyalar = [{ ad: 'mimetype', bayt: kodla('application/epub+zip') },
    { ad: 'META-INF/container.xml', bayt: kodla('<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
    { ad: 'OEBPS/stil.css', bayt: kodla(CSS) }];
  kesimler.forEach((k, i) => dosyalar.push({ ad: `OEBPS/bolum-${i + 1}.xhtml`, bayt: kodla(xhtml(k.baslik, kapak(k.govde.join('\n')))) }));
  c.dosyalar.forEach((r) => dosyalar.push({ ad: `OEBPS/${r.ad}`, bayt: r.bayt }));
  const nav = `<nav epub:type="toc" id="toc"><h1>İçindekiler</h1><ol>${kesimler.map((k, i) => `<li><a href="bolum-${i + 1}.xhtml">${kac(k.baslik)}</a></li>`).join('')}</ol></nav>`;
  dosyalar.push({ ad: 'OEBPS/nav.xhtml', bayt: kodla(xhtml('İçindekiler', nav)) });
  const opf = `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="kimlik" xml:lang="tr"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="kimlik">${kimlik}</dc:identifier><dc:title>${kac(baslik)}</dc:title><dc:language>tr</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="stil.css" media-type="text/css"/>${kesimler.map((_, i) => `<item id="b${i + 1}" href="bolum-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}${c.dosyalar.map((r, i) => `<item id="r${i + 1}" href="${r.ad}" media-type="image/png"/>`).join('')}</manifest><spine>${kesimler.map((_, i) => `<itemref idref="b${i + 1}"/>`).join('')}</spine></package>\n`;
  dosyalar.push({ ad: 'OEBPS/content.opf', bayt: kodla(opf) });
  return { dosyalar: [{ ad: dosyaAdiTuret(dosyaAdi, '', 'epub'), bayt: zipOlustur(dosyalar) }], uyarilar: u, bilgi };
}
