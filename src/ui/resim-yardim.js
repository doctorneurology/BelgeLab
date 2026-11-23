// Tarayıcıda resim dönüştürme yardımcıları.
import { resimTuru } from '../core/resim-pdf.js';

/** Tarayıcının çözebildiği (webp, gif, bmp, avif...) resmi PNG'ye çevirir; EXIF yönelimi uygulanır. */
export async function resimiPngYap(bayt) {
  const bitmap = await createImageBitmap(new Blob([bayt]), { imageOrientation: 'from-image' });
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** PNG/JPEG ise olduğu gibi, değilse PNG'ye çevirerek döndürür. */
export async function destekliResim(bayt) {
  const tur = resimTuru(bayt);
  if (tur === 'png' || tur === 'jpeg') return bayt;
  return resimiPngYap(bayt);
}

export async function resimOlculeri(bayt) {
  const b = await createImageBitmap(new Blob([bayt]));
  const o = { genislik: b.width, yukseklik: b.height };
  b.close?.();
  return o;
}
