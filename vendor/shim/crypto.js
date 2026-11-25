export const randomUUID = () => globalThis.crypto.randomUUID();
export const createHash = () => { throw new Error('createHash bu ortamda desteklenmiyor.'); };
export default { randomUUID, createHash };
