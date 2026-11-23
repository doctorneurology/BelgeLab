// Örnek PDF testi: bir klasördeki gerçek PDF'lerle tüm araçları dener, sayfaları çizip karşılaştırır.
//
//   npm run ornek-test                       → Masaüstündeki "ornekler" klasörü (varsayılan)
//   npm run ornek-test -- "D:\baska\klasor"  → başka klasör
//   npm run ornek-test -- dosya.pdf          → tek dosya
//   ORNEK_SAYFA=8 npm run ornek-test         → her dosyadan ilk 8 sayfayla çalış (varsayılan 5)
//
// Çıktılar "ciktilar/ornek-test/" klasörüne yazılır (git dışındadır; kişisel belgeler depoya GİRMEZ).
// Rapor: ciktilar/ornek-test/rapor.md ve rapor.json. Bir kontrol KALDIYSA çıkış kodu 1 olur.

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { karsilastir, sayfaPikselleri, pngKaydet, doluluk } from './karsilastir.mjs';
import { belgeAc } from '../src/core/render.js';
import { SifreliPdfHatasi } from '../src/core/hatalar.js';
import { pdfAc, belgeOzellikleri } from '../src/core/belge.js';
import { birlestir, bol, sayfaCikar, sayfaDondur, sayfaSil } from '../src/core/sayfalar.js';
import { sayfaNumarasiEkle, bilgiEkle } from '../src/core/bilgi.js';
import { filigranEkle, filigranGeriAl } from '../src/core/filigran.js';
import { kirp } from '../src/core/kirp.js';
import { damgaEkle } from '../src/core/damga.js';
import { formAlanlari, formDoldur } from '../src/core/form.js';
import { sifreEkle, sifreKaldir } from '../src/core/sifre.js';
import { pdfdenResimler } from '../src/core/render.js';

const VARSAYILAN = join(homedir(), 'Desktop', 'ornekler');
const arg = process.argv[2];
const hedef = resolve(arg ?? process.env.ORNEK_KLASOR ?? VARSAYILAN);
const SAYFA_SINIRI = Number(process.env.ORNEK_SAYFA ?? 5);
const CIKTI = resolve(import.meta.dirname, '..', 'ciktilar', 'ornek-test');
const OLCEK = 0.5;

function dosyalariBul() {
  const s = statSync(hedef);
  if (s.isFile()) return [hedef];
  return readdirSync(hedef).filter((d) => d.toLowerCase().endsWith('.pdf')).sort().map((d) => join(hedef, d));
}

class Atla extends Error {}
const kos = (cond, mesaj) => { if (!cond) throw new Error(mesaj); };

async function tumSayfalar(bayt, n) {
  const l = [];
  for (let i = 1; i <= n; i++) l.push(await sayfaPikselleri(bayt, i, { olcek: OLCEK }));
  return l;
}

async function ayniMi(a, b, n, ad) {
  const A = await tumSayfalar(a, n), B = await tumSayfalar(b, n);
  for (let i = 0; i < n; i++) {
    const f = karsilastir(A[i], B[i]);
    kos(!f.boyutUyumsuz, `${ad}: sayfa ${i + 1} boyutu değişti`);
    kos(f.farkliPiksel === 0, `${ad}: sayfa ${i + 1} görseli değişti (${f.farkliPiksel} piksel, %${(f.oran * 100).toFixed(3)})`);
  }
}

