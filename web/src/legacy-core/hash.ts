/** FNV-1a 32 bits sobre o JSON do estado. Só para testes e checagem de sync. */
export function hashState(x: unknown): string {
  const str = JSON.stringify(x);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
