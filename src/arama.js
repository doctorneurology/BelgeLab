// Araç arama: yazdıkça tahmin eder. "pdftomd" → "PDF → Markdown".
// Türkçe harf farkı, boşluk, kısaltma ve eksik harf önemsenmez. Saf işlevler (arayüzden bağımsız, test edilebilir).

/** Küçük harfe çevir, Türkçe harfleri sadeleştir, → işaretini "to" yap, harf/rakam dışını at. */
export function sadelestir(s) {
  return String(s ?? '')
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/→/g, 'to')
    .replace(/[ıîï]/g, 'i').replace(/[şś]/g, 's').replace(/[ğ]/g, 'g')
    .replace(/[üû]/g, 'u').replace(/[öô]/g, 'o').replace(/[çć]/g, 'c').replace(/[âá]/g, 'a')
    .replace(/[^a-z0-9]+/g, '');
}

// Araç adı dışında akla gelen yazılışlar (İngilizce ad, kısaltma). Anahtar: araç slug'ı.
const ALIASLAR = {
  birlestir: 'merge|combine|join',
  bol: 'split|divide',
  'sayfa-sil': 'delete|remove|pages',
  'sayfa-sirala': 'reorder|sort|pages|organize',
  'sayfa-dondur': 'rotate',
  'sayfa-cikar': 'extract|pages',
  'yazi-duzelt': 'edit|text|editor|duzenle',
  'taranmis-duzelt': 'scanned|edit|text',
  kirp: 'crop',
  'sayfa-numarasi': 'page|numbers|numbering',
  'ust-alt-bilgi': 'header|footer',
  'filigran-ekle': 'watermark',
  'filigran-geri-al': 'remove watermark|unwatermark',
  'imza-metin': 'sign|signature|textbox',
  'form-doldur': 'fill|form',
  'resimden-pdf': 'jpg to pdf|png to pdf|image to pdf|jpeg to pdf|img2pdf',
  'pdften-resim': 'pdf to jpg|pdf to png|pdf to image|pdf2img',
  ocr: 'scan|text|recognition|taranmis|aranabilir',
  'pdf-word': 'pdf to word|pdf to doc|pdf to docx',
  sikistir: 'compress|reduce|size|kucult',
  karart: 'redact|blackout',
  'sifre-ekle': 'protect|password|encrypt',
  'sifre-kaldir': 'unlock|password|remove|decrypt',
  onar: 'repair|fix|recover',
  'word-pdf': 'word to pdf|doc to pdf|docx to pdf',
  'powerpoint-pdf': 'powerpoint to pdf|ppt to pdf|pptx to pdf',
  'excel-pdf': 'excel to pdf|xls to pdf|xlsx to pdf',
  'html-pdf': 'html to pdf|web to pdf',
  tara: 'scan to pdf|camera|scanner',
  'pdf-powerpoint': 'pdf to powerpoint|pdf to ppt|pdf to pptx',
  'pdf-excel': 'pdf to excel|pdf to xls|pdf to xlsx|tables',
  'pdf-markdown': 'pdf to markdown|pdf to md',
  'pdf-pdfa': 'pdf to pdfa|archive',
  'resim-ayikla': 'extract|images',
  isaretle: 'annotate|highlight|draw|shapes|arrow',
  'form-olustur': 'create|form|fillable',
  karsilastir: 'compare|diff',
  'excel-birlestir': 'merge|excel|combine|xls|xlsx',
  'excel-analiz': 'patient|application|analysis|hasta|basvuru',
};

/** Bir sözcük dizisinde (sadeleşmiş) sorgu harfleri sırayla geçiyor mu? Geçiyorsa kapladığı genişliği verir. */
function altDizi(saman, sorgu) {
  let ilk = -1;
  let son = -1;
  let k = 0;
  for (let i = 0; i < saman.length && k < sorgu.length; i++) {
    if (saman[i] === sorgu[k]) { if (ilk < 0) ilk = i; son = i; k++; }
  }
  return k === sorgu.length ? { ilk, genislik: son - ilk + 1 } : null;
}

/** Tek bir yazılış (sadeleşmiş) için 0–100 arası puan; eşleşme yoksa 0. */
function puanla(saman, sorgu) {
  if (!saman) return 0;
  if (saman === sorgu) return 100;
  const yer = saman.indexOf(sorgu);
  if (yer === 0) return 95;
  if (yer > 0) return 85 - Math.min(yer, 20);
  if (sorgu.length < 3) return 0;
  const a = altDizi(saman, sorgu);
  if (!a) return 0;
  // Harfler sıkı duruyorsa yüksek, dağınıksa eleme: genişlik en fazla 2 kat + 3.
  if (a.genislik > sorgu.length * 2 + 3) return 0;
  return Math.max(10, 70 - (a.genislik - sorgu.length) * 3 - Math.min(a.ilk, 10));
}

/**
 * Araçları sorguya göre sırala. Boş sorguda null döner (hepsi gösterilsin).
 * @returns {Array<{arac, puan}>|null} en iyi eşleşme önce
 */
export function araclariAra(araclar, sorgu) {
  const q = sadelestir(sorgu);
  if (!q) return null;
  const sonuc = [];
  for (const arac of araclar) {
    const yazilislar = [arac.ad, arac.slug, ...(ALIASLAR[arac.slug] ?? '').split('|')].map(sadelestir).filter(Boolean);
    let puan = Math.max(...yazilislar.map((y) => puanla(y, q)));
    // Kısa açıklamada geçiyorsa düşük puanla yine göster.
    if (puan === 0 && q.length >= 3 && sadelestir(arac.kisa).includes(q)) puan = 15;
    if (puan > 0) sonuc.push({ arac, puan });
  }
  return sonuc.sort((x, y) => y.puan - x.puan);
}
