// İptal: kullanıcı "İptal et"e basınca çalışan işlem GERÇEKTEN durur (yalnızca dosyalar arasında değil, dosyanın içinde de).
// Uzun döngüler sayfa başında `iptalKontrol()` çağırır; OCR işçileri anında kapatılır. Aynı anda tek işlem çalıştığı için durum ortaktır.

export class IptalHatasi extends Error {
  constructor() { super('İşlem iptal edildi.'); this.name = 'IptalHatasi'; }
}

let istendi = false;
const dinleyiciler = new Set();

/** İptal iste: bayrak kalkar, kayıtlı dinleyiciler (ör. OCR işçilerini kapat) çağrılır. */
export function iptalIste() {
  istendi = true;
  for (const f of [...dinleyiciler]) { try { f(); } catch { /* önemsiz */ } }
}
/** Yeni işlem başlamadan önce çağrılır. */
export function iptalSifirla() { istendi = false; }
export const iptalEdildiMi = () => istendi;
/** İptal istendiyse IptalHatasi fırlatır. */
export function iptalKontrol() { if (istendi) throw new IptalHatasi(); }
/** İptal istenince çağrılacak işlev ekler; kaldıran işlev döner. */
export function iptalDinle(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }
