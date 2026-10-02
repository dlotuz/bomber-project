// Confere um pacote de arte HD contra o catálogo e imprime o relatório em PT-BR (o que está errado e o que falta,
// por prioridade). Sai com código 1 se houver erro.
// Uso: node scripts/arte-hd/validar.ts <pasta-do-pacote> [--tudo]
import { closeSync, existsSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { importar } from './carregar.ts';

interface ImageInfo { w: number; h: number }
interface Validate {
  validatePack(manifest: unknown, imageInfo: (file: string) => ImageInfo | null): { ok: boolean };
  formatReport(r: unknown, maxLista?: number): string;
  readImageSize(b: Uint8Array): ImageInfo | null;
  safeImagePath(p: string): boolean;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const tudo = args.includes('--tudo');
  const pasta = args.find(a => !a.startsWith('--'));
  if (!pasta) { console.error('uso: node scripts/arte-hd/validar.ts <pasta-do-pacote> [--tudo]'); return 2; }
  const root = resolve(pasta);
  const file = resolve(root, 'pacote.json');
  if (!existsSync(file)) { console.error(`não achei ${file}`); return 1; }
  let manifest: unknown;
  try { manifest = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`pacote.json não é JSON válido: ${(e as Error).message}`); return 1; }

  const v = await importar<Validate>('src/render/hdart/validate.ts');
  const realRoot = realpathSync(root);
  const imageInfo = (rel: string): ImageInfo | null => {
    if (!v.safeImagePath(rel)) return null;
    const p = resolve(root, rel);
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    if (!realpathSync(p).startsWith(realRoot + sep)) return null;   // link para fora da pasta
    const fd = openSync(p, 'r');
    try { const head = new Uint8Array(64); const n = readSync(fd, head, 0, 64, 0); return v.readImageSize(head.subarray(0, n)); }
    finally { closeSync(fd); }
  };
  const report = v.validatePack(manifest, imageInfo);
  console.log(v.formatReport(report, tudo ? Infinity : 30));
  return report.ok ? 0 : 1;
}

process.exitCode = await main();
