// Yer imleri (içindekiler): görüntüle, düzenle, başlıklardan otomatik öner, sil.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { yerimleriOku, yerimleriYaz, yerimiMetniCoz, yerimiMetni, basliklardanYerimi } from '../core/yer-imi.js';
import { pdfAc } from '../core/belge.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'yer-imi',
  toplu: false,
  dosya: { tur: 'pdf' },
  ayarBasligi: 'Yer imleri',
  dugme: 'Yer imlerini kaydet',
  notlar: [kutu('bilgi', 'Her satır bir yer imidir: düzey | sayfa | başlık  (örn. “1 | 5 | Giriş”, alt başlık için “2 | 7 | Yöntem”). Mevcut yer imlerinin YERİNE yazılır; listeyi boşaltıp kaydederseniz tüm yer imleri silinir.')],
  ayar() {
    const kutuMetin = h('textarea', { id: 'yi-metin', rows: 14, spellcheck: 'false', placeholder: '1 | 1 | Giriş\n2 | 3 | Yöntem\n1 | 10 | Sonuçlar', stil: { width: '100%', fontFamily: 'monospace' } });
    const durum = h('div', { 'aria-live': 'polite' });
    let bayt = null;
    const yukle = async () => {
      if (!bayt) return;
      durum.replaceChildren(h('p', { class: 'soluk' }, 'Yer imleri okunuyor…'));
      try { const l = await yerimleriOku(bayt); kutuMetin.value = yerimiMetni(l.map((y) => ({ ...y, sayfa: y.sayfa ?? 0 }))); durum.replaceChildren(h('p', { class: 'soluk' }, l.length ? `${l.length} mevcut yer imi yüklendi.` : 'Bu belgede yer imi yok.')); }
      catch (e) { durum.replaceChildren(kutu('uyari', e.message ?? String(e))); }
    };
    const oner = async () => {
      if (!bayt) return;
      durum.replaceChildren(h('p', { class: 'soluk' }, 'Başlıklar aranıyor (yazı boyutundan tahmin edilir)…'));
      try {
        const l = await basliklardanYerimi(bayt, { enCokDuzey: 3 });
        if (!l.length) { durum.replaceChildren(kutu('uyari', 'Başlık bulunamadı (belge taranmış ya da başlıklar gövdeyle aynı boyutta olabilir). Elle yazabilirsiniz.')); return; }
        kutuMetin.value = yerimiMetni(l);
        durum.replaceChildren(kutu('bilgi', `${l.length} başlık önerildi. Yazı boyutundan TAHMİN edildi; kaydetmeden önce listeyi gözden geçirip yanlışları silin.`));
      } catch (e) { durum.replaceChildren(kutu('uyari', e.message ?? String(e))); }
    };
    const el = h('div', {},
      h('div', { class: 'eylem' },
        h('button', { type: 'button', onclick: yukle }, 'Mevcut yer imlerini yükle'),
        h('button', { type: 'button', onclick: oner }, 'Başlıklardan otomatik öner'),
        h('button', { type: 'button', class: 'kucuk-dugme tehlike', onclick: () => { kutuMetin.value = ''; durum.replaceChildren(h('p', { class: 'soluk' }, 'Liste boşaltıldı; kaydederseniz tüm yer imleri silinir.')); } }, 'Hepsini sil')),
      h('label', { for: 'yi-metin' }, 'Yer imi listesi'), kutuMetin, durum);
    return {
      el,
      async dosyalarDegisti(dosyalar) { bayt = dosyalar[0]?.sifreli ? null : (dosyalar[0]?.bayt ?? null); kutuMetin.value = ''; if (bayt) await yukle(); },
      oku: () => ({ metin: kutuMetin.value }),
    };
  },
  async calistir({ dosyalar, ayarlar }) {
    const d = dosyalar[0];
    const doc = await pdfAc(d.bayt);
    const liste = yerimiMetniCoz(ayarlar.metin, doc.getPageCount());
    const r = await yerimleriYaz(d.bayt, liste);
    return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '-yer-imli'), bayt: r.bayt }], mesaj: r.adet ? `${r.adet} yer imi yazıldı.` : 'Tüm yer imleri silindi.' };
  },
});
