# Crown Blast: Plano 2, Cliente jogável

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o núcleo (Plano 1) num jogo que abre no navegador e dá para jogar. Ele terá tela 256×224 com pixel art original gerada por código, teclado e gamepad para até 5 jogadores locais, HUD, rodadas, placar de coroas e tela de vitória.

**Architecture:** O código do cliente fica em `web/src/` e usa o core só pela API pública (`src/core/index.ts`), sem modificá-lo. Três camadas puras e testáveis: a arte (funções que geram pixels em `Pix`), o estado de sessão (máquina de fases) e o modelo de visão (explosões, animação de caminhada, relógio). Uma camada fina de DOM cuida do canvas, do loop de 60 Hz com acumulador, do cache de sprites e da leitura de teclado e gamepad. Menus completos, IA, áudio e webhook ficam para os Planos 3 e 4. Neste plano o jogo abre numa tela de título simples, e as regras vêm da URL.

**Tech Stack:** TypeScript 5, Vite, Vitest, Canvas 2D, Gamepad API, `playwright-core` (só para as screenshots de verificação, usando o Chrome instalado).

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-web-design.md` (§2, §3, §10, §11, §13)

## Global Constraints

- **Não modificar `web/src/core/`.** O cliente importa apenas de `../core` (o `index.ts`).
- Resolução lógica **256×224**, escala inteira, sem suavização (`imageSmoothingEnabled = false`, `image-rendering: pixelated`).
- Tile da casa (gx,gy) na tela: canto superior esquerdo em **x = 16·gx + 8, y = 16·gy + 24**. HUD nos 24 px do topo. Posição do jogador em px = subpixel ÷ 8 (centro da casa).
- Sprite de personagem **16×20**, ancorado com os pés na base da casa: `x = cx − 8`, `y = cy − 12`.
- Cores sempre em `#rrggbb` (6 dígitos). O `hexToRgb` não aceita a forma curta.
- Arte, textos e nomes originais em PT-BR. Nada da Hudson/Konami.
- Controles padrão (spec §11): P1 WASD + J(A) K(B) L(Y) Enter(START); P2 setas + Numpad1(A) Numpad2(B) Numpad3(Y) NumpadEnter(START); gamepad i → jogador i (A = botão 1, B = 0, Y = 2, START = 9, d-pad 12–15, analógico com zona morta 0,5).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de arquivos

```
web/index.html                      página com <canvas id="screen">
web/src/main.ts                     liga tudo: config → título → sessão → loop
web/src/render/art/pix.ts           imagem RGBA pura + helpers
web/src/render/art/bomber.ts        6 personagens (16×20, 4 direções, 3 quadros) + ícone de cabeça
web/src/render/art/items.ts         bomba e 8 ícones de item
web/src/render/art/flames.ts        peças de chama procedurais
web/src/render/art/tiles.ts         10 temas de arena (piso, bloco fixo, parede, soft, queimando)
web/src/render/art/font.ts          fonte bitmap 5×7 com acentos PT-BR
web/src/render/art/trophy.ts        coroa (placar) e troféu (vitória)
web/src/input/input.ts              mapeamento teclado/gamepad → 5 controles + InputManager
web/src/app/loop.ts                 passo fixo de 60 Hz
web/src/game/config.ts              regras a partir da URL
web/src/game/session.ts             fases: batalha → fim de rodada → placar → vitória
web/src/render/view.ts              modelo de visão puro (explosões, caminhada, relógio, textos)
web/src/render/sprite-bank.ts       Pix → canvas com cache
web/src/render/display.ts           canvas 256×224 + escala inteira
web/src/render/draw-game.ts         arena, bombas, chamas, jogadores, HUD
web/src/render/draw-screens.ts      título, sobreposições, placar, vitória
web/scripts/snapshots.mjs           screenshots automáticas para verificação visual
web/tests/client/*.test.ts
```

---

### Task 1: Pixel art gerada por código

**Files:**
- Create: `web/src/render/art/pix.ts`, `bomber.ts`, `items.ts`, `flames.ts`, `tiles.ts`, `font.ts`, `trophy.ts`
- Test: `web/tests/client/art.test.ts`

**Interfaces:**
- Produces:
  - `interface Pix { w; h; data: Uint8ClampedArray }`, `type Palette`, `makePix`, `hexToRgb`, `setPx`, `alphaAt`, `fillRect`, `fromRows`, `blit`, `flipH`, `noise`
  - `CHARACTERS: readonly CharacterDef[]` (6), `bomberFrame(charIndex, dir 1..4, frame 0..2): Pix` (16×20), `headIcon(charIndex): Pix` (16×14)
  - `bombPix(frame 0|1): Pix` (16×16), `itemIcon(item 1..8): Pix` (16×16)
  - `type FlamePart = 'center'|'h'|'v'|'up'|'down'|'left'|'right'`, `flamePiece(part, shrink 0..3): Pix` (16×16)
  - `THEMES` (10), `interface StageTiles { floor; floorAlt; hard; wall; soft; burning: [Pix, Pix]; bg: string }`, `stageTiles(stage 1..10): StageTiles`
  - `GLYPH_ADVANCE = 6`, `LINE_HEIGHT = 10`, `hasGlyph(ch)`, `textWidth(text)`, `textPix(text, color, shadow = '#0b0b14' | null): Pix`
  - `crownPix(): Pix` (12×8), `trophyPix(): Pix` (24×24)

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/client/art.test.ts`:
```ts
import { fromRows, makePix, flipH, setPx, alphaAt, blit } from '../../src/render/art/pix';
import { CHARACTERS, bomberFrame, headIcon } from '../../src/render/art/bomber';
import { bombPix, itemIcon } from '../../src/render/art/items';
import { flamePiece, type FlamePart } from '../../src/render/art/flames';
import { THEMES, stageTiles } from '../../src/render/art/tiles';
import { textPix, textWidth, hasGlyph } from '../../src/render/art/font';
import { crownPix, trophyPix } from '../../src/render/art/trophy';
import { STAGE_NAMES } from '../../src/core';

const opaque = (p: { w: number; h: number; data: Uint8ClampedArray }) => {
  let n = 0; for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++; return n;
};

describe('pix', () => {
  it('fromRows respeita a paleta e a transparência', () => {
    const p = fromRows(['a.', '.a'], { '.': null, a: '#ff0000' });
    expect([p.w, p.h]).toEqual([2, 2]);
    expect(alphaAt(p, 0, 0)).toBe(255);
    expect(alphaAt(p, 1, 0)).toBe(0);
    expect(Array.from(p.data.slice(0, 3))).toEqual([255, 0, 0]);
  });
  it('fromRows rejeita linhas de tamanhos diferentes', () => {
    expect(() => fromRows(['aa', 'a'], { a: '#ffffff' })).toThrow();
  });
  it('flipH espelha e blit respeita transparência', () => {
    const p = makePix(3, 1); setPx(p, 0, 0, '#ffffff');
    expect(alphaAt(flipH(p), 2, 0)).toBe(255);
    const dst = makePix(3, 1); setPx(dst, 1, 0, '#00ff00');
    blit(dst, p, 0, 0);
    expect(alphaAt(dst, 1, 0)).toBe(255);
    expect(dst.data[4 + 1]).toBe(255); // pixel verde não foi apagado pelo transparente
  });
});

describe('personagens', () => {
  it('6 personagens, todas as direções e quadros em 16×20 com conteúdo', () => {
    expect(CHARACTERS).toHaveLength(6);
    for (let c = 0; c < 6; c++) for (let d = 1; d <= 4; d++) for (let f = 0; f < 3; f++) {
      const p = bomberFrame(c, d, f);
      expect([p.w, p.h]).toEqual([16, 20]);
      expect(opaque(p)).toBeGreaterThan(100);
    }
  });
  it('esquerda é o espelho da direita', () => {
    expect(Array.from(bomberFrame(0, 3, 0).data)).toEqual(Array.from(flipH(bomberFrame(0, 4, 0)).data));
  });
  it('personagens diferentes geram sprites diferentes', () => {
    const keys = new Set([0, 1, 2, 3, 4, 5].map(c => Array.from(bomberFrame(c, 2, 0).data).join()));
    expect(keys.size).toBe(6);
  });
  it('ícone de cabeça 16×14', () => {
    const h = headIcon(2);
    expect([h.w, h.h]).toEqual([16, 14]);
  });
});

describe('itens, bomba e chamas', () => {
  it('8 ícones 16×16 com borda opaca', () => {
    for (let i = 1; i <= 8; i++) {
      const p = itemIcon(i);
      expect([p.w, p.h]).toEqual([16, 16]);
      expect(alphaAt(p, 0, 0)).toBe(255);
    }
  });
  it('bomba pulsa (quadros diferentes)', () => {
    expect(Array.from(bombPix(0).data)).not.toEqual(Array.from(bombPix(1).data));
  });
  it('peças de chama', () => {
    const parts: FlamePart[] = ['center', 'h', 'v', 'up', 'down', 'left', 'right'];
    for (const part of parts) for (let s = 0; s <= 3; s++) {
      const p = flamePiece(part, s);
      expect([p.w, p.h]).toEqual([16, 16]);
      expect(opaque(p)).toBeGreaterThan(0);
    }
    expect(alphaAt(flamePiece('h', 0), 15, 8)).toBe(255);
    expect(alphaAt(flamePiece('right', 0), 15, 8)).toBe(0);
    expect(alphaAt(flamePiece('right', 0), 0, 8)).toBe(255);
    expect(alphaAt(flamePiece('up', 0), 8, 0)).toBe(0);
    expect(alphaAt(flamePiece('up', 0), 8, 15)).toBe(255);
    expect(opaque(flamePiece('h', 3))).toBeLessThan(opaque(flamePiece('h', 0)));
  });
});

