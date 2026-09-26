# Crown Blast: Plano 7, gráficos originais da partida

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com a ROM do usuário carregada, desenhar a partida exatamente como o SB4 (spec §7.1–§7.4): campo (BG2) a partir da grade do núcleo, decoração (BG1), HUD, bombas, chamas, queimas, itens, pressão, jogadores e animações, ordem de desenho, efeitos de paleta, *color math* e animações de cenário. `drawRomBattle(ctx, round, vis, assets, frame)` deixa de ser o *stub* do plano 5.

**Architecture:** O desenho é uma função do estado. Cada quadro, `buildBattleFrame` monta um `PpuFrame` (§2.4) e `renderPpu` (plano 5) o rasteriza.
- `render/rom/adapt.ts` é o **único** arquivo que lê os detalhes internos do núcleo que a spec não fixa (`Bomb`, `Flyer`, `PressureState`, `cellAux`). Ele traduz o estado para `RomScene` (tipos deste plano).
- `render/anim/` tem as regras de tempo, puras e sem ROM: amostragem de animação, sequências da grade (bomba, chama, queima), linha do tempo de tiles e paletas, efeitos (caveira, invencível, pressão) e a escolha de animação por ação.
- `render/rom/` junta tudo: `field.ts` (BG2), `hud.ts` (linhas 28–30 do BG1 e rostos), `scenery.ts` (tiles e CGRAM do quadro), `sprites.ts` (OAM), `builder.ts` (`FrameBuilder implements RomBattleBuilder`) e `battle.ts` (orquestração, camadas dos planos 8 e 9, `drawRomBattle`).
- Três tabelas pequenas são lidas da ROM em tempo de execução (`tables.ts`): item → palavra do BG2 (`$C1:5FE0`, fecha a A13), coroas do HUD (`$C4:5D11`) e paletas de time (`$C2:7B9D`).

**Tech Stack:** TypeScript, Vitest, a PPU de software do plano 5 (`renderPpu`).

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md` (§1, §2.3–§2.5, §3.1, §3.4, §3.15, §7.1–§7.4, §10, §11 linha 7). Relatórios: ANI (`analise/investigacao/animacoes-sprites/RELATORIO.md`), ARN (`analise/investigacao/arenas-cenario/RELATORIO.md`, `render_rom.py`, `arena_rom.py`), GFX (`analise/investigacao/graficos-formato/RELATORIO.md`).

**Planos irmãos:** plano 5 (`2026-09-26-crown-blast-5-rom-loader.md`) e plano 6 (`2026-09-26-crown-blast-6-core-fiel.md`): os nomes deste plano seguem os textos deles; a Tarefa 1 confere contra o código mesclado. Plano 9: gancho `romPlayerHooks` (L17 dele). Plano 10: chama `drawRomBattle(ctx, round, { crowns }, assets, frame)`.

## Ondas

| Onda | Tarefas | Observação |
|---|---|---|
| **1** | T1 Sincronização → T2 Fundação | sequenciais, um implementador; T1 é curta |
| **2** | T3 Amostragem e ações · T4 Campo (BG2) · T5 Cenário (tiles e CGRAM) · T6 HUD · T7 Adaptador do núcleo | paralelas, arquivos disjuntos |
| **3** | T8 Sprites · T9 Orquestração e golden | paralelas (T9 usa o esqueleto de `sprites.ts` criado na T2) |
| **4** | T10 Ponta a ponta com a ROM e screenshots | uma tarefa |

## Global Constraints

- Worktree `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity` (branch de trabalho a partir de `feat/fidelity` com os planos 5 e 6 mesclados). Código em `web/`. Todos os comandos rodam em `web/`.
- **Este plano possui:** `web/src/render/rom/**` (menos `stages/` e `mounts/`), `web/src/render/anim/**`, `web/tests/render-rom/**`. Exceção combinada no plano 6 (decisão 3 dele): a T1 troca `object` → `RomAssets` e `BattleObj` → `ObjEntry` em `web/src/render/battle-layers.ts` e acrescenta `romPlayerHooks` (o mesmo contrato do plano 9, L17), registrando no PR. Nenhum outro arquivo fora dessas pastas é editado.
- O render **não muda** o `RoundState`. A memória do desenho (congelamento no TIME UP, cauda da pressão) fica numa `WeakMap` indexada pela rodada.
- Relógio do desenho = `round.tick` (congelado nas fases da D6). Só o pisca dos itens e a caveira usam `frame` (contador global `$016C`).
- ROM: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`. Testes que usam a ROM ficam em `describe.skipIf(!ASSETS)` e pulam sem a variável. Nunca versionar bytes da ROM nem imagens: os screenshots vão para `$SHOTS_DIR` ou para `os.tmpdir()/crown-blast-shots`.
- `npx vitest run` e `npx tsc --noEmit` verdes ao fim de cada tarefa.
- Commits em PT-BR (`feat(render): …`, `test(render): …`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisões sobre lacunas da spec

Cada decisão tem um teste. 🟡 = provisória, a conferir com as ferramentas das frentes.

| # | Lacuna | Decisão |
|---|---|---|
| D1 | Tipo de `vis` em `drawRomBattle(ctx, round, vis, assets, frame)` | `RomBattleVis = { crowns: readonly number[] }` (coroas da partida para o HUD; o plano 10 passa `crownsOf(m)`). A memória do render **não** fica em `vis`: `WeakMap<RoundState, RomMemo>` |
| D2 | A13: item → palavra do BG2 | Resolvida: tabela `$C1:5FE0`, 4 B por ID (`u16` palavra, `u16` lógico), lida por `$C1:5D00` na revelação. Confere com as palavras da §7.1 e dá as que faltavam (perfurante `1284`, fogo total `1286`, remota `128E`, colete `128C`, coração `12C0`, atravessa-soft `12A0`, atravessa-bomba `1288`, traje `12EA`, `$11` `12E8`). IDs `$30+` (ovos) são do plano 9: o plano 7 desenha piso |
| D3 | Coroas `$C4:5D11` | São `u16` (palavra inteira do HUD, `$264F`, `$263B`…), não bytes |
| D4 | Invisível `$29` | O núcleo expõe `invisibleVisible(p)` (plano 6, decisão 19). O render só obedece |
| D5 | Animação de tiles: tempo | Um comando por tick; DMA gasta 1 tick, espera W gasta 1+W, **loop gasta 0** (confere com os ciclos de 48/28/36/176 da ARN §3.1). No tick *n* da rodada já rodaram os comandos dos ticks 0..n−1. Paletas animadas: quadro `⌊tick/período⌋ mod N`, fase 0 no tick 0 🟡 |
| D6 | Congelamento visual | `timeUp`: tudo congela em `phaseT0` (e continua congelado no `over` seguinte). `won`: só o script das bombas congela (o núcleo já congela bombas e voadores; chamas, queimas e pressão seguem) |
| D7 | Início do script da bomba | Idade = `tick − born`, tempo do script = idade + 2 (1º quadro 2 ticks mais curto) para todos os tipos. A ANI mediu 124 ticks visíveis contra 127 de pavio (ver Riscos) |
| D8 | Queima de item | `0F2E…0FAE` por 20 ticks; do 20º ao fim da queima, piso |
| D9 | Piso | `floor[cell] ≠ 0` → essa palavra; `0` → `ArenaAssets.floor`. Conferido: nas 10 arenas, `bg2Base == floor` em toda casa de lógico `0000` |
| D10 | Moldura | Colunas 0 e 16 e o que fica fora de 17×13 vêm sempre do `bg2Base` |
| D11 | Pressão | Por `Falling {cell, t0, land}` do núcleo: sombra (OBJ `$04E`) de `t0` a `land+1`; bloco (OBJ `$04C`) com y = topo da casa − 8·(land − tick), a partir de y = 0, e parado no topo em `land` e `land+1`. `sortY` = centro da casa; o bloco na frente da sombra. Se o núcleo tira o `Falling` no pouso, a memória guarda a cauda de 2 ticks |
| D12 | Itens voando (perdas, drops) | OBJ 16×16 montado do tile de BG do item (`$C1:5FE0`), com a paleta BG 4 copiada para a paleta OBJ 2 (livre no Battle, GFX §3.3) 🟡 |
| D13 | Bomba na mão | Altura 6, 10, 14, 16 nos 4 ticks de `lift`, depois 16. `sortY` = centro desenhado (Y − altura), regra da ROM (chave = Y do objeto), então fica atrás do carregador |
| D14 | Ações sem tabela na §7.4 | `launched` → `$C2:6F35`[face/2], `pushed` → `$C2:6CE8`[face/2], `dance` → `$C2:6FC5`[face/2], `mounting`/`dismount` → parado (o plano 9 troca pelo gancho), `bad` → andar 🟡 |
| D15 | Morte | Some quando `tick − actT0` ≥ soma das durações da animação (22) |
| D16 | `mx`/`my` | Somados do quadro 0 ao atual, dentro do ciclo |
| D17 | HUD | Slot ausente mantém as palavras-base (fundo `$0B`) no rosto e na coroa. ∞ (30:01, A18): dezena dos minutos na coluna 3 (sobre a metade direita do ícone do relógio) 🟡 |
| D18 | Faixas | HUD: `main = BG1 | OBJ` (a ROM usa TM `$17`, mas BG2 e BG3 não aparecem ali: 0 px de diferença na ARN §6; o golden do plano 5 usa só BG1). Campo: `main = BG1 | BG2 | OBJ`; *color math* com `mathLayers` padrão da PPU (= só BG1, CGADSUB `$41`/`$01`, plano 5 D2) |
| D19 | Times (A1) | `rules.mode === 'team'` → paleta de `$C2:7B9D`, mesmo índice `c·32 + slot·4` 🟡 |
| D20 | Bad Bomber | Desenhado de `s.bad[]` (px), com a folha do personagem do slot e a animação de andar da `face`, amostrada em `tick` 🟡 |
| D21 | Arenas especiais | Cor 0 da arena 8, scroll do BG1 da 2, rolos da 8, bolas da 3, setas, pads e gangorras são das camadas do plano 8. Nos códigos especiais (`0040`, `0C00`, `1C00`, `0F41`…) o plano 7 desenha a palavra do mapa da ROM (`bg2Base`), como o golden do plano 5; ovos (`0970+t`) ficam com piso para o plano 9 |

## Mapa de arquivos

| Arquivo | Tarefa | Conteúdo |
|---|---|---|
| `web/src/render/rom/scene.ts` | T2 | tipos compartilhados do plano (`RomScene`, `RomClock`, `RomMemo`…) e ajudantes |
| `web/src/render/rom/tables.ts` | T2 | `romTables(a)`: item, coroa, paleta de time |
| `web/src/render/rom/builder.ts` | T2 | `FrameBuilder implements RomBattleBuilder`, constantes de ordem |
| `web/src/render/rom/sprites.ts` | T2 (esqueleto) → T8 | OAM: jogadores, Bad Bombers, objetos, pressão |
| `web/src/render/anim/sample.ts` | T3 | `sampleAnim`, `animCycle` |
| `web/src/render/anim/player-anim.ts` | T3 | ação × direção → tabela da ROM |
| `web/src/render/anim/grid-seq.ts` | T4 | bomba, chama, queimas |
| `web/src/render/rom/field.ts` | T4 | palavras do BG2 |
| `web/src/render/anim/timeline.ts` | T5 | tiles e paletas animados, pisca dos itens |
| `web/src/render/rom/scenery.ts` | T5 | tiles e CGRAM do quadro, com cache |
| `web/src/render/rom/hud.ts` | T6 | palavras do HUD e rostos |
| `web/src/render/rom/adapt.ts` | T7 | núcleo → `RomScene` |
| `web/src/render/anim/effects.ts` | T8 | caveira, invencível, pressão |
| `web/src/render/rom/battle.ts` | T9 | `buildBattleFrame`, `drawRomBattle` |
| `web/tests/render-rom/*` | todas | testes; `rom-fixture.ts` e `core-fixture.ts` (T1), `fakes.ts` (T2), `png.ts` (T10) |

---
### Task 1: Sincronização com os planos 5 e 6

Curta de propósito: conferir os nomes reais, ajustar o contrato de camadas e criar os dois ajudantes de teste que isolam as APIs dos planos 5 e 6. Se algum nome diferir, **editar este arquivo** (blocos das Tarefas 2–10, busca e troca) e registrar na seção "Resultado da execução → Sincronização".

**Files:**
- Modify: `web/src/render/battle-layers.ts` (exceção combinada no plano 6)
- Create: `web/tests/render-rom/rom-fixture.ts`, `web/tests/render-rom/core-fixture.ts`, `web/tests/render-rom/sync.test.ts`
- Modify: este plano (seção de resultado e, se preciso, nomes nos blocos)

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: plano 5 (`RomAssets`, `ArenaAssets`, `CharacterAssets`, `Tiles`, `Anim`, `AnimFrame`, `Piece`, `RomView`, `renderPpu`, `PpuFrame`, `BgLayer`, `ScanBand`, `ObjEntry`, `ROM` de `tests/rom/helpers.ts`, fábrica de `RomAssets`), plano 6 (`RoundState`, `Player`, `PlayerAct`, `Bomb`, `Flyer`, `Falling`, `CODE`, `FLAME_PIECE`, `BURN`, `BTN`, `GRID_W`, `GRID_H`, `colOf`, `linOf`, `px`, `defaultRules`, `createMatch`, `startRound`, `step`, `invisibleVisible`, `RomBattleBuilder`, `RomBattleLayer`, `romLayers`).
- Produces: `ASSETS: RomAssets | null`; `newRound(stage)`, `stepN(s, n, inputs?)`, `toPlay(s)`, `NO_INPUT`, `BTN`; `RomPlayerHook`, `romPlayerHooks`.

- [ ] **Step 1: Estado de partida.** Conferir que 5 e 6 estão mesclados e que a base está verde.

Run: `cd web && git log --oneline -15 && npx vitest run && npx tsc --noEmit`
Expected: commits dos planos 5 e 6 presentes; testes verdes; `tsc` limpo.

- [ ] **Step 2: Conferir os nomes.** Ler o código mesclado e preencher a tabela da seção "Resultado da execução → Sincronização" (coluna "Real").

Os nomes abaixo já seguem os textos dos planos 5 (`2026-09-26-crown-blast-5-rom-loader.md`) e 6 (`…-6-core-fiel.md`). A conferência é contra o **código mesclado**, que pode ter mudado durante a execução deles.

| Esperado por este plano (texto dos planos 5/6) | Onde | Se for diferente |
|---|---|---|
| Tipos em `src/rom/types.ts`: `RomAssets { rom; arena; character; anim; playerAnim; bombScript; … }`, `ArenaAssets { stage; record; bgTiles; bgCgram; bg1; bg2Base; floor; logicBase; removeN; tileAnim; palAnim; colorMath; hudMap; bg3Font; bg3Banners; objCommon; objCgram }` (`hudMap` com `+$2200`; `objCgram` só com a paleta 7), `Tiles`, `Anim`, `AnimFrame`, `Piece` | `src/rom/types.ts` | trocar os nomes nos blocos das T2–T10 |
| `CharacterAssets { char; frame(g); palettes; victoryFrame(g); hudHead(slot): Tiles }`, 6 tiles na ordem TL, TR, ML, MR, BL, BR (plano 5 D3) | idem | ajustar só `headTiles()` (T6) |
| `bombScript(type)` → `{ word, dur }[]` = corpo do laço (tipos 0–6, `p24($C1:56A8 + 3t)`) | `src/rom/assets*.ts` | se incluir marcadores `FFFF`/`FFFE`, filtrar em `field.ts` |
| `TileAnimCmd` = `{kind:'dma'; vram; src} \| {kind:'wait'; frames} \| {kind:'loop'} \| {kind:'end'}`; `PalAnim` = `{first; frames; period}` (plano 5 D6) | `src/rom/types.ts` | reescrever só `normTileCmds`/`normPalAnims` (T5) |
| `class RomView { data; u8; u16; u24; p24; s8; s16; bytes }` (`p24` lança `RangeError` fora da ROM) | `src/rom/view.ts` | idem |
| `createRomAssets(bytes: Uint8Array)` real (T13 do plano 5); `ROM: Uint8Array \| null` em `tests/rom/helpers.ts` | `src/rom/assets.ts`, `tests/rom/helpers.ts` | ajustar só `rom-fixture.ts` |
| `renderPpu`, `createImage`, `PpuFrame`, `BgLayer`, `ScanBand` (com `mathLayers?`, padrão só BG1), `ObjEntry` em `src/render/ppu/index.ts`; `hofs/vofs` = valores dos registradores (HUD `[8, −33]`, campo `[8, −25]`), `ObjEntry.y` = linha do topo (plano 5 D1, D2) | `src/render/ppu/` | trocar o caminho de import ou as constantes `*_HOFS`/`*_VOFS` (T9) |
| `staticObjects(rom, stage): {off, word}[]` (setas, pads, gangorras) | `src/rom/arena-build.ts` | ajustar `writeStatic()` no teste de golden (T9) |
| Golden `tests/fixtures/rom/gfx-render-bg.json` = `{arenas:[{stage, bg1Hofs, tileCopies: [], sha1}] × 11}` (10 arenas + arena 2 com HOFS `$18`), SHA-1 do RGBA 256×224 (plano 5 D7) | `tests/fixtures/rom/` | ajustar só `loadGolden()` (T9) |
| *Stub* `drawRomBattle(ctx, round, vis: ViewState, assets, frame): boolean` | `src/render/rom/battle.ts` | a T9 troca `vis` por `RomBattleVis = {crowns}` (D1); avisar no PR o plano 10, que chama com `{ crowns: crownsOf(m) }` |
| Núcleo (plano 6): `Bomb.state 'idle'\|'kicked'\|'held'\|'air'`, `Bomb.born`, `Flyer {kind, ref, x, y, z ≤ 0}`, `PressureState.falling: Falling {cell, t0, land}`, `FLAME_PIECE`, `BURN`, `Player.carry` (id ou −1), `Player.diseaseT`, `s.bad[] {slot, x, y, face}` em px, `floor[] = 0` → ROM, `invisibleVisible(p)`, `emptyRound(stage, rules)` | `src/core/types.ts`, `index.ts` | ajustar só `adapt.ts`/`adapt.test.ts` (T7), `sprites.ts` (T8) e `fakes.ts` (T2) |
| `createMatch(rules, stage, seed?, chars?)`, `startRound(m)`, `step(s, inputs): GameEvent[]`, `INTRO_TICKS = 62` | `src/core/match.ts`, `step.ts` | ajustar só `core-fixture.ts` |
| `render/battle-layers.ts` com `a: object` e `BattleObj` (plano 6, decisão 3); `romPlayerHooks` talvez já acrescentado pelo plano 9 | `src/render/battle-layers.ts` | Step 3 abaixo |

- [ ] **Step 3: Contrato de camadas.** Em `web/src/render/battle-layers.ts` (combinado na decisão 3 do plano 6): trocar `a: object` por `a: RomAssets`, `BattleObj` por `ObjEntry` e acrescentar o gancho de sprite do jogador do plano 9 (L17), **se ainda não existir** (se o plano 9 já o acrescentou, manter o dele). O arquivo fica assim:

```ts
import type { Player, RoundState } from '../core';
import type { RomAssets } from '../rom/types';
import type { ObjEntry } from './ppu';
import type { SpriteBank } from './sprite-bank';

/** Mantido por compatibilidade com quem já importou o nome do plano 6. */
export type BattleObj = ObjEntry;

/** Implementado pelo plano 7 (render/rom/builder.ts). */
export interface RomBattleBuilder {
  setBg2(col: number, lin: number, word: number): void;
  setBg1(col: number, lin: number, word: number): void;
  sprite(e: ObjEntry, sortY: number, order: number): void;   // ordem de desenho de [ANI §1.4]
  cgram(index: number, bgr555: number): void;
  bg1Scroll(hofs: number): void;
}

export interface RomBattleLayer { id: string; draw(s: RoundState, b: RomBattleBuilder, a: RomAssets, frame: number): void }
export interface FallbackBattleLayer { id: string; draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void }

/** Plano 9 (L17): troca o sprite do jogador (montado, traje). `null` = desenho padrão do plano 7. */
export type RomPlayerHook = (s: RoundState, p: Player, a: RomAssets, frame: number) => ObjEntry[] | null;

export const romLayers: RomBattleLayer[] = [];
export const fallbackLayers: FallbackBattleLayer[] = [];
export const romPlayerHooks: RomPlayerHook[] = [];
export function registerRomLayer(l: RomBattleLayer): void { romLayers.push(l); }
export function registerFallbackLayer(l: FallbackBattleLayer): void { fallbackLayers.push(l); }
```

- [ ] **Step 4: Ajudante da ROM** `web/tests/render-rom/rom-fixture.ts`:

```ts
import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';
import type { RomAssets } from '../../src/rom/types';

/** RomAssets da ROM real (SB4_ROM) ou null: os testes de ROM usam describe.skipIf(!ASSETS). */
export const ASSETS: RomAssets | null = ROM ? createRomAssets(ROM) : null;
```

- [ ] **Step 5: Ajudante do núcleo** `web/tests/render-rom/core-fixture.ts`:

```ts
import { BTN, createMatch, defaultRules, startRound, step, type GameEvent, type RoundState } from '../../src/core';

export { BTN };
export const NO_INPUT: readonly number[] = [0, 0, 0, 0, 0];

/** Rodada da fase `stage`: 5 jogadores, personagens 0..4, regras padrão (3:00), semente do boot ($0012). */
export function newRound(stage: number): RoundState {
  return startRound(createMatch(defaultRules(), stage, 0x12, [0, 1, 2, 3, 4]));
}

export function stepN(s: RoundState, n: number, inputs: readonly number[] = NO_INPUT): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...step(s, inputs));
  return ev;
}

/** Avança a intro (62 ticks) sem entradas. */
export function toPlay(s: RoundState, max = 200): void {
  for (let i = 0; i < max && s.phase === 'intro'; i++) step(s, NO_INPUT);
  if (s.phase !== 'play') throw new Error(`rodada em ${s.phase}, esperado play`);
}
```

- [ ] **Step 6: Teste de sincronização** `web/tests/render-rom/sync.test.ts`:

```ts
import { renderPpu } from '../../src/render/ppu';
import { drawRomBattle } from '../../src/render/rom/battle';
import { romLayers, romPlayerHooks } from '../../src/render/battle-layers';
import { CODE, FLAME_PIECE, BURN, GRID_W, GRID_H, invisibleVisible } from '../../src/core';
import { newRound, toPlay } from './core-fixture';
import { ASSETS } from './rom-fixture';