async function dosyaIsle(yol) {
  const ad = basename(yol);
  const sonuclar = [];
  const bilgi = { dosya: ad, boyutKB: Math.round(statSync(yol).size / 1024) };
  const klasor = join(CIKTI, ad.replace(/[^\w.-]+/g, '_'));
  mkdirSync(klasor, { recursive: true });

  const kontrol = async (isim, f) => {
    const t0 = Date.now();
    try {
      const not = await f();
      sonuclar.push({ isim, durum: 'GEÇTİ', not: not ?? '', sureMs: Date.now() - t0 });
    } catch (e) {
      if (e instanceof Atla) sonuclar.push({ isim, durum: 'ATLANDI', not: e.message, sureMs: Date.now() - t0 });
      else sonuclar.push({ isim, durum: 'KALDI', not: String(e?.message ?? e), sureMs: Date.now() - t0 });
    }
  };

  const tam = new Uint8Array(readFileSync(yol));
  let n = 0, ozellik = null, kaynak = null;

  await kontrol('Dosya açılıyor (pdf-lib + pdf.js)', async () => {
    let doc;
    try { doc = await pdfAc(tam); } catch (e) {
      if (e instanceof SifreliPdfHatasi) { bilgi.sifreli = true; throw new Atla('Şifreli dosya — şifre olmadan işlem yapılmaz'); }
      throw e;
    }
    ozellik = belgeOzellikleri(doc);
    bilgi.sayfaSayisi = doc.getPageCount();
    const belge = await belgeAc(tam);
    kos(belge.numPages === doc.getPageCount(), `sayfa sayısı uyuşmuyor (pdf-lib ${doc.getPageCount()}, pdf.js ${belge.numPages})`);
    n = belge.numPages;
    const s1 = await belge.getPage(1);
    const vp = s1.getViewport({ scale: 1 });
    bilgi.sayfa1Boyut = `${Math.round(vp.width)}x${Math.round(vp.height)} pt`;
    const metin = (await s1.getTextContent()).items.map((x) => x.str).join('').length;
    bilgi.sayfa1MetinKarakter = metin;
    await belge.kapat();
    bilgi.ozellikler = Object.entries(ozellik).filter(([, v]) => v && v !== 0).map(([k]) => k).join(', ') || '-';
    return `${n} sayfa, ${bilgi.sayfa1Boyut}`;
  });
  if (!n || bilgi.sifreli) return { bilgi, sonuclar };

  const k = Math.min(n, SAYFA_SINIRI);

  await kontrol(`Sayfa çıkar (ilk ${k} sayfa) — görüntü özgün sayfalarla aynı`, async () => {
    const s = await sayfaCikar(tam, `1-${k}`);
    kaynak = s.bayt;
    writeFileSync(join(klasor, 'calisma-kopyasi.pdf'), kaynak);
    const A = await tumSayfalar(tam, k), B = await tumSayfalar(kaynak, k);
    for (let i = 0; i < k; i++) {
      const f = karsilastir(A[i], B[i]);
      kos(!f.boyutUyumsuz && f.oran < 0.0005, `sayfa ${i + 1}: görsel fark %${(f.oran * 100).toFixed(3)}`);
    }
    return s.uyarilar.length ? `uyarı: ${s.uyarilar.join(' | ')}` : '';
  });
  if (!kaynak) return { bilgi, sonuclar };

  await kontrol('İlk sayfa çiziliyor ve boş değil', async () => {
    const c = await sayfaPikselleri(kaynak, 1, { olcek: 1 });
    pngKaydet(c, join(klasor, 'sayfa-1.png'));
    const d = doluluk(c);
    kos(d > 0, 'sayfa tamamen boş çiziliyor');
    return `doluluk %${(d * 100).toFixed(1)}`;
  });

  await kontrol('Sayfa döndür: 90° → boyut yer değiştirir; 4×90° → özgün', async () => {
    const o = await sayfaPikselleri(kaynak, 1, { olcek: OLCEK });
    const r = await sayfaDondur(kaynak, { 0: 90 });
    const c = await sayfaPikselleri(r.bayt, 1, { olcek: OLCEK });
    kos(Math.abs(c.genislik - o.yukseklik) <= 1 && Math.abs(c.yukseklik - o.genislik) <= 1, 'boyutlar yer değiştirmedi');
    let t = kaynak;
    for (let i = 0; i < 4; i++) t = (await sayfaDondur(t, { 0: 90 })).bayt;
    await ayniMi(kaynak, t, k, '4×90°');
  });

  await kontrol('Sayfa numarası: yalnızca alt bölgede değişiklik', async () => {
    const s = await sayfaNumarasiEkle(kaynak, { konum: 'alt-orta', bicim: 'Sayfa {n}/{toplam}', boyut: 14 });
    for (let i = 1; i <= k; i++) {
      const o = await sayfaPikselleri(kaynak, i, { olcek: OLCEK });
      const y = await sayfaPikselleri(s.bayt, i, { olcek: OLCEK });
      const f = karsilastir(o, y);
      kos(!f.boyutUyumsuz, `sayfa ${i}: boyut değişti`);
      kos(f.farkliPiksel > 0, `sayfa ${i}: numara görünmüyor`);
      kos(f.kutu.y0 >= o.yukseklik * 0.88, `sayfa ${i}: değişiklik alt bölge dışına taştı (y0=${f.kutu.y0}/${o.yukseklik})`);
    }
    return s.uyarilar.length ? `uyarı: ${s.uyarilar.join(' | ')}` : '';
  });

  await kontrol('Üst/alt bilgi: Türkçe karakterli metin eklenir', async () => {
    const s = await bilgiEkle(kaynak, { alanlar: { 'ust-sol': 'Gizli — İÇİŞLERİ ığüşöç', 'alt-sag': '{n}' }, boyut: 10 });
    const f = karsilastir(await sayfaPikselleri(kaynak, 1, { olcek: OLCEK }), await sayfaPikselleri(s.bayt, 1, { olcek: OLCEK }));
    kos(f.farkliPiksel > 0, 'bilgi görünmüyor');
  });

  await kontrol('Filigran ekle → geri al: sayfalar piksel piksel özgünle aynı', async () => {
    const f = await filigranEkle(kaynak, { metin: 'TASLAK ĞÜŞİÖÇ', konum: 'doseme', opaklik: 0.3 });
    const degisim = karsilastir(await sayfaPikselleri(kaynak, 1, { olcek: OLCEK }), await sayfaPikselleri(f.bayt, 1, { olcek: OLCEK }));
    kos(degisim.farkliPiksel > 0, 'filigran görünmüyor');
    const g = await filigranGeriAl(f.bayt);
    kos(g.bulunan === k, `geri alınan sayfa ${g.bulunan}/${k}`);
    await ayniMi(kaynak, g.bayt, k, 'filigran geri alma');
    return `geri alınan dosya boyutu ${Math.round(g.bayt.length / 1024)} KB (çalışma kopyası ${Math.round(kaynak.length / 1024)} KB)`;
  });

  await kontrol('Kırp: üstten 40 pt → sayfa 40 pt kısalır', async () => {
    const o = await sayfaPikselleri(kaynak, 1, { olcek: 1 });
    const s = await kirp(kaynak, { ust: 40, sayfalar: '1' });
    const c = await sayfaPikselleri(s.bayt, 1, { olcek: 1 });
    kos(Math.abs(c.yukseklik - (o.yukseklik - 40)) <= 1, `yükseklik ${o.yukseklik} → ${c.yukseklik} (beklenen ${o.yukseklik - 40})`);
  });

  await kontrol('Görünür metin kutusu / imza eklenir', async () => {
    const o = await sayfaPikselleri(kaynak, 1, { olcek: 1 });
    const s = await damgaEkle(kaynak, [{ sayfa: 0, tur: 'metin', x: 40, y: 40, genislik: 220, yukseklik: 40, metin: 'Onaylandı — İmza: Ğ. Şahin', boyut: 11, cerceve: '#000000' }]);
    const f = karsilastir(o, await sayfaPikselleri(s.bayt, 1, { olcek: 1 }), { esik: 0.02 });
    kos(f.farkliPiksel > 20, 'kutu görünmüyor');
  });

  await kontrol('Birleştir (çalışma kopyası ×2) → sayfalar aynen korunur', async () => {
    const b = await birlestir([{ ad: 'a.pdf', bayt: kaynak }, { ad: 'b.pdf', bayt: kaynak }]);
    kos(b.sayfaSayisi === 2 * k, `sayfa sayısı ${b.sayfaSayisi}`);
    const O = await sayfaPikselleri(kaynak, k, { olcek: OLCEK }), Y = await sayfaPikselleri(b.bayt, 2 * k, { olcek: OLCEK });
    kos(karsilastir(O, Y).farkliPiksel === 0, 'son sayfa değişti');
  });

  await kontrol('Böl (her sayfa ayrı) + sayfa sil', async () => {
    const b = await bol(kaynak, ad, { mod: 'tek' });
    kos(b.dosyalar.length === k, `${b.dosyalar.length} dosya`);
    if (k > 1) {
      const s = await sayfaSil(kaynak, '1');
      kos(s.sayfaSayisi === k - 1, 'sayfa silinmedi');
    }
  });

  await kontrol('Şifre ekle → şifre kaldır: görüntü özgünle aynı', async () => {
    const s = await sifreEkle(kaynak, { kullaniciSifresi: 'Örnek-Şifre-1' });
    const a = await sayfaPikselleri(s.bayt, 1, { olcek: OLCEK, sifre: 'Örnek-Şifre-1' });
    kos(karsilastir(a, await sayfaPikselleri(kaynak, 1, { olcek: OLCEK })).farkliPiksel === 0, 'şifreli dosya farklı çiziliyor');
    const g = await sifreKaldir(s.bayt, 'Örnek-Şifre-1');
    await ayniMi(kaynak, g.bayt, k, 'şifre kaldırma');
    let reddedildi = false;
    try { await sifreKaldir(s.bayt, 'yanlış'); } catch { reddedildi = true; }
    kos(reddedildi, 'yanlış şifre reddedilmedi!');
  });

  await kontrol('PDF → resim (PNG, 72 dpi)', async () => {
    const r = await pdfdenResimler(kaynak, ad, { dpi: 72, sayfalar: '1' });
    kos(r.dosyalar.length === 1 && r.dosyalar[0].bayt.length > 100, 'resim üretilmedi');
    writeFileSync(join(klasor, r.dosyalar[0].ad), r.dosyalar[0].bayt);
    return `${r.dosyalar[0].genislik}x${r.dosyalar[0].yukseklik}`;
  });

  await kontrol('Form alanları', async () => {
    const f = await formAlanlari(tam);
    bilgi.formAlani = f.alanlar.length;
    if (!f.alanlar.length) throw new Atla('Belgede form alanı yok');
    const metin = f.alanlar.find((a) => a.tur === 'metin' && !a.salt);
    if (!metin) return `${f.alanlar.length} alan (doldurulabilir metin alanı yok)`;
    const s = await formDoldur(tam, { [metin.ad]: 'Deneme Ğüşiöç' });
    const g = await formAlanlari(s.bayt);
    kos(g.alanlar.find((a) => a.ad === metin.ad).deger === 'Deneme Ğüşiöç', 'değer geri okunamadı');
    return `${f.alanlar.length} alan; "${metin.ad}" dolduruldu`;
  });

  return { bilgi, sonuclar };
}

