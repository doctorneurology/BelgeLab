// Sayfa düzeni: bir sayfaya birden çok sayfa (n-up), kitapçık, tek uzun sayfa, sayfa boyutu/ölçek ve üst üste bindirme.
// Sayfalar yeni belgeye "form nesnesi" olarak gömülür (vektör kalır); bu yüzden bağlantı, form alanı ve yer imi taşınmaz → uyarı.
import { PDFDocument, degrees } from 'pdf-lib';
import { pdfAc, kaydet } from './belge.js';
import { PdfHatasi } from './hatalar.js';

const MM = 72 / 25.4;
export const KAGITLAR = { A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
const kagitPt = (ad) => { const k = KAGITLAR[ad]; if (!k) throw new PdfHatasi('Bilinmeyen kâğıt boyutu.'); return [k[0] * MM, k[1] * MM]; };
const UYARI = 'Sayfalar yeni belgeye gömüldüğü için bağlantılar, form alanları, yer imleri ve açıklamalar taşınmadı; yazı ve çizimler vektör olarak kalır.';

/** Gömülü sayfayı (görünür yönüyle) hedef kutuya yerleştirir. kutu: {x,y,g,y2}; uyum: 'sigdir' | 'doldur' | 'uzat' */
function yerlestir(sayfa, gomulu, donus, kutu, uyum = 'sigdir') {
  const w0 = gomulu.width, h0 = gomulu.height;
  const gg = donus % 180 ? h0 : w0, yy = donus % 180 ? w0 : h0; // görünür boyut
  let sx, sy;
  if (uyum === 'uzat') { sx = kutu.g / gg; sy = kutu.y2 / yy; } else { const o = uyum === 'doldur' ? Math.max(kutu.g / gg, kutu.y2 / yy) : Math.min(kutu.g / gg, kutu.y2 / yy); sx = sy = o; }
  const gw = gg * sx, gh = yy * sy;
  const x0 = kutu.x + (kutu.g - gw) / 2, y0 = kutu.y + (kutu.y2 - gh) / 2;
  const seçenek = { xScale: donus % 180 ? sy : sx, yScale: donus % 180 ? sx : sy };
  if (!donus) sayfa.drawPage(gomulu, { x: x0, y: y0, ...seçenek });
  else if (donus === 90) sayfa.drawPage(gomulu, { x: x0, y: y0 + gh, rotate: degrees(-90), ...seçenek });
  else if (donus === 180) sayfa.drawPage(gomulu, { x: x0 + gw, y: y0 + gh, rotate: degrees(-180), ...seçenek });
  else sayfa.drawPage(gomulu, { x: x0 + gw, y: y0, rotate: degrees(-270), ...seçenek });
}

async function gom(cikti, kaynak) {
  const n = kaynak.getPageCount();
  const gomulu = await cikti.embedPdf(kaynak, Array.from({ length: n }, (_, i) => i));
  const donus = kaynak.getPages().map((p) => ((p.getRotation().angle % 360) + 360) % 360);
  return { gomulu, donus, n };
}

const IZGARA = { 2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 16: [4, 4] };

/** @param secenek { adet:2|4|6|8|9|16, kagit:'A4'|…, yon:'otomatik'|'dikey'|'yatay', bosluk(pt), cerceve:boolean } */
export async function birSayfayaCok(bayt, { adet = 2, kagit = 'A4', yon = 'otomatik', bosluk = 8, cerceve = true } = {}) {
  const [sut, sat] = IZGARA[adet] ?? [];
  if (!sut) throw new PdfHatasi('Sayfa başına adet 2, 4, 6, 8, 9 ya da 16 olabilir.');
  const kaynak = await pdfAc(bayt);
  const cikti = await PDFDocument.create();
  const { gomulu, donus, n } = await gom(cikti, kaynak);
  let [W, H] = kagitPt(kagit);
  const yatay = yon === 'yatay' || (yon === 'otomatik' && sut > sat);
  if (yatay) [W, H] = [H, W]; // yatay: geniş kenar yatay
  for (let i = 0; i < n; i += adet) {
    const p = cikti.addPage([W, H]);
    const hw = (W - bosluk * (sut + 1)) / sut, hh = (H - bosluk * (sat + 1)) / sat;
    for (let k = 0; k < adet && i + k < n; k++) {
      const c = k % sut, r = Math.floor(k / sut);
      const kutu = { x: bosluk + c * (hw + bosluk), y: H - bosluk - (r + 1) * hh - r * bosluk, g: hw, y2: hh };
      yerlestir(p, gomulu[i + k], donus[i + k], kutu);
      if (cerceve) p.drawRectangle({ x: kutu.x, y: kutu.y, width: kutu.g, height: kutu.y2, borderWidth: 0.4, opacity: 0, borderOpacity: 0.35 });
    }
  }
  return { bayt: await kaydet(cikti), sayfaSayisi: Math.ceil(n / adet), uyarilar: [UYARI] };
}

/** Kitapçık (orta zımbalı): kâğıdın iki yüzüne basılıp ortadan katlanacak sıralama. Yatay kâğıt, "kısa kenardan çevir". */
export async function kitapcik(bayt, { kagit = 'A4', bosluk = 6 } = {}) {
  const kaynak = await pdfAc(bayt);
  const cikti = await PDFDocument.create();
  const { gomulu, donus, n } = await gom(cikti, kaynak);
  const toplam = Math.ceil(n / 4) * 4;
  const [kw, kh] = kagitPt(kagit);
  const W = kh, H = kw; // yatay
  const sira = [];
  for (let k = 0; k < toplam / 4; k++) { sira.push([toplam - 1 - 2 * k, 2 * k]); sira.push([2 * k + 1, toplam - 2 - 2 * k]); }
  const hw = (W - bosluk * 3) / 2, hh = H - bosluk * 2;
  for (const [sol, sag] of sira) {
    const p = cikti.addPage([W, H]);
    [sol, sag].forEach((idx, c) => { if (idx < n) yerlestir(p, gomulu[idx], donus[idx], { x: bosluk + c * (hw + bosluk), y: bosluk, g: hw, y2: hh }); });
  }
  return { bayt: await kaydet(cikti), sayfaSayisi: sira.length, bosEklenen: toplam - n, uyarilar: [UYARI, 'Yazdırırken “iki yüze, kısa kenardan çevir” seçin; basılan kâğıtları üst üste koyup ortadan katlayın.'] };
}

/** Tüm sayfaları alt alta tek uzun sayfa yapar (en geniş sayfaya göre ölçeklenir). */
export async function tekUzunSayfa(bayt, { bosluk = 0 } = {}) {
  const kaynak = await pdfAc(bayt);
  const cikti = await PDFDocument.create();
  const { gomulu, donus, n } = await gom(cikti, kaynak);
  const gorunur = gomulu.map((g, i) => (donus[i] % 180 ? [g.height, g.width] : [g.width, g.height]));
  const W = Math.max(...gorunur.map((s) => s[0]));
  const yukseklikler = gorunur.map((s) => (s[1] * W) / s[0]);
  const H = yukseklikler.reduce((t, y) => t + y, 0) + bosluk * (n - 1);
  if (H > 14400) throw new PdfHatasi(`Tek sayfa çok uzun olurdu (${Math.round(H / 72)} inç; PDF sınırı 200 inç ≈ ${Math.floor(14400 / (H / n))} sayfa). Önce belgeyi bölün.`);
  const p = cikti.addPage([W, H]);
  let y = H;
  gomulu.forEach((g, i) => { y -= yukseklikler[i]; yerlestir(p, g, donus[i], { x: 0, y, g: W, y2: yukseklikler[i] }); y -= bosluk; });
  return { bayt: await kaydet(cikti), uyarilar: [UYARI] };
}

/**
 * Her sayfayı yeni boyutlu sayfaya yerleştirir.
 * @param secenek { boyut:'A4'|…|'yuzde'|'ozel', yuzde, genislikMM, yukseklikMM, yon:'ilk'|'dikey'|'yatay'|'kendi', uyum:'sigdir'|'doldur'|'uzat' }
 */
export async function sayfaBoyutuDegistir(bayt, { boyut = 'A4', yuzde = 100, genislikMM, yukseklikMM, yon = 'kendi', uyum = 'sigdir' } = {}) {
  const kaynak = await pdfAc(bayt);
  const cikti = await PDFDocument.create();
  const { gomulu, donus, n } = await gom(cikti, kaynak);
  let sabit = null;
  if (boyut === 'ozel') { if (!(genislikMM >= 20 && yukseklikMM >= 20)) throw new PdfHatasi('Özel boyut en az 20×20 mm olmalı.'); sabit = [genislikMM * MM, yukseklikMM * MM]; }
  else if (boyut !== 'yuzde') sabit = kagitPt(boyut);
  else if (!(yuzde >= 10 && yuzde <= 1000)) throw new PdfHatasi('Ölçek %10 ile %1000 arasında olmalı.');
  for (let i = 0; i < n; i++) {
    const g = gomulu[i];
    const [gw, gh] = donus[i] % 180 ? [g.height, g.width] : [g.width, g.height];
    let W, H;
    if (!sabit) { W = (gw * yuzde) / 100; H = (gh * yuzde) / 100; } else { [W, H] = sabit; }
    const yatayIstenen = yon === 'yatay' || (yon === 'kendi' && gw > gh);
    if (sabit && ((yatayIstenen && H > W) || ((yon === 'dikey' || (yon === 'kendi' && gw <= gh)) && W > H))) [W, H] = [H, W];
    const p = cikti.addPage([W, H]);
    yerlestir(p, g, donus[i], { x: 0, y: 0, g: W, y2: H }, sabit ? uyum : 'uzat');
  }
  return { bayt: await kaydet(cikti), sayfaSayisi: n, uyarilar: [UYARI] };
}

/**
 * Üst üste bindirme: `ust` PDF'in sayfaları `ana` PDF'in sayfalarının üstüne (ya da arkasına) konur.
 * @param secenek { arkada:boolean, tekrar:'son'|'dongu'|'yok', opaklik:0-1, ustSayfalar: '1' bölünür }
 */
export async function ustUsteBindir(anaBayt, ustBayt, { arkada = false, tekrar = 'dongu', opaklik = 1 } = {}) {
  const ana = await pdfAc(anaBayt), ust = await pdfAc(ustBayt);
  const cikti = await PDFDocument.create();
  const { gomulu: ag, donus: ad, n } = await gom(cikti, ana);
  const { gomulu: ug, donus: ud, n: m } = await gom(cikti, ust);
  for (let i = 0; i < n; i++) {
    const [gw, gh] = ad[i] % 180 ? [ag[i].height, ag[i].width] : [ag[i].width, ag[i].height];
    const p = cikti.addPage([gw, gh]);
    const kutu = { x: 0, y: 0, g: gw, y2: gh };
    let u = i < m ? i : (tekrar === 'dongu' ? i % m : tekrar === 'son' ? m - 1 : -1);
    const ustCiz = () => { if (u >= 0) { yerlestirOpak(p, ug[u], ud[u], kutu, opaklik); } };
    if (arkada) { ustCiz(); yerlestir(p, ag[i], ad[i], kutu); } else { yerlestir(p, ag[i], ad[i], kutu); ustCiz(); }
  }
  return { bayt: await kaydet(cikti), sayfaSayisi: n, uyarilar: [UYARI, m < n ? `Üst PDF ${m} sayfa; ${n - m} sayfa için ${tekrar === 'dongu' ? 'baştan tekrarlandı' : tekrar === 'son' ? 'son sayfa kullanıldı' : 'bindirme yapılmadı'}.` : ''].filter(Boolean) };
}
function yerlestirOpak(sayfa, g, donus, kutu, opaklik) {
  if (opaklik >= 1) { yerlestir(sayfa, g, donus, kutu, 'uzat'); return; }
  const [w, h] = donus % 180 ? [g.height, g.width] : [g.width, g.height];
  const sx = kutu.g / w, sy = kutu.y2 / h;
  const o = { x: kutu.x, y: kutu.y, xScale: sx, yScale: sy, opacity: opaklik };
  if (!donus) sayfa.drawPage(g, o);
  else yerlestir(sayfa, g, donus, kutu, 'uzat'); // döndürülmüş sayfada saydamlık desteklenmez (tam opak)
}