describe('arenas', () => {
  it('10 temas; piso, bloco fixo e parede totalmente opacos', () => {
    expect(THEMES).toHaveLength(10);
    for (let st = 1; st <= 10; st++) {
      const t = stageTiles(st);
      for (const p of [t.floor, t.floorAlt, t.hard, t.wall]) expect(opaque(p)).toBe(256);
      expect(opaque(t.soft)).toBeGreaterThan(80);
      expect(t.bg).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('fonte', () => {
  it('largura e altura', () => {
    expect(textWidth('AB')).toBe(11);
    const p = textPix('AB', '#ffffff', null);
    expect([p.w, p.h]).toEqual([11, 10]);
    const s = textPix('AB', '#ffffff');
    expect([s.w, s.h]).toEqual([13, 12]);
  });
  it('acentos ficam acima da letra', () => {
    const p = textPix('Á', '#ffffff', null);
    expect(alphaAt(p, 3, 0)).toBe(255);
  });
  it('todos os textos do jogo têm glifos', () => {
    const texts = [...STAGE_NAMES, 'PRONTOS?', 'JÁ!', 'PAUSA', 'EMPATE!', 'P1 VENCEU!', 'TIME VERMELHO VENCEU!',
      'TIME BRANCO VENCEU!', 'PLACAR', 'VITÓRIA!', 'É O CAMPEÃO!', 'PRESSIONE START', 'CROWN BLAST', '--:--',
      'ENTER / START NO CONTROLE', '0123456789'];
    for (const t of texts) for (const ch of t.toUpperCase()) expect(hasGlyph(ch), `${t}: ${ch}`).toBe(true);
  });
});

describe('coroa e troféu', () => {
  it('tamanhos', () => {
    expect([crownPix().w, crownPix().h]).toEqual([12, 8]);
    const t = trophyPix();
    expect([t.w, t.h]).toEqual([24, 24]);
    expect(opaque(t)).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/art.test.ts`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Implementar `web/src/render/art/pix.ts`**

```ts
/** Imagem RGBA pura (sem DOM), usada para gerar toda a pixel art por código. */
export interface Pix { w: number; h: number; data: Uint8ClampedArray }

export type Palette = Record<string, string | null>;

export function makePix(w: number, h: number): Pix {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function setPx(p: Pix, x: number, y: number, hex: string): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const [r, g, b] = hexToRgb(hex);
  const i = (y * p.w + x) * 4;
  p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
}

export function alphaAt(p: Pix, x: number, y: number): number {
  return p.data[(y * p.w + x) * 4 + 3];
}

export function fillRect(p: Pix, x: number, y: number, w: number, h: number, hex: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(p, xx, yy, hex);
}

/** Converte linhas de caracteres em pixels. Caractere sem cor (ou null) = transparente. */
export function fromRows(rows: readonly string[], pal: Palette): Pix {
  const h = rows.length, w = rows[0].length;
  const p = makePix(w, h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`linha ${y} tem ${row.length} colunas, esperado ${w}`);
    for (let x = 0; x < w; x++) {
      const c = pal[row[x]];
      if (c) setPx(p, x, y, c);
    }
  });
  return p;
}

/** Copia `src` sobre `dst` em (dx,dy), respeitando transparência. */
export function blit(dst: Pix, src: Pix, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4;
    if (src.data[si + 3] === 0) continue;
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
    const di = (ty * dst.w + tx) * 4;
    dst.data[di] = src.data[si]; dst.data[di + 1] = src.data[si + 1];
    dst.data[di + 2] = src.data[si + 2]; dst.data[di + 3] = src.data[si + 3];
  }
}

export function flipH(src: Pix): Pix {
  const p = makePix(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (y * src.w + (src.w - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

/** Ruído determinístico por coordenada (0..255), para texturas. */
export function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h ^= h >>> 13; h = Math.imul(h, 1103515245);
  return (h >>> 16) & 255;
}
```

- [ ] **Step 4: Implementar `web/src/render/art/bomber.ts`**

```ts
import { fromRows, flipH, makePix, blit, type Pix, type Palette } from './pix';

/** Os 6 personagens originais do Crown Blast (só cosméticos). */
export interface CharacterDef { id: string; name: string; helmet: string; helmetShade: string; body: string; gloves: string; accent: string }

export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'blanco', name: 'BLANCO', helmet: '#f4f4f4', helmetShade: '#b8c0d0', body: '#2e5bd8', gloves: '#e8403a', accent: '#ff5fa2' },
  { id: 'gear', name: 'GEAR', helmet: '#9aa3ad', helmetShade: '#5d6670', body: '#3a3f46', gloves: '#f2b632', accent: '#39d98a' },
  { id: 'tigra', name: 'TIGRA', helmet: '#ff9a2e', helmetShade: '#c8641a', body: '#1f8a4c', gloves: '#fff1c9', accent: '#ffd23f' },
  { id: 'aero', name: 'AERO', helmet: '#dfe7ff', helmetShade: '#8ea0d0', body: '#3348a8', gloves: '#ffd23f', accent: '#6ad0ff' },
  { id: 'verdi', name: 'VERDI', helmet: '#46b35a', helmetShade: '#2a7a3a', body: '#1d3b2a', gloves: '#e9e3c8', accent: '#c8ff5a' },
  { id: 'rubi', name: 'RUBI', helmet: '#d8344a', helmetShade: '#8f1f33', body: '#5a2a8f', gloves: '#1b1b22', accent: '#ffb13b' },
];

const FRONT = [
  '......kppk......', '.....kppppk.....', '......kppk......', '.......kk.......',
  '....kkkkkkkk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '.khhkkkkkkkkhhk.',
  '.khksssssssskhk.', '.khksksssskskhk.', '.khksksssskskhk.', '.khksssssssskhk.',
  '..khkkkkkkkkhk..', '...kkHHHHHHkk...', '..kgkbbbbbbkgk..', '..kgkbbbbbbkgk..',
  '...kkbbbbbbkk...',
];
const BACK = [
  '......kppk......', '.....kppppk.....', '......kppk......', '.......kk.......',
  '....kkkkkkkk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '.khhhhhhhhhhhhk.',
  '.khhhhhhhhhhhhk.', '.khhhhhhhhhhhhk.', '.khHhhhhhhhhHhk.', '.kHHhhhhhhhhHHk.',
  '..kHHHHHHHHHHk..', '...kkkkkkkkkk...', '..kgkbbbbbbkgk..', '..kgkbbbbbbkgk..',
  '...kkbbbbbbkk...',
];
const SIDE = [ // olhando para a direita
  '......kpk.......', '.....kppk.......', '......kpk.......', '.......kk.......',
  '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '..khhhhhkkkkhk..',
  '..khhhhksssskk..', '..khhhhkssksk...', '..khhhhkssksk...', '..kHhhhksssskk..',
  '...kHhhhkkkkk...', '....kkHHHHkk....', '.....kbbbbk.....', '.....kbbgkk.....',
  '.....kbbggk.....',
];
const LEGS_FRONT = [
  ['....kbbkkbbk....', '...kgggkkgggk...', '...kkkkkkkkkk...'],
  ['...kgggkkbbk....', '...kkkkkkgggk...', '.........kkkk...'],
  ['....kbbkkgggk...', '...kgggkkkkkk...', '...kkkk.........'],
];
const LEGS_SIDE = [
  ['......kbbk......', '.....kgggk......', '.....kkkkk......'],
  ['.....kbkkbk.....', '....kggkkggk....', '....kkk..kkk....'],
  ['......kbbk......', '......kggk......', '......kkkk......'],
];
/** Topo da cabeça (linhas 0–5) de cada personagem: frente/costas e perfil. */
const TOP: Record<string, string[] | null> = {
  blanco: null,
  gear: ['......kppk......', '......kppk......', '.......kk.......', '.......kk.......', '....kkkkkkkk....', '...khhhhhhhhk...'],
  tigra: ['................', '................', '...kk......kk...', '...kpk....kpk...', '...kpkkkkkkpk...', '...khhhhhhhhk...'],
  aero: ['....k......k....', '...kpk....kpk...', '...kppk..kppk...', '....kppkkppk....', '....kkkkkkkk....', '...khhhhhhhhk...'],
  verdi: ['.......pp.......', '......kppk......', '......kppk......', '......kppk......', '....kkkppkkk....', '...khhhhhhhhk...'],
  rubi: ['................', '..kk........kk..', '..kpk......kpk..', '...kpk....kpk...', '....kpkkkkpk....', '...khhhhhhhhk...'],
};
const SIDE_TOP: Record<string, string[] | null> = {
  blanco: null,
  gear: ['......kppk......', '......kppk......', '.......kk.......', '.......kk.......', '.....kkkkkk.....', '....khhhhhhk....'],
  tigra: ['................', '................', '....kk...kk.....', '....kpk..kpk....', '.....kpkkkpk....', '....khhhhhhk....'],
  aero: ['................', '..kk............', '..kppk..........', '...kppkk........', '....kppkkkk.....', '....khhhhhhk....'],
  verdi: ['................', '.....kpppk......', '....kppppk......', '.....kpppk......', '.....kkkkkk.....', '....khhhhhhk....'],
  rubi: ['................', '...kk.....kk....', '...kpk...kpk....', '....kpk.kpk.....', '.....kkkkkk.....', '....khhhhhhk....'],
};
/** Monóculo do Gear (só de frente). */
const MONOCLE: [number, number][] = [[8, 9], [8, 10], [8, 11], [9, 9], [9, 11], [10, 9], [10, 11], [11, 9], [11, 10], [11, 11]];

function palette(c: CharacterDef): Palette {
  return { '.': null, k: '#141018', h: c.helmet, H: c.helmetShade, s: '#ffe7c7', b: c.body, g: c.gloves, p: c.accent, w: '#ffffff' };
}

function assemble(base: string[], top: string[] | null, legs: string[], monocle: boolean): string[] {
  const rows = [...(top ?? base.slice(0, 6)), ...base.slice(6), ...legs].map(r => r.split(''));
  if (monocle) for (const [r, c] of MONOCLE) rows[r][c] = 'p';
  return rows.map(r => r.join(''));
}

/** dir: 1 cima, 2 baixo, 3 esquerda, 4 direita (igual ao DIR do core). frame: 0 parado, 1 e 2 caminhando. Sprite 16×20. */
export function bomberFrame(charIndex: number, dir: number, frame: number): Pix {
  const c = CHARACTERS[charIndex];
  const pal = palette(c);
  if (dir === 1) return fromRows(assemble(BACK, TOP[c.id], LEGS_FRONT[frame], false), pal);
  if (dir === 3 || dir === 4) {
    const p = fromRows(assemble(SIDE, SIDE_TOP[c.id], LEGS_SIDE[frame], false), pal);
    return dir === 3 ? flipH(p) : p;
  }
  return fromRows(assemble(FRONT, TOP[c.id], LEGS_FRONT[frame], c.id === 'gear'), pal);
}

/** Ícone de cabeça 16×14 para HUD e placar. */
export function headIcon(charIndex: number): Pix {
  const full = bomberFrame(charIndex, 2, 0);
  const p = makePix(16, 14);
  blit(p, full, 0, 0);
  return p;
}
```

- [ ] **Step 5: Implementar `web/src/render/art/items.ts`**

```ts
import { fromRows, makePix, fillRect, blit, type Pix } from './pix';

const BOMB_ROWS = [
  '...........yy...', '..........ywy...', '.........f.yy...', '........f.......',
  '.....kkkkf......', '...kkbbbbkk.....', '..kbbbbbbbbk....', '.kbWWbbbbbbbk...',
  '.kbWbbbbbbbbk...', '.kbbbbbbbbbbk...', '.kbbbbbbbbbbk...', '.kbbbbbbbbbBk...',
  '..kbbbbbbbBk....', '...kkbbbBBk.....', '.....kkkkk......', '................',
];

/** Bomba 16×16. frame 0/1 alterna a faísca e a cor do corpo (pulsar). */
export function bombPix(frame: number): Pix {
  return fromRows(BOMB_ROWS, {
    '.': null, k: '#0b0b14', b: frame ? '#34406a' : '#27304f', B: '#151a2e', W: '#c9d6ff',
    f: '#b0773a', y: frame ? '#ff7a1a' : '#ffd23f', w: '#ffffff',
  });
}

/** Glifos 12×12 dos itens, na ordem do ITEM do core (1..8). */
const ICONS: Record<number, string[]> = {
  1: ['....kkk.y...', '...k...ky...', '..kkkkkk....', '.kaaaaaak...', 'kaawaaaaak..', 'kawaaaaaak..', 'kaaaaaaaak..', 'kaaaaaaaak..', '.kaaaaaak...', '..kkkkkk....', '............', '............'],
  2: ['.....k......', '....kak.....', '....kaak....', '...kacak....', '..kaccak.k..', '..kacccakak.', '.kacccccaak.', '.kaccwccak..', '.kacwwwcak..', '..kacwcak...', '...kaaak....', '....kkk.....'],
  3: ['......kkkkk.', '.....kaaak..', '....kaaak...', '...kaaak....', '..kaaakkkk..', '.kaaaaaaak..', '.kkkkaaak...', '....kaak....', '...kaak.....', '..kaak......', '.kak........', '.kk.........'],
  4: ['....kkk.....', '...kaaak....', '...kaaak....', '...kaaak....', '...kaaakkk..', '..kaaaaaaak.', '..kaaaaaaaak', '.kaaaaaaaaak', '.kccccccccck', '.kkkkkkkkkk.', '............', '............'],
  5: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.', '..kwwwwwwk..', '...kwkwkwk..', '...kkkkkk...', '............', '............', '............'],
  6: ['............', '..kkkkkkk...', '.kaakaakak..', '.kaakaakaak.', '.kaaaaaaaak.', '.kaaaaaaaak.', '.kaaaaaaak..', '..kaaaaaak..', '...kccccck..', '...kccccck..', '...kkkkkkk..', '............'],
  7: ['..k.k.k.....', '.kakakak....', '.kakakak.k..', '.kakakakak..', '.kaaaaaaak..', '.kaaaaaaak..', '.kaaaaaak...', '..kaaaaak...', '..kcccccck..', '..kcccccck..', '..kkkkkkkk..', '............'],
  8: ['............', '..kkkkkkk...', '..kaaaaaak..', '..kaakkkaak.', '..kaak.kaak.', '..kaakkkaak.', '..kaaaaaak..', '..kaakkkk...', '..kaak......', '..kaak......', '..kkkk......', '............'],
};
/** [fundo, borda clara, cor a, cor c] de cada item. */
const STYLE: Record<number, [string, string, string, string]> = {
  1: ['#2d6bff', '#9fc0ff', '#1b1f33', '#ffffff'],
  2: ['#ff7a1a', '#ffd08a', '#ffd23f', '#ff3b1a'],
  3: ['#28c2b0', '#aef5ea', '#ffe45a', '#ffffff'],
  4: ['#8f5cff', '#d7c4ff', '#e8403a', '#ffffff'],
  5: ['#3a1d4a', '#b58cff', '#ffffff', '#ffffff'],
  6: ['#ff4f7a', '#ffc2d2', '#ffe7c7', '#e8403a'],
  7: ['#2fa84f', '#b5f2c4', '#2d6bff', '#ffffff'],
  8: ['#ffb000', '#ffe29a', '#e8403a', '#ffffff'],
};

/** Placa de item 16×16. */
export function itemIcon(item: number): Pix {
  const [bg, border, a, c] = STYLE[item];
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, '#0b0b14');
  fillRect(p, 1, 1, 14, 14, border);
  fillRect(p, 2, 2, 12, 12, bg);
  blit(p, fromRows(ICONS[item], { '.': null, k: '#0b0b14', a, c, w: '#ffffff', y: '#ffd23f' }), 2, 2);
  return p;
}
```

- [ ] **Step 6: Implementar `web/src/render/art/flames.ts`**

```ts
import { makePix, fillRect, type Pix } from './pix';

export type FlamePart = 'center' | 'h' | 'v' | 'up' | 'down' | 'left' | 'right';

const BANDS = ['#ff3b1a', '#ff9a1a', '#ffe45a', '#ffffff'];
/** Meia-altura de cada faixa (de fora para dentro). */
const HALF = [6, 4, 2, 1];

function transpose(src: Pix): Pix {
  const p = makePix(src.h, src.w);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (x * p.w + y) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

function mirrorX(src: Pix): Pix {
  const p = makePix(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (y * src.w + (src.w - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

/** Braço horizontal; `tip` = termina com ponta arredondada à direita. */
function horizontal(shrink: number, tip: boolean): Pix {
  const p = makePix(16, 16);
  for (let i = shrink; i < BANDS.length; i++) {
    const t = 8 - HALF[i], b = 7 + HALF[i];
    const end = tip ? 11 - i * 2 : 15;
    fillRect(p, 0, t, end + 1, b - t + 1, BANDS[i]);
    if (tip && b - t > 1) fillRect(p, end + 1, t + 1, 2, b - t - 1, BANDS[i]);
  }
  return p;
}

/**
 * Peça de chama 16×16. `shrink` (0..3) afina a chama: use 0 no meio da explosão
 * e valores maiores no começo e no fim, para animar.
 */
export function flamePiece(part: FlamePart, shrink: number): Pix {
  const s = Math.max(0, Math.min(3, shrink));
  switch (part) {
    case 'h': return horizontal(s, false);
    case 'v': return transpose(horizontal(s, false));
    case 'right': return horizontal(s, true);
    case 'left': return mirrorX(horizontal(s, true));
    case 'down': return transpose(horizontal(s, true));
    case 'up': return transpose(mirrorX(horizontal(s, true)));
    case 'center': {
      const p = makePix(16, 16);
      for (let i = s; i < BANDS.length; i++) {
        const t = 8 - HALF[i], len = HALF[i] * 2;
        fillRect(p, 0, t, 16, len, BANDS[i]);
        fillRect(p, t, 0, len, 16, BANDS[i]);
        fillRect(p, t - 1, t - 1, len + 2, len + 2, BANDS[i]);
      }
      return p;
    }
  }
}
```

- [ ] **Step 7: Implementar `web/src/render/art/tiles.ts`**

```ts
import { makePix, fillRect, setPx, noise, type Pix } from './pix';

type FloorKind = 'grass' | 'checker' | 'planks' | 'plates' | 'stars' | 'tiles' | 'sand' | 'carpet';
type SoftKind = 'brick' | 'crate' | 'bush' | 'rock' | 'fabric';

export interface Theme {
  floor: FloorKind; floorA: string; floorB: string;
  hardFace: string; hardLight: string; hardDark: string;
  wallFace: string; wallLight: string; wallDark: string;
  soft: SoftKind; softA: string; softB: string; softDark: string;
  bg: string;           // cor de fundo fora da arena
}

/** Um tema por fase, na ordem de STAGE_NAMES. */
export const THEMES: readonly Theme[] = [
  { floor: 'grass', floorA: '#3f9e4a', floorB: '#4cb058', hardFace: '#a9aeb8', hardLight: '#dde1e8', hardDark: '#666b75', wallFace: '#8a8f99', wallLight: '#b9bdc6', wallDark: '#4f535b', soft: 'brick', softA: '#c3c7cf', softB: '#9da2ac', softDark: '#6d727c', bg: '#2b3b2e' },
  { floor: 'plates', floorA: '#4a5563', floorB: '#58646f', hardFace: '#6f86a3', hardLight: '#a9bdd6', hardDark: '#3e4e63', wallFace: '#8a5a36', wallLight: '#b98357', wallDark: '#51331d', soft: 'crate', softA: '#c48a45', softB: '#a36d31', softDark: '#6b4520', bg: '#1f242b' },
  { floor: 'stars', floorA: '#141a3a', floorB: '#1d2552', hardFace: '#7a7fa8', hardLight: '#b3b8e0', hardDark: '#44486b', wallFace: '#3a3f6b', wallLight: '#6b72b0', wallDark: '#20233f', soft: 'rock', softA: '#9a7a62', softB: '#7c5f49', softDark: '#4f3a2b', bg: '#070918' },
  { floor: 'grass', floorA: '#2f7d3a', floorB: '#378a43', hardFace: '#8d8a80', hardLight: '#bdbab0', hardDark: '#55534c', wallFace: '#5b4632', wallLight: '#806449', wallDark: '#34271b', soft: 'bush', softA: '#4fbf5f', softB: '#3a9a49', softDark: '#1f5e2a', bg: '#16301a' },
  { floor: 'planks', floorA: '#b88a52', floorB: '#a67943', hardFace: '#c9b48c', hardLight: '#efe0bd', hardDark: '#86734f', wallFace: '#2d5a3d', wallLight: '#4b8a62', wallDark: '#173322', soft: 'brick', softA: '#d86a4a', softB: '#b8523a', softDark: '#7a3322', bg: '#1d2a22' },
  { floor: 'tiles', floorA: '#2f8f6f', floorB: '#287a5f', hardFace: '#b0a47a', hardLight: '#ddd2a8', hardDark: '#716846', wallFace: '#8a7a50', wallLight: '#b5a473', wallDark: '#51472c', soft: 'rock', softA: '#d2a860', softB: '#b08842', softDark: '#72552a', bg: '#1a2b25' },
  { floor: 'sand', floorA: '#a0703a', floorB: '#b07e46', hardFace: '#6b6b5e', hardLight: '#9d9d8d', hardDark: '#3f3f36', wallFace: '#3e6b3a', wallLight: '#5f9a58', wallDark: '#223e20', soft: 'bush', softA: '#35b066', softB: '#27904f', softDark: '#155530', bg: '#1f2a17' },
  { floor: 'checker', floorA: '#ececec', floorB: '#48b878', hardFace: '#e0b030', hardLight: '#fff0a0', hardDark: '#9a7412', wallFace: '#a02b3a', wallLight: '#d04a5a', wallDark: '#5e1420', soft: 'crate', softA: '#e04a4a', softB: '#b83434', softDark: '#6e1d1d', bg: '#2a0d14' },
  { floor: 'sand', floorA: '#d8b56a', floorB: '#e6c57c', hardFace: '#9a6a3a', hardLight: '#c99662', hardDark: '#5c3e1f', wallFace: '#6a8fc8', wallLight: '#9dbcec', wallDark: '#3a5580', soft: 'crate', softA: '#e8c54a', softB: '#c9a334', softDark: '#8a6c1c', bg: '#2d3a55' },
  { floor: 'carpet', floorA: '#7a3a8f', floorB: '#8f4aa6', hardFace: '#8a5a3a', hardLight: '#b98357', hardDark: '#4f311d', wallFace: '#c0b8a8', wallLight: '#ece6d8', wallDark: '#7a7466', soft: 'fabric', softA: '#e86a9a', softB: '#c84a7a', softDark: '#7a2448', bg: '#24122b' },
];

function paintFloor(t: Theme, alt: boolean, seed: number): Pix {
  const p = makePix(16, 16);
  const A = alt ? t.floorB : t.floorA, B = alt ? t.floorA : t.floorB;
  fillRect(p, 0, 0, 16, 16, A);
  switch (t.floor) {
    case 'grass':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 40) setPx(p, x, y, B);
      break;
    case 'sand':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 25) setPx(p, x, y, B);
      break;
    case 'checker':
      fillRect(p, 0, 0, 8, 8, B); fillRect(p, 8, 8, 8, 8, B);
      break;
    case 'planks':
      for (let y = 0; y < 16; y += 4) fillRect(p, 0, y + 3, 16, 1, B);
      for (let y = 0; y < 16; y += 4) setPx(p, (y * 5 + seed) % 16, y + 1, B);
      break;
    case 'plates':
      fillRect(p, 0, 15, 16, 1, B); fillRect(p, 15, 0, 1, 16, B);
      setPx(p, 2, 2, B); setPx(p, 12, 2, B); setPx(p, 2, 12, B); setPx(p, 12, 12, B);
      break;
    case 'stars':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 6) setPx(p, x, y, '#ffffff');
      break;
    case 'tiles':
      fillRect(p, 0, 0, 16, 1, B); fillRect(p, 0, 0, 1, 16, B); fillRect(p, 8, 0, 1, 16, B); fillRect(p, 0, 8, 16, 1, B);
      break;
    case 'carpet':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) setPx(p, x, y, B);
      break;
  }
  return p;
}

function bevel(face: string, light: string, dark: string): Pix {
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, dark);
  fillRect(p, 0, 0, 15, 15, light);
  fillRect(p, 1, 1, 14, 14, dark);
  fillRect(p, 1, 1, 13, 13, face);
  fillRect(p, 2, 2, 11, 1, light);
  fillRect(p, 2, 2, 1, 11, light);
  return p;
}

function paintSoft(t: Theme, seed: number): Pix {
  const p = makePix(16, 16);
  const { softA: A, softB: B, softDark: D } = t;
  switch (t.soft) {
    case 'brick':
      fillRect(p, 0, 0, 16, 16, D);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let bx = -8; bx < 16; bx += 8) fillRect(p, bx + off + 1, row * 4 + 1, 6, 2, row % 2 ? B : A);
      }
      break;
    case 'crate':
      fillRect(p, 0, 0, 16, 16, D); fillRect(p, 1, 1, 14, 14, A);
      fillRect(p, 1, 1, 14, 2, B); fillRect(p, 1, 13, 14, 2, B);
      for (let i = 3; i < 13; i++) { setPx(p, i, i, D); setPx(p, 15 - i, i, D); }
      break;
    case 'bush':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 8.5, r = dx * dx + dy * dy;
        if (r < 60) setPx(p, x, y, noise(x, y, seed) < 70 ? B : A);
        else if (r < 72) setPx(p, x, y, D);
      }
      setPx(p, 5, 5, '#ffffff');
      break;
    case 'rock':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = (x - 7.5) / 7.5, dy = (y - 8.5) / 6.5, r = dx * dx + dy * dy;
        if (r < 0.85) setPx(p, x, y, x + y < 12 ? A : B);
        else if (r < 1.05) setPx(p, x, y, D);
      }
      break;
    case 'fabric':
      fillRect(p, 1, 2, 14, 12, D);
      for (let y = 3; y < 13; y++) fillRect(p, 2, y, 12, 1, y % 3 === 0 ? B : A);
      fillRect(p, 0, 4, 1, 8, D); fillRect(p, 15, 4, 1, 8, D);
      break;
  }
  return p;
}

/** Bloco queimando: o soft block com faíscas por cima (frame 0/1). */
function burning(soft: Pix, frame: number, seed: number): Pix {
  const p = makePix(16, 16);
  p.data.set(soft.data);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise(x, y, seed + frame * 7);
    if (n < 90) setPx(p, x, y, n < 30 ? '#ffe45a' : n < 60 ? '#ff9a1a' : '#ff3b1a');
  }
  return p;
}

export interface StageTiles { floor: Pix; floorAlt: Pix; hard: Pix; wall: Pix; soft: Pix; burning: [Pix, Pix]; bg: string }

export function stageTiles(stage: number): StageTiles {
  const t = THEMES[stage - 1];
  const soft = paintSoft(t, stage);
  return {
    floor: paintFloor(t, false, stage), floorAlt: paintFloor(t, true, stage + 50),
    hard: bevel(t.hardFace, t.hardLight, t.hardDark), wall: bevel(t.wallFace, t.wallLight, t.wallDark),
    soft, burning: [burning(soft, 0, stage), burning(soft, 1, stage)], bg: t.bg,
  };
}
```

- [ ] **Step 8: Implementar `web/src/render/art/font.ts`**

```ts
import { makePix, setPx, type Pix } from './pix';

/** Fonte bitmap 5×7 só de maiúsculas. Cada glifo ocupa 6 px de avanço e 10 px de altura (2 de acento + 7 + 1 de cedilha). */
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  'º': ['.##..', '#..#.', '.##..', '####.', '.....', '.....', '.....'],
};

