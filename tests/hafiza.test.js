import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { hafizaKur, HafizaHatasi } from '../src/core/hafiza.js';

/** IndexedDB yerine bellek içi depo (aynı arayüz). */
function bellekDeposu({ kota = Infinity } = {}) {
  const kayitlar = new Map(), meta = new Map(), icerik = new Map();
  let kullanilan = 0;
  return {
    async ekleKayit(k) { kayitlar.set(k.id, structuredClone(k)); },
    async kayitAl(id) { return kayitlar.get(id); },
    async kayitlar() { return [...kayitlar.values()].map((k) => structuredClone(k)); },
    async dosyaEkle(kayit, m, bayt) {
      if (kullanilan + bayt.length > kota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      kullanilan += bayt.length;
      meta.set(`${m.kayitId}/${m.sira}`, { ...m }); icerik.set(`${m.kayitId}/${m.sira}`, bayt); kayitlar.set(kayit.id, structuredClone(kayit));
    },
    async dosyalar(id) { return [...meta.values()].filter((m) => m.kayitId === id); },
    async icerik(id, sira) { return icerik.get(`${id}/${sira}`); },
    async sil(id) { kayitlar.delete(id); for (const k of [...meta.keys()]) if (k.startsWith(`${id}/`)) { meta.delete(k); icerik.delete(k); } },
    async hepsiniSil() { kayitlar.clear(); meta.clear(); icerik.clear(); },
  };
}
const dosya = (ad, n) => ({ ad, bayt: new Uint8Array(n).fill(7) });

describe('çıktı hafızası', () => {
  it('kayıt açar, dosya ekler, bitirir ve geri okur', async () => {
    const h = hafizaKur(bellekDeposu());
    const k = await h.baslat({ arac: 'pdf-markdown', aracAd: 'PDF → Markdown' });
    await k.ekle(dosya('a.md', 10));
    await k.ekle(dosya('resimler/r.png', 20));
    await k.bitir({ mesaj: 'tamam' });
    const liste = await h.listele();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ arac: 'pdf-markdown', durum: 'tamam', dosyaSayisi: 2, boyut: 30 });
    expect((await h.dosyalar(k.id)).map((d) => d.ad)).toEqual(['a.md', 'resimler/r.png']);
    const a = await h.dosyaAl(k.id, 1);
    expect(a.ad).toBe('resimler/r.png');
    expect(a.bayt).toHaveLength(20);
  });

  it('bitirilmeden bırakılan kayıt (sayfa kapandı) "suruyor" kalır ama içindeki dosyalar kurtarılabilir', async () => {
    const h = hafizaKur(bellekDeposu());
    const k = await h.baslat({ arac: 'x', aracAd: 'X' });
    await k.ekle(dosya('bitti-1.md', 5));
    // bitir() çağrılmadı
    const [kayit] = await h.listele();
    expect(kayit.durum).toBe('suruyor');
    expect(kayit.dosyaSayisi).toBe(1);
    expect((await h.dosyaAl(k.id, 0)).ad).toBe('bitti-1.md');
  });

  it('yeni kayıtlar listenin başında', async () => {
    const h = hafizaKur(bellekDeposu());
    const a = await h.baslat({ arac: 'a', aracAd: 'A' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await h.baslat({ arac: 'b', aracAd: 'B' });
    expect((await h.listele()).map((k) => k.id)).toEqual([b.id, a.id]);
  });

  it('ZIP parçaları dosyaları içerir ve boyut sınırına göre bölünür', async () => {
    const h = hafizaKur(bellekDeposu());
    const k = await h.baslat({ arac: 'x', aracAd: 'X' });
    for (let i = 0; i < 5; i++) await k.ekle(dosya(`d${i}.bin`, 1000));
    await k.bitir();
    const parcalar = [];
    for await (const p of h.zipParcalari(k.id, { parcaSiniri: 2000 })) parcalar.push(p);
    expect(parcalar.length).toBe(3); // 2+2+1
    const adlar = [];
    for (const p of parcalar) adlar.push(...Object.keys((await JSZip.loadAsync(p.bayt)).files));
    expect(adlar.sort()).toEqual(['d0.bin', 'd1.bin', 'd2.bin', 'd3.bin', 'd4.bin']);
  });

  it('yer dolunca HafizaHatasi (DOLU) fırlatır; önceki dosyalar korunur; sonraki eklemeler de denenir', async () => {
    const h = hafizaKur(bellekDeposu({ kota: 25 }));
    const k = await h.baslat({ arac: 'x', aracAd: 'X' });
    await k.ekle(dosya('a', 20));
    await expect(k.ekle(dosya('b', 20))).rejects.toMatchObject({ name: 'HafizaHatasi', kod: 'DOLU' });
    await k.ekle(dosya('c', 4)); // küçük olan sığar; zincir bozulmaz
    await k.eksik('Yer kalmadı');
    const [kayit] = await h.listele();
    expect(kayit).toMatchObject({ durum: 'eksik', dosyaSayisi: 2, boyut: 24 });
    expect(new HafizaHatasi('x')).toBeInstanceOf(Error);
  });

  it('siler: tek kayıt ve hepsi', async () => {
    const h = hafizaKur(bellekDeposu());
    const a = await h.baslat({ arac: 'a', aracAd: 'A' }); await a.ekle(dosya('1', 3));
    const b = await h.baslat({ arac: 'b', aracAd: 'B' }); await b.ekle(dosya('2', 3));
    await h.sil(a.id);
    expect((await h.listele()).map((k) => k.id)).toEqual([b.id]);
    await expect(h.dosyaAl(a.id, 0)).rejects.toMatchObject({ kod: 'YOK' });
    await h.hepsiniSil();
    expect(await h.listele()).toEqual([]);
  });
});
