// Toplu işleme çekirdeği: birçok dosyayı SIRAYLA, aynı ayarlarla işler. Dosya sayısı SINIRI YOKTUR.
//  - Bir dosya hata verirse atlanır (nedeni kaydedilir), diğerleri işlenmeye devam eder.
//  - Çıktılar, bellek şişmesin diye en çok `parcaSiniri` baytlık ZIP parçaları hâlinde toplanır.
//  - Aynı adlı çıktılar "(2)", "(3)" ile ayrılır; bir dosyadan birden çok çıktı çıkarsa dosya adıyla bir klasöre konur.
//  - İptal edilebilir (iptalMi() true dönünce kalan dosyalar işlenmez).

import { zipOlustur } from './zip.js';

const temel = (ad) => String(ad).replace(/\.[^.\\/]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'dosya';

/**
 * @param dosyalar   [{ad, ...}]
 * @param islem      async (dosya, indeks) => ({ ciktilar:[{ad,bayt}], uyarilar?:string[], mesaj? })  — hata fırlatabilir
 * @param secenek.atla        (dosya) => string|null   dosya atlanacaksa nedeni
 * @param secenek.hataMetni   (hata) => string
 * @param secenek.ilerleme    (tamamlanan, toplam, dosya) => void  (her dosyadan ÖNCE çağrılır)
 * @param secenek.iptalMi     () => boolean
 * @param secenek.dosyaBitti  async (dosya, ciktilar:[{ad,bayt}]) => void  — her dosya BİTER BİTMEZ çağrılır (ör. hafızaya kaydetmek için); hatası işlemi durdurmaz
 * @param secenek.parcaSiniri ZIP parçası en çok bu kadar bayt (varsayılan 200 MB)
 * @param secenek.zipAdi      (parcaNo) => string
 * @returns {{zipler:{ad,bayt}[], sonuclar:object[], uyarilar:{metin,dosyalar:string[]}[], toplamCikti:number, basarili:number, hatali:number, iptal:boolean}}
 */
export async function topluIsle(dosyalar, islem, {
  atla = () => null, dosyaBitti, hataMetni = (e) => e?.message ?? String(e), ilerleme, iptalMi = () => false,
  parcaSiniri = 200 * 1024 * 1024, zipAdi = (n) => `toplu-${n}.zip`,
} = {}) {
  const n = dosyalar.length;
  const sonuclar = [];
  const uyariHaritasi = new Map();
  const kullanilan = new Set();
  const zipler = [];
  let bekleyen = [], bekleyenBoyut = 0, toplamCikti = 0, iptal = false;

  const tekAd = (ad) => {
    let a = ad, k = 2;
    const nokta = ad.lastIndexOf('.');
    while (kullanilan.has(a)) { a = nokta > ad.lastIndexOf('/') + 1 ? `${ad.slice(0, nokta)} (${k})${ad.slice(nokta)}` : `${ad} (${k})`; k++; }
    kullanilan.add(a);
    return a;
  };
  const zipYaz = () => {
    if (!bekleyen.length) return;
    zipler.push({ ad: zipAdi(zipler.length + 1), bayt: zipOlustur(bekleyen) });
    bekleyen = []; bekleyenBoyut = 0;
  };

  for (let i = 0; i < n; i++) {
    if (iptalMi()) { iptal = true; break; }
    const d = dosyalar[i];
    await ilerleme?.(i, n, d);
    const neden = atla(d);
    if (neden) { sonuclar.push({ ad: d.ad, ok: false, neden }); continue; }
    try {
      const r = await islem(d, i);
      const cikti = r?.ciktilar ?? [];
      const klasor = cikti.length > 1 ? `${temel(d.ad)}/` : '';
      let boyut = 0;
      const adli = [];
      for (const c of cikti) {
        const ad = tekAd(`${klasor}${c.ad}`);
        adli.push({ ad, bayt: c.bayt });
        bekleyen.push({ ad, bayt: c.bayt });
        bekleyenBoyut += c.bayt.length; boyut += c.bayt.length; toplamCikti++;
      }
      for (const u of r?.uyarilar ?? []) { if (!uyariHaritasi.has(u)) uyariHaritasi.set(u, new Set()); uyariHaritasi.get(u).add(d.ad); }
      sonuclar.push({ ad: d.ad, ok: true, adet: cikti.length, boyut, mesaj: r?.mesaj });
      if (dosyaBitti && adli.length) { try { await dosyaBitti(d, adli); } catch { /* kaydetme hatası işlemi durdurmaz */ } }
      if (bekleyenBoyut >= parcaSiniri) zipYaz();
    } catch (e) {
      sonuclar.push({ ad: d.ad, ok: false, neden: hataMetni(e) });
    }
  }
  zipYaz();
  const basarili = sonuclar.filter((s) => s.ok).length;
  return {
    zipler, sonuclar, toplamCikti, iptal, basarili, hatali: sonuclar.length - basarili,
    uyarilar: [...uyariHaritasi].map(([metin, d]) => ({ metin, dosyalar: [...d] })),
  };
}
