// Çıktı hafızası: üretilen dosyalar tarayıcının kendi deposuna (IndexedDB) kaydedilir.
// Sayfa yanlışlıkla kapansa, yenilense ya da bilgisayar yeniden başlasa bile "Hafıza" sayfasından yeniden indirilebilir.
//
// GİZLİLİK: Dosyalar yalnızca BU tarayıcıda, bu cihazda saklanır; hiçbir yere gönderilmez. Ortak bilgisayarda
// işiniz bitince "Hafıza" sayfasından silin. Yalnızca ÇIKTILAR saklanır, yüklediğiniz özgün dosyalar saklanmaz.
//
// Yapı:  kayitlar (bir işlem = bir kayıt)  ·  dosyalar (ad/boyut bilgisi)  ·  icerik (dosyanın baytları; liste çekerken yüklenmesin diye ayrı).
// Toplu işlemde her dosyanın çıktısı BİTER BİTMEZ kaydedilir; sayfa ortada kapanırsa o ana kadarki işler kurtarılır.
// Depo (IndexedDB) yoksa ya da dolduysa işlem hata vermeden sürer; arayüz "kaydedilemedi" der.

import { zipOlustur } from './zip.js';

const DB_AD = 'belgelab-hafiza';
const SURUM = 1;

/** Hafıza kullanılamıyor (gizli pencere, depo kapalı) ya da doldu. */
export class HafizaHatasi extends Error {
  constructor(mesaj, kod = 'HAFIZA') { super(mesaj); this.name = 'HafizaHatasi'; this.kod = kod; }
}

function hataCevir(e) {
  if (e instanceof HafizaHatasi) return e;
  if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '')) return new HafizaHatasi('Tarayıcı deposunda yer kalmadı.', 'DOLU');
  return new HafizaHatasi(`Hafıza kullanılamadı: ${e?.message ?? e}`);
}

/** IndexedDB'yi küçük, söz (promise) tabanlı bir arayüze sarar. `idb` testlerde başka bir uygulamayla değiştirilebilir. */
export function idbDeposu(idb = globalThis.indexedDB) {
  let dbSozu = null;
  const ac = () => {
    if (!idb) return Promise.reject(new HafizaHatasi('Bu tarayıcıda hafıza (IndexedDB) yok.', 'YOK'));
    dbSozu ??= new Promise((coz, red) => {
      const istek = idb.open(DB_AD, SURUM);
      istek.onupgradeneeded = () => {
        const db = istek.result;
        db.createObjectStore('kayitlar', { keyPath: 'id' });
        const d = db.createObjectStore('dosyalar', { keyPath: ['kayitId', 'sira'] });
        d.createIndex('kayit', 'kayitId');
        db.createObjectStore('icerik'); // anahtar: [kayitId, sira]
      };
      istek.onsuccess = () => coz(istek.result);
      istek.onerror = () => { dbSozu = null; red(hataCevir(istek.error)); };
      istek.onblocked = () => { dbSozu = null; red(new HafizaHatasi('Hafıza başka bir sekme tarafından kilitli.')); };
    });
    return dbSozu;
  };
  /** @param depolar ad listesi, @param kip 'readonly'|'readwrite', @param fn (...depolar) => istek|istek[]|undefined */
  const islem = async (depolar, kip, fn) => {
    const db = await ac();
    return new Promise((coz, red) => {
      let tx;
      try { tx = db.transaction(depolar, kip); } catch (e) { red(hataCevir(e)); return; }
      let sonuc;
      tx.oncomplete = () => coz(sonuc);
      tx.onerror = () => red(hataCevir(tx.error));
      tx.onabort = () => red(hataCevir(tx.error));
      try {
        const r = fn(...depolar.map((d) => tx.objectStore(d)), tx);
        if (r && 'onsuccess' in r) r.onsuccess = () => { sonuc = r.result; };
      } catch (e) { try { tx.abort(); } catch { /* kapalı */ } red(hataCevir(e)); }
    });
  };
  return {
    ekleKayit: (k) => islem(['kayitlar'], 'readwrite', (s) => s.put(k)),
    kayitAl: (id) => islem(['kayitlar'], 'readonly', (s) => s.get(id)),
    kayitlar: () => islem(['kayitlar'], 'readonly', (s) => s.getAll()),
    dosyaEkle: (kayit, meta, bayt) => islem(['kayitlar', 'dosyalar', 'icerik'], 'readwrite', (k, d, i) => {
      d.put(meta); i.put(bayt, [meta.kayitId, meta.sira]); k.put(kayit);
    }),
    dosyalar: (id) => islem(['dosyalar'], 'readonly', (s) => s.index('kayit').getAll(id)),
    icerik: (id, sira) => islem(['icerik'], 'readonly', (s) => s.get([id, sira])),
    sil: (id) => islem(['kayitlar', 'dosyalar', 'icerik'], 'readwrite', (k, d, i) => {
      k.delete(id);
      const aralik = IDBKeyRange.bound([id, -Infinity], [id, Infinity]);
      d.delete(aralik); i.delete(aralik);
    }),
    hepsiniSil: () => islem(['kayitlar', 'dosyalar', 'icerik'], 'readwrite', (k, d, i) => { k.clear(); d.clear(); i.clear(); }),
  };
}

