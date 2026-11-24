// PDF şifreleme / şifre kaldırma (qpdf, WebAssembly).
//
// KURAL: Şifre kaldırma YALNIZCA kullanıcı doğru şifreyi girerse çalışır.
// Şifre tahmin etme, deneme-yanılma ya da şifresiz kısıtlama kaldırma yoktur.

import createModule from '@neslinesli93/qpdf-wasm';
import { PdfHatasi, SifreliPdfHatasi, YanlisSifreHatasi } from './hatalar.js';
import { pdfAc } from './belge.js';

let WASM_YOLU = null;
/** qpdf.wasm dosyasının yolu/adresi (tarayıcıda URL, Node'da dosya yolu). */
export function qpdfWasmAyarla(yol) {
  WASM_YOLU = yol;
}

/** qpdf'in yazdıklarını (karakter karakter gelir) toplar. */
function baytToplayici() {
  const bayt = [];
  return {
    yaz: (c) => { if (typeof c === 'number') bayt.push(c & 255); },
    metin: () => new TextDecoder().decode(new Uint8Array(bayt)),
  };
}

async function calistir(args, girdi) {
  if (!WASM_YOLU) throw new PdfHatasi('Şifreleme bileşeni hazır değil.');
  const cikis = baytToplayici();
  const hata = baytToplayici();
  const ekstra = [];
  const qpdf = await createModule({
    locateFile: () => WASM_YOLU,
    noInitialRun: true,
    // qpdf'in ekrana yazacağı her şeyi yakala: standart akışlar bizim işlevlerimize bağlanır
    preRun: [(m) => m.FS.init(undefined, cikis.yaz, hata.yaz)],
    print: (t) => ekstra.push(String(t)),
    printErr: (t) => ekstra.push(String(t)),
  });
  qpdf.FS.writeFile('/girdi.pdf', girdi);
  let kod = 0;
  try {
    kod = qpdf.callMain(args);
  } catch (e) {
    kod = typeof e?.status === 'number' ? e.status : 1;
    if (typeof e?.status !== 'number') ekstra.push(String(e?.message ?? e));
  }
  let cikti = null;
  if (kod === 0 || kod === 3) {
    try { cikti = qpdf.FS.readFile('/cikti.pdf'); } catch { /* çıktı yok */ }
  }
  return { kod, kayit: [cikis.metin(), hata.metin(), ...ekstra].join('\n'), cikti };
}

/** Genel qpdf çağrısı (onarma vb.). Girdi /girdi.pdf, çıktı /cikti.pdf olarak okunur/yazılır. */
export async function qpdfCalistir(args, girdi) {
  return calistir(args, girdi);
}

/** PDF şifreli mi? (şifre gerekmeden anlaşılabilir) */
export async function sifreliMi(bayt) {
  try {
    await pdfAc(bayt);
    return false;
  } catch (e) {
    if (e instanceof SifreliPdfHatasi) return true;
    throw e;
  }
}

/**
 * Şifre ekler.
 * @param secenek.kullaniciSifresi  belgeyi açmak için gereken şifre (zorunlu)
 * @param secenek.sahipSifresi      izinleri değiştirmek için şifre (boşsa kullanıcı şifresiyle aynı)
 * @param secenek.izinler           { yazdir: 'tam'|'dusuk'|'yok', duzenle: 'tam'|'yok', kopyala: bool }
 */
export async function sifreEkle(bayt, { kullaniciSifresi, sahipSifresi = '', izinler = {} }) {
  if (!kullaniciSifresi) throw new PdfHatasi('Belgeyi açmak için bir şifre yazın.');
  if (await sifreliMi(bayt)) throw new PdfHatasi('Bu PDF zaten şifreli. Yeni şifre koymak için önce şifresini kaldırın.');
  const { yazdir = 'tam', duzenle = 'tam', kopyala = true } = izinler;
  const sahip = sahipSifresi || kullaniciSifresi;
  const args = [
    '--encrypt', kullaniciSifresi, sahip, '256',
    `--print=${{ tam: 'full', dusuk: 'low', yok: 'none' }[yazdir] ?? 'full'}`,
    `--modify=${duzenle === 'yok' ? 'none' : 'all'}`,
    `--extract=${kopyala ? 'y' : 'n'}`,
    '--accessibility=y',
    '--', '/girdi.pdf', '/cikti.pdf',
  ];
  const r = await calistir(args, bayt);
  if (!r.cikti) throw new PdfHatasi(`Şifreleme başarısız oldu. ${r.kayit}`.trim());
  const uyarilar = [];
  if (yazdir !== 'tam' || duzenle !== 'tam' || !kopyala) {
    uyarilar.push('İzin kısıtlamaları (yazdırma/düzenleme/kopyalama) bazı programlarca yok sayılabilir; asıl koruma, açma şifresidir.');
  }
  uyarilar.push('Şifreyi unutursanız belgeyi kimse açamaz; bu program da kurtaramaz. Şifreyi güvenli bir yerde saklayın.');
  return { bayt: r.cikti, uyarilar };
}

/**
 * Şifreyi kaldırır — yalnızca VERİLEN şifre doğruysa.
 * Şifre girilmezse ya da yanlışsa hiçbir şey yapılmaz.
 */
export async function sifreKaldir(bayt, sifre) {
  if (!sifre) throw new PdfHatasi('Şifre kaldırmak için şifreyi girmelisiniz.', 'SIFRE_GEREKLI');
  const incele = await calistir([`--password=${sifre}`, '--show-encryption', '/girdi.pdf'], bayt);
  if (/not encrypted/i.test(incele.kayit)) throw new PdfHatasi('Bu PDF zaten şifresiz.', 'SIFRESIZ');
  // Girilen şifrenin gerçekten kullanıcı ya da sahip şifresi olduğunu doğrula (boş şifreyle açılan
  // belgelerde rastgele bir metin yazılarak kısıtlama kaldırılamasın).
  if (incele.kod === 2 || !/supplied password is (the )?(user|owner) password/i.test(incele.kayit)) {
    throw new YanlisSifreHatasi();
  }
  const r = await calistir([`--password=${sifre}`, '--decrypt', '/girdi.pdf', '/cikti.pdf'], bayt);
  if (!r.cikti) throw new PdfHatasi(`Şifre kaldırılamadı. ${r.kayit}`.trim());
  return { bayt: r.cikti, uyarilar: [] };
}

export { SifreliPdfHatasi };

/** Yalnızca testler için: qpdf'i doğrudan çalıştırır. */
export const _testIcin = { calistir };
