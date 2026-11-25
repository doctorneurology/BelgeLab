// Markdown / HTML editörü: yazdıkça canlı önizleme; .md, .html, PDF ve Word (.docx) olarak indir. Taslak tarayıcıda otomatik saklanır.
import { kabukKur } from '../ui/kabuk.js';
import { h, kutu, indir, boyamaBekle, kullaniciMesaji } from '../ui/yardim.js';
import '../ui/ortam.js';
import { markdownHtmlBelgesi, markdownPdf, markdownDocx } from '../core/markdown-editor.js';
import { htmlPdf } from '../core/html-pdf.js';
import { ARACLAR } from '../araclar.js';

const bilgi = ARACLAR.find((a) => a.slug === 'markdown-editor');
const main = kabukKur({ slug: 'markdown-editor', baslik: bilgi.ad });
const TASLAK = 'belgelab-markdown-taslak';
const ORNEK = `# Başlık

Bu bir **Markdown** örneğidir. *Eğik*, \`kod\` ve [bağlantı](https://ornek.org) yazabilirsiniz.

## Liste ve tablo

- Birinci madde
- İkinci madde
  - İç madde

| Ad | Değer |
|----|-------|
| a  | 1     |
| b  | 2     |

> Alıntı metni burada durur.
`;

const guvenli = { oku: () => { try { return localStorage.getItem(TASLAK); } catch { return null; } }, yaz: (v) => { try { localStorage.setItem(TASLAK, v); } catch { /* depo kapalı */ } } };

let mod = 'md';
const alan = h('textarea', { id: 'me-metin', class: 'me-metin', spellcheck: 'false', 'aria-label': 'Metin', placeholder: '# Başlık\n\nYazmaya başlayın…' });
alan.value = guvenli.oku() ?? ORNEK;
const onizleme = h('iframe', { class: 'me-onizleme', title: 'Canlı önizleme', sandbox: '' }); // betik çalıştırmaz
const durum = h('div', { 'aria-live': 'polite' });
const modSec = h('select', { id: 'me-mod', 'aria-label': 'Biçim' }, h('option', { value: 'md' }, 'Markdown'), h('option', { value: 'html' }, 'HTML'));

const htmlBelge = (k) => (/<html[\s>]/i.test(k) ? k : `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;line-height:1.55;max-width:46em;margin:2em auto;padding:0 1em}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.3em .6em}img{max-width:100%}</style></head><body>${k}</body></html>`);
const belge = () => (mod === 'md' ? markdownHtmlBelgesi(alan.value) : htmlBelge(alan.value));
let zamanlayici = null;
function guncelle() { onizleme.srcdoc = belge(); clearTimeout(zamanlayici); zamanlayici = setTimeout(() => guvenli.yaz(alan.value), 400); }
alan.addEventListener('input', guncelle);
modSec.onchange = () => { mod = modSec.value; wordDugme.disabled = mod !== 'md'; wordDugme.title = mod !== 'md' ? 'Word çıktısı yalnızca Markdown kipinde' : ''; guncelle(); };

const ad = () => (/^#\s+(.+)$/m.exec(alan.value)?.[1] ?? /<title>([^<]+)<\/title>/i.exec(alan.value)?.[1] ?? 'belge').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim().slice(0, 60) || 'belge';
const metinIndir = (m, uz, tur) => indir(new TextEncoder().encode(m), `${ad()}.${uz}`, tur);
async function calis(dugme, is) {
  dugme.disabled = true; durum.replaceChildren(h('p', { class: 'soluk' }, 'Hazırlanıyor…')); await boyamaBekle();
  try { await is(); durum.replaceChildren(); } catch (e) { durum.replaceChildren(kutu('hata', kullaniciMesaji(e))); } finally { dugme.disabled = false; }
}
const pdfDugme = h('button', { type: 'button', class: 'birincil', onclick: () => calis(pdfDugme, async () => { const r = mod === 'md' ? await markdownPdf(alan.value) : await htmlPdf(alan.value); indir(r.bayt, `${ad()}.pdf`); }) }, '⬇ PDF');
const wordDugme = h('button', { type: 'button', onclick: () => calis(wordDugme, async () => indir(await markdownDocx(alan.value), `${ad()}.docx`)) }, '⬇ Word (.docx)');
const dosyaGirdi = h('input', { type: 'file', accept: '.md,.markdown,.txt,.html,.htm', hidden: true, onchange: async () => {
  const f = dosyaGirdi.files[0]; if (!f) return;
  alan.value = await f.text(); mod = /\.html?$/i.test(f.name) ? 'html' : 'md'; modSec.value = mod; wordDugme.disabled = mod !== 'md'; guncelle(); dosyaGirdi.value = '';
} });

main.classList.add('me');
main.append(
  h('div', { class: 'arac-baslik' }, h('h1', {}, h('span', { class: 'ikon', 'aria-hidden': 'true' }, bilgi.ikon), ' ', bilgi.ad)),
  kutu('bilgi', 'Solda yazın, sağda canlı önizlemeyi görün. Taslağınız bu tarayıcıda otomatik saklanır (sayfayı kapatsanız da kaybolmaz). Hiçbir şey sunucuya gönderilmez.'),
  h('div', { class: 'eylem me-arac' },
    modSec, h('button', { type: 'button', onclick: () => dosyaGirdi.click() }, '📂 Dosya aç'), dosyaGirdi,
    h('button', { type: 'button', onclick: () => { alan.value = ORNEK; guncelle(); } }, 'Örnek'),
    h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => { if (!alan.value || confirm('Tüm metin silinecek. Emin misiniz?')) { alan.value = ''; guncelle(); } } }, 'Temizle'),
    h('button', { type: 'button', onclick: () => metinIndir(alan.value, mod === 'md' ? 'md' : 'html') }, mod === 'md' ? '⬇ .md' : '⬇ .html'),
    h('button', { type: 'button', onclick: () => metinIndir(belge(), 'html') }, '⬇ Web sayfası (.html)'),
    pdfDugme, wordDugme),
  durum,
  h('div', { class: 'me-kap' }, alan, onizleme));
guncelle();
