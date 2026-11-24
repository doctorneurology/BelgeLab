// PDF → Markdown. Başlıklar (yazı boyutundan), paragraflar, kalın/italik, madde işaretleri, numaralı liste, bağlantılar,
// basit tablolar (GFM) ve resimler aktarılır. Taranmış sayfalarda OCR kullanılır.
// SAYFA ya da DOSYA SINIRI YOKTUR; sayfalar tek tek işlenir, ilerleme bildirilir.
//
// DÜRÜSTLÜK: PDF'ten yapı tahmin edilir (sütun, tablo, başlık); karmaşık düzenlerde sonuç aslına birebir uymaz.
// Her tahmin sonuç uyarılarında bildirilir (bkz. pdf-word.js ile aynı çözümleyici).

import { pdfYapisi, paragrafParcalari } from './pdf-word.js';

const KACIS = /([\\`*_[\]<>])/g;

/** Markdown özel karakterlerini kaçırır; satır başındaki liste/başlık işaretlerini etkisizleştirir. */
export function mdKacis(metin, { satirBasi = false } = {}) {
  let m = metin.replace(KACIS, '\\$1');
  if (satirBasi) m = m.replace(/^(#{1,6})(\s)/, '\\$1$2').replace(/^([-+])(\s)/, '\\$1$2').replace(/^(>)/, '\\$1');
  return m;
}

function parcalariMd(parcalar, { satirBasi = true } = {}) {
  let cikti = '';
  parcalar.forEach((r, i) => {
    const bosOnce = r.metin.match(/^\s*/)[0], bosSonra = r.metin.match(/\s*$/)[0];
    const ic = r.metin.trim();
    if (!ic) { cikti += r.metin; return; }
    let m = r.sabit ? `\`${ic.replace(/`/g, '\\`')}\`` : mdKacis(ic, { satirBasi: satirBasi && i === 0 && !bosOnce });
    if (!r.sabit) {
      if (r.kalin && r.italik) m = `***${m}***`;
      else if (r.kalin) m = `**${m}**`;
      else if (r.italik) m = `*${m}*`;
    }
    if (r.url) m = `[${m}](${r.url.replace(/\)/g, '%29').replace(/ /g, '%20')})`;
    cikti += `${bosOnce}${m}${bosSonra}`;
  });
  return cikti.replace(/\s+/g, ' ').trim();
}

const hucre = (m) => mdKacis(String(m ?? '')).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function tabloMd(t) {
  const satirlar = t.satirlar;
  const n = t.kolonSayisi;
  const satir = (h) => `| ${Array.from({ length: n }, (_, i) => hucre(h[i])).join(' | ')} |`;
  return [satir(satirlar[0]), `| ${Array(n).fill('---').join(' | ')} |`, ...satirlar.slice(1).map(satir)].join('\n');
}

/**
 * @param secenek.sayfalar    "1-5,8" (boş = TÜM sayfalar, sınır yok)
 * @param secenek.ocr         'otomatik' | 'yok'
 * @param secenek.resimler    'dosya' (ayrı PNG dosyaları) | 'gomulu' (base64, tek dosya) | 'yok'
 * @param secenek.sayfaAyirac true → her sayfanın başına "<!-- Sayfa N -->" ve yatay çizgi
 * @param secenek.resimKlasoru md içindeki resim yolu öneki (varsayılan "resimler")
 * @returns {{md:string, resimler:{ad:string,bayt:Uint8Array}[], uyarilar:string[], bilgi:object}}
 */
