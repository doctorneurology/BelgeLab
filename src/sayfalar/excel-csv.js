// CSV ↔ Excel: .xlsx/.xls seçerseniz CSV'ye, .csv/.tsv/.txt seçerseniz Excel'e (.xlsx) çevrilir.
import { aracKur } from '../ui/arac.js';
import { kutu } from '../ui/yardim.js';
import { xlsxCsv, csvXlsx } from '../core/excel-ek.js';
import { dosyaAdiTuret } from '../core/util.js';

const CSV_MI = /\.(csv|tsv|txt)$/i;

aracKur({
  slug: 'excel-csv',
  dosya: { tur: 'tablo' },
  ayarBasligi: 'Dönüştürme ayarları',
  dugme: 'Dönüştür',
  notlar: [kutu('bilgi', 'Excel (.xlsx/.xls) seçerseniz CSV, CSV/TSV/TXT seçerseniz Excel (.xlsx) üretilir. Birden çok dosya ya da klasör seçerseniz hepsi çevrilir. Dosyalar cihazınızdan çıkmaz.')],
  alanlar: [
    { id: 'ayirac', tur: 'secim', etiket: 'Ayırıcı', varsayilan: 'otomatik', secenekler: [{ deger: 'otomatik', ad: 'Otomatik (CSV → Excel) / noktalı virgül (Excel → CSV)' }, { deger: ';', ad: 'Noktalı virgül ;  (Türkiye’de Excel)' }, { deger: ',', ad: 'Virgül ,' }, { deger: '\t', ad: 'Sekme' }] },
    { id: 'sayilar', tur: 'onay', etiket: 'CSV → Excel: sayıya benzeyen hücreleri sayı yap (baştaki sıfırlı değerler metin kalır)', varsayilan: true },
    { id: 'ondalik', tur: 'secim', etiket: 'CSV → Excel: ondalık biçimi', varsayilan: 'tr', secenekler: [{ deger: 'tr', ad: '1.234,5 (Türkçe)' }, { deger: 'en', ad: '1,234.5 (İngilizce)' }] },
    { id: 'bom', tur: 'onay', etiket: 'Excel → CSV: UTF-8 BOM ekle (Excel’de Türkçe karakterler bozulmasın)', varsayilan: true },
  ],
  async calistir({ dosyalar, ayarlar: a }) {
    const d = dosyalar[0];
    if (CSV_MI.test(d.ad)) {
      const r = csvXlsx(d.bayt, d.ad, { ayirac: a.ayirac, sayilar: a.sayilar, ondalik: a.ondalik });
      return { ciktilar: [{ ad: dosyaAdiTuret(d.ad, '', 'xlsx'), bayt: r.bayt }], mesaj: `${r.satir} satır × ${r.sutun} sütun Excel’e aktarıldı.`, uyarilar: r.uyarilar };
    }
    const r = xlsxCsv(d.bayt, d.ad, { ayirac: a.ayirac === 'otomatik' ? ';' : a.ayirac, bom: a.bom });
    return { ciktilar: r.dosyalar.map((x) => ({ ad: x.ad, bayt: x.bayt })), mesaj: `${r.dosyalar.length} CSV dosyası hazır.`, uyarilar: r.uyarilar };
  },
});
