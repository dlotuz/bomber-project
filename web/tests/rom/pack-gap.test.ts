import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ROM } from './helpers';
import { expandPack } from '../../src/rom/pack';
import { createRomAssets } from '../../src/rom/assets';
import { MOUNT_GFX } from '../../src/render/rom/mounts/facts';
import { sheetFrame } from '../../src/rom/assets-char';
import { hiromOffset } from '../../src/rom/view';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const walk = (d: string): string[] => readdirSync(d).flatMap(f => statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]);
// Com a ROM real (SB4_ROM): o pacote embutido (public/rom-pack.dat) dá o mesmo que a ROM em todo endereço da ROM citado
// no código de desenho e em todos os quadros das folhas de montaria. Falhou? Regere o pacote (scripts/rom-pack/build.mjs).
it.skipIf(!ROM)('pacote embutido = ROM nos endereços do desenho e nas folhas das montarias', () => {
  const pack = expandPack(new Uint8Array(gunzipSync(readFileSync(fileURLToPath(new URL('../../public/rom-pack.dat', import.meta.url))))));
  const A = createRomAssets(ROM!), B = createRomAssets(pack);
  const addrs = new Set<number>();
  for (const f of walk(`${SRC}render`).concat(walk(`${SRC}screens`))) for (const m of readFileSync(f, 'utf8').matchAll(/0x([cdefCDEF][0-9a-fA-F]{5})\b/g)) addrs.add(parseInt(m[1], 16));
  const bad: string[] = [];
  const cmp = (label: string, f: (a: typeof A) => unknown) => {
    let x: string, y: string;
    try { x = JSON.stringify(f(A)); } catch { x = 'ERR'; }
    try { y = JSON.stringify(f(B)); } catch { y = 'ERR'; }
    if (x !== y) bad.push(label);
  };
  for (const ad of addrs) cmp(`anim $${ad.toString(16)}`, a => a.anim(ad));
  for (const [t, g] of Object.entries(MOUNT_GFX)) for (let k = 0; k < 64; k++) cmp(`mount ${t} g${k}`, a => Array.from(sheetFrame(a.rom, g.src, k)));
  // bytes crus: qualquer diferença nas primeiras 0x4000 de cada folha de montaria
  for (const [t, g] of Object.entries(MOUNT_GFX)) { const o = hiromOffset(g.src); for (let i = 0; i < 0x4000; i++) if (ROM![o + i] !== pack[o + i]) { bad.push(`mount ${t} raw +${i.toString(16)}`); break; } }
  expect(addrs.size).toBeGreaterThan(100);
  expect(bad).toEqual([]);
});