export async function pdfdenMarkdown(bayt, {
  sayfalar = '', ocr = 'otomatik', resimler = 'dosya', ustAltAtla = true, sayfaAyirac = false, resimKlasoru = 'resimler',
  ocrDpi = 250, dil = 'tur', ilerleme,
} = {}) {
  const Y = await pdfYapisi(bayt, { sayfalar, ocr, resimler: resimler !== 'yok', ustAltAtla, ocrDpi, dil, ilerleme });
  const { nihai, bilgi, uyarilar } = Y;
  const resimDosyalari = [];
  const parcalar = [];
  const maddeler = new Set(); // liste öğeleri bitişik (boş satırsız) yazılır
  let oncekiSayfa = null;
  let numara = 0;

  for (const b of nihai) {
    if (sayfaAyirac && b.sayfaNo !== oncekiSayfa) {
      parcalar.push(`<!-- Sayfa ${b.sayfaNo} -->${oncekiSayfa !== null ? '\n\n---' : ''}`);
    }
    oncekiSayfa = b.sayfaNo;
    if (b.tur === 'p') {
      const par = paragrafParcalari(b.satirlar, { baslik: b.baslik, maddeAt: b.madde }, bilgi);
      let metin = parcalariMd(par, { satirBasi: true });
      if (!metin) continue;
      bilgi.paragraf = (bilgi.paragraf ?? 0) + 1;
      if (b.baslik) {
        bilgi.baslik = (bilgi.baslik ?? 0) + 1;
        parcalar.push(`${'#'.repeat(Math.max(1, Math.min(6, b.duzey || 1)))} ${metin.replace(/^(\*\*|\*)+|(\*\*|\*)+$/g, '')}`);
      } else if (b.madde) {
        bilgi.madde = (bilgi.madde ?? 0) + 1;
        maddeler.add(parcalar.length);
        parcalar.push(`- ${metin}`);
      } else if (/^\d{1,3}[.)]\s/.test(b.satirlar[0].metin)) {
        // numaralı liste: işareti kaçırmadan bırak
        const duz = parcalariMd(par, { satirBasi: false }).replace(/^(\d{1,3})\\?[.)]\s*/, '$1. ');
        parcalar.push(duz);
      } else {
        parcalar.push(metin);
      }
    } else if (b.tur === 'tablo') {
      if (b.tablo.satirlar.length) parcalar.push(tabloMd(b.tablo));
    } else if (b.tur === 'resim' && resimler !== 'yok') {
      numara++;
      if (resimler === 'gomulu') {
        let b64;
        if (typeof Buffer !== 'undefined') b64 = Buffer.from(b.png).toString('base64');
        else { let s = ''; for (let i = 0; i < b.png.length; i += 0x8000) s += String.fromCharCode(...b.png.subarray(i, i + 0x8000)); b64 = btoa(s); }
        parcalar.push(`![Resim ${numara} (sayfa ${b.sayfaNo})](data:image/png;base64,${b64})`);
      } else {
        const ad = `resim-${String(numara).padStart(3, '0')}.png`;
        resimDosyalari.push({ ad: `${resimKlasoru}/${ad}`, bayt: b.png });
        parcalar.push(`![Resim ${numara} (sayfa ${b.sayfaNo})](${resimKlasoru}/${ad})`);
      }
    }
  }

  let md = '';
  parcalar.forEach((p, i) => { md += i === 0 ? p : (maddeler.has(i) && maddeler.has(i - 1) ? `\n${p}` : `\n\n${p}`); });
  md += '\n';
  bilgi.resim = numara;
  const u = [
    'PDF’ten Markdown yapısı tahmin edilerek kuruldu; karmaşık düzenlerde (iç içe tablo, metin kutusu, formül, çok sütunlu sayfa) sonuç aslına birebir uymaz. Çıktıyı gözden geçirin.',
    ...uyarilar.filter(() => false),
  ];
  if (bilgi.sutunluSayfa) u.push(`${bilgi.sutunluSayfa} sayfada iki sütunlu düzen algılandı; metin önce sol, sonra sağ sütun olarak sıralandı (yanlış olabilir).`);
  if (bilgi.tablo) u.push(`${bilgi.tablo} tablo, yazıların hizasından tahmin edildi (ilk satır başlık yapıldı; birleştirilmiş hücreler desteklenmez).`);
  if (bilgi.ocrSayfa) u.push(`${bilgi.ocrSayfa} sayfa taranmış olduğu için OCR ile okundu; okuma hataları olabilir, kalın/italik ve resimler aktarılmaz.`);
  if (bilgi.tireBirlestirilen) u.push(`Satır sonunda tireyle bölünmüş ${bilgi.tireBirlestirilen} kelime birleştirildi.`);
  if (bilgi.ustAltSilinen) u.push(`${bilgi.ustAltSilinen} satır (sayfa numarası / tekrarlayan üst-alt bilgi) aktarılmadı.`);
  if (Y.dondurulmus) u.push(`${Y.dondurulmus} döndürülmüş yazı parçası atlandı.`);
  if (Y.atlananResim) u.push(`${Y.atlananResim} resim aktarılamadı ya da atlandı (çok küçük, sayfa boyunda arka plan veya desteklenmeyen tür).`);
  return { md, resimler: resimDosyalari, uyarilar: u, bilgi };
}
