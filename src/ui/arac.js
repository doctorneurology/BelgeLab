// Araç sayfası çatısı: dosya seçimi → ayarlar → çalıştır → sonuç. Her araç yalnızca kendi ayarını ve işini tanımlar.
import './ortam.js';
import { sifreModulu } from './ortam.js';
import {
  h, kutu, indir, boyutMetni, dosyaOku, kullaniciMesaji, boyamaBekle, urlleriTemizle,
} from './yardim.js';
import { kabukKur } from './kabuk.js';
import { ARACLAR } from '../araclar.js';
import { pdfAc } from '../core/belge.js';
import { SifreliPdfHatasi, PdfHatasi } from '../core/hatalar.js';
import { belgeAc, sayfaCiz } from '../core/render.js';
import { resimTuru } from '../core/resim-pdf.js';
import { zipOlustur } from '../core/zip.js';
import { alanlariOlustur } from './alanlar.js';
import { pdfOnizleme } from './onizleme.js';
import { resimiPngYap } from './resim-yardim.js';

const BUYUK_DOSYA = 150 * 1024 * 1024;


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
  const durum = { dosyalar: [], sayac: 0, mesgul: false };

  // ---- 1. Dosya seçimi ----
  const girdi = h('input', {
    type: 'file', id: 'dosya-girdisi',
    accept: dosyaTanimi.tur === 'pdf' ? 'application/pdf,.pdf' : 'image/*',
    multiple: dosyaTanimi.coklu,
  });
  const alan = h('label', { class: 'dosya-alani', for: 'dosya-girdisi' },
    h('strong', {}, dosyaTanimi.tur === 'pdf'
      ? (dosyaTanimi.coklu ? 'PDF dosyalarını seçin' : 'PDF dosyasını seçin')
      : 'Resimleri seçin'),
    h('span', { class: 'soluk' }, 'Dokunun/tıklayın ya da dosyayı buraya sürükleyin. Dosya cihazınızdan çıkmaz.'),
    girdi);
  const hataAlani = h('div', { 'aria-live': 'polite' });
  const ipucuAlani = h('div', { 'aria-live': 'polite' });
  const liste = h('ul', { class: 'dosya-listesi', 'aria-label': 'Seçilen dosyalar' });

  const adim1 = h('section', { class: 'adim' },
    h('h2', {}, h('span', { class: 'adim-no', 'aria-hidden': 'true' }, '1'), 'Dosya'),
    alan, hataAlani, ipucuAlani, liste);

  // ---- 2. Ayarlar ----
  const ctx = {
    dosyalar: () => durum.dosyalar,
    ilkDosya: () => durum.dosyalar[0],
    hata: (m) => hataGoster(m),
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

  function hataGoster(mesaj) {
    hataAlani.replaceChildren(mesaj ? kutu('hata', mesaj) : '');
  }

  async function dosyaEkle(secilen) {
    hataGoster('');
    if (!secilen.length) return;
    if (!dosyaTanimi.coklu) { durum.dosyalar = []; secilen = secilen.slice(0, 1); }
    for (const f of secilen) {
      try {
        if (f.size > BUYUK_DOSYA) throw new PdfHatasi(`"${f.name}" çok büyük (${boyutMetni(f.size)}). Tarayıcı belleği yetmeyebilir; 150 MB'dan küçük dosyalar deneyin.`);
        let bayt = await dosyaOku(f);
        const girdiKaydi = { id: ++durum.sayac, ad: f.name, boyut: f.size };
        if (dosyaTanimi.tur === 'pdf') {
          if (!new TextDecoder('latin1').decode(bayt.subarray(0, 1024)).includes('%PDF-')) {
            throw new PdfHatasi(`"${f.name}" bir PDF dosyası gibi görünmüyor.`);
          }
          girdiKaydi.bayt = bayt;
          try {
            const d = await pdfAc(bayt);
            girdiKaydi.sayfa = d.getPageCount();
          } catch (e) {
            if (e instanceof SifreliPdfHatasi) girdiKaydi.sifreli = true;
            else throw new PdfHatasi(`"${f.name}" açılamadı: ${e.message}`);
          }
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
        hataAlani.append(kutu('hata', kullaniciMesaji(e)));
      }
    }
    degisti();
  }

  function degisti() {
    sonucAlani.replaceChildren();
    listeyiCiz();
    const hazir = durum.dosyalar.length >= dosyaTanimi.enAz;
    const kilitli = durum.dosyalar.some((d) => d.sifreli && !dosyaTanimi.sifreliyiDogrudanAl);
    adim2.hidden = !(hazir || durum.dosyalar.length > 0);
    calistirDugmesi.disabled = !hazir || kilitli || durum.mesgul;
    ipucuAlani.replaceChildren(!hazir && durum.dosyalar.length
      ? kutu('bilgi', `Bu araç için en az ${dosyaTanimi.enAz} dosya gerekli; bir dosya daha ekleyin.`) : '');
    Promise.resolve(ayarlar?.dosyalarDegisti?.(durum.dosyalar)).catch((e) => {
      console.error(e);
      hataAlani.append(kutu('hata', kullaniciMesaji(e)));
    });
  }

  function listeyiCiz() {
    liste.replaceChildren(...durum.dosyalar.map((d, i) => {
      const kucuk = d.resimUrl
        ? h('img', { class: 'kucuk-resim', src: d.resimUrl, alt: '' })
        : h('canvas', { width: 40, height: 52, 'aria-hidden': 'true' });
      if (!d.resimUrl && d.sayfa && d.boyut < 60 * 1024 * 1024) kucukResimCiz(d, kucuk);
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
    }));
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
    await boyamaBekle();
    try {
      const degerler = ayarlar ? await ayarlar.oku() : {};
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
      sonucAlani.replaceChildren(kutu('hata', kullaniciMesaji(e)));
    } finally {
      durum.mesgul = false;
      calistirDugmesi.replaceChildren(eskiMetin);
      ilerlemeYazi.textContent = '';
      degisti2();
    }
  }
  function degisti2() {
    const hazir = durum.dosyalar.length >= dosyaTanimi.enAz;
    const kilitli = durum.dosyalar.some((d) => d.sifreli && !dosyaTanimi.sifreliyiDogrudanAl);
    calistirDugmesi.disabled = !hazir || kilitli;
  }

  function sonucuGoster({ ciktilar = [], uyarilar = [], mesaj = '', bilgiler = [] }) {
    const parcalar = [];
    const baslik = h('h2', { tabindex: '-1' }, ciktilar.length ? 'Hazır' : 'Sonuç');
    parcalar.push(baslik);
    if (mesaj) parcalar.push(kutu('basari', mesaj));
    for (const b of bilgiler) parcalar.push(kutu('bilgi', b));
    if (uyarilar.length) {
      parcalar.push(kutu('uyari', h('b', {}, 'Dikkat'),
        h('ul', {}, ...[...new Set(uyarilar)].map((u) => h('li', {}, u)))));
    }
    if (ciktilar.length) {
      if (ciktilar.length <= 12) {
        parcalar.push(h('ul', { class: 'sonuc-dosyalar' }, ...ciktilar.map((c) => h('li', {},
          h('div', { class: 'dosya-bilgi' }, h('b', {}, c.ad), h('small', {}, boyutMetni(c.bayt.length))),
          h('button', { type: 'button', class: 'birincil', onclick: () => indir(c.bayt, c.ad) }, '⬇ İndir')))));
      } else {
        const toplam = ciktilar.reduce((t, c) => t + c.bayt.length, 0);
        parcalar.push(h('p', { class: 'soluk' }, `${ciktilar.length} dosya hazır (toplam ${boyutMetni(toplam)}); aşağıdaki düğmeyle tek ZIP dosyası olarak indirin.`));
      }
      if (ciktilar.length > 1) {
        parcalar.push(h('div', { class: 'eylem' }, h('button', {
          type: 'button', class: 'birincil', onclick: () => indir(zipOlustur(ciktilar.map((c) => ({ ad: c.ad, bayt: c.bayt }))), `${tanim.slug}-cikti.zip`),
        }, `⬇ Hepsini ZIP olarak indir (${ciktilar.length} dosya)`)));
      }
      const ilkPdf = ciktilar.find((c) => c.ad.toLowerCase().endsWith('.pdf'));
      if (ilkPdf && tanim.onizleme !== false) parcalar.push(pdfOnizleme(ilkPdf.bayt));
      const ilkResim = ciktilar.find((c) => /\.(png|jpe?g)$/i.test(c.ad));
      if (!ilkPdf && ilkResim) {
        const url = URL.createObjectURL(new Blob([ilkResim.bayt]));
        parcalar.push(h('div', { class: 'onizleme' }, h('img', { src: url, alt: `${ilkResim.ad} önizlemesi`, stil: { maxWidth: '100%', border: '1px solid var(--kenar)' } })));
      }
    }
    sonucAlani.replaceChildren(h('section', { class: 'adim' }, ...parcalar));
    baslik.scrollIntoView({ behavior: 'smooth', block: 'start' });
    baslik.focus({ preventScroll: true });
  }

  degisti();
  return { ctx, durum };
}
