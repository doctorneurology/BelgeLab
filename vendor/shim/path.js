export const join = (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/');
export const dirname = (p) => String(p).replace(/\/[^/]*$/, '') || '/';
export default { join, dirname };
