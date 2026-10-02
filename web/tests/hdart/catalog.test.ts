import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ACT_INFO, HD_CATALOG, HD_CATALOG_BY_KEY, HD_CELL, HD_GROUPS, HD_PRIORITIES, HD_TILES, MOUNT_PHASES, MOUNT_TYPES,
  MOUNT_TYPES_NORMAL, PLAYER_ACTS, FLAME_PARTS, countByGroup, flameTicks, modelManifest,
} from '../../src/render/hdart/catalog';
import { RITMO_ROM } from '../../src/render/hdart/catalog-ritmo';
import { validatePack } from '../../src/render/hdart/validate';
import { HD_DIRS, charKey, itemKey, mountKey, stageKey } from '../../src/render/hdart/types';
import { CHARACTERS } from '../../src/render/art/bomber';
import { DISEASE, ITEM } from '../../src/core/types';
import { FLAME_TICKS, STAGE_NAMES } from '../../src/core/constants';

const WEB = fileURLToPath(new URL('../../', import.meta.url));
/** Membros de um tipo união de strings declarado no fonte (`export type X = 'a' | 'b' …;`). */
function unionOf(file: string, name: string): string[] {
  const src = readFileSync(WEB + file, 'utf8');
  const m = new RegExp(`export type ${name} =([^;]+);`).exec(src);
  if (!m) throw new Error(`tipo ${name} não achado em ${file}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}
const has = (k: string) => HD_CATALOG_BY_KEY.has(k);

describe('catálogo da arte HD: cobertura dos tipos do jogo', () => {
  it('toda PlayerAct do núcleo aparece, para os 6 personagens, com direção (menos dying/victory)', () => {
    const acts = unionOf('src/core/types.ts', 'PlayerAct');
    expect(acts.length).toBeGreaterThanOrEqual(21);
    expect([...PLAYER_ACTS].sort()).toEqual([...acts].sort());
    expect(CHARACTERS.length).toBe(6);
    for (let c = 0; c < CHARACTERS.length; c++) {
      for (const act of acts) {
        if (act === 'dying' || act === 'victory') {
          expect(has(charKey(c, act as never)), `${c}/${act}`).toBe(true);
          for (const d of HD_DIRS) expect(has(charKey(c, act as never, d))).toBe(false);
        } else {
          for (const d of HD_DIRS) expect(has(charKey(c, act as never, d)), `${c}/${act}/${d}`).toBe(true);
        }
      }
      for (const d of HD_DIRS) expect(has(`rider/${c}/${d}`)).toBe(true);
      expect(has(`hud/head/${c}`)).toBe(true);
    }
    expect(Object.values(ACT_INFO).filter(a => !a.dir)).toHaveLength(2);
  });

  it('os 13 tipos de montaria (7 normais + 6 da senha), cada um em todas as fases e direções, e seus ovos', () => {
    expect(MOUNT_TYPES.map(t => t.toString(16))).toEqual(['1', '2', '3', '4', '5', '6', '9', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(MOUNT_TYPES_NORMAL.map(t => t.toString(16))).toEqual(['2', '3', 'a', 'c', 'd', 'e', 'f']);
    expect([...MOUNT_PHASES].sort()).toEqual(unionOf('src/core/mounts/types.ts', 'MountPhase').sort());
    for (const t of MOUNT_TYPES) {
      expect(has(`egg/${t.toString(16)}`)).toBe(true);
      for (const ph of MOUNT_PHASES) for (const d of HD_DIRS) expect(has(mountKey(t, ph, d)), `${t}/${ph}/${d}`).toBe(true);
    }
    expect(HD_CATALOG.filter(e => e.key.startsWith('mount/'))).toHaveLength(13 * 3 * 4);
  });

  it('10 arenas com as 7 peças fixas e os elementos especiais das arenas 2, 3, 5–9', () => {
    expect(STAGE_NAMES).toHaveLength(10);
    expect([...HD_TILES].sort()).toEqual(unionOf('src/render/hdart/types.ts', 'HdTile').sort());
    for (let n = 1; n <= 10; n++) for (const t of HD_TILES) expect(has(stageKey(n, t)), `${n}/${t}`).toBe(true);
    for (const k of ['stage/2/x/clocks', 'stage/3/x/orb', 'stage/5/x/fence', 'stage/6/x/stripes', 'stage/6/x/skull',
      'stage/6/x/skulls', 'stage/7/x/bush', 'stage/8/x/pad', 'stage/8/x/pad-lit', 'stage/9/x/seesaw-left-up',
      'stage/9/x/seesaw-right-up']) expect(has(k), k).toBe(true);
    for (const d of HD_DIRS) expect(has(`stage/7/x/arrow-${d}`)).toBe(true);
    expect(HD_CATALOG.filter(e => /^stage\/(1|4|10)\/x\//.test(e.key))).toHaveLength(0);
  });

  it('itens: todo ITEM (menos o ovo, que vira egg/<tipo>) e toda caveira de doença, em hex de 2 dígitos', () => {
    for (const [k, v] of Object.entries(ITEM)) expect(has(itemKey(v)), k).toBe(k !== 'EGG');
    for (const v of Object.values(DISEASE)) expect(has(itemKey(v))).toBe(true);
    expect(has('item/2d')).toBe(true);
    expect(HD_CATALOG.filter(e => e.group === 'itens').every(e => /^item\/[0-9a-f]{2}$/.test(e.key))).toBe(true);
  });

  it('bombas 0..2, as 7 peças da chama e o placar', () => {
    for (const t of [0, 1, 2]) expect(has(`bomb/${t}`)).toBe(true);
    expect([...FLAME_PARTS].sort()).toEqual(unionOf('src/render/hdart/types.ts', 'HdFlamePart').sort());
    for (const p of FLAME_PARTS) expect(has(`flame/${p}`)).toBe(true);
    for (let d = 0; d <= 9; d++) expect(has(`hud/digit/${d}`)).toBe(true);
    for (let n = 0; n <= 5; n++) expect(has(`hud/crown/${n}`)).toBe(true);
  });
});

describe('catálogo da arte HD: forma das entradas', () => {
  it('chaves únicas, tamanhos/apoios coerentes, ticks inteiros > 0, prioridade e grupo válidos', () => {
    expect(HD_CATALOG_BY_KEY.size).toBe(HD_CATALOG.length);
    for (const e of HD_CATALOG) {
      const [w, h] = e.size, [ax, ay] = e.anchor;
      expect(w > 0 && h > 0 && w % 16 === 0 && h % 16 === 0, e.key).toBe(true);
      expect(ax >= 0 && ay >= 0 && ax <= w && ay <= h, e.key).toBe(true);
      expect(e.ritmo.frames, e.key).toBe(e.ritmo.ticks.length);
      expect(e.ritmo.ticks.every(t => Number.isInteger(t) && t > 0), e.key).toBe(true);
      expect(HD_PRIORITIES).toContain(e.priority);
      expect(HD_GROUPS).toContain(e.group);
      expect(e.desc.trim().length, e.key).toBeGreaterThan(3);
    }
  });

  it('personagens: quadro 96×128 com apoio no centro da sombra sob os pés (48, 108); peças de arena: 1 casa', () => {
    expect(HD_CELL).toBe(64);
    const c = HD_CATALOG_BY_KEY.get('char/0/walk/down')!;
    expect([c.size, c.anchor]).toEqual([[96, 128], [48, 108]]);
    expect(HD_CATALOG_BY_KEY.get('stage/1/floor')!.size).toEqual([64, 64]);
    expect(HD_CATALOG_BY_KEY.get('stage/9/x/seesaw-left-up')!.size).toEqual([192, 64]);
  });

  it('chama: A2 B2 C2 … A1 soma FLAME_TICKS, 3 desenhos, sem loop', () => {
    expect(flameTicks().reduce((a, b) => a + b, 0)).toBe(FLAME_TICKS);
    const f = HD_CATALOG_BY_KEY.get('flame/center')!.ritmo;
    expect([f.frames, f.distinct, f.loop]).toEqual([13, 3, false]);
  });

  it('ritmo do original (só números): andar 12/8/12/8, derrota sem loop, bomba normal 20/12/16/16', () => {
    if (Object.keys(RITMO_ROM).length === 0) return;   // sem ritmo gerado: padrões (conferidos acima)
    expect(HD_CATALOG_BY_KEY.get('char/3/walk/left')!.ritmo.ticks).toEqual([12, 8, 12, 8]);
    const dying = HD_CATALOG_BY_KEY.get('char/0/dying')!.ritmo;
    expect([dying.ticks, dying.loop]).toEqual([[5, 5, 6, 6], false]);
    expect(HD_CATALOG_BY_KEY.get('bomb/0')!.ritmo.ticks.slice(0, 4)).toEqual([20, 12, 16, 16]);
    expect(HD_CATALOG_BY_KEY.get('mount/2/riding/up')!.ritmo.ticks).toEqual([16, 16, 16, 16]);
    for (const r of Object.values(RITMO_ROM)) expect(Object.keys(r).sort()).toEqual(['addr', 'distinct', 'loop', 'ticks']);
  });

  it('contagem por grupo bate com o total; 6 personagens × (19 ações × 4 + 2)', () => {
    const counts = countByGroup();
    expect(counts.reduce((a, c) => a + c.total, 0)).toBe(HD_CATALOG.length);
    for (const c of counts) expect(c.essencial + c.bom + c.raro).toBe(c.total);
    expect(counts.find(c => c.group === 'personagens')!.total).toBe(6 * (19 * 4 + 2));
    expect(counts.find(c => c.group === 'montarias')!.total).toBe(156);
  });

  it('o manifesto-modelo cobre 100% do catálogo e passa no validador sem erros', () => {
    const { manifest, sheets } = modelManifest();
    const byFile = new Map([...sheets].map(([id, s]) => [`${id}.png`, s]));
    const r = validatePack(manifest, f => byFile.get(f) ?? null);
    expect(r.erros).toEqual([]);
    expect(r.totais.presentes).toBe(HD_CATALOG.length);
    expect(r.desconhecidas).toEqual([]);
    for (const [, s] of sheets) expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(16384);
  });
});

describe('arquivos gerados em dia', () => {
  it('docs/arte-hd/ENCOMENDA.md e pacote-modelo.json batem com o catálogo', () => {
    const r = spawnSync(process.execPath, ['scripts/arte-hd/encomenda.ts', '--conferir'], { cwd: WEB, encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  }, 60_000);

  it.skipIf(!process.env.SB4_ROM)('catalog-ritmo.ts bate com a ROM (SB4_ROM)', () => {
    const r = spawnSync(process.execPath, ['scripts/arte-hd/ritmo.ts', '--conferir'], { cwd: WEB, encoding: 'utf8', env: process.env });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  }, 60_000);
});
