// Basit ZIP yazıcı (sıkıştırmasız / "stored"). Ek kütüphane gerektirmez.
// Dosya adları UTF-8 olarak kaydedilir (Türkçe karakterler bozulmaz).

const CRC_TABLOSU = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLOSU[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosZamani(tarih) {
  const saat = (tarih.getHours() << 11) | (tarih.getMinutes() << 5) | (tarih.getSeconds() >> 1);
  const gun = ((tarih.getFullYear() - 1980) << 9) | ((tarih.getMonth() + 1) << 5) | tarih.getDate();
  return { saat, gun };
}

/** @param {{ad:string, bayt:Uint8Array}[]} dosyalar  @returns {Uint8Array} */
export function zipOlustur(dosyalar, tarih = new Date()) {
  const kodla = new TextEncoder();
  const { saat, gun } = dosZamani(tarih);
  const parcalar = [];
  const merkez = [];
  let konum = 0;
  const adlar = new Set();

  for (const d of dosyalar) {
    let ad = d.ad;
    // Aynı adlı dosyalar birbirinin üstüne yazılmasın.
    if (adlar.has(ad)) {
      const m = /^(.*?)(\.[^.]+)?$/.exec(ad);
      let i = 2;
      while (adlar.has(`${m[1]} (${i})${m[2] ?? ''}`)) i++;
      ad = `${m[1]} (${i})${m[2] ?? ''}`;
    }
    adlar.add(ad);
    const adBayt = kodla.encode(ad);
    const veri = d.bayt;
    const crc = crc32(veri);

    const yerel = new DataView(new ArrayBuffer(30));
    yerel.setUint32(0, 0x04034b50, true);
    yerel.setUint16(4, 20, true);
    yerel.setUint16(6, 0x0800, true); // UTF-8 ad
    yerel.setUint16(8, 0, true); // sıkıştırmasız
    yerel.setUint16(10, saat, true);
    yerel.setUint16(12, gun, true);
    yerel.setUint32(14, crc, true);
    yerel.setUint32(18, veri.length, true);
    yerel.setUint32(22, veri.length, true);
    yerel.setUint16(26, adBayt.length, true);
    yerel.setUint16(28, 0, true);
    parcalar.push(new Uint8Array(yerel.buffer), adBayt, veri);

    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true);
    m.setUint16(4, 20, true);
    m.setUint16(6, 20, true);
    m.setUint16(8, 0x0800, true);
    m.setUint16(10, 0, true);
    m.setUint16(12, saat, true);
    m.setUint16(14, gun, true);
    m.setUint32(16, crc, true);
    m.setUint32(20, veri.length, true);
    m.setUint32(24, veri.length, true);
    m.setUint16(28, adBayt.length, true);
    m.setUint32(42, konum, true);
    merkez.push(new Uint8Array(m.buffer), adBayt);

    konum += 30 + adBayt.length + veri.length;
  }

  const merkezBoyut = merkez.reduce((t, p) => t + p.length, 0);
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true);
  son.setUint16(8, dosyalar.length, true);
  son.setUint16(10, dosyalar.length, true);
  son.setUint32(12, merkezBoyut, true);
  son.setUint32(16, konum, true);

  const hepsi = [...parcalar, ...merkez, new Uint8Array(son.buffer)];
  const toplam = hepsi.reduce((t, p) => t + p.length, 0);
  if (toplam > 0xffffffff - 1024) throw new Error('ZIP dosyası 4 GB sınırını aşıyor.');
  const cikti = new Uint8Array(toplam);
  let o = 0;
  for (const p of hepsi) {
    cikti.set(p, o);
    o += p.length;
  }
  return cikti;
}
