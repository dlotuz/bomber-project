// Pacote provisório (frente P): o `pacote.json` gravado respeita o contrato de `render/hdart/types.ts`, as imagens
// existem e contêm os recortes, e as chaves pedidas estão cobertas. Regenerar: node scripts/arte-hd/provisorio/gerar.ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HD_DIRS, charKey, frameAt, itemKey, stageKey, type HdManifest } from '../../src/render/hdart/types';
import { buildPlaceholder, PH_CHAR_COUNT, PH_EGG_TYPES, PH_FLAMES, PH_ITEMS, PH_TILES } from '../../src/render/hdart/placeholder';

const DIR = fileURLToPath(new URL('../../public/arte-hd/provisorio/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${DIR}pacote.json`, 'utf8')) as HdManifest;

/** Largura e altura do PNG (cabeçalho IHDR). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('pacote provisório: contrato', () => {
  it('cabeçalho do manifesto', () => {
    expect(manifest.format).toBe(1);
    expect(manifest.cell).toBe(64);
    expect(manifest.credits).toBe('Crown Blast — arte provisória gerada por código');
    expect(manifest.license).toBe('a do projeto');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it('o pacote.json gravado é o que o código gera hoje (rode gerar.ts depois de mudar o desenho)', () => {
    expect(manifest).toEqual(JSON.parse(JSON.stringify(buildPlaceholder().manifest)));
  });

  it('as folhas gravadas têm o tamanho do layout', () => {
    for (const s of buildPlaceholder().sheets) expect(pngSize(`${DIR}${s.file}`)).toEqual([s.w, s.h]);
  });

  it('toda imagem referida existe e todo recorte cabe nela, com o ponto de apoio dentro do recorte', () => {
    const sizes = new Map<string, [number, number]>();
    for (const [name, file] of Object.entries(manifest.images)) {
      expect(file).toMatch(/\.png$/);
      expect(existsSync(`${DIR}${file}`)).toBe(true);
      sizes.set(name, pngSize(`${DIR}${file}`));
    }
    for (const [key, a] of Object.entries(manifest.anims)) {
      for (const f of a.frames) {
        const sz = sizes.get(f.img);
        expect(sz, `${key}: imagem ${f.img}`).toBeDefined();
        const [x, y, w, h] = f.rect;
        expect([x, y, w, h].every(Number.isInteger), key).toBe(true);
        expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= sz![0] && y + h <= sz![1], key).toBe(true);
        expect(f.anchor[0] >= 0 && f.anchor[0] <= w && f.anchor[1] >= 0 && f.anchor[1] <= h, key).toBe(true);
      }
    }
  });

  it('ticks: um por quadro, inteiros positivos; frameAt respeita loop/sem loop', () => {
    for (const [key, a] of Object.entries(manifest.anims)) {
      expect(a.frames.length, key).toBeGreaterThan(0);
      expect(a.ticks.length, key).toBe(a.frames.length);
      expect(a.ticks.every(t => Number.isInteger(t) && t > 0), key).toBe(true);
      const total = a.ticks.reduce((s, t) => s + t, 0);
      expect(frameAt(a, total + 1000)).toBe(a.loop ? frameAt(a, (total + 1000) % total) : a.frames[a.frames.length - 1]);
    }
  });

  it('recortes não se sobrepõem dentro de uma folha (o filtro bilinear não puxa o vizinho)', () => {
    const seen = new Map<string, string>();
    for (const [key, a] of Object.entries(manifest.anims)) {
      for (const f of a.frames) {
        const id = `${f.img}@${f.rect.join(',')}`;
        expect(seen.has(id), `${key} repete ${seen.get(id)}`).toBe(false);
        seen.set(id, key);
      }
    }
  });
});

describe('pacote provisório: cobertura', () => {
  const has = (k: string) => expect(manifest.anims[k], k).toBeDefined();
  const n = (k: string) => manifest.anims[k].frames.length;

  it('10 arenas × 7 peças; bloco queimando em 2–3 quadros sem loop', () => {
    for (let s = 1; s <= 10; s++) {
      for (const t of PH_TILES) has(stageKey(s, t));
      expect(n(stageKey(s, 'burning'))).toBeGreaterThanOrEqual(2);
      expect(n(stageKey(s, 'burning'))).toBeLessThanOrEqual(3);
      expect(manifest.anims[stageKey(s, 'burning')].loop).toBe(false);
      expect(manifest.anims[stageKey(s, 'floor')].frames[0].rect.slice(2)).toEqual([64, 64]);
    }
  });

  it('bombas dos 3 tipos pulsando (2–4 quadros, loop) e as 7 peças de chama encolhendo (3–4, sem loop)', () => {
    for (const t of [0, 1, 2]) {
      const a = manifest.anims[`bomb/${t}`];
      expect(a.loop).toBe(true);
      expect(a.frames.length >= 2 && a.frames.length <= 4).toBe(true);
    }
    expect(PH_FLAMES).toHaveLength(7);
    for (const p of PH_FLAMES) {
      const a = manifest.anims[`flame/${p}`];
      expect(a.loop).toBe(false);
      expect(a.frames.length >= 3 && a.frames.length <= 4).toBe(true);
    }
  });

  it('itens do núcleo e ovos dos 13 tipos de montaria', () => {
    expect(PH_ITEMS).toHaveLength(19);
    for (const id of PH_ITEMS) has(itemKey(id));
    expect(PH_EGG_TYPES).toHaveLength(13);
    for (const t of PH_EGG_TYPES) has(`egg/${t.toString(16)}`);
  });

  it('6 personagens: idle/walk/stunned nas 4 direções, dying e victory sem direção', () => {
    expect(PH_CHAR_COUNT).toBe(6);
    for (let c = 0; c < PH_CHAR_COUNT; c++) {
      for (const d of HD_DIRS) {
        has(charKey(c, 'idle', d));
        has(charKey(c, 'stunned', d));
        const w = n(charKey(c, 'walk', d));
        expect(w >= 3 && w <= 4).toBe(true);
      }
      const dy = manifest.anims[charKey(c, 'dying')];
      expect(dy.frames.length >= 3 && dy.frames.length <= 4).toBe(true);
      expect(dy.loop).toBe(false);
      has(charKey(c, 'victory'));
    }
  });

  it('montarias ficam de fora nesta versão (caem para a ROM)', () => {
    expect(Object.keys(manifest.anims).some(k => k.startsWith('mount/') || k.startsWith('rider/'))).toBe(false);
  });
});
