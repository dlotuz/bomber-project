// Transcreve as cenas de analise/investigacao/graficos-formato/catalogo.json [CAT §5] para src/rom/catalog.ts.
// Só endereços, offsets e tamanhos (fatos). Rodar da pasta web/: node scripts/rom-facts/gfx-catalog.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = process.env.SB4_CATALOGO ?? `${root}../analise/investigacao/graficos-formato/catalogo.json`;
type Seg = { vram_byte: string; bytes: number; tipo: string; origem?: string; offset?: number; valor?: number };
type Cg = { paleta: number; rom: string; busca: string };
const cat = JSON.parse(readFileSync(src, 'utf8')) as { rom: { sha1: string }; cenas: Record<string, { vram: Seg[]; cgram: Cg[] }> };
const A = (s: string) => parseInt(s.replace('$', '').replace(':', '').split(' ')[0], 16);
const h = (n: number, w = 6) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');

const lines: string[] = [];
lines.push('// GERADO por scripts/rom-facts/gfx-catalog.ts a partir de analise/investigacao/graficos-formato/catalogo.json — não editar.');
lines.push(`// Fatos (endereços e tamanhos) das telas [CAT §5]. ROM SHA-1 ${cat.rom.sha1}.`);
lines.push("import type { SceneId } from './types';");
lines.push('');
lines.push('/** Segmento de VRAM na ordem de aplicação: zte (bloco + offset), raw (endereço + offset), zero ou fill. */');
lines.push("export type VramSeg =");
lines.push("  | { kind: 'zte'; vramByte: number; bytes: number; src: number; offset: number }");
lines.push("  | { kind: 'raw'; vramByte: number; bytes: number; src: number; offset: number }");
lines.push("  | { kind: 'zero'; vramByte: number; bytes: number }");
lines.push("  | { kind: 'fill'; vramByte: number; bytes: number; value: number };");
lines.push('/** `cgram[i]` = endereço dos 32 bytes da linha i da CGRAM (paletas 0–7 BG, 8–15 OBJ). */');
lines.push('export interface SceneCatalog { vram: VramSeg[]; cgram: number[] }');
lines.push('');
lines.push('export const SCENES: Record<SceneId, SceneCatalog> = {');
for (const [id, sc] of Object.entries(cat.cenas)) {
  lines.push(`  ${id}: {`);
    lines.push('    vram: [');
  for (const s of sc.vram) {
    const base = `vramByte: ${h(A(s.vram_byte), 4)}, bytes: ${s.bytes}`;
    if (s.tipo === 'zte' || s.tipo === 'raw') lines.push(`      { kind: '${s.tipo}', ${base}, src: ${h(A(s.origem!))}, offset: ${s.offset ?? 0} },`);
    else if (s.tipo === 'zero') lines.push(`      { kind: 'zero', ${base} },`);
    else if (s.tipo === 'fill') lines.push(`      { kind: 'fill', ${base}, value: ${s.valor ?? 0} },`);
    else throw new Error(`tipo de segmento desconhecido: ${s.tipo}`);
  }
  lines.push('    ],');
  const cg = [...sc.cgram].sort((a, b) => a.paleta - b.paleta);
  if (cg.length !== 16 || cg.some((r, i) => r.paleta !== i || r.busca !== 'exato' || !r.rom)) throw new Error(`CGRAM incompleta em ${id}`);
  lines.push(`    cgram: [${cg.map(r => h(A(r.rom))).join(', ')}],`);
  lines.push('  },');
}
lines.push('};');
writeFileSync(`${root}src/rom/catalog.ts`, lines.join('\n') + '\n');
console.log('cenas:', Object.keys(cat.cenas).join(' '));
