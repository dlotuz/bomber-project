import type { RomAssets } from '../../rom/types';

/** Chaves já avisadas por instância de `RomAssets` (M1): zera sozinho ao trocar de ROM, pois a chave vive no objeto. */
const warned = new WeakMap<RomAssets, Set<string>>();

/** Avisa no console só na 1ª vez que `key` falha para este `RomAssets` (M1: o aviso não fica preso entre ROMs). */
export function warnOnce(a: RomAssets, key: string, message: string, e: unknown): void {
  let set = warned.get(a);
  if (!set) { set = new Set(); warned.set(a, set); }
  if (set.has(key)) return;
  set.add(key);
  console.warn(message, e);
}
