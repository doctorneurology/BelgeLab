// Araç sayfası çatısı: dosya seçimi → ayarlar → çalıştır → sonuç. Her araç yalnızca kendi ayarını ve işini tanımlar.
import './ortam.js';
import { sifreModulu } from './ortam.js';
import {
  h, kutu, indir, boyutMetni, dosyaOku, kullaniciMesaji, boyamaBekle, birakVer, urlleriTemizle,
} from './yardim.js';
import { kabukKur } from './kabuk.js';
import { ARACLAR } from '../araclar.js';
import { pdfAc } from '../core/belge.js';
import { SifreliPdfHatasi, PdfHatasi } from '../core/hatalar.js';
import { belgeAc, sayfaCiz } from '../core/render.js';
import { resimTuru } from '../core/resim-pdf.js';
import { zipOlustur } from '../core/zip.js';
import { topluIsle } from '../core/toplu.js';
import { iptalIste, iptalSifirla } from '../core/iptal.js';
import { hafiza, kaliciDepoIste } from '../core/hafiza.js';
import { alanlariOlustur } from './alanlar.js';
import { pdfOnizleme } from './onizleme.js';
import { resimiPngYap } from './resim-yardim.js';

// PDF/resim dışındaki dosya türleri (kabul listesi, uzantı denetimi, simge)
const DOSYA_TURLERI = {
  excel: { kabul: '.xlsx,.xls,.xlsm', re: /.(xlsx|xls|xlsm)$/i, ad: 'Excel dosyası (.xlsx / .xls)', ikon: '📊' },
  tablo: { kabul: '.xlsx,.xls,.xlsm,.csv,.tsv,.txt', re: /.(xlsx|xls|xlsm|csv|tsv|txt)$/i, ad: 'Excel ya da CSV dosyası', ikon: '📊' },
  word: { kabul: '.docx', re: /.docx$/i, ad: 'Word dosyası (.docx)', ikon: '📝' },
  sunum: { kabul: '.pptx', re: /.pptx$/i, ad: 'PowerPoint dosyası (.pptx)', ikon: '📽️' },
  html: { kabul: '.html,.htm,.xhtml,.txt', re: /.(html?|xhtml|txt)$/i, ad: 'HTML dosyası (.html / .htm / .txt)', ikon: '🌐' },
};

const BUYUK_DOSYA = 300 * 1024 * 1024; // yalnızca uyarı eşiği; sınır değildir


/**
 * @param tanim.slug         araç kimliği (araclar.js)
 * @param tanim.dosya        { tur:'pdf'|'resim', coklu:boolean, enAz:number, sifreliyiDogrudanAl:boolean }
 * @param tanim.alanlar      bildirimli ayar alanları (alanlar.js)  — ya da —
 * @param tanim.ayar         (ctx) => ({ el, oku(), dosyalarDegisti?(dosyalar) })  özel ayar arayüzü
 * @param tanim.calistir     async ({dosyalar, ayarlar, ilerleme}) => ({ ciktilar:[{ad,bayt}], uyarilar, mesaj })
 */
