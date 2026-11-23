import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { excelBirlestir, excelAnaliz, analizDisaAktar, turkceDuzelt, tcMi, ilkSayfaSatirlari } from '../src/core/excel.js';

/** aoa → xlsx (ya da xls) baytları */
function dosyaYap(aoa, bicim = 'xlsx') {
  const k = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(k, XLSX.utils.aoa_to_sheet(aoa), 'Sayfa1');
  return new Uint8Array(XLSX.write(k, { type: 'array', bookType: bicim }));
}
const oku = (bayt) => ilkSayfaSatirlari(bayt);

/** HBYS benzeri: n satır üst bilgi + başlık + veri */
function hbys(ustSatir, veri) {
  const ust = Array.from({ length: ustSatir - 1 }, (_, i) => [`Rapor üst bilgisi ${i + 1}`]);
  return dosyaYap([...ust, ['TC KİMLİK NO', 'ADI SOYADI', 'BAŞVURU NO', 'YAŞ', 'RAPOR'], ...veri]);
}

describe('Excel birleştirme', () => {
  it('ilk dosyadan 3, diğerlerinden 4 üst satır atılır; sıra KORUNUR; satırlar kesintisiz birleşir', () => {
    const a = dosyaYap([['u1'], ['u2'], ['u3'], ['12345678901', 'Ali Veli', '100'], ['10987654321', 'Ayşe Yılmaz', '101']]);
    const b = dosyaYap([['x'], ['x'], ['x'], ['x'], ['12345678901', 'Ali Veli', '200'], ['55555555555', 'Can Öz', '201']]);
    const c = dosyaYap([['x'], ['x'], ['x'], ['x'], ['99999999999', 'Zeynep Ak', '300']]);
    const r = excelBirlestir([{ ad: 'a.xlsx', bayt: a }, { ad: 'b.xls', bayt: b }, { ad: 'c.xlsx', bayt: c }]);
    const satirlar = oku(r.bayt);
    expect(r.dosya).toBe(3);
    expect(r.satir).toBe(5);
    expect(satirlar.map((s) => s[1])).toEqual(['Ali Veli', 'Ayşe Yılmaz', 'Ali Veli', 'Can Öz', 'Zeynep Ak']);
    expect(satirlar.map((s) => s[2])).toEqual(['100', '101', '200', '201', '300']);
    expect(r.onizleme.length).toBe(5);
  });

  it('atlanacak satır sayıları ayarlanabilir; dosyada yeterli satır yoksa uyarı verir', () => {
    const a = dosyaYap([['b1'], ['v1'], ['v2']]);
    const b = dosyaYap([['b1'], ['v3']]);
    const r = excelBirlestir([{ ad: 'a.xlsx', bayt: a }, { ad: 'kisa.xlsx', bayt: b }], { ilkAtla: 1, digerAtla: 2 });
    expect(oku(r.bayt).map((s) => s[0])).toEqual(['v1', 'v2']);
    expect(r.uyarilar.join(' ')).toContain('“kisa.xlsx”');
    expect(() => excelBirlestir([{ ad: 'a', bayt: a }], { ilkAtla: -1 })).toThrow(/0 ile 1000/);
  });

  it('bozuk Türkçe karakterler düzeltilir; sayılar ve baştaki sıfırlar metin olarak korunur', () => {
    expect(turkceDuzelt('ÐÝÞ ðýþ')).toBe('ĞİŞ ğış');
    const a = dosyaYap([['x'], ['x'], ['x'], ['ÝSMAÝL ÞAHÝN', 0o7, '00123']]);
    const r = excelBirlestir([{ ad: 'a.xlsx', bayt: a }]);
    expect(oku(r.bayt)[0]).toEqual(['İSMAİL ŞAHİN', '7', '00123']);
  });

  it('dosya sırası = verilen sıra (okuma bitiş sırası değil)', () => {
    const k = (ad, n) => ({ ad, bayt: dosyaYap([['x'], ['x'], ['x'], ['x'], [ad, n]]) });
    const r = excelBirlestir([{ ad: 'ilk', bayt: dosyaYap([['x'], ['x'], ['x'], ['ilk', 1]]) }, k('ikinci', 2), k('ucuncu', 3)]);
    expect(oku(r.bayt).map((s) => s[0])).toEqual(['ilk', 'ikinci', 'ucuncu']);
  });

  it('farklı sütun sayısı uyarılır; veri hiç yoksa anlaşılır hata verilir; bozuk dosya adıyla bildirilir', () => {
    const a = dosyaYap([['x'], ['x'], ['x'], ['a', 'b', 'c']]);
    const b = dosyaYap([['x'], ['x'], ['x'], ['x'], ['a', 'b']]);
    expect(excelBirlestir([{ ad: 'a', bayt: a }, { ad: 'b', bayt: b }]).uyarilar.join(' ')).toContain('sütun sayısı farklı');
    expect(() => excelBirlestir([{ ad: 'a', bayt: dosyaYap([['x']]) }])).toThrow(/veri satırı bulunamadı/);
    expect(() => excelBirlestir([])).toThrow(/en az bir Excel/);
    expect(() => excelBirlestir([{ ad: 'bozuk.xlsx', bayt: new Uint8Array([1, 2, 3, 4, 5]) }, { ad: 'a', bayt: a }])).toThrow(/bozuk\.xlsx/);
  });
});

