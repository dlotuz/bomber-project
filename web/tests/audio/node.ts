/**
 * Acesso ao Node nos testes de áudio SEM depender de @types/node (process.getBuiltinModule, Node ≥ 22.3).
 */
interface NodeFs { readFileSync(p: string | URL): Uint8Array; existsSync(p: string | URL): boolean; writeFileSync(p: string, d: Uint8Array): void }
interface NodeHash { update(d: Uint8Array): NodeHash; digest(enc: 'hex'): string }
interface NodeCrypto { createHash(alg: 'sha1'): NodeHash }
interface NodeProcess { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown }

const proc = (globalThis as unknown as { process: NodeProcess }).process;
export const fs = proc.getBuiltinModule('node:fs') as NodeFs;
const crypto = proc.getBuiltinModule('node:crypto') as NodeCrypto;
export const env = proc.env;

export function sha1(b: Uint8Array): string {
  return crypto.createHash('sha1').update(b).digest('hex');
}

/** Lê `tests/fixtures/rom/<name>`. */
export function fixture<T>(name: string): T {
  const bytes = fs.readFileSync(new URL(`../fixtures/rom/${name}`, import.meta.url));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Converte um log de MMIO [ciclo, tipo, endereço & $FF, valor]… no formato binário do spctrace (8 bytes por registro). */
export function mmioBytes(log: number[]): Uint8Array {
  const out = new Uint8Array((log.length / 4) * 8);
  for (let i = 0, o = 0; i < log.length; i += 4, o += 8) {
    const c = log[i];
    out[o] = c & 0xff; out[o + 1] = (c >>> 8) & 0xff; out[o + 2] = (c >>> 16) & 0xff; out[o + 3] = c >>> 24;
    out[o + 4] = log[i + 1]; out[o + 5] = log[i + 2]; out[o + 6] = log[i + 3];
  }
  return out;
}