// --- Çalıştır ve raporla -----------------------------------------------------------------------
const dosyalar = dosyalariBul();
rmSync(CIKTI, { recursive: true, force: true });
mkdirSync(CIKTI, { recursive: true });
console.log(`Örnek test: ${dosyalar.length} dosya (${hedef}) — her dosyadan en çok ${SAYFA_SINIRI} sayfa\n`);

const hepsi = [];
for (const yol of dosyalar) {
  console.log(`▶ ${basename(yol)}`);
  const t0 = Date.now();
  let r;
  try { r = await dosyaIsle(yol); } catch (e) { r = { bilgi: { dosya: basename(yol) }, sonuclar: [{ isim: 'Beklenmeyen hata', durum: 'KALDI', not: String(e?.stack ?? e) }] }; }
  r.sureMs = Date.now() - t0;
  hepsi.push(r);
  for (const s of r.sonuclar) {
    const isaret = s.durum === 'GEÇTİ' ? '✔' : s.durum === 'ATLANDI' ? '–' : '✘';
    console.log(`   ${isaret} ${s.isim}${s.not ? `  [${s.not}]` : ''}`);
  }
}

const say = (d) => hepsi.reduce((t, r) => t + r.sonuclar.filter((s) => s.durum === d).length, 0);
const ozet = { gecti: say('GEÇTİ'), kaldi: say('KALDI'), atlandi: say('ATLANDI'), dosya: hepsi.length };