describe('sincronização com os planos 5 e 6', () => {
  it('exporta o que o plano 7 usa', () => {
    expect(typeof renderPpu).toBe('function');
    expect(typeof drawRomBattle).toBe('function');
    expect(Array.isArray(romLayers)).toBe(true);
    expect(Array.isArray(romPlayerHooks)).toBe(true);
    expect(typeof invisibleVisible).toBe('function');
    expect([GRID_W, GRID_H]).toEqual([17, 13]);
    expect([CODE.FLAME, CODE.BURNING, CODE.FALLING]).toEqual([0x1000, 0xedc0, 0x0001]);
    expect(FLAME_PIECE).toEqual({ CENTER: 0, ARM_UP: 1, ARM_RIGHT: 2, ARM_DOWN: 3, ARM_LEFT: 4, TIP_UP: 5, TIP_RIGHT: 6, TIP_DOWN: 7, TIP_LEFT: 8 });
    expect(BURN).toEqual({ SOFT: 0, ITEM: 1 });
  });
  it('rodada nova: 5 presentes nos spawns (1 px fora do centro) e chega em play', () => {
    const s = newRound(1);
    expect(s.players.map(p => [p.present, p.x >> 8, p.y >> 8])).toEqual([
      [true, 32, 48], [true, 224, 208], [true, 224, 48], [true, 32, 208], [true, 128, 128]]);
    expect(s.floor.every(w => w === 0)).toBe(true);
    toPlay(s);
    expect(s.tick).toBe(62);
  });
  it.skipIf(!ASSETS)('RomAssets da ROM: arena 1 com 1024 tiles e HUD de 96 palavras', () => {
    const ar = ASSETS!.arena(1);
    expect(ar.bgTiles.count).toBe(1024);
    expect(ar.hudMap.length).toBeGreaterThanOrEqual(96);
    expect(Array.from(ar.hudMap.slice(0, 8))).toEqual([0x6600, 0x2600, 0x260c, 0x260d, 0x260b, 0x263a, 0x260b, 0x260b]);
    expect(ASSETS!.character(0).hudHead(0).count).toBe(6);
  });
});
```

- [ ] **Step 7: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/sync.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/sync.test.ts && npx tsc --noEmit`
Expected: PASS nas duas rodadas (a 2ª sem *skipped*); `tsc` limpo. Um erro de tipo ou de nome aqui = diferença a registrar e aplicar nos blocos das T2–T10.

- [ ] **Step 8: Registrar e aplicar as diferenças.** Preencher a tabela "Sincronização" no fim deste arquivo (uma linha por diferença, com o que foi trocado). Aplicar as trocas nos blocos de código das Tarefas 2–10 deste arquivo.

- [ ] **Step 9: Commit**

```bash
git add web/src/render/battle-layers.ts web/tests/render-rom docs/superpowers/plans/2026-09-26-crown-blast-7-graficos-partida.md
git commit -m "$(cat <<'MSG'
test(render): sincroniza o plano 7 com os planos 5 e 6

Contrato de camadas tipado com RomAssets/ObjEntry e gancho romPlayerHooks (L17 do plano 9).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 2: Fundação — tipos, tabelas da ROM, `FrameBuilder`, esqueleto de sprites, assets falsos

**Files:**
- Create: `web/src/render/rom/scene.ts`, `web/src/render/rom/tables.ts`, `web/src/render/rom/builder.ts`, `web/src/render/rom/sprites.ts` (esqueleto)
- Create: `web/tests/render-rom/fakes.ts`, `web/tests/render-rom/builder.test.ts`, `web/tests/render-rom/tables.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: T1; plano 5 (tipos de `rom/types`, `RomView`, `ObjEntry`); plano 6 (`RoundState`, `PlayerAct`, `emptyRound`, `defaultRules`).
- Produces: `GridBomb`, `SceneObj`, `PressureDrop`, `FlamePieceName`, `BurnKind`, `RomScene`, `RomClock`, `RomMemo`, `TileOverride`, `PlayerPose`, `MAP_W`, `mapIndex`, `newMemo`, `OBJ_ITEM_PAL`; `RomTables`, `romTables`, `ITEM_TABLE`, `CROWN_TABLE`, `TEAM_PALETTES`; `FrameBuilder`, `ORDER_PLAYER`, `ORDER_OBJ`, `ORDER_PRESSURE`, `ORDER_LAYER`; `SpriteCtx`, `drawSprites` (vazio); nos testes: `fakeTiles`, `fakeRom`, `fakeAssets`, `fakeRound`, `fakeAnimAddr`, `fr`, `FAKE_ANIMS`, `NORMAL_BOMB`, `REMOTE_BOMB`, `blankImage`.

- [ ] **Step 1: Assets falsos** `web/tests/render-rom/fakes.ts` (usados por todos os testes sem ROM):

```ts
import type { Anim, AnimFrame, ArenaAssets, CharacterAssets, RomAssets, Tiles } from '../../src/rom/types';
import type { RomView } from '../../src/rom/view';
import { defaultRules, emptyRound, type RoundState } from '../../src/core';

const le16 = (w: number) => [w & 0xff, (w >> 8) & 0xff];
const le24 = (a: number) => [a & 0xff, (a >> 8) & 0xff, (a >> 16) & 0xff];

/** `count` tiles 8×8; o tile t fica todo com o índice fill(t). */
export function fakeTiles(count: number, fill: (tile: number) => number = () => 0): Tiles {
  const px = new Uint8Array(count * 64);
  for (let t = 0; t < count; t++) px.fill(fill(t), t * 64, t * 64 + 64);
  return { bpp: 4, count, px };
}

/** RomView falso: memória esparsa em endereços SNES. */
export function fakeRom(bytes: Record<number, number[]>): RomView {
  const mem = new Map<number, number>();
  for (const [a, list] of Object.entries(bytes)) list.forEach((b, i) => mem.set(Number(a) + i, b));
  const u8 = (a: number) => mem.get(a) ?? 0;
  const u16 = (a: number) => u8(a) | (u8(a + 1) << 8);
  const p24 = (a: number) => u16(a) | (u8(a + 2) << 16);
  return { u8, u16, u24: p24, p24, bytes: (a: number, n: number) => Uint8Array.from({ length: n }, (_, i) => u8(a + i)) } as unknown as RomView;
}

export const FAKE_ITEM_WORDS: Readonly<Record<number, number>> = { 0x01: 0x1280, 0x03: 0x1282, 0x21: 0x128a };
const ANIM_TABS = [0xc276c5, 0xc27515, 0xc27665, 0xc2755d, 0xc2746d, 0xc2749d, 0xc26ce8, 0xc26f71, 0xc26e15, 0xc26f05, 0xc26f35, 0xc26fc5];
const DIRECT = new Set([0xc26e15, 0xc26f05]);

/** Endereço sintético da animação: $D8:kkii (k = tabela, ii = índice; direta = $FF). O 1º quadro padrão usa g = ii. */
export function fakeAnimAddr(tab: number, idx: number | null): number {
  return 0xd80000 | (ANIM_TABS.indexOf(tab) << 8) | (idx ?? 0xff);
}
export const fr = (dur: number, g: number, mx = 0, my = 0): AnimFrame =>
  ({ dur, mx, my, pieces: [{ dx: -16, dy: -24, tile: g, hflip: false, vflip: false, big: true, palAdd: 0 }] });
export const FAKE_ANIMS = new Map<number, Anim>([
  [fakeAnimAddr(0xc26e15, null), [fr(5, 24), fr(5, 25), fr(6, 26), fr(6, 27)]],   // morte
  [fakeAnimAddr(0xc276c5, 1), [fr(12, 4), fr(8, 3), fr(12, 5), fr(8, 3)]],        // andar →
]);
export const NORMAL_BOMB = [{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }, { word: 0x0b04, dur: 16 }, { word: 0x0b06, dur: 16 }];
export const REMOTE_BOMB = [0x0b08, 0x0b0a, 0x0b0c, 0x0b0e].map(word => ({ word, dur: 16 }));

export function fakeRomBytes(): Record<number, number[]> {
  const b: Record<number, number[]> = {};
  const items: number[] = [];
  for (let id = 0; id < 0x30; id++) items.push(...le16(FAKE_ITEM_WORDS[id] ?? 0x1200 + id), 0x40 + id, 0x09);
  b[0xc15fe0] = items;
  const crowns: number[] = [];
  for (let n = 0; n < 10; n++) crowns.push(...le16(0x2640 + n));
  b[0xc45d11] = crowns;
  const team: number[] = [];
  for (let k = 0; k < 8 * 8; k++) team.push(...le24(0xc01000), 0);
  b[0xc27b9d] = team;
  b[0xc01000] = Array.from({ length: 16 }, (_, i) => le16(0x0100 + i)).flat();
  ANIM_TABS.forEach((tab, k) => {
    const second = 0xe10000 | (k << 8);
    b[tab] = Array.from({ length: 8 }, () => le24(DIRECT.has(tab) ? fakeAnimAddr(tab, null) : second)).flat();
    if (!DIRECT.has(tab)) b[second] = Array.from({ length: 16 }, (_, i) => le24(fakeAnimAddr(tab, i))).flat();
  });
  return b;
}

export function fakeArena(stage: number, over: Partial<ArenaAssets> = {}): ArenaAssets {
  const hud = new Uint16Array(96).fill(0x260b);
  for (let r = 0; r < 3; r++) hud[r * 32 + 5] = 0x263a + 0x10 * r;
  return {
    stage, bgTiles: fakeTiles(1024, t => t & 0xff), bgCgram: Uint16Array.from({ length: 128 }, (_, i) => i),
    bg1: new Uint16Array(1024), bg2Base: Uint16Array.from({ length: 1024 }, (_, i) => 0x2000 | i),
    floor: Uint16Array.from({ length: 1024 }, (_, i) => 0x1000 | i), logicBase: new Uint16Array(1024),
    tileAnim: null, palAnim: [], colorMath: 'none', hudMap: hud,
    bg3Font: fakeTiles(0), bg3Banners: fakeTiles(0), objCommon: fakeTiles(512),
    objCgram: Uint16Array.from({ length: 128 }, (_, i) => 0x4000 + i), record: 0, removeN: 0, ...over,
  } as unknown as ArenaAssets;
}

export function fakeCharacter(c: number): CharacterAssets {
  const frames = new Map<number, Uint8Array>();
  return {
    frame: (g: number) => {
      let f = frames.get(g);
      if (!f) { f = new Uint8Array(1024).fill((g & 15) || 1); frames.set(g, f); }
      return f;
    },
    palettes: [0, 1, 2, 3, 4].map(slot => Uint16Array.from({ length: 16 }, (_, i) => (c << 12) | (slot << 8) | i)),
    victoryFrame: () => new Uint8Array(1024),
    hudHead: (_slot: number) => fakeTiles(6, t => 0x40 + 8 * c + t),
  } as unknown as CharacterAssets;
}

export function fakeAssets(opt: { arena?: Partial<ArenaAssets>; arenaThrows?: boolean } = {}): RomAssets {
  const rom = fakeRom(fakeRomBytes());
  const arenas = new Map<number, ArenaAssets>();
  const chars = new Map<number, CharacterAssets>();
  const anim = (addr: number): Anim => FAKE_ANIMS.get(addr) ?? [fr(255, addr & 0xff)];
  const fail = () => { throw new Error('não usado nos testes do plano 7'); };
  return {
    rom,
    arena: (n: number) => {
      if (opt.arenaThrows) throw new Error('arena falsa com defeito');
      let a = arenas.get(n);
      if (!a) { a = fakeArena(n, opt.arena); arenas.set(n, a); }
      return a;
    },
    character: (c: number) => {
      let ch = chars.get(c);
      if (!ch) { ch = fakeCharacter(c); chars.set(c, ch); }
      return ch;
    },
    anim,
    playerAnim: (tab: number, _c: number, idx: number) => anim(fakeAnimAddr(tab, idx)),
    bombScript: (t: number) => (t === 1 ? REMOTE_BOMB : NORMAL_BOMB),
    scene: fail, mode7Draw: fail, audioData: fail,
  } as unknown as RomAssets;
}

/** Rodada vazia do núcleo (paredes + pilares), já em `play`. */
export function fakeRound(over: Partial<RoundState> = {}): RoundState {
  const s = emptyRound(1, defaultRules());
  s.phase = 'play';
  return Object.assign(s, over);
}

export function blankImage(): ImageData {
  return { width: 256, height: 224, data: new Uint8ClampedArray(256 * 224 * 4), colorSpace: 'srgb' } as ImageData;
}
```

- [ ] **Step 2: Testes do builder** `web/tests/render-rom/builder.test.ts`:

```ts
import { FrameBuilder, ORDER_OBJ, ORDER_PLAYER } from '../../src/render/rom/builder';
import type { ObjEntry } from '../../src/render/ppu';

const obj = (x: number): ObjEntry => ({ x, y: 0, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { tile: 0 } });
const blank = () => new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));

describe('FrameBuilder', () => {
  it('copia as bases e grava palavras por (col, lin) do mapa 32×32', () => {
    const bg2 = new Uint16Array(1024).fill(7);
    const b = new FrameBuilder(new Uint16Array(1024), bg2, new Uint16Array(256));
    b.setBg2(2, 1, 0x0b00);
    b.setBg1(31, 31, 0x1234);
    expect(b.bg2[34]).toBe(0x0b00);
    expect(b.bg1[1023]).toBe(0x1234);
    expect(bg2[34]).toBe(7);
    b.setBg2(32, 0, 1); b.setBg2(-1, 0, 1); b.setBg1(0, 32, 1);
    expect(Array.from(b.bg2).filter(w => w === 1)).toHaveLength(0);
    expect(Array.from(b.bg1).filter(w => w === 1)).toHaveLength(0);
  });
  it('cgram em 15 bits, só 0..255', () => {
    const b = blank();
    b.cgram(79, 0xffff);
    b.cgram(256, 5);
    expect(b.cg[79]).toBe(0x7fff);
    expect(b.cg.length).toBe(256);
  });
  it('bg1Scroll guarda o HOFS do campo (padrão 8)', () => {
    const b = blank();
    expect(b.hofs1).toBe(8);
    b.bg1Scroll(0x18);
    expect(b.hofs1).toBe(0x18);
  });
  it('OAM medida em st_arena01 [ANI §1.4]: P2 (207), P4 (207), P5 (128), P3 (48), P1 (47)', () => {
    const b = blank();
    b.sprite(obj(1), 47, ORDER_PLAYER + 0);
    b.sprite(obj(2), 207, ORDER_PLAYER + 1);
    b.sprite(obj(3), 48, ORDER_PLAYER + 2);
    b.sprite(obj(4), 207, ORDER_PLAYER + 3);
    b.sprite(obj(5), 128, ORDER_PLAYER + 4);
    expect(b.oam().map(e => e.x)).toEqual([2, 4, 5, 3, 1]);
  });
  it('mesmo Y: jogador antes de objeto; objetos na ordem de chegada', () => {
    const b = blank();
    b.sprite(obj(10), 100, ORDER_OBJ);
    b.sprite(obj(11), 100, ORDER_OBJ);
    b.sprite(obj(12), 100, ORDER_PLAYER + 4);
    expect(b.oam().map(e => e.x)).toEqual([12, 10, 11]);
  });
});
```

- [ ] **Step 3: Testes das tabelas** `web/tests/render-rom/tables.test.ts`:

```ts
import { romTables } from '../../src/render/rom/tables';
import { ASSETS } from './rom-fixture';
import { fakeAssets } from './fakes';

describe('tabelas da ROM (assets falsos)', () => {
  it('lê item, coroa e paleta de time pelos endereços', () => {
    const t = romTables(fakeAssets());
    expect(t.itemWord(0x01)).toBe(0x1280);
    expect(t.itemWord(0x41)).toBe(0x1280);   // só os 6 bits baixos
    expect(t.crownWord(2)).toBe(0x2642);
    expect(t.crownWord(12)).toBe(0x2649);    // limita a 9
    expect(t.crownWord(-1)).toBe(0x2640);
    expect(t.teamPalette(0, 0)[3]).toBe(0x0103);
  });
  it('cache por RomAssets', () => {
    const a = fakeAssets();
    expect(romTables(a)).toBe(romTables(a));
  });
});

describe.skipIf(!ASSETS)('tabelas da ROM (real)', () => {
  const t = () => romTables(ASSETS!);
  it('item → palavra do BG2 ($C1:5FE0): as da §7.1 e as que a A13 deixava em aberto', () => {
    const known: [number, number][] = [
      [0x01, 0x1280], [0x03, 0x1282], [0x05, 0x12a2], [0x0d, 0x12ec], [0x0e, 0x12a4], [0x07, 0x12a6], [0x12, 0x12a8],
      [0x21, 0x128a], [0x2b, 0x128a], [0x02, 0x1284], [0x04, 0x1286], [0x06, 0x128e], [0x08, 0x128c], [0x09, 0x12c0],
      [0x0a, 0x12a0], [0x0b, 0x1288], [0x0c, 0x12ae], [0x0f, 0x12ea], [0x11, 0x12e8]];
    for (const [id, w] of known) expect(t().itemWord(id), `item $${id.toString(16)}`).toBe(w);
  });
  it('coroas ($C4:5D11, u16): 0→$264F, 1..5→$263B..$263F, 6..9→$264B..$264E', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => t().crownWord(n)))
      .toEqual([0x264f, 0x263b, 0x263c, 0x263d, 0x263e, 0x263f, 0x264b, 0x264c, 0x264d, 0x264e]);
  });
  it('paletas de time ($C2:7B9D): o personagem 0 aponta para as mesmas da tabela normal', () => {
    for (let s = 0; s < 5; s++) expect(Array.from(t().teamPalette(0, s))).toEqual(Array.from(ASSETS!.character(0).palettes[s]));
  });
});
```

- [ ] **Step 4: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/builder.test.ts tests/render-rom/tables.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 5: Tipos do plano** `web/src/render/rom/scene.ts`:

```ts
import type { PlayerAct } from '../../core';

/** Bomba parada na grade: palavra do BG2 pelo script do tipo, desde `born`. */
export interface GridBomb { type: number; born: number }
/** OBJ de objeto: bomba em movimento/na mão/voando ou item voando. px de tela; (x, y) = centro no chão; z = altura (≥ 0). */
export interface SceneObj { kind: 'bomb' | 'item'; item: number; x: number; y: number; z: number }
/** Passo da pressão com bloco (Falling do núcleo). */
export interface PressureDrop { cell: number; t0: number; land: number }
export type FlamePieceName = 'center' | 'armU' | 'armR' | 'armD' | 'armL' | 'tipU' | 'tipR' | 'tipD' | 'tipL';
export type BurnKind = 'soft' | 'item';

/** O que o render precisa do núcleo além dos campos da §3.4 (traduzido por adapt.ts). */
export interface RomScene {
  gridBombs: Map<number, GridBomb>;
  objs: SceneObj[];
  drops: PressureDrop[];
  flame(cell: number): FlamePieceName;
  burn(cell: number): BurnKind;
  team: boolean;
}
/** tick: relógio visual (congela no TIME UP); bombTick: congela também na vitória; frame: contador global ($016C). */
export interface RomClock { tick: number; bombTick: number; frame: number }
/** Memória do render por rodada (WeakMap pela RoundState). */
export interface RomMemo { freezeAll: number | null; freezeBombs: number | null; recentDrops: PressureDrop[] }
/** Troca de um tile 8×8 do BG (64 índices). */
export interface TileOverride { tile: number; px: Uint8Array }
export interface PlayerPose { act: PlayerAct; face: number; char: number; moving: boolean }

export const MAP_W = 32;
export const mapIndex = (col: number, lin: number): number => lin * MAP_W + col;
/** Paleta OBJ livre no Battle (GFX §3.3) que recebe a paleta BG 4 para os itens voando (D12). */
export const OBJ_ITEM_PAL = 2;
export function newMemo(): RomMemo { return { freezeAll: null, freezeBombs: null, recentDrops: [] }; }
```

- [ ] **Step 6: Tabelas** `web/src/render/rom/tables.ts`:

```ts
import type { RomAssets } from '../../rom/types';

export const ITEM_TABLE = 0xc15fe0;     // 4 B por ID ($00..$2F): u16 palavra do BG2, u16 lógico (lido em $C1:5D00)
export const CROWN_TABLE = 0xc45d11;    // u16 por nº de coroas (0..9): palavra do HUD
export const TEAM_PALETTES = 0xc27b9d;  // mesmo formato de $C2:779D: ptr24 + atributo, índice c·32 + slot·4 (A1)

export interface RomTables {
  itemWord(id: number): number;
  crownWord(n: number): number;
  teamPalette(char: number, slot: number): Uint16Array;
}

const cache = new WeakMap<RomAssets, RomTables>();

export function romTables(a: RomAssets): RomTables {
  const hit = cache.get(a);
  if (hit) return hit;
  const rom = a.rom;
  const items = new Map<number, number>();
  const pals = new Map<number, Uint16Array>();
  const t: RomTables = {
    itemWord(id) {
      const k = id & 0x3f;
      let w = items.get(k);
      if (w === undefined) { w = rom.u16(ITEM_TABLE + 4 * k); items.set(k, w); }
      return w;
    },
    crownWord: n => rom.u16(CROWN_TABLE + 2 * Math.max(0, Math.min(9, n))),
    teamPalette(char, slot) {
      const key = char * 8 + slot;
      let p = pals.get(key);
      if (!p) {
        const src = rom.p24(TEAM_PALETTES + 32 * char + 4 * slot);
        p = Uint16Array.from({ length: 16 }, (_, i) => rom.u16(src + 2 * i));
        pals.set(key, p);
      }
      return p;
    },
  };
  cache.set(a, t);
  return t;
}
```

- [ ] **Step 7: Builder** `web/src/render/rom/builder.ts`:

```ts
import type { ObjEntry } from '../ppu';
import type { RomBattleBuilder } from '../battle-layers';

/** Desempate de sprites com o mesmo Y: menor na frente (jogadores antes dos objetos, [ANI §1.4]). */
export const ORDER_PLAYER = 0;     // + slot
export const ORDER_OBJ = 100;      // + ordem de criação
export const ORDER_PRESSURE = 300; // + 2·i (bloco) / + 2·i + 1 (sombra)
export const ORDER_LAYER = 1000;   // sugestão para as camadas dos planos 8 e 9

interface Spr { e: ObjEntry; sortY: number; order: number; seq: number }

export class FrameBuilder implements RomBattleBuilder {
  readonly bg1 = new Uint16Array(1024);
  readonly bg2 = new Uint16Array(1024);
  readonly cg = new Uint16Array(256);
  hofs1 = 8;
  private readonly spr: Spr[] = [];

  constructor(bg1: Uint16Array, bg2: Uint16Array, cgram: Uint16Array) {
    this.bg1.set(bg1.subarray(0, 1024));
    this.bg2.set(bg2.subarray(0, 1024));
    this.cg.set(cgram.subarray(0, 256));
  }
  setBg2(col: number, lin: number, word: number): void {
    if (col >= 0 && col < 32 && lin >= 0 && lin < 32) this.bg2[lin * 32 + col] = word & 0xffff;
  }
  setBg1(col: number, lin: number, word: number): void {
    if (col >= 0 && col < 32 && lin >= 0 && lin < 32) this.bg1[lin * 32 + col] = word & 0xffff;
  }
  sprite(e: ObjEntry, sortY: number, order: number): void {
    this.spr.push({ e, sortY, order, seq: this.spr.length });
  }
  cgram(index: number, bgr555: number): void {
    if (index >= 0 && index < 256) this.cg[index] = bgr555 & 0x7fff;
  }
  bg1Scroll(hofs: number): void { this.hofs1 = hofs; }
  /** OAM: maior sortY na frente; empate → menor order; empate → quem chegou antes. Índice 0 = frente. */
  oam(): ObjEntry[] {
    return [...this.spr].sort((a, b) => b.sortY - a.sortY || a.order - b.order || a.seq - b.seq).map(s => s.e);
  }
}
```

- [ ] **Step 8: Esqueleto de sprites** `web/src/render/rom/sprites.ts` (a T8 substitui o corpo; a T9 já pode chamar):

```ts
import type { RoundState } from '../../core';
import type { RomAssets, Tiles } from '../../rom/types';
import type { FrameBuilder } from './builder';
import type { RomTables } from './tables';
import type { RomClock, RomMemo, RomScene } from './scene';

export interface SpriteCtx {
  s: RoundState; a: RomAssets; tb: RomTables; scene: RomScene; clock: RomClock; memo: RomMemo;
  tiles: Tiles;   // tiles de BG do quadro (itens voando, D12)
}

/** Jogadores, Bad Bombers, objetos e pressão (Tarefa 8). */
export function drawSprites(_b: FrameBuilder, _c: SpriteCtx): void {}
```

- [ ] **Step 9: Rodar.**

Run: `cd web && npx vitest run tests/render-rom && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/tables.test.ts && npx tsc --noEmit`
Expected: PASS; com a ROM, os 3 testes reais passam (não *skipped*).

- [ ] **Step 10: Commit**

```bash
git add web/src/render/rom web/tests/render-rom
git commit -m "$(cat <<'MSG'
feat(render): fundação dos gráficos da ROM — tipos, tabelas, FrameBuilder

Tabela item → palavra do BG2 em $C1:5FE0 fecha a A13.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 3: Amostragem de animação e ação × direção → animação da ROM

**Files:**
- Create: `web/src/render/anim/sample.ts`, `web/src/render/anim/player-anim.ts`
- Test: `web/tests/render-rom/sample.test.ts`, `web/tests/render-rom/player-anim.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: `Anim`, `AnimFrame`, `RomAssets`, `RomView` (plano 5); `PlayerAct` (plano 6); `PlayerPose` (T2).
- Produces: `AnimSample`, `sampleAnim(anim, t)`, `animCycle(anim)`; `AnimRef`, `BORED_AFTER`, `TAB`, `playerAnimRef(pose, t)`, `animAddr(rom, ref, char)`, `resolveAnim(a, ref, char)`.

Regras (ANI §1.3, §2.6, §3; spec §7.4):
- Amostra em `t` ticks: percorre os quadros pela duração; `dur = 255` congela; `dur = 0` vale 256 (o contador da ROM dá a volta); **todas as animações fazem loop**. `t < 0` = 0.
- `ox/oy` = soma de `mx/my` do quadro 0 ao atual, dentro do ciclo (D16).
- Tabelas: `anim = p24(p24(tab + 3·(char & 7)) + 3·idx)`; tabelas diretas (`idx = null`): `p24(tab + 3·(char & 7))`.
- Índice por direção: tabelas de 8/16 entradas usam `{0: 0, 2: 1, 4: 4, 6: 5}` (+8 = parado); as de 4 entradas (D14) usam `face / 2`.

- [ ] **Step 1: Testes sem ROM** `web/tests/render-rom/sample.test.ts`:

```ts
import { animCycle, sampleAnim } from '../../src/render/anim/sample';
import type { Anim } from '../../src/rom/types';
import { fr } from './fakes';

const WALK: Anim = [fr(12, 4), fr(8, 3), fr(12, 5), fr(8, 3)];
const g = (a: Anim, t: number) => sampleAnim(a, t).frame.pieces[0].tile;

describe('sampleAnim', () => {
  it('andar →: g4:12 g3:8 g5:12 g3:8 e loop', () => {
    expect([0, 11, 12, 19, 20, 31, 32, 39, 40, 79, 80].map(t => g(WALK, t))).toEqual([4, 4, 3, 3, 5, 5, 3, 3, 4, 3, 4]);
    expect(animCycle(WALK)).toBe(40);
  });
  it('dur 255 congela o quadro', () => {
    const a: Anim = [fr(5, 1), fr(255, 2), fr(3, 3)];
    expect([0, 4, 5, 1000].map(t => sampleAnim(a, t).index)).toEqual([0, 0, 1, 1]);
    expect(animCycle(a)).toBe(Infinity);
  });
  it('t negativo = 0; dur 0 vale 256', () => {
    expect(sampleAnim(WALK, -5).index).toBe(0);
    const a: Anim = [fr(0, 1), fr(1, 2)];
    expect([255, 256, 257].map(t => sampleAnim(a, t).index)).toEqual([0, 1, 0]);
  });
  it('mx/my acumulados dentro do ciclo', () => {
    const a: Anim = [fr(2, 1, 1, 0), fr(2, 2, 2, -1), fr(2, 3, -3, 1)];
    expect([0, 2, 4, 6].map(t => { const s = sampleAnim(a, t); return [s.ox, s.oy]; })).toEqual([[1, 0], [3, -1], [0, 0], [1, 0]]);
  });
  it('animação vazia é erro', () => {
    expect(() => sampleAnim([], 0)).toThrow();
  });
});
```

- [ ] **Step 2: Testes de ação** `web/tests/render-rom/player-anim.test.ts`:

```ts
import { BORED_AFTER, animAddr, playerAnimRef, resolveAnim } from '../../src/render/anim/player-anim';
import { animCycle, sampleAnim } from '../../src/render/anim/sample';
import type { PlayerAct } from '../../src/core';
import { ASSETS } from './rom-fixture';

const FACES = [0, 2, 4, 6] as const;
const pose = (act: PlayerAct, face = 4, char = 0, moving = false) => ({ act, face, char, moving });
const hex = (n: number) => n.toString(16);

describe('ação → tabela (sem ROM)', () => {
  it('parado e andando: $C2:76C5 com [8,9,12,13] e [0,1,4,5]', () => {
    expect(FACES.map(f => playerAnimRef(pose('idle', f), 0).ref)).toEqual([8, 9, 12, 13].map(idx => ({ tab: 0xc276c5, idx })));
    expect(FACES.map(f => playerAnimRef(pose('walk', f), 0).ref)).toEqual([0, 1, 4, 5].map(idx => ({ tab: 0xc276c5, idx })));
  });
  it('tédio depois de 383 ticks parado: $C2:6F71 [4 + char], tempo contado a partir do 383', () => {
    expect(playerAnimRef(pose('idle', 4, 3), BORED_AFTER - 1).ref).toEqual({ tab: 0xc276c5, idx: 12 });
    expect(playerAnimRef(pose('idle', 4, 3), BORED_AFTER + 10)).toEqual({ ref: { tab: 0xc26f71, idx: 7 }, t: 10 });
  });
  it('luva, soco e P pelas tabelas da §7.4', () => {
    expect(playerAnimRef(pose('lift', 2), 0).ref).toEqual({ tab: 0xc27515, idx: 1 });
    expect(playerAnimRef(pose('carryIdle', 6), 0).ref).toEqual({ tab: 0xc27665, idx: 13 });
    expect(playerAnimRef(pose('carryWalk', 0), 0).ref).toEqual({ tab: 0xc27665, idx: 0 });
    expect(playerAnimRef(pose('throw', 4), 0).ref).toEqual({ tab: 0xc2755d, idx: 4 });
    expect(playerAnimRef(pose('punch', 6), 0).ref).toEqual({ tab: 0xc2746d, idx: 5 });
    expect(playerAnimRef(pose('pPunch', 2), 0).ref).toEqual({ tab: 0xc2749d, idx: 1 });
  });
  it('diretas (morte, vitória) e de índice fixo (B, choque, atordoado)', () => {
    expect(playerAnimRef(pose('dying'), 3)).toEqual({ ref: { tab: 0xc26e15, idx: null }, t: 3 });
    expect(playerAnimRef(pose('victory'), 3).ref).toEqual({ tab: 0xc26f05, idx: null });
    expect(playerAnimRef(pose('detonate', 0), 0).ref).toEqual({ tab: 0xc26ce8, idx: 12 });
    expect(playerAnimRef(pose('shocked', 6), 0).ref).toEqual({ tab: 0xc26ce8, idx: 4 });
    expect(playerAnimRef(pose('stunned', 2), 0).ref).toEqual({ tab: 0xc26f71, idx: 10 });
  });
  it('provisórios (D14): lançado, empurrado e dança por face/2; Bad Bomber; montando sem tédio', () => {
    expect(FACES.map(f => playerAnimRef(pose('launched', f), 0).ref)).toEqual([0, 1, 2, 3].map(idx => ({ tab: 0xc26f35, idx })));
    expect(playerAnimRef(pose('pushed', 6), 0).ref).toEqual({ tab: 0xc26ce8, idx: 3 });
    expect(playerAnimRef(pose('dance', 2), 0).ref).toEqual({ tab: 0xc26fc5, idx: 1 });
    expect(playerAnimRef(pose('bad', 2, 0, true), 0).ref).toEqual({ tab: 0xc276c5, idx: 1 });
    expect(playerAnimRef(pose('mounting', 4), 500).ref).toEqual({ tab: 0xc276c5, idx: 12 });
    expect(playerAnimRef(pose('dismount', 0), 500).ref).toEqual({ tab: 0xc276c5, idx: 8 });
  });
});

describe.skipIf(!ASSETS)('ação × direção → animação da ROM (§7.4)', () => {
  const A = () => ASSETS!;
  const addrs = (act: PlayerAct, c: number) => FACES.map(f => animAddr(A().rom, playerAnimRef(pose(act, f, c), 0).ref, c));
  const same = (a: number) => [a, a, a, a];
  const EXPECT: [PlayerAct, number[]][] = [
    ['idle', [0xd8165a, 0xd81653, 0xd81645, 0xd8164c]],
    ['walk', [0xd816ac, 0xd81693, 0xd81661, 0xd8167a]],
    ['lift', [0xd81dd2, 0xd81db9, 0xd81d87, 0xd81da0]],
    ['carryIdle', [0xd8208c, 0xd82085, 0xd82077, 0xd8207e]],
    ['carryWalk', [0xd820de, 0xd820c5, 0xd82093, 0xd820ac]],
    ['throw', [0xd81f48, 0xd81f41, 0xd81f33, 0xd81f3a]],
    ['punch', [0xd8205e, 0xd82045, 0xd82013, 0xd8202c]],
    ['pPunch', [0xd82adf, 0xd82ad8, 0xd82aca, 0xd82ad1]],
    ['detonate', same(0xd82aa7)], ['stunned', same(0xd819b2)], ['shocked', same(0xd82a9a)],
    ['dying', same(0xd81999)], ['victory', same(0xd82a74)],
    ['launched', [0xd80a1e, 0xd809c9, 0xd8091f, 0xd80974]],
    ['pushed', [0xd82a00, 0xd829f3, 0xd829d9, 0xd829e6]],
    ['dance', [0xd81d44, 0xd81d01, 0xd81c7b, 0xd81cbe]],
  ];
  for (const [act, list] of EXPECT) it(`${act}: mesmos endereços nos 6 personagens`, () => {
    for (let c = 0; c < 6; c++) expect(addrs(act, c).map(hex)).toEqual(list.map(hex));
  });
  it('tédio por personagem ($C2:6F71 [4 + char])', () => {
    const got = [0, 1, 2, 3, 4, 5].map(c => animAddr(A().rom, playerAnimRef(pose('idle', 4, c), BORED_AFTER).ref, c));
    expect(got.map(hex)).toEqual([0xd82a0d, 0xd8023d, 0xd802e0, 0xd80335, 0xd803fc, 0xd8046f].map(hex));
  });
  const first = (act: PlayerAct) => FACES.map(f => sampleAnim(resolveAnim(A(), playerAnimRef(pose(act, f), 0).ref, 0), 0).frame.pieces[0].tile);
  it('1º quadro (g) por ação × ↑→↓←', () => {
    expect(first('idle')).toEqual([0, 3, 6, 9]);
    expect(first('walk')).toEqual([1, 4, 7, 10]);
    expect(first('lift')).toEqual([32, 35, 38, 41]);
    expect(first('carryIdle')).toEqual([32, 35, 38, 41]);
    expect(first('carryWalk')).toEqual([33, 36, 39, 42]);
    expect(first('throw')).toEqual([28, 29, 30, 31]);
    expect(first('punch')).toEqual([12, 13, 14, 15]);
    expect(first('pPunch')).toEqual([60, 61, 62, 63]);
    expect(first('detonate')).toEqual([47, 47, 47, 47]);
    expect(first('dying')).toEqual([24, 24, 24, 24]);
    expect(first('victory')).toEqual([45, 45, 45, 45]);
  });
  const seq = (act: PlayerAct, f: number) => resolveAnim(A(), playerAnimRef(pose(act, f), 0).ref, 0).map(x => `g${x.pieces[0].tile}:${x.dur}`);
  it('sequências literais da ANI', () => {
    expect(seq('walk', 2)).toEqual(['g4:12', 'g3:8', 'g5:12', 'g3:8']);
    expect(seq('walk', 4)).toEqual(['g7:12', 'g6:8', 'g8:12', 'g6:8']);
    expect(seq('dying', 4)).toEqual(['g24:5', 'g25:5', 'g26:6', 'g27:6']);
    expect(seq('victory', 4)).toEqual(['g45:12', 'g46:12']);
    expect(seq('stunned', 4)).toEqual(['g0:4', 'g3:4', 'g6:4', 'g9:4']);
    expect(seq('detonate', 4)).toEqual(['g47:255']);
    expect(animCycle(resolveAnim(A(), { tab: 0xc26e15, idx: null }, 0))).toBe(22);
  });
  it('peça padrão do jogador: (−16, −24), 32×32', () => {
    const p = resolveAnim(A(), playerAnimRef(pose('walk', 4), 0).ref, 0)[0].pieces[0];
    expect([p.dx, p.dy, p.big, p.palAdd]).toEqual([-16, -24, true, 0]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/sample.test.ts tests/render-rom/player-anim.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar** `web/src/render/anim/sample.ts`:

```ts
import type { Anim, AnimFrame } from '../../rom/types';

export interface AnimSample { index: number; frame: AnimFrame; ox: number; oy: number }

const durOf = (d: number): number => (d === 0 ? 256 : d);

/** Soma das durações; Infinity se algum quadro congela (dur 255). */
export function animCycle(anim: Anim): number {
  let n = 0;
  for (const f of anim) {
    if (f.dur === 255) return Infinity;
    n += durOf(f.dur);
  }
  return n;
}

/** Quadro em `t` ticks desde o início da animação (ANI §1.3): dur 255 congela; todas fazem loop. */
export function sampleAnim(anim: Anim, t: number): AnimSample {
  if (anim.length === 0) throw new Error('animação vazia');
  const cycle = animCycle(anim);
  let r = Math.max(0, Math.floor(t));
  if (cycle !== Infinity) r %= cycle;
  let ox = 0;
  let oy = 0;
  for (let i = 0; i < anim.length; i++) {
    const f = anim[i];
    ox += f.mx;
    oy += f.my;
    if (f.dur === 255 || r < durOf(f.dur)) return { index: i, frame: f, ox, oy };
    r -= durOf(f.dur);
  }
  const last = anim.length - 1;
  return { index: last, frame: anim[last], ox, oy };
}
```

- [ ] **Step 5: Implementar** `web/src/render/anim/player-anim.ts`:

```ts
import type { Anim, RomAssets } from '../../rom/types';
import type { RomView } from '../../rom/view';
import type { PlayerPose } from '../rom/scene';

/** Tabela de 1º nível (por personagem) e índice no 2º nível; idx null = a entrada já é a animação. */
export interface AnimRef { tab: number; idx: number | null }

export const BORED_AFTER = 383;   // ticks parado até o tédio (§7.4)

export const TAB = {
  stand: 0xc276c5, lift: 0xc27515, carry: 0xc27665, throw: 0xc2755d, punch: 0xc2746d, pPunch: 0xc2749d,
  misc: 0xc26ce8, spin: 0xc26f71, dying: 0xc26e15, victory: 0xc26f05, launched: 0xc26f35, dance: 0xc26fc5,
} as const;

const DIR8: Readonly<Record<number, number>> = { 0: 0, 2: 1, 4: 4, 6: 5 };
const DIR4: Readonly<Record<number, number>> = { 0: 0, 2: 1, 4: 2, 6: 3 };

/** Animação da ação e o tempo a amostrar. `t` = tick − actT0. */
export function playerAnimRef(p: PlayerPose, t: number): { ref: AnimRef; t: number } {
  const d8 = DIR8[p.face] ?? 4;
  const d4 = DIR4[p.face] ?? 2;
  const at = (tab: number, idx: number | null) => ({ ref: { tab, idx }, t });
  switch (p.act) {
    case 'idle':
      return t >= BORED_AFTER ? { ref: { tab: TAB.spin, idx: 4 + (p.char & 7) }, t: t - BORED_AFTER } : at(TAB.stand, d8 + 8);
    case 'walk': return at(TAB.stand, d8);
    case 'lift': return at(TAB.lift, d8);
    case 'carryIdle': return at(TAB.carry, d8 + 8);
    case 'carryWalk': return at(TAB.carry, d8);
    case 'throw': return at(TAB.throw, d8);
    case 'punch': return at(TAB.punch, d8);
    case 'pPunch': return at(TAB.pPunch, d8);
    case 'detonate': return at(TAB.misc, 12);
    case 'shocked': return at(TAB.misc, 4);
    case 'stunned': return at(TAB.spin, 10);
    case 'dying': return at(TAB.dying, null);
    case 'victory': return at(TAB.victory, null);
    case 'launched': return at(TAB.launched, d4);   // D14 🟡
    case 'pushed': return at(TAB.misc, d4);         // D14 🟡
    case 'dance': return at(TAB.dance, d4);         // D14 🟡
    case 'bad': return at(TAB.stand, p.moving ? d8 : d8 + 8);
    default: return at(TAB.stand, d8 + 8);          // mounting, dismount: o plano 9 troca pelo gancho
  }
}

export function animAddr(rom: RomView, ref: AnimRef, char: number): number {
  const first = rom.p24(ref.tab + 3 * (char & 7));
  return ref.idx === null ? first : rom.p24(first + 3 * ref.idx);
}

export function resolveAnim(a: RomAssets, ref: AnimRef, char: number): Anim {
  return a.anim(animAddr(a.rom, ref, char));
}
```

- [ ] **Step 6: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/sample.test.ts tests/render-rom/player-anim.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/player-anim.test.ts && npx tsc --noEmit`
Expected: PASS; com a ROM, os 20 testes do bloco real passam.

- [ ] **Step 7: Commit**

```bash
git add web/src/render/anim/sample.ts web/src/render/anim/player-anim.ts web/tests/render-rom/sample.test.ts web/tests/render-rom/player-anim.test.ts
git commit -m "$(cat <<'MSG'
feat(render): amostragem de animação e ação × direção pelas tabelas da ROM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 4: Campo (BG2) — bombas, chamas, queimas, itens, pressão

**Files:**
- Create: `web/src/render/anim/grid-seq.ts`, `web/src/render/rom/field.ts`
- Test: `web/tests/render-rom/field.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: `ArenaAssets` (plano 5); `RoundState`, `CODE`, `GRID_W`, `GRID_H` (plano 6); `RomScene`, `RomClock`, `FlamePieceName`, `mapIndex`, `RomTables` (T2).
- Produces: `ScriptStep`, `BOMB_SHIFT`, `scriptWord`, `FLAME_PHASE`, `FLAME_BASE`, `flameWord`, `softBurnWord`, `itemBurnWord`; `WORD_PRESSURE`, `cellWord`, `fieldWords`.

Regras (spec §7.1; ANI §5–§8; ARN §2.6; D7–D10). Palavra do BG2 da casa (col, lin), índice `lin·32 + col`:

| Grade | Palavra |
|---|---|
| `0000`, `0001` | piso: `floor[cell] ≠ 0 ? floor[cell] : ArenaAssets.floor[i]` |
| `EC40`, `CC80` | `bg2Base[i]` |
| `EE80` | `082E` |
| `C900` | `scriptWord(bombScript(type), bombTick − born)` (tempo do script = idade + 2) |
| `1000` | `FLAME_BASE[peça] + $20·FLAME_PHASE[idade]`, idade = `tick − cellT0` limitada a 0..24 |
| `EDC0` soft | `0C20 + 2·min(5, ⌊idade/4⌋)` |
| `EDC0` item | `0F2E + $20·⌊idade/4⌋` até a idade 19; depois piso |
| `0940+id` (id < `$30`), `0980+id` | `itemWord(id)` (`$C1:5FE0`) |
| ovo `0970+t` | piso (o plano 9 desenha o ovo) |
| outros códigos especiais (`0040`, `0C00`, `1C00`, `0F41`…) | `bg2Base[i]` (a palavra do mapa da ROM, como no golden do plano 5); as camadas do plano 8 sobrescrevem |

Só as colunas 1..15 das linhas 0..12 são trocadas; o resto do mapa 32×32 fica com o `bg2Base` (D10).

- [ ] **Step 1: Teste** `web/tests/render-rom/field.test.ts`:

```ts
import { FLAME_PHASE, flameWord, itemBurnWord, scriptWord, softBurnWord } from '../../src/render/anim/grid-seq';
import { WORD_PRESSURE, fieldWords } from '../../src/render/rom/field';
import { romTables } from '../../src/render/rom/tables';
import type { FlamePieceName, RomClock, RomScene } from '../../src/render/rom/scene';
import { NORMAL_BOMB, REMOTE_BOMB, fakeAssets, fakeRound } from './fakes';

/** Corridas [valor, repetições] de f(0..n−1). */
function runs<T>(f: (t: number) => T, n: number): [T, number][] {
  const out: [T, number][] = [];
  for (let t = 0; t < n; t++) {
    const v = f(t);
    if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++;
    else out.push([v, 1]);
  }
  return out;
}

describe('sequências da grade', () => {
  it('bomba normal: 0B00/02/04/06 por 18, 12, 16, 16, 20, 12, 16 (1º quadro 2 ticks mais curto)', () => {
    expect(runs(a => scriptWord(NORMAL_BOMB, a), 110)).toEqual([
      [0x0b00, 18], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16], [0x0b00, 20], [0x0b02, 12], [0x0b04, 16]]);
  });
  it('bomba remota: 0B08…0E, 16 cada (1º 14)', () => {
    expect(runs(a => scriptWord(REMOTE_BOMB, a), 62)).toEqual([[0x0b08, 14], [0x0b0a, 16], [0x0b0c, 16], [0x0b0e, 16]]);
  });
  it('chama: A2 B2 C2 B2 C2 B2 C2 B2 C2 B2 C2 B2 A1 = 25 ticks', () => {
    expect(FLAME_PHASE).toHaveLength(25);
    expect(runs(a => flameWord('center', a), 25)).toEqual([
      [0x0f6c, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2],
      [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0f6c, 1]]);
  });
  it('peças da chama com flips; fases +$00/+$20/+$40', () => {
    const P: [FlamePieceName, number][] = [['center', 0x0f6c], ['armR', 0x0f6a], ['armL', 0x4f6a], ['tipR', 0x0f66], ['tipL', 0x4f66],
      ['armU', 0x0f68], ['armD', 0x8f68], ['tipU', 0x0f60], ['tipD', 0x8f60]];
    for (const [p, w] of P) expect([flameWord(p, 0), flameWord(p, 2), flameWord(p, 4)]).toEqual([w, w + 0x20, w + 0x40]);
  });
  it('soft queimando: 0C20…0C2A, 4 ticks cada', () => {
    expect(runs(softBurnWord, 24)).toEqual([0x0c20, 0x0c22, 0x0c24, 0x0c26, 0x0c28, 0x0c2a].map(w => [w, 4]));
  });
  it('item atingido: 0F2E…0FAE, 4 ticks cada, depois nada', () => {
    expect(runs(itemBurnWord, 24)).toEqual([[0x0f2e, 4], [0x0f4e, 4], [0x0f6e, 4], [0x0f8e, 4], [0x0fae, 4], [null, 4]]);
  });
});

describe('palavra do BG2 por casa', () => {
  const a = fakeAssets();
  const ar = a.arena(1);
  const tb = romTables(a);
  const at = (col: number, lin: number) => lin * 32 + col;
  const cell = (col: number, lin: number) => lin * 17 + col;
  const scene = (over: Partial<RomScene> = {}): RomScene =>
    ({ gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false, ...over });
  const clock = (tick: number, bombTick = tick): RomClock => ({ tick, bombTick, frame: 0 });
  const script = (t: number) => (t === 1 ? REMOTE_BOMB : NORMAL_BOMB);
  const words = (s = fakeRound(), sc = scene(), c = clock(0)) => fieldWords(s, ar, sc, tb, c, script);

  it('piso da ROM, ou floor[] do núcleo quando ≠ 0 (D9)', () => {
    const s = fakeRound();
    s.grid[cell(3, 1)] = 0;
    s.grid[cell(4, 1)] = 0;
    s.floor[cell(4, 1)] = 0x1c0a;
    const w = words(s);
    expect([w[at(3, 1)], w[at(4, 1)]]).toEqual([ar.floor[at(3, 1)], 0x1c0a]);
  });
  it('parede/pilar e soft = bg2Base; pressão = 082E; bloco caindo (0001) = piso', () => {
    const s = fakeRound();
    s.grid[cell(4, 1)] = 0xcc80;
    s.grid[cell(5, 1)] = 0xee80;
    s.grid[cell(6, 1)] = 0x0001;
    const w = words(s);
    expect([w[at(3, 2)], w[at(4, 1)], w[at(5, 1)], w[at(6, 1)]])
      .toEqual([ar.bg2Base[at(3, 2)], ar.bg2Base[at(4, 1)], WORD_PRESSURE, ar.floor[at(6, 1)]]);
  });
  it('bomba parada: script do tipo desde born; bombTick congela (D6)', () => {
    const s = fakeRound();
    s.grid[cell(2, 1)] = 0xc900;
    const sc = scene({ gridBombs: new Map([[cell(2, 1), { type: 1, born: 100 }]]) });
    expect(words(s, sc, clock(100))[at(2, 1)]).toBe(0x0b08);
    expect(words(s, sc, clock(114))[at(2, 1)]).toBe(0x0b0a);
    expect(words(s, sc, clock(200, 114))[at(2, 1)]).toBe(0x0b0a);
  });
  it('chama pela peça e pela idade (cellT0)', () => {
    const s = fakeRound();
    s.grid[cell(7, 3)] = 0x1000;
    s.cellT0[cell(7, 3)] = 50;
    const sc = scene({ flame: () => 'tipD' });
    expect(words(s, sc, clock(52))[at(7, 3)]).toBe(0x8f80);
    expect(words(s, sc, clock(74))[at(7, 3)]).toBe(0x8f60);
  });
  it('queima: soft pelos tiles da fase; item some depois de 20 ticks (D8)', () => {
    const s = fakeRound();
    for (const c of [cell(4, 1), cell(5, 1)]) { s.grid[c] = 0xedc0; s.cellT0[c] = 10; }
    const sc = scene({ burn: c => (c === cell(5, 1) ? 'item' : 'soft') });
    expect(words(s, sc, clock(24))[at(5, 1)]).toBe(0x0f8e);
    const w = words(s, sc, clock(30));
    expect([w[at(4, 1)], w[at(5, 1)]]).toEqual([0x0c2a, ar.floor[at(5, 1)]]);
  });
  it('itens e caveiras pela tabela $C1:5FE0; ovo fica com o plano 9 (piso)', () => {
    const s = fakeRound();
    s.grid[cell(3, 1)] = 0x0941;
    s.grid[cell(4, 1)] = 0x09a1;
    s.grid[cell(5, 1)] = 0x0970;
    const w = words(s);
    expect([w[at(3, 1)], w[at(4, 1)], w[at(5, 1)]]).toEqual([0x1280, 0x128a, ar.floor[at(5, 1)]]);
  });
  it('códigos das arenas especiais = palavra do mapa da ROM (o plano 8 sobrescreve)', () => {
    const s = fakeRound();
    s.grid[cell(3, 3)] = 0x0040;
    s.grid[cell(7, 3)] = 0x0c00;
    s.grid[cell(5, 5)] = 0x0f41;
    const w = words(s);
    expect([w[at(3, 3)], w[at(7, 3)], w[at(5, 5)]]).toEqual([ar.bg2Base[at(3, 3)], ar.bg2Base[at(7, 3)], ar.bg2Base[at(5, 5)]]);
  });
  it('moldura (col 0 e 16) e fora de 17×13 ficam com o bg2Base (D10)', () => {
    const s = fakeRound();
    s.grid[cell(0, 5)] = 0;
    s.grid[cell(16, 5)] = 0;
    const w = words(s);
    for (const i of [at(0, 5), at(16, 5), at(20, 3), at(3, 20)]) expect(w[i]).toBe(ar.bg2Base[i]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/field.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar** `web/src/render/anim/grid-seq.ts`:

```ts
import type { FlamePieceName } from '../rom/scene';

export interface ScriptStep { word: number; dur: number }

/** O 1º quadro da bomba dura 2 ticks a menos (medido 18 de 20, ANI §5.1). */
export const BOMB_SHIFT = 2;

/** Palavra do script de bomba na idade `age` (ticks desde `born`); o script dá a volta. */
export function scriptWord(script: readonly ScriptStep[], age: number): number {
  if (script.length === 0) throw new Error('script de bomba vazio');
  const total = script.reduce((n, s) => n + s.dur, 0);
  let t = Math.max(0, age) + BOMB_SHIFT;
  if (total > 0) t %= total;
  for (const s of script) {
    if (t < s.dur) return s.word;
    t -= s.dur;
  }
  return script[script.length - 1].word;
}

/** Fase por idade 0..24: A2 B2 C2 B2 C2 B2 C2 B2 C2 B2 C2 B2 A1 (0 = A, 1 = B, 2 = C). */
export const FLAME_PHASE: readonly number[] = [0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 0];

/** Palavra da fase A de cada peça (pal. 3; ANI §6). */
export const FLAME_BASE: Readonly<Record<FlamePieceName, number>> = {
  center: 0x0f6c, armR: 0x0f6a, armL: 0x4f6a, armU: 0x0f68, armD: 0x8f68,
  tipR: 0x0f66, tipL: 0x4f66, tipU: 0x0f60, tipD: 0x8f60,
};

export function flameWord(piece: FlamePieceName, age: number): number {
  const a = Math.min(24, Math.max(0, age));
  return FLAME_BASE[piece] + 0x20 * FLAME_PHASE[a];
}

export function softBurnWord(age: number): number {
  return 0x0c20 + 2 * Math.min(5, Math.floor(Math.max(0, age) / 4));
}

/** null = já acabou (piso). */
export function itemBurnWord(age: number): number | null {
  const k = Math.floor(Math.max(0, age) / 4);
  return k < 5 ? 0x0f2e + 0x20 * k : null;
}
```

- [ ] **Step 4: Implementar** `web/src/render/rom/field.ts`:

```ts
import { CODE, GRID_H, GRID_W, type RoundState } from '../../core';
import type { ArenaAssets } from '../../rom/types';
import { flameWord, itemBurnWord, scriptWord, softBurnWord, type ScriptStep } from '../anim/grid-seq';
import type { RomTables } from './tables';
import { mapIndex, type RomClock, type RomScene } from './scene';

export const WORD_PRESSURE = 0x082e;

export function cellWord(s: RoundState, cell: number, i: number, ar: ArenaAssets, scene: RomScene, tb: RomTables,
  clock: RomClock, script: (type: number) => readonly ScriptStep[]): number {
  const code = s.grid[cell];
  const floor = s.floor[cell] || ar.floor[i];
  switch (code) {
    case CODE.FLOOR:
    case CODE.FALLING:
      return floor;
    case CODE.HARD:
    case CODE.SOFT:
      return ar.bg2Base[i];
    case CODE.PRESSURE:
      return WORD_PRESSURE;
    case CODE.BOMB: {
      const b = scene.gridBombs.get(cell);
      return b ? scriptWord(script(b.type), clock.bombTick - b.born) : scriptWord(script(0), 0);
    }
    case CODE.FLAME:
      return flameWord(scene.flame(cell), clock.tick - s.cellT0[cell]);
    case CODE.BURNING: {
      const age = clock.tick - s.cellT0[cell];
      return scene.burn(cell) === 'soft' ? softBurnWord(age) : itemBurnWord(age) ?? floor;
    }
  }
  if ((code & 0xffc0) === CODE.ITEM) {
    const id = code - CODE.ITEM;
    return id < 0x30 ? tb.itemWord(id) : floor;   // 0970+t = ovo: plano 9
  }
  if ((code & 0xffc0) === CODE.SKULL) return tb.itemWord(code - CODE.SKULL);
  return ar.bg2Base[i];   // códigos especiais das arenas (D21): o plano 8 sobrescreve
}

/** Mapa 32×32 do BG2: bg2Base com as casas 1..15 × 0..12 vindas da grade. */
export function fieldWords(s: RoundState, ar: ArenaAssets, scene: RomScene, tb: RomTables, clock: RomClock,
  script: (type: number) => readonly ScriptStep[]): Uint16Array {
  const out = Uint16Array.from(ar.bg2Base.subarray(0, 1024));
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 1; col < GRID_W - 1; col++) {
    const i = mapIndex(col, lin);
    out[i] = cellWord(s, lin * GRID_W + col, i, ar, scene, tb, clock, script);
  }
  return out;
}
```

- [ ] **Step 5: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/field.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/render/anim/grid-seq.ts web/src/render/rom/field.ts web/tests/render-rom/field.test.ts
git commit -m "$(cat <<'MSG'
feat(render): campo da ROM — bomba, chama, queimas, itens e pressão no BG2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 5: Cenário — tiles e paletas animados, pisca dos itens, CGRAM do quadro

**Files:**
- Create: `web/src/render/anim/timeline.ts`, `web/src/render/rom/scenery.ts`
- Test: `web/tests/render-rom/scenery.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: `ArenaAssets`, `Tiles`, `TileAnimCmd`, `PalAnim` (plano 5); `TileOverride`, `OBJ_ITEM_PAL` (T2).
- Produces: `TileCmd`, `TileTimeline`, `tileTimeline`, `tileStateAt`, `tileStateKey`, `PalCycle`, `palFrameAt`, `itemBlinkColor`; `normTileCmds`, `normPalAnims`, `copyTile16`, `sceneryTiles`, `sceneryCgram`.

Regras (ARN §2.2, §3.1, §3.2; ANI §7; D5, D12):
- Script `rec+$12`: DMA de um 16×16 (tiles `n, n+1, n+16, n+17`) do buffer original de tiles da arena para o destino; destino = palavra de VRAM `>> 4`, origem = `((src & $FFFF) − $8000) >> 5`. Tempo: DMA 1 tick, espera W = 1+W ticks, loop 0. No tick *n* valem os comandos dos ticks 0..n−1.
- Paleta animada: quadro `⌊tick/período⌋ mod N`, 16 cores a partir de `first`.
- Pisca dos itens: CGRAM 79 = `$7D80` se `frame & 4`, senão `$00BF`.
- CGRAM do quadro: 0..127 = `bgCgram` (+ paletas animadas + pisca); 128..255 = `objCgram`; OBJ pal 2 (160..175) = cores 64..79 (paleta BG 4, itens voando).

- [ ] **Step 1: Teste** `web/tests/render-rom/scenery.test.ts`:

```ts
import { itemBlinkColor, palFrameAt, tileStateAt, tileTimeline, type TileCmd } from '../../src/render/anim/timeline';
import { normTileCmds, sceneryCgram, sceneryTiles } from '../../src/render/rom/scenery';
import type { PalAnim, TileAnimCmd } from '../../src/rom/types';
import { fakeArena } from './fakes';

const dma = (dst: number, src: number): TileCmd => ({ op: 'dma', dst, src });
const wait = (n: number): TileCmd => ({ op: 'wait', n });
const ARENA7: TileCmd[] = [dma(2, 0xe0), wait(10), dma(2, 0xe2), wait(10), dma(2, 0xe4), wait(10), dma(2, 0xe6), wait(10), { op: 'loop' }];

describe('linha do tempo de tiles (D5)', () => {
  it('arena 7: soft block troca a cada 12 ticks, ciclo de 48', () => {
    const tl = tileTimeline(ARENA7);
    expect(tl.events.map(e => e.t)).toEqual([0, 12, 24, 36]);
    expect(tl.period).toBe(48);
    const src = (t: number) => tileStateAt(tl, t).get(2) ?? null;
    expect([0, 1, 12, 13, 25, 37, 48, 49, 61].map(src)).toEqual([null, 0xe0, 0xe0, 0xe2, 0xe4, 0xe6, 0xe6, 0xe0, 0xe2]);
  });
  it('vários DMAs seguidos gastam 1 tick cada; o loop não gasta', () => {
    const tl = tileTimeline([dma(0xe0, 0x100), dma(0x44, 0x180), wait(10), dma(0xe0, 0x108), dma(0x44, 0x1a0), wait(10), { op: 'loop' }]);
    expect(tl.events.map(e => e.t)).toEqual([0, 1, 13, 14]);
    expect(tl.period).toBe(26);
    expect([...tileStateAt(tl, 14)]).toEqual([[0xe0, 0x108], [0x44, 0x180]]);
    expect([...tileStateAt(tl, 27)]).toEqual([[0xe0, 0x100], [0x44, 0x1a0]]);
  });
  it('fim ($90): o último estado fica', () => {
    const tl = tileTimeline([dma(5, 9), { op: 'end' }, dma(5, 10)]);
    expect(tl.period).toBeNull();
    expect([...tileStateAt(tl, 1000)]).toEqual([[5, 9]]);
  });
  it('conversão do formato do plano 5: VRAM >> 4 e $7F:xxxx → tile', () => {
    const cmds = [{ kind: 'dma', vram: 0x20, src: 0x7f9c00 }, { kind: 'wait', frames: 10 }, { kind: 'dma', vram: 0xe00, src: 0x7fa000 },
      { kind: 'loop' }] as unknown as TileAnimCmd[];
    expect(normTileCmds(cmds)).toEqual([dma(2, 0xe0), wait(10), dma(0xe0, 0x100), { op: 'loop' }]);
  });
});

describe('paletas e pisca', () => {
  it('quadro da paleta = ⌊tick/período⌋ mod N', () => {
    const f = [new Uint16Array(16).fill(1), new Uint16Array(16).fill(2), new Uint16Array(16).fill(3)];
    const p = { index: 80, frames: f, period: 14 };
    expect([0, 13, 14, 28, 42].map(t => palFrameAt(p, t)[0])).toEqual([1, 1, 2, 3, 1]);
  });
  it('itens: cor 79 = $00BF / $7D80, 4 frames cada', () => {
    expect([0, 3, 4, 7, 8].map(itemBlinkColor)).toEqual([0x00bf, 0x00bf, 0x7d80, 0x7d80, 0x00bf]);
  });
});

describe('tiles e CGRAM do quadro', () => {
  const anim7 = [{ kind: 'dma', vram: 0x20, src: 0x7f9c00 }, { kind: 'wait', frames: 10 }, { kind: 'dma', vram: 0x20, src: 0x7f9c40 },
    { kind: 'wait', frames: 10 }, { kind: 'loop' }] as unknown as TileAnimCmd[];
  const tileAt = (px: Uint8Array, t: number) => px[t * 64];

  it('aplica o quadro de animação sem mexer no buffer original', () => {
    const ar = fakeArena(7, { tileAnim: anim7 });
    expect(tileAt(sceneryTiles(ar, 0, [], '').px, 2)).toBe(2);
    const t1 = sceneryTiles(ar, 1, [], '').px;
    expect([2, 3, 18, 19].map(t => tileAt(t1, t))).toEqual([0xe0, 0xe1, 0xf0, 0xf1]);
    expect(tileAt(sceneryTiles(ar, 13, [], '').px, 2)).toBe(0xe2);
    expect(tileAt(ar.bgTiles.px, 2)).toBe(2);
  });
  it('cache: mesmo estado → mesmo objeto; trocas extras (rostos) e cópias fixas (golden)', () => {
    const ar = fakeArena(7, { tileAnim: anim7 });
    expect(sceneryTiles(ar, 1, [], '')).toBe(sceneryTiles(ar, 5, [], ''));
    const extra = [{ tile: 0x201, px: new Uint8Array(64).fill(9) }];
    expect(tileAt(sceneryTiles(ar, 1, extra, 'k').px, 0x201)).toBe(9);
    expect(tileAt(sceneryTiles(ar, 1, [], '', [[2, 0xe4]]).px, 2)).toBe(0xe4);
  });
  it('CGRAM: BG + animação de paleta + pisca; OBJ; OBJ pal 2 = BG pal 4', () => {
    const palAnim = [{ first: 80, frames: [new Uint16Array(16).fill(0x1111), new Uint16Array(16).fill(0x2222)], period: 14 }] as unknown as PalAnim[];
    const ar = fakeArena(9, { palAnim });
    const cg = sceneryCgram(ar, 14, 4, true);
    expect([cg[10], cg[80], cg[95], cg[96], cg[79], cg[128], cg[255]]).toEqual([10, 0x2222, 0x2222, 96, 0x7d80, 0x4000, 0x407f]);
    expect(Array.from(cg.slice(160, 176))).toEqual(Array.from(cg.slice(64, 80)));
    expect(sceneryCgram(ar, 0, 4, false)[79]).toBe(79);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/scenery.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar** `web/src/render/anim/timeline.ts`:

```ts
/** Comando normalizado do script de tiles (dst/src = tile 8×8 do canto superior esquerdo do 16×16). */
export type TileCmd = { op: 'dma'; dst: number; src: number } | { op: 'wait'; n: number } | { op: 'loop' } | { op: 'end' };
export interface TileTimeline { events: { t: number; dst: number; src: number }[]; period: number | null }

export function tileTimeline(cmds: readonly TileCmd[]): TileTimeline {
  const events: TileTimeline['events'] = [];
  let c = 0;
  for (const k of cmds) {
    if (k.op === 'dma') { events.push({ t: c, dst: k.dst, src: k.src }); c += 1; }
    else if (k.op === 'wait') c += 1 + k.n;
    else if (k.op === 'loop') return { events, period: c };
    else return { events, period: null };
  }
  return { events, period: null };
}

function lastFrame(tl: TileTimeline, tick: number): { k: number; looped: boolean } | null {
  if (tick <= 0) return null;
  const last = tick - 1;
  if (tl.period !== null && tl.period > 0 && last >= tl.period) return { k: last % tl.period, looped: true };
  return { k: last, looped: false };
}

/** dst → src depois dos comandos dos ticks 0..tick−1. */
export function tileStateAt(tl: TileTimeline, tick: number): Map<number, number> {
  const m = new Map<number, number>();
  const lf = lastFrame(tl, tick);
  if (!lf) return m;
  if (lf.looped) for (const e of tl.events) m.set(e.dst, e.src);
  for (const e of tl.events) if (e.t <= lf.k) m.set(e.dst, e.src);
  return m;
}

/** Chave de cache: muda só quando o estado pode mudar. */
export function tileStateKey(tl: TileTimeline, tick: number): string {
  const lf = lastFrame(tl, tick);
  if (!lf) return 'F0';
  return (lf.looped ? 'L' : 'F') + tl.events.filter(e => e.t <= lf.k).length;
}

export interface PalCycle { index: number; frames: Uint16Array[]; period: number }

export function palFrameAt(p: PalCycle, tick: number): Uint16Array {
  return p.frames[Math.floor(Math.max(0, tick) / p.period) % p.frames.length];
}

/** Cor 15 da paleta BG 4 (CGRAM 79), `$C1:0965`. */
export function itemBlinkColor(frame: number): number {
  return frame & 4 ? 0x7d80 : 0x00bf;
}
```

- [ ] **Step 4: Implementar** `web/src/render/rom/scenery.ts`:

```ts
import type { ArenaAssets, PalAnim, TileAnimCmd, Tiles } from '../../rom/types';
import { itemBlinkColor, palFrameAt, tileStateAt, tileStateKey, tileTimeline, type PalCycle, type TileCmd, type TileTimeline } from '../anim/timeline';
import { OBJ_ITEM_PAL, type TileOverride } from './scene';