const yeniId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Hafıza işlemlerini kurar. `depo` verilmezse IndexedDB kullanılır (testlerde bellek içi depo verilir).
 */
export function hafizaKur(depo = idbDeposu()) {
  return {
    /**
     * Yeni bir kayıt açar ve dosya ekleme/bitirme işlevlerini verir.
     * @param bilgi { arac:'pdf-markdown', aracAd:'PDF → Markdown', baslik?:string, toplu?:boolean }
     */
    async baslat(bilgi) {
      const kayit = { id: yeniId(), tarih: Date.now(), durum: 'suruyor', dosyaSayisi: 0, boyut: 0, ...bilgi };
      await depo.ekleKayit(kayit);
      let sira = 0;
      let kuyruk = Promise.resolve(); // eklemeler sıralı yazılsın
      const ekle = (c) => {
        const s = sira++;
        const gorev = kuyruk.catch(() => {}).then(async () => {
          kayit.dosyaSayisi++; kayit.boyut += c.bayt.length;
          try { await depo.dosyaEkle({ ...kayit }, { kayitId: kayit.id, sira: s, ad: c.ad, boyut: c.bayt.length }, c.bayt); } catch (e) { kayit.dosyaSayisi--; kayit.boyut -= c.bayt.length; throw hataCevir(e); }
        });
        kuyruk = gorev;
        return gorev;
      };
      return {
        id: kayit.id,
        /** Bir çıktı dosyasını kaydeder ({ad, bayt}). Yer yoksa HafizaHatasi fırlatır. */
        ekle,
        async bitir(ek = {}) { await kuyruk.catch(() => {}); Object.assign(kayit, ek, { durum: 'tamam' }); await depo.ekleKayit({ ...kayit }); },
        /** Kayıt yer yetmediği için eksik kaldı. */
        async eksik(neden) { await kuyruk.catch(() => {}); Object.assign(kayit, { durum: 'eksik', not: neden }); try { await depo.ekleKayit({ ...kayit }); } catch { /* yer yok */ } },
      };
    },
    /** En yeni önce. */
    async listele() { return (await depo.kayitlar()).sort((a, b) => b.tarih - a.tarih); },
    async dosyalar(id) { return (await depo.dosyalar(id)).sort((a, b) => a.sira - b.sira); },
    async dosyaAl(id, sira) {
      const meta = (await depo.dosyalar(id)).find((d) => d.sira === sira);
      const bayt = await depo.icerik(id, sira);
      if (!meta || !bayt) throw new HafizaHatasi('Dosya hafızada bulunamadı.', 'YOK');
      return { ad: meta.ad, bayt: bayt instanceof Uint8Array ? bayt : new Uint8Array(bayt) };
    },
    /**
     * Kaydın tüm dosyalarını, en çok `parcaSiniri` baytlık ZIP parçaları olarak verir (bellek şişmesin diye parça parça).
     * @returns {AsyncGenerator<{ad:string, bayt:Uint8Array}>}
     */
    async *zipParcalari(id, { parcaSiniri = 200 * 1024 * 1024, zipAdi = (n) => `belgelab-${n}.zip` } = {}) {
      const liste = await this.dosyalar(id);
      let bekleyen = [], boyut = 0, no = 0;
      for (const m of liste) {
        const bayt = await depo.icerik(id, m.sira);
        if (!bayt) continue;
        bekleyen.push({ ad: m.ad, bayt: bayt instanceof Uint8Array ? bayt : new Uint8Array(bayt) });
        boyut += m.boyut;
        if (boyut >= parcaSiniri) { yield { ad: zipAdi(++no), bayt: zipOlustur(bekleyen) }; bekleyen = []; boyut = 0; }
      }
      if (bekleyen.length) yield { ad: zipAdi(++no), bayt: zipOlustur(bekleyen) };
    },
    sil: (id) => depo.sil(id),
    hepsiniSil: () => depo.hepsiniSil(),
  };
}

let ORTAK = null;
/** Sitenin ortak hafızası (IndexedDB). */
export function hafiza() { return (ORTAK ??= hafizaKur()); }

/** Tarayıcıdan "bu siteyi silme" izni ister (sessizce; verilmezse de çalışır) ve kullanımı verir. */
export async function depoDurumu() {
  const sonuc = { kullanilan: null, kota: null, kalici: null };
  try {
    sonuc.kalici = (await navigator.storage?.persisted?.()) ?? null;
    const e = await navigator.storage?.estimate?.();
    if (e) { sonuc.kullanilan = e.usage ?? null; sonuc.kota = e.quota ?? null; }
  } catch { /* desteklenmiyor */ }
  return sonuc;
}
export async function kaliciDepoIste() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