let md = `# Örnek PDF test raporu\n\nKlasör: \`${hedef}\`  \nSonuç: **${ozet.gecti} geçti, ${ozet.kaldi} kaldı, ${ozet.atlandi} atlandı** (${ozet.dosya} dosya)\n\n`;
for (const r of hepsi) {
  md += `## ${r.bilgi.dosya}\n\n- Boyut: ${r.bilgi.boyutKB} KB · Sayfa: ${r.bilgi.sayfaSayisi ?? '?'} · Özellikler: ${r.bilgi.ozellikler ?? '-'}\n\n| Kontrol | Sonuç | Not |\n|---|---|---|\n`;
  for (const s of r.sonuclar) md += `| ${s.isim} | ${s.durum} | ${String(s.not ?? '').replace(/\|/g, '/')} |\n`;
  md += '\n';
}
writeFileSync(join(CIKTI, 'rapor.md'), md);
writeFileSync(join(CIKTI, 'rapor.json'), JSON.stringify({ ozet, hepsi }, null, 2));
console.log(`\nSONUÇ: ${ozet.gecti} geçti, ${ozet.kaldi} kaldı, ${ozet.atlandi} atlandı.`);
console.log(`Rapor: ${join(CIKTI, 'rapor.md')}`);
process.exit(ozet.kaldi ? 1 : 0);