/** Formato do plano 5 (conferido na T1) → comandos normalizados. */
export function normTileCmds(cmds: readonly TileAnimCmd[]): TileCmd[] {
  return cmds.map((c): TileCmd => {
    switch (c.kind) {
      case 'dma': return { op: 'dma', dst: c.vram >> 4, src: ((c.src & 0xffff) - 0x8000) >> 5 };
      case 'wait': return { op: 'wait', n: c.frames };
      case 'loop': return { op: 'loop' };
      default: return { op: 'end' };
    }
  });
}

export function normPalAnims(p: readonly PalAnim[]): PalCycle[] {
  return p.map(x => ({ index: x.first, frames: x.frames, period: x.period }));
}

/** Copia o 16×16 `from` para `to` (tiles +0, +1, +16, +17), lendo do buffer original. */
export function copyTile16(dst: Uint8Array, base: Uint8Array, to: number, from: number): void {
  for (const k of [0, 1, 16, 17]) dst.set(base.subarray((from + k) * 64, (from + k + 1) * 64), (to + k) * 64);
}

const timelines = new WeakMap<ArenaAssets, TileTimeline | null>();
const tileCache = new WeakMap<ArenaAssets, { key: string; tiles: Tiles }>();

function timelineOf(ar: ArenaAssets): TileTimeline | null {
  if (!timelines.has(ar)) timelines.set(ar, ar.tileAnim ? tileTimeline(normTileCmds(ar.tileAnim)) : null);
  return timelines.get(ar) ?? null;
}

/**
 * Tiles de BG no tick: animação de tiles (ou `copies` fixas, só para o golden) + trocas 8×8 extras (rostos do HUD).
 * `extraKey` identifica `extra` no cache (ex.: personagens dos 5 slots).
 */
export function sceneryTiles(ar: ArenaAssets, tick: number, extra: readonly TileOverride[], extraKey: string,
  copies?: readonly (readonly [number, number])[]): Tiles {
  const tl = timelineOf(ar);
  const animKey = copies ? 'C' + copies.map(c => c.join(':')).join(';') : tl ? tileStateKey(tl, tick) : '-';
  const key = animKey + '|' + extraKey;
  const hit = tileCache.get(ar);
  if (hit && hit.key === key) return hit.tiles;
  const base = ar.bgTiles.px;
  const px = Uint8Array.from(base);
  const pairs = copies ?? (tl ? [...tileStateAt(tl, tick)] : []);
  for (const [to, from] of pairs) copyTile16(px, base, to, from);
  for (const o of extra) px.set(o.px.subarray(0, 64), o.tile * 64);
  const tiles: Tiles = { bpp: ar.bgTiles.bpp, count: ar.bgTiles.count, px };
  tileCache.set(ar, { key, tiles });
  return tiles;
}

export function sceneryCgram(ar: ArenaAssets, tick: number, frame: number, blink: boolean): Uint16Array {
  const cg = new Uint16Array(256);
  cg.set(ar.bgCgram.subarray(0, 128), 0);
  for (const p of normPalAnims(ar.palAnim)) cg.set(palFrameAt(p, tick).subarray(0, 16), p.index);
  if (blink) cg[79] = itemBlinkColor(frame);
  cg.set(ar.objCgram.subarray(0, 128), 128);
  cg.set(cg.slice(64, 80), 128 + 16 * OBJ_ITEM_PAL);
  return cg;
}
```

- [ ] **Step 5: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/scenery.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/render/anim/timeline.ts web/src/render/rom/scenery.ts web/tests/render-rom/scenery.test.ts
git commit -m "$(cat <<'MSG'
feat(render): animações de cenário da ROM — tiles, paletas e pisca dos itens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 6: HUD — relógio, rostos e coroas

**Files:**
- Create: `web/src/render/rom/hud.ts`
- Test: `web/tests/render-rom/hud.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: `CharacterAssets` (plano 5); `TileOverride` (T2).
- Produces: `digitTile(d)`, `hudWords(base, sec, present, crowns, crownWord)`, `faceTileIds(slot)`, `headTiles(ch, slot)`, `headOverrides(heads)`.

Regras (spec §7.3; ARN §4; D17). HUD = 3 linhas × 32 palavras (mapa `$D6:8EEC` + `$2200`); coluna *c* fica em x = 8(c−1).
- Troca de tile numa palavra: `(w & $FC00) | ($200 + tile)` (mantém paleta 1 e prioridade).
- Relógio: minutos na coluna 4, `:` (`3A/4A/5A`) na 5, segundos nas 6 e 7. Dígito *d*: `$2F + d` (1..9), `$39` para 0; linha *r* soma `$10·r`. Minutos ≥ 10 (∞ = 30:01): dezena na coluna 3.
- Rosto do slot *k* (presente): colunas `10+4k` e `11+4k`, tiles `$01+2k` e `$02+2k` (+`$10·r`), ou seja, tiles de BG `$201+2k`, `$202+2k`, `$211+2k`, `$212+2k`, `$221+2k`, `$222+2k`. Os 6 tiles vêm de `CharacterAssets.hudHead(slot)` (plano 5, D3: o rosto depende do personagem **e** do slot).
- Coroa do slot *k* (presente): linha 1, coluna `12+4k`, palavra `crownWord(n)` (`$C4:5D11`).
- Slot ausente: palavras-base (fundo).

- [ ] **Step 1: Teste** `web/tests/render-rom/hud.test.ts`:

```ts
import { digitTile, faceTileIds, headOverrides, headTiles, hudWords } from '../../src/render/rom/hud';
import { fakeCharacter } from './fakes';
import { ASSETS } from './rom-fixture';

const base = () => {
  const w = new Uint16Array(96).fill(0x260b);
  for (let r = 0; r < 3; r++) w[r * 32 + 5] = 0x263a + 0x10 * r;
  return w;
};
const crownWord = (n: number) => 0x2640 + n;
const NONE = [false, false, false, false, false];
const ZERO = [0, 0, 0, 0, 0];
const cols = (w: Uint16Array, r: number, cs: number[]) => cs.map(c => w[r * 32 + c]);

describe('HUD', () => {
  it('dígito: $2F + d, e $39 para o 0', () => {
    expect([0, 1, 5, 9].map(digitTile)).toEqual([0x39, 0x30, 0x34, 0x38]);
  });
  it('relógio 3:01 nas três linhas', () => {
    const w = hudWords(base(), 181, NONE, ZERO, crownWord);
    expect(cols(w, 0, [4, 5, 6, 7])).toEqual([0x2632, 0x263a, 0x2639, 0x2630]);
    expect(cols(w, 1, [4, 5, 6, 7])).toEqual([0x2642, 0x264a, 0x2649, 0x2640]);
    expect(cols(w, 2, [4, 5, 6, 7])).toEqual([0x2652, 0x265a, 0x2659, 0x2650]);
  });
  it('1:00, 0:59 e 0:00', () => {
    expect(cols(hudWords(base(), 60, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2630, 0x2639, 0x2639]);
    expect(cols(hudWords(base(), 59, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2639, 0x2634, 0x2638]);
    expect(cols(hudWords(base(), 0, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2639, 0x2639, 0x2639]);
  });
  it('∞ = 30:01: dezena dos minutos na coluna 3 (D17)', () => {
    const w = hudWords(base(), 1801, NONE, ZERO, crownWord);
    expect(cols(w, 0, [3, 4, 6, 7])).toEqual([0x2632, 0x2639, 0x2639, 0x2630]);
    expect(hudWords(base(), 181, NONE, ZERO, crownWord)[3]).toBe(0x260b);
  });
  it('rostos e coroas só dos presentes; ausente fica com o fundo', () => {
    const w = hudWords(base(), 180, [true, false, true, true, true], [0, 4, 1, 5, 9], crownWord);
    expect(cols(w, 0, [10, 11, 14, 15, 18, 19])).toEqual([0x2601, 0x2602, 0x260b, 0x260b, 0x2605, 0x2606]);
    expect(cols(w, 1, [10, 11])).toEqual([0x2611, 0x2612]);
    expect(cols(w, 2, [26, 27])).toEqual([0x2629, 0x262a]);
    expect(cols(w, 1, [12, 16, 20, 24, 28])).toEqual([0x2640, 0x260b, 0x2641, 0x2645, 0x2649]);
  });
  it('não altera a base', () => {
    const b = base();
    hudWords(b, 181, [true, true, true, true, true], ZERO, crownWord);
    expect(b[4]).toBe(0x260b);
  });
  it('tiles dos rostos por slot e trocas 8×8', () => {
    expect(faceTileIds(0)).toEqual([0x201, 0x202, 0x211, 0x212, 0x221, 0x222]);
    expect(faceTileIds(4)).toEqual([0x209, 0x20a, 0x219, 0x21a, 0x229, 0x22a]);
    const h = headTiles(fakeCharacter(2), 0);
    expect(h.map(t => t[0])).toEqual([0x50, 0x51, 0x52, 0x53, 0x54, 0x55]);
    const o = headOverrides([h, null, null, null, h]);
    expect(o.map(x => x.tile)).toEqual([...faceTileIds(0), ...faceTileIds(4)]);
    expect(o[0].px).toBe(h[0]);
  });
});

describe.skipIf(!ASSETS)('HUD da ROM', () => {
  it('mapa-base: moldura, ícone, ":" e fundo $0B; cabeças com 6 tiles', () => {
    const hud = ASSETS!.arena(1).hudMap;
    expect(Array.from(hud.slice(0, 8))).toEqual([0x6600, 0x2600, 0x260c, 0x260d, 0x260b, 0x263a, 0x260b, 0x260b]);
    expect(hud[32 + 5]).toBe(0x264a);
    for (let c = 0; c < 6; c++) for (let slot = 0; slot < 5; slot++) expect(headTiles(ASSETS!.character(c), slot).every(t => t.length === 64)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/hud.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar** `web/src/render/rom/hud.ts`:

```ts
import type { CharacterAssets } from '../../rom/types';
import type { TileOverride } from './scene';

export const HUD_WORDS = 96;

export function digitTile(d: number): number { return d === 0 ? 0x39 : 0x2f + d; }

function put(w: Uint16Array, row: number, col: number, tile: number): void {
  const i = row * 32 + col;
  w[i] = (w[i] & 0xfc00) | (0x200 + tile);
}

/** Palavras das 3 linhas do HUD (mapa do BG1, linhas 28–30). `base` = ArenaAssets.hudMap. */
export function hudWords(base: Uint16Array, sec: number, present: readonly boolean[], crowns: readonly number[],
  crownWord: (n: number) => number): Uint16Array {
  const w = Uint16Array.from(base.subarray(0, HUD_WORDS));
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const ss = t % 60;
  for (let r = 0; r < 3; r++) {
    const R = 0x10 * r;
    if (m >= 10) put(w, r, 3, digitTile(Math.floor(m / 10) % 10) + R);
    put(w, r, 4, digitTile(m % 10) + R);
    put(w, r, 5, 0x3a + R);
    put(w, r, 6, digitTile(Math.floor(ss / 10)) + R);
    put(w, r, 7, digitTile(ss % 10) + R);
    for (let k = 0; k < 5; k++) {
      if (!present[k]) continue;
      put(w, r, 10 + 4 * k, 0x01 + 2 * k + R);
      put(w, r, 11 + 4 * k, 0x02 + 2 * k + R);
    }
  }
  for (let k = 0; k < 5; k++) if (present[k]) w[32 + 12 + 4 * k] = crownWord(crowns[k] ?? 0);
  return w;
}

/** Tiles de BG do rosto do slot, na ordem TL, TR, ML, MR, BL, BR. */
export function faceTileIds(slot: number): number[] {
  const b = 0x201 + 2 * slot;
  return [b, b + 1, b + 16, b + 17, b + 32, b + 33];
}

/** Os 6 tiles 8×8 do rosto do personagem no slot (TL, TR, ML, MR, BL, BR; plano 5 D3). */
export function headTiles(ch: CharacterAssets, slot: number): Uint8Array[] {
  const px = ch.hudHead(slot).px;
  return [0, 1, 2, 3, 4, 5].map(i => px.subarray(i * 64, i * 64 + 64));
}

export function headOverrides(heads: readonly (Uint8Array[] | null)[]): TileOverride[] {
  const out: TileOverride[] = [];
  heads.forEach((h, slot) => {
    if (h) faceTileIds(slot).forEach((tile, i) => out.push({ tile, px: h[i] }));
  });
  return out;
}
```

- [ ] **Step 4: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/hud.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/hud.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/render/rom/hud.ts web/tests/render-rom/hud.test.ts
git commit -m "$(cat <<'MSG'
feat(render): HUD da ROM — relógio, rostos dos personagens e coroas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 7: Adaptador do núcleo → `RomScene`

**Files:**
- Create: `web/src/render/rom/adapt.ts`
- Test: `web/tests/render-rom/adapt.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: plano 6 (`RoundState`, `Bomb`, `Flyer`, `FLAME_PIECE`, `BURN`, `px`); T2 (`RomScene`, `RomMemo`, `SceneObj`, `PressureDrop`, `FlamePieceName`).
- Produces: `FLAME_NAMES`, `LIFT_Z`, `readScene(s, tick, memo)`.

Regras (plano 6 `types.ts`; spec §7.2; D11, D13):
- `Bomb.state === 'idle'` → bomba na grade `{type, born}` na casa `b.cell`. `'kicked'` → OBJ na posição da bomba, altura 0. `'held'` → OBJ sobre quem carrega (jogador com `carry === b.id`; senão o Bad Bomber do slot `b.owner`), altura `LIFT_Z[min(3, tick − actT0)]` durante `lift`, senão 16. `'air'` → desenhada pelo `Flyer`.
- `Flyer` → OBJ em `(px(x), px(y))` com altura `max(0, −z)` (no núcleo, z ≤ 0 = acima do chão); item = `ref` quando `kind === 'item'`.
- Pressão: `s.pressure.falling` (`{cell, t0, land}`); a memória mantém por mais 2 ticks depois do pouso os que o núcleo já tirou da lista.
- `cellAux`: peça da chama por `FLAME_PIECE` (0 centro, 1..4 braço ↑→↓←, 5..8 ponta ↑→↓←); queima por `BURN`.
- Times: `rules.mode === 'team'`.

- [ ] **Step 1: Teste** `web/tests/render-rom/adapt.test.ts`:

```ts
import { readScene } from '../../src/render/rom/adapt';
import { newMemo } from '../../src/render/rom/scene';
import { FLAME_PIECE, BURN, type Bomb, type Flyer } from '../../src/core';
import { fakeRound } from './fakes';

const bomb = (over: Partial<Bomb>): Bomb => ({
  id: 1, owner: 0, bad: false, cell: 19, x: 31 * 256, y: 47 * 256, fuse: 126, fire: 0, type: 0, state: 'idle',
  dir: 0, step: 0, kickedBy: -1, chainAt: 0, born: 100, ...over });
const flyer = (over: Partial<Flyer>): Flyer => ({
  id: 9, kind: 'item', ref: 0x03, x: 80 * 256, y: 96 * 256, z: -10, dir: 1, flight: 'item', script: 0, i: 0, born: 0, ...over });

describe('readScene', () => {
  it('bomba parada vai para a grade com tipo e born', () => {
    const s = fakeRound();
    s.bombs.push(bomb({ cell: 19, type: 1, born: 77 }));
    const sc = readScene(s, 100, newMemo());
    expect(sc.gridBombs.get(19)).toEqual({ type: 1, born: 77 });
    expect(sc.objs).toEqual([]);
  });
  it('bomba chutada = OBJ no chão; no ar = só o voador', () => {
    const s = fakeRound();
    s.bombs.push(bomb({ id: 1, state: 'kicked', x: 100 * 256 + 128, y: 80 * 256 }), bomb({ id: 2, state: 'air' }));
    s.flyers.push(flyer({ kind: 'bomb', ref: 2, x: 60 * 256, y: 70 * 256, z: -9 }));
    expect(readScene(s, 0, newMemo()).objs).toEqual([
      { kind: 'bomb', item: 0, x: 100, y: 80, z: 0 },
      { kind: 'bomb', item: 0, x: 60, y: 70, z: 9 }]);
  });
  it('bomba na mão: sobe 6, 10, 14, 16 no levantamento e fica a 16 (D13)', () => {
    const s = fakeRound();
    const p = s.players[0];
    p.carry = 5; p.act = 'lift'; p.actT0 = 200; p.x = 64 * 256; p.y = 96 * 256;
    s.bombs.push(bomb({ id: 5, state: 'held' }));
    expect([200, 201, 202, 203, 204].map(t => readScene(s, t, newMemo()).objs[0].z)).toEqual([6, 10, 14, 16, 16]);
    p.act = 'carryWalk';
    expect(readScene(s, 300, newMemo()).objs[0]).toEqual({ kind: 'bomb', item: 0, x: 64, y: 96, z: 16 });
  });
  it('bomba na mão do Bad Bomber: na posição dele', () => {
    const s = fakeRound();
    s.bad.push({ slot: 3, x: 15, y: 120, phase: 'patrol', face: 2, live: -1, readyAt: 0 });
    s.bombs.push(bomb({ id: 8, owner: 3, bad: true, state: 'held' }));
    expect(readScene(s, 0, newMemo()).objs[0]).toEqual({ kind: 'bomb', item: 0, x: 15, y: 120, z: 16 });
  });
  it('item voando: id em ref, altura = −z', () => {
    const s = fakeRound();
    s.flyers.push(flyer({ ref: 0x21, z: -12 }));
    expect(readScene(s, 0, newMemo()).objs).toEqual([{ kind: 'item', item: 0x21, x: 80, y: 96, z: 12 }]);
  });
  it('peças da chama e tipo de queima pelo cellAux', () => {
    const s = fakeRound();
    const names = ['center', 'armU', 'armR', 'armD', 'armL', 'tipU', 'tipR', 'tipD', 'tipL'];
    Object.values(FLAME_PIECE).forEach((v, k) => { s.cellAux[20 + k] = v; });
    const sc = readScene(s, 0, newMemo());
    expect(Object.values(FLAME_PIECE).map((_, k) => sc.flame(20 + k))).toEqual(names);
    s.cellAux[40] = BURN.ITEM; s.cellAux[41] = BURN.SOFT;
    expect([sc.burn(40), sc.burn(41)]).toEqual(['item', 'soft']);
  });
  it('pressão: Falling do núcleo + cauda de 2 ticks depois do pouso (D11)', () => {
    const s = fakeRound();
    const m = newMemo();
    s.pressure.falling.push({ cell: 19, t0: 100, land: 138 });
    expect(readScene(s, 120, m).drops).toEqual([{ cell: 19, t0: 100, land: 138 }]);
    s.pressure.falling.length = 0;
    expect(readScene(s, 138, m).drops).toEqual([{ cell: 19, t0: 100, land: 138 }]);
    expect(readScene(s, 139, m).drops).toHaveLength(1);
    expect(readScene(s, 140, m).drops).toEqual([]);
  });
  it('times', () => {
    const s = fakeRound();
    expect(readScene(s, 0, newMemo()).team).toBe(false);
    s.rules.mode = 'team';
    expect(readScene(s, 0, newMemo()).team).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/adapt.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar** `web/src/render/rom/adapt.ts`:

```ts
import { BURN, px, type RoundState } from '../../core';
import type { FlamePieceName, GridBomb, PressureDrop, RomMemo, RomScene, SceneObj } from './scene';

/** Índice = valor de FLAME_PIECE do núcleo (plano 6). */
export const FLAME_NAMES: readonly FlamePieceName[] = ['center', 'armU', 'armR', 'armD', 'armL', 'tipU', 'tipR', 'tipD', 'tipL'];
/** Altura da bomba nos 4 ticks do levantamento da luva (ANI §5.2). */
export const LIFT_Z = [6, 10, 14, 16] as const;

function heldAt(s: RoundState, id: number, owner: number, tick: number): SceneObj | null {
  const p = s.players.find(q => q.present && q.carry === id);
  if (p) {
    const z = p.act === 'lift' ? LIFT_Z[Math.min(3, Math.max(0, tick - p.actT0))] : 16;
    return { kind: 'bomb', item: 0, x: px(p.x), y: px(p.y), z };
  }
  const b = s.bad.find(q => q.slot === owner);
  return b ? { kind: 'bomb', item: 0, x: b.x, y: b.y, z: 16 } : null;
}

export function readScene(s: RoundState, tick: number, memo: RomMemo): RomScene {
  const gridBombs = new Map<number, GridBomb>();
  const objs: SceneObj[] = [];
  for (const b of s.bombs) {
    if (b.state === 'idle') gridBombs.set(b.cell, { type: b.type, born: b.born });
    else if (b.state === 'kicked') objs.push({ kind: 'bomb', item: 0, x: px(b.x), y: px(b.y), z: 0 });
    else if (b.state === 'held') { const o = heldAt(s, b.id, b.owner, tick); if (o) objs.push(o); }
  }
  for (const f of s.flyers) {
    objs.push({ kind: f.kind, item: f.kind === 'item' ? f.ref : 0, x: px(f.x), y: px(f.y), z: Math.max(0, -f.z) });
  }
  const now: PressureDrop[] = s.pressure.falling.map(f => ({ cell: f.cell, t0: f.t0, land: f.land }));
  const tail = memo.recentDrops.filter(d => tick < d.land + 2 && !now.some(n => n.cell === d.cell && n.t0 === d.t0));
  const drops = [...now, ...tail].filter(d => tick < d.land + 2);
  memo.recentDrops = drops;
  return {
    gridBombs, objs, drops,
    flame: cell => FLAME_NAMES[s.cellAux[cell]] ?? 'center',
    burn: cell => (s.cellAux[cell] === BURN.ITEM ? 'item' : 'soft'),
    team: s.rules.mode === 'team',
  };
}
```

- [ ] **Step 4: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/adapt.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/render/rom/adapt.ts web/tests/render-rom/adapt.test.ts
git commit -m "$(cat <<'MSG'
feat(render): adaptador do núcleo fiel para a cena da ROM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 8: Sprites — jogadores, Bad Bombers, bombas e itens em movimento, pressão, efeitos

**Files:**
- Create: `web/src/render/anim/effects.ts`
- Replace: `web/src/render/rom/sprites.ts` (esqueleto da T2)
- Test: `web/tests/render-rom/sprites.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: T2 (`FrameBuilder`, `ORDER_*`, `SpriteCtx`, `OBJ_ITEM_PAL`), T3 (`sampleAnim`, `animCycle`, `playerAnimRef`, `resolveAnim`), plano 5 (`Tiles`, `ObjEntry`), plano 6 (`invisibleVisible`, `px`, `colOf`, `linOf`), `romPlayerHooks` (T1).
- Produces: `skullBlack`, `invincibleHidden`, `PressureSprite`, `pressureSprite`; `PLAYER_OBJ_PAL`, `OBJ_BOMB`, `OBJ_SHADOW`, `OBJ_FALLING`, `OBJ_PRESSURE_PAL`, `tile16Px`, `drawPlayers`, `drawBadBombers`, `drawObjects`, `drawPressure`, `drawSprites`.

