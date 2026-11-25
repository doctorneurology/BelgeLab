// Hafıza sayfası: üretilen çıktıların tarayıcıda saklanan kopyaları. Sayfa kapansa bile buradan yeniden indirilir.
import { kabukKur } from './ui/kabuk.js';
import { h, indir, boyutMetni, kutu } from './ui/yardim.js';
import { hafiza, depoDurumu } from './core/hafiza.js';
import { ARACLAR } from './araclar.js';

const main = kabukKur({ baslik: 'Hafıza', slug: 'hafiza' });
main.classList.add('hafiza');
const tarihMetni = (t) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const arac = (slug) => ARACLAR.find((a) => a.slug === slug);

const liste = h('div', { class: 'hafiza-liste' });
const ozet = h('p', { class: 'soluk', role: 'status' });
const hepsiniSilDugmesi = h('button', { type: 'button', class: 'kucuk-dugme tehlike', hidden: true, onclick: async () => {
  if (!confirm('Hafızadaki TÜM kayıtlı çıktılar silinecek. Emin misiniz?')) return;
  await hafiza().hepsiniSil();
  yukle();
} }, '🗑 Hepsini sil');

main.append(
  h('div', { class: 'arac-baslik' }, h('h1', {}, h('span', { class: 'ikon', 'aria-hidden': 'true' }, '💾'), ' Hafıza')),
  kutu('bilgi', h('span', {}, 'Ürettiğiniz çıktılar bu tarayıcıda saklanır; sayfayı yanlışlıkla kapatsanız ya da yenileseniz bile buradan yeniden indirebilirsiniz. ',
    h('b', {}, 'Hiçbir yere gönderilmez'), ' — yalnızca bu cihazda, bu tarayıcıda durur. Yalnızca çıktılar saklanır (yüklediğiniz özgün dosyalar değil). Ortak bir bilgisayardaysanız işiniz bitince silin.')),
  h('div', { class: 'eylem' }, hepsiniSilDugmesi),
  ozet, liste);

async function zipIndir(k, dugme) {
  const eski = dugme.textContent;
  dugme.disabled = true; dugme.textContent = 'ZIP hazırlanıyor…';
  try {
    let n = 0;
    for await (const parca of hafiza().zipParcalari(k.id, { zipAdi: (i) => `${k.arac}-${new Date(k.tarih).toISOString().slice(0, 10)}-${i}.zip` })) { indir(parca.bayt, parca.ad); n++; await new Promise((r) => setTimeout(r, 400)); }
    if (!n) dugme.textContent = 'Dosya yok';
    else dugme.textContent = eski;
  } catch (e) { dugme.textContent = 'İndirilemedi'; console.error(e); }
  dugme.disabled = false;
}

function kayitKarti(k) {
  const a = arac(k.arac);
  const durum = k.durum === 'tamam' ? null
    : k.durum === 'eksik' ? h('span', { class: 'rozet uyari' }, 'Eksik (hafıza doldu)')
      : h('span', { class: 'rozet uyari' }, 'Yarım kaldı — kurtarılan dosyalar');
  const dosyaKutusu = h('div', { class: 'hafiza-dosyalar' });
  const zipDugmesi = h('button', { type: 'button', class: 'birincil' }, `⬇ Hepsini ZIP olarak indir (${k.dosyaSayisi})`);
  zipDugmesi.onclick = () => zipIndir(k, zipDugmesi);
  const detay = h('details', { class: 'yd-rapor' }, h('summary', {}, 'Dosyaları göster'), dosyaKutusu);
  detay.addEventListener('toggle', async () => {
    if (!detay.open || dosyaKutusu.childElementCount) return;
    const d = await hafiza().dosyalar(k.id);
    const goster = d.slice(0, 300);
    dosyaKutusu.replaceChildren(h('ul', { class: 'sonuc-dosyalar' }, ...goster.map((m) => h('li', {},
      h('div', { class: 'dosya-bilgi' }, h('b', {}, m.ad), h('small', {}, boyutMetni(m.boyut))),
      h('button', { type: 'button', class: 'kucuk-dugme', onclick: async () => { const f = await hafiza().dosyaAl(k.id, m.sira); indir(f.bayt, f.ad.split('/').pop()); } }, '⬇ İndir')))),
    d.length > goster.length ? h('p', { class: 'soluk' }, `… ve ${d.length - goster.length} dosya daha (ZIP içinde hepsi var).`) : '');
  });
  return h('section', { class: 'adim hafiza-kayit' },
    h('h2', {}, `${a?.ikon ?? '📄'} ${k.aracAd ?? a?.ad ?? k.arac}`, ' ', durum ?? ''),
    h('p', { class: 'soluk' }, `${tarihMetni(k.tarih)} · ${k.baslik ? `${k.baslik} · ` : ''}${k.dosyaSayisi} dosya · ${boyutMetni(k.boyut)}`),
    h('div', { class: 'eylem' },
      k.dosyaSayisi ? zipDugmesi : '',
      h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: async () => { await hafiza().sil(k.id); yukle(); } }, '🗑 Sil')),
    k.dosyaSayisi ? detay : '');
}

async function yukle() {
  let kayitlar;
  try { kayitlar = await hafiza().listele(); } catch (e) {
    liste.replaceChildren(kutu('uyari', `Hafıza bu tarayıcıda kullanılamıyor (${e.message}). Gizli pencerede ya da site verisi engelliyse bu olabilir.`));
    ozet.textContent = '';
    return;
  }
  hepsiniSilDugmesi.hidden = !kayitlar.length;
  const toplam = kayitlar.reduce((t, k) => t + k.boyut, 0);
  const d = await depoDurumu();
  ozet.textContent = kayitlar.length
    ? `${kayitlar.length} kayıt, toplam ${boyutMetni(toplam)}.${d.kota ? ` Tarayıcının bu site için ayırdığı alan: ${boyutMetni(d.kota)} (kullanılan: ${boyutMetni(d.kullanilan ?? 0)}).` : ''}`
    : '';
  liste.replaceChildren(...(kayitlar.length
    ? kayitlar.map(kayitKarti)
    : [h('p', { class: 'soluk' }, 'Henüz kayıtlı çıktı yok. Bir araçla dosya ürettiğinizde burada görünür.')]));
}
yukle();