const MARKS: Record<string, string[]> = {
  acute: ['...#.', '..#..'], grave: ['.#...', '..#..'], circ: ['..#..', '.#.#.'], tilde: ['.##.#', '#.##.'],
};
/** Letra acentuada → [base, acento]. Ç usa cedilha. */
const ACCENTED: Record<string, [string, string]> = {
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
  'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'], 'Ç': ['C', 'cedilla'],
};

export const GLYPH_ADVANCE = 6;
export const LINE_HEIGHT = 10;

export function hasGlyph(ch: string): boolean {
  return ch in G || ch in ACCENTED;
}

/** Largura em pixels do texto (já em maiúsculas). */
export function textWidth(text: string): number {
  return Math.max(0, text.length * GLYPH_ADVANCE - 1);
}

/**
 * Renderiza `text` numa imagem com a cor dada. `shadow` desenha contorno escuro de 1 px
 * (a imagem ganha 1 px de margem em cada lado).
 */
export function textPix(text: string, color: string, shadow: string | null = '#0b0b14'): Pix {
  const up = text.toUpperCase();
  const pad = shadow ? 1 : 0;
  const p = makePix(textWidth(up) + pad * 2, LINE_HEIGHT + pad * 2);
  const plot = (x: number, y: number) => {
    if (shadow) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) {
      const i = ((y + dy + pad) * p.w + (x + dx + pad)) * 4;
      if (p.data[i + 3] === 0) setPx(p, x + dx + pad, y + dy + pad, shadow);
    }
  };
  const ink = (x: number, y: number) => setPx(p, x + pad, y + pad, color);
  const glyphs: { x: number; rows: string[]; mark: string[] | null; ced: boolean }[] = [];
  [...up].forEach((ch, i) => {
    const acc = ACCENTED[ch];
    const base = acc ? acc[0] : ch;
    const rows = G[base] ?? G['?'];
    const markName = acc?.[1];
    glyphs.push({ x: i * GLYPH_ADVANCE, rows, mark: markName && markName !== 'cedilla' ? MARKS[markName] : null, ced: markName === 'cedilla' });
  });
  // primeiro todas as sombras, depois a tinta (para a sombra nunca cobrir letra vizinha)
  for (const pass of [plot, ink]) for (const g of glyphs) {
    g.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') pass(g.x + x, y + 2); }));
    g.mark?.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') pass(g.x + x, y); }));
    if (g.ced) { pass(g.x + 2, 9); }
  }
  return p;
}
```

- [ ] **Step 9: Implementar `web/src/render/art/trophy.ts`**

```ts
import { fromRows, makePix, setPx, fillRect, type Pix } from './pix';

