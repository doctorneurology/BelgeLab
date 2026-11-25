// Tarayıcı için "node:zlib" yerine geçen küçük katman (GenOffice kodu için). fflate ile çalışır.
import { zlibSync, inflateSync, unzlibSync } from 'fflate';
import { crc32 as crc } from '../../src/core/zip.js';

export const deflateSync = (veri, secenek = {}) => zlibSync(veri instanceof Uint8Array ? veri : new Uint8Array(veri), { level: secenek.level ?? 6 });
export const inflateRawSync = (veri) => inflateSync(veri instanceof Uint8Array ? veri : new Uint8Array(veri));
export const inflateSyncNode = (veri) => unzlibSync(veri instanceof Uint8Array ? veri : new Uint8Array(veri));
export { inflateSyncNode as inflateSync };
export const crc32 = (veri) => crc(veri instanceof Uint8Array ? veri : new Uint8Array(veri));
export const brotliDecompressSync = () => { throw new Error('Brotli (WOFF2 yazı tipi) bu ortamda desteklenmiyor.'); };
export default { deflateSync, inflateRawSync, inflateSync: inflateSyncNode, crc32, brotliDecompressSync };