Regras (spec §7.2, §7.4; ANI §1.4, §2, §4, §5.2, §8; D11–D15, D20):
- Jogador presente, fora de `out`/`bad`: paleta de 16 cores na OBJ `[0,1,4,5,6][slot]` (CGRAM `128 + 16·pal`), da tabela normal ou de time. Caveira (doença ≠ 0 e ≠ `$29`): paleta toda preta quando `frame & 4`. Não desenha se `inv & 2` (`inv > 0`) nem se `$29` e `!invisibleVisible(p)`. Morte: some com `t ≥ animCycle`.
- Gancho do plano 9: o 1º `romPlayerHooks` que devolver lista substitui o desenho padrão (mesmo `sortY`/`order`).
- Desenho padrão: peças do quadro amostrado em `t = tick − actT0`, OBJ 32×32, prioridade 2, em `(X + dx + ox, Y + dy + oy)`, `src.px = character(c).frame(g)`, `sortY = Y`, `order = ORDER_PLAYER + slot`.
- Bad Bomber (D20): de `s.bad[]` (px), animação de andar da `face` em `t = tick`.
- Bomba em movimento: OBJ 16×16, tile `$180`, paleta 7, em `(x − 8, y − z − 8)`, `sortY = y − z`. Item voando: mesmo lugar, paleta OBJ 2, `src.px` = 16×16 do tile de BG do item.
- Pressão: sombra tile `$04E` e bloco `$04C`, paleta 7, `sortY = 16·lin + 31`, bloco na frente.

- [ ] **Step 1: Teste** `web/tests/render-rom/sprites.test.ts`:

```ts
import { invincibleHidden, pressureSprite, skullBlack } from '../../src/render/anim/effects';
import { FrameBuilder } from '../../src/render/rom/builder';
import { PLAYER_OBJ_PAL, drawSprites, tile16Px } from '../../src/render/rom/sprites';
import { romTables } from '../../src/render/rom/tables';
import { newMemo, type RomScene } from '../../src/render/rom/scene';
import { romPlayerHooks } from '../../src/render/battle-layers';
import { invisibleVisible, type RoundState } from '../../src/core';
import type { ObjEntry } from '../../src/render/ppu';
import { fakeAssets, fakeRound, fakeTiles } from './fakes';

function run(s: RoundState, o: { tick?: number; frame?: number; scene?: Partial<RomScene> } = {}) {
  const a = fakeAssets();
  const b = new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));
  const tick = o.tick ?? s.tick;
  const scene: RomScene = { gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false, ...o.scene };
  drawSprites(b, { s, a, tb: romTables(a), scene, clock: { tick, bombTick: tick, frame: o.frame ?? 0 }, memo: newMemo(), tiles: a.arena(1).bgTiles });
  return { a, b, oam: b.oam() };
}
const ofSlot = (oam: ObjEntry[], slot: number) => oam.filter(e => e.size === 32 && e.pal === PLAYER_OBJ_PAL[slot]);
const gOf = (a: ReturnType<typeof fakeAssets>, e: ObjEntry, char: number) => {
  const px = (e.src as { px: Uint8Array }).px;
  for (let g = 0; g < 256; g++) if (a.character(char).frame(g) === px) return g;
  return -1;
};
const only = (s: RoundState, slot: number) => s.players.forEach((p, i) => { p.present = i === slot; });

describe('efeitos', () => {
  it('caveira: preto quando frame & 4 (4/4)', () => {
    expect([0, 3, 4, 7, 8].map(skullBlack)).toEqual([false, false, true, true, false]);
  });
  it('invencível: some quando inv & 2', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(invincibleHidden)).toEqual([false, false, true, true, false, false, true]);
  });
  it('pressão lin 1, t0 100, pouso 138 (D11)', () => {
    const at = (t: number) => pressureSprite({ t0: 100, land: 138 }, 1, t);
    expect(at(99)).toEqual({ shadow: false, blockY: null });
    expect(at(100)).toEqual({ shadow: true, blockY: null });
    expect(at(132)).toEqual({ shadow: true, blockY: null });
    expect([133, 134, 135, 136, 137, 138, 139].map(t => at(t).blockY)).toEqual([0, 8, 16, 24, 32, 40, 40]);
    expect(at(140)).toEqual({ shadow: false, blockY: null });
  });
  it('pressão lin 11: bloco 8 px acima da casa no tick anterior ao pouso', () => {
    expect(pressureSprite({ t0: 0, land: 58 }, 11, 57).blockY).toBe(192);
    expect(pressureSprite({ t0: 0, land: 58 }, 11, 58).blockY).toBe(200);
  });
});

describe('jogadores', () => {
  it('5 jogadores em (X−16, Y−24), 32×32, prioridade 2, ordenados por Y; paletas nas OBJ 0,1,4,5,6', () => {
    const { a, b, oam } = run(fakeRound());
    expect(oam.map(e => PLAYER_OBJ_PAL.indexOf(e.pal as 0))).toEqual([1, 3, 4, 0, 2]);
    const p1 = ofSlot(oam, 0)[0];
    expect([p1.x, p1.y, p1.size, p1.prio]).toEqual([16, 24, 32, 2]);
    expect(gOf(a, p1, 0)).toBe(12);                        // parado ↓ = índice 12 (anim falsa: g = índice)
    for (let slot = 0; slot < 5; slot++) expect(b.cg[128 + 16 * PLAYER_OBJ_PAL[slot] + 3]).toBe((slot << 12) | (slot << 8) | 3);
  });
  it('ausente e out não desenham', () => {
    const s = fakeRound();
    s.players[1].present = false;
    s.players[2].state = 'out';
    const { oam } = run(s);
    expect([ofSlot(oam, 1).length, ofSlot(oam, 2).length]).toEqual([0, 0]);
  });
  it('andar →: g4:12 g3:8 g5:12 g3:8 a partir do actT0', () => {
    const s = fakeRound();
    only(s, 0);
    Object.assign(s.players[0], { act: 'walk', face: 2, actT0: 50, moveDir: 2 });
    const g = (t: number) => { const r = run(s, { tick: t }); return gOf(r.a, r.oam[0], 0); };
    expect([50, 61, 62, 69, 70, 82, 89, 90].map(g)).toEqual([4, 4, 3, 3, 5, 3, 3, 4]);
  });
  it('morte: g24…g27 e some depois de 22 ticks (D15)', () => {
    const s = fakeRound();
    only(s, 0);
    Object.assign(s.players[0], { act: 'dying', state: 'dying', actT0: 100 });
    const g = (t: number) => { const r = run(s, { tick: t }); return r.oam.length ? gOf(r.a, r.oam[0], 0) : null; };
    expect([100, 105, 110, 116, 121, 122].map(g)).toEqual([24, 25, 26, 27, 27, null]);
  });
  it('invencível pisca 2/2; invisível segue o núcleo', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].inv = 2;
    expect(run(s).oam).toHaveLength(0);
    s.players[0].inv = 4;
    expect(run(s).oam).toHaveLength(1);
    s.players[0].inv = 0;
    s.players[0].disease = 0x29;
    for (const t of [1, 2, 130, 500]) {
      s.players[0].diseaseT = t;
      expect(run(s).oam.length).toBe(invisibleVisible(s.players[0]) ? 1 : 0);
    }
  });
  it('caveira: paleta preta com frame & 4; $29 não escurece; time usa $C2:7B9D', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].disease = 0x21;
    expect(Array.from(run(s, { frame: 4 }).b.cg.slice(128, 144)).every(c => c === 0)).toBe(true);
    expect(run(s, { frame: 0 }).b.cg[128 + 3]).toBe(3);
    s.players[0].disease = 0x29;
    s.players[0].diseaseT = 2;
    expect(run(s, { frame: 4 }).b.cg[128 + 3]).toBe(3);
    s.players[0].disease = 0;
    expect(run(s, { scene: { team: true } }).b.cg[128 + 3]).toBe(0x0103);
  });
  it('gancho do plano 9 substitui o desenho padrão', () => {
    const s = fakeRound();
    only(s, 0);
    const mark: ObjEntry = { x: 7, y: 7, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { tile: 1 } };
    romPlayerHooks.push(() => [mark]);
    try { expect(run(s).oam).toEqual([mark]); } finally { romPlayerHooks.pop(); }
  });
  it('Bad Bomber: desenhado de s.bad com a folha do slot, andando (D20)', () => {
    const s = fakeRound();
    only(s, 3);
    s.players[3].state = 'bad';
    s.bad.push({ slot: 3, x: 15, y: 120, phase: 'patrol', face: 2, live: -1, readyAt: 0 });
    const { a, oam } = run(s, { tick: 0 });
    expect(oam).toHaveLength(1);
    expect([oam[0].x, oam[0].y, oam[0].pal]).toEqual([-1, 96, 5]);
    expect(gOf(a, oam[0], 3)).toBe(4);
  });
});

describe('objetos e pressão', () => {
  it('bomba em movimento: tile $180, paleta 7, 16×16, sortY = y − z', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].y = 75 * 256;
    const bomb = { kind: 'bomb' as const, item: 0, x: 100, y: 80, z: 6 };
    const { oam } = run(s, { scene: { objs: [bomb] } });
    expect(oam[1]).toEqual({ x: 92, y: 66, size: 16, pal: 7, prio: 2, hflip: false, vflip: false, src: { tile: 0x180 } });
    s.players[0].y = 73 * 256;
    expect(run(s, { scene: { objs: [bomb] } }).oam[0].src).toEqual({ tile: 0x180 });
  });
  it('item voando: paleta OBJ 2 e pixels do tile de BG do item (D12)', () => {
    const s = fakeRound();
    only(s, -1);
    const { a, oam } = run(s, { scene: { objs: [{ kind: 'item', item: 1, x: 50, y: 60, z: 0 }] } });
    expect([oam[0].x, oam[0].y, oam[0].pal]).toEqual([42, 52, 2]);
    expect((oam[0].src as { px: Uint8Array }).px).toEqual(tile16Px(a.arena(1).bgTiles, 0x1280));
  });
  it('tile16Px: tiles n, n+1, n+16, n+17 e flips', () => {
    const t = fakeTiles(1024, i => i & 0xff);
    const p = tile16Px(t, 0x1280);
    expect([p[0], p[8], p[128], p[255]]).toEqual([0x80, 0x81, 0x90, 0x91]);
    expect(tile16Px(t, 0x5280)[0]).toBe(0x81);
    expect(tile16Px(t, 0x9280)[0]).toBe(0x90);
  });
  it('pressão: sombra na casa; bloco cai na frente dela', () => {
    const s = fakeRound();
    only(s, -1);
    const drops = [{ cell: 19, t0: 100, land: 138 }];
    const at = (t: number) => run(s, { tick: t, scene: { drops } }).oam.map(e => [e.x, e.y, (e.src as { tile: number }).tile, e.pal]);
    expect(at(100)).toEqual([[24, 40, 0x4e, 7]]);
    expect(at(133)).toEqual([[24, 0, 0x4c, 7], [24, 40, 0x4e, 7]]);
    expect(at(140)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/sprites.test.ts`
Expected: FAIL (`effects.ts` inexistente; `drawSprites` ainda vazio).

- [ ] **Step 3: Implementar** `web/src/render/anim/effects.ts`:

```ts
/** Caveira (exceto $29): paleta preta quando frame & 4 ($C1:758C). */
export function skullBlack(frame: number): boolean { return (frame & 4) !== 0; }

/** Invencível: não desenha quando inv & 2 ($C1:77E7). */
export function invincibleHidden(inv: number): boolean { return inv > 0 && (inv & 2) !== 0; }

export interface PressureSprite { shadow: boolean; blockY: number | null }

/** Sombra de t0 a land+1; bloco com topo da casa − 8·(land − tick), a partir de y = 0 (D11). */
export function pressureSprite(d: { t0: number; land: number }, lin: number, tick: number): PressureSprite {
  if (tick < d.t0 || tick >= d.land + 2) return { shadow: false, blockY: null };
  const top = 16 * lin + 24;
  const y = top - 8 * Math.max(0, d.land - tick);
  return { shadow: true, blockY: y >= 0 ? y : null };
}
```

- [ ] **Step 4: Implementar** `web/src/render/rom/sprites.ts`:

```ts
import { colOf, invisibleVisible, linOf, px, type Player, type RoundState } from '../../core';
import type { RomAssets, Tiles } from '../../rom/types';
import type { ObjEntry } from '../ppu';
import { romPlayerHooks } from '../battle-layers';
import { animCycle, sampleAnim } from '../anim/sample';
import { playerAnimRef, resolveAnim } from '../anim/player-anim';
import { invincibleHidden, pressureSprite, skullBlack } from '../anim/effects';
import { ORDER_OBJ, ORDER_PLAYER, ORDER_PRESSURE, type FrameBuilder } from './builder';
import type { RomTables } from './tables';
import { OBJ_ITEM_PAL, type RomClock, type RomMemo, type RomScene } from './scene';

export interface SpriteCtx {
  s: RoundState; a: RomAssets; tb: RomTables; scene: RomScene; clock: RomClock; memo: RomMemo;
  tiles: Tiles;   // tiles de BG do quadro (itens voando, D12)
}

export const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;   // P1..P5 (ANI §2.5)
export const OBJ_BOMB = { tile: 0x180, pal: 7 } as const;  // anim $D8:D3A8: peça (−8,−8), tile $80 + base $100, attr $2F
export const OBJ_SHADOW = 0x04e;
export const OBJ_FALLING = 0x04c;
export const OBJ_PRESSURE_PAL = 7;                          // attr $2E

const BLACK = new Uint16Array(16);

/** 16×16 (tiles n, n+1, n+16, n+17) a partir de uma palavra de BG, com os flips dela. */
export function tile16Px(t: Tiles, word: number): Uint8Array {
  const n = word & 0x3ff;
  const h = (word & 0x4000) !== 0;
  const v = (word & 0x8000) !== 0;
  const out = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sx = h ? 15 - x : x;
    const sy = v ? 15 - y : y;
    const tile = (n + (sx >> 3) + 16 * (sy >> 3)) & 0x3ff;
    out[y * 16 + x] = t.px[tile * 64 + (sy & 7) * 8 + (sx & 7)];
  }
  return out;
}

const itemPx = new WeakMap<Tiles, Map<number, Uint8Array>>();
function itemTilePx(t: Tiles, word: number): Uint8Array {
  let m = itemPx.get(t);
  if (!m) { m = new Map(); itemPx.set(t, m); }
  let p = m.get(word);
  if (!p) { p = tile16Px(t, word); m.set(word, p); }
  return p;
}

function loadPalette(b: FrameBuilder, c: SpriteCtx, p: Player): void {
  const colors = c.scene.team ? c.tb.teamPalette(p.char, p.slot) : c.a.character(p.char).palettes[p.slot];
  const black = p.disease !== 0 && p.disease !== 0x29 && skullBlack(c.clock.frame);
  const src = black ? BLACK : colors;
  const base = 128 + 16 * PLAYER_OBJ_PAL[p.slot];
  for (let i = 0; i < 16; i++) b.cgram(base + i, src[i] ?? 0);
}

function drawFrame(b: FrameBuilder, c: SpriteCtx, p: Player, X: number, Y: number, act: Player['act'], face: number,
  moving: boolean, t: number): void {
  const { ref, t: at } = playerAnimRef({ act, face, char: p.char, moving }, t);
  const anim = resolveAnim(c.a, ref, p.char);
  if (act === 'dying' && at >= animCycle(anim)) return;
  const sm = sampleAnim(anim, at);
  const ch = c.a.character(p.char);
  const pal = PLAYER_OBJ_PAL[p.slot];
  for (const pc of sm.frame.pieces) {
    b.sprite({ x: X + pc.dx + sm.ox, y: Y + pc.dy + sm.oy, size: 32, pal: (pal + pc.palAdd) & 7, prio: 2,
      hflip: pc.hflip, vflip: pc.vflip, src: { px: ch.frame(pc.tile) } }, Y, ORDER_PLAYER + p.slot);
  }
}

export function drawPlayers(b: FrameBuilder, c: SpriteCtx): void {
  const { s, a, clock } = c;
  for (const p of s.players) {
    if (!p.present || p.state === 'out' || p.state === 'bad') continue;
    loadPalette(b, c, p);
    if (invincibleHidden(p.inv)) continue;
    if (p.disease === 0x29 && !invisibleVisible(p)) continue;
    const X = px(p.x);
    const Y = px(p.y);
    let hooked = false;
    for (const h of romPlayerHooks) {
      const r = h(s, p, a, clock.frame);
      if (r) { for (const e of r) b.sprite(e, Y, ORDER_PLAYER + p.slot); hooked = true; break; }
    }
    if (!hooked) drawFrame(b, c, p, X, Y, p.act, p.face, p.moveDir !== 8, clock.tick - p.actT0);
  }
}

/** Bad Bombers (D20): posição e face de s.bad, animação de andar amostrada em `tick`. */
export function drawBadBombers(b: FrameBuilder, c: SpriteCtx): void {
  for (const bb of c.s.bad) {
    const p = c.s.players[bb.slot];
    if (!p) continue;
    loadPalette(b, c, p);
    drawFrame(b, c, p, bb.x, bb.y, 'bad', bb.face, true, c.clock.tick);
  }
}

export function drawObjects(b: FrameBuilder, c: SpriteCtx): void {
  c.scene.objs.forEach((o, i) => {
    const y = o.y - o.z;
    const e: ObjEntry = o.kind === 'bomb'
      ? { x: o.x - 8, y: y - 8, size: 16, pal: OBJ_BOMB.pal, prio: 2, hflip: false, vflip: false, src: { tile: OBJ_BOMB.tile } }
      : { x: o.x - 8, y: y - 8, size: 16, pal: OBJ_ITEM_PAL, prio: 2, hflip: false, vflip: false,
        src: { px: itemTilePx(c.tiles, c.tb.itemWord(o.item)) } };
    b.sprite(e, y, ORDER_OBJ + i);
  });
}

export function drawPressure(b: FrameBuilder, c: SpriteCtx): void {
  c.scene.drops.forEach((d, i) => {
    const col = colOf(d.cell);
    const lin = linOf(d.cell);
    const ps = pressureSprite(d, lin, c.clock.tick);
    const x = 16 * col - 8;
    const sortY = 16 * lin + 31;
    if (ps.blockY !== null) b.sprite({ x, y: ps.blockY, size: 16, pal: OBJ_PRESSURE_PAL, prio: 2, hflip: false, vflip: false,
      src: { tile: OBJ_FALLING } }, sortY, ORDER_PRESSURE + 2 * i);
    if (ps.shadow) b.sprite({ x, y: 16 * lin + 24, size: 16, pal: OBJ_PRESSURE_PAL, prio: 2, hflip: false, vflip: false,
      src: { tile: OBJ_SHADOW } }, sortY, ORDER_PRESSURE + 2 * i + 1);
  });
}

export function drawSprites(b: FrameBuilder, c: SpriteCtx): void {
  drawPlayers(b, c);
  drawBadBombers(b, c);
  drawObjects(b, c);
  drawPressure(b, c);
}
```

- [ ] **Step 5: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/sprites.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/render/anim/effects.ts web/src/render/rom/sprites.ts web/tests/render-rom/sprites.test.ts
git commit -m "$(cat <<'MSG'
feat(render): sprites da ROM — jogadores, Bad Bombers, bombas e itens voando, pressão

Caveira, invencível e invisível; gancho romPlayerHooks do plano 9.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 9: Orquestração — `buildBattleFrame`, `drawRomBattle` e o golden da 1ª imagem

**Files:**
- Replace: `web/src/render/rom/battle.ts` (*stub* do plano 5)
- Test: `web/tests/render-rom/battle.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: T2–T7 (`FrameBuilder`, `romTables`, `readScene`, `fieldWords`, `hudWords`, `headTiles`, `headOverrides`, `sceneryTiles`, `sceneryCgram`, `newMemo`), `drawSprites` (esqueleto da T2; a T8 preenche em paralelo), plano 5 (`renderPpu`, `PpuFrame`, `ScanBand`), `romLayers` + `layers-index` (plano 6).
- Produces: `RomBattleVis`, `BuildOpts`, `HUD_HOFS`, `HUD_VOFS`, `FIELD_HOFS`, `FIELD_VOFS`, `HUD_MAP_ROW`, `romMemo(s)`, `battleClock(s, memo, frame)`, `buildBattleFrame(s, vis, a, frame, opts?)`, `drawRomBattle(ctx, round, vis, assets, frame): boolean`.

Montagem de um quadro (spec §2.4, §7.1; D1, D6, D18):
1. Relógio visual (`battleClock`, D6) e memória da rodada (`romMemo`).
2. Tiles do quadro: animação de tiles + rostos do HUD (ou `tileCopies` e sem rostos, para o golden). CGRAM do quadro.
3. BG2 = `fieldWords`; BG1 = `ArenaAssets.bg1` com as linhas 28–30 trocadas por `hudWords` (relógio, rostos, coroas de `vis.crowns`).
4. Sprites (`drawSprites`), depois as camadas (`opts.layers ?? romLayers`, na ordem de registro) sobre o mesmo builder.
5. Faixas: HUD `[0,24)`: BG1 8×8, BG1 `(8, −33)`, `main = BG1|OBJ`. Campo `[24,224)`: BG1 16×16 `(hofs, −25)`, BG2 `(8, −25)`, `main = BG1|BG2|OBJ`, `sub = BG2` e `math` da arena quando houver *color math*.

`drawRomBattle` monta, rasteriza num `ImageData` 256×224 guardado por contexto, faz `putImageData` e devolve `true`. Se os assets falharem, avisa uma vez no console e devolve `false` (a tela usa o *fallback*).

- [ ] **Step 1: Teste** `web/tests/render-rom/battle.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { battleClock, buildBattleFrame, drawRomBattle, romMemo } from '../../src/render/rom/battle';
import { newMemo } from '../../src/render/rom/scene';
import { renderPpu } from '../../src/render/ppu';
import type { RomBattleBuilder, RomBattleLayer } from '../../src/render/battle-layers';
import type { RomAssets } from '../../src/rom/types';
import { blankImage, fakeAssets, fakeRound } from './fakes';
import { ASSETS } from './rom-fixture';
import { newRound } from './core-fixture';
import { staticObjects } from '../../src/rom/arena-build';

