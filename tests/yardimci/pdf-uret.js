// Testler için örnek PDF / resim üreticileri (kişisel örnek dosyalara bağımlı değildir).
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { PNG } from 'pngjs';
import { createCanvas } from '@napi-rs/canvas';
import { yaziTipiGom } from '../../src/core/fonts.js';

export const TURKCE_CUMLE = 'Pijamalı hasta yağız şoföre çabucak güvendi. ĞÜŞİÖÇ ığüşöç';

/** Her sayfasında "Sayfa i / n" başlığı, Türkçe cümle ve renkli bir kutu olan PDF. */
export async function ornekPdf({ sayfa = 3, genislik = 595.28, yukseklik = 841.89, baslik = 'Sayfa', don = 0 } = {}) {
  const doc = await PDFDocument.create();
  const font = await yaziTipiGom(doc, 'liberation-sans');
  const kalin = await yaziTipiGom(doc, 'liberation-sans', { kalin: true });
  for (let i = 1; i <= sayfa; i++) {
    const p = doc.addPage([genislik, yukseklik]);
    p.drawText(`${baslik} ${i} / ${sayfa}`, { x: 72, y: yukseklik - 100, size: 28, font: kalin });
    p.drawText(TURKCE_CUMLE, { x: 72, y: yukseklik - 140, size: 11, font });
    p.drawRectangle({ x: 72, y: yukseklik - 400, width: 200, height: 120, color: rgb(0.2, 0.4 + (i % 3) * 0.2, 0.8) });
    if (don) p.setRotation(degrees(don));
  }
  return new Uint8Array(await doc.save());
}

/** Verilen sayfanın içerik akışına, sıkıştırılmamış (aranabilir) gizli bir işaret ekler. */
export async function gizliIsaretEkle(bayt, sayfaIdx, isaret) {
  const doc = await PDFDocument.load(bayt);
  const page = doc.getPage(sayfaIdx);
  const ref = doc.context.register(doc.context.stream(`% ${isaret}\n`));
  page.node.normalize();
  page.node.Contents().push(ref);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

export function baytIcerir(bayt, metin) {
  return Buffer.from(bayt).includes(Buffer.from(metin, 'latin1'));
}

/** Düz renkli PNG (RGBA). renk: [r,g,b,a] */
export function pngUret(w, h, renk = [255, 0, 0, 255]) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set(renk, i * 4);
  return new Uint8Array(PNG.sync.write(png));
}

/** Solu `sol`, sağı `sag` renkli JPEG. */
export async function jpegUret(w, h, sol = '#ff0000', sag = '#0000ff') {
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = sol; g.fillRect(0, 0, w / 2, h);
  g.fillStyle = sag; g.fillRect(w / 2, 0, w / 2, h);
  const b = await c.encode('jpeg', 95);
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

/** JPEG'in başına EXIF yönelim (1-8) bilgisi ekler. */
export function jpegYonelimEkle(jpeg, yonelim) {
  const exif = new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, // APP1, uzunluk 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF başlığı (big-endian), IFD0 ofseti 8
    0x00, 0x01, // 1 giriş
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, yonelim, 0x00, 0x00, // Orientation
    0x00, 0x00, 0x00, 0x00, // sonraki IFD yok
  ]);
  const cikti = new Uint8Array(jpeg.length + exif.length);
  cikti.set(jpeg.subarray(0, 2), 0);
  cikti.set(exif, 2);
  cikti.set(jpeg.subarray(2), 2 + exif.length);
  return cikti;
}

/** Metin, onay kutusu, seçenek düğmeleri, açılır liste ve çok satırlı alan içeren form. */
export async function formluPdf() {
  const doc = await PDFDocument.create();
  const font = await yaziTipiGom(doc, 'liberation-sans');
  const page = doc.addPage([595, 842]);
  const form = doc.getForm();
  const ad = form.createTextField('ad');
  ad.addToPage(page, { x: 50, y: 760, width: 300, height: 24 });
  const kisa = form.createTextField('kisa');
  kisa.setMaxLength(5);
  kisa.addToPage(page, { x: 50, y: 720, width: 100, height: 24 });
  const adres = form.createTextField('adres');
  adres.enableMultiline();
  adres.addToPage(page, { x: 50, y: 620, width: 300, height: 80 });
  const onay = form.createCheckBox('onay');
  onay.addToPage(page, { x: 50, y: 580, width: 20, height: 20 });
  const cins = form.createRadioGroup('cinsiyet');
  cins.addOptionToPage('kadin', page, { x: 50, y: 540, width: 20, height: 20 });
  cins.addOptionToPage('erkek', page, { x: 100, y: 540, width: 20, height: 20 });
  const il = form.createDropdown('il');
  il.addOptions(['Ankara', 'İzmir', 'Muğla']);
  il.addToPage(page, { x: 50, y: 490, width: 200, height: 24 });
  form.updateFieldAppearances(font);
  return new Uint8Array(await doc.save({ updateFieldAppearances: false }));
}