const CROWN = [
  '.k...kk...k.', 'kyk.kyyk.kyk', 'kyykyyyykyyk', 'kyyyyyyyyyyk',
  'kyyryyyyryyk', 'kyyyyyyyyyyk', 'kYYYYYYYYYYk', '.kkkkkkkkkk.',
];

/** Coroa 12×8 do placar (uma por vitória). */
export function crownPix(): Pix {
  return fromRows(CROWN, { '.': null, k: '#0b0b14', y: '#ffd23f', Y: '#c8961a', r: '#e8403a' });
}

/** Troféu 24×24 da tela de vitória, desenhado por formas. */
export function trophyPix(): Pix {
  const p = makePix(24, 24);
  const gold = '#ffd23f', shade = '#c8961a', dark = '#8a6410', ink = '#0b0b14', shine = '#fff6c0';
  // taça: meia-elipse de 16×12 com contorno
  for (let y = 0; y < 13; y++) for (let x = 0; x < 24; x++) {
    const dx = (x - 11.5) / 8.5, dy = y / 12.5;
    const r = dx * dx + dy * dy;
    if (y === 0 && Math.abs(x - 11.5) <= 8.5) setPx(p, x, y, ink);
    else if (r < 0.8) setPx(p, x, y, x < 10 ? gold : x < 15 ? shade : dark);
    else if (r < 1.0) setPx(p, x, y, ink);
  }
  fillRect(p, 5, 2, 2, 5, shine);
  // alças
  for (const [x0, dir] of [[3, -1], [20, 1]] as const) for (let y = 2; y < 9; y++) {
    const x = x0 + dir * (y > 3 && y < 7 ? 1 : 0);
    setPx(p, x, y, ink); setPx(p, x - dir, y, gold);
  }
  // haste e base
  fillRect(p, 10, 13, 4, 4, ink); fillRect(p, 11, 13, 2, 4, shade);
  fillRect(p, 6, 17, 12, 3, ink); fillRect(p, 7, 17, 10, 2, gold);
  fillRect(p, 4, 20, 16, 4, ink); fillRect(p, 5, 20, 14, 3, shade); fillRect(p, 5, 20, 14, 1, gold);
  return p;
}
```

- [ ] **Step 10: Rodar e ver passar; typecheck**

Run: `cd web && npx vitest run tests/client/art.test.ts && npx tsc --noEmit`
Expected: PASS; tsc limpo

- [ ] **Step 11: Commit**

```bash
git add web/src/render/art web/tests/client/art.test.ts
git commit -m "feat(client): pixel art original gerada por código (personagens, itens, chamas, arenas, fonte)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Entrada (teclado + gamepad) e loop de passo fixo

