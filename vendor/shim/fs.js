// "node:fs" yerine: tarayıcıda dosya sistemi yoktur. Sistem yazı tipi taraması gibi isteğe bağlı işlemler "dosya yok" olarak sonuçlanır.
const yok = (ad) => () => { const e = new Error(`${ad}: dosya sistemi bu ortamda yok`); e.code = 'ENOENT'; throw e; };
export const closeSync = () => {};
export const mkdirSync = yok('mkdirSync');
export const openSync = yok('openSync');
export const readFileSync = yok('readFileSync');
export const readSync = yok('readSync');
export const readdirSync = yok('readdirSync');
export const statSync = yok('statSync');
export const writeFileSync = yok('writeFileSync');
export const existsSync = () => false;
export default { closeSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync, existsSync };
