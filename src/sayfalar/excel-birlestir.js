// Excel birleştir: birkaç Excel dosyasını tek dosyada toplar (üst bilgi satırlarını atarak). Dosyalar cihazdan çıkmaz.
import { aracKur } from '../ui/arac.js';
import { h, kutu } from '../ui/yardim.js';
import { excelBirlestir } from '../core/excel.js';
import { dosyaAdiTuret } from '../core/util.js';

aracKur({
  slug: 'excel-birlestir',
  dosya: { tur: 'excel', coklu: true, enAz: 1 },
  ayarBasligi: 'Birleştirme ayarları',
  dugme: 'Birleştir',
  notlar: [kutu('bilgi', h('span', {},
    'Dosyalar, listedeki SIRAYLA birleştirilir (↑ ↓ düğmeleriyle sırayı değiştirebilirsiniz). Her dosyanın yalnızca ilk sayfası alınır. ',
    'Aşağıdaki sayıda üst satır (rapor başlığı gibi) her dosyadan atılır; atlanan satırlardan sonra gelen tüm dolu satırlar eklenir.'))],
  alanlar: [
    { id: 'ilkAtla', tur: 'sayi', etiket: 'İlk dosyadan atlanacak üst satır sayısı', varsayilan: 3, min: 0, max: 1000, adim: 1 },
    { id: 'digerAtla', tur: 'sayi', etiket: 'Diğer dosyalardan atlanacak üst satır sayısı', varsayilan: 4, min: 0, max: 1000, adim: 1 },
    { id: 'ad', tur: 'metin', etiket: 'Çıktı dosya adı', varsayilan: 'HBYS_Birlestirilmis_Dosyalar', aciklama: '.xlsx kendiliğinden eklenir.' },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const r = excelBirlestir(dosyalar.map((d) => ({ ad: d.ad, bayt: d.bayt })), { ilkAtla: Math.round(a.ilkAtla), digerAtla: Math.round(a.digerAtla) });
    const ad = dosyaAdiTuret(String(a.ad || 'HBYS_Birlestirilmis_Dosyalar').trim() || 'HBYS_Birlestirilmis_Dosyalar', '', 'xlsx').replace(/\.xlsx\.xlsx$/i, '.xlsx');
    const sutun = Math.min(r.sutun, 8);
    const tablo = h('div', { class: 'tablo-kap' }, h('table', { class: 'yd-tablo' },
      h('tbody', {}, ...r.onizleme.map((satir) => h('tr', {}, ...Array.from({ length: sutun }, (_, i) => h('td', {}, satir[i] ?? '')))))));
    return {
      ciktilar: [{ ad, bayt: r.bayt }],
      mesaj: `${r.dosya} dosya birleştirildi: toplam ${r.satir} satır, ${r.sutun} sütun.`,
      uyarilar: r.uyarilar,
      ekler: [h('details', { class: 'yd-rapor', open: true }, h('summary', {}, `Önizleme (ilk ${r.onizleme.length} satır${r.sutun > sutun ? `, ilk ${sutun} sütun` : ''})`), tablo)],
    };
  },
});