**Files:**
- Create: `web/src/input/input.ts`, `web/src/app/loop.ts`
- Test: `web/tests/client/input-loop.test.ts`

**Interfaces:**
- Consumes: `BTN` de `../core`
- Produces:
  - `interface KeyMap { up; down; left; right; a; b; y; start: string }`, `DEFAULT_KEYMAPS: KeyMap[]`
  - `readKeyboard(down: ReadonlySet<string>, maps): number[]` (5 entradas), `interface GamepadLike`, `readGamepad(gp | null): number`, `mergePads(kb: number[], gps: (GamepadLike|null)[]): number[]`
  - `class InputManager { constructor(target: Window, maps?); poll(): number[] }`
  - `STEP_MS`, `MAX_STEPS`, `stepsFor(acc, dtMs): { steps; acc }`, `startLoop(step: () => void, render: () => void): void`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/client/input-loop.test.ts`:
```ts
import { readKeyboard, readGamepad, mergePads, DEFAULT_KEYMAPS, type GamepadLike } from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/core';

const pad = (pressed: number[], axes: number[] = [0, 0]): GamepadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes,
});

describe('teclado', () => {
  it('mapeamento padrão de P1 e P2', () => {
    const out = readKeyboard(new Set(['KeyW', 'KeyJ', 'ArrowLeft', 'Numpad3', 'NumpadEnter']), DEFAULT_KEYMAPS);
    expect(out).toEqual([BTN.UP | BTN.A, BTN.LEFT | BTN.Y | BTN.START, 0, 0, 0]);
  });
  it('Enter é START do P1', () => {
    expect(readKeyboard(new Set(['Enter']), DEFAULT_KEYMAPS)[0]).toBe(BTN.START);
  });
});

describe('gamepad', () => {
  it('botões e d-pad', () => {
    expect(readGamepad(pad([1, 12]))).toBe(BTN.A | BTN.UP);
    expect(readGamepad(pad([0, 2, 9]))).toBe(BTN.B | BTN.Y | BTN.START);
    expect(readGamepad(pad([13, 14]))).toBe(BTN.DOWN | BTN.LEFT);
  });
  it('analógico com zona morta 0,5', () => {
    expect(readGamepad(pad([], [0.9, 0]))).toBe(BTN.RIGHT);
    expect(readGamepad(pad([], [0, -0.8]))).toBe(BTN.UP);
    expect(readGamepad(pad([], [0.3, 0.3]))).toBe(0);
  });
  it('sem gamepad = 0; mergePads soma com o teclado por índice', () => {
    expect(readGamepad(null)).toBe(0);
    expect(mergePads([BTN.UP, 0, 0, 0, 0], [null, pad([1])])).toEqual([BTN.UP, BTN.A, 0, 0, 0]);
  });
});

