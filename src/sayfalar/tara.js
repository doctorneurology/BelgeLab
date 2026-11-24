// PDF'e tara: kamera/galeri fotoğraflarını iyileştirip tek PDF yapar (telefonda doğrudan kamera, bilgisayarda web kamerası).
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { taraPdf, MODLAR } from '../core/tara.js';
import { pdfOcr, ocrKapat } from '../core/ocr.js';

aracKur({
  slug: 'tara',
  dosya: { tur: 'resim', coklu: true, enAz: 1 },
  ayarBasligi: 'Tarama ayarları',
  dugme: 'PDF yap',
  notlar: [
    kutu('bilgi', 'Fotoğrafları yukarıdan seçin ya da aşağıdan kamerayla çekin; sıra listedeki sıradır (↑ ↓). Hiçbir görüntü cihazınızdan çıkmaz. Belge kenarını otomatik bulma/perspektif düzeltme yoktur: belgeyi karenin içini doldurur şekilde çekin.'),
  ],
  ayar(ctx) {
    // Telefon kamerası (dosya seçici kamera uygulamasını açar)
    const kameraGirdi = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true, id: 'tara-kamera' });
    kameraGirdi.addEventListener('change', () => { ctx.dosyaEkle([...kameraGirdi.files]); kameraGirdi.value = ''; });
    const telefon = h('button', { type: 'button', onclick: () => kameraGirdi.click() }, '📱 Telefon kamerasıyla çek');

    // Bilgisayar web kamerası
    const video = h('video', { autoplay: true, playsinline: true, muted: true, stil: { maxWidth: '100%', borderRadius: '10px', background: '#000' }, hidden: true });
    const durum = h('p', { class: 'soluk', 'aria-live': 'polite' });
    let akis = null;
    const kapat = () => { akis?.getTracks().forEach((t) => t.stop()); akis = null; video.srcObject = null; video.hidden = true; cek.hidden = true; kapatDugme.hidden = true; ac.hidden = false; };
    const ac = h('button', { type: 'button', onclick: async () => {
      try {
        akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        video.srcObject = akis; video.hidden = false; cek.hidden = false; kapatDugme.hidden = false; ac.hidden = true; durum.textContent = '';
      } catch (e) { durum.textContent = `Kamera açılamadı: ${e?.message ?? e}. Tarayıcıdan kamera izni verdiğinizden emin olun.`; }
    } }, '🎥 Web kamerasını aç');
    const cek = h('button', { type: 'button', class: 'birincil', hidden: true, onclick: () => {
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      c.toBlob((b) => { if (b) ctx.dosyaEkle([new File([b], `tarama-${Date.now()}.jpg`, { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92);
    } }, '📸 Çek ve listeye ekle');
    const kapatDugme = h('button', { type: 'button', hidden: true, onclick: kapat }, 'Kamerayı kapat');
    window.addEventListener('pagehide', kapat);

    const mod = h('select', { id: 'tara-mod' }, ...Object.entries(MODLAR).map(([k, a]) => h('option', { value: k, selected: k === 'kontrast' }, a)));
    const boyut = h('select', { id: 'tara-boyut' }, ...[['A4', 'A4'], ['A5', 'A5'], ['Letter', 'Letter'], ['resim', 'Resim boyutunda']].map(([v, a]) => h('option', { value: v }, a)));
    const don = h('select', { id: 'tara-don' }, ...[['0', 'Döndürme yok'], ['90', '90° sağa'], ['180', '180°'], ['270', '90° sola']].map(([v, a]) => h('option', { value: v }, a)));
    const ocr = h('input', { type: 'checkbox', id: 'tara-ocr' });
    const el = h('div', {},
      h('div', { class: 'eylem' }, telefon, ac, cek, kapatDugme), kameraGirdi, video, durum,
      h('div', { class: 'alanlar', stil: { marginTop: '10px' } },
        h('div', { class: 'alan' }, h('label', { for: 'tara-mod' }, 'İyileştirme'), mod),
        h('div', { class: 'alan' }, h('label', { for: 'tara-boyut' }, 'Sayfa boyutu'), boyut),
        h('div', { class: 'alan' }, h('label', { for: 'tara-don' }, 'Tüm fotoğrafları döndür'), don),
        h('div', { class: 'alan genis' }, h('div', { class: 'onay-satiri' }, ocr, h('label', { for: 'tara-ocr' }, 'Yazıyı oku (OCR): PDF aranabilir ve kopyalanabilir olsun')))));
    return { el, oku: () => ({ mod: mod.value, boyut: boyut.value, don: Number(don.value), ocr: ocr.checked }) };
  },
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const r = await taraPdf(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt, don: a.don })), { mod: a.mod, sayfaBoyutu: a.boyut, ilerleme: (k, n) => ilerleme(k, n) });
    let bayt = r.bayt;
    const uyarilar = [...r.uyarilar];
    let mesaj = `${r.sayfaSayisi} sayfalık PDF hazır.`;
    if (a.ocr) {
      await ocrHazirla();
      try {
        const o = await pdfOcr(bayt, { dpi: 300, ilerleme: (k, n) => ilerleme(k, n) });
        bayt = o.bayt; uyarilar.push(...o.uyarilar); mesaj += ' Yazı okundu; PDF aranabilir.';
      } finally { await ocrKapat(); }
    }
    return { ciktilar: [{ ad: 'tarama.pdf', bayt }], mesaj, uyarilar, ekler: [hizliGecis('Hızlı geçiş', ['sikistir', 'kirp', 'imza-metin', 'sifre-ekle'])] };
  },
});