const VIS = { crowns: [0, 1, 2, 3, 4] };

describe('buildBattleFrame (assets falsos)', () => {
  it('faixas: HUD 8×8 (0–23) e campo 16×16 (24–223) (D18)', () => {
    const f = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 0, { layers: [] });
    expect(f.bands).toEqual([
      { y0: 0, y1: 24, bg1Tile16: false, bg1: [8, -33], bg2: [8, -25], main: 0x11, sub: 0, math: 'none' },
      { y0: 24, y1: 224, bg1Tile16: true, bg1: [8, -25], bg2: [8, -25], main: 0x13, sub: 0, math: 'none' },
    ]);
    expect(f.bg1!.tiles).toBe(f.bg2!.tiles);
  });
  it('color math da arena: BG2 na subtela', () => {
    const f = buildBattleFrame(fakeRound(), VIS, fakeAssets({ arena: { colorMath: 'half' } }), 0, { layers: [] });
    expect(f.bands[1]).toMatchObject({ sub: 0x02, math: 'half' });
  });
  it('BG1 = decoração + HUD nas linhas 28–30 (relógio, coroas de vis)', () => {
    const a = fakeAssets({ arena: { bg1: Uint16Array.from({ length: 1024 }, (_, i) => 0x3000 | i) } });
    const s = fakeRound();
    s.clock.sec = 181;
    const m = buildBattleFrame(s, VIS, a, 0, { layers: [] }).bg1!.map;
    expect(m[5 * 32 + 3]).toBe(0x3000 | (5 * 32 + 3));
    expect(m[28 * 32 + 4]).toBe(0x2632);
    expect([m[29 * 32 + 12], m[29 * 32 + 16], m[29 * 32 + 28]]).toEqual([0x2640, 0x2641, 0x2644]);
  });
  it('BG2 da grade; camadas rodam depois e sobrescrevem', () => {
    const s = fakeRound();
    s.grid[1 * 17 + 5] = 0xee80;
    const layer: RomBattleLayer = {
      id: 'teste',
      draw: (_s, b: RomBattleBuilder) => {
        b.setBg2(6, 1, 0xabcd);
        b.cgram(5, 0x1234);
        b.bg1Scroll(0x18);
        b.sprite({ x: 1, y: 2, size: 16, pal: 7, prio: 2, hflip: false, vflip: false, src: { tile: 0x180 } }, 300, 1000);
      },
    };
    const f = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [layer], sprites: false });
    expect([f.bg2!.map[1 * 32 + 5], f.bg2!.map[1 * 32 + 6], f.cgram[5]]).toEqual([0x082e, 0xabcd, 0x1234]);
    expect(f.bands[1].bg1).toEqual([0x18, -25]);
    expect(f.oam).toHaveLength(1);
  });
  it('rostos entram nos tiles $201…; hudHeads: false mantém os da ROM', () => {
    const a = fakeAssets();
    const px = buildBattleFrame(fakeRound(), VIS, a, 0, { layers: [] }).bg1!.tiles.px;
    expect([px[0x201 * 64], px[0x203 * 64], px[0x222 * 64]]).toEqual([0x40, 0x48, 0x45]);
    const raw = buildBattleFrame(fakeRound(), VIS, a, 0, { layers: [], hudHeads: false }).bg1!.tiles.px;
    expect(raw[0x201 * 64]).toBe(0x201 & 0xff);
  });
  it('CGRAM: pisca na cor 79 pelo frame; OBJ da arena; OBJ pal 2 = BG pal 4', () => {
    const f0 = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 0, { layers: [], sprites: false });
    const f4 = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 4, { layers: [], sprites: false });
    expect([f0.cgram[79], f4.cgram[79], f0.cgram[130]]).toEqual([0x00bf, 0x7d80, 0x4002]);
    expect(Array.from(f0.cgram.slice(160, 176))).toEqual(Array.from(f0.cgram.slice(64, 80)));
    expect(f0.objTiles!.count).toBe(512);
  });
});

describe('relógio visual (D6)', () => {
  it('TIME UP congela tudo em phaseT0, também no over seguinte', () => {
    const s = fakeRound({ tick: 560, phase: 'timeUp', phaseT0: 500 });
    const m = newMemo();
    expect(battleClock(s, m, 9)).toEqual({ tick: 500, bombTick: 500, frame: 9 });
    Object.assign(s, { phase: 'over', phaseT0: 660, tick: 700 });
    expect(battleClock(s, m, 9).tick).toBe(500);
  });
  it('vitória congela só as bombas', () => {
    expect(battleClock(fakeRound({ tick: 560, phase: 'won', phaseT0: 500 }), newMemo(), 0)).toEqual({ tick: 560, bombTick: 500, frame: 0 });
  });
  it('em jogo tudo segue o tick', () => {
    expect(battleClock(fakeRound({ tick: 42 }), newMemo(), 3)).toEqual({ tick: 42, bombTick: 42, frame: 3 });
  });
  it('a bomba congela na vitória e a chama segue', () => {
    const s = fakeRound({ tick: 560, phase: 'won', phaseT0: 500 });
    s.grid[1 * 17 + 2] = 0xc900;
    s.bombs.push({ id: 1, owner: 0, bad: false, cell: 19, x: 0, y: 0, fuse: 0, fire: 0, type: 0, state: 'idle',
      dir: 0, step: 0, kickedBy: -1, chainAt: 0, born: 480 });
    s.grid[1 * 17 + 3] = 0x1000;
    s.cellT0[1 * 17 + 3] = 558;
    const m = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [], sprites: false }).bg2!.map;
    expect([m[1 * 32 + 2], m[1 * 32 + 3]]).toEqual([0x0b02, 0x0f8c]);
  });
  it('memória por rodada', () => {
    const s = fakeRound();
    expect(romMemo(s)).toBe(romMemo(s));
    expect(romMemo(fakeRound())).not.toBe(romMemo(s));
  });
});

describe('drawRomBattle', () => {
  const ctx = () => {
    const put = vi.fn();
    const create = vi.fn((w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
    return { c: { putImageData: put, createImageData: create } as unknown as CanvasRenderingContext2D, put, create };
  };
  it('desenha 256×224 com putImageData e reaproveita o ImageData', () => {
    const { c, put, create } = ctx();
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets(), 0)).toBe(true);
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets(), 1)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[0][0].width).toBe(256);
    expect(put.mock.calls[0][0].height).toBe(224);
  });
  it('devolve false se os assets falham (a tela usa o fallback)', () => {
    const { c, put } = ctx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets({ arenaThrows: true }), 0)).toBe(false);
    expect(put).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

interface GoldenEntry { stage: number; bg1Hofs: number; tileCopies: [number, number][]; sha1: string }
function loadGolden(): GoldenEntry[] {
  const f = fileURLToPath(new URL('../fixtures/rom/gfx-render-bg.json', import.meta.url));
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).arenas as GoldenEntry[]) : [];
}
/** Setas (7), pads (8) e gangorras (9) como o golden do plano 5 (`staticObjects`) — o que as camadas do plano 8 farão. */
function writeStatic(b: RomBattleBuilder, a: RomAssets, stage: number): void {
  for (const o of staticObjects(a.rom, stage)) b.setBg2((o.off >> 1) % 32, (o.off >> 1) >> 5, o.word);
}

