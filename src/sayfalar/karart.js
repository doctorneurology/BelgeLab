// Karart (gerçek silme): seçilen yerler hem görüntüden hem dosyadan kalıcı olarak silinir.
import { aracKur } from '../ui/arac.js';
import { ocrHazirla } from '../ui/ortam.js';
import { h, kutu, boyamaBekle } from '../ui/yardim.js';
import { hizliGecis } from '../ui/hizli-gecis.js';
import { bolgeSecici } from '../ui/bolge-secici.js';
import { belgeAc } from '../core/render.js';
import { karart, karartmaAra, HAZIR_DESENLER } from '../core/karart.js';
import { ocrKapat } from '../core/ocr.js';
import { dosyaAdiTuret } from '../core/util.js';
import { PdfHatasi } from '../core/hatalar.js';

let sonTerimler = [];

aracKur({
  slug: 'karart',
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Karartılacak yerleri belirleyin',
  dugme: 'Kalıcı olarak karart',
  notlar: [
    kutu('uyari', h('span', {},
      h('b', {}, 'Bu işlem geri alınamaz. '),
      'Karartılan yerdeki yazı ve resim, sayfa yeniden resimlendiği için DOSYADAN gerçekten silinir (siyah kutu çizip altını bırakmak değildir). Özgün dosyanızı saklayın; çıktıyı onunla karıştırmayın.')),
    kutu('bilgi', 'Karartılan sayfalar resme dönüşür; kalan yazı aranabilir bırakılır. Yer imleri, ekler, form alanları ve belge bilgileri (başlık/yazar) yeni dosyaya taşınmaz.'),
  ],
  ayar() {
    const st = { bayt: null, belge: null, aktifId: null };
    const durum = h('div', { 'aria-live': 'polite' });
    const liste = h('div', { class: 'bs-liste' });
    const secici = bolgeSecici({
      onDegisti: () => listele(),
      kutuSinifi: (k) => (k.otomatik ? 'bs-otomatik' : ''),
    });

    // ---- Arama ----
    const terimler = h('textarea', { id: 'kr-terimler', rows: 3, placeholder: 'Her satıra bir ad/sözcük yazın. Örnek:\nAli Veli\n12345678901' });
    const desenler = Object.entries(HAZIR_DESENLER).map(([id, d]) => ({ id, d, girdi: h('input', { type: 'checkbox', id: `kr-d-${id}` }) }));
    const ocrOnay = h('input', { type: 'checkbox', id: 'kr-ocr' });
    const bulDugme = h('button', { type: 'button', onclick: bul }, '🔎 Bul ve işaretle');
    const aramaKutusu = h('details', { class: 'kr-arama', open: true },
      h('summary', {}, 'Metne göre otomatik bul (isteğe bağlı)'),
      h('div', { class: 'alan genis' }, h('label', { for: 'kr-terimler' }, 'Karartılacak sözcükler'), terimler,
        h('small', {}, 'Büyük/küçük harf ve i/İ/ı ayrımı yapılmaz. Bulunan yerler sayfada kırmızı ile işaretlenir; yanlış olanı ✕ ile silebilirsiniz. Satır sonunda tireyle bölünmüş sözcükler bulunamayabilir; onları elle de işaretleyin.')),
      h('div', { class: 'alan genis' }, h('b', {}, 'Kolay seçimler'), ...desenler.map(({ d, id, girdi }) => h('div', { class: 'onay-satiri' }, girdi, h('label', { for: `kr-d-${id}` }, d.ad)))),
      h('div', { class: 'onay-satiri' }, ocrOnay, h('label', { for: 'kr-ocr' }, 'Taranmış (resim) sayfalarda da ara (OCR; yavaştır, hatalı okuyabilir)')),
      h('div', { class: 'eylem' }, bulDugme));

    // ---- Seçenekler ----
    const renk = h('select', { id: 'kr-renk' }, h('option', { value: '#000000' }, 'Siyah'), h('option', { value: '#ffffff' }, 'Beyaz'));
    const dpi = h('select', { id: 'kr-dpi' }, ...[['150', '150 dpi (küçük dosya)'], ['200', '200 dpi (önerilen)'], ['300', '300 dpi (yüksek kalite)']].map(([v, a]) => h('option', { value: v, selected: v === '200' }, a)));
    const aranabilir = h('input', { type: 'checkbox', id: 'kr-aranabilir', checked: true });
    const secenekler = h('div', { class: 'alanlar' },
      h('div', { class: 'alan' }, h('label', { for: 'kr-renk' }, 'Karartma rengi'), renk),
      h('div', { class: 'alan' }, h('label', { for: 'kr-dpi' }, 'Karartılan sayfaların çözünürlüğü'), dpi),
      h('div', { class: 'alan genis' }, h('div', { class: 'onay-satiri' }, aranabilir, h('label', { for: 'kr-aranabilir' }, 'Karartılan sayfalarda kalan yazı aranabilir olsun'))));

    const el = h('div', {}, durum, aramaKutusu, secici.el, liste, h('h3', {}, 'Seçenekler'), secenekler);
    el.hidden = true;

    function listele() {
      const k = secici.kutular();
      if (!k.length) { liste.replaceChildren(h('p', { class: 'soluk' }, 'Henüz karartılacak yer yok. Sayfa üzerinde sürükleyerek çizin ya da yukarıdan metin arayın.')); return; }
      const sayfalar = new Map();
      k.forEach((x) => sayfalar.set(x.sayfa, (sayfalar.get(x.sayfa) ?? 0) + 1));
      liste.replaceChildren(
        h('h3', {}, `Karartılacak yerler (${k.length})`),
        h('ul', { class: 'bs-liste-ul' }, ...[...sayfalar].map(([s, n]) => h('li', {}, `Sayfa ${s}: ${n} yer `, h('button', { type: 'button', class: 'kucuk-dugme', onclick: () => secici.git(s) }, 'Göster')))),
        h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => secici.temizle() }, 'Hepsini temizle'));
    }

    async function bul() {
      const liste1 = terimler.value.split('\n').map((s) => s.trim()).filter(Boolean);
      const terimListesi = [...liste1, ...desenler.filter((x) => x.girdi.checked).map((x) => x.d)];
      if (!terimListesi.length) { durum.replaceChildren(kutu('uyari', 'Önce aranacak bir sözcük yazın ya da bir “kolay seçim” işaretleyin.')); return; }
      bulDugme.disabled = true;
      durum.replaceChildren(h('p', { class: 'soluk' }, 'Aranıyor…'));
      await boyamaBekle();
      try {
        if (ocrOnay.checked) await ocrHazirla();
        const r = await karartmaAra(st.bayt, terimListesi, { ocr: ocrOnay.checked });
        sonTerimler = terimListesi;
        // eski otomatik kutuları yenileriyle değiştir
        secici.kutular().filter((k) => k.otomatik).forEach((k) => secici.sil(k.id));
        r.eslesmeler.forEach((e) => secici.ekle(e.sayfa, e.kutu, { otomatik: true, etiket: e.metin }));
        durum.replaceChildren(r.eslesmeler.length
          ? kutu('basari', `${r.eslesmeler.length} yer bulundu ve işaretlendi. Kutuların yazıyı tam kapattığını sayfalarda kontrol edin; yanlış olanı ✕ ile silin, eksik kalanı elle çizin.`)
          : kutu('uyari', 'Aranan metin bulunamadı. Taranmış belgeyse “OCR ile ara” seçeneğini işaretleyin.'));
        if (r.eslesmeler.length) await secici.git(r.eslesmeler[0].sayfa);
      } catch (e) {
        durum.replaceChildren(kutu('hata', e.message ?? String(e)));
      } finally {
        bulDugme.disabled = false;
        if (ocrOnay.checked) await ocrKapat();
      }
    }

    return {
      el,
      async dosyalarDegisti(dosyalar) {
        const d = dosyalar[0];
        if (!d || d.sifreli || !d.sayfa) { st.belge?.kapat?.(); st.belge = null; el.hidden = true; return; }
        if (st.aktifId === d.id && st.bayt === d.bayt) return;
        st.aktifId = d.id; st.bayt = d.bayt;
        el.hidden = false;
        durum.replaceChildren();
        st.belge?.kapat?.();
        st.belge = await belgeAc(d.bayt);
        await secici.belgeAyarla(st.belge);
        listele();
      },
      oku() {
        const k = secici.kutular();
        if (!k.length) throw new PdfHatasi('Karartılacak yer seçilmedi. Sayfada sürükleyerek bir alan çizin ya da yukarıdan metin arayın.');
        return {
          kutular: k.map(({ sayfa, x0, y0, x1, y1 }) => ({ sayfa, x0, y0, x1, y1 })),
          renk: renk.value, dpi: Number(dpi.value), aranabilir: aranabilir.checked,
        };
      },
    };
  },
  async calistir({ dosyalar, ayarlar: a, ilerleme }) {
    const d = dosyalar[0];
    const r = await karart(d.bayt, { kutular: a.kutular, renk: a.renk, dpi: a.dpi, aranabilirKalsin: a.aranabilir, ilerleme: (k, n) => ilerleme(k, n) });
    if (!r.rapor.dogrulama.gecti) {
      throw new PdfHatasi(`Doğrulama başarısız: karartılan alanda ${r.rapor.dogrulama.kutuIciYazi} yazı parçası kalmış görünüyor. Güvenlik için dosya verilmedi; kutuları biraz büyütüp yeniden deneyin.`);
    }
    // İkinci görüş: arama terimleri çıktıda hâlâ geçiyor mu?
    const ekler = [];
    const bilgiler = [];
    if (sonTerimler.length) {
      try {
        const kalan = await karartmaAra(r.bayt, sonTerimler);
        bilgiler.push(kalan.eslesmeler.length
          ? `Arama denetimi: çıktıda aranan sözcüklerden ${kalan.eslesmeler.length} yer hâlâ bulunuyor. Bunlar sizin sildiğiniz kutular ya da OCR ile okunamayan yerler olabilir; sonucu gözle kontrol edin.`
          : 'Arama denetimi: çıktıda aranan sözcüklerin hiçbiri bulunmuyor.');
      } catch { /* denetim isteğe bağlı */ }
    }
    ekler.push(hizliGecis('Hızlı geçiş', ['sikistir', 'sifre-ekle', 'pdf-word']));
    return {
      ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-karartilmis'), bayt: r.bayt }],
      mesaj: `${r.rapor.kutu} yer karartıldı (${r.rapor.sayfa} sayfa). Doğrulama geçti: karartılan alanlarda yazı kalmadı.`,
      bilgiler, uyarilar: r.uyarilar, ekler,
    };
  },
});