export function aracKur(tanim) {
  const bilgi = ARACLAR.find((a) => a.slug === tanim.slug);
  const main = kabukKur({ slug: tanim.slug, baslik: bilgi.ad });
  const dosyaTanimi = { tur: 'pdf', coklu: false, enAz: 1, sifreliyiDogrudanAl: false, ...tanim.dosya };
  // TOPLU KİP: Tek dosya alan her araç, istenirse birden çok dosyayı SIRAYLA (her biri ayrı çıktı) işler. Dosya sayısı sınırı yoktur.
  // Dosyaya özel arayüzü olan araçlar (ör. yazıyı tıklayıp düzeltme) `toplu: false` ile kapatılır.
  const toplu = !dosyaTanimi.coklu && tanim.toplu !== false;
  const topluKabul = dosyaTanimi.coklu || toplu;
  const durum = { dosyalar: [], sayac: 0, mesgul: false, iptal: false };

  // ---- 1. Dosya seçimi ----
  const girdi = h('input', {
    type: 'file', id: 'dosya-girdisi',
    accept: dosyaTanimi.tur === 'pdf' ? 'application/pdf,.pdf' : DOSYA_TURLERI[dosyaTanimi.tur]?.kabul ?? 'image/*',
    ...(dosyaTanimi.kamera ? { capture: 'environment' } : {}),
    multiple: topluKabul,
  });
  const tur = DOSYA_TURLERI[dosyaTanimi.tur];
  const alan = h('label', { class: 'dosya-alani', for: 'dosya-girdisi' },
    h('strong', {}, dosyaTanimi.tur === 'pdf'
      ? (topluKabul ? 'PDF dosyalarını seçin' : 'PDF dosyasını seçin')
      : tur ? `${tur.ad}${topluKabul ? ' dosyalarını' : ' dosyasını'} seçin` : 'Resimleri seçin'),
    h('span', { class: 'soluk' }, topluKabul
      ? `Dokunun/tıklayın ya da dosyaları buraya sürükleyin. ${toplu ? 'Birden çok dosya seçerseniz hepsi sırayla işlenir (sayı sınırı yok). ' : ''}Dosyalar cihazınızdan çıkmaz.`
      : 'Dokunun/tıklayın ya da dosyayı buraya sürükleyin. Dosya cihazınızdan çıkmaz.'),
    girdi);
  // Klasör seçimi: içindeki uygun dosyaların hepsi eklenir (alt klasörler dahil)
  const klasorGirdi = h('input', { type: 'file', id: 'klasor-girdisi', webkitdirectory: true, directory: true, multiple: true, hidden: true });
  const klasorDugmesi = topluKabul && dosyaTanimi.tur !== 'resim' ? h('button', { type: 'button', class: 'kucuk-dugme', onclick: () => klasorGirdi.click() }, '📁 Klasör seç (içindeki tüm dosyalar eklenir)') : null;
  const hataAlani = h('div', { 'aria-live': 'polite' });
  const ipucuAlani = h('div', { 'aria-live': 'polite' });
  const okumaYazi = h('p', { class: 'soluk', 'aria-live': 'polite' });
  const liste = h('ul', { class: 'dosya-listesi', 'aria-label': 'Seçilen dosyalar' });

  const adim1 = h('section', { class: 'adim' },
    h('h2', {}, h('span', { class: 'adim-no', 'aria-hidden': 'true' }, '1'), 'Dosya'),
    alan, klasorDugmesi ? h('div', { class: 'eylem' }, klasorDugmesi, klasorGirdi) : '', hataAlani, okumaYazi, ipucuAlani, liste);

  // ---- 2. Ayarlar ----
  const ctx = {
    dosyalar: () => durum.dosyalar,
    ilkDosya: () => durum.dosyalar[0],
    hata: (m) => hataGoster(m),
    dosyaEkle: (dosyalar) => dosyaEkle(dosyalar), // kamera yakalaması gibi dışarıdan gelen dosyalar için
  };
  let ayarlar = null;
  if (tanim.ayar) ayarlar = tanim.ayar(ctx);
  else if (tanim.alanlar?.length) ayarlar = alanlariOlustur(tanim.alanlar);
  const ayarIcerik = ayarlar?.el;

  const adim2 = h('section', { class: 'adim', hidden: true },
    h('h2', {}, h('span', { class: 'adim-no', 'aria-hidden': 'true' }, '2'), tanim.ayarBasligi ?? (ayarIcerik ? 'Ayarlar' : 'Hazır')),
    ...(tanim.notlar ?? []),
    ayarIcerik);

  const calistirDugmesi = h('button', { type: 'button', class: 'birincil', onclick: calistir }, tanim.dugme ?? 'Uygula');
  const eylem = h('div', { class: 'eylem' }, calistirDugmesi, h('span', { class: 'soluk', id: 'ilerleme', 'aria-live': 'polite' }));
  adim2.append(h('div', { stil: { marginTop: '14px' } }, eylem));

  const sonucAlani = h('div', { 'aria-live': 'polite' });

  main.append(
    h('div', { class: 'arac-baslik' },
      h('h1', {}, h('span', { class: 'ikon', 'aria-hidden': 'true' }, bilgi.ikon), ' ', bilgi.ad),
      h('p', {}, bilgi.kisa)),
    ...(tanim.ustNotlar ?? []),
    adim1, adim2, sonucAlani);

  // ---- Dosya ekleme ----
  ['dragenter', 'dragover'].forEach((o) => alan.addEventListener(o, (e) => { e.preventDefault(); alan.classList.add('surukle'); }));
  ['dragleave', 'drop'].forEach((o) => alan.addEventListener(o, (e) => { e.preventDefault(); alan.classList.remove('surukle'); }));
  alan.addEventListener('drop', (e) => dosyaEkle([...(e.dataTransfer?.files ?? [])]));
  girdi.addEventListener('change', () => { dosyaEkle([...girdi.files]); girdi.value = ''; });
  klasorGirdi.addEventListener('change', () => { dosyaEkle([...klasorGirdi.files], { klasor: true }); klasorGirdi.value = ''; });

  /** Klasör seçiminde tür dışı dosyalar sessizce atlanır (ör. .db, .jpg); sayısı bildirilir. */
  const uygunMu = (f) => (dosyaTanimi.tur === 'pdf' ? /\.pdf$/i.test(f.name) : tur ? tur.re.test(f.name) : /^image\//.test(f.type));

  function hataGoster(mesaj) {
    hataAlani.replaceChildren(mesaj ? kutu('hata', mesaj) : '');
  }

  async function dosyaEkle(secilen, { klasor = false } = {}) {
    hataGoster('');
    if (klasor) {
      const toplam = secilen.length;
      secilen = secilen.filter(uygunMu);
      if (toplam - secilen.length) hataAlani.append(kutu('bilgi', `Klasördeki ${toplam - secilen.length} dosya bu araca uygun olmadığı için atlandı.`));
    }
    if (!secilen.length) { if (klasor) hataAlani.append(kutu('uyari', 'Seçilen klasörde bu araca uygun dosya bulunamadı.')); return; }
    if (!topluKabul) { durum.dosyalar = []; secilen = secilen.slice(0, 1); }
    if (!durum.dosyalar.length) durum.buyukNot = [];
    let sira = 0;
    for (const f of secilen) {
      sira++;
      if (secilen.length > 3) { okumaYazi.textContent = `Dosyalar okunuyor… ${sira} / ${secilen.length}`; if (sira % 4 === 0) await birakVer(); }
      try {
        // Dosya/sayfa SINIRI YOK. Çok büyük dosyada yalnızca bilgi verilir (tarayıcı belleği cihazınıza bağlıdır).
        if (f.size > BUYUK_DOSYA) (durum.buyukNot ??= []).push(kutu('bilgi', `“${f.name}” çok büyük (${boyutMetni(f.size)}). Dosya sınırı yoktur, ama işlem uzun sürebilir ve cihazınızın belleği yetmeyebilir; sorun olursa sayfa aralığı seçerek parça parça deneyin.`));
        let bayt = await dosyaOku(f);
        const girdiKaydi = { id: ++durum.sayac, ad: f.name, boyut: f.size };
        if (dosyaTanimi.tur === 'pdf') {
          if (!dosyaTanimi.bozukOlabilir && !new TextDecoder('latin1').decode(bayt.subarray(0, 1024)).includes('%PDF-')) {
            throw new PdfHatasi(`"${f.name}" bir PDF dosyası gibi görünmüyor.`);
          }
          girdiKaydi.bayt = bayt;
          try {
            const d = await pdfAc(bayt);
            girdiKaydi.sayfa = d.getPageCount();
          } catch (e) {
            if (e instanceof SifreliPdfHatasi) girdiKaydi.sifreli = true;
            else if (!dosyaTanimi.bozukOlabilir) throw new PdfHatasi(`"${f.name}" açılamadı: ${e.message}`);
            else girdiKaydi.bozuk = true; // onarma aracı bozuk dosyayı kabul eder
          }
        } else if (DOSYA_TURLERI[dosyaTanimi.tur]) {
          const T = DOSYA_TURLERI[dosyaTanimi.tur];
          if (!T.re.test(f.name)) throw new PdfHatasi(`“${f.name}” beklenen türde değil: ${T.ad}.`);
          girdiKaydi.bayt = bayt;
          girdiKaydi.simge = T.ikon;
        } else {
          let tur = resimTuru(bayt);
          if (tur !== 'png' && tur !== 'jpeg') {
            try { bayt = await resimiPngYap(bayt); tur = 'png'; } catch { throw new PdfHatasi(`"${f.name}" resim olarak okunamadı.`); }
          }
          girdiKaydi.bayt = bayt;
          girdiKaydi.resimUrl = URL.createObjectURL(new Blob([bayt], { type: tur === 'png' ? 'image/png' : 'image/jpeg' }));
        }
        durum.dosyalar.push(girdiKaydi);
      } catch (e) {
        // çok sayıda dosyada hata kutuları ekranı doldurmasın: ilk 5 gösterilir, kalanı sayılır
        if (hataAlani.children.length < 5) hataAlani.append(kutu('hata', kullaniciMesaji(e)));
        else durum.gizliHata = (durum.gizliHata ?? 0) + 1;
      }
    }
    okumaYazi.textContent = '';
    if (durum.gizliHata) { hataAlani.append(kutu('hata', `… ve ${durum.gizliHata} dosya daha eklenemedi.`)); durum.gizliHata = 0; }
    degisti();
  }

  const kilitliMi = () => durum.dosyalar.some((d) => d.sifreli && !dosyaTanimi.sifreliyiDogrudanAl) && !(toplu && durum.dosyalar.length > 1);

  function degisti() {
    sonucAlani.replaceChildren();
    listeyiCiz();
    const hazir = durum.dosyalar.length >= dosyaTanimi.enAz;
    const kilitli = kilitliMi();
    adim2.hidden = !(hazir || durum.dosyalar.length > 0);
    calistirDugmesi.disabled = !hazir || kilitli || durum.mesgul;
    const topluNot = toplu && durum.dosyalar.length > 1
      ? kutu('bilgi', `Toplu kip: ${durum.dosyalar.length} dosya sırayla işlenecek, her biri için ayrı çıktı üretilir ve hepsi ZIP olarak indirilir. Aşağıdaki ayarlar (sayfa aralığı, şifre, konum vb.) her dosyaya aynen uygulanır${durum.dosyalar.some((d) => d.sifreli) ? '; şifreli dosyalar atlanır' : ''}. Bir dosya hata verirse atlanır ve diğerleri işlenmeye devam eder.`)
      : '';
    ipucuAlani.replaceChildren(!hazir && durum.dosyalar.length
      ? kutu('bilgi', `Bu araç için en az ${dosyaTanimi.enAz} dosya gerekli; bir dosya daha ekleyin.`) : '', topluNot, ...(durum.dosyalar.length ? (durum.buyukNot ?? []) : []));
    Promise.resolve(ayarlar?.dosyalarDegisti?.(durum.dosyalar)).catch((e) => {
      console.error(e);
      hataAlani.append(kutu('hata', kullaniciMesaji(e)));
    });
  }

  function listeyiCiz() {
    const cok = durum.dosyalar.length > 40; // çok dosyada küçük resim çizilmez (hız/bellek)
    const toplamBoyut = durum.dosyalar.reduce((t, d) => t + d.boyut, 0);
    const ozet = topluKabul && durum.dosyalar.length > 1
      ? [h('li', { class: 'dosya-ozet' }, h('b', {}, `${durum.dosyalar.length} dosya`), ` · toplam ${boyutMetni(toplamBoyut)} `,
        h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => { durum.dosyalar.forEach((d) => d.resimUrl && URL.revokeObjectURL(d.resimUrl)); durum.dosyalar = []; durum.buyukNot = []; hataGoster(''); degisti(); } }, 'Listeyi temizle'))]
      : [];
    liste.replaceChildren(...ozet, ...durum.dosyalar.slice(0, 300).map((d, i) => {
      const kucuk = d.resimUrl
        ? h('img', { class: 'kucuk-resim', src: d.resimUrl, alt: '' })
        : d.simge ? h('span', { class: 'kucuk-resim', 'aria-hidden': 'true', stil: { fontSize: '1.6rem', textAlign: 'center' } }, d.simge)
          : h('canvas', { width: 40, height: 52, 'aria-hidden': 'true' });
      if (!cok && !d.resimUrl && d.sayfa && d.boyut < 60 * 1024 * 1024) kucukResimCiz(d, kucuk);
      const satir = h('li', { class: 'dosya-satir' },
        kucuk,
        h('div', { class: 'dosya-bilgi' },
          h('b', {}, d.ad),
          h('small', {}, [boyutMetni(d.boyut), d.sayfa ? `${d.sayfa} sayfa` : '', d.sifreliAcildi ? 'şifresi açıldı' : '', d.sifreli ? '🔒 şifreli' : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'dosya-islem' },
          dosyaTanimi.coklu && h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': `${d.ad} dosyasını yukarı taşı`, disabled: i === 0, onclick: () => tasi(i, -1) }, '↑'),
          dosyaTanimi.coklu && h('button', { type: 'button', class: 'kucuk-dugme', 'aria-label': `${d.ad} dosyasını aşağı taşı`, disabled: i === durum.dosyalar.length - 1, onclick: () => tasi(i, 1) }, '↓'),
          h('button', { type: 'button', class: 'kucuk-dugme tehlike', 'aria-label': `${d.ad} dosyasını kaldır`, onclick: () => kaldir(i) }, 'Kaldır')));
      if (d.sifreli && !dosyaTanimi.sifreliyiDogrudanAl) satir.append(sifreSatiri(d));
      return satir;
    }), ...(durum.dosyalar.length > 300 ? [h('li', { class: 'dosya-ozet soluk' }, `… ve ${durum.dosyalar.length - 300} dosya daha (listede gösterilmez, hepsi işlenir)`)] : []));
  }

  async function kucukResimCiz(d, canvas) {
    try {
      const belge = await belgeAc(d.bayt);
      const { tuval } = await sayfaCiz(belge, 1, { olcek: 0.25 });
      const g = canvas.getContext('2d');
      const oran = Math.min(40 / tuval.width, 52 / tuval.height);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 40, 52);
      g.drawImage(tuval, 0, 0, tuval.width * oran, tuval.height * oran);
      await belge.kapat();
    } catch { /* küçük resim zorunlu değil */ }
  }

  function sifreSatiri(d) {
    const kutuGiris = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Bu PDF’in şifresi', 'aria-label': `${d.ad} şifresi` });
    const durumYazi = h('small', { class: 'soluk', role: 'status' });
    const ac = h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => {
      if (!kutuGiris.value) { durumYazi.textContent = 'Önce şifreyi yazın.'; return; }
      ac.disabled = true;
      durumYazi.textContent = 'Açılıyor…';
      try {
        const { sifreKaldir } = await sifreModulu();
        const r = await sifreKaldir(d.bayt, kutuGiris.value);
        d.bayt = r.bayt;
        d.sifreli = false;
        d.sifreliAcildi = true;
        d.sayfa = (await pdfAc(d.bayt)).getPageCount();
        degisti();
      } catch (e) {
        durumYazi.textContent = kullaniciMesaji(e);
        ac.disabled = false;
      }
    } }, 'Şifreyi gir');
    kutuGiris.addEventListener('keydown', (e) => { if (e.key === 'Enter') ac.click(); });
    return h('div', { class: 'sifre-satiri' },
      h('span', {}, '🔒 Bu PDF şifreli. Şifreyi biliyorsanız girin (şifre tahmin edilmez):'),
      kutuGiris, ac, durumYazi);
  }

  function tasi(i, yon) {
    const j = i + yon;
    if (j < 0 || j >= durum.dosyalar.length) return;
    [durum.dosyalar[i], durum.dosyalar[j]] = [durum.dosyalar[j], durum.dosyalar[i]];
    degisti();
  }
  function kaldir(i) {
    const [d] = durum.dosyalar.splice(i, 1);
    if (d?.resimUrl) URL.revokeObjectURL(d.resimUrl);
    hataGoster('');
    degisti();
  }

  // ---- Çalıştırma ----
  async function calistir() {
    if (durum.mesgul) return;
    durum.mesgul = true;
    calistirDugmesi.disabled = true;
    const eskiMetin = calistirDugmesi.textContent;
    calistirDugmesi.replaceChildren(h('span', { class: 'donen', 'aria-hidden': 'true' }), 'İşleniyor…');
    const ilerlemeYazi = eylem.querySelector('#ilerleme');
    sonucAlani.replaceChildren();
    hataGoster('');
    urlleriTemizle();
    // İPTAL: hem tek dosyada hem toplu işlemde çalışan iş GERÇEKTEN durur (sayfa döngüleri ve OCR işçileri dahil).
    durum.iptal = false;
    iptalSifirla();
    const iptalDugmesi = h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => {
      durum.iptal = true; iptalDugmesi.disabled = true; iptalDugmesi.textContent = 'İptal ediliyor…'; ilerlemeYazi.textContent = 'Durduruluyor…'; iptalIste();
    } }, '⛔ İptal et');
    eylem.append(iptalDugmesi);
    await boyamaBekle();
    try {
      const degerler = ayarlar ? await ayarlar.oku() : {};
      if (toplu && durum.dosyalar.length > 1) {
        sonucuGoster(await topluCalistir(degerler, ilerlemeYazi));
        return;
      }
      const sonuc = await tanim.calistir({
        dosyalar: durum.dosyalar, ayarlar: degerler,
        ilerleme: (k, n) => { ilerlemeYazi.textContent = n ? `${k} / ${n}` : ''; },
      });
      const sifreAcilan = durum.dosyalar.filter((d) => d.sifreliAcildi);
      if (sifreAcilan.length && dosyaTanimi.tur === 'pdf') {
        (sonuc.uyarilar ??= []).push(`Şifreli dosya${sifreAcilan.length > 1 ? 'lar' : ''} (${sifreAcilan.map((d) => d.ad).join(', ')}) sizin girdiğiniz şifreyle açıldı; çıktı şifresizdir. Gerekirse “Şifre ekle” aracıyla yeniden koruyun.`);
      }
      sonucuGoster(sonuc);
    } catch (e) {
      sonucAlani.replaceChildren(e?.name === 'IptalHatasi' ? kutu('uyari', 'İşlem iptal edildi. Yarım kalan dosya çıktıya eklenmedi.') : kutu('hata', kullaniciMesaji(e)));
      if (e?.name === 'IptalHatasi') { try { await tanim.topluBitti?.(); } catch { /* önemsiz */ } }
    } finally {
      iptalDugmesi.remove();
      durum.mesgul = false;
      calistirDugmesi.replaceChildren(eskiMetin);
      ilerlemeYazi.textContent = '';
      degisti2();
    }
  }
  function degisti2() {
    const hazir = durum.dosyalar.length >= dosyaTanimi.enAz;
    calistirDugmesi.disabled = !hazir || kilitliMi();
  }

  /** TOPLU ÇALIŞTIRMA: çekirdek mantık src/core/toplu.js'te (test edilmiştir); burada yalnızca arayüz. */
  async function topluCalistir(degerler, ilerlemeYazi) {
    const dosyalar = [...durum.dosyalar];
    const n = dosyalar.length;
    const cubuk = h('progress', { max: n, value: 0, 'aria-label': 'Toplu işlem ilerlemesi', stil: { width: '100%', maxWidth: '420px' } });
    eylem.append(cubuk);
    let t;
    // HAFIZA: her dosyanın çıktısı biter bitmez tarayıcı deposuna yazılır; sayfa ortada kapanırsa o ana kadarki işler kurtarılır.
    let kayit = null, hafizaHata = null;
    try { kayit = await hafiza().baslat({ arac: tanim.slug, aracAd: bilgi.ad, toplu: true, baslik: "toplu işlem" }); kaliciDepoIste(); } catch { kayit = null; }
    try {
      t = await topluIsle(dosyalar, async (d, i) => tanim.calistir({
        dosyalar: [d], ayarlar: degerler, toplu: true, dosyaNo: i,
        ilerleme: (k, m) => { ilerlemeYazi.textContent = `Dosya ${i + 1} / ${n}: ${d.ad}${m ? ` — ${k} / ${m}` : ''}`; },
      }), {
        atla: (d) => (d.sifreli && !dosyaTanimi.sifreliyiDogrudanAl ? 'Şifreli dosya; şifre girilmediği için atlandı.' : null),
        dosyaBitti: async (d, ciktilar) => {
          if (!kayit || hafizaHata) return;
          for (const c of ciktilar) { try { await kayit.ekle(c); } catch (e) { hafizaHata = e; break; } }
        },
        hataMetni: kullaniciMesaji, iptalMi: () => durum.iptal, zipAdi: (k) => `${tanim.slug}-toplu-${k}.zip`,
        ilerleme: async (i, toplam, d) => { cubuk.value = i; ilerlemeYazi.textContent = `Dosya ${i + 1} / ${toplam}: ${d.ad}`; await birakVer(); },
      });
    } finally {
      cubuk.remove();
      try { await tanim.topluBitti?.(); } catch { /* kapatma hatası önemsiz */ }
      if (kayit) { try { await (hafizaHata ? kayit.eksik(hafizaHata.message) : kayit.bitir()); } catch { /* yazılamadı */ } }
    }
    const uyarilar = t.uyarilar.map((u) => (u.dosyalar.length > 1 ? `${u.metin} (${u.dosyalar.length} dosyada)` : `${u.dosyalar[0]}: ${u.metin}`));
    if (uyarilar.length > 60) uyarilar.splice(60, uyarilar.length - 60, `… ve ${uyarilar.length - 60} uyarı daha.`);
    if (t.iptal) uyarilar.unshift(`İşlem iptal edildi: ${t.sonuclar.length} / ${n} dosya işlendi; kalanlar işlenmedi.`);
    const satirlar = t.sonuclar.map((s) => h('li', { class: s.ok ? 'yd-temiz' : 'yd-uyar' },
      `${s.ok ? '✅' : '⚠️'} ${s.ad}`, h('span', { class: 'soluk' }, s.ok ? ` → ${s.adet} çıktı${s.adet ? ` (${boyutMetni(s.boyut)})` : ''}` : ` — ${s.neden}`)));
    const detay = h('details', { class: 'yd-rapor', open: t.hatali > 0 && t.hatali <= 30 },
      h('summary', {}, `Dosya dosya sonuç (${t.basarili} başarılı${t.hatali ? `, ${t.hatali} hatalı` : ''})`), h('ul', {}, ...satirlar));
    return {
      ciktilar: t.zipler, tekTek: true,
      mesaj: `${t.basarili} / ${n} dosya işlendi${t.hatali ? `, ${t.hatali} dosya atlandı (hata)` : ''}; ${t.toplamCikti} çıktı dosyası ${t.zipler.length} ZIP içinde hazır.`,
      uyarilar, ekler: [detay],
      hafizaDurumu: !kayit ? 'yok' : hafizaHata ? 'eksik' : 'tamam',
    };
  }

  /** Hafıza durum satırı. durum: 'kaydediliyor' | 'tamam' | 'eksik' | 'yok' */
  function hafizaSatiri(durum, neden = '') {
    const el = h('p', { class: 'soluk hafiza-satir', role: 'status' });
    const yaz = (d, n = '') => {
      if (d === 'kaydediliyor') el.replaceChildren('💾 Hafızaya kaydediliyor…');
      else if (d === 'tamam') el.replaceChildren('💾 Bu çıktı hafızaya kaydedildi: sayfayı yanlışlıkla kapatsanız ya da yenileseniz bile ', h('a', { href: 'hafiza.html' }, 'Hafıza'), ' sayfasından yeniden indirebilirsiniz.');
      else if (d === 'eksik') el.replaceChildren(`⚠️ Hafıza dolduğu için çıktıların tamamı kaydedilemedi${n ? ` (${n})` : ''}. Dosyaları hemen indirin; eski kayıtları `, h('a', { href: 'hafiza.html' }, 'Hafıza'), ' sayfasından silerek yer açabilirsiniz.');
      else el.replaceChildren('');
    };
    yaz(durum, neden);
    return { el, yaz };
  }
  async function tekCikisiKaydet(ciktilar, satir) {
    try {
      const k = await hafiza().baslat({ arac: tanim.slug, aracAd: bilgi.ad, toplu: false, baslik: ciktilar[0]?.ad });
      kaliciDepoIste();
      let hata = null;
      for (const c of ciktilar) { try { await k.ekle(c); } catch (e) { hata = e; break; } }
      await (hata ? k.eksik(hata.message) : k.bitir());
      satir.yaz(hata ? 'eksik' : 'tamam', hata?.message ?? '');
    } catch { satir.yaz('yok'); } // hafıza kullanılamıyor (gizli pencere vb.): sessizce atla
  }

  function sonucuGoster({ ciktilar = [], uyarilar = [], mesaj = '', bilgiler = [], ekler = [], tekTek = false, hafizaDurumu = null }) {
    const parcalar = [];
    const baslik = h('h2', { tabindex: '-1' }, ciktilar.length ? 'Hazır' : 'Sonuç');
    parcalar.push(baslik);
    if (mesaj) parcalar.push(kutu('basari', mesaj));
    if (ciktilar.length) {
      const satir = hafizaSatiri(hafizaDurumu ?? 'kaydediliyor');
      parcalar.push(satir.el);
      if (hafizaDurumu === null) tekCikisiKaydet(ciktilar, satir);
    }
    for (const b of bilgiler) parcalar.push(kutu('bilgi', b));
    if (uyarilar.length) {
      parcalar.push(kutu('uyari', h('b', {}, 'Dikkat'),
        h('ul', {}, ...[...new Set(uyarilar)].map((u) => h('li', {}, u)))));
    }
    if (ciktilar.length) {
      if (ciktilar.length <= 12 || tekTek) {
        parcalar.push(h('ul', { class: 'sonuc-dosyalar' }, ...ciktilar.map((c) => h('li', {},
          h('div', { class: 'dosya-bilgi' }, h('b', {}, c.ad), h('small', {}, boyutMetni(c.bayt.length))),
          h('button', { type: 'button', class: 'birincil', onclick: () => indir(c.bayt, c.ad) }, '⬇ İndir')))));
      } else {
        const toplam = ciktilar.reduce((t, c) => t + c.bayt.length, 0);
        parcalar.push(h('p', { class: 'soluk' }, `${ciktilar.length} dosya hazır (toplam ${boyutMetni(toplam)}); aşağıdaki düğmeyle tek ZIP dosyası olarak indirin.`));
      }
      if (ciktilar.length > 1 && !tekTek) {
        parcalar.push(h('div', { class: 'eylem' }, h('button', {
          type: 'button', class: 'birincil', onclick: () => indir(zipOlustur(ciktilar.map((c) => ({ ad: c.ad, bayt: c.bayt }))), `${tanim.slug}-cikti.zip`),
        }, `⬇ Hepsini ZIP olarak indir (${ciktilar.length} dosya)`)));
      }
      parcalar.push(...ekler);
      const ilkPdf = ciktilar.find((c) => c.ad.toLowerCase().endsWith('.pdf'));
      if (ilkPdf && tanim.onizleme !== false) parcalar.push(pdfOnizleme(ilkPdf.bayt));
      const ilkResim = ciktilar.find((c) => /\.(png|jpe?g)$/i.test(c.ad));
      if (!ilkPdf && ilkResim) {
        const url = URL.createObjectURL(new Blob([ilkResim.bayt]));
        parcalar.push(h('div', { class: 'onizleme' }, h('img', { src: url, alt: `${ilkResim.ad} önizlemesi`, stil: { maxWidth: '100%', border: '1px solid var(--kenar)' } })));
      }
    }
    if (!ciktilar.length) parcalar.push(...ekler);
    sonucAlani.replaceChildren(h('section', { class: 'adim' }, ...parcalar));
    baslik.scrollIntoView({ behavior: 'smooth', block: 'start' });
    baslik.focus({ preventScroll: true });
  }

  degisti();
  return { ctx, durum };
}