describe('Excel analiz (hasta başvuru)', () => {
  const d1 = hbys(1, [
    ['12345678901', 'Ali Veli', '100', '40', ''],
    ['12345678901', 'Ali Veli', '105', '40', 'Rapor A'],
    ['10987654321', 'Ayşe Yılmaz', '101', '35', ''],
  ]);
  const d2 = dosyaYap([
    ['ADI SOYADI', 'BAŞVURU NO', 'TC KİMLİK NO', 'RAPOR'], // sütun SIRASI farklı
    ['Ali Veli', '200', '12345678901', 'Rapor B'],
    ['Can Öz', '201', '55555555555', ''],
    ['', '', '', ''],
  ]);

  it('sütun sırası fark etmeden TC/ad/başvuru bulunur; kişiler tekilleşir; dosya başına sayılar doğru', () => {
    const s = excelAnaliz([{ ad: 'ocak.xlsx', bayt: d1 }, { ad: 'subat.xls', bayt: d2 }]);
    expect(s.dosyaAdlari).toEqual(['ocak', 'subat']);
    expect(s.hastalar.length).toBe(3);
    expect(s.toplamKayit).toBe(5);
    const ali = s.hastalar.find((h) => h.ad === 'Ali Veli');
    expect(ali.toplam).toBe(3);
    expect(ali.sayilar).toEqual({ ocak: 2, subat: 1 });
    expect(ali.dosyaSayisi).toBe(2);
    expect(ali.enBuyukBasvuru).toBe('200'); // en büyük başvuru no
    expect(ali.rapor).toBe('Rapor B'); // o başvurunun raporu
    expect(s.hastalar[0].ad).toBe('Ali Veli'); // toplama göre azalan
    expect(s.hastalar.filter((h) => h.dosyaSayisi > 1).length).toBe(1); // çapraz varlık
    expect(s.raporVar).toBe(true);
    expect(s.yasVar).toBe(true);
  });

  it('başlığın üstünde rapor başlığı/tarih satırları olsa da başlık satırı otomatik bulunur', () => {
    const d = dosyaYap([['HBYS Hasta Listesi'], ['Tarih: 01.01.2026'], [], ['ADI SOYADI', 'BAŞVURU NO', 'TC KİMLİK NO'], ['Ali Veli', '7', '12345678901'], ['Ali Veli', '9', '12345678901']]);
    const s = excelAnaliz([{ ad: 'ocak.xlsx', bayt: d }]);
    expect(s.hastalar.length).toBe(1);
    expect(s.hastalar[0]).toMatchObject({ ad: 'Ali Veli', toplam: 2, enBuyukBasvuru: '9', tc: '12345678901' });
    expect(s.uyarilar).toEqual([]);
  });

  it('maskeli TC (12*********34) tanınır; TC sütununda ad varsa ad olarak alınır', () => {
    expect(tcMi('12*********34')).toBe(true);
    expect(tcMi('12345678901')).toBe(true);
    expect(tcMi('Ali Veli')).toBe(false);
    const d = dosyaYap([['TC', 'BAŞVURU'], ['Veli Can', '5'], ['12*********34', '6']]);
    const s = excelAnaliz([{ ad: 'd.xlsx', bayt: d }]);
    expect(s.hastalar.map((h) => [h.tc, h.ad]).sort()).toEqual([['', 'Veli Can'], ['12*********34', '']]);
  });

  it('tanınmayan başlıklı dosya sessizce yutulmaz: uyarı verir; boş TC+ad satırları sayılır', () => {
    const kotu = dosyaYap([['Foo', 'Bar'], ['1', '2']]);
    const s = excelAnaliz([{ ad: 'ocak.xlsx', bayt: d1 }, { ad: 'kotu.xlsx', bayt: kotu }, { ad: 'subat.xls', bayt: d2 }]);
    expect(s.uyarilar.join(' ')).toContain('“kotu.xlsx”: TC kimlik ya da ad soyad sütunu bulunamadı');
    expect(s.uyarilar.join(' ')).toContain('“subat.xls”: 1 satırda TC ve ad soyad birlikte boş');
  });

  it('dışa aktarım: sütunlar ve değerler doğru; çapraz varlık filtresi ve rapor seçeneği çalışır', () => {
    const s = excelAnaliz([{ ad: 'ocak.xlsx', bayt: d1 }, { ad: 'subat.xls', bayt: d2 }]);
    const tam = analizDisaAktar(s);
    const kitap = XLSX.read(tam.bayt, { type: 'array' });
    const satirlar = XLSX.utils.sheet_to_json(kitap.Sheets.Hasta_Basvuru_Ozet);
    expect(Object.keys(satirlar[0])).toEqual(['TC_KIMLIK', 'ADI_SOYADI', 'BASVURU_NO', 'ocak (Başvuru)', 'subat (Başvuru)', 'TOPLAM BAŞVURU', 'YASI', 'RAPOR']);
    expect(satirlar[0]).toMatchObject({ ADI_SOYADI: 'Ali Veli', 'ocak (Başvuru)': 2, 'subat (Başvuru)': 1, 'TOPLAM BAŞVURU': 3, RAPOR: 'Rapor B' });
    expect(tam.satir).toBe(3);
    expect(analizDisaAktar(s, { sadeceCapraz: true }).satir).toBe(1);
    const raporsuz = XLSX.utils.sheet_to_json(XLSX.read(analizDisaAktar(s, { rapor: false }).bayt, { type: 'array' }).Sheets.Hasta_Basvuru_Ozet);
    expect('RAPOR' in raporsuz[0]).toBe(false);
    // tek dosyada dosya sütunları olmaz
    const tek = XLSX.utils.sheet_to_json(XLSX.read(analizDisaAktar(excelAnaliz([{ ad: 'ocak.xlsx', bayt: d1 }])).bayt, { type: 'array' }).Sheets.Hasta_Basvuru_Ozet);
    expect(Object.keys(tek[0]).some((k) => k.includes('(Başvuru)'))).toBe(false);
  });

  it('veri yokken dışa aktarım anlaşılır hata verir', () => {
    const s = excelAnaliz([{ ad: 'ocak.xlsx', bayt: d1 }]);
    expect(() => analizDisaAktar(s, { sadeceCapraz: true })).toThrow(/Dışa aktarılacak/);
  });
});