describe('loop de passo fixo', () => {
  it('um frame de 1/60 s = 1 passo', () => {
    expect(stepsFor(0, STEP_MS).steps).toBe(1);
  });
  it('acumula frações', () => {
    const a = stepsFor(0, 10);
    expect(a.steps).toBe(0);
    const b = stepsFor(a.acc, 10);
    expect(b.steps).toBe(1);
    expect(b.acc).toBeCloseTo(20 - STEP_MS, 5);
  });
  it('limita a MAX_STEPS e descarta o atraso', () => {
    const r = stepsFor(0, 1000);
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.acc).toBeLessThanOrEqual(STEP_MS);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/input-loop.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `web/src/input/input.ts`**

```ts
import { BTN } from '../core';

export interface KeyMap { up: string; down: string; left: string; right: string; a: string; b: string; y: string; start: string }

/** Spec §11: P1 WASD + J/K/L + Enter; P2 setas + Numpad1/2/3 + NumpadEnter. */
export const DEFAULT_KEYMAPS: KeyMap[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyK', y: 'KeyL', start: 'Enter' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Numpad1', b: 'Numpad2', y: 'Numpad3', start: 'NumpadEnter' },
];

export function readKeyboard(down: ReadonlySet<string>, maps: readonly KeyMap[]): number[] {
  const out = [0, 0, 0, 0, 0];
  maps.slice(0, 5).forEach((m, i) => {
    let v = 0;
    if (down.has(m.up)) v |= BTN.UP;
    if (down.has(m.down)) v |= BTN.DOWN;
    if (down.has(m.left)) v |= BTN.LEFT;
    if (down.has(m.right)) v |= BTN.RIGHT;
    if (down.has(m.a)) v |= BTN.A;
    if (down.has(m.b)) v |= BTN.B;
    if (down.has(m.y)) v |= BTN.Y;
    if (down.has(m.start)) v |= BTN.START;
    out[i] = v;
  });
  return out;
}

export interface GamepadLike { buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number> }

const DEAD_ZONE = 0.5;

/** Layout "standard" da Gamepad API: A = 1 (direita), B = 0 (baixo), Y = 2 (esquerda), START = 9, d-pad 12–15. */
export function readGamepad(gp: GamepadLike | null): number {
  if (!gp) return 0;
  const b = (i: number) => !!gp.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  let v = 0;
  if (b(12) || ay < -DEAD_ZONE) v |= BTN.UP;
  if (b(13) || ay > DEAD_ZONE) v |= BTN.DOWN;
  if (b(14) || ax < -DEAD_ZONE) v |= BTN.LEFT;
  if (b(15) || ax > DEAD_ZONE) v |= BTN.RIGHT;
  if (b(1)) v |= BTN.A;
  if (b(0)) v |= BTN.B;
  if (b(2)) v |= BTN.Y;
  if (b(9)) v |= BTN.START;
  return v;
}

export function mergePads(kb: number[], gps: (GamepadLike | null)[]): number[] {
  return kb.map((v, i) => v | readGamepad(gps[i] ?? null));
}

export class InputManager {
  private down = new Set<string>();
  private gameKeys: Set<string>;

  constructor(target: Window, private maps: KeyMap[] = DEFAULT_KEYMAPS) {
    this.gameKeys = new Set(maps.flatMap(m => Object.values(m)));
    target.addEventListener('keydown', e => {
      if (this.gameKeys.has(e.code)) e.preventDefault();
      this.down.add(e.code);
    });
    target.addEventListener('keyup', e => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  poll(): number[] {
    const gps = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    return mergePads(readKeyboard(this.down, this.maps), gps as (GamepadLike | null)[]);
  }
}
```

- [ ] **Step 4: Implementar `web/src/app/loop.ts`**

```ts
export const STEP_MS = 1000 / 60;
export const MAX_STEPS = 5;

/** Quantos ticks de 60 Hz rodar para `dtMs` decorridos, e quanto sobra no acumulador. */
export function stepsFor(acc: number, dtMs: number): { steps: number; acc: number } {
  let a = acc + Math.max(0, Math.min(dtMs, 250));
  let steps = 0;
  while (a >= STEP_MS && steps < MAX_STEPS) { a -= STEP_MS; steps++; }
  if (steps === MAX_STEPS) a = Math.min(a, STEP_MS);
  return { steps, acc: a };
}

export function startLoop(step: () => void, render: () => void): void {
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const r = stepsFor(acc, now - last);
    last = now; acc = r.acc;
    for (let i = 0; i < r.steps; i++) step();
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

- [ ] **Step 5: Rodar e ver passar; typecheck**

Run: `cd web && npx vitest run tests/client/input-loop.test.ts && npx tsc --noEmit`
Expected: PASS; tsc limpo

- [ ] **Step 6: Commit**

```bash
git add web/src/input web/src/app web/tests/client/input-loop.test.ts
git commit -m "feat(client): entrada por teclado e gamepad (5 controles) e loop de passo fixo 60 Hz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Configuração pela URL e sessão (batalha → placar → vitória)

**Files:**
- Create: `web/src/game/config.ts`, `web/src/game/session.ts`
- Test: `web/tests/client/session.test.ts`

**Interfaces:**
- Consumes: `defaultRules`, `BTN`, `createMatch`, `startRound`, `finishRound`, `step`, tipos `Rules`, `MatchState`, `RoundState`, `GameEvent` de `../core`
- Produces:
  - `interface GameConfig { rules: Rules; stage: number; chars: number[]; seed: number | null }`, `parseConfig(search: string): GameConfig`
  - `ROUND_OVER_FRAMES = 150`, `SCOREBOARD_FRAMES = 540`, `SKIP_AFTER = 60`
  - `type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory'`
  - `interface Session { cfg; seed; matchNo; match; round; phase; timer; paused; prevPads; lastWinners; champions }`
  - `createSession(cfg, seed): Session`, `updateSession(s, pads: number[]): GameEvent[]`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/client/session.test.ts`:
```ts
import { parseConfig } from '../../src/game/config';
import { createSession, updateSession, ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER, type Session } from '../../src/game/session';
import { BTN, INTRO_FRAMES } from '../../src/core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_FRAMES + 1);
  s.round.players.forEach((p, i) => { if (i !== winner) p.alive = false; });
  run(s, 1);
};

describe('parseConfig', () => {
  it('padrões', () => {
    const c = parseConfig('');
    expect(c.stage).toBe(1);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect([c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([3, 2, true, 'ffa']);
    expect(c.chars).toEqual([0, 1, 2, 3, 4]);
    expect(c.seed).toBeNull();
  });
  it('lê e limita os parâmetros', () => {
    const c = parseConfig('?stage=12&players=1&matches=9&time=4&chars=5,5,x&seed=42&mode=team&sd=1&racer=1&spawns=0');
    expect(c.stage).toBe(10);
    expect(c.rules.active).toEqual([true, true, false, false, false]);
    expect([c.rules.matches, c.rules.timeIdx]).toEqual([5, 4]);
    expect(c.chars).toEqual([5, 5, 2, 3, 4]);
    expect(c.seed).toBe(42);
    expect([c.rules.mode, c.rules.suddenDeath, c.rules.racer, c.rules.randomSpawns]).toEqual(['team', true, true, false]);
  });
});

describe('sessão', () => {
  it('começa em batalha com a rodada em intro', () => {
    const s = createSession(parseConfig(''), 1);
    expect(s.phase).toBe('battle');
    expect(s.round.phase).toBe('intro');
    run(s, INTRO_FRAMES + 1);
    expect(s.round.phase).toBe('playing');
  });
  it('fim de rodada → placar com coroa → próxima rodada', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.match.crowns[1]).toBe(1);
    expect(s.lastWinners).toEqual([1]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('battle');
    expect(s.match.roundNo).toBe(2);
  });
  it('placar só pode ser pulado depois de SKIP_AFTER frames', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES);
    run(s, 30); tap(s, 0, BTN.START);
    expect(s.phase).toBe('scoreboard');
    run(s, SKIP_AFTER); tap(s, 0, BTN.START);
    expect(s.phase).toBe('battle');
  });
  it('meta atingida → vitória → START começa partida nova zerada', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES); run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    expect(s.champions).toEqual([0]);
    tap(s, 0, BTN.START);
    expect(s.phase).toBe('victory');
    run(s, SKIP_AFTER); tap(s, 1, BTN.A);
    expect(s.phase).toBe('battle');
    expect(s.matchNo).toBe(2);
    expect(s.match.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('START pausa e retoma; slot inativo não pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 10);
    tap(s, 4, BTN.START);
    expect(s.paused).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    const f = s.round.frame;
    run(s, 20);
    expect(s.round.frame).toBe(f);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/session.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `web/src/game/config.ts`**

```ts
import { defaultRules, type Rules } from '../core';

export interface GameConfig { rules: Rules; stage: number; chars: number[]; seed: number | null }

function int(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/**
 * Regras a partir da URL (até o Plano 3 trazer os menus):
 * ?stage=1..10&players=2..5&matches=1..5&time=0..4&mode=ffa|team&sd=1&racer=1&spawns=0&chars=0,1,2,3,4&seed=N
 */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const rules: Rules = {
    ...defaultRules(),
    matches: int(q.get('matches'), 3, 1, 5),
    timeIdx: int(q.get('time'), 2, 0, 4),
    suddenDeath: q.get('sd') === '1',
    racer: q.get('racer') === '1',
    randomSpawns: q.get('spawns') !== '0',
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    teams: [0, 1, 0, 1, 0],
    active: [0, 1, 2, 3, 4].map(i => i < players),
  };
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const chars = [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] < 6 ? raw[i] : i));
  return { rules, stage: int(q.get('stage'), 1, 1, 10), chars, seed: q.has('seed') ? int(q.get('seed'), 0, 0, 2 ** 31 - 1) : null };
}
```

- [ ] **Step 4: Implementar `web/src/game/session.ts`**

```ts
import { BTN, createMatch, startRound, finishRound, step, type GameEvent, type MatchState, type RoundState } from '../core';
import type { GameConfig } from './config';

export const ROUND_OVER_FRAMES = 150;
export const SCOREBOARD_FRAMES = 540;   // ≈9 s, como o placar do original
export const SKIP_AFTER = 60;

export type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory';

export interface Session {
  cfg: GameConfig; seed: number; matchNo: number;
  match: MatchState; round: RoundState;
  phase: SessionPhase; timer: number; paused: boolean;
  prevPads: number[]; lastWinners: number[]; champions: number[];
}

export function createSession(cfg: GameConfig, seed: number): Session {
  const match = createMatch(cfg.rules, cfg.stage, seed);
  return {
    cfg, seed, matchNo: 1, match, round: startRound(match), phase: 'battle', timer: 0, paused: false,
    prevPads: [0, 0, 0, 0, 0], lastWinners: [], champions: [],
  };
}

/** Avança um tick (1/60 s). Devolve os eventos do core deste tick (vazio fora da batalha). */
export function updateSession(s: Session, pads: number[]): GameEvent[] {
  const pressed = pads.map((p, i) => p & ~(s.prevPads[i] ?? 0));
  s.prevPads = [...pads];
  const hit = (mask: number) => pressed.some((p, i) => s.cfg.rules.active[i] && (p & mask) !== 0);
  let ev: GameEvent[] = [];
  switch (s.phase) {
    case 'battle':
      if (hit(BTN.START)) s.paused = !s.paused;
      if (s.paused) break;
      ev = step(s.round, pads);
      if (s.round.phase === 'result') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }
      break;
    case 'roundOver':
      if (--s.timer <= 0) {
        const r = finishRound(s.match, s.round);
        s.lastWinners = r.winners;
        s.champions = r.champions;
        s.phase = 'scoreboard';
        s.timer = SCOREBOARD_FRAMES;
      }
      break;
    case 'scoreboard':
      s.timer--;
      if (s.timer <= 0 || (SCOREBOARD_FRAMES - s.timer > SKIP_AFTER && hit(BTN.START | BTN.A))) {
        if (s.match.over) { s.phase = 'victory'; s.timer = 0; }
        else { s.round = startRound(s.match); s.phase = 'battle'; }
      }
      break;
    case 'victory':
      s.timer++;
      if (s.timer > SKIP_AFTER && hit(BTN.START | BTN.A)) {
        s.matchNo++;
        s.match = createMatch(s.cfg.rules, s.cfg.stage, (s.seed + Math.imul(s.matchNo, 7919)) >>> 0);
        s.round = startRound(s.match);
        s.phase = 'battle';
        s.lastWinners = [];
        s.champions = [];
      }
      break;
  }
  return ev;
}
```

- [ ] **Step 5: Rodar e ver passar; typecheck**

Run: `cd web && npx vitest run tests/client/session.test.ts && npx tsc --noEmit`
Expected: PASS; tsc limpo

- [ ] **Step 6: Commit**

```bash
git add web/src/game web/tests/client/session.test.ts
git commit -m "feat(client): regras pela URL e sessão (batalha, fim de rodada, placar, vitória, pausa)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Modelo de visão (explosões, caminhada, relógio, textos)

**Files:**
- Create: `web/src/render/view.ts`
- Test: `web/tests/client/view.test.ts`

**Interfaces:**
- Consumes: `FLAME_FRAMES`, tipos `GameEvent`, `RoundState` de `../core`; `type FlamePart` de `./art/flames`
- Produces:
  - `interface ExplosionFx { gx; gy; arms: [n,n,n,n]; age }`, `interface ViewState { roundKey; explosions; walk: number[]; lastPos }`
  - `createView(): ViewState`, `updateView(v, round, events): void`
  - `walkFrame(counter): 0|1|2`, `flameShrink(age): 0..2`, `interface FlameCell { gx; gy; part }`, `flameCells(e): FlameCell[]`
  - `formatClock(frames): string`, `dyingVisible(dying): boolean`, `roundOverText(winners, mode, teams): string`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/client/view.test.ts`:
```ts
import { createView, updateView, walkFrame, flameShrink, flameCells, formatClock, dyingVisible, roundOverText } from '../../src/render/view';
import { createRound, defaultRules, FLAME_FRAMES, type GameEvent } from '../../src/core';

const round = () => createRound(1, { ...defaultRules(), randomSpawns: false }, 1);

describe('chamas', () => {
  it('peças a partir dos braços [cima, baixo, esquerda, direita]', () => {
    const cells = flameCells({ gx: 5, gy: 5, arms: [0, 2, 1, 3], age: 0 });
    expect(cells).toHaveLength(7);
    expect(cells[0]).toEqual({ gx: 5, gy: 5, part: 'center' });
    expect(cells).toContainEqual({ gx: 5, gy: 6, part: 'v' });
    expect(cells).toContainEqual({ gx: 5, gy: 7, part: 'down' });
    expect(cells).toContainEqual({ gx: 4, gy: 5, part: 'left' });
    expect(cells).toContainEqual({ gx: 7, gy: 5, part: 'h' });
    expect(cells).toContainEqual({ gx: 8, gy: 5, part: 'right' });
  });
  it('afinam no começo e no fim', () => {
    expect([flameShrink(0), flameShrink(3), flameShrink(10), flameShrink(27), flameShrink(32)]).toEqual([2, 1, 0, 1, 2]);
  });
});

describe('updateView', () => {
  it('acompanha explosões pelo tempo da chama e limpa ao trocar de rodada', () => {
    const v = createView();
    const r = round();
    const ev: GameEvent[] = [{ type: 'explosion', gx: 3, gy: 1, arms: [0, 1, 2, 2] }];
    updateView(v, r, ev);
    expect(v.explosions).toHaveLength(1);
    for (let i = 0; i < FLAME_FRAMES - 1; i++) updateView(v, r, []);
    expect(v.explosions).toHaveLength(1);
    updateView(v, r, []);
    expect(v.explosions).toHaveLength(0);
    updateView(v, r, ev);
    updateView(v, round(), []);
    expect(v.explosions).toHaveLength(0);
  });
  it('contador de caminhada sobe quando o jogador se move e zera parado', () => {
    const v = createView();
    const r = round();
    updateView(v, r, []);
    r.players[0].x += 8; updateView(v, r, []);
    r.players[0].x += 8; updateView(v, r, []);
    expect(v.walk[0]).toBe(2);
    updateView(v, r, []);
    expect(v.walk[0]).toBe(0);
  });
});

describe('helpers de exibição', () => {
  it('quadro de caminhada', () => {
    expect([0, 1, 8, 16, 24, 32].map(walkFrame)).toEqual([0, 1, 0, 2, 0, 1]);
  });
  it('relógio arredonda para cima', () => {
    expect([10800, 10799, 10740, 59, 0, -1].map(formatClock)).toEqual(['3:00', '3:00', '2:59', '0:01', '0:00', '--:--']);
  });
  it('morrendo pisca e some no fim', () => {
    expect([0, 10, 72, 76].map(dyingVisible)).toEqual([true, false, true, false]);
  });
  it('texto de fim de rodada', () => {
    expect(roundOverText([], 'ffa', [0, 1, 0, 1, 0])).toBe('EMPATE!');
    expect(roundOverText([2], 'ffa', [0, 1, 0, 1, 0])).toBe('P3 VENCEU!');
    expect(roundOverText([0, 2, 4], 'team', [0, 1, 0, 1, 0])).toBe('TIME VERMELHO VENCEU!');
    expect(roundOverText([1, 3], 'team', [0, 1, 0, 1, 0])).toBe('TIME BRANCO VENCEU!');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/view.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `web/src/render/view.ts`**

```ts
import { FLAME_FRAMES, type GameEvent, type RoundState } from '../core';
import type { FlamePart } from './art/flames';

export interface ExplosionFx { gx: number; gy: number; arms: [number, number, number, number]; age: number }

export interface ViewState {
  roundKey: RoundState | null;
  explosions: ExplosionFx[];
  walk: number[];
  lastPos: [number, number][];
}

export function createView(): ViewState {
  return { roundKey: null, explosions: [], walk: [0, 0, 0, 0, 0], lastPos: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
}

/** Atualiza a visão depois de um tick do core (ou de um tick parado, com `events` vazio). */
export function updateView(v: ViewState, round: RoundState, events: GameEvent[]): void {
  if (v.roundKey !== round) {
    v.roundKey = round;
    v.explosions = [];
    v.walk = [0, 0, 0, 0, 0];
    v.lastPos = round.players.map(p => [p.x, p.y] as [number, number]);
  }
  for (const e of v.explosions) e.age++;
  v.explosions = v.explosions.filter(e => e.age < FLAME_FRAMES);
  for (const e of events) if (e.type === 'explosion') v.explosions.push({ gx: e.gx, gy: e.gy, arms: e.arms, age: 0 });
  round.players.forEach((p, i) => {
    const [lx, ly] = v.lastPos[i];
    v.walk[i] = p.x !== lx || p.y !== ly ? v.walk[i] + 1 : 0;
    v.lastPos[i] = [p.x, p.y];
  });
}

const WALK_SEQ = [1, 0, 2, 0];

export function walkFrame(counter: number): number {
  return counter === 0 ? 0 : WALK_SEQ[(counter >> 3) & 3];
}

export function flameShrink(age: number): number {
  if (age < 2) return 2;
  if (age < 4) return 1;
  const left = FLAME_FRAMES - age;
  if (left <= 3) return 2;
  if (left <= 7) return 1;
  return 0;
}

export interface FlameCell { gx: number; gy: number; part: FlamePart }

const ARM_DIRS: [number, number, FlamePart, FlamePart][] = [
  [0, -1, 'v', 'up'], [0, 1, 'v', 'down'], [-1, 0, 'h', 'left'], [1, 0, 'h', 'right'],
];

export function flameCells(e: ExplosionFx): FlameCell[] {
  const out: FlameCell[] = [{ gx: e.gx, gy: e.gy, part: 'center' }];
  e.arms.forEach((len, d) => {
    const [dx, dy, mid, tip] = ARM_DIRS[d];
    for (let r = 1; r <= len; r++) out.push({ gx: e.gx + dx * r, gy: e.gy + dy * r, part: r === len ? tip : mid });
  });
  return out;
}

export function formatClock(frames: number): string {
  if (frames < 0) return '--:--';
  const secs = Math.ceil(frames / 60);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/** Pisca durante a animação de morte e some nos últimos 20 frames. */
export function dyingVisible(dying: number): boolean {
  if (dying <= 0) return true;
  if (dying < 20) return false;
  return ((dying >> 2) & 1) === 0;
}

export function roundOverText(winners: number[], mode: 'ffa' | 'team', teams: number[]): string {
  if (winners.length === 0) return 'EMPATE!';
  if (mode === 'team') return teams[winners[0]] === 0 ? 'TIME VERMELHO VENCEU!' : 'TIME BRANCO VENCEU!';
  return `P${winners[0] + 1} VENCEU!`;
}
```

- [ ] **Step 4: Rodar e ver passar; typecheck**

Run: `cd web && npx vitest run tests/client/view.test.ts && npx tsc --noEmit`
Expected: PASS; tsc limpo

- [ ] **Step 5: Commit**

```bash
git add web/src/render/view.ts web/tests/client/view.test.ts
git commit -m "feat(client): modelo de visão (explosões, caminhada, relógio, textos de rodada)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Renderização, página e inicialização

**Files:**
- Create: `web/index.html`, `web/src/main.ts`, `web/src/render/sprite-bank.ts`, `web/src/render/display.ts`, `web/src/render/draw-game.ts`, `web/src/render/draw-screens.ts`
- Modify: `.gitignore` (raiz): adicionar `web/snapshots/`

**Interfaces:**
- Consumes: tudo das Tasks 1–4 e do core
- Produces: `SpriteBank` (bomber, head, bomb, item, flame, crown, trophy, text, tiles), `pixToCanvas`, `createDisplay(canvas)`, `drawRound`, `drawHud`, `drawTextCentered`, `SCREEN_W`, `SCREEN_H`, `drawTitle`, `drawSession`; `window.__crown` (só com `?debug`) para as screenshots automáticas

Esta task é de DOM e canvas, por isso não tem teste unitário. A verificação é `tsc`, `vite build` e a Task 6 (screenshots).

- [ ] **Step 1: `web/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Crown Blast</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000000; }
    body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
  </style>
</head>
<body>
  <canvas id="screen"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: `web/src/render/sprite-bank.ts`**

```ts
import type { Pix } from './art/pix';
import { bomberFrame, headIcon } from './art/bomber';
import { bombPix, itemIcon } from './art/items';
import { flamePiece, type FlamePart } from './art/flames';
import { stageTiles } from './art/tiles';
import { textPix } from './art/font';
import { crownPix, trophyPix } from './art/trophy';

export type Img = HTMLCanvasElement;

export interface TileImgs { floor: Img; floorAlt: Img; hard: Img; wall: Img; soft: Img; burning: [Img, Img]; bg: string }

export function pixToCanvas(p: Pix): Img {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
  return c;
}

/** Converte a arte pura em canvases, uma única vez por chave. */
export class SpriteBank {
  private cache = new Map<string, Img>();
  private tileCache = new Map<number, TileImgs>();

  private get(key: string, make: () => Pix): Img {
    let c = this.cache.get(key);
    if (!c) { c = pixToCanvas(make()); this.cache.set(key, c); }
    return c;
  }

  bomber(ch: number, dir: number, frame: number): Img { return this.get(`b${ch}:${dir}:${frame}`, () => bomberFrame(ch, dir, frame)); }
  head(ch: number): Img { return this.get(`h${ch}`, () => headIcon(ch)); }
  bomb(frame: number): Img { return this.get(`bomb${frame}`, () => bombPix(frame)); }
  item(item: number): Img { return this.get(`i${item}`, () => itemIcon(item)); }
  flame(part: FlamePart, shrink: number): Img { return this.get(`f${part}${shrink}`, () => flamePiece(part, shrink)); }
  crown(): Img { return this.get('crown', crownPix); }
  trophy(): Img { return this.get('trophy', trophyPix); }
  text(s: string, color: string): Img { return this.get(`t${color}:${s}`, () => textPix(s, color)); }

  tiles(stage: number): TileImgs {
    let t = this.tileCache.get(stage);
    if (!t) {
      const s = stageTiles(stage);
      t = {
        floor: pixToCanvas(s.floor), floorAlt: pixToCanvas(s.floorAlt), hard: pixToCanvas(s.hard),
        wall: pixToCanvas(s.wall), soft: pixToCanvas(s.soft),
        burning: [pixToCanvas(s.burning[0]), pixToCanvas(s.burning[1])], bg: s.bg,
      };
      this.tileCache.set(stage, t);
    }
    return t;
  }
}
```

- [ ] **Step 3: `web/src/render/display.ts`**

```ts
export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Canvas de 256×224 escalado pelo maior inteiro que cabe na janela. */
export function createDisplay(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H)));
    canvas.style.width = `${SCREEN_W * s}px`;
    canvas.style.height = `${SCREEN_H * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
```

- [ ] **Step 4: `web/src/render/draw-game.ts`**

```ts
import { CELL, ITEM, T, GRID_W, GRID_H, idx, type RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';
import { SCREEN_W, SCREEN_H } from './display';
import { flameCells, flameShrink, walkFrame, dyingVisible, formatClock, type ViewState } from './view';

export { SCREEN_W, SCREEN_H };

const tileX = (gx: number) => 16 * gx + 8;
const tileY = (gy: number) => 16 * gy + 24;
const toPx = (sub: number) => Math.floor(sub / 8);

export function drawTextCentered(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color: string, y: number, scale: number): void {
  const img = bank.text(text, color);
  const w = img.width * scale;
  ctx.drawImage(img, Math.floor((SCREEN_W - w) / 2), y, w, img.height * scale);
}

export function drawHud(ctx: CanvasRenderingContext2D, round: RoundState, bank: SpriteBank, chars: number[], crowns: number[]): void {
  ctx.fillStyle = '#101428';
  ctx.fillRect(0, 0, SCREEN_W, 24);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, 23, SCREEN_W, 1);
  ctx.drawImage(bank.text(formatClock(round.timeLeft), '#ffffff'), 6, 6);
  let x = 52;
  round.players.forEach((p, i) => {
    if (!p.active) return;
    ctx.globalAlpha = p.alive ? 1 : 0.35;
    ctx.drawImage(bank.head(chars[i]), x, 5);
    ctx.globalAlpha = 1;
    ctx.drawImage(bank.text(String(crowns[i]), '#ffd23f'), x + 17, 6);
    x += 40;
  });
}

/** Desenha a arena inteira de uma rodada: tiles, itens, bombas, chamas, jogadores e HUD. */
export function drawRound(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank,
  chars: number[], frame: number, crowns: number[]): void {
  const tiles = bank.tiles(round.stage);
  const a = round.arena;
  ctx.fillStyle = tiles.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
    const i = idx(gx, gy);
    const x = tileX(gx), y = tileY(gy);
    const border = gx === 0 || gy === 0 || gx === GRID_W - 1 || gy === GRID_H - 1;
    const base = border ? tiles.wall : a.cells[i] === CELL.HARD ? tiles.hard : (gx + gy) % 2 ? tiles.floorAlt : tiles.floor;
    ctx.drawImage(base, x, y);
    if (border) continue;
    if (a.cells[i] === CELL.SOFT) ctx.drawImage(a.burning[i] > 0 ? tiles.burning[(frame >> 2) & 1] : tiles.soft, x, y);
    else if (a.items[i] !== ITEM.NONE) ctx.drawImage(bank.item(a.items[i]), x, y);
  }

  for (const b of round.bombs) {
    if (b.carried) continue;
    let by = toPx(b.y) - 8;
    if (b.flight) by -= Math.round(10 * Math.sin((Math.PI * b.flight.progress) / T));
    ctx.drawImage(bank.bomb((frame >> 3) & 1), toPx(b.x) - 8, by);
  }

  for (const e of view.explosions) {
    const shrink = flameShrink(e.age);
    for (const c of flameCells(e)) {
      if (a.cells[idx(c.gx, c.gy)] !== CELL.EMPTY) continue;
      ctx.drawImage(bank.flame(c.part, shrink), tileX(c.gx), tileY(c.gy));
    }
  }

  const players = round.players.filter(p => p.active && p.alive).sort((p, q) => p.y - q.y || p.slot - q.slot);
  for (const p of players) {
    if (!dyingVisible(p.dying)) continue;
    const sx = toPx(p.x) - 8, sy = toPx(p.y) - 12;
    const frameIdx = p.dying > 0 ? 0 : walkFrame(view.walk[p.slot]);
    ctx.drawImage(bank.bomber(chars[p.slot], p.facing, frameIdx), sx, sy);
    if (p.carrying >= 0) ctx.drawImage(bank.bomb(0), sx, sy - 12);
  }

  drawHud(ctx, round, bank, chars, crowns);
}
```

- [ ] **Step 5: `web/src/render/draw-screens.ts`**

```ts
import type { Session } from '../game/session';
import { SCOREBOARD_FRAMES, SKIP_AFTER } from '../game/session';
import type { SpriteBank } from './sprite-bank';
import { roundOverText, type ViewState } from './view';
import { drawRound, drawTextCentered, SCREEN_W, SCREEN_H } from './draw-game';

export function drawTitle(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void {
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? '#141a3a' : '#18204a';
    ctx.fillRect(0, i * 16, SCREEN_W, 16);
  }
  ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 40, 36, 24);
  drawTextCentered(ctx, bank, 'CROWN BLAST', '#ffd23f', 76, 3);
  if (((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#ffffff', 150, 1);
  drawTextCentered(ctx, bank, 'ENTER / START NO CONTROLE', '#6ad0ff', 170, 1);
}

function drawScoreboard(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank): void {
  ctx.fillStyle = '#12305a';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#0b1f3d';
  ctx.fillRect(12, 34, SCREEN_W - 24, 168);
  drawTextCentered(ctx, bank, 'PLACAR', '#ffd23f', 8, 2);
  const age = SCOREBOARD_FRAMES - s.timer;
  let row = 0;
  s.round.players.forEach((p, i) => {
    if (!p.active) return;
    const y = 40 + row * 32;
    row++;
    ctx.drawImage(bank.head(s.cfg.chars[i]), 20, y + 4);
    ctx.drawImage(bank.text(`P${i + 1}`, '#ffffff'), 40, y + 6);
    for (let k = 0; k < s.match.rules.matches; k++) {
      const x = 70 + k * 34;
      ctx.fillStyle = '#050b18';
      ctx.fillRect(x, y, 30, 22);
      ctx.fillStyle = '#2a4a7a';
      ctx.fillRect(x + 1, y + 1, 28, 20);
      const won = k < s.match.crowns[i];
      const isNew = won && k === s.match.crowns[i] - 1 && s.lastWinners.includes(i);
      if (won && (!isNew || age > 40 || ((age >> 2) & 1) === 0)) ctx.drawImage(bank.crown(), x + 3, y + 3, 24, 16);
    }
  });
  drawTextCentered(ctx, bank, roundOverText(s.lastWinners, s.cfg.rules.mode, s.cfg.rules.teams), '#ffd23f', 208, 1);
}

function drawVictory(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank, frame: number): void {
  ctx.fillStyle = '#1d1030';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 3 ? '#ffd23f' : '#ffffff';
    ctx.fillRect((i * 97 + frame) % SCREEN_W, (i * 53) % SCREEN_H, 1, 1);
  }
  drawTextCentered(ctx, bank, 'VITÓRIA!', '#ffd23f', 14, 3);
  const champs = s.champions;
  const total = champs.length * 56;
  champs.forEach((slot, k) => {
    const x = Math.floor((SCREEN_W - total) / 2) + k * 56 + 4;
    const bounce = Math.abs(Math.round(Math.sin((frame + k * 10) / 8) * 6));
    ctx.drawImage(bank.bomber(s.cfg.chars[slot], 2, 0), x, 64 - bounce, 48, 60);
  });
  ctx.drawImage(bank.trophy(), (SCREEN_W - 48) / 2, 132, 48, 48);
  const rules = s.cfg.rules;
  const who = rules.mode === 'team'
    ? (rules.teams[champs[0]] === 0 ? 'TIME VERMELHO É O CAMPEÃO!' : 'TIME BRANCO É O CAMPEÃO!')
    : `P${champs[0] + 1} É O CAMPEÃO!`;
  drawTextCentered(ctx, bank, who, '#ffffff', 188, 1);
  if (s.timer > SKIP_AFTER && ((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#6ad0ff', 206, 1);
}

export function drawSession(ctx: CanvasRenderingContext2D, s: Session, view: ViewState, bank: SpriteBank, frame: number): void {
  switch (s.phase) {
    case 'battle':
    case 'roundOver':
      drawRound(ctx, s.round, view, bank, s.cfg.chars, frame, s.match.crowns);
      if (s.round.phase === 'intro') drawTextCentered(ctx, bank, s.round.introLeft > 30 ? 'PRONTOS?' : 'JÁ!', '#ffd23f', 100, 2);
      if (s.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 24, SCREEN_W, SCREEN_H - 24);
        drawTextCentered(ctx, bank, 'PAUSA', '#ffffff', 104, 2);
      }
      if (s.phase === 'roundOver') {
        drawTextCentered(ctx, bank, roundOverText(s.round.winners, s.cfg.rules.mode, s.cfg.rules.teams), '#ffd23f', 100, 2);
      }
      break;
    case 'scoreboard':
      drawScoreboard(ctx, s, bank);
      break;
    case 'victory':
      drawVictory(ctx, s, bank, frame);
      break;
  }
}
```

- [ ] **Step 6: `web/src/main.ts`**

```ts
import { BTN } from './core';
import { parseConfig } from './game/config';
import { createSession, updateSession, type Session } from './game/session';
import { InputManager } from './input/input';
import { startLoop } from './app/loop';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { createView, updateView } from './render/view';
import { drawSession, drawTitle } from './render/draw-screens';

const cfg = parseConfig(window.location.search);
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();
const input = new InputManager(window);
const view = createView();
let session: Session | null = null;
let prevPads = [0, 0, 0, 0, 0];
let frame = 0;

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe com ?debug.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __crown: { readonly session: Session | null } }).__crown = { get session() { return session; } };
}

startLoop(() => {
  frame++;
  const pads = input.poll();
  if (!session) {
    const start = pads.some((p, i) => (p & ~prevPads[i] & (BTN.START | BTN.A)) !== 0);
    prevPads = pads;
    if (start) {
      session = createSession(cfg, cfg.seed ?? (Date.now() >>> 0));
      session.prevPads = [...pads]; // o START que abriu a partida não pode pausá-la
    }
    return;
  }
  const events = updateSession(session, pads);
  updateView(view, session.round, events);
}, () => {
  if (session) drawSession(ctx, session, view, bank, frame);
  else drawTitle(ctx, bank, frame);
});
```

- [ ] **Step 7: Ignorar screenshots**

Acrescente ao `.gitignore` da raiz do repositório a linha:
```
web/snapshots/
```

- [ ] **Step 8: Typecheck, testes e build**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc limpo; todos os testes (core + client) PASS; build gera `web/dist/` sem erros

- [ ] **Step 9: Commit**

```bash
git add web/index.html web/src/main.ts web/src/render .gitignore
git commit -m "feat(client): renderização da arena, HUD, placar e vitória; página e inicialização

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Screenshots automáticas para verificação visual

**Files:**
- Create: `web/scripts/snapshots.mjs`
- Modify: `web/package.json` (script `snap`; devDependency `playwright-core`)

**Interfaces:**
- Consumes: `window.__crown.session` (só com `?debug`), servidor do Vite
- Produces: `web/snapshots/01-title.png`, `02-intro.png`, `03-battle.png`, `04-explosion.png`, `05-round-over.png`, `06-scoreboard.png`, `07-victory.png`, `08-stage5.png`, `09-stage8.png`

- [ ] **Step 1: Instalar `playwright-core` e adicionar o script**

```bash
cd web && npm install -D playwright-core
npm pkg set scripts.snap="node scripts/snapshots.mjs"
```

- [ ] **Step 2: Escrever `web/scripts/snapshots.mjs`**

```js
// Abre o jogo no Chrome instalado, joga alguns frames e salva screenshots em web/snapshots/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}snapshots`;
mkdirSync(out, { recursive: true });
const PORT = 5188;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('vite não subiu');
}

const browser = await (async () => { await waitServer(); return chromium.launch({ channel: 'chrome' }); })();
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 672 } });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const tap = async code => { await page.keyboard.down(code); await sleep(60); await page.keyboard.up(code); await sleep(60); };
  const hold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  await page.goto(`http://localhost:${PORT}/?seed=7&players=5&matches=1&spawns=0&debug=1`);
  await sleep(400); await shot('01-title');
  await tap('Enter'); await sleep(500); await shot('02-intro');
  await sleep(1200);
  await hold('KeyD', 250); await tap('KeyJ'); await hold('KeyA', 250); await hold('KeyS', 300);
  await sleep(300); await shot('03-battle');
  await page.waitForFunction(() => window.__crown.session.round.arena.flame.some(f => f > 20), null, { timeout: 5000 });
  await shot('04-explosion');
  await page.evaluate(() => { window.__crown.session.round.players.forEach((p, i) => { if (i !== 2) p.alive = false; }); });
  await sleep(400); await shot('05-round-over');
  await sleep(2600); await shot('06-scoreboard');
  await sleep(9200); await shot('07-victory');

  for (const stage of [5, 8]) {
    await page.goto(`http://localhost:${PORT}/?seed=3&players=5&stage=${stage}&debug=1`);
    await sleep(300); await tap('Enter'); await sleep(2000);
    await shot(stage === 5 ? '08-stage5' : '09-stage8');
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`screenshots em ${out}`);
```

- [ ] **Step 3: Rodar**

Run: `cd web && npm run snap`
Expected: `screenshots em .../web/snapshots` e 9 arquivos PNG. Abra `02-intro`, `04-explosion`, `06-scoreboard` e `07-victory` e confira no relatório:
- a arena aparece com HUD, 5 personagens e o texto "PRONTOS?" ou "JÁ!";
- existe uma explosão em cruz;
- o placar mostra uma coroa para o P3;
- a vitória mostra "VITÓRIA!", o personagem do P3 e o troféu.

Descreva no relatório o que cada PNG mostra.

- [ ] **Step 4: Commit**

```bash
git add web/scripts/snapshots.mjs web/package.json web/package-lock.json
git commit -m "chore(client): script de screenshots automáticas (playwright-core + Chrome)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Próximos planos

- **Plano 3, menus:** título, modo VS, jogadores (Humano/CPU e times), regras, personagem (um cursor por jogador), fase (miniatura + nome) e CONFIG (remapear teclas, volume, nomes, URL do webhook). Validação de regras degeneradas.
- **Plano 4, conteúdo e integrações:** IA (Fraco/Normal/Forte, com `dangerMap` no core); mecânicas especiais das fases 2, 3, 6, 7, 8 e 9; Bad Bomber; áudio chiptune; webhook Crown Cup com retry e fila offline.