describe.skipIf(!ASSETS)('1ª imagem de cada arena, sem sprites = golden do plano 5 (§11, aceite 7)', () => {
  // O golden (plano 5, D7) é paridade com render_rom.py: HUD 3:00, rostos da ROM, coroas 0, cor 79 da ROM, sem OBJ.
  const golden = loadGolden();
  it('há golden para as 10 arenas (+ arena 2 com HOFS $18)', () => {
    expect(golden).toHaveLength(11);
    expect([...new Set(golden.map(g => g.stage))].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  for (const g of golden) it(`arena ${g.stage} (HOFS do BG1 ${g.bg1Hofs})`, () => {
    const s = newRound(g.stage);
    s.clock.sec = 180;   // o golden mostra 3:00
    const layers: RomBattleLayer[] = [{
      id: 'golden',
      draw: (_s, b, a) => { b.bg1Scroll(g.bg1Hofs); writeStatic(b, a, g.stage); },
    }];
    const f = buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, ASSETS!, 0,
      { sprites: false, hudHeads: false, blink: false, layers, tileCopies: g.tileCopies });
    const img = blankImage();
    renderPpu(f, img);
    expect(createHash('sha1').update(img.data).digest('hex')).toBe(g.sha1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

Run: `cd web && npx vitest run tests/render-rom/battle.test.ts`
Expected: FAIL (`buildBattleFrame` não existe no *stub*).

- [ ] **Step 3: Implementar** `web/src/render/rom/battle.ts`:

```ts
import type { RoundState } from '../../core';
import type { RomAssets } from '../../rom/types';
import { renderPpu, type PpuFrame, type ScanBand } from '../ppu';
import { romLayers, type RomBattleLayer } from '../battle-layers';
import '../layers-index';
import { FrameBuilder } from './builder';
import { romTables } from './tables';
import { readScene } from './adapt';
import { fieldWords } from './field';
import { headOverrides, headTiles, hudWords } from './hud';
import { sceneryCgram, sceneryTiles } from './scenery';
import { drawSprites } from './sprites';
import { MAP_W, newMemo, type RomClock, type RomMemo } from './scene';

/** D1: o que a tela da partida passa além da rodada. */
export interface RomBattleVis { crowns: readonly number[] }

export interface BuildOpts {
  sprites?: boolean;                               // padrão true
  hudHeads?: boolean;                              // padrão true; false = tiles de rosto da ROM (golden)
  blink?: boolean;                                 // padrão true; false = cor 79 da ROM (golden)
  layers?: readonly RomBattleLayer[];              // padrão romLayers
  tileCopies?: readonly (readonly [number, number])[];   // quadro de animação fixo (golden)
}

export const HUD_HOFS = 8;
export const HUD_VOFS = -33;
export const FIELD_HOFS = 8;
export const FIELD_VOFS = -25;
export const HUD_MAP_ROW = 28;
const BG1 = 1, BG2 = 2, OBJ = 16;
const NO_CROWNS: readonly number[] = [0, 0, 0, 0, 0];

const memos = new WeakMap<RoundState, RomMemo>();
export function romMemo(s: RoundState): RomMemo {
  let m = memos.get(s);
  if (!m) { m = newMemo(); memos.set(s, m); }
  return m;
}

/** D6: TIME UP congela tudo (também no `over` seguinte); vitória congela só o script das bombas. */
export function battleClock(s: RoundState, memo: RomMemo, frame: number): RomClock {
  if (s.phase === 'timeUp') memo.freezeAll ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeAll = null;
  if (s.phase === 'won') memo.freezeBombs ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeBombs = null;
  const tick = memo.freezeAll ?? s.tick;
  return { tick, bombTick: memo.freezeAll ?? memo.freezeBombs ?? s.tick, frame };
}

export function buildBattleFrame(s: RoundState, vis: RomBattleVis, a: RomAssets, frame: number, opts: BuildOpts = {}): PpuFrame {
  const ar = a.arena(s.stage);
  const tb = romTables(a);
  const memo = romMemo(s);
  const clock = battleClock(s, memo, frame);
  const heads = opts.hudHeads === false ? [] : headOverrides(s.players.map(p => (p.present ? headTiles(a.character(p.char), p.slot) : null)));
  const headKey = opts.hudHeads === false ? 'rom' : s.players.map(p => (p.present ? p.char : '-')).join(',');
  const tiles = sceneryTiles(ar, clock.tick, heads, headKey, opts.tileCopies);
  const cgram = sceneryCgram(ar, clock.tick, frame, opts.blink !== false);
  const scene = readScene(s, clock.tick, memo);
  const bg2 = fieldWords(s, ar, scene, tb, clock, t => a.bombScript(t));
  const bg1 = Uint16Array.from(ar.bg1.subarray(0, 1024));
  bg1.set(hudWords(ar.hudMap, s.clock.sec, s.players.map(p => p.present), vis.crowns ?? NO_CROWNS, tb.crownWord), HUD_MAP_ROW * MAP_W);
  const b = new FrameBuilder(bg1, bg2, cgram);
  if (opts.sprites !== false) drawSprites(b, { s, a, tb, scene, clock, memo, tiles });
  for (const l of opts.layers ?? romLayers) l.draw(s, b, a, frame);
  const math = ar.colorMath;
  const bands: ScanBand[] = [
    { y0: 0, y1: 24, bg1Tile16: false, bg1: [HUD_HOFS, HUD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS], main: BG1 | OBJ, sub: 0, math: 'none' },
    { y0: 24, y1: 224, bg1Tile16: true, bg1: [b.hofs1, FIELD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS],
      main: BG1 | BG2 | OBJ, sub: math === 'none' ? 0 : BG2, math },
  ];
  return {
    cgram: b.cg,
    bg1: { map: b.bg1, mapW: 32, tiles, tile16: true, hofs: b.hofs1, vofs: FIELD_VOFS },
    bg2: { map: b.bg2, mapW: 32, tiles, tile16: true, hofs: FIELD_HOFS, vofs: FIELD_VOFS },
    bands,
    objTiles: ar.objCommon,
    oam: b.oam(),
  };
}

const images = new WeakMap<CanvasRenderingContext2D, ImageData>();
let warned = false;

export function drawRomBattle(ctx: CanvasRenderingContext2D, round: RoundState, vis: RomBattleVis, assets: RomAssets, frame: number): boolean {
  let f: PpuFrame;
  try {
    f = buildBattleFrame(round, vis, assets, frame);
  } catch (e) {
    if (!warned) { console.warn('Crown Blast: gráficos da ROM indisponíveis nesta partida; usando a arte própria.', e); warned = true; }
    return false;
  }
  let img = images.get(ctx);
  if (!img) { img = ctx.createImageData(256, 224); images.set(ctx, img); }
  renderPpu(f, img);
  ctx.putImageData(img, 0, 0);
  return true;
}
```

- [ ] **Step 4: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/battle.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/battle.test.ts && npx tsc --noEmit`
Expected: PASS; com a ROM, os 11 quadros batem com o golden. Se não bater: (1) conferir a convenção de VOFS/HOFS da PPU (T1) e as constantes `HUD_VOFS`/`FIELD_VOFS`; (2) comparar pixel a pixel com o *frame* que o próprio teste de golden do plano 5 monta, para achar a camada que diverge; (3) só então suspeitar de `fieldWords`/`hudWords`.

- [ ] **Step 5: Commit**

```bash
git add web/src/render/rom/battle.ts web/tests/render-rom/battle.test.ts
git commit -m "$(cat <<'MSG'
feat(render): drawRomBattle real — quadro da partida pela PPU, camadas e golden da 1ª imagem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 10: Ponta a ponta com a ROM e o núcleo real; screenshots das 10 arenas

**Files:**
- Create: `web/tests/render-rom/png.ts`, `web/tests/render-rom/png.test.ts`, `web/tests/render-rom/e2e.test.ts`, `web/tests/render-rom/shots.test.ts`

**Possui:** os arquivos acima.

**Interfaces:**
- Consumes: tudo das T1–T9; núcleo real (`newRound`, `toPlay`, `stepN`, `BTN`).
- Produces: `encodePng(w, h, rgba)`; os testes de aceite do plano.

- [ ] **Step 1: Codificador PNG mínimo** `web/tests/render-rom/png.ts` (só para os screenshots locais; nada vai para o repositório):

```ts
import { deflateSync } from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b: Uint8Array): number {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
export function encodePng(w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}
```

`web/tests/render-rom/png.test.ts`:

```ts
import { inflateSync } from 'node:zlib';
import { encodePng } from './png';

describe('encodePng', () => {
  it('assinatura, IHDR, IDAT com filtro 0 e IEND', () => {
    const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([2, 1, 8, 6]);
    const len = png.readUInt32BE(33);
    expect(png.toString('ascii', 37, 41)).toBe('IDAT');
    expect([...inflateSync(png.subarray(41, 41 + len))]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 255]);
    expect(png.readUInt32BE(png.length - 4)).toBe(0xae426082);
  });
});
```

- [ ] **Step 2: Ponta a ponta** `web/tests/render-rom/e2e.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { headTiles } from '../../src/render/rom/hud';
import { PLAYER_OBJ_PAL } from '../../src/render/rom/sprites';
import { renderPpu, type ObjEntry } from '../../src/render/ppu';
import { px, type RoundState } from '../../src/core';
import { blankImage } from './fakes';
import { ASSETS } from './rom-fixture';
import { BTN, NO_INPUT, newRound, stepN, toPlay } from './core-fixture';

const VIS = { crowns: [0, 0, 0, 0, 0] };
const frameOf = (s: RoundState, frame = 0) => buildBattleFrame(s, VIS, ASSETS!, frame);
const A1 = [BTN.A, 0, 0, 0, 0];
const RIGHT1 = [BTN.RIGHT, 0, 0, 0, 0];
function runs<T>(xs: readonly T[]): [T, number][] {
  const out: [T, number][] = [];
  for (const v of xs) { if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++; else out.push([v, 1]); }
  return out;
}
const sha = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const p1Obj = (oam: ObjEntry[]) => oam.find(e => e.size === 32 && e.pal === PLAYER_OBJ_PAL[0]) ?? null;
function gIndex(char: number): (e: ObjEntry | null) => number | null {
  const byHash = new Map<string, number>();
  for (let g = 63; g >= 0; g--) byHash.set(sha(ASSETS!.character(char).frame(g)), g);
  return e => (e && 'px' in e.src ? byHash.get(sha(e.src.px)) ?? -1 : null);
}

describe.skipIf(!ASSETS)('partida real com a ROM (§11, aceite 7)', () => {
  it('bomba 18, 12, 16, 16, 20, 12, 16; chama A2 B2 C2 … A1; soft (4,1) queima 6 × 4', () => {
    const s = newRound(1);
    toPlay(s);
    stepN(s, 1, A1);
    expect(s.grid[1 * 17 + 2]).toBe(0xc900);
    const center: number[] = [];
    const soft: number[] = [];
    for (let i = 0; i < 170; i++) {
      const m = frameOf(s).bg2!.map;
      center.push(m[1 * 32 + 2]);
      soft.push(m[1 * 32 + 4]);
      stepN(s, 1);
    }
    expect(runs(center).slice(0, 7)).toEqual([[0x0b00, 18], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16], [0x0b00, 20], [0x0b02, 12], [0x0b04, 16]]);
    const f = center.indexOf(0x0f6c);
    expect(f).toBeGreaterThan(100);
    expect(runs(center.slice(f, f + 25))).toEqual([[0x0f6c, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2],
      [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0f6c, 1]]);
    expect(center[f + 25]).toBe(ASSETS!.arena(1).floor[1 * 32 + 2]);
    const b = soft.indexOf(0x0c20);
    expect(runs(soft.slice(b, b + 24))).toEqual([0x0c20, 0x0c22, 0x0c24, 0x0c26, 0x0c28, 0x0c2a].map(w => [w, 4]));
    const after = soft[b + 24];
    expect(after === ASSETS!.arena(1).floor[1 * 32 + 4] || (after & 0xff00) === 0x1200).toBe(true);
  });

  it('andar → (fase 5): g4:12 g3:8 g5:12 g3:8 em (X − 16, Y − 24)', () => {
    const s = newRound(5);
    toPlay(s);
    const g = gIndex(s.players[0].char);
    const seq: (number | null)[] = [];
    for (let i = 0; i < 60; i++) {
      stepN(s, 1, RIGHT1);
      const e = p1Obj(frameOf(s).oam);
      const p = s.players[0];
      expect([e!.x, e!.y]).toEqual([px(p.x) - 16, px(p.y) - 24]);
      if (p.act === 'walk') seq.push(g(e));
    }
    expect(runs(seq.slice(0, 40))).toEqual([[4, 12], [3, 8], [5, 12], [3, 8]]);
  });

  it('morte: g24:5 g25:5 g26:6 g27:6 e some', () => {
    const s = newRound(1);
    toPlay(s);
    stepN(s, 1, A1);
    for (let i = 0; i < 200 && s.players[0].act !== 'dying'; i++) stepN(s, 1);
    expect(s.players[0].act).toBe('dying');
    const g = gIndex(s.players[0].char);
    const seq: (number | null)[] = [];
    for (let i = 0; i < 30; i++) { seq.push(g(p1Obj(frameOf(s).oam))); stepN(s, 1); }
    expect(runs(seq)).toEqual([[24, 5], [25, 5], [26, 6], [27, 6], [null, 8]]);
  });

  it('ordem de desenho no início da fase 5: P2, P4, P5, P1, P3 (maior Y na frente; empate = slot menor)', () => {
    const s = newRound(5);
    toPlay(s);
    const slots = frameOf(s).oam.filter(e => e.size === 32).map(e => PLAYER_OBJ_PAL.indexOf(e.pal as 0));
    expect(slots).toEqual([1, 3, 4, 0, 2]);
  });

  it('HUD: dígitos seguem o relógio; rostos vêm do personagem de cada slot', () => {
    const s = newRound(1);
    const digit = (w: number) => { const t = (w & 0x3ff) - 0x200; return t === 0x39 ? 0 : t - 0x2f; };
    for (let i = 0; i < 20; i++) {
      const m = frameOf(s).bg1!.map;
      const row = 28 * 32;
      const shown = `${digit(m[row + 4])}:${digit(m[row + 6])}${digit(m[row + 7])}`;
      expect(shown).toBe(`${Math.floor(s.clock.sec / 60)}:${String(s.clock.sec % 60).padStart(2, '0')}`);
      stepN(s, 1);
    }
    const tiles = frameOf(s).bg1!.tiles.px;
    for (let slot = 0; slot < 5; slot++) {
      const head = headTiles(ASSETS!.character(s.players[slot].char), slot)[0];
      expect(Array.from(tiles.subarray((0x201 + 2 * slot) * 64, (0x202 + 2 * slot) * 64))).toEqual(Array.from(head));
    }
  });

  it('bomba em movimento: anim $D8:D3A8 = peça 16×16 em (−8, −8), tile $80', () => {
    const p = ASSETS!.anim(0xd8d3a8)[0].pieces[0];
    expect([p.dx, p.dy, p.tile, p.big]).toEqual([-8, -8, 0x80, false]);
  });

  it('color math da arena 6 não mistura os jogadores (só BG1)', () => {
    const s = newRound(6);
    toPlay(s);
    const f = frameOf(s);
    const img = blankImage();
    renderPpu(f, img);
    const e = p1Obj(f.oam)!;
    const src = (e.src as { px: Uint8Array }).px;
    const c8 = (c: number) => (c << 3) | (c >> 2);
    let total = 0;
    let exact = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = src[y * 32 + (e.hflip ? 31 - x : x)];
      const sx = e.x + x, sy = e.y + y;
      if (!i || sx < 0 || sx > 255 || sy < 24 || sy > 223) continue;
      const c = f.cgram[128 + 16 * e.pal + i];
      const o = (sy * 256 + sx) * 4;
      total++;
      if (img.data[o] === c8(c & 31) && img.data[o + 1] === c8((c >> 5) & 31) && img.data[o + 2] === c8((c >> 10) & 31)) exact++;
    }
    expect(total).toBeGreaterThan(100);
    expect(exact / total).toBeGreaterThan(0.9);
  });

  it('desempenho: montar + renderPpu abaixo de 8 ms por quadro (Node)', () => {
    const s = newRound(2);
    toPlay(s);
    const img = blankImage();
    renderPpu(frameOf(s), img);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) { stepN(s, 1, NO_INPUT); renderPpu(frameOf(s, i), img); }
    expect((performance.now() - t0) / 60).toBeLessThan(8);
  });
});
```

- [ ] **Step 3: Screenshots** `web/tests/render-rom/shots.test.ts` (só com `SHOTS=1` e a ROM; as imagens ficam fora do repositório):

```ts
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { renderPpu } from '../../src/render/ppu';
import { blankImage } from './fakes';
import { ASSETS } from './rom-fixture';
import { BTN, newRound, stepN, toPlay } from './core-fixture';
import { encodePng } from './png';

const OUT = process.env.SHOTS_DIR ?? join(tmpdir(), 'crown-blast-shots');

describe.skipIf(!ASSETS || !process.env.SHOTS)('screenshots das 10 arenas com a ROM (§11, aceite 7)', () => {
  it('3 imagens por arena: início, bomba acesa com jogadores andando, explosão', () => {
    mkdirSync(OUT, { recursive: true });
    const img = blankImage();
    for (let stage = 1; stage <= 10; stage++) {
      const s = newRound(stage);
      toPlay(s);
      const shot = (name: string, frame: number) => {
        renderPpu(buildBattleFrame(s, { crowns: [0, 1, 2, 0, 3] }, ASSETS!, frame), img);
        writeFileSync(join(OUT, `arena-${String(stage).padStart(2, '0')}-${name}.png`), encodePng(256, 224, img.data));
      };
      shot('inicio', 0);
      stepN(s, 1, [BTN.A, 0, 0, 0, 0]);
      stepN(s, 40, [BTN.DOWN, BTN.LEFT, BTN.DOWN, BTN.UP, BTN.RIGHT]);
      shot('bomba', 41);
      stepN(s, 90, [0, BTN.LEFT, 0, BTN.UP, 0]);
      shot('explosao', 131);
    }
    expect(readdirSync(OUT).filter(f => /^arena-\d\d-/.test(f)).length).toBeGreaterThanOrEqual(30);
  });
});
```

- [ ] **Step 4: Rodar.**

Run: `cd web && npx vitest run tests/render-rom/png.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/e2e.test.ts`
Expected: PASS. Falhas prováveis e onde olhar: sequência da bomba → `born`/D7 no adaptador; andar/morte → `actT0` do núcleo ou `resolveAnim`; ordem → `sortY` em `sprites.ts`; color math → PPU (T1, registrar); desempenho → cache de `sceneryTiles` e `renderPpu`.

- [ ] **Step 5: Gerar e revisar os screenshots.**

Run: `cd web && SHOTS=1 SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/shots.test.ts && ls "${SHOTS_DIR:-$TMPDIR/crown-blast-shots}"`
Expected: 30 PNGs `arena-01-inicio.png` … `arena-10-explosao.png`. Abrir e comparar com `analise/arenas/*.png` e `analise/extraido/arenas-cenario/render/arena_NN_rom.png`: cenário, HUD (3:00 → relógio, rostos, coroas 0/1/2/0/3), jogadores 32×32 com as 5 cores, bomba pulsando, chama em cruz, blocos queimando. Anotar diferenças na seção de resultado.

- [ ] **Step 6: Suíte completa.**

Run: `cd web && npx vitest run && npx tsc --noEmit && npm run build && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom`
Expected: tudo verde; sem a ROM os testes de ROM aparecem como *skipped*.

- [ ] **Step 7: Commit**

```bash
git add web/tests/render-rom
git commit -m "$(cat <<'MSG'
test(render): partida real com a ROM de ponta a ponta e screenshots das 10 arenas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
## Aceite do plano

Critérios da spec §11 (plano 7) e onde cada um é provado:

| Critério | Teste | Comando |
|---|---|---|
| Com ROM, a 1ª imagem de cada arena (sem sprites) bate com o golden do plano 5 | `battle.test.ts` → "1ª imagem de cada arena" (as 10 arenas + arena 2 com HOFS `$18`) | `cd web && SB4_ROM="…/Super Bomberman 4 (USA).sfc" npx vitest run tests/render-rom/battle.test.ts` |
| Palavras da bomba (18, 12, 16, 16, 20, 12, 16, …) | `field.test.ts` (sequências) e `e2e.test.ts` (núcleo real) | `npx vitest run tests/render-rom/field.test.ts` e o de ROM |
| Fases da chama (A2…A1) | `field.test.ts`, `e2e.test.ts` | idem |
| Queima (6 × 4), item atingido (5 × 4) | `field.test.ts`, `e2e.test.ts` (soft em (4,1)) | idem |
| Pisca (4/4) | `scenery.test.ts` (cor 79), `battle.test.ts` (CGRAM pelo `frame`) | `npx vitest run tests/render-rom/scenery.test.ts tests/render-rom/battle.test.ts` |
| Sombra e queda da pressão | `sprites.test.ts` (efeitos e OAM), `adapt.test.ts` (cauda de 2 ticks) | `npx vitest run tests/render-rom/sprites.test.ts tests/render-rom/adapt.test.ts` |
| Quadro de cada `act` × direção = tabela da §7.4 | `player-anim.test.ts` (endereços, 1º quadro e sequências, com ROM), `sprites.test.ts`, `e2e.test.ts` (andar e morte no núcleo real) | `SB4_ROM=… npx vitest run tests/render-rom/player-anim.test.ts tests/render-rom/e2e.test.ts` |
| Ordem de desenho por Y | `builder.test.ts` (medição da ANI §1.4), `e2e.test.ts` (fase 5) | `npx vitest run tests/render-rom/builder.test.ts` |
| Dígitos, rostos e coroas do HUD | `hud.test.ts`, `battle.test.ts`, `e2e.test.ts` | `npx vitest run tests/render-rom/hud.test.ts` |
| Screenshots das 10 arenas | `shots.test.ts` (30 PNGs fora do repositório, revisão visual) | `cd web && SHOTS=1 SB4_ROM=… npx vitest run tests/render-rom/shots.test.ts` |
| Geral | `npx vitest run` e `npm run build` verdes; `tsc` limpo; sem ROM os testes de ROM ficam *skipped* | `cd web && npx vitest run && npx tsc --noEmit && npm run build` |

## Riscos

1. **Planos 5 e 6 escritos em paralelo.** Este plano segue o texto deles; se a execução mudou algo, a T1 pega. Cada formato tem um único ponto de adaptação (`adapt.ts`, `normTileCmds`, `normPalAnims`, `headTiles`, `loadGolden`, `rom-fixture.ts`, `core-fixture.ts`, constantes `*_VOFS`).
2. **PPU e color math.** A ROM aplica o *color math* só ao BG1 (CGADSUB `$41`/`$01`); a PPU do plano 5 faz isso por padrão (`mathLayers` = BG1). O teste "color math da arena 6" confirma que os jogadores não ficam translúcidos. Se falhar, a correção é em `render/ppu/` (do plano 5), com acordo no PR.
3. **Duração visível da bomba (D7).** A ANI mediu 124 ticks de tile antes da chama contra 127 do pavio; a regra adotada dá o tile desde o tick da colocação. Se o jogo mostra piso nos primeiros 3 ticks, o teste de ponta a ponta continua verde (só olha as 7 primeiras corridas), mas o visual difere em 3 ticks. Conferir com `bomb_seq.py` e ajustar `BOMB_SHIFT`/idade.
4. **Pressão (D11, A11).** A ANI viu o tile `082E` em t0+37 e o núcleo pousa em t0+36+2·lin (lin 1 = t0+38). O visual segue o lógico. O `sortY` da sombra e do bloco (centro da casa) é 🟡.
5. **Rostos do HUD.** O plano 5 (D3) lê o rosto pela entrada `(6 + c)·5 + slot` de `$C4:617F`, conferida só com o personagem c no slot c; com c ≠ slot é 🟡 (R3 dele). Se a ordem dos 6 tiles não for TL, TR, ML, MR, BL, BR, o teste de ROM passa mas o rosto sai embaralhado: revisar nos screenshots (a T10 usa personagens 0..4 nos slots 0..4).
6. **Itens voando (D12)** usam o tile de BG do item numa paleta OBJ livre. O gráfico original dos itens perdidos não foi documentado; comparar com um savestate de atordoamento.
7. **Camadas precisam de mais que o `RomBattleBuilder`.** Rolos da arena 8 e tiles animados por objetos exigem trocar tiles, e o contrato da §2.5 não tem isso. Se o plano 8 precisar, acrescentar `tile(index, px)` ao `FrameBuilder` com acordo no PR (o cache de `sceneryTiles` não pode ser alterado por fora).
8. **Gancho do plano 9.** `romPlayerHooks` entra no contrato na T1 deste plano ou na T1 do plano 9; na mescla, manter uma só declaração (idêntica).
9. **Desempenho.** Troca de quadro de animação de tiles copia 64 KB; `renderPpu` tem orçamento de 4 ms (plano 5). O teste de 8 ms por quadro no Node cobre montagem + rasterização.
10. **Times (D19, A1) e Bad Bomber (D20)** são provisórios; a lógica dos dois ainda é 🟡 no núcleo.

## Resultado da execução

**Concluído em 2026-09-26.** Branch `feat/p7`: 703 testes com `SB4_ROM` (2 pulados), 576 + 129 pulados sem a ROM, `tsc`
limpo, `npm run build` ok. 10 tarefas em 4 ondas, cada uma revisada; revisão final da branch (sem achados críticos ou
importantes) + uma rodada de correções (M1–M5, M7 e o aviso único), re-revisada e aprovada.

- Fidelidade: 1ª imagem das 10 arenas (+ arena 2 com HOFS $18) igual byte a byte ao golden do plano 5; partida real com a
  ROM de ponta a ponta (núcleo do plano 6) com relógio, rostos, bombas, chamas, morte e ordem de sprites conferidos contra a
  ROM; períodos da animação de tiles 176/48/36/36/48/28 presos contra a ROM.
- Desempenho medido: montagem do quadro 0,02–0,03 ms, PPU 0,5–0,63 ms por quadro.
- Screenshots das 10 arenas (início, bomba, explosão) comparados com as capturas; só na pasta de rascunho, nada versionado.

### Sincronização (Tarefa 1)

Preencher uma linha por nome ou formato que diferiu do esperado (ou "nenhuma diferença").

| Contrato | Esperado neste plano | Real (planos 5/6) | O que foi trocado |
|---|---|---|---|
| Base conferida | P5 + P6 mesclados, verde | `feat/wave2-base` 53d5ed8 (P6 antes da correção final: ocupação da bomba, piso da arena 4, clone da IA); 530 testes com ROM (455 + 76 *skipped* sem ROM), `tsc` limpo | nada |
| `rom/types.ts` (`RomAssets`, `ArenaAssets`, `CharacterAssets`, `Tiles`, `Anim`, `AnimFrame`, `Piece`, `TileAnimCmd`, `PalAnim`) | como na tabela da T1 | idênticos; `hudHead(slot)` é método com cache; `ArenaAssets.hudMap` já com `+$2200` | nada |
| `bombScript(type)` | corpo do laço | `decodeBombScript(...).frames`, já sem `FFFF`/`FFFE`; tipo fora de 0–6 lança `RangeError` | nada |
| `RomView` | `data; u8; u16; u24; p24; s8; s16; bytes` | idem (`p24` valida com `hiromOffset`) | nada |
| `createMatch` | `(rules, stage, seed?, chars?)` | `(rules, stage, seed: number \| Rng16 = BOOT_SEED, chars = [0..4])` | nada (aceita o número `0x12`) |
| `render/ppu` | `renderPpu`, `createImage`, tipos; HUD `[8, −33]`, campo `[8, −25]` | idem (o golden do plano 5 usa esses valores) | nada |
| Golden `gfx-render-bg.json` | `{arenas:[{stage, bg1Hofs, tileCopies, sha1}] × 11}` | idem, mais as chaves `origem`, `rom_sha1`, `hash` no topo | nada |
| `staticObjects` | `{off, word}[]` | idem; `off` em bytes do mapa (`applyStatic` usa `off >> 1`), como `writeStatic()` já supõe | nada |
| `battle-layers.ts` | `a: object`, `BattleObj` interface | era isso; sem `romPlayerHooks` | T1 Step 3 aplicado: `a: RomAssets`, `BattleObj = ObjEntry` (alias), `RomPlayerHook`/`romPlayerHooks` novos |
| Núcleo (`Bomb`, `Flyer`, `Falling`, `FLAME_PIECE`, `BURN`, `Player.carry`/`diseaseT`, `bad[]`, `floor[]`, `invisibleVisible`, `emptyRound`, `INTRO_TICKS`, `GRID_W/H`, `colOf`, `linOf`, `px`) | como na tabela da T1 | idênticos (`BadBomberState` tem campos extras `phase`, `live`, `readyAt`, `born`) | nada |
| Golden do plano 5 (para a T9) | — | `tests/rom/ppu-golden.test.ts` monta o BG1 com `hudWithStart(hudMap)` (de `tests/rom/helpers.ts`: relógio 3:00, ícones e rostos dos 5 slots) na linha 28 do mapa e o BG2 com `buildArena(view, stage)` + `applyStatic`; CGRAM só com `bgCgram` (OBJ zerado). Conferido com a ROM: `newRound(stage)` (semente `0x12`) dá **a mesma** grade de soft blocks que `buildArena` nas 10 arenas | nada (registrado para a T9) |

### Decisões tomadas durante a execução

- **`BuildOpts.palAnim`** (`battle.ts`): opção `false` = CGRAM sem o ciclo de paleta da arena (mantém `ar.bgCgram` cru). Motivo:
  o golden do plano 5 é um dump estático da ROM e, na arena 9, a cor 92 do dump não bate com o quadro 0 do ciclo decodificado
  (a ROM não estava exatamente no quadro 0 do ciclo no instante do dump). Sem a opção, o teste "1ª imagem = golden" da arena 9
  não teria como bater; com `palAnim: false` (só usado pelo golden), a 1ª imagem usa a CGRAM da ROM tal qual, e o jogo normal
  (`palAnim` padrão `true`) continua animando a paleta a cada quadro.
- **`field.ts`: casa dura vinda de soft limpo na carga (arena 4)** — commit `067225e`. Na arena 4 o lógico do piso nas casas
  limpas em volta dos spawns é `HARD` ($EC40), mas o ROM grava ali a palavra do **piso** no BG2 (não o soft do mapa-base).
  `cellWord` (`case CODE.HARD`) trata isso: `ar.logicBase[i] === CODE.SOFT ? floor : ar.bg2Base[i]`. Sem essa correção a 1ª
  imagem da arena 4 não batia com o golden do plano 5.
- **`RomBattleVis { crowns }`** (`battle.ts`): tipo mínimo que a tela da partida passa a `buildBattleFrame`/`drawRomBattle`
  além da `RoundState` — hoje só as coroas (`vis.crowns`, usadas pelo HUD). É o ponto de extensão para o plano 10 (a tela real
  monta esse objeto a partir do placar da partida; não existe outro campo porque nada mais no plano 7 precisou de fora da
  `RoundState`).
- **Asserção do aviso único** (fallback): o teste de `drawRomBattle` com assets que falham agora afirma
  `expect(warn).toHaveBeenCalledTimes(1)` (chamando duas vezes com a mesma ROM) e mais uma chamada com uma `RomAssets` nova
  para confirmar que o aviso volta a soar (ver M1 abaixo). Era a correção exigida pela revisão antes do commit de fechamento.

**Achados menores da revisão (M1–M8), o que foi feito nesta onda de correção:**

- **M1 (aplicado):** cada camada dos planos 8/9 (`RomBattleLayer.draw`) e cada gancho de jogador (`RomPlayerHook`, plano 9)
  agora roda dentro de um `try/catch` isolado (`battle.ts`, `sprites.ts`). Uma camada ou gancho que lança:
  - não derruba o quadro nem faz a tela alternar entre ROM e arte própria a cada quadro (só aquela camada some daquele
    quadro; a camada seguinte da lista ainda roda);
  - um jogador cujo gancho falhou cai no desenho padrão do plano 7 em vez de desaparecer da tela;
  - avisa uma vez por `(RomAssets, chave)` via `warnOnce` (`render/rom/warn.ts`, `WeakMap<RomAssets, Set<string>>`) — como a
    chave mora no próprio objeto de assets, trocar de ROM (nova instância de `RomAssets`) volta a avisar se a falha persistir,
    o que resolve o "fica silencioso depois de trocar a ROM" apontado na revisão. O quadro base (campo/HUD/jogadores, fora do
    laço de camadas/ganchos) continua propagando a exceção para `drawRomBattle`, que cai no fallback como antes.
  - Testes: `battle.test.ts` ("isolamento de falhas por camada/gancho (M1)"), `sprites.test.ts` (gancho que lança).
- **M2 (aplicado):** o teste de HUD do e2e (`e2e.test.ts`) agora chama `toPlay(s)` e roda 65 ticks em jogo, conferindo que o
  relógio realmente muda de 3:00 para 2:59 (antes os 20 passos ficavam todos na intro, com `sec` fixo em 180). A checagem dos
  rostos deixou de comparar `headTiles(...)` com ele mesmo (tautológica) e passou a usar a verdade da ROM da sonda 4 da
  revisão: `headTiles(character(0), slot)` bate, tile a tile, com `arena(1).bgTiles` nos endereços de `faceTileIds(slot)`.
- **M3 (aplicado):** `scenery.test.ts` ganhou um bloco `describe.skipIf(!ASSETS)` que prende contra a ROM real os períodos de
  176/48/36/36/48/28 (arenas 2/3/5/6/7/10) e o 1º DMA da arena 7 (`src = $E0`, `dst` em 0..1023), usando
  `normTileCmds`/`tileTimeline` pelo caminho de execução normal (não mais só com comandos sintéticos).
- **M4 (aplicado):** `drawFrame` (`sprites.ts`) agora usa `size: pc.big ? 32 : 16` (spec §7.2). Como `ch.frame(g)` sempre
  devolve a folha 32×32 (stride 32) do personagem, uma peça pequena não pode ir direto como `size: 16` (a PPU leria com
  stride 16 errado) — por isso foi preciso um recorte puro e cacheado (`smallFramePx`, `WeakMap<Uint8Array, Uint8Array>`) do
  quadrante superior-esquerdo 16×16. Testado isoladamente (stride) e por uma peça `big: false` de ponta a ponta em
  `sprites.test.ts`. Continua 🟡 se a ordem real dos quadrantes SNES para uma peça pequena não for exatamente o
  superior-esquerdo — nenhuma peça das tabelas do plano 7 é pequena hoje (sonda 1 da revisão), então não há como confirmar
  contra a ROM; registrado como pendência.
- **M5 (aplicado):** `visualTick(s)` exportado em `battle.ts` (lê `romMemo(s).freezeAll ?? s.tick`, o mesmo valor que
  `battleClock` já calcula). `RomBattleLayer.draw` e `RomPlayerHook` ganharam um 5º parâmetro `visualTick: number` (assinatura
  compatível: quem já implementava com menos parâmetros continua compilando). `buildBattleFrame` e o laço de ganchos em
  `drawPlayers` passam `clock.tick` (== `visualTick(s)` no momento da chamada). Testado em `battle.test.ts` e
  `sprites.test.ts`: uma camada/gancho vê o tick já congelado depois do TIME UP.
- **M6 (não aplicado, registrado como pendência):** a cópia BG pal 4 → OBJ pal 2 (`sceneryCgram`) acontece antes das camadas;
  se uma camada mudar cores da paleta BG 4 via `b.cgram`, os itens voando não acompanham. Só apontado pela revisão como
  registro, sem correção pedida nesta onda — mantido assim.
- **M7 (aplicado):** o teste "drawRomBattle (stub) devolve false" (`tests/rom/assets-contracts.test.ts`, do plano 5) passou a
  silenciar o `console.warn` (`vi.spyOn` + `mockImplementation`) e a documentar no próprio teste que o comportamento real é
  `{}` sem `arena()` fazendo `buildBattleFrame` lançar, caindo no fallback — sem imprimir o aviso na saída da suíte.
- **M8 (não aplicado, sem impacto medido):** alocação por quadro (`Uint16Array.from`/`Uint8Array.from` duplicados) — a sonda
  de desempenho da revisão não viu problema; deixado como está, por ser opcional e de risco baixo.

### Pendências

- **M6** — cópia BG pal 4 → OBJ pal 2 antes das camadas: se um plano futuro (8/9) mudar a paleta BG 4 por camada, os itens
  voando não acompanham na mesma passada. Sem correção nesta onda (a revisão só pediu registro).
- **M8** — alocações por quadro (`fieldWords`/`Uint16Array.from`, `scenery.ts`/`Uint8Array.from` a cada 1–2 ticks nas arenas
  2/3/5): sem impacto medido (sonda de desempenho da revisão), fica como otimização opcional.
- **M4, risco residual** — a extração do quadrante 16×16 (`smallFramePx`) assume que uma peça pequena usa o
  superior-esquerdo da folha 32×32 do personagem; não há como confirmar contra a ROM porque nenhuma peça das tabelas do
  plano 7 é pequena hoje. Se um plano futuro (8/9/10) reaproveitar `drawFrame` com uma peça `big: false` de verdade, conferir
  o recorte contra a ANI/um savestate antes de confiar no visual.
- **M1/M5 para os planos 8, 9 e 10** — os planos que registram camadas (`RomBattleLayer`) e o gancho de jogador
  (`RomPlayerHook`) devem: (a) esperar receber `visualTick` como 5º parâmetro e usá-lo em vez de amostrar `s.tick` na marra
  quando quiserem congelar no TIME UP; (b) contar que uma camada/gancho que lança não derruba o quadro nem troca para o
  fallback — só aquela camada fica ausente, com um aviso (`console.warn`) uma vez por `(RomAssets, chave)`; isso é
  transparente para quem não lança nunca, mas deve ser levado em conta ao depurar uma camada nova que "não aparece".
