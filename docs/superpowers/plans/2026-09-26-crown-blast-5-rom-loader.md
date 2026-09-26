# Crown Blast: Plano 5, Carregador da ROM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `web/src/rom/` e `web/src/render/ppu/`. O jogo passa a aceitar a ROM do usuário (validação, IndexedDB e painel de carga), a ler dela tiles, paletas, mapas, animações, telas e as fatias de áudio, e a desenhar tudo numa PPU de software (modo 1 + modo 7 mínimo). O plano também entrega os contratos que os planos 7, 10 e 11 consomem: o stub `drawRomBattle`, o `AudioSink`/`NoopSink` e o `romState`.

**Architecture:**
- **Leitura:** `RomView` (endereços HiROM) → decodificadores puros em `rom/decode/`, portados um a um dos modelos Python validados → carregadores por assunto (`assets-arena.ts`, `assets-char.ts`, `assets-scene.ts`) → `createRomAssets(bytes)`, que decodifica sob demanda e guarda em cache.
- **Entrada da ROM:** `validate.ts` (tamanho, cabeçalho, SHA-1) → `store.ts` (IndexedDB) → `state.ts` (`romState`, `onRomChange`, `openRomDialog`) → `ui.ts` (painel DOM fora do canvas, com a lógica num controlador testável sem DOM) → 1 gancho no `main.ts`.
- **Desenho:** `renderPpu(frame, ImageData)` desenha BG1/BG2/BG3 (8×8 ou 16×16, por faixa de linhas), OBJ (tile ou pixels prontos), prioridades do modo 1 com BG3 alto, *color math* por faixa e modo 7 mínimo. Tudo em BGR555 até o fim e sem DOM, então roda no Node.
- **Fidelidade:** os goldens vêm de *fixtures* com números e SHA-1 gerados pelos modelos Python das frentes (`decomp.py`, `arena_rom.py`, `render_rom.py`, `anims.py`, `catalogo.json`). Esses modelos já batem com o emulador. Os scripts geradores ficam em `web/scripts/rom-facts/gfx-*` e conferem as partes novas contra as capturas de VRAM do emulador.

**Tech Stack:** TypeScript 7 (`tsc --noEmit`), Vite 8, Vitest 5, Node 24. Os scripts `.ts` rodam direto com `node`, que remove os tipos sozinho. Python do venv das frentes (com Pillow) para os fixtures. `fake-indexeddb` e `@types/node` entram como devDependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md`: §1 (decisões 2 e 7, convenções §1.3, conflito C1), §2.1, §2.3, §2.4, §2.5 (stub `render/rom/battle.ts`, `audio/sink.ts`), §7 (camadas e HUD, para o golden de render), §10, §11 (linha 5 e aceite). Fontes: [GFX] `analise/investigacao/graficos-formato/RELATORIO.md` + `catalogo.json` [CAT] + `decomp.py`, `validate_decomp.py`, `validate_extra.py`, `loader_test.py`; [ANI] `analise/investigacao/animacoes-sprites/RELATORIO.md` + `anims.py`, `dump_json.py`; [ARN] `analise/investigacao/arenas-cenario/RELATORIO.md` + `arena_rom.py`, `render_rom.py`; [AUD] §1.1 (fatias do áudio).

> **Código conferido.** Todo o código de produção e de teste deste plano foi escrito e rodado pelo autor do plano numa cópia do `web/`, contra a ROM real. Resultado: 135 testes novos verdes com `SB4_ROM` (72 sem ela, 63 pulados), `tsc` limpo e `npm run build` ok. Os 11 renders de arena batem **byte a byte** com o `render_rom.py`, e a mediana do `renderPpu` de uma arena é de ~0,6 ms. Copie os blocos **exatamente**. Os fixtures JSON **não** estão no plano: cada tarefa de fixture os gera rodando o script.

## Global Constraints

- Worktree `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity`, branch `feat/fidelity`, código em `web/`. Antes de começar: 238 testes verdes (`cd web && npx vitest run`) e `npx tsc --noEmit` limpo. **Cada tarefa termina com `npx vitest run` e `npx tsc --noEmit` verdes, com e sem `SB4_ROM`.**
- ROM local: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"` (SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`). Os testes que precisam dela usam `describe.skipIf(!ROM)` com o `ROM` de `tests/rom/helpers.ts`. **Nunca versionar bytes da ROM, imagens extraídas, áudio nem textos da ROM.** Os fixtures só têm números, endereços e SHA-1.
- Python dos fixtures: `PY="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/venv/bin/python"`. Os scripts importam os modelos de `$SB4_ANALISE/investigacao/...`, e o padrão de `SB4_ANALISE` é `/Users/dlotuz/Projetos Claude/Bomber Project/analise` (o projeto principal). Esse caminho vale porque lá estão a ROM que `rom.py`/`ac.py`/`st.py` abrem por caminho fixo e as capturas do emulador em `analise/extraido/` (fora do git). As pastas `investigacao/` do projeto principal e da worktree são idênticas.
- Os scripts `.ts` de `scripts/rom-facts/` rodam com `node` 24: só sintaxe apagável (sem `enum`, sem *parameter properties*) e nenhum import de `src/`.
- **Posse (spec §11, linha 5):** `web/src/rom/**`, `web/src/render/ppu/**`, `web/src/render/rom/battle.ts` (stub), `web/src/audio/sink.ts`, `web/scripts/rom-facts/gfx-*`, `web/tests/rom/{helpers,validate,decode,assets,ppu}*`, `web/tests/fixtures/rom/gfx-*.json` e 1 gancho em `web/src/main.ts`. Fora da lista, e combinado aqui (ver D9): `web/package.json`/`package-lock.json` (2 devDependencies) e a linha `types` do `web/tsconfig.json`. O plano 6 (T2) mexe nas mesmas linhas; no merge, fique com a **união**: uma linha `@types/node`, a linha `fake-indexeddb` e `"types": ["vitest/globals", "node"]`.
- Nomes e tipos seguem a §2.3–2.5 da spec, com as extensões e decisões D1–D12 abaixo. **As interfaces de `rom/types.ts`, `render/ppu/types.ts`, `audio/sink.ts` e `render/rom/battle.ts` são contrato dos planos 7, 10 e 11.** Depois da onda 1, só mudam com acordo registrado no PR.
- Commits em PT-BR no estilo `feat(rom): ...`, um por tarefa, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Comentários de código e textos visíveis em PT-BR.

## Decisões sobre lacunas da spec

| # | Lacuna | Decisão |
|---|---|---|
| D1 | Semântica de `hofs`/`vofs` e do `y` do OBJ | `BgLayer.hofs/vofs` e o scroll das faixas são **os valores dos registradores** (os da spec: HUD `[8, −33]`, campo `[8, −25]`). A linha `y` da imagem mostra a linha `y + vofs + 1` do BG, porque o SNES começa a exibir na linha 1. `ObjEntry.y` é a linha da imagem onde o sprite começa (o valor da OAM). O modo 7 não soma o +1. Conferido: com isso, o render bate com o `render_rom.py` |
| D2 | *Color math*: quais camadas entram e o que acontece com sub transparente | `ScanBand.mathLayers?` é uma **extensão opcional**: máscara das camadas da tela principal que recebem a mistura, com fundo = 32. O padrão é `1`, só o BG1, que é o CGADSUB `$41`/`$01` das arenas 2, 6 e 10. OBJ só mistura com paleta 4–7, como no SNES. Com o pixel da sub transparente, a PPU usa a cor fixa 0 e o `half` **não** divide, então o pixel fica igual |
| D3 | `CharacterAssets.hudHead` | Vira **`hudHead(slot): Tiles`**, porque o rosto muda com o slot (as cores estão no próprio tile, pal. BG 1). O código foi lido na ROM (`$C4:60D2`). O buffer `$7F:208C` recebe os 5 blocos ZTE de `$C4:6170` em `$1000·i`. A entrada `e = $4A·5 + slot` lê a origem `u16($C4:617F + 2e)` em 3 linhas de 64 B, com as linhas a cada `$200`. O destino é a palavra `$2000 + u16($C4:61F7 + 2·slot)`, ou seja, os tiles `$201+2·slot`, `+1`, `+$10`, `+$11`, `+$20` e `+$21`. Nas capturas das arenas 1, 2 e 5 (personagem c no slot c, c = 0..4), a entrada é `$4A = 6 + c`, e o fixture confere isso. Com c ≠ slot o valor é 🟡 (R3) |
| D4 | Conteúdo de `ArenaAssets.bgTiles` | Os 32 KB depois de `compositeFloor`, `arena9Post` (arena 9) e da cópia dos tiles 46/47 e 62/63 de `$C5:FE5C`, que o jogo faz na carga em todas as arenas. A cópia foi conferida nas 10 capturas: é o bloco de pressão `082E`, e esses tiles não aparecem no quadro inicial. `arenaTileBytes(rom, n, upload)` dá o envio puro (golden "11 envios") |
| D5 | `objCommon` e a arena 3 | OBJ `$6000–$7FFF` (512 tiles). ZTE `$C8:FD36→$6800`, `$D1:87CE→$7000`, `$D1:8F93→$7400`, `$D1:967F→$7800`, `$C5:013B→$7C00`. De `$C7:FEA1`, os bytes 0–127 vão para `$64C0` e os bytes 512–639 para `$65C0`. Na arena 3, os **tiles 0–5 e 16–21** de `$C8:FA44` cobrem `$7C00`, porque o jogo não sobrepõe o bloco inteiro. As vagas 32×32 dos jogadores ficam zeradas. Conferido contra as capturas das arenas 1 e 3 |
| D6 | Formas de `TileAnimCmd` e `PalAnim` (a spec só dá o nome) | `{kind:'dma'; vram; src} \| {kind:'wait'; frames} \| {kind:'loop'} \| {kind:'end'}` e `{first; frames; period}`, iguais ao que o plano 7 espera. `palAnim` vem de uma tabela de fatos: arena 9 com `$D7:DDDC` × 6, 14 ticks; arena 10 com `$D7:E47C` × 4, 15 ticks; `first = 80` (pal. 5). O item piscando (cor 79) e o fundo da arena 8 ficam com os planos 7 e 8 |
| D7 | Golden de render | O golden cobre as **10 arenas**, mais a arena 2 com HOFS `$18`. É paridade com o `render_rom.py`, que por sua vez bate com o emulador nas arenas 1, 2, 4, 6 e 7 (ARN §6). O fixture `gfx-render-bg.json` guarda `{arenas:[{stage, bg1Hofs, tileCopies:[], sha1}]}`, com o SHA-1 de `ImageData.data` (RGBA), no formato que o plano 7 lê. O quadro de teste monta HUD com relógio 3:00, rostos padrão e coroas 0, como o `render_rom.hud_entries` |
| D8 | Montagem da arena para os goldens | `rom/arena-build.ts` é o porte de referência de `arena_rom.build_arena` (3×3 + remoção com o LCG, semente `$C689`) e de `render_rom.apply_static_objects` (setas da 7, pads da 8, gangorras da 9). Serve aos goldens e a ferramentas. O núcleo (plano 6) tem a sua própria montagem |
| D9 | Ferramentas de teste | `fake-indexeddb` (aceite da spec) e `@types/node` (os testes usam `node:fs`/`node:crypto`/`process`), mais `"node"` em `types`. O plano 6 faz o mesmo: no merge, união. Sem `vite-node`: `node` 24 roda os `.ts` |
| D10 | Scripts de fixture | Os fixtures saem dos modelos Python, então os geradores são `scripts/rom-facts/gfx-fixtures-*.py` (Python). O único gerador em TS é `gfx-catalog.ts`, que transcreve as telas do `catalogo.json` para `src/rom/catalog.ts` **sem as descrições**, porque elas citam textos da ROM |
| D11 | Formas não fixadas pela spec | `ValidateResult` traz também `sha1` e `mensagem`. `validateRom(bytes, {sha1?})` aceita outro SHA-1 esperado, para testar com buffer sintético. `RomView` guarda os bytes em `data`, porque `bytes()` é método, e ganha `s8`/`s16`. `ArenaAssets` ganha `record` e `removeN`. `CharacterAssets` ganha `char`. `SceneAssets` = `{id, vram, written, cgram, bgTiles, bg3Tiles, objTiles}`. `AudioRomSlices` = `{cpu, data}`, cada um com `{base, bytes}`, em intervalos meio-abertos. `bombScript(t)` lê `p24($C1:56A8 + 3t)` (tipos 0–6). `objCgram` só tem a paleta 7 (`$D7:E6DC`); as dos jogadores vêm de `character(c).palettes` |
| D12 | Painel da ROM | Abre sozinho só sem ROM guardada **e** sem `?debug`/`?quick` na URL, para não atrapalhar `npm run snap` e `?quick`. Aberto, engole as teclas, então o jogo não as vê: Enter/Espaço abrem o seletor (é gesto do usuário) e Esc = "Jogar sem a ROM". Clique ou arrasto no painel também funcionam. Gamepad não abre o seletor (spec) |

---

## Ondas e tarefas

| Onda | Tarefas (paralelas; arquivos disjuntos) | Depende de |
|---|---|---|
| **1** | T1 Contratos e `RomView` · T2 Ferramentas, validação e `helpers` · T3 Fixtures de formatos e telas · T4 Fixtures das arenas e do render · T5 Fixtures das animações e personagens | – |
| **2** | T6 Decodificadores gráficos · T7 Decodificadores de mapa, animação e scripts · T8 IndexedDB, `romState`, painel e gancho · T9 PPU de software | onda 1 |
| **3** | T10 Arenas + golden de render · T11 Personagens e rostos do HUD · T12 Catálogo, telas, Modo 7 e áudio | onda 2 |
| **4** | T13 `createRomAssets` e verificação final | onda 3 |

São 4 ondas e 13 tarefas. Caminho crítico: T1 → T9 → T10 → T13. Na onda 1, T3–T5 só rodam Python e escrevem JSON, sem tocar em TS.

## Mapa de arquivos

```
web/src/rom/
  types.ts           Tiles, Piece, AnimFrame, Anim, TileAnimCmd, PalAnim, ArenaAssets, CharacterAssets,
                     SceneId, SCENE_IDS, SceneAssets, AudioRomSlices, RomAssets                              (T1)
  view.ts            hiromOffset, hex, RomView                                                              (T1)
  assets.ts          createRomAssets (stub em T1, real em T13)                                         (T1, T13)
  validate.ts        validateRom, headerOk, stripCopierHeader, sha1Hex, mensagemDe                          (T2)
  decode/zte.ts composite.ts arena9.ts m7rle.ts palette.ts tiles.ts                                         (T6)
  decode/tilemap.ts anim.ts bombscript.ts tileanim.ts                                                       (T7)
  store.ts state.ts ui.ts                                                                                   (T8)
  assets-arena.ts arena-build.ts                                                                           (T10)
  assets-char.ts                                                                                           (T11)
  catalog.ts (GERADO) assets-scene.ts                                                                      (T12)
web/src/render/ppu/  types.ts (T1) · render.ts image.ts index.ts (T9)
web/src/render/rom/battle.ts   stub drawRomBattle → false                                                   (T1)
web/src/audio/sink.ts          AudioSink, NoopSink                                                          (T1)
web/src/main.ts                +2 linhas: import e startRomUi                                               (T8)
web/scripts/rom-facts/
  gfx-fixtures-formats.py gfx-fixtures-scenes.py (T3) · gfx-fixtures-arenas.py gfx-fixtures-render.py (T4)
  gfx-fixtures-anims.py (T5) · gfx-catalog.ts (T12)
web/tests/fixtures/rom/  gfx-formats.json gfx-scenes.json (T3) · gfx-arenas.json gfx-render-bg.json (T4) · gfx-anims.json (T5)
web/tests/rom/
  decode-view.test.ts assets-contracts.test.ts (T1) · helpers.ts validate.test.ts (T2)
  decode-gfx.test.ts decode-gfx-rom.test.ts (T6) · decode-map.test.ts decode-anim-rom.test.ts (T7)
  validate-store.test.ts assets-state.test.ts validate-ui.test.ts (T8) · ppu.test.ts (T9)
  assets-arena.test.ts ppu-golden.test.ts (T10) · assets-char.test.ts (T11) · assets-scene.test.ts (T12)
  assets.test.ts (T13)
```

Os nomes dos testes seguem os prefixos da posse (`helpers`, `validate`, `decode`, `assets`, `ppu`). Os testes sintéticos, que não usam a ROM, também ficam em `tests/rom/` e simplesmente não pulam.

---

## Onda 1

### Task 1: Contratos e `RomView`

**Possui:** `web/src/rom/types.ts`, `web/src/rom/view.ts`, `web/src/rom/assets.ts` (stub), `web/src/render/ppu/types.ts`, `web/src/render/rom/battle.ts`, `web/src/audio/sink.ts`, `web/tests/rom/decode-view.test.ts`, `web/tests/rom/assets-contracts.test.ts`.

**Files:**
- Create: os 8 arquivos acima.

**Interfaces:**
- Produces: todos os tipos de `rom/types.ts` (contrato dos planos 7, 10 e 11); `hiromOffset(a)`, `hex(a)`, `class RomView { data; u8; u16; u24; p24; s8; s16; bytes }`; `createRomAssets(bytes): RomAssets` (**stub**: `rom` real, o resto lança erro até a T13); `BgLayer`, `ScanBand`, `ObjEntry`, `Mode7Layer`, `PpuFrame`; `drawRomBattle(...) → false`; `AudioSink`, `NoopSink`.
- Consumes: `RoundState` (`src/core/types.ts`) e `ViewState` (`src/render/view.ts`), só como tipo, no stub.

- [ ] **Step 1: Escrever os testes.** `web/tests/rom/decode-view.test.ts`:

```ts
import { RomView, hiromOffset, hex } from '../../src/rom/view';

describe('RomView e endereços HiROM (spec §1.3)', () => {
  it('bancos $C0–$FF, espelhos $40–$7D e $00–$3F/$80–$BF:8000+', () => {
    expect(hiromOffset(0xc00000)).toBe(0);
    expect(hiromOffset(0xd81693)).toBe(0x181693);
    expect(hiromOffset(0xffffff)).toBe(0x3fffff);
    expect(hiromOffset(0x581693)).toBe(0x181693);
    expect(hiromOffset(0x008000)).toBe(0x008000);
    expect(hiromOffset(0x9ffffc)).toBe(0x1ffffc);
  });
  it('WRAM e registradores não são ROM', () => {
    for (const a of [0x7e0000, 0x7f8000, 0x002100, 0x807fff]) expect(() => hiromOffset(a)).toThrow(RangeError);
  });
  it('u8/u16/u24/s8/s16 little-endian; p24 exige ponteiro para a ROM', () => {
    const b = new Uint8Array(0x400000);
    b.set([0x34, 0x12, 0xc4, 0xff, 0x80, 0x00, 0x80, 0x7f], 0x100);
    const r = new RomView(b);
    expect([r.u8(0xc00100), r.u16(0xc00100), r.u24(0xc00100)]).toEqual([0x34, 0x1234, 0xc41234]);
    expect([r.s8(0xc00103), r.s16(0xc00104)]).toEqual([-1, 128]);
    expect(r.p24(0xc00100)).toBe(0xc41234);
    expect(() => r.p24(0xc00105)).toThrow(RangeError);          // $7F:8000 = WRAM
    expect(r.u24(0xc00105)).toBe(0x7f8000);
    expect([...r.bytes(0xc00100, 3)]).toEqual([0x34, 0x12, 0xc4]);
  });
  it('bytes() devolve cópia', () => {
    const b = new Uint8Array(0x400000), r = new RomView(b);
    r.bytes(0xc00000, 4)[0] = 9;
    expect(b[0]).toBe(0);
  });
  it('hex formata $BB:AAAA', () => {
    expect(hex(0xc36233)).toBe('C3:6233');
  });
});
```

`web/tests/rom/assets-contracts.test.ts`:

```ts
import { NoopSink, type AudioSink } from '../../src/audio/sink';
import { drawRomBattle } from '../../src/render/rom/battle';
import type { RomAssets } from '../../src/rom/types';

describe('contratos da onda 1 (spec §2.5)', () => {
  it('NoopSink aceita todas as chamadas em silêncio', () => {
    const s: AudioSink = new NoopSink();
    expect(() => { s.bank(0x2f); s.bank(0x30); s.music(0x14); s.sfx(0x0c); s.voice(0x0e); s.stop(); s.fade(); s.tick(); }).not.toThrow();
  });
  it('drawRomBattle (stub) devolve false', () => {
    expect(drawRomBattle({} as CanvasRenderingContext2D, {} as never, {} as never, {} as RomAssets, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `cd web && npx vitest run tests/rom` → FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar.** `web/src/rom/view.ts`:

```ts
// Leitura da ROM por endereço SNES HiROM (spec §1.3, §2.3).

/** Offset no arquivo de um endereço SNES `$BB:AAAA` (HiROM). Aceita $C0–$FF, espelhos $40–$7D e $00–$3F/$80–$BF:8000+. */
export function hiromOffset(a: number): number {
  const b = (a >>> 16) & 0xff, o = a & 0xffff;
  if (b >= 0xc0) return ((b - 0xc0) << 16) | o;
  if (b >= 0x40 && b < 0x7e) return ((b - 0x40) << 16) | o;
  if (o >= 0x8000 && (b < 0x40 || (b >= 0x80 && b < 0xc0))) return ((b & 0x3f) << 16) | o;
  throw new RangeError(`endereço fora da ROM: $${hex(a)}`);
}

export function hex(a: number): string {
  return `${((a >>> 16) & 0xff).toString(16).toUpperCase().padStart(2, '0')}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export class RomView {
  readonly data: Uint8Array;
  constructor(data: Uint8Array) { this.data = data; }
  u8(a: number): number { return this.data[hiromOffset(a)]; }
  u16(a: number): number { const o = hiromOffset(a); return this.data[o] | (this.data[o + 1] << 8); }
  u24(a: number): number { const o = hiromOffset(a); return this.data[o] | (this.data[o + 1] << 8) | (this.data[o + 2] << 16); }
  /** Ponteiro de 24 bits que precisa apontar para a ROM (senão RangeError). */
  p24(a: number): number { const v = this.u24(a); hiromOffset(v); return v; }
  s8(a: number): number { return (this.u8(a) << 24) >> 24; }
  s16(a: number): number { return (this.u16(a) << 16) >> 16; }
  /** Cópia de `n` bytes a partir de `a` (lineares no arquivo). */
  bytes(a: number, n: number): Uint8Array { const o = hiromOffset(a); return this.data.slice(o, o + n); }
}
```

`web/src/rom/types.ts`:

```ts
// Contratos do carregador da ROM (spec §2.3). Só tipos: nada aqui lê a ROM.
import type { RomView } from './view';

/** Tiles já decodificados: `count·64` índices de cor (0 = transparente), 8×8 por tile, linha a linha. */
export interface Tiles { bpp: 2 | 4; count: number; px: Uint8Array }

/** Peça de metasprite [ANI §2.2]. `tile` = índice de gráfico (bits 0–8 do atributo). */
export interface Piece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
/** Quadro de animação [ANI §2.1]. `dur` 255 = congela; `mx`/`my` = deslocamento (só visual). */
export interface AnimFrame { dur: number; mx: number; my: number; pieces: Piece[] }
export type Anim = AnimFrame[];

/** Comando do script de animação de tiles `rec+$12` [ARN §3.1]. `vram` = palavra de VRAM; `src` = endereço 24 bits no buffer `$7F:8000`. */
export type TileAnimCmd =
  | { kind: 'wait'; frames: number }
  | { kind: 'dma'; vram: number; src: number }
  | { kind: 'loop' }
  | { kind: 'end' };

/** Animação de paleta [ARN §3.2]: a partir de `first` na CGRAM, troca pelo quadro `frames[k]` a cada `period` ticks. */
export interface PalAnim { first: number; frames: Uint16Array[]; period: number }

export interface ArenaAssets {
  stage: number;                  // 1..10
  record: number;                 // endereço do registro de $22 bytes
  bgTiles: Tiles;                 // 1024 tiles depois de composite (+arena9) + tiles 46/47/62/63 de $C5:FE5C
  bgCgram: Uint16Array;           // 128 cores depois da correção $C4:4E2F
  bg1: Uint16Array; bg2Base: Uint16Array; floor: Uint16Array;   // 32×32 palavras vhopppcc cccccccc
  logicBase: Uint16Array;         // 32×32 códigos lógicos do mapa da ROM (soft em todas as casas "1")
  removeN: number;                // rec+$1E: soft blocks removidos na carga
  tileAnim: TileAnimCmd[] | null; palAnim: PalAnim[]; colorMath: 'none' | 'half' | 'add';
  hudMap: Uint16Array;            // 32×3 (mapa $D6:8EEC, tabela $D6:8F72, +$2200)
  bg3Font: Tiles; bg3Banners: Tiles;  // $D1:BC16, $D0:F57B (2bpp crus, 64 tiles cada)
  objCommon: Tiles;               // OBJ $6000–$7FFF (512 tiles) montado conforme CAT §3; vagas dos jogadores zeradas
  objCgram: Uint16Array;          // 128 cores OBJ; só a paleta 7 (112..127) = $D7:E6DC, o resto 0
}

export interface CharacterAssets {
  char: number;
  frame(g: number): Uint8Array;         // 32×32 índices; addr = p24($C2:0730+3c) + (g&3)·$80 + (g>>2)·$800, linhas a cada $200
  palettes: Uint16Array[];              // 5 × 16 cores, p24($C2:779D + 32c + 4slot)
  victoryFrame(g: number): Uint8Array;  // folha p24($C2:8EBF+3c), mesmo layout
  hudHead(slot: number): Tiles;         // 6 tiles 8×8 (2 × 3) do rosto do HUD, entrada (6+c)·5+slot de $C4:617F
}

export type SceneId = 'title' | 'vsmode' | 'ffa' | 'players' | 'rules' | 'charsel' | 'stagesel' | 'scoreboard' | 'victory' | 'draw1' | 'draw2';
export const SCENE_IDS: readonly SceneId[] = ['title', 'vsmode', 'ffa', 'players', 'rules', 'charsel', 'stagesel', 'scoreboard', 'victory', 'draw1', 'draw2'];

export interface SceneAssets {
  id: SceneId;
  vram: Uint8Array;               // 64 KB montados pelos segmentos do CAT, na ordem; o resto = 0
  written: Uint8Array;            // 64 KB: 1 onde algum segmento escreveu
  cgram: Uint16Array;             // 256 cores (16 linhas do CAT)
  bgTiles: Tiles;                 // VRAM bytes $0000–$7FFF, 4bpp (1024 tiles)
  bg3Tiles: Tiles;                // VRAM bytes $A000–$BFFF, 2bpp (512 tiles)
  objTiles: Tiles;                // VRAM bytes $C000–$FFFF, 4bpp (512 tiles)
}

/** Fatias da ROM que o áudio (plano 11) manda para o AudioWorklet [AUD §1.1]. Intervalos meio-abertos. */
export interface AudioRomSlices {
  cpu: { base: number; bytes: Uint8Array };   // [$C0:0190, $C0:07EA)
  data: { base: number; bytes: Uint8Array };  // [$D9:0000, $DE:9C94)
}

export interface RomAssets {
  rom: RomView;
  arena(stage: number): ArenaAssets;
  character(c: number): CharacterAssets;
  anim(addr: number): Anim;
  playerAnim(tab1: number, char: number, dirIdx: number): Anim;   // p24(p24(tab1+3c)+3·dirIdx) [ANI §2.6]
  bombScript(type: number): { word: number; dur: number }[];
  scene(id: SceneId): SceneAssets;
  mode7Draw(): { chr: Uint8Array; map: Uint8Array };
  audioData(): AudioRomSlices;
}
```

`web/src/rom/assets.ts` (**stub**, que a T13 substitui):

```ts
// RomAssets. STUB da onda 1: só `rom` funciona; a T13 troca este arquivo pela implementação com cache.
import type { RomAssets } from './types';
import { RomView } from './view';

export function createRomAssets(bytes: Uint8Array): RomAssets {
  const rom = new RomView(bytes);
  const todo = (): never => { throw new Error('RomAssets ainda não implementado (plano 5, tarefa 13)'); };
  return { rom, arena: todo, character: todo, anim: todo, playerAnim: todo, bombScript: todo, scene: todo, mode7Draw: todo, audioData: todo };
}
```

`web/src/render/ppu/types.ts`:

```ts
// Contratos da PPU de software (spec §2.4). Subconjunto do SNES: modo 1 (BG3 com prioridade alta) + modo 7 mínimo.
import type { Tiles } from '../../rom/types';

/** Camada de BG. `map` linear, linha a linha, `mapW` entradas por linha (altura = map.length / mapW);
 *  entradas `vhopppcc cccccccc`. `hofs`/`vofs` = valores dos registradores: a linha y da imagem mostra
 *  a linha `y + vofs + 1` do BG (o SNES começa a exibir na linha 1) e a coluna x mostra `x + hofs`. */
export interface BgLayer { map: Uint16Array; mapW: 32 | 64; tiles: Tiles; tile16: boolean; hofs: number; vofs: number }

/** Faixa de linhas [y0, y1) com registradores próprios (HDMA). Máscaras: BG1=1 BG2=2 BG3=4 OBJ=16 (fundo=32 só em mathLayers).
 *  `bg1Tile16` vale para o BG1 nesta faixa (o `tile16` do BgLayer vale para BG2/BG3). `bg1`/`bg2` = [hofs, vofs] da faixa.
 *  `mathLayers` (extensão do plano 5; padrão 1 = só BG1): camadas da tela principal que recebem o color math. */
export interface ScanBand {
  y0: number; y1: number;
  bg1Tile16: boolean; bg1?: [number, number]; bg2?: [number, number];
  main: number; sub: number; math: 'none' | 'half' | 'add'; mathLayers?: number;
}

/** Sprite. `x`, `y` = canto superior esquerdo na imagem (y = valor da OAM). `pal` 0..7 → CGRAM 128+16·pal.
 *  `src.tile` = número do tile em `objTiles` (32×32 usa as linhas n, n+16, n+32, n+48); `src.px` = size² índices prontos. */
export interface ObjEntry {
  x: number; y: number; size: 16 | 32; pal: number; prio: 0 | 1 | 2 | 3;
  hflip: boolean; vflip: boolean; src: { tile: number } | { px: Uint8Array };
}

/** Modo 7 mínimo: plano de 1024×1024 (mapa 128×128 de bytes, `chr` = 256 tiles 8×8 de 1 byte por pixel = índice da CGRAM).
 *  Matriz em 8.8 com centro (cx, cy): u = ((a·(x+hofs−cx) + b·(y+vofs−cy)) >> 8) + cx, v = ((c·(x+hofs−cx) + d·(y+vofs−cy)) >> 8) + cy.
 *  Fora do plano: 'wrap' repete; 'transparent' não desenha. Aqui y é a linha da imagem (sem o +1). */
export interface Mode7Layer {
  chr: Uint8Array; map: Uint8Array;
  a: number; b: number; c: number; d: number; cx: number; cy: number; hofs: number; vofs: number;
  outside: 'wrap' | 'transparent';
}

/** Quadro completo. `oam`: índice menor fica na frente (entre sprites). Com `mode7`, o BG1 é o plano do modo 7
 *  (ordem OBJ3 > OBJ2 > OBJ1 > BG1 > OBJ0) e BG2/BG3 são ignorados. Linhas fora das faixas = fundo. */
export interface PpuFrame {
  cgram: Uint16Array /* 256 cores BGR555 */; bg1?: BgLayer; bg2?: BgLayer; bg3?: BgLayer;
  bands: ScanBand[]; objTiles?: Tiles; oam: ObjEntry[]; mode7?: Mode7Layer; backdrop?: number /* BGR555; padrão cgram[0] */;
}
```

`web/src/render/rom/battle.ts`:

```ts
// Contrato da partida desenhada com a ROM (spec §2.5). STUB do plano 5: o plano 7 implementa.
// Devolve false = "não desenhei"; quem chama (plano 10) cai no fallback drawRound(...).
import type { RoundState } from '../../core/types';
import type { ViewState } from '../view';
import type { RomAssets } from '../../rom/types';

export function drawRomBattle(_ctx: CanvasRenderingContext2D, _round: RoundState, _vis: ViewState, _assets: RomAssets, _frame: number): boolean {
  return false;
}
```

`web/src/audio/sink.ts`:

```ts
// Contrato do som (spec §2.5). O plano 11 implementa o AudioSink real; sem ROM ou antes do gesto do usuário, NoopSink.
export interface AudioSink {
  bank(id: 0x2f | 0x30): void; music(id: number): void; sfx(id: number): void;
  voice(id: number): void; stop(): void; fade(): void; tick(): void;   // tick = 1 vez por tick de jogo (fila de SFX)
}

export class NoopSink implements AudioSink {
  bank(_id: 0x2f | 0x30): void {}
  music(_id: number): void {}
  sfx(_id: number): void {}
  voice(_id: number): void {}
  stop(): void {}
  fade(): void {}
  tick(): void {}
}
```

- [ ] **Step 4: Rodar.** `npx vitest run && npx tsc --noEmit` → tudo verde (238 + 7 novos).

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/types.ts web/src/rom/view.ts web/src/rom/assets.ts web/src/render/ppu/types.ts web/src/render/rom/battle.ts web/src/audio/sink.ts web/tests/rom/decode-view.test.ts web/tests/rom/assets-contracts.test.ts
git commit -m "feat(rom): contratos do carregador, RomView, PPU, stub da partida e AudioSink

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Ferramentas de teste, validação e `helpers`

**Possui:** `web/src/rom/validate.ts`, `web/tests/rom/helpers.ts`, `web/tests/rom/validate.test.ts`, as devDependencies `@types/node` e `fake-indexeddb` em `web/package.json`/`package-lock.json` e a linha `types` de `web/tsconfig.json` (D9).

**Files:**
- Create: `web/src/rom/validate.ts`, `web/tests/rom/helpers.ts`, `web/tests/rom/validate.test.ts`
- Modify: `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`

**Interfaces:**
- Produces: `ROM_SIZE`, `KNOWN_SHA1`, `ROM_TITLE`, `MENSAGEM_BASE`, `type RomMotivo`, `type ValidateResult`, `mensagemDe(m)`, `sha1Hex(bytes): Promise<string>`, `stripCopierHeader(b)`, `headerOk(b)`, `validateRom(input, {sha1?})`. Em `tests/rom/helpers.ts`: `ROM: Uint8Array | null` (validada), `sha1Hex(b)` (síncrono, `node:crypto`), `u16le(a)`, `fixture<T>(nome)`.

- [ ] **Step 1: Ferramentas.**
```bash
cd web && npm i -D @types/node@^24 fake-indexeddb@^6
```
Em `web/tsconfig.json`, trocar `"types": ["vitest/globals"]` por `"types": ["vitest/globals", "node"]`. Depois, `npx tsc --noEmit` continua limpo (conferido).

- [ ] **Step 2: Escrever os testes.** `web/tests/rom/helpers.ts`:

```ts
// Infra dos testes que usam a ROM (spec §10.1). Sem SB4_ROM, ROM = null e os describe.skipIf(!ROM) pulam.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRom } from '../../src/rom/validate';

async function loadAndValidate(path: string): Promise<Uint8Array> {
  const r = await validateRom(new Uint8Array(readFileSync(path)));
  if (!r.ok) throw new Error(`SB4_ROM não é a ROM suportada (${r.motivo}): ${path}`);
  return r.rom;
}
/** ROM validada (4 MiB, sem cabeçalho de copiadora) ou null sem SB4_ROM. */
export const ROM: Uint8Array | null = process.env.SB4_ROM ? await loadAndValidate(process.env.SB4_ROM) : null;

export function sha1Hex(b: Uint8Array | string): string { return createHash('sha1').update(b).digest('hex'); }
export function u16le(a: Uint16Array): Uint8Array { const o = new Uint8Array(a.length * 2); a.forEach((v, i) => { o[2 * i] = v & 0xff; o[2 * i + 1] = v >> 8; }); return o; }
const FIX = fileURLToPath(new URL('../fixtures/rom/', import.meta.url));
export function fixture<T>(name: string): T { return JSON.parse(readFileSync(FIX + name, 'utf8')) as T; }
```

`web/tests/rom/validate.test.ts`:

```ts
import { ROM } from './helpers';
import { validateRom, stripCopierHeader, headerOk, sha1Hex, mensagemDe, KNOWN_SHA1, ROM_SIZE, ROM_TITLE } from '../../src/rom/validate';

/** 4 MiB zerados com o cabeçalho interno correto em $FFC0. */
function fakeRom(): Uint8Array {
  const b = new Uint8Array(ROM_SIZE);
  for (let i = 0; i < 21; i++) b[0xffc0 + i] = ROM_TITLE.charCodeAt(i);
  b[0xffd5] = 0x31; b[0xffd7] = 0x0c;
  b[0xffdc] = 0x9f; b[0xffdd] = 0x4b; b[0xffde] = 0x60; b[0xffdf] = 0xb4;
  return b;
}

describe('validação com buffers sintéticos', () => {
  it('cabeçalho sintético é aceito pela conferência do cabeçalho', () => {
    expect(headerOk(fakeRom())).toBe(true);
  });
  it('arquivo truncado → tamanho', async () => {
    const r = await validateRom(fakeRom().subarray(0, ROM_SIZE - 1));
    expect(r).toEqual({ ok: false, motivo: 'tamanho', mensagem: mensagemDe('tamanho') });
    expect((await validateRom(new Uint8Array(0))).ok).toBe(false);
  });
  it('cabeçalho errado → cabecalho (título, mapa, tamanho, checksum)', async () => {
    for (const [o, v] of [[0xffc0, 0x41], [0xffd5, 0x21], [0xffd7, 0x0b], [0xffde, 0x61], [0xffdc, 0x00]] as const) {
      const b = fakeRom(); b[o] = v;
      expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'cabecalho' });
    }
  });
  it('hash: aceita com o SHA-1 esperado e rejeita com 1 byte alterado', async () => {
    const b = fakeRom(), h = await sha1Hex(b);
    const ok = await validateRom(b, { sha1: h });
    expect(ok.ok && ok.sha1 === h && ok.rom.length === ROM_SIZE).toBe(true);
    const c = fakeRom(); c[0x123456] ^= 1;
    expect(await validateRom(c, { sha1: h })).toMatchObject({ ok: false, motivo: 'hash' });
    expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'hash' });   // SHA-1 conhecido ≠ sintético
  });
  it('remove o cabeçalho de copiadora de 512 bytes', async () => {
    const b = fakeRom(), h = await sha1Hex(b), withHdr = new Uint8Array(ROM_SIZE + 512);
    withHdr.fill(0xaa, 0, 512); withHdr.set(b, 512);
    expect(stripCopierHeader(withHdr)).toHaveLength(ROM_SIZE);
    expect(stripCopierHeader(b)).toBe(b);
    const r = await validateRom(withHdr.buffer, { sha1: h });
    expect(r.ok).toBe(true);
  });
  it('mensagem em PT-BR', () => {
    expect(mensagemDe('hash')).toBe('Este arquivo não é a ROM suportada de Super Bomberman 4 (é outra versão; use a ROM USA com a tradução).');
  });
});

describe.skipIf(!ROM)('validação com a ROM real', () => {
  it('aceita a ROM conhecida (SHA-1 38f4…9d7b)', async () => {
    const r = await validateRom(ROM!);
    expect(r).toMatchObject({ ok: true, sha1: KNOWN_SHA1 });
  });
  it('aceita a ROM com cabeçalho de copiadora', async () => {
    const b = new Uint8Array(ROM_SIZE + 512); b.set(ROM!, 512);
    expect((await validateRom(b)).ok).toBe(true);
  });
  it('rejeita a ROM real com 1 byte alterado', async () => {
    const b = ROM!.slice(); b[0x200000] ^= 0xff;
    expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'hash' });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar.** `npx vitest run tests/rom/validate.test.ts` → FAIL (`validate.ts` não existe).

- [ ] **Step 4: Implementar** `web/src/rom/validate.ts`. Armadilha: com `@types/node`, o `crypto.subtle.digest` exige `Uint8Array<ArrayBuffer>`, daí o *cast*.

```ts
// Validação da ROM do usuário (spec §2.3).
export const ROM_SIZE = 4_194_304;
export const KNOWN_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';
export const ROM_TITLE = 'SUPER BOMBERMAN 4    ';           // 21 bytes em $FFC0
const HDR = 0xffc0;

export type RomMotivo = 'tamanho' | 'cabecalho' | 'hash';
export type ValidateResult = { ok: true; rom: Uint8Array; sha1: string } | { ok: false; motivo: RomMotivo; mensagem: string };

export const MENSAGEM_BASE = 'Este arquivo não é a ROM suportada de Super Bomberman 4';
const DETALHE: Record<RomMotivo, string> = {
  tamanho: 'o tamanho não é de 4 MB',
  cabecalho: 'o cabeçalho interno não confere',
  hash: 'é outra versão; use a ROM USA com a tradução',
};
export function mensagemDe(m: RomMotivo): string { return `${MENSAGEM_BASE} (${DETALHE[m]}).`; }

export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes as Uint8Array<ArrayBuffer>));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

/** Tira o cabeçalho de copiadora (512 bytes) quando `tamanho % $8000 == 512`. Devolve uma vista, sem copiar. */
export function stripCopierHeader(b: Uint8Array): Uint8Array {
  return b.length % 0x8000 === 512 ? b.subarray(512) : b;
}

/** Confere o cabeçalho interno HiROM: título, mapa $31, tamanho $0C, complemento $4B9F, checksum $B460. */
export function headerOk(b: Uint8Array): boolean {
  if (b.length < 0x10000) return false;
  for (let i = 0; i < 21; i++) if (b[HDR + i] !== ROM_TITLE.charCodeAt(i)) return false;
  const u16 = (o: number) => b[o] | (b[o + 1] << 8);
  return b[HDR + 0x15] === 0x31 && b[HDR + 0x17] === 0x0c && u16(HDR + 0x1c) === 0x4b9f && u16(HDR + 0x1e) === 0xb460;
}

export async function validateRom(input: Uint8Array | ArrayBuffer, opts: { sha1?: string } = {}): Promise<ValidateResult> {
  const b = stripCopierHeader(input instanceof Uint8Array ? input : new Uint8Array(input));
  const fail = (motivo: RomMotivo): ValidateResult => ({ ok: false, motivo, mensagem: mensagemDe(motivo) });
  if (b.length !== ROM_SIZE) return fail('tamanho');
  if (!headerOk(b)) return fail('cabecalho');
  const sha1 = await sha1Hex(b);
  if (sha1 !== (opts.sha1 ?? KNOWN_SHA1)) return fail('hash');
  return { ok: true, rom: b.slice(), sha1 };
}
```

- [ ] **Step 5: Rodar.** Sem ROM, `npx vitest run tests/rom/validate.test.ts` → 6 passam e 3 pulam. Com ROM, `SB4_ROM="…" npx vitest run tests/rom/validate.test.ts` → 9 passam. Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 6: Commit.**
```bash
git add web/src/rom/validate.ts web/tests/rom/helpers.ts web/tests/rom/validate.test.ts web/package.json web/package-lock.json web/tsconfig.json
git commit -m "feat(rom): validação da ROM (tamanho, cabeçalho, SHA-1) e infraestrutura dos testes com SB4_ROM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Fixtures de formatos e telas

**Possui:** `web/scripts/rom-facts/gfx-fixtures-formats.py`, `web/scripts/rom-facts/gfx-fixtures-scenes.py`, `web/tests/fixtures/rom/gfx-formats.json`, `web/tests/fixtures/rom/gfx-scenes.json`.

**Files:**
- Create: os 2 scripts; os 2 JSON são gerados por eles.

**Interfaces:**
- Produces:
  - `gfx-formats.json` = `{origem, rom_sha1, zte:[{addr, used, len, sha1}×91], m7:{pix, map, usedPix, usedMap, sha1}, arenaUploads:[{arena, upload, sha1}×11], arenaPalettes:[{arena, sha1}×10]}`
  - `gfx-scenes.json` = `{origem, rom_sha1, scenes:[{id, segments:[{vramByte, bytes, sha1}], written, vramSha1, cgramSha1, cgramLinesEqualCapture}×11]}`
  - SHA-1 de sequências de `u16` = dos bytes little-endian.
- Consumes: `graficos-formato/decomp.py` e `rom.py`; `catalogo.json`; `analise/extraido/graficos-formato/validacao_chamadas.json` (as 307 chamadas conferidas no emulador) e `cenas/*.vram|*.cgram` (capturas).

- [ ] **Step 1: Escrever** `web/scripts/rom-facts/gfx-fixtures-formats.py`:

```python
"""Gera tests/fixtures/rom/gfx-formats.json: goldens dos formatos (ZTE, Modo 7, tiles e paletas das arenas).
Fonte: graficos-formato/decomp.py (validado 307/307 no emulador). Só números e SHA-1; nenhum byte da ROM.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-formats.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
from rom import ROM, r24                                                                        # noqa: E402
from decomp import decode_zte, composite_floor, arena9_post, decode_m7rle, arena_bg_palettes    # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-formats.json')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
A = lambda s: int(s.replace('$', '').replace(':', ''), 16)

# 1) os 91 blocos ZTE distintos chamados pelo jogo nas 15 cenas (validacao_chamadas.json, todos ok=True)
calls = json.load(open(os.path.join(ANALISE, 'extraido', 'graficos-formato', 'validacao_chamadas.json')))
assert all(c['ok'] for c in calls), 'validação do emulador com falhas'
zte = []
for addr in sorted({A(c['origem']) for c in calls}):
    d, used = decode_zte(addr)
    zte.append(dict(addr=addr, used=used, len=len(d), sha1=sha(d)))
assert len(zte) == 91, len(zte)

# 2) RLE do Modo 7 do DRAW GAME
m7, up, um = decode_m7rle(0xCD9800, 0xD660D9)
assert (up, um) == (6548, 499)

# 3) 32 KB de BG por arena (11 envios: o 2º da arena 9 depois de arena9_post) e CGRAM 0–127
uploads, palettes = [], []
for k in range(1, 11):
    script = r24(r24(0xC36233 + 3 * (k - 1)))
    base = composite_floor(b''.join(decode_zte(r24(script + 3 * i))[0][:0x1000] for i in range(8)))
    uploads.append(dict(arena=k, upload=1, sha1=sha(base)))
    if k == 9: uploads.append(dict(arena=9, upload=2, sha1=sha(arena9_post(base))))
    palettes.append(dict(arena=k, sha1=sha(arena_bg_palettes(script))))

doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-formats.py (graficos-formato/decomp.py)', rom_sha1=sha(ROM),
           zte=zte, m7=dict(pix=0xCD9800, map=0xD660D9, usedPix=up, usedMap=um, sha1=sha(m7)),
           arenaUploads=uploads, arenaPalettes=palettes)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('zte', len(zte), 'uploads', len(uploads))
```

- [ ] **Step 2: Escrever** `web/scripts/rom-facts/gfx-fixtures-scenes.py`. O `assert ok == tot` confere cada byte escrito pelos segmentos contra a captura do emulador, como o `loader_test.py`:

```python
"""Gera tests/fixtures/rom/gfx-scenes.json: reconstrução de VRAM e CGRAM das 11 telas a partir de catalogo.json
(como graficos-formato/loader_test.py) com SHA-1 por segmento, da VRAM montada e da CGRAM. Confere cada segmento
contra a captura do emulador (cenas/<tela>.vram/.cgram), como o loader_test (100 %).
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-scenes.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
GF = os.path.join(ANALISE, 'investigacao', 'graficos-formato')
sys.path.insert(0, GF)
from rom import ROM, rd              # noqa: E402
from decomp import decode_zte        # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-scenes.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
A = lambda s: int(s.replace('$', '').replace(':', '').split()[0], 16)
cat = json.load(open(os.path.join(GF, 'catalogo.json')))
zc = {}
def z(a):
    if a not in zc: zc[a] = decode_zte(a)[0]
    return zc[a]
scenes = []
for tag, sc in cat['cenas'].items():
    vram = bytearray(0x10000); written = bytearray(0x10000); segs = []
    real = open(os.path.join(CEN, tag + '.vram'), 'rb').read()
    for s in sc['vram']:
        o, n = A(s['vram_byte']), s['bytes']
        if s['tipo'] == 'zte': d = z(A(s['origem']))[s['offset']:s['offset'] + n]
        elif s['tipo'] == 'raw': d = rd(A(s['origem']) + s['offset'], n)
        elif s['tipo'] == 'zero': d = bytes(n)
        else: d = bytes([s['valor']]) * n
        assert len(d) == n, (tag, s)
        for i in range(n): vram[(o + i) & 0xFFFF] = d[i]; written[(o + i) & 0xFFFF] = 1
        segs.append(dict(vramByte=o, bytes=n, sha1=sha(d)))
    ok = sum(1 for i in range(0x10000) if written[i] and vram[i] == real[i]); tot = sum(written)
    assert ok == tot, (tag, ok, tot)          # 100 % dos bytes escritos batem com a captura
    cg = b''.join(rd(A(r['rom']), 32) for r in sorted(sc['cgram'], key=lambda r: r['paleta']))
    realcg = open(os.path.join(CEN, tag + '.cgram'), 'rb').read()
    lines_ok = sum(1 for i in range(16) if cg[32 * i:32 * i + 32] == realcg[32 * i:32 * i + 32])
    scenes.append(dict(id=tag, segments=segs, written=tot, vramSha1=sha(vram), cgramSha1=sha(cg), cgramLinesEqualCapture=lines_ok))
    print(tag, len(segs), tot, 'cgram', lines_ok)
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-scenes.py (graficos-formato/catalogo.json, loader_test.py)', rom_sha1=sha(ROM), scenes=scenes)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
```

- [ ] **Step 3: Gerar.**
```bash
cd web
PY="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/venv/bin/python"
"$PY" scripts/rom-facts/gfx-fixtures-formats.py
"$PY" scripts/rom-facts/gfx-fixtures-scenes.py
```
Expected:
- 1º script: `zte 91 uploads 11`.
- 2º script, uma linha por tela `id segmentos bytes cgram 16`: `title 32 49152`, `vsmode 21 37312`, `ffa 22 37440`, `players 21 37056`, `rules 20 37120`, `charsel 25 43328`, `stagesel 25 51456`, `scoreboard 24 44544`, `victory 55 46080`, `draw1 22 6784`, `draw2 22 6784`.
- Nenhum `AssertionError`.

- [ ] **Step 4: Conferir que não há bytes da ROM.** `grep -c '"sha1"' tests/fixtures/rom/gfx-formats.json` dá 113 (91 ZTE + 1 Modo 7 + 11 envios + 10 paletas). Os campos são só números e hashes. `npx vitest run` continua verde.

- [ ] **Step 5: Commit.**
```bash
git add web/scripts/rom-facts/gfx-fixtures-formats.py web/scripts/rom-facts/gfx-fixtures-scenes.py web/tests/fixtures/rom/gfx-formats.json web/tests/fixtures/rom/gfx-scenes.json
git commit -m "test(rom): fixtures de ZTE, Modo 7, BG das arenas e telas gerados de decomp.py e catalogo.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Fixtures das arenas e do render só de BG

**Possui:** `web/scripts/rom-facts/gfx-fixtures-arenas.py`, `web/scripts/rom-facts/gfx-fixtures-render.py`, `web/tests/fixtures/rom/gfx-arenas.json`, `web/tests/fixtures/rom/gfx-render-bg.json`.

**Files:**
- Create: os 2 scripts; os 2 JSON são gerados por eles.

**Interfaces:**
- Produces:
  - `gfx-arenas.json` = `{arenas:[{arena, record, script, removeN, colorMath, tilesLoadedSha1, bg1/bg2Base/floor:{used, sha1}, logicBaseSha1, build:{seedIn, seedOut, soft, bg2Sha1, logicSha1, floorSha1}, staticBg2Sha1, tileAnim:null|{addr, count, key}}×10], hud:{baseSha1, startSha1}, fallback:{count, first, sha1}, objCommon:{"1","3"}, bg3:{fontSha1, bannersSha1}, objPal7Sha1}`. `tileAnim.key` = SHA-1 da forma canônica `w5 d3584,8364032 L`.
  - `gfx-render-bg.json` = `{arenas:[{stage, bg1Hofs, tileCopies:[], sha1}×11]}`, com o SHA-1 do RGBA 256×224 (D7).
- Consumes: `arenas-cenario/arena_rom.py`, `render_rom.py` e `ac.py`; `graficos-formato/decomp.py`; capturas `cenas/arenaNN.vram`.

- [ ] **Step 1: Escrever** `web/scripts/rom-facts/gfx-fixtures-arenas.py`. Os `assert` conferem as partes novas (D4, D5) contra as capturas de VRAM:

```python
"""Gera tests/fixtures/rom/gfx-arenas.json: goldens da montagem das 10 arenas (mapas, lógico, carga com RNG,
elementos fixos, script de tiles, HUD, OBJ comuns, BG3, paletas OBJ). Fontes: arenas-cenario/arena_rom.py e
render_rom.py (validados contra a WRAM/VRAM do emulador, ARN §2.4 e §6) e graficos-formato/decomp.py.
As partes novas (tiles 46/47/62/63 de $C5:FE5C e OBJ comuns) são conferidas aqui contra as capturas de VRAM.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-arenas.py"""
import hashlib, json, os, struct, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'arenas-cenario'))
from ac import ROM                                                                             # noqa: E402
from arena_rom import (arena_record, decode_map, map_to_entries, logic_of, build_arena, fallback_offsets,
                       decode_anim_script, p24, w16)                                           # noqa: E402
from render_rom import hud_entries, apply_static_objects                                       # noqa: E402
from decomp import decode_zte, composite_floor, arena9_post                                    # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-arenas.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
w16s = lambda ws: sha(struct.pack('<%dH' % len(ws), *ws))
COLOR_MATH = {2: 'half', 6: 'half', 10: 'add'}

def tile_anim_key(cmds):
    out = []
    for c in cmds:
        if c[0] == 'wait': out.append('w%d' % c[1])
        elif c[0] == 'dma': out.append('d%d,%d' % (c[1], c[2]))
        elif c[0] == 'loop': out.append('L')
        else: out.append('E')
    return ' '.join(out)

fe5c = decode_zte(0xC5FE5C)[0]
arenas = []
for n in range(1, 11):
    R = arena_record(n - 1)
    script = R['tiles']
    tiles = bytearray(composite_floor(b''.join(decode_zte(p24(script + 3 * i))[0][:0x1000] for i in range(8))))
    if n == 9: tiles = bytearray(arena9_post(bytes(tiles)))
    tiles[46 * 32:48 * 32] = fe5c[0:64]; tiles[62 * 32:64 * 32] = fe5c[512:576]
    vram = open(os.path.join(CEN, 'arena%02d.vram' % n), 'rb').read()
    assert vram[46 * 32:48 * 32] == fe5c[0:64] and vram[62 * 32:64 * 32] == fe5c[512:576], n
    c1, u1 = decode_map(R['bg1_map']); c2, u2 = decode_map(R['bg2_map']); cf, uf = decode_map(R['floor_map'])
    ent, logic, fent, seed = build_arena(n - 1)
    st = list(ent); apply_static_objects(n, None, st)
    cmds = decode_anim_script(R['obj12']) if R['obj12'] else None
    arenas.append(dict(
        arena=n, record=R['addr'], script=script, removeN=R['b1E'], colorMath=COLOR_MATH.get(n, 'none'),
        tilesLoadedSha1=sha(tiles),
        bg1=dict(used=u1, sha1=w16s(map_to_entries(c1, R['bg1_tbl']))),
        bg2Base=dict(used=u2, sha1=w16s(map_to_entries(c2, R['bg2_tbl']))),
        floor=dict(used=uf, sha1=w16s(map_to_entries(cf, R['bg2_tbl']))),
        logicBaseSha1=w16s([logic_of(c) for c in c2]),
        build=dict(seedIn=0xC689, seedOut=seed, soft=sum(1 for v in logic if v == 0xCC80),
                   bg2Sha1=w16s(ent), logicSha1=w16s(logic), floorSha1=w16s(fent)),
        staticBg2Sha1=w16s(st),
        tileAnim=None if cmds is None else dict(addr=R['obj12'], count=len(cmds), key=sha(tile_anim_key(cmds).encode()))))

# OBJ $6000–$7FFF comuns (16 KB), conferidos contra arena01/arena03 fora das vagas dos jogadores
def obj_common(n):
    buf = bytearray(0x4000); at = lambda w: (w - 0x6000) * 2; z = lambda a: decode_zte(a)[0]
    for a, w in ((0xC8FD36, 0x6800), (0xD187CE, 0x7000), (0xD18F93, 0x7400), (0xD1967F, 0x7800), (0xC5013B, 0x7C00)):
        buf[at(w):at(w) + 0x800] = z(a)[:0x800]
    box = z(0xC7FEA1); buf[at(0x64C0):at(0x64C0) + 128] = box[:128]; buf[at(0x65C0):at(0x65C0) + 128] = box[512:640]
    if n == 3:
        orb = z(0xC8FA44)
        for t in (0, 1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21): buf[at(0x7C00) + 32 * t:at(0x7C00) + 32 * t + 32] = orb[32 * t:32 * t + 32]
    return bytes(buf)
for n in (1, 3):
    v = open(os.path.join(CEN, 'arena%02d.vram' % n), 'rb').read()[0xC000:]
    b = obj_common(n)
    for lo, hi in ((0x0980, 0x0A00), (0x0B80, 0x0C00), (0x1000, 0x4000)): assert b[lo:hi] == v[lo:hi], (n, hex(lo))

hud = [v for v in hud_entries()[:96]]
base_hud = map_to_entries(decode_map(0xD68EEC, 96)[0], 0xD68F72); base_hud = [(v + 0x2200) & 0xFFFF for v in base_hud]
fb = fallback_offsets()
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-arenas.py (arenas-cenario/arena_rom.py, render_rom.py)', rom_sha1=sha(ROM),
           arenas=arenas,
           hud=dict(baseSha1=w16s(base_hud), startSha1=w16s(hud)),
           fallback=dict(count=len(fb), first=fb[:3], sha1=w16s(fb)),
           objCommon={'1': sha(obj_common(1)), '3': sha(obj_common(3))},
           bg3=dict(fontSha1=sha(ROM[0x11BC16:0x11BC16 + 1024]), bannersSha1=sha(ROM[0x10F57B:0x10F57B + 1024])),
           objPal7Sha1=sha(ROM[0x17E6DC:0x17E6DC + 32]))
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('ok', [(a['arena'], a['build']['soft'], hex(a['build']['seedOut'])) for a in arenas])
```

- [ ] **Step 2: Escrever** `web/scripts/rom-facts/gfx-fixtures-render.py`:

```python
"""Gera tests/fixtures/rom/gfx-render-bg.json: SHA-1 do render só de BG (render_rom.py) das 10 arenas.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-render.py
  PY = analise/extraido/cores/venv/bin/python do projeto principal (tem Pillow). Usa SB4_ANALISE (padrão abaixo)."""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'arenas-cenario'))
from render_rom import render_arena          # noqa: E402
from ac import ROM                            # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-render-bg.json')
cases = [(n, 8) for n in range(1, 11)] + [(2, 0x18)]
arenas = []
for n, hofs in cases:
    im = render_arena(n - 1, bg1_hofs=hofs)
    assert im.mode == 'RGB' and im.size == (256, 224)
    arenas.append(dict(stage=n, bg1Hofs=hofs, tileCopies=[], sha1=hashlib.sha1(im.convert('RGBA').tobytes()).hexdigest()))
    print(n, hofs, arenas[-1]['sha1'])
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-render.py (arenas-cenario/render_rom.render_arena)',
           rom_sha1=hashlib.sha1(ROM).hexdigest(), hash='SHA-1 de ImageData.data: RGBA 256x224 linha a linha, alfa 255', arenas=arenas)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
```

- [ ] **Step 3: Gerar.**
```bash
cd web
PY="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/venv/bin/python"
"$PY" scripts/rom-facts/gfx-fixtures-arenas.py
"$PY" scripts/rom-facts/gfx-fixtures-render.py
```
Expected:
- 1º script: `ok [(1, 80, '0x5191'), (2, 80, '0x5191'), (3, 80, '0x25d9'), (4, 70, '0x1fc9'), (5, 0, '0x9401'), (6, 80, '0x5191'), (7, 62, '0x1fc9'), (8, 0, '0xc689'), (9, 78, '0xe4c1'), (10, 80, '0x5191')]`. As contagens de soft são as da spec §3.3.
- 2º script: 11 linhas `arena hofs sha1`. A 1ª é `1 8 …` e a última `2 24 …`.

- [ ] **Step 4: Rodar** `npx vitest run` (inalterado) e **commit.**
```bash
git add web/scripts/rom-facts/gfx-fixtures-arenas.py web/scripts/rom-facts/gfx-fixtures-render.py web/tests/fixtures/rom/gfx-arenas.json web/tests/fixtures/rom/gfx-render-bg.json
git commit -m "test(rom): fixtures da montagem das arenas e do render só de BG (arena_rom.py, render_rom.py)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Fixtures das animações, personagens e rostos do HUD

**Possui:** `web/scripts/rom-facts/gfx-fixtures-anims.py`, `web/tests/fixtures/rom/gfx-anims.json`.

**Files:**
- Create: o script; o JSON é gerado por ele.

**Interfaces:**
- Produces: `gfx-anims.json` = `{chave, anims:{"D816AC":{frames, sha1}}×141, firstLevel:{nome:{addr, perChar[8]}}, chars:[{char, sheet, victorySheet, framesSha1, victorySha1, palettes:[{slot, addr, attr, sha1}×5]}×6], hudHeads:[{char, slot, entry, sha1}×30], bombScripts:[{type, addr, loop, frames:[[word, dur]]}×7]}`.
  - Chave canônica da animação: `dur,mx,my:dx,dy,tile,h,v,big,pal;…|…`, igual ao `animKey` da T7.
  - `framesSha1` = SHA-1 dos 64 quadros 32×32 em índices, concatenados.
  - Rostos: SHA-1 dos 6 tiles em índices, na ordem da D3.
- Consumes: `animacoes-sprites/st.py` e `anims.py`; `analise/extraido/animacoes-sprites/animacoes.json` (as 141 do `dump_json.py`); `graficos-formato/decomp.py`; capturas das arenas 1, 2 e 5.

- [ ] **Step 1: Escrever** `web/scripts/rom-facts/gfx-fixtures-anims.py`:

```python
"""Gera tests/fixtures/rom/gfx-anims.json: as 141 animações de animacoes.json (dump_json.py), tabelas de ação,
folhas, paletas, scripts de bomba, quadros dos personagens e rostos do HUD. Fonte: animacoes-sprites/anims.py
(ANI §2, §5.1, §10). Os rostos do HUD ($C4:617F/$C4:61F7) são conferidos aqui contra as capturas de VRAM.
Só números e SHA-1. Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-anims.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'animacoes-sprites'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
from st import ROM, rom as rd                              # noqa: E402
from anims import parse_anim, parse_ms, p24, char_pal      # noqa: E402
from decomp import decode_zte                              # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-anims.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
u16 = lambda a: rd(a, 2)[0] | rd(a, 2)[1] << 8
s8 = lambda v: v - 256 if v & 0x80 else v

def anim_key(a):
    frames = []
    for f in parse_anim(a):
        ex = f['extra']
        ps = ';'.join('%d,%d,%d,%d,%d,%d,%d' % (p['dx'], p['dy'], p['gfx'], p['hf'], p['vf'], p['b12'], p['pal']) for p in parse_ms(f['ms']))
        frames.append('%d,%d,%d:%s' % (f['dur'], s8(ex & 0xFF), s8(ex >> 8), ps))
    return '|'.join(frames)

J = json.load(open(os.path.join(ANALISE, 'extraido', 'animacoes-sprites', 'animacoes.json')))
anims = {}
for k, frames in J['anims'].items():
    a = int(k, 16); key = anim_key(a)
    assert len(key.split('|')) == len(frames), k
    anims[k] = dict(frames=len(frames), sha1=sha(key.encode()))
assert len(anims) == 141, len(anims)
first = {name: dict(addr=int(v['addr'], 16), perChar=[int(x, 16) for x in v['per_char']]) for name, v in J['first_level'].items()}

def decode4(b, off, n):   # tiles 4bpp planares -> índices (64 por tile)
    out = bytearray()
    for t in range(n):
        base = off + 32 * t
        for y in range(8):
            p = [b[base + 2 * y], b[base + 2 * y + 1], b[base + 16 + 2 * y], b[base + 17 + 2 * y]]
            for x in range(8):
                bit = 7 - x
                out.append(sum(((p[k] >> bit) & 1) << k for k in range(4)))
    return bytes(out)

def frame32(sheet, g):    # 32x32 índices, linha a linha
    base = sheet + (g & 3) * 0x80 + (g >> 2) * 0x800
    out = bytearray(1024)
    for r in range(4):
        idx = decode4(rd(base + r * 0x200, 128), 0, 4)
        for t in range(4):
            for y in range(8):
                for x in range(8):
                    out[(r * 8 + y) * 32 + t * 8 + x] = idx[t * 64 + y * 8 + x]
    return bytes(out)

chars = []
for c in range(6):
    sheet, vsheet = p24(0xC20730 + 3 * c), p24(0xC28EBF + 3 * c)
    chars.append(dict(char=c, sheet=sheet, victorySheet=vsheet,
                      framesSha1=sha(b''.join(frame32(sheet, g) for g in range(64))),
                      victorySha1=sha(b''.join(frame32(vsheet, g) for g in range(4))),
                      palettes=[dict(slot=s, addr=char_pal(c, s)[0], attr=char_pal(c, s)[1], sha1=sha(rd(char_pal(c, s)[0], 32))) for s in range(5)]))

# rostos do HUD: buffer $7F:208C = 5 blocos ZTE de $C4:6170 em $1000·i; entrada e = $4A·5 + slot
heads = bytearray(0x5000)
for i in range(5):
    d = decode_zte(p24(0xC46170 + 3 * i))[0][:0x1000]; heads[0x1000 * i:0x1000 * i + len(d)] = d
def head_bytes(e):
    src = u16(0xC4617F + 2 * e)
    return b''.join(bytes(heads[src + r * 0x200:src + r * 0x200 + 64]) for r in range(3))
for sc in ('arena01', 'arena02', 'arena05'):      # capturas com os personagens 0–4 em P1–P5
    v = open(os.path.join(CEN, sc + '.vram'), 'rb').read()
    for s in range(5):
        dst = 0x2000 + u16(0xC461F7 + 2 * s)
        got = b''.join(v[2 * (dst + r * 0x100):2 * (dst + r * 0x100) + 64] for r in range(3))
        assert got == head_bytes((6 + s) * 5 + s), (sc, s)
hud = [dict(char=c, slot=s, entry=(6 + c) * 5 + s, sha1=sha(decode4(head_bytes((6 + c) * 5 + s), 0, 6)))
       for c in range(6) for s in range(5)]

bombs = []
for t in range(7):
    a = p24(0xC156A8 + 3 * t); fr = []; p = a
    while u16(p) not in (0xFFFF, 0xFFFE): fr.append([u16(p), rd(p + 2, 1)[0]]); p += 3
    bombs.append(dict(type=t, addr=a, loop=u16(p) == 0xFFFF, frames=fr))

doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-anims.py (animacoes-sprites/anims.py, animacoes.json)', rom_sha1=sha(ROM),
           chave='dur,mx,my:dx,dy,tile,h,v,big,pal;...|...', anims=anims, firstLevel=first, chars=chars, hudHeads=hud, bombScripts=bombs)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('anims', len(anims), 'bombs', [(b['type'], len(b['frames'])) for b in bombs])
```

- [ ] **Step 2: Gerar.** `"$PY" scripts/rom-facts/gfx-fixtures-anims.py` (de `web/`). Expected: `anims 141 bombs [(0, 8), (1, 4), (2, 8), (3, 8), (4, 8), (5, 8), (6, 8)]`, sem `AssertionError`. O assert dos rostos confere a D3 nas 3 capturas.

- [ ] **Step 3: Commit.**
```bash
git add web/scripts/rom-facts/gfx-fixtures-anims.py web/tests/fixtures/rom/gfx-anims.json
git commit -m "test(rom): fixtures das animações, folhas, paletas, scripts de bomba e rostos do HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 2

### Task 6: Decodificadores gráficos (ZTE, composição, arena 9, Modo 7, paleta, tiles)

**Possui:** `web/src/rom/decode/{zte,composite,arena9,m7rle,palette,tiles}.ts`, `web/tests/rom/decode-gfx.test.ts`, `web/tests/rom/decode-gfx-rom.test.ts`.

**Files:**
- Create: os 6 módulos e os 2 testes.

**Interfaces:**
- Produces:
  - `decodeZte(rom: Uint8Array, addr, limit?) → {data, used}`;
  - `composite(buf, src, dst, ntiles)` e `compositeFloor(buf)`, que alteram o buffer;
  - `arena9Post(buf)`;
  - `decodeM7Rle(rom, pixAddr, mapAddr, words?) → {vram, usedPix, usedMap}`;
  - `readBgr555(bytes, o, n)`, `c5to8(c)`, `bgr555ToRgba(v)`, `bgr555ToAbgr32(v)`;
  - `decodeTiles(bytes, bpp, off?, count?) → Tiles`.
- Consumes: `hiromOffset` (T1), `Tiles` (T1), `tests/rom/helpers.ts` e `gfx-formats.json` (T2, T3).
- Modelos portados: `graficos-formato/decomp.py` (`decode_zte`, `composite`, `composite_floor`, `arena9_post`, `decode_m7rle`) e [GFX §2.5].

- [ ] **Step 1: Escrever os testes.** `web/tests/rom/decode-gfx.test.ts` (sintético):

```ts
import { decodeZte } from '../../src/rom/decode/zte';
import { composite, compositeFloor } from '../../src/rom/decode/composite';
import { arena9Post } from '../../src/rom/decode/arena9';
import { decodeM7Rle } from '../../src/rom/decode/m7rle';
import { readBgr555, c5to8, bgr555ToRgba } from '../../src/rom/decode/palette';
import { decodeTiles } from '../../src/rom/decode/tiles';

/** ROM sintética de 64 KB no banco $C0 com `bytes` a partir de $C0:1000. */
function romWith(bytes: number[]): Uint8Array { const r = new Uint8Array(0x10000); r.set(bytes, 0x1000); return r; }
const tile = (first: number) => Array.from({ length: 32 }, (_, i) => (i === 0 ? first : i));

describe('ZTE [GFX §2.1]', () => {
  it('Z = tile zerado, E = fim, outro byte = 32 bytes literais', () => {
    const r = decodeZte(romWith([0xaa, 0xbb, 0xaa, ...tile(7), 0xaa, 0xbb, 0x99]), 0xc01000);
    expect(r.used).toBe(2 + 1 + 32 + 1 + 1);
    expect(r.data).toHaveLength(96);
    expect([...r.data.subarray(0, 32)].every(v => v === 0)).toBe(true);
    expect([...r.data.subarray(32, 64)]).toEqual(tile(7));
    expect([...r.data.subarray(64)].every(v => v === 0)).toBe(true);
  });
  it('Z é testado antes de E (Z == E: só zeros até estourar o limite)', () => {
    expect(() => decodeZte(romWith([0x11, 0x11, 0x11]), 0xc01000, 64)).toThrow(RangeError);
  });
  it('bloco vazio', () => {
    expect(decodeZte(romWith([1, 2, 2]), 0xc01000)).toEqual({ data: new Uint8Array(0), used: 3 });
  });
});

describe('composição do piso [GFX §2.2]', () => {
  it('só os pixels de cor 0 do destino recebem o pixel da origem', () => {
    const buf = new Uint8Array(0x8000);
    buf.fill(0xff, 0x100, 0x120);                 // tile 8 (piso): cor 15 em tudo
    buf[0x6000] = 0xf0;                            // tile 768, linha 0: pixels 0–3 com cor 1 (plano 0)
    compositeFloor(buf);
    expect(buf[0x6000]).toBe(0xf0 | 0x0f);        // plano 0: 4 pixels próprios + 4 do piso
    expect(buf[0x6001]).toBe(0x0f);               // planos 1–3 só nos pixels que eram 0
    expect(buf[0x6010]).toBe(0x0f);
    expect(buf[0x6011]).toBe(0x0f);
    expect(buf[0x6002]).toBe(0xff);               // linha 1 inteira do piso
  });
  it('n usa o bloco 16×16 de origem: (n&1) + 16·((n>>4)&1)', () => {
    const buf = new Uint8Array(0x10000);
    for (const [k, v] of [[0, 1], [1, 2], [16, 3], [17, 4]]) buf[0x1000 + 32 * k] = v;
    composite(buf, 0x1000, 0x8000, 32);
    expect([0, 1, 16, 17, 2, 18].map(n => buf[0x8000 + 32 * n])).toEqual([1, 2, 3, 4, 1, 3]);
  });
});

describe('arena 9 [GFX §2.3]', () => {
  it('cópias antes das composições', () => {
    const buf = new Uint8Array(0x8000);
    buf[0x2000] = 0x11; buf[0x3800] = 0x22; buf[0x3fff] = 0x33;
    arena9Post(buf);
    expect(buf[0x2c00]).toBe(0x11);
    expect(buf[0x2400]).toBe(0x22);
    expect(buf[0x3000]).toBe(0x22);
    expect(buf[0x2bff]).toBe(0x33);
  });
});

describe('RLE do Modo 7 [GFX §2.4]', () => {
  it('pixels: <$80 literal, ≥$80 repete; mapa: $01 N v repete, senão literal', () => {
    const r = new Uint8Array(0x10000);
    r.set([0x05, 0x83, 0x03, 0x06], 0x1000);      // pixels: 5, 3,3,3, 6
    r.set([0x09, 0x01, 0x03, 0x42, 0x07], 0x2000); // mapa: 9, 42,42,42, 7
    const m = decodeM7Rle(r, 0xc01000, 0xc02000, 5);
    expect([...m.vram]).toEqual([0x09, 5, 0x42, 3, 0x42, 3, 0x42, 3, 0x07, 6]);
    expect([m.usedPix, m.usedMap]).toEqual([4, 5]);
  });
});

describe('paleta e tiles [GFX §2.5]', () => {
  it('BGR555 → 8 bits por canal (c<<3 | c>>2)', () => {
    expect(readBgr555(new Uint8Array([0x1f, 0x7c]), 0, 1)[0]).toBe(0x7c1f);
    expect([c5to8(0), c5to8(1), c5to8(31)]).toEqual([0, 8, 255]);
    expect(bgr555ToRgba(0x7c1f)).toEqual([255, 0, 255, 255]);
    expect(bgr555ToRgba(0x03e0)).toEqual([0, 255, 0, 255]);
  });
  it('4bpp planar: bit 7−x de t[2y], t[2y+1], t[16+2y], t[17+2y]', () => {
    const t = new Uint8Array(32);
    t[0] = 0x80; t[1] = 0x80; t[16] = 0x80; t[17] = 0x80;   // (0,0) = 15
    t[2] = 0x01;                                             // (7,1) = 1
    t[31] = 0x40;                                            // (1,7) = 8
    const d = decodeTiles(t, 4);
    expect([d.count, d.px[0], d.px[1 * 8 + 7], d.px[7 * 8 + 1], d.px[1]]).toEqual([1, 15, 1, 8, 0]);
  });
  it('2bpp planar: t[2y], t[2y+1]; 16 bytes por tile', () => {
    const t = new Uint8Array(32); t[0] = 0x80; t[1] = 0x40; t[16 + 15] = 0x01;
    const d = decodeTiles(t, 2);
    expect([d.count, d.px[0], d.px[1], d.px[64 + 7 * 8 + 7]]).toEqual([2, 1, 2, 2]);
  });
  it('offset e quantidade explícitos; bytes além do fim contam como 0', () => {
    const d = decodeTiles(new Uint8Array(40).fill(0xff), 4, 32, 2);
    expect([d.count, d.px[0], d.px[64]]).toEqual([2, 3, 0]);   // só os planos 0–1 existem (bytes 32–39)
  });
});
```

`web/tests/rom/decode-gfx-rom.test.ts` (golden com a ROM):

```ts
import { ROM, fixture, sha1Hex } from './helpers';
import { decodeZte } from '../../src/rom/decode/zte';
import { decodeM7Rle } from '../../src/rom/decode/m7rle';

interface Formats {
  zte: { addr: number; used: number; len: number; sha1: string }[];
  m7: { pix: number; map: number; usedPix: number; usedMap: number; sha1: string };
}

describe.skipIf(!ROM)('goldens de ZTE e Modo 7 (gfx-formats.json)', () => {
  const fx = fixture<Formats>('gfx-formats.json');
  it('ZTE: os 91 blocos distintos batem (tamanho comprimido, tamanho e SHA-1)', () => {
    expect(fx.zte).toHaveLength(91);
    for (const b of fx.zte) {
      const r = decodeZte(ROM!, b.addr);
      expect({ addr: b.addr, used: r.used, len: r.data.length, sha1: sha1Hex(r.data) }).toEqual(b);
    }
  });
  it('Modo 7 do DRAW GAME: 32 KB, consumo 6548 / 499', () => {
    const r = decodeM7Rle(ROM!, fx.m7.pix, fx.m7.map);
    expect([r.usedPix, r.usedMap]).toEqual([6548, 499]);
    expect(sha1Hex(r.vram)).toBe(fx.m7.sha1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/rom/decode-gfx` → FAIL.

- [ ] **Step 3: Implementar.** Armadilhas:
  - no ZTE, `Z` é testado **antes** de `E`;
  - no Modo 7, cada fluxo tem o próprio contador, e `N` repete `N` vezes no total (`cp = N − 1`);
  - `arena9Post` faz as 3 cópias **antes** das 2 composições.

`web/src/rom/decode/zte.ts`:

```ts
// ZTE: tiles com elisão de tile zerado [GFX §2.1] (rotinas $C4:09A5 / $C1:874D). Porte de decomp.decode_zte.
import { hiromOffset } from '../view';

export interface ZteResult { data: Uint8Array; used: number }

/** Decodifica o bloco ZTE em `addr` (endereço SNES). `used` = bytes consumidos (cabeçalho e fim incluídos). */
export function decodeZte(rom: Uint8Array, addr: number, limit = 0x10000): ZteResult {
  const p = hiromOffset(addr);
  const z = rom[p], e = rom[p + 1];
  let i = p + 2, n = 0;
  const out = new Uint8Array(limit);
  for (;;) {
    const b = rom[i];
    if (b === z) { n += 32; i += 1; }                 // tile vazio (Z testado antes de E)
    else if (b === e) { i += 1; break; }
    else { out.set(rom.subarray(i, i + 32), n); n += 32; i += 32; }
    if (n > limit) throw new RangeError(`bloco ZTE sem fim em ${addr.toString(16)}`);
  }
  return { data: out.slice(0, n), used: i - p };
}
```

`web/src/rom/decode/composite.ts`:

```ts
// Composição do piso sob os tiles [GFX §2.2] ($C4:4C5C). Porte de decomp.composite.

/** Em cada tile de destino `dst + 32n` (n < ntiles), cada pixel de cor 0 recebe o pixel do tile de origem
 *  `src + 32·((n & 1) + 16·((n >> 4) & 1))` (bloco 16×16 no layout de 16 tiles por linha). Altera `buf`. */
export function composite(buf: Uint8Array, src: number, dst: number, ntiles: number): void {
  for (let n = 0; n < ntiles; n++) {
    const d = dst + 32 * n, s = src + 32 * ((n & 1) + 16 * ((n >> 4) & 1));
    for (let r = 0; r < 8; r++) {
      const a = d + 2 * r, b = d + 16 + 2 * r, sa = s + 2 * r, sb = s + 16 + 2 * r;
      const m = ~(buf[a] | buf[a + 1] | buf[b] | buf[b + 1]) & 0xff;
      buf[a] = (buf[a] & ~m) | (buf[sa] & m);
      buf[a + 1] = (buf[a + 1] & ~m) | (buf[sa + 1] & m);
      buf[b] = (buf[b] & ~m) | (buf[sb] & m);
      buf[b + 1] = (buf[b + 1] & ~m) | (buf[sb + 1] & m);
    }
  }
}

/** $C4:4BDD: tiles 768–1023 do buffer de 32 KB sobre o piso 16×16 dos tiles 8/9/24/25. */
export function compositeFloor(buf: Uint8Array): void { composite(buf, 0x0100, 0x6000, 256); }
```

`web/src/rom/decode/arena9.ts`:

```ts
// Pós-processamento da arena 9 [GFX §2.3] ($C3:215C). Porte de decomp.arena9_post. Altera `buf` (32 KB).
import { composite } from './composite';

export function arena9Post(buf: Uint8Array): void {
  buf.copyWithin(0x2c00, 0x2000, 0x2400);
  buf.copyWithin(0x2400, 0x3800, 0x4000);
  buf.copyWithin(0x3000, 0x3800, 0x4000);
  composite(buf, 0x1d80, 0x2000, 96);
  composite(buf, 0x1c80, 0x2c00, 96);
}
```

`web/src/rom/decode/m7rle.ts`:

```ts
// RLE duplo do Modo 7 [GFX §2.4] ($C4:6201). Porte de decomp.decode_m7rle.
import { hiromOffset } from '../view';

export interface M7Result { vram: Uint8Array; usedPix: number; usedMap: number }

/** Gera `words` palavras de VRAM: byte baixo = mapa (fluxo em `mapAddr`), byte alto = pixel (fluxo em `pixAddr`). */
export function decodeM7Rle(rom: Uint8Array, pixAddr: number, mapAddr: number, words = 0x4000): M7Result {
  let p = hiromOffset(pixAddr), m = hiromOffset(mapAddr);
  const p0 = p, m0 = m, out = new Uint8Array(words * 2);
  let cp = 0, cm = 0, vp = 0, vm = 0;
  for (let k = 0; k < words; k++) {
    if (cp) cp--;
    else {
      const b = rom[p];
      if (b & 0x80) { vp = b & 0x7f; cp = (rom[p + 1] - 1) & 0xff; p += 2; }
      else { vp = b; p += 1; }
    }
    if (cm) cm--;
    else {
      const b = rom[m];
      if (b === 0x01) { cm = (rom[m + 1] - 1) & 0xff; vm = rom[m + 2]; m += 3; }
      else { vm = b; m += 1; }
    }
    out[2 * k] = vm; out[2 * k + 1] = vp;
  }
  return { vram: out, usedPix: p - p0, usedMap: m - m0 };
}
```

`web/src/rom/decode/palette.ts`:

```ts
// Paletas BGR555 [GFX §2.5].

/** Lê `n` cores BGR555 little-endian a partir do offset `o` de `bytes`. */
export function readBgr555(bytes: Uint8Array, o: number, n: number): Uint16Array {
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = bytes[o + 2 * i] | (bytes[o + 2 * i + 1] << 8);
  return out;
}

/** Canal de 5 bits → 8 bits: `c8 = c<<3 | c>>2`. */
export function c5to8(c: number): number { return ((c << 3) | (c >> 2)) & 0xff; }

/** Cor BGR555 → [r, g, b, 255]. */
export function bgr555ToRgba(v: number): [number, number, number, number] {
  return [c5to8(v & 31), c5to8((v >> 5) & 31), c5to8((v >> 10) & 31), 255];
}

/** Cor BGR555 → inteiro RGBA empacotado para escrita em Uint32Array little-endian (0xAABBGGRR). */
export function bgr555ToAbgr32(v: number): number {
  return (0xff000000 | (c5to8((v >> 10) & 31) << 16) | (c5to8((v >> 5) & 31) << 8) | c5to8(v & 31)) >>> 0;
}
```

`web/src/rom/decode/tiles.ts`:

```ts
// Tiles planares do SNES → índices [GFX §2.5].
import type { Tiles } from '../types';

/** Decodifica `count` tiles `bpp` (2 ou 4) a partir de `off` em `bytes`. Bytes além do fim contam como 0. */
export function decodeTiles(bytes: Uint8Array, bpp: 2 | 4, off = 0, count = Math.floor((bytes.length - off) / (8 * bpp))): Tiles {
  const size = 8 * bpp, px = new Uint8Array(count * 64);
  for (let t = 0; t < count; t++) {
    const base = off + t * size;
    for (let y = 0; y < 8; y++) {
      const p0 = bytes[base + 2 * y] ?? 0, p1 = bytes[base + 2 * y + 1] ?? 0;
      const p2 = bpp === 4 ? bytes[base + 16 + 2 * y] ?? 0 : 0, p3 = bpp === 4 ? bytes[base + 17 + 2 * y] ?? 0 : 0;
      for (let x = 0; x < 8; x++) {
        const bit = 7 - x;
        px[t * 64 + y * 8 + x] = ((p0 >> bit) & 1) | (((p1 >> bit) & 1) << 1) | (((p2 >> bit) & 1) << 2) | (((p3 >> bit) & 1) << 3);
      }
    }
  }
  return { bpp, count, px };
}
```

- [ ] **Step 4: Rodar.** Sem ROM: `npx vitest run tests/rom/decode-gfx` (11 passam, 2 pulam). Com ROM: `SB4_ROM="…" npx vitest run tests/rom/decode-gfx` (13 passam). Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/decode/zte.ts web/src/rom/decode/composite.ts web/src/rom/decode/arena9.ts web/src/rom/decode/m7rle.ts web/src/rom/decode/palette.ts web/src/rom/decode/tiles.ts web/tests/rom/decode-gfx.test.ts web/tests/rom/decode-gfx-rom.test.ts
git commit -m "feat(rom): decodificadores ZTE, composição do piso, arena 9, RLE do Modo 7, paletas e tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Decodificadores de mapa, animação, script da bomba e script de tiles

**Possui:** `web/src/rom/decode/{tilemap,anim,bombscript,tileanim}.ts`, `web/tests/rom/decode-map.test.ts`, `web/tests/rom/decode-anim-rom.test.ts`.

**Files:**
- Create: os 4 módulos e os 2 testes.

**Interfaces:**
- Produces:
  - `LOGIC_TABLE`, `decodeMapCodes(rom, addr, n?) → {codes, used}`, `codesToEntries(rom, codes, tbl)`, `logicOf(rom, code)`, `codesToLogic(rom, codes)`;
  - `decodeMetasprite(rom, addr): Piece[]`, `decodeAnim(rom, addr): Anim`, `animKey(anim)`;
  - `decodeBombScript(rom, addr) → {frames, loop}`;
  - `decodeTileAnim(rom, addr): TileAnimCmd[]`, `tileAnimKey(cmds)`, `applyTileDma(vramTiles, source32k, cmd)`.
- Consumes: `RomView` e os tipos (T1), `helpers` e `gfx-anims.json` (T2, T5).
- Modelos portados: `arenas-cenario/arena_rom.py` (`decode_map`, `map_to_entries`, `logic_of`, `decode_anim_script`), `animacoes-sprites/anims.py` (`parse_anim`, `parse_ms`) e `folhas_bg.parse_script`.

- [ ] **Step 1: Escrever os testes.** `web/tests/rom/decode-map.test.ts` (sintético):

```ts
import { RomView } from '../../src/rom/view';
import { decodeMapCodes, codesToEntries, logicOf, LOGIC_TABLE } from '../../src/rom/decode/tilemap';
import { decodeAnim, decodeMetasprite, animKey } from '../../src/rom/decode/anim';
import { decodeBombScript } from '../../src/rom/decode/bombscript';
import { decodeTileAnim, tileAnimKey, applyTileDma } from '../../src/rom/decode/tileanim';

/** ROM sintética de 4 MiB (endereços $C0–$FF válidos) com bytes escritos por endereço SNES. */
function rom(parts: Record<number, number[]>): RomView {
  const b = new Uint8Array(0x400000);
  for (const [a, bytes] of Object.entries(parts)) b.set(bytes, Number(a) - 0xc00000);
  return new RomView(b);
}
const le = (...w: number[]) => w.flatMap(v => [v & 0xff, (v >> 8) & 0xff]);

describe('mapa das arenas [ARN §2.3]', () => {
  it('1 byte ignorado; token = código | repetições extras << 10', () => {
    const r = rom({ 0xd00000: [0xee, ...le(5 | (2 << 10), 7, 0x3ff | (63 << 10))] });
    const m = decodeMapCodes(r, 0xd00000, 6);
    expect([...m.codes]).toEqual([5, 5, 5, 7, 0x3ff, 0x3ff]);
    expect(m.used).toBe(1 + 6);                   // o último token é consumido inteiro
  });
  it('código → entrada pela tabela; código → lógico por $C4:0892 (≥16 = $EC40)', () => {
    const r = rom({ 0xd10000: le(0x1c08, 0x1c02, 0x1404), [LOGIC_TABLE]: le(0x0000, 0xcc80, 0xec40) });
    expect([...codesToEntries(r, Uint16Array.from([2, 0, 1]), 0xd10000)]).toEqual([0x1404, 0x1c08, 0x1c02]);
    expect([logicOf(r, 0), logicOf(r, 1), logicOf(r, 2), logicOf(r, 16), logicOf(r, 0x3ff)]).toEqual([0, 0xcc80, 0xec40, 0xec40, 0xec40]);
  });
});

describe('animação e metasprite [ANI §2.1–2.2]', () => {
  const r = rom({
    0xd80000: [2, ...[0x00, 0x10, 0xd8], 12, 0xfe, 0x03, ...[0x00, 0x10, 0xd8], 255, 0, 0],
    0xd81000: [2, ...le(0xfff0, 0xffe8, 0x1004), ...le(8, 0, 0xc000 | (5 << 9) | 0x1ff)],
  });
  it('peças com sinal, flips, tamanho e soma de paleta', () => {
    expect(decodeMetasprite(r, 0xd81000)).toEqual([
      { dx: -16, dy: -24, tile: 4, hflip: false, vflip: false, big: true, palAdd: 0 },
      { dx: 8, dy: 0, tile: 0x1ff, hflip: true, vflip: true, big: false, palAdd: 5 },
    ]);
  });
  it('quadros: ponteiro, duração e deslocamento s8', () => {
    const a = decodeAnim(r, 0xd80000);
    expect(a.map(f => [f.dur, f.mx, f.my, f.pieces.length])).toEqual([[12, -2, 3, 2], [255, 0, 0, 2]]);
    expect(animKey(a)).toBe('12,-2,3:-16,-24,4,0,0,1,0;8,0,511,1,1,0,5|255,0,0:-16,-24,4,0,0,1,0;8,0,511,1,1,0,5');
  });
});

describe('script da bomba [ANI §5.1]', () => {
  it('FFFF = loop, FFFE = fim', () => {
    const r = rom({ 0xc15000: [...le(0x0b00), 20, ...le(0x0b02), 12, ...le(0xffff)], 0xc15100: [...le(0x0b08), 16, ...le(0xfffe)] });
    expect(decodeBombScript(r, 0xc15000)).toEqual({ loop: true, frames: [{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }] });
    expect(decodeBombScript(r, 0xc15100)).toEqual({ loop: false, frames: [{ word: 0x0b08, dur: 16 }] });
  });
});

describe('script de tiles [ARN §3.1]', () => {
  it('$A0 espera, $80 loop, $90 fim, senão DMA [src:3]', () => {
    const r = rom({ 0xc36000: [...le(0x0e00), 0x00, 0x00, 0x9f, 0x7f, ...le(22), 0xa0, ...le(0), 0x80],
      0xc36100: [...le(0x20), 0x01, 0x00, 0x90, 0x7f, ...le(0), 0x90] });
    const a = decodeTileAnim(r, 0xc36000);
    expect(a).toEqual([{ kind: 'dma', vram: 0x0e00, src: 0x7f9f00 }, { kind: 'wait', frames: 22 }, { kind: 'loop' }]);
    expect(tileAnimKey(a)).toBe('d3584,8363776 w22 L');
    expect(tileAnimKey(decodeTileAnim(r, 0xc36100))).toBe('d32,8359936 E');
  });
  it('DMA: 64 bytes para a palavra dst e 64 de src+$200 para dst+$100', () => {
    const src = new Uint8Array(0x8000); src.fill(1, 0x1f00, 0x1f40); src.fill(2, 0x2100, 0x2140);
    const vram = new Uint8Array(0x8000);
    applyTileDma(vram, src, { vram: 0x0e00, src: 0x7f9f00 });
    expect([vram[0x1c00], vram[0x1c3f], vram[0x1c40], vram[0x1e00], vram[0x1e3f]]).toEqual([1, 1, 0, 2, 2]);
  });
});
```

`web/tests/rom/decode-anim-rom.test.ts` (golden com a ROM):

```ts
import { ROM, fixture, sha1Hex } from './helpers';
import { RomView } from '../../src/rom/view';
import { decodeAnim, animKey } from '../../src/rom/decode/anim';
import { decodeBombScript } from '../../src/rom/decode/bombscript';

interface Fx {
  anims: Record<string, { frames: number; sha1: string }>;
  firstLevel: Record<string, { addr: number; perChar: number[] }>;
  bombScripts: { type: number; addr: number; loop: boolean; frames: [number, number][] }[];
}

describe.skipIf(!ROM)('animações da ROM (gfx-anims.json)', () => {
  const fx = fixture<Fx>('gfx-anims.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('as 141 animações decodificadas batem', () => {
    const keys = Object.keys(fx.anims);
    expect(keys).toHaveLength(141);
    for (const k of keys) {
      const a = decodeAnim(view, parseInt(k, 16));
      expect({ k, frames: a.length, sha1: sha1Hex(animKey(a)) }).toEqual({ k, ...fx.anims[k] });
    }
  });
  it('literais: andar → e morte [ANI §3]', () => {
    const q = (addr: number) => decodeAnim(view, addr).map(f => `g${f.pieces[0].tile}:${f.dur}`).join(' ');
    expect(q(0xd81693)).toBe('g4:12 g3:8 g5:12 g3:8');
    expect(q(0xd81999)).toBe('g24:5 g25:5 g26:6 g27:6');
    expect(decodeAnim(view, 0xd81693)[0].pieces[0]).toEqual({ dx: -16, dy: -24, tile: 4, hflip: false, vflip: false, big: true, palAdd: 0 });
  });
  it('$C1:7D5F = (g&3)·$80 + (g>>2)·$800 para g 0..127', () => {
    for (let g = 0; g < 128; g++) expect(view.u16(0xc17d5f + 4 * g) | (view.u16(0xc17d5f + 4 * g + 2) << 16)).toBe((g & 3) * 0x80 + (g >> 2) * 0x800);
  });
  it('tabelas de 1º nível por personagem', () => {
    for (const t of Object.values(fx.firstLevel))
      expect(Array.from({ length: 8 }, (_, c) => view.p24(t.addr + 3 * c))).toEqual(t.perChar);
  });
  it('scripts da bomba $C1:56A8 (normal 20/12/16/16, remota 16×4)', () => {
    for (const b of fx.bombScripts) {
      const s = decodeBombScript(view, view.p24(0xc156a8 + 3 * b.type));
      expect({ loop: s.loop, frames: s.frames.map(f => [f.word, f.dur]) }).toEqual({ loop: b.loop, frames: b.frames });
    }
    expect(fx.bombScripts[0].frames.slice(0, 4)).toEqual([[0x0b00, 20], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16]]);
    expect(fx.bombScripts[1].frames).toEqual([[0x0b08, 16], [0x0b0a, 16], [0x0b0c, 16], [0x0b0e, 16]]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/rom/decode-map tests/rom/decode-anim-rom` → FAIL.

- [ ] **Step 3: Implementar.** Armadilhas:
  - no mapa, o 1º byte é ignorado, e o `used` conta o último token inteiro mesmo que ele passe de `n`;
  - na animação, `dx`/`dy` do quadro são `s8`, e os das peças são `s16`;
  - no script de tiles, `src` é um endereço de 24 bits no buffer `$7F:8000` (lido com `u24`, **não** `p24`).

`web/src/rom/decode/tilemap.ts`:

```ts
// Mapas das arenas [ARN §2.3] ($C4:08D3 / $C4:0901). Porte de arena_rom.decode_map / map_to_entries / logic_of.
import type { RomView } from '../view';

export const LOGIC_TABLE = 0xc40892;

/** Decodifica `n` códigos: 1 byte ignorado; tokens u16 LE `código = t & $3FF`, `repetições extras = t >> 10`. */
export function decodeMapCodes(rom: RomView, addr: number, n = 1024): { codes: Uint16Array; used: number } {
  const codes = new Uint16Array(n);
  let a = addr + 1, k = 0;
  while (k < n) {
    const t = rom.u16(a); a += 2;
    const code = t & 0x3ff;
    for (let r = 0; r <= t >> 10 && k < n; r++) codes[k++] = code;
  }
  return { codes, used: a - addr };
}

/** Código → palavra de tilemap pela tabela `tbl` (u16 por código). */
export function codesToEntries(rom: RomView, codes: Uint16Array, tbl: number): Uint16Array {
  const out = new Uint16Array(codes.length);
  for (let i = 0; i < codes.length; i++) out[i] = rom.u16(tbl + 2 * codes[i]);
  return out;
}

/** Código → lógico: `código < 16 ? u16($C4:0892 + 2·código) : $EC40`. */
export function logicOf(rom: RomView, code: number): number {
  return code < 16 ? rom.u16(LOGIC_TABLE + 2 * code) : 0xec40;
}

export function codesToLogic(rom: RomView, codes: Uint16Array): Uint16Array {
  const out = new Uint16Array(codes.length);
  for (let i = 0; i < codes.length; i++) out[i] = logicOf(rom, codes[i]);
  return out;
}
```

`web/src/rom/decode/anim.ts`:

```ts
// Animação e metasprite [ANI §2.1–2.2]. Porte de anims.parse_anim / parse_ms.
import type { Anim, Piece } from '../types';
import type { RomView } from '../view';

/** Metasprite: u8 N; N × {s16 dx, s16 dy, u16 attr} (bit15 V, bit14 H, bit12 32×32, bits 9–11 paleta, 0–8 gráfico). */
export function decodeMetasprite(rom: RomView, addr: number): Piece[] {
  const n = rom.u8(addr), out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const o = addr + 1 + 6 * i, attr = rom.u16(o + 4);
    out.push({ dx: rom.s16(o), dy: rom.s16(o + 2), tile: attr & 0x1ff, hflip: (attr & 0x4000) !== 0,
      vflip: (attr & 0x8000) !== 0, big: (attr & 0x1000) !== 0, palAdd: (attr >> 9) & 7 });
  }
  return out;
}

/** Animação: u8 N; N × {ptr24 metasprite, u8 dur, s8 dx, s8 dy}. */
export function decodeAnim(rom: RomView, addr: number): Anim {
  const n = rom.u8(addr), out: Anim = [];
  for (let i = 0; i < n; i++) {
    const o = addr + 1 + 6 * i;
    out.push({ dur: rom.u8(o + 3), mx: rom.s8(o + 4), my: rom.s8(o + 5), pieces: decodeMetasprite(rom, rom.p24(o)) });
  }
  return out;
}

/** Forma canônica (usada pelos goldens): `dur,mx,my:dx,dy,tile,h,v,big,pal;…|…`. */
export function animKey(a: Anim): string {
  return a.map(f => `${f.dur},${f.mx},${f.my}:` + f.pieces.map(p =>
    `${p.dx},${p.dy},${p.tile},${+p.hflip},${+p.vflip},${+p.big},${p.palAdd}`).join(';')).join('|');
}
```

`web/src/rom/decode/bombscript.ts`:

```ts
// Script da bomba parada [ANI §5.1]: {u16 palavra, u8 dur} até FFFF (loop) ou FFFE (fim).
import type { RomView } from '../view';

export interface BombScript { frames: { word: number; dur: number }[]; loop: boolean }

export function decodeBombScript(rom: RomView, addr: number, max = 64): BombScript {
  const frames: { word: number; dur: number }[] = [];
  for (let a = addr; frames.length < max; a += 3) {
    const w = rom.u16(a);
    if (w === 0xffff) return { frames, loop: true };
    if (w === 0xfffe) return { frames, loop: false };
    frames.push({ word: w, dur: rom.u8(a + 2) });
  }
  throw new RangeError(`script de bomba sem fim em ${addr.toString(16)}`);
}
```

`web/src/rom/decode/tileanim.ts`:

```ts
// Script de animação de tiles `rec+$12` [ARN §3.1] ($C4:0ED1). Porte de arena_rom.decode_anim_script.
import type { TileAnimCmd } from '../types';
import type { RomView } from '../view';

/** [W:2][op:1]: $A0 espera W; $80 volta ao início; $90 fim; senão [src:2][banco:1] = DMA 16×16 para a palavra W. */
export function decodeTileAnim(rom: RomView, addr: number, max = 400): TileAnimCmd[] {
  const out: TileAnimCmd[] = [];
  let a = addr;
  for (let k = 0; k < max; k++) {
    const w = rom.u16(a), op = rom.u8(a + 2);
    if (op === 0xa0) { out.push({ kind: 'wait', frames: w }); a += 3; }
    else if (op === 0x80) { out.push({ kind: 'loop' }); return out; }
    else if (op === 0x90) { out.push({ kind: 'end' }); return out; }
    else { out.push({ kind: 'dma', vram: w, src: rom.u24(a + 3) }); a += 6; }
  }
  return out;
}

/** Forma canônica (goldens): `w5 d3584,8364032 L`. */
export function tileAnimKey(cmds: TileAnimCmd[]): string {
  return cmds.map(c => c.kind === 'wait' ? `w${c.frames}` : c.kind === 'dma' ? `d${c.vram},${c.src}` : c.kind === 'loop' ? 'L' : 'E').join(' ');
}

/** Aplica um DMA do script a um buffer de 32 KB de tiles 4bpp (bytes, como a VRAM $0000–$7FFF):
 *  64 bytes de `src` → palavra `vram` e 64 bytes de `src+$200` → palavra `vram+$100`. `src` está em `$7F:8000+`. */
export function applyTileDma(vramTiles: Uint8Array, source32k: Uint8Array, cmd: { vram: number; src: number }): void {
  const s = cmd.src - 0x7f8000, d = cmd.vram * 2;
  vramTiles.set(source32k.subarray(s, s + 64), d);
  vramTiles.set(source32k.subarray(s + 0x200, s + 0x240), d + 0x200);
}
```

- [ ] **Step 4: Rodar.** Sem ROM: `npx vitest run tests/rom/decode-map tests/rom/decode-anim-rom` (7 passam, 5 pulam). Com ROM: 12 passam. Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/decode/tilemap.ts web/src/rom/decode/anim.ts web/src/rom/decode/bombscript.ts web/src/rom/decode/tileanim.ts web/tests/rom/decode-map.test.ts web/tests/rom/decode-anim-rom.test.ts
git commit -m "feat(rom): decodificadores de mapa das arenas, animação/metasprite, script da bomba e script de tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: IndexedDB, `romState`, painel da ROM e gancho no `main.ts`

**Possui:** `web/src/rom/store.ts`, `web/src/rom/state.ts`, `web/src/rom/ui.ts`, as 2 linhas do gancho em `web/src/main.ts`, `web/tests/rom/validate-store.test.ts`, `web/tests/rom/assets-state.test.ts`, `web/tests/rom/validate-ui.test.ts`.

**Files:**
- Create: `store.ts`, `state.ts`, `ui.ts` e os 3 testes
- Modify: `web/src/main.ts` (+2 linhas)

**Interfaces:**
- Produces:
  - `DB_NAME/STORE/KEY`, `StoredRom {bytes: ArrayBuffer; sha1; salvaEm}`, `loadStoredRom()`, `saveRom(bytes)`, `forgetRom()`;
  - `RomStatus`, `RomState`, `romState`, `onRomChange(cb) → cancelar`, `registerRomDialog(fn|null)`, `openRomDialog()`, `useRomBytes(bytes, {persist?})`, `bootRom()`, `forgetStoredRom()`;
  - `PANEL_TEXT`, `PanelView`, `panelKeyAction(key)`, `createRomPanelController(deps)`, `installRomPanel(doc)`, `startRomUi(doc, {autoShow})`.
- Consumes: `validateRom`/`sha1Hex`/`mensagemDe` (T2), `createRomAssets` (stub da T1: aqui só `assets.rom` é usado), `helpers` (T2).
- Para o plano 10: a tela de Opções usa `romState.status`, `openRomDialog()` e `forgetStoredRom()`. As telas assinam `onRomChange`.

- [ ] **Step 1: Escrever os testes.** `web/tests/rom/validate-store.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { loadStoredRom, saveRom, forgetRom } from '../../src/rom/store';
import { sha1Hex } from '../../src/rom/validate';

describe('ROM no IndexedDB (fake-indexeddb)', () => {
  beforeEach(async () => { await forgetRom(); });
  it('sem nada guardado → null', async () => {
    expect(await loadStoredRom()).toBeNull();
  });
  it('ida e volta: bytes, SHA-1 e data', async () => {
    const b = new Uint8Array(4096).map((_, i) => (i * 7) & 0xff);
    const antes = Date.now();
    await saveRom(b);
    const r = await loadStoredRom();
    expect(r).not.toBeNull();
    expect(new Uint8Array(r!.bytes)).toEqual(b);
    expect(r!.sha1).toBe(await sha1Hex(b));
    expect(r!.salvaEm).toBeGreaterThanOrEqual(antes);
  });
  it('guardar de novo substitui; esquecer apaga', async () => {
    await saveRom(new Uint8Array([1, 2, 3]));
    await saveRom(new Uint8Array([4, 5]));
    expect(new Uint8Array((await loadStoredRom())!.bytes)).toEqual(new Uint8Array([4, 5]));
    await forgetRom();
    expect(await loadStoredRom()).toBeNull();
  });
  it('a cópia guardada não muda quando o buffer original muda', async () => {
    const b = new Uint8Array([9, 9, 9]);
    await saveRom(b); b[0] = 0;
    expect(new Uint8Array((await loadStoredRom())!.bytes)[0]).toBe(9);
  });
});
```

`web/tests/rom/assets-state.test.ts`. Armadilha: nunca compare `RomAssets` com `toEqual`/`toMatchObject`. A comparação profunda percorre os 4 MB e leva segundos; use `toBe`.

```ts
import 'fake-indexeddb/auto';
import { ROM } from './helpers';
import { romState, onRomChange, useRomBytes, bootRom, forgetStoredRom, openRomDialog, registerRomDialog, type RomStatus } from '../../src/rom/state';
import { saveRom, loadStoredRom, forgetRom } from '../../src/rom/store';
import { mensagemDe } from '../../src/rom/validate';

describe('romState sem ROM válida', () => {
  beforeEach(async () => { await forgetStoredRom(); });
  it('arquivo inválido: status erro, mensagem PT-BR, nada guardado', async () => {
    const seen: RomStatus[] = [];
    const off = onRomChange(s => seen.push(s.status));
    const r = await useRomBytes(new Uint8Array(100));
    off();
    expect(r.ok).toBe(false);
    expect(seen).toEqual(['verificando', 'erro']);
    expect(romState).toMatchObject({ assets: null, status: 'erro', erro: mensagemDe('tamanho') });
    expect(await loadStoredRom()).toBeNull();
  });
  it('boot sem ROM guardada → false; ROM guardada inválida é apagada', async () => {
    expect(await bootRom()).toBe(false);
    await saveRom(new Uint8Array(10));
    expect(await bootRom()).toBe(false);
    expect(await loadStoredRom()).toBeNull();
    expect(romState.status).toBe('vazio');
  });
  it('openRomDialog chama o painel registrado', () => {
    let n = 0;
    registerRomDialog(() => { n++; });
    openRomDialog(); openRomDialog();
    registerRomDialog(null); openRomDialog();
    expect(n).toBe(2);
  });
  it('onRomChange devolve o cancelamento', async () => {
    let n = 0; const off = onRomChange(() => n++); off();
    await forgetStoredRom();
    expect(n).toBe(0);
  });
});

describe.skipIf(!ROM)('romState com a ROM real', () => {
  beforeEach(async () => { await forgetStoredRom(); });
  it('carrega, guarda no IndexedDB e o boot seguinte reusa', async () => {
    const r = await useRomBytes(ROM!);
    expect(r.ok).toBe(true);
    expect(romState.status).toBe('ok');
    expect(romState.assets!.rom.data).toHaveLength(4_194_304);
    expect((await loadStoredRom())!.sha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
    romState.assets = null;
    expect(await bootRom()).toBe(true);
    expect(romState.assets).not.toBeNull();
  });
  it('arquivo errado depois de uma ROM boa mantém a ROM e mostra o erro', async () => {
    await useRomBytes(ROM!, { persist: false });
    const antes = romState.assets;
    await useRomBytes(new Uint8Array(10));
    expect(romState.assets).toBe(antes);                // toBe: comparar 4 MB com toEqual é lento
    expect([romState.status, romState.erro]).toEqual(['ok', mensagemDe('tamanho')]);
  });
  it('esquecer volta para a arte por código', async () => {
    await useRomBytes(ROM!);
    await forgetStoredRom();
    expect([romState.assets, romState.status]).toEqual([null, 'vazio']);
    expect(await loadStoredRom()).toBeNull();
    await forgetRom();
  });
});
```

`web/tests/rom/validate-ui.test.ts`:

```ts
import { createRomPanelController, panelKeyAction, PANEL_TEXT, type PanelView } from '../../src/rom/ui';
import { mensagemDe, type ValidateResult } from '../../src/rom/validate';

function setup(result: ValidateResult) {
  const views: PanelView[] = [];
  const got: Uint8Array[] = [];
  const ctl = createRomPanelController({ useBytes: async b => { got.push(b); return result; }, render: v => views.push(v) });
  return { ctl, views, got };
}
const OK: ValidateResult = { ok: true, rom: new Uint8Array(1), sha1: 'x' };
const BAD: ValidateResult = { ok: false, motivo: 'hash', mensagem: mensagemDe('hash') };

describe('painel da ROM (controlador)', () => {
  it('textos PT-BR da spec §2.3', () => {
    expect(PANEL_TEXT.intro).toBe('Crown Blast usa os gráficos e sons da sua cópia de Super Bomberman 4 (USA, com tradução). Arraste o arquivo .sfc aqui ou clique para escolher.');
    expect([PANEL_TEXT.escolher, PANEL_TEXT.semRom]).toEqual(['Escolher arquivo', 'Jogar sem a ROM']);
  });
  it('começa fechado; show abre com o texto de introdução', () => {
    const { ctl, views } = setup(OK);
    expect(ctl.view.visible).toBe(false);
    ctl.show();
    expect(views.at(-1)).toEqual({ visible: true, busy: false, message: PANEL_TEXT.intro, error: null });
  });
  it('arquivo válido: mostra "verificando" e fecha', async () => {
    const { ctl, views, got } = setup(OK);
    ctl.show();
    const r = await ctl.file(new Uint8Array([1, 2]));
    expect(r.ok).toBe(true);
    expect(got).toEqual([new Uint8Array([1, 2])]);
    expect(views.map(v => [v.visible, v.busy, v.message === PANEL_TEXT.verificando])).toEqual([[true, false, false], [true, true, true], [false, false, false]]);
  });
  it('arquivo inválido: o erro aparece no próprio painel, que continua aberto', async () => {
    const { ctl } = setup(BAD);
    ctl.show();
    await ctl.file(new Uint8Array(3));
    expect(ctl.view).toEqual({ visible: true, busy: false, message: PANEL_TEXT.intro, error: mensagemDe('hash') });
    ctl.show();
    expect(ctl.view.error).toBeNull();
  });
  it('teclas: Enter/Espaço abrem o seletor, Esc joga sem ROM; fechado não reage', () => {
    expect([panelKeyAction('Enter'), panelKeyAction(' '), panelKeyAction('Escape'), panelKeyAction('a')]).toEqual(['open', 'open', 'skip', null]);
    const { ctl } = setup(OK);
    expect(ctl.key('Enter')).toBeNull();
    ctl.show();
    expect(ctl.key('Enter')).toBe('open');
    ctl.skip();
    expect(ctl.view.visible).toBe(false);
  });
  it('ocupado (verificando): teclas e "jogar sem" não agem', async () => {
    let release!: (r: ValidateResult) => void;
    const ctl = createRomPanelController({ useBytes: () => new Promise(r => { release = r; }), render: () => {} });
    ctl.show();
    const p = ctl.file(new Uint8Array(1));
    expect(ctl.key('Escape')).toBeNull();
    ctl.skip();
    expect(ctl.view.visible).toBe(true);
    release(OK); await p;
    expect(ctl.view.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/rom/validate-store tests/rom/assets-state tests/rom/validate-ui` → FAIL.

- [ ] **Step 3: Implementar.** `web/src/rom/store.ts`:

```ts
// ROM guardada no IndexedDB do navegador (spec §2.3). Nada sai do navegador; nenhuma chamada de rede.
import { sha1Hex } from './validate';

export const DB_NAME = 'crown-blast', STORE = 'rom', KEY = 'sb4';
export interface StoredRom { bytes: ArrayBuffer; sha1: string; salvaEm: number }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** A ROM guardada, ou null. Sem IndexedDB (modo privado restrito etc.), devolve null. */
export async function loadStoredRom(): Promise<StoredRom | null> {
  if (typeof indexedDB === 'undefined') return null;
  try { return (await run<StoredRom | undefined>('readonly', s => s.get(KEY))) ?? null; }
  catch { return null; }
}

/** Guarda uma cópia dos bytes (já validados por quem chama). */
export async function saveRom(bytes: Uint8Array): Promise<void> {
  const copy = bytes.slice();
  const rec: StoredRom = { bytes: copy.buffer, sha1: await sha1Hex(copy), salvaEm: Date.now() };
  await run('readwrite', s => s.put(rec, KEY));
}

export async function forgetRom(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await run('readwrite', s => s.delete(KEY));
}
```

`web/src/rom/state.ts`:

```ts
// Estado global da ROM (spec §2.3): assets atuais, avisos de troca e abertura do painel.
import type { RomAssets } from './types';
import { validateRom, type ValidateResult } from './validate';
import { loadStoredRom, saveRom, forgetRom } from './store';
import { createRomAssets } from './assets';

export type RomStatus = 'vazio' | 'verificando' | 'ok' | 'erro';
export interface RomState { assets: RomAssets | null; status: RomStatus; erro: string | null }

export const romState: RomState = { assets: null, status: 'vazio', erro: null };
const listeners = new Set<(s: RomState) => void>();
let dialog: (() => void) | null = null;

/** Avisa a cada mudança de `romState`. Devolve a função que cancela a inscrição. */
export function onRomChange(cb: (s: RomState) => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }
function emit(): void { for (const cb of [...listeners]) cb(romState); }

/** O painel (rom/ui.ts) se registra aqui; as telas chamam openRomDialog() sem conhecer o DOM. */
export function registerRomDialog(open: (() => void) | null): void { dialog = open; }
export function openRomDialog(): void { dialog?.(); }

/** Valida e troca a ROM. Com erro, mantém a ROM anterior (se houver) e grava a mensagem em `erro`. */
export async function useRomBytes(bytes: Uint8Array | ArrayBuffer, opts: { persist?: boolean } = {}): Promise<ValidateResult> {
  romState.status = 'verificando'; romState.erro = null; emit();
  const r = await validateRom(bytes);
  if (!r.ok) {
    romState.status = romState.assets ? 'ok' : 'erro'; romState.erro = r.mensagem; emit();
    return r;
  }
  romState.assets = createRomAssets(r.rom); romState.status = 'ok'; romState.erro = null;
  if (opts.persist ?? true) {
    try { await saveRom(r.rom); } catch { romState.erro = 'A ROM vale só nesta sessão: o navegador não deixou guardá-la.'; }
  }
  emit();
  return r;
}

/** No boot: usa a ROM guardada, se houver e for válida (senão a apaga). Devolve se ficou com ROM. */
export async function bootRom(): Promise<boolean> {
  const stored = await loadStoredRom();
  if (!stored) return false;
  const r = await useRomBytes(stored.bytes, { persist: false });
  if (!r.ok) { await forgetRom(); romState.status = 'vazio'; romState.erro = null; emit(); }
  return r.ok;
}

/** "Esquecer ROM" (Opções): apaga do IndexedDB e volta para a arte por código. */
export async function forgetStoredRom(): Promise<void> {
  await forgetRom();
  romState.assets = null; romState.status = 'vazio'; romState.erro = null; emit();
}
```

`web/src/rom/ui.ts`. A parte DOM (`installRomPanel`) não tem teste automático (não há jsdom); a lógica está no controlador.

```ts
// Painel de carga da ROM (spec §2.3): camada DOM fora do canvas. A lógica fica no controlador (testável sem DOM).
import type { ValidateResult } from './validate';
import { bootRom, registerRomDialog, useRomBytes } from './state';

export const PANEL_TEXT = {
  intro: 'Crown Blast usa os gráficos e sons da sua cópia de Super Bomberman 4 (USA, com tradução). Arraste o arquivo .sfc aqui ou clique para escolher.',
  escolher: 'Escolher arquivo',
  semRom: 'Jogar sem a ROM',
  verificando: 'Verificando a ROM…',
} as const;

export interface PanelView { visible: boolean; busy: boolean; message: string; error: string | null }
export type PanelKeyAction = 'open' | 'skip' | null;

/** Teclas do painel aberto: Enter/Espaço abrem o seletor (é gesto do usuário), Esc = jogar sem a ROM. */
export function panelKeyAction(key: string): PanelKeyAction {
  if (key === 'Enter' || key === ' ') return 'open';
  if (key === 'Escape') return 'skip';
  return null;
}

export interface PanelDeps { useBytes(b: Uint8Array): Promise<ValidateResult>; render(v: PanelView): void }

export function createRomPanelController(deps: PanelDeps) {
  let view: PanelView = { visible: false, busy: false, message: PANEL_TEXT.intro, error: null };
  const set = (p: Partial<PanelView>) => { view = { ...view, ...p }; deps.render(view); };
  return {
    get view(): PanelView { return view; },
    show(): void { set({ visible: true, busy: false, error: null, message: PANEL_TEXT.intro }); },
    skip(): void { if (!view.busy) set({ visible: false, error: null }); },
    async file(bytes: Uint8Array): Promise<ValidateResult> {
      set({ busy: true, error: null, message: PANEL_TEXT.verificando });
      const r = await deps.useBytes(bytes);
      set(r.ok ? { busy: false, visible: false, message: PANEL_TEXT.intro } : { busy: false, message: PANEL_TEXT.intro, error: r.mensagem });
      return r;
    },
    /** Ação da tecla com o painel aberto (null = ignorar); fechado, nunca age. */
    key(k: string): PanelKeyAction { return view.visible && !view.busy ? panelKeyAction(k) : null; },
  };
}

/** Monta o painel no documento. Enquanto aberto, engole as teclas (o jogo não as vê). */
export function installRomPanel(doc: Document): { show(): void; hide(): void } {
  const root = doc.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Carregar a ROM');
  root.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85);z-index:10;font:16px system-ui,sans-serif;color:#fff';
  const box = doc.createElement('div');
  box.style.cssText = 'max-width:520px;padding:24px;border:2px dashed #888;border-radius:8px;background:#111;text-align:center';
  const msg = doc.createElement('p'), err = doc.createElement('p');
  err.setAttribute('role', 'alert'); err.style.color = '#ff6b6b';
  const input = doc.createElement('input');
  input.type = 'file'; input.accept = '.sfc,.smc'; input.style.display = 'none';
  const pick = doc.createElement('button'), skip = doc.createElement('button');
  pick.textContent = PANEL_TEXT.escolher; skip.textContent = PANEL_TEXT.semRom;
  for (const b of [pick, skip]) b.style.cssText = 'margin:8px;padding:8px 16px;font:inherit;cursor:pointer';
  box.append(msg, err, pick, skip, input); root.append(box); doc.body.append(root);

  const ctl = createRomPanelController({
    useBytes: b => useRomBytes(b),
    render: v => {
      root.style.display = v.visible ? 'flex' : 'none';
      msg.textContent = v.message; err.textContent = v.error ?? '';
      pick.disabled = skip.disabled = v.busy;
    },
  });
  const readFile = async (f: File | undefined | null) => { if (f) await ctl.file(new Uint8Array(await f.arrayBuffer())); };
  pick.addEventListener('click', () => input.click());
  skip.addEventListener('click', () => ctl.skip());
  input.addEventListener('change', () => { void readFile(input.files?.[0]); input.value = ''; });
  root.addEventListener('dragover', e => { e.preventDefault(); });
  root.addEventListener('drop', e => { e.preventDefault(); void readFile(e.dataTransfer?.files[0]); });
  root.addEventListener('click', e => { if (e.target === root || e.target === box || e.target === msg) input.click(); });
  doc.defaultView?.addEventListener('keydown', e => {
    if (!ctl.view.visible) return;
    const a = ctl.key(e.key);
    if (e.key !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
    if (a === 'open') input.click();
    else if (a === 'skip') ctl.skip();
  }, { capture: true });
  return { show: () => ctl.show(), hide: () => ctl.skip() };
}

/** Gancho do main.ts: registra o painel, carrega a ROM guardada e, sem ela, abre o painel se `autoShow`. */
export async function startRomUi(doc: Document, opts: { autoShow: boolean }): Promise<void> {
  const panel = installRomPanel(doc);
  registerRomDialog(() => panel.show());
  const had = await bootRom();
  if (!had && opts.autoShow) panel.show();
}
```

- [ ] **Step 4: Gancho no `web/src/main.ts`.** Acrescentar o import depois de `import { battleScreen } from './screens/battle';`:
```ts
import { startRomUi } from './rom/ui';
```
E, logo antes de `const ctx = createDisplay(`:
```ts
// Painel da ROM (plano 5): usa a ROM guardada ou, sem ela, pede o arquivo (não abre sozinho em ?debug/?quick).
void startRomUi(document, { autoShow: !params.has('debug') && !params.has('quick') });
```

- [ ] **Step 5: Rodar.** Sem ROM: 14 passam e 3 pulam. Com ROM: 17 passam. Depois `npx vitest run && npx tsc --noEmit && npm run build`.

- [ ] **Step 6: Conferência manual (navegador).** `npm run dev` e abrir `http://localhost:5173/` (a porta que o Vite indicar):
  1. o painel aparece com o texto da spec;
  2. **Enter** abre o seletor; escolher um arquivo qualquer mostra a mensagem de erro no painel;
  3. **Esc** fecha e o título continua jogável;
  4. arrastar o `.sfc` real para o painel fecha o painel;
  5. recarregar a página: o painel não aparece mais (ROM no IndexedDB);
  6. em `?debug=1`, o painel nunca abre sozinho.

- [ ] **Step 7: Commit.**
```bash
git add web/src/rom/store.ts web/src/rom/state.ts web/src/rom/ui.ts web/src/main.ts web/tests/rom/validate-store.test.ts web/tests/rom/assets-state.test.ts web/tests/rom/validate-ui.test.ts
git commit -m "feat(rom): ROM no IndexedDB, romState, painel de carga e gancho no boot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: PPU de software

**Possui:** `web/src/render/ppu/render.ts`, `web/src/render/ppu/image.ts`, `web/src/render/ppu/index.ts`, `web/tests/rom/ppu.test.ts`.

**Files:**
- Create: os 3 módulos e o teste.

**Interfaces:**
- Produces: `renderPpu(f: PpuFrame, out: ImageData): void`, `createImage(w?, h?): ImageData` (o Node não tem `ImageData`) e o índice `render/ppu/index.ts`, que reexporta os tipos da T1.
- Consumes: `render/ppu/types.ts` e `Tiles` (T1).

Regras que o código cumpre (spec §2.4 + D1/D2):
- **Prioridade**, da frente para trás: BG3 prio 1 > OBJ 3 > BG1 p1 > BG2 p1 > OBJ 2 > BG1 p0 > BG2 p0 > OBJ 1 > BG3 p0 > OBJ 0.
- **Entre sprites,** o índice menor da OAM vence e leva a própria prioridade (a "peculiaridade" do SNES).
- **Tiles 16×16:** n, n+1, n+16, n+17.
- **OBJ por tile:** `(n & $100) | (((n>>4) + cy) & $F) << 4 | ((n + cx) & $F)`.
- **BG3:** 2bpp com `4·pal + cor`.
- **Linhas fora das faixas** ficam com o fundo.
- **Modo 7:** OBJ 3 > 2 > 1 > plano > OBJ 0.
- **Implementação:** buffers de linha reaproveitados e escrita por `Uint32Array` (little-endian).

- [ ] **Step 1: Escrever o teste** `web/tests/rom/ppu.test.ts`:

```ts
import { renderPpu, createImage, type PpuFrame, type BgLayer, type ObjEntry, type ScanBand } from '../../src/render/ppu';
import type { Tiles } from '../../src/rom/types';

// ---------- ajudantes ----------
const C = (r: number, g: number, b: number) => r | (g << 5) | (b << 10);           // BGR555 com canais de 5 bits
const c8 = (c: number) => (c << 3) | (c >> 2);
const rgbOf = (v: number) => [c8(v & 31), c8((v >> 5) & 31), c8((v >> 10) & 31)];
/** Tiles com `count` tiles; `set[n]` = conteúdo do tile n (64 índices) ou um número (tile sólido). */
function mk(bpp: 2 | 4, count: number, set: Record<number, number | Uint8Array>): Tiles {
  const px = new Uint8Array(count * 64);
  for (const [n, v] of Object.entries(set)) px.set(typeof v === 'number' ? new Uint8Array(64).fill(v) : v, Number(n) * 64);
  return { bpp, count, px };
}
function dot(v: number, x: number, y: number): Uint8Array { const t = new Uint8Array(64); t[y * 8 + x] = v; return t; }
function layer(tiles: Tiles, cells: Record<string, number>, o: Partial<BgLayer> = {}): BgLayer {
  const map = new Uint16Array(32 * 32);
  for (const [k, e] of Object.entries(cells)) { const [c, r] = k.split(',').map(Number); map[r * 32 + c] = e; }
  return { map, mapW: 32, tiles, tile16: false, hofs: 0, vofs: -1, ...o };
}
const ALL = 1 | 2 | 4 | 16;
function band(o: Partial<ScanBand> = {}): ScanBand { return { y0: 0, y1: 224, bg1Tile16: false, main: ALL, sub: 0, math: 'none', ...o }; }
function palette(entries: Record<number, number>): Uint16Array { const c = new Uint16Array(256); for (const [i, v] of Object.entries(entries)) c[Number(i)] = v; return c; }
function draw(f: Partial<PpuFrame>): ImageData {
  const img = createImage();
  renderPpu({ cgram: new Uint16Array(256), bands: [band()], oam: [], ...f }, img);
  return img;
}
function at(img: ImageData, x: number, y: number): number[] { const i = (y * 256 + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; }
const BLACK = [0, 0, 0];

// ---------- testes ----------
describe('PPU: fundo e faixas', () => {
  it('sem camadas, tudo é a cor 0 da CGRAM; `backdrop` substitui', () => {
    const cg = palette({ 0: C(31, 0, 0) });
    expect(at(draw({ cgram: cg }), 0, 0)).toEqual([255, 0, 0]);
    expect(at(draw({ cgram: cg }), 255, 223)).toEqual([255, 0, 0]);
    expect(at(draw({ cgram: cg, backdrop: C(0, 31, 0) }), 100, 100)).toEqual([0, 255, 0]);
  });
  it('linhas fora das faixas ficam com o fundo', () => {
    const t = mk(4, 2, { 1: 1 }), cg = palette({ 1: C(0, 0, 31) });
    const bg1 = layer(t, Object.fromEntries(Array.from({ length: 32 * 28 }, (_, i) => [`${i % 32},${i >> 5}`, 1])));
    const img = draw({ cgram: cg, bg1, bands: [band({ y0: 10, y1: 20 })] });
    expect(at(img, 0, 5)).toEqual(BLACK);
    expect(at(img, 0, 10)).toEqual(rgbOf(C(0, 0, 31)));
    expect(at(img, 0, 20)).toEqual(BLACK);
  });
});

describe('PPU: BG 8×8', () => {
  const t = mk(4, 2, { 1: dot(1, 0, 0) });
  const cg = palette({ [2 * 16 + 1]: C(0, 0, 31) });
  const blue = rgbOf(C(0, 0, 31));
  it('vofs = registrador: a linha y mostra a linha y + vofs + 1 do BG', () => {
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: -1 }) }), 16, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: 0 }) }), 16, 23)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: 0 }) }), 16, 24)).toEqual(BLACK);
  });
  it('hofs desloca para a esquerda e dá a volta no mapa', () => {
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: 8 }) }), 8, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: -16 }) }), 32, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: 256 }) }), 16, 24)).toEqual(blue);
  });
  it('h-flip e v-flip do tile', () => {
    const e = 1 | (2 << 10);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0x4000 }) }), 23, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0x8000 }) }), 16, 31)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0xc000 }) }), 23, 31)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0xc000 }) }), 16, 24)).toEqual(BLACK);
  });
  it('BG3 2bpp usa a paleta de 4 cores: índice = 4·pal + cor', () => {
    const t2 = mk(2, 2, { 1: 2 }), cg2 = palette({ 14: C(31, 31, 0) });
    expect(at(draw({ cgram: cg2, bg3: layer(t2, { '0,0': 1 | (3 << 10) }) }), 3, 3)).toEqual(rgbOf(C(31, 31, 0)));
  });
});

describe('PPU: tiles 16×16', () => {
  const t = mk(4, 32, { 2: 1, 3: 2, 18: 3, 19: 4 });
  const cg = palette({ 1: C(31, 0, 0), 2: C(0, 31, 0), 3: C(0, 0, 31), 4: C(31, 31, 31) });
  const bg = (e: number) => layer(t, { '1,1': e }, { tile16: true });
  it('o tile n usa n, n+1, n+16 e n+17', () => {
    const img = draw({ cgram: cg, bg2: bg(2) });
    expect([at(img, 16, 16), at(img, 24, 16), at(img, 16, 24), at(img, 31, 31)]).toEqual([1, 2, 3, 4].map(i => rgbOf(cg[i])));
    expect(at(img, 32, 16)).toEqual(BLACK);
  });
  it('o flip vira o bloco 16×16 inteiro', () => {
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0x4000) }), 16, 16)).toEqual(rgbOf(cg[2]));
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0x8000) }), 16, 16)).toEqual(rgbOf(cg[3]));
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0xc000) }), 16, 16)).toEqual(rgbOf(cg[4]));
  });
  it('bg1Tile16 da faixa e scroll por faixa (HUD 8×8 em cima, campo 16×16 embaixo)', () => {
    const t1 = mk(4, 4, { 1: 1 });
    const bg1 = layer(t1, { '0,0': 1 }, { tile16: true, hofs: 99, vofs: 99 });
    const bands = [band({ y0: 0, y1: 24, bg1Tile16: false, bg1: [0, -1] }), band({ y0: 24, y1: 224, bg1Tile16: true, bg1: [0, -25] })];
    const img = draw({ cgram: cg, bg1, bands });
    expect(at(img, 7, 7)).toEqual(rgbOf(cg[1]));     // 8×8: só o tile 1
    expect(at(img, 8, 0)).toEqual(BLACK);
    expect(at(img, 0, 8)).toEqual(BLACK);
    expect(at(img, 0, 24)).toEqual(rgbOf(cg[1]));    // 16×16: linha 0 do mapa em y = 24
    expect(at(img, 8, 24)).toEqual(BLACK);           // tile 2 vazio
  });
});

describe('PPU: prioridades do modo 1 (BG3 alto)', () => {
  // BG1 → cor 17, BG2 → 33, BG3 (2bpp, pal 0) → 1, OBJ pal 0 → 129
  const cg = palette({ 17: C(31, 0, 0), 33: C(0, 31, 0), 1: C(0, 0, 31), 129: C(31, 31, 0) });
  const t4 = mk(4, 2, { 1: 1 }), t2 = mk(2, 2, { 1: 1 });
  type L = 'bg1' | 'bg2' | 'bg3' | 'obj';
  const color: Record<L, number[]> = { bg1: rgbOf(cg[17]), bg2: rgbOf(cg[33]), bg3: rgbOf(cg[1]), obj: rgbOf(cg[129]) };
  function top(layers: Partial<Record<L, number>>): L | 'fundo' {
    const f: Partial<PpuFrame> = { cgram: cg, oam: [] };
    if (layers.bg1 !== undefined) f.bg1 = layer(t4, { '0,0': 1 | (1 << 10) | (layers.bg1 << 13) });
    if (layers.bg2 !== undefined) f.bg2 = layer(t4, { '0,0': 1 | (2 << 10) | (layers.bg2 << 13) });
    if (layers.bg3 !== undefined) f.bg3 = layer(t2, { '0,0': 1 | (layers.bg3 << 13) });
    if (layers.obj !== undefined) f.oam = [{ x: 0, y: 0, size: 16, pal: 0, prio: layers.obj as 0 | 1 | 2 | 3, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } }];
    const p = at(draw(f), 2, 2);
    return (Object.keys(color) as L[]).find(k => color[k].join() === p.join()) ?? 'fundo';
  }
  it('BG2 prio 1 fica acima de BG1 prio 0; BG1 ganha com prioridades iguais', () => {
    expect(top({ bg1: 0, bg2: 1 })).toBe('bg2');
    expect(top({ bg1: 1, bg2: 1 })).toBe('bg1');
    expect(top({ bg1: 0, bg2: 0 })).toBe('bg1');
  });
  it('OBJ prio 2 entre BG prio 1 e BG prio 0', () => {
    expect(top({ bg1: 0, obj: 2 })).toBe('obj');
    expect(top({ bg1: 1, obj: 2 })).toBe('bg1');
    expect(top({ bg2: 1, obj: 2 })).toBe('bg2');
  });
  it('OBJ prio 1 fica abaixo de BG2 prio 0 e acima de BG3 prio 0; OBJ prio 0 abaixo de tudo', () => {
    expect(top({ bg2: 0, obj: 1 })).toBe('bg2');
    expect(top({ bg3: 0, obj: 1 })).toBe('obj');
    expect(top({ bg3: 0, obj: 0 })).toBe('bg3');
  });
  it('BG3 prio 1 fica acima de tudo, até de OBJ prio 3', () => {
    expect(top({ bg3: 1, obj: 3, bg1: 1 })).toBe('bg3');
    expect(top({ obj: 3, bg1: 1 })).toBe('obj');
  });
  it('máscara `main` da faixa esconde camadas', () => {
    const f = { cgram: cg, bg1: layer(t4, { '0,0': 1 | (1 << 10) }), bg2: layer(t4, { '0,0': 1 | (2 << 10) }) };
    expect(at(draw({ ...f, bands: [band({ main: 2 })] }), 2, 2)).toEqual(color.bg2);
  });
});

describe('PPU: sprites', () => {
  const cg = palette({ 129: C(31, 0, 0), 145: C(0, 31, 0), 17: C(0, 0, 31), 163: C(31, 31, 31), 133: C(9, 9, 9) });
  const solid = (v: number, size = 16) => new Uint8Array(size * size).fill(v);
  const obj = (o: Partial<ObjEntry>): ObjEntry => ({ x: 0, y: 0, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { px: solid(1) }, ...o });
  it('entre sprites, o índice menor fica na frente mesmo com prioridade menor (e leva a prioridade dele)', () => {
    const bg1 = layer(mk(4, 2, { 1: 1 }), { '0,0': 1 | (1 << 10) });      // BG1 prio 0, cor 17
    const oam = [obj({ prio: 0 }), obj({ prio: 3, pal: 1 })];               // 0: cor 129 prio 0; 1: cor 145 prio 3
    expect(at(draw({ cgram: cg, oam }), 2, 2)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam, bg1 }), 2, 2)).toEqual(rgbOf(cg[17]));  // o BG1 prio 0 cobre o sprite 0; o 1 some
    expect(at(draw({ cgram: cg, oam: [obj({ prio: 3 }), obj({ prio: 0, pal: 1 })], bg1 }), 2, 2)).toEqual(rgbOf(cg[129]));
  });
  it('32×32 por tile: linhas de 16 tiles; o x dá a volta dentro da linha', () => {
    const tiles = mk(4, 512, { 0x21: 3, 0x00: 5 });
    const img = draw({ cgram: cg, objTiles: tiles, oam: [obj({ x: 40, y: 50, size: 32, pal: 2, src: { tile: 0x10 } }), obj({ x: 0, y: 100, src: { tile: 0x0f } })] });
    expect(at(img, 48, 58)).toEqual(rgbOf(cg[163]));   // tile 0x10 + 1 + 16 = 0x21, cor 128 + 2·16 + 3
    expect(at(img, 55, 65)).toEqual(rgbOf(cg[163]));
    expect(at(img, 47, 58)).toEqual(BLACK);
    expect(at(img, 8, 100)).toEqual(rgbOf(cg[133]));   // tile 0x0F + 1 → 0x00 (não 0x10)
    const flipped = draw({ cgram: cg, objTiles: tiles, oam: [obj({ x: 40, y: 50, size: 32, pal: 2, hflip: true, src: { tile: 0x10 } })] });
    expect(at(flipped, 56, 58)).toEqual(rgbOf(cg[163]));
    expect(at(flipped, 48, 58)).toEqual(BLACK);
  });
  it('src.px com flips; corta nas bordas da tela', () => {
    const p = new Uint8Array(256); p[0] = 1;
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, src: { px: p } })] }), 100, 100)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, hflip: true, src: { px: p } })] }), 115, 100)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, vflip: true, src: { px: p } })] }), 100, 115)).toEqual(rgbOf(cg[129]));
    const edge = draw({ cgram: cg, oam: [obj({ x: -8, y: 0 }), obj({ x: 250, y: 30 })] });
    expect(at(edge, 7, 0)).toEqual(rgbOf(cg[129]));
    expect(at(edge, 8, 0)).toEqual(BLACK);
    expect(at(edge, 255, 30)).toEqual(rgbOf(cg[129]));
  });
});

describe('PPU: color math por faixa', () => {
  const cg = palette({ 17: C(20, 10, 4), 33: C(10, 31, 0), 193: C(2, 2, 2), 177: C(2, 2, 2) });
  const t = mk(4, 2, { 1: 1 });
  // (0,0): BG1 sobre BG2; (8,0): só BG1; (16,0): só BG2
  const f = (math: 'half' | 'add', extra: Partial<ScanBand> = {}, oam: ObjEntry[] = []): ImageData => draw({
    cgram: cg, oam,
    bg1: layer(t, { '0,0': 1 | (1 << 10), '1,0': 1 | (1 << 10) }),
    bg2: layer(t, { '0,0': 1 | (2 << 10), '2,0': 1 | (2 << 10) }),
    bands: [band({ main: 1 | 2 | 16, sub: 2, math, ...extra })],
  });
  it("'half' = média em 5 bits; sem BG2 embaixo, não muda", () => {
    const img = f('half');
    expect(at(img, 0, 0)).toEqual(rgbOf(C(15, 20, 2)));
    expect(at(img, 8, 0)).toEqual(rgbOf(C(20, 10, 4)));
    expect(at(img, 16, 0)).toEqual(rgbOf(C(10, 31, 0)));
  });
  it("'add' = soma saturada", () => {
    expect(at(f('add'), 0, 0)).toEqual(rgbOf(C(30, 31, 4)));
  });
  it('só as camadas de mathLayers (padrão BG1); OBJ só com paleta 4–7', () => {
    const spr = (pal: number): ObjEntry => ({ x: 0, y: 0, size: 16, pal, prio: 3, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } });
    expect(at(f('add', {}, [spr(4)]), 0, 0)).toEqual(rgbOf(C(2, 2, 2)));
    expect(at(f('add', { mathLayers: 16 }, [spr(4)]), 0, 0)).toEqual(rgbOf(C(12, 31, 2)));
    expect(at(f('add', { mathLayers: 16 }, [spr(3)]), 0, 0)).toEqual(rgbOf(C(2, 2, 2)));
  });
});

describe('PPU: modo 7 mínimo', () => {
  const chr = new Uint8Array(0x4000); chr.fill(7, 64, 128);           // tile 1 = cor 7
  const map = new Uint8Array(0x4000); map[0] = 1; map[127] = 1;
  const cg = palette({ 7: C(31, 0, 31), 129: C(0, 31, 0) });
  const m7 = { chr, map, a: 256, b: 0, c: 0, d: 256, cx: 0, cy: 0, hofs: 0, vofs: 0, outside: 'transparent' as const };
  it('identidade: pixel (x, y) do plano', () => {
    const img = draw({ cgram: cg, mode7: m7 });
    expect(at(img, 0, 0)).toEqual(rgbOf(cg[7]));
    expect(at(img, 7, 7)).toEqual(rgbOf(cg[7]));
    expect(at(img, 8, 0)).toEqual(BLACK);
  });
  it('escala 2× (a = d = 128)', () => {
    const img = draw({ cgram: cg, mode7: { ...m7, a: 128, d: 128 } });
    expect(at(img, 15, 15)).toEqual(rgbOf(cg[7]));
    expect(at(img, 16, 0)).toEqual(BLACK);
  });
  it("fora do plano: 'transparent' não desenha, 'wrap' repete", () => {
    expect(at(draw({ cgram: cg, mode7: { ...m7, hofs: -8 } }), 0, 0)).toEqual(BLACK);
    expect(at(draw({ cgram: cg, mode7: { ...m7, hofs: -8, outside: 'wrap' } }), 0, 0)).toEqual(rgbOf(cg[7]));
  });
  it('OBJ prio 0 atrás do plano, prio 1 na frente', () => {
    const o = (prio: 0 | 1): ObjEntry => ({ x: 0, y: 0, size: 16, pal: 0, prio, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } });
    expect(at(draw({ cgram: cg, mode7: m7, oam: [o(0)] }), 0, 0)).toEqual(rgbOf(cg[7]));
    expect(at(draw({ cgram: cg, mode7: m7, oam: [o(1)] }), 0, 0)).toEqual(rgbOf(cg[129]));
  });
});

describe('PPU: desempenho', () => {
  it('quadro sintético com 3 BGs, faixas e 64 sprites: mediana < 4 ms', () => {
    let s = 1; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s; };
    const t4 = mk(4, 1024, {}); for (let i = 0; i < t4.px.length; i++) t4.px[i] = rnd() & 15;
    const t2 = mk(2, 512, {}); for (let i = 0; i < t2.px.length; i++) t2.px[i] = rnd() & 3;
    const map = () => Uint16Array.from({ length: 1024 }, () => rnd() & 0xffff);
    const cgram = Uint16Array.from({ length: 256 }, () => rnd() & 0x7fff);
    const oam: ObjEntry[] = Array.from({ length: 64 }, (_, i) => ({ x: (i * 37) % 256, y: (i * 53) % 224, size: i % 2 ? 32 : 16,
      pal: i & 7, prio: (i & 3) as 0 | 1 | 2 | 3, hflip: !!(i & 4), vflip: !!(i & 8), src: { tile: (i * 4) & 0x1ff } }));
    const f: PpuFrame = { cgram, oam, objTiles: mk(4, 512, {}),
      bg1: { map: map(), mapW: 32, tiles: t4, tile16: true, hofs: 8, vofs: -25 },
      bg2: { map: map(), mapW: 32, tiles: t4, tile16: true, hofs: 8, vofs: -25 },
      bg3: { map: map(), mapW: 32, tiles: t2, tile16: false, hofs: 0, vofs: 0 },
      bands: [band({ y0: 0, y1: 24, bg1: [8, -33] }), band({ y0: 24, y1: 224, bg1Tile16: true, sub: 2, math: 'half' })] };
    const img = createImage(), t: number[] = [];
    for (let i = 0; i < 40; i++) { const t0 = performance.now(); renderPpu(f, img); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b);
    expect(t[20]).toBeLessThan(4);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/rom/ppu.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** `web/src/render/ppu/render.ts`:

```ts
// PPU de software (spec §2.4): PpuFrame → ImageData 256×224. Sem DOM; roda no Node.
import type { BgLayer, Mode7Layer, ObjEntry, PpuFrame, ScanBand } from './types';

const W = 256;
const BG1 = 1, BG2 = 2, BG3 = 4, OBJ = 16, BACK = 32;
// Posto na ordem de prioridade do modo 1 com BG3 alto (menor = na frente) [ANI §1.4, ARN §2.1].
const RANK_BG1 = [5, 2], RANK_BG2 = [6, 3], RANK_BG3 = [8, 0], RANK_OBJ = [9, 7, 4, 1];
// Modo 7: OBJ3 > OBJ2 > OBJ1 > BG1 > OBJ0.
const RANK7_BG1 = 3, RANK7_OBJ = [4, 2, 1, 0];

// Buffers de linha reaproveitados: índice na CGRAM + 1 (0 = transparente) e prioridade.
const l1 = new Int16Array(W), l2 = new Int16Array(W), l3 = new Int16Array(W), lo = new Int16Array(W);
const p1 = new Uint8Array(W), p2 = new Uint8Array(W), p3 = new Uint8Array(W), po = new Uint8Array(W), pal = new Uint8Array(W);
const pal32 = new Uint32Array(256);

function mod(a: number, n: number): number { return ((a % n) + n) % n; }

function bgLine(L: BgLayer, tile16: boolean, hofs: number, vofs: number, y: number, out: Int16Array, pri: Uint8Array): void {
  const ts = tile16 ? 16 : 8, mapW = L.mapW, mapH = (L.map.length / mapW) | 0;
  const by = mod(y + vofs + 1, mapH * ts), row = (by / ts) | 0, fy = by % ts, wpx = mapW * ts;
  const px = L.tiles.px, count = L.tiles.count, two = L.tiles.bpp === 2;
  for (let x = 0; x < W; x++) {
    const bx = mod(x + hofs, wpx), e = L.map[row * mapW + ((bx / ts) | 0)];
    let fx = bx % ts, gy = fy;
    if (e & 0x4000) fx = ts - 1 - fx;
    if (e & 0x8000) gy = ts - 1 - gy;
    let t = e & 0x3ff;
    if (tile16) t = (t + (fx >> 3) + 16 * (gy >> 3)) & 0x3ff;
    const v = t < count ? px[t * 64 + (gy & 7) * 8 + (fx & 7)] : 0;
    if (v) { const p = (e >> 10) & 7; out[x] = (two ? p * 4 + v : p * 16 + v) + 1; pri[x] = (e >> 13) & 1; }
    else out[x] = 0;
  }
}

function objLine(f: PpuFrame, y: number): void {
  lo.fill(0);
  const tiles = f.objTiles;
  // Do maior índice para o menor: o índice menor sobrescreve e fica na frente, qualquer que seja a prioridade.
  for (let i = f.oam.length - 1; i >= 0; i--) {
    const e: ObjEntry = f.oam[i], size = e.size;
    let sy = y - e.y;
    if (sy < 0 || sy >= size) continue;
    if (e.vflip) sy = size - 1 - sy;
    for (let sx = 0; sx < size; sx++) {
      const X = e.x + sx;
      if (X < 0 || X >= W) continue;
      const fx = e.hflip ? size - 1 - sx : sx;
      let v = 0;
      if ('px' in e.src) v = e.src.px[sy * size + fx];
      else if (tiles) {
        const n = e.src.tile;
        const t = (n & 0x100) | ((((n >> 4) + (sy >> 3)) & 0xf) << 4) | ((n + (fx >> 3)) & 0xf);
        v = t < tiles.count ? tiles.px[t * 64 + (sy & 7) * 8 + (fx & 7)] : 0;
      }
      if (v) { lo[X] = 128 + e.pal * 16 + v + 1; po[X] = e.prio; pal[X] = e.pal; }
    }
  }
}

function m7Line(m: Mode7Layer, y: number, out: Int16Array): void {
  const sy = y + m.vofs - m.cy;
  for (let x = 0; x < W; x++) {
    const sx = x + m.hofs - m.cx;
    let u = ((m.a * sx + m.b * sy) >> 8) + m.cx, v = ((m.c * sx + m.d * sy) >> 8) + m.cy;
    if (u < 0 || u >= 1024 || v < 0 || v >= 1024) {
      if (m.outside === 'transparent') { out[x] = 0; continue; }
      u &= 1023; v &= 1023;
    }
    const c = m.chr[m.map[(v >> 3) * 128 + (u >> 3)] * 64 + (v & 7) * 8 + (u & 7)];
    out[x] = c ? c + 1 : 0;
  }
}

/** Escolhe o pixel da frente entre as camadas da máscara. Devolve o índice na CGRAM + 1 (0 = fundo) e grava a camada em `hit`. */
const hit = { layer: BACK, x: 0 };
function pick(x: number, mask: number, m7: boolean): number {
  let best = 99, idx = 0, layer = BACK;
  if (mask & BG1 && l1[x]) { const r = m7 ? RANK7_BG1 : RANK_BG1[p1[x]]; if (r < best) { best = r; idx = l1[x]; layer = BG1; } }
  if (!m7 && mask & BG2 && l2[x]) { const r = RANK_BG2[p2[x]]; if (r < best) { best = r; idx = l2[x]; layer = BG2; } }
  if (!m7 && mask & BG3 && l3[x]) { const r = RANK_BG3[p3[x]]; if (r < best) { best = r; idx = l3[x]; layer = BG3; } }
  if (mask & OBJ && lo[x]) { const r = m7 ? RANK7_OBJ[po[x]] : RANK_OBJ[po[x]]; if (r < best) { best = r; idx = lo[x]; layer = OBJ; } }
  hit.layer = layer; hit.x = x;
  return idx;
}

function rgba(v: number): number {
  const r = v & 31, g = (v >> 5) & 31, b = (v >> 10) & 31;
  return (0xff000000 | (((b << 3) | (b >> 2)) << 16) | (((g << 3) | (g >> 2)) << 8) | ((r << 3) | (r >> 2))) >>> 0;
}

function blend(a: number, b: number, half: boolean): number {
  let r = (a & 31) + (b & 31), g = ((a >> 5) & 31) + ((b >> 5) & 31), bl = ((a >> 10) & 31) + ((b >> 10) & 31);
  if (half) { r >>= 1; g >>= 1; bl >>= 1; } else { r = Math.min(31, r); g = Math.min(31, g); bl = Math.min(31, bl); }
  return r | (g << 5) | (bl << 10);
}

export function renderPpu(f: PpuFrame, out: ImageData): void {
  const px32 = new Uint32Array(out.data.buffer, out.data.byteOffset, W * out.height);
  const back = f.backdrop ?? f.cgram[0];
  for (let i = 0; i < 256; i++) pal32[i] = rgba(f.cgram[i]);
  const backRgba = rgba(back);
  px32.fill(backRgba);
  const m7 = f.mode7;
  for (const band of f.bands as ScanBand[]) {
    const need = band.main | (band.math !== 'none' ? band.sub : 0);
    const mathLayers = band.mathLayers ?? BG1;
    for (let y = Math.max(0, band.y0); y < Math.min(out.height, band.y1); y++) {
      if (m7) { if (need & BG1) m7Line(m7, y, l1); else l1.fill(0); l2.fill(0); l3.fill(0); }
      else {
        if (need & BG1 && f.bg1) bgLine(f.bg1, band.bg1Tile16, band.bg1?.[0] ?? f.bg1.hofs, band.bg1?.[1] ?? f.bg1.vofs, y, l1, p1); else l1.fill(0);
        if (need & BG2 && f.bg2) bgLine(f.bg2, f.bg2.tile16, band.bg2?.[0] ?? f.bg2.hofs, band.bg2?.[1] ?? f.bg2.vofs, y, l2, p2); else l2.fill(0);
        if (need & BG3 && f.bg3) bgLine(f.bg3, f.bg3.tile16, f.bg3.hofs, f.bg3.vofs, y, l3, p3); else l3.fill(0);
      }
      if (need & OBJ) objLine(f, y); else lo.fill(0);
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = pick(x, band.main, !!m7), layer = hit.layer;
        if (band.math !== 'none' && (mathLayers & layer) && (layer !== OBJ || pal[x] >= 4)) {
          const s = pick(x, band.sub, !!m7);
          // Sub transparente: entra a cor fixa (0) e o 'half' não divide → pixel inalterado.
          if (s) { px32[row + x] = rgba(blend(i ? f.cgram[i - 1] : back, f.cgram[s - 1], band.math === 'half')); continue; }
        }
        px32[row + x] = i ? pal32[i - 1] : backRgba;
      }
    }
  }
}
```

`web/src/render/ppu/image.ts`:

```ts
// ImageData no navegador e no Node (o Node não tem ImageData): só `width`, `height` e `data` são usados.
export function createImage(width = 256, height = 224): ImageData {
  if (typeof ImageData !== 'undefined') return new ImageData(width, height);
  return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' } as ImageData;
}
```

`web/src/render/ppu/index.ts`:

```ts
export type { BgLayer, ScanBand, ObjEntry, Mode7Layer, PpuFrame } from './types';
export { renderPpu } from './render';
export { createImage } from './image';
```

- [ ] **Step 4: Rodar.** `npx vitest run tests/rom/ppu.test.ts` → 25 passam. Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add web/src/render/ppu/render.ts web/src/render/ppu/image.ts web/src/render/ppu/index.ts web/tests/rom/ppu.test.ts
git commit -m "feat(ppu): PPU de software (modo 1 com faixas, prioridades, color math e OBJ; modo 7 mínimo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 3

### Task 10: Arenas (`ArenaAssets`, montagem de referência) e golden de render

**Possui:** `web/src/rom/assets-arena.ts`, `web/src/rom/arena-build.ts`, `web/tests/rom/assets-arena.test.ts`, `web/tests/rom/ppu-golden.test.ts`.

**Files:**
- Create: os 2 módulos e os 2 testes.

**Interfaces:**
- Produces:
  - `ARENA_TABLE`, `HUD_MAP`, `HUD_TABLE`, `ArenaRecord`, `arenaRecord(rom, stage)`, `arenaTileBytes(rom, stage, upload?)`, `patchPressureTiles(rom, buf)`, `arenaBgCgram(rom, stage)`, `hudMap(rom)`, `objCommonBytes(rom, stage)`, `loadArena(rom, stage): ArenaAssets`;
  - `FALLBACK_LIST`, `DEFAULT_SPAWNS`, `ArenaBuild`, `fallbackList(rom)`, `buildArena(rom, stage, seed?, spawns?)`, `staticObjects(rom, stage)`, `applyStatic(bg2, objs)`.
- Consumes: T6 (`decodeZte`, `compositeFloor`, `arena9Post`, `readBgr555`, `decodeTiles`), T7 (`decodeMapCodes`, `codesToEntries`, `codesToLogic`, `logicOf`, `decodeTileAnim`, `tileAnimKey`), T9 (`renderPpu`, `createImage`), fixtures das T3 e T4.
- Modelos portados: `arena_rom.py` (`arena_record`, `arena_gfx`, `build_arena`, `fallback_offsets`), `decomp.arena_bg_palettes`, `render_rom.py` (`hud_entries`, `apply_static_objects`, `COLOR_MATH`).

- [ ] **Step 1: Escrever os testes.** `web/tests/rom/assets-arena.test.ts`:

```ts
import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadArena, objCommonBytes, arenaTileBytes, arenaBgCgram } from '../../src/rom/assets-arena';
import { buildArena, staticObjects, applyStatic, fallbackList } from '../../src/rom/arena-build';
import { tileAnimKey } from '../../src/rom/decode/tileanim';
import { decodeMapCodes } from '../../src/rom/decode/tilemap';
import type { Tiles } from '../../src/rom/types';

interface ArenaFx {
  arena: number; record: number; script: number; removeN: number; colorMath: string; tilesLoadedSha1: string;
  bg1: { used: number; sha1: string }; bg2Base: { used: number; sha1: string }; floor: { used: number; sha1: string };
  logicBaseSha1: string;
  build: { seedIn: number; seedOut: number; soft: number; bg2Sha1: string; logicSha1: string; floorSha1: string };
  staticBg2Sha1: string; tileAnim: { addr: number; count: number; key: string } | null;
}
interface Fx {
  arenas: ArenaFx[]; hud: { baseSha1: string; startSha1: string };
  fallback: { count: number; first: number[]; sha1: string };
  objCommon: Record<'1' | '3', string>; bg3: { fontSha1: string; bannersSha1: string }; objPal7Sha1: string;
}

/** Re-codifica Tiles 4bpp/2bpp em bytes planares do SNES (para comparar com os hashes dos bytes). */
function encodeTiles(t: Tiles): Uint8Array {
  const size = 8 * t.bpp, out = new Uint8Array(t.count * size);
  for (let n = 0; n < t.count; n++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = t.px[n * 64 + y * 8 + x], bit = 0x80 >> x, b = n * size;
    if (v & 1) out[b + 2 * y] |= bit;
    if (v & 2) out[b + 2 * y + 1] |= bit;
    if (v & 4) out[b + 16 + 2 * y] |= bit;
    if (v & 8) out[b + 17 + 2 * y] |= bit;
  }
  return out;
}

describe.skipIf(!ROM)('ArenaAssets das 10 arenas (gfx-arenas.json)', () => {
  const fx = fixture<Fx>('gfx-arenas.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  for (const e of fx.arenas) it(`arena ${e.arena}`, () => {
    const a = loadArena(view, e.arena);
    expect(a.stage).toBe(e.arena);
    expect(a.record).toBe(e.record);
    expect(a.removeN).toBe(e.removeN);
    expect(a.colorMath).toBe(e.colorMath);
    expect(a.bgTiles.count).toBe(1024);
    expect(sha1Hex(encodeTiles(a.bgTiles))).toBe(e.tilesLoadedSha1);
    expect(sha1Hex(u16le(a.bg1))).toBe(e.bg1.sha1);
    expect(sha1Hex(u16le(a.bg2Base))).toBe(e.bg2Base.sha1);
    expect(sha1Hex(u16le(a.floor))).toBe(e.floor.sha1);
    expect(sha1Hex(u16le(a.logicBase))).toBe(e.logicBaseSha1);
    expect(a.hudMap).toHaveLength(96);
    expect(sha1Hex(u16le(a.hudMap))).toBe(fx.hud.baseSha1);
    if (e.tileAnim) expect(sha1Hex(tileAnimKey(a.tileAnim!))).toBe(e.tileAnim.key);
    else expect(a.tileAnim).toBeNull();
    expect(a.tileAnim?.length ?? null).toBe(e.tileAnim?.count ?? null);
    expect(sha1Hex(encodeTiles(a.objCommon))).toBe(e.arena === 3 ? fx.objCommon['3'] : fx.objCommon['1']);
    expect(sha1Hex(encodeTiles(a.bg3Font))).toBe(fx.bg3.fontSha1);
    expect(sha1Hex(encodeTiles(a.bg3Banners))).toBe(fx.bg3.bannersSha1);
    expect(sha1Hex(u16le(a.objCgram.subarray(112)))).toBe(fx.objPal7Sha1);
    expect([...a.objCgram.subarray(0, 112)].every(v => v === 0)).toBe(true);
  });
  it('mapas: bytes consumidos pelo decodificador', () => {
    for (const e of fx.arenas) {
      const rec = { bg1: view.p24(e.record + 3), bg2: view.p24(e.record + 9), floor: view.p24(e.record + 0x0c) };
      expect([decodeMapCodes(view, rec.bg1).used, decodeMapCodes(view, rec.bg2).used, decodeMapCodes(view, rec.floor).used])
        .toEqual([e.bg1.used, e.bg2Base.used, e.floor.used]);
    }
  });
  it('carga com semente $C689 e 5 jogadores = arena_rom.build_arena (80/80/80/70/0/80/62/0/78/80)', () => {
    expect(fx.arenas.map(e => e.build.soft)).toEqual([80, 80, 80, 70, 0, 80, 62, 0, 78, 80]);
    for (const e of fx.arenas) {
      const b = buildArena(view, e.arena, e.build.seedIn);
      expect({ seed: b.seed, soft: b.soft }).toEqual({ seed: e.build.seedOut, soft: e.build.soft });
      expect(sha1Hex(u16le(b.bg2))).toBe(e.build.bg2Sha1);
      expect(sha1Hex(u16le(b.logic))).toBe(e.build.logicSha1);
      expect(sha1Hex(u16le(b.floor))).toBe(e.build.floorSha1);
      applyStatic(b.bg2, staticObjects(view, e.arena));
      expect(sha1Hex(u16le(b.bg2))).toBe(e.staticBg2Sha1);
    }
  });
  it('lista $C4:1327: 113 casas', () => {
    const fb = fallbackList(view);
    expect(fb).toHaveLength(fx.fallback.count);
    expect(fb.slice(0, 3)).toEqual(fx.fallback.first);
    expect(sha1Hex(u16le(Uint16Array.from(fb)))).toBe(fx.fallback.sha1);
  });
  it('setas da arena 7 e pads da arena 8 nas casas da spec §4.6/§4.7', () => {
    const cell = (o: { off: number }) => [(o.off >> 1) % 32, (o.off >> 1) >> 5];   // (col, lin)
    expect(staticObjects(view, 7).map(o => [...cell(o), o.word])).toEqual([[4, 3, 0x1cc2], [4, 9, 0x1cc0], [12, 3, 0x1cc4], [12, 9, 0x1cc6]]);
    expect(staticObjects(view, 8).map(cell)).toEqual([[4, 7], [8, 7], [12, 7]]);
  });
  it('OBJ comuns: 16 KB', () => {
    expect(objCommonBytes(view, 1)).toHaveLength(0x4000);
  });
});

describe.skipIf(!ROM)('BG das arenas × decomp.py (gfx-formats.json)', () => {
  const fx = fixture<{ arenaUploads: { arena: number; upload: 1 | 2; sha1: string }[]; arenaPalettes: { arena: number; sha1: string }[] }>('gfx-formats.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('11 envios de 32 KB (o 2º da arena 9 depois de arena9Post)', () => {
    expect(fx.arenaUploads).toHaveLength(11);
    for (const u of fx.arenaUploads) expect(sha1Hex(arenaTileBytes(view, u.arena, u.upload))).toBe(u.sha1);
  });
  it('paletas de BG das 10 arenas (CGRAM 0–127 com a correção $C4:4E2F)', () => {
    for (const p of fx.arenaPalettes) expect(sha1Hex(u16le(arenaBgCgram(view, p.arena)))).toBe(p.sha1);
  });
});
```

`web/tests/rom/ppu-golden.test.ts`. O quadro segue a §7.1 e o `render_rom.py`:
- faixa do HUD com BG1 8×8, `[8, −33]`, só o BG1;
- faixa do campo com BG1/BG2 16×16, `[hofs, −25]` e `[8, −25]`, e sub = BG2 quando há *color math*;
- o HUD vai nas linhas 28–30 do mapa do BG1.

```ts
import { ROM, fixture, sha1Hex } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadArena } from '../../src/rom/assets-arena';
import { buildArena, staticObjects, applyStatic } from '../../src/rom/arena-build';
import { renderPpu, createImage, type PpuFrame } from '../../src/render/ppu';

function hudWithStart(hud: Uint16Array): Uint16Array {
  const h = hud.slice();
  const put = (r: number, c: number, t: number) => { h[r * 32 + c] = (h[r * 32 + c] & 0xfc00) | (0x200 + t); };
  for (let r = 0; r < 3; r++) {
    put(r, 4, 0x32 + 0x10 * r); put(r, 5, 0x3a + 0x10 * r); put(r, 6, 0x39 + 0x10 * r); put(r, 7, 0x39 + 0x10 * r);
    for (let k = 0; k < 5; k++) { put(r, 10 + 4 * k, 0x01 + 2 * k + 0x10 * r); put(r, 11 + 4 * k, 0x02 + 2 * k + 0x10 * r); }
  }
  for (let k = 0; k < 5; k++) put(1, 12 + 4 * k, 0x4f);
  return h;
}

function arenaFrame(view: RomView, stage: number, bg1Hofs: number): PpuFrame {
  const a = loadArena(view, stage);
  const b = buildArena(view, stage);
  applyStatic(b.bg2, staticObjects(view, stage));
  const bg1 = a.bg1.slice(); bg1.set(hudWithStart(a.hudMap), 28 * 32);
  const cgram = new Uint16Array(256); cgram.set(a.bgCgram, 0);
  const math = a.colorMath;
  return {
    cgram, oam: [],
    bg1: { map: bg1, mapW: 32, tiles: a.bgTiles, tile16: true, hofs: 8, vofs: -25 },
    bg2: { map: b.bg2, mapW: 32, tiles: a.bgTiles, tile16: true, hofs: 8, vofs: -25 },
    bands: [
      { y0: 0, y1: 24, bg1Tile16: false, bg1: [8, -33], main: 1, sub: 0, math: 'none' },
      { y0: 24, y1: 224, bg1Tile16: true, bg1: [bg1Hofs, -25], bg2: [8, -25], main: 3, sub: math === 'none' ? 0 : 2, math },
    ],
  };
}

describe.skipIf(!ROM)('render só de BG = render_rom.py', () => {
  const view = new RomView(ROM!);
  const fx = fixture<{ arenas: { stage: number; bg1Hofs: number; tileCopies: [number, number][]; sha1: string }[] }>('gfx-render-bg.json');
  for (const r of fx.arenas) it(`arena ${r.stage} (HOFS do BG1 ${r.bg1Hofs})`, () => {
    expect(r.tileCopies).toEqual([]);
    const img = createImage();
    renderPpu(arenaFrame(view, r.stage, r.bg1Hofs), img);
    expect(sha1Hex(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength))).toBe(r.sha1);
  });
  it('renderPpu de uma arena abaixo de 4 ms', () => {
    const f = arenaFrame(view, 2, 8), img = createImage(), t: number[] = [];
    for (let i = 0; i < 40; i++) { const t0 = performance.now(); renderPpu(f, img); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y);
    console.log('mediana ms', t[20]);
    expect(t[20]).toBeLessThan(4);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `SB4_ROM="…" npx vitest run tests/rom/assets-arena tests/rom/ppu-golden` → FAIL.

- [ ] **Step 3: Implementar.** Armadilhas:
  - cada bloco ZTE ocupa exatamente `$1000` (`subarray(0, 0x1000)` num buffer zerado);
  - a correção `$C4:4E2F` copia as cores 13–15 da pal. 7 para as pal. 2 **e** 3;
  - `removeN` é o byte `rec+$1E`;
  - na montagem, `clear(i)` usa a entrada **e** o lógico do mapa do piso;
  - 15 tentativas antes da lista `$C4:1327`; a lista sem soft termina o laço.

`web/src/rom/assets-arena.ts`:

```ts
// Assets de uma arena [GFX §3.1–3.2, ARN §2.2–2.3, §3, §4]. Porte de arena_rom.arena_gfx + decomp.arena_bg_palettes.
import type { ArenaAssets, PalAnim } from './types';
import type { RomView } from './view';
import { decodeZte } from './decode/zte';
import { compositeFloor } from './decode/composite';
import { arena9Post } from './decode/arena9';
import { readBgr555 } from './decode/palette';
import { decodeTiles } from './decode/tiles';
import { decodeMapCodes, codesToEntries, codesToLogic } from './decode/tilemap';
import { decodeTileAnim } from './decode/tileanim';

export const ARENA_TABLE = 0xc36233;          // 3 bytes por arena (variante 0)
export const HUD_MAP = 0xd68eec, HUD_TABLE = 0xd68f72;
const COLOR_MATH: Record<number, 'half' | 'add'> = { 2: 'half', 6: 'half', 10: 'add' };   // [ARN §2.1]
const PAL_ANIM: Record<number, { addr: number; frames: number; ticks: number }> = {
  9: { addr: 0xd7dddc, frames: 6, ticks: 14 },    // pal. 5, ciclo 84 [ARN §3.2]
  10: { addr: 0xd7e47c, frames: 4, ticks: 15 },   // pal. 5, ciclo 60
};

export interface ArenaRecord {
  addr: number; gfx: number; bg1Map: number; bg1Tbl: number; bg2Map: number; floorMap: number; bg2Tbl: number;
  tileAnim: number; removeN: number;
}

export function arenaRecord(rom: RomView, stage: number): ArenaRecord {
  if (!(stage >= 1 && stage <= 10)) throw new RangeError(`fase inválida: ${stage}`);
  const a = rom.p24(ARENA_TABLE + 3 * (stage - 1));
  return { addr: a, gfx: rom.p24(a), bg1Map: rom.p24(a + 3), bg1Tbl: rom.p24(a + 6), bg2Map: rom.p24(a + 9),
    floorMap: rom.p24(a + 0x0c), bg2Tbl: rom.p24(a + 0x0f), tileAnim: rom.u24(a + 0x12), removeN: rom.u8(a + 0x1e) };
}

/** 32 KB de tiles de BG como o jogo os envia à VRAM: 8 blocos ZTE ($1000 cada) + composição do piso.
 *  `upload` 2 = segundo envio da arena 9 (depois de arena9Post). */
export function arenaTileBytes(rom: RomView, stage: number, upload: 1 | 2 = stage === 9 ? 2 : 1): Uint8Array {
  const r = arenaRecord(rom, stage), buf = new Uint8Array(0x8000);
  for (let i = 0; i < 8; i++) buf.set(decodeZte(rom.data, rom.p24(r.gfx + 3 * i)).data.subarray(0, 0x1000), 0x1000 * i);
  compositeFloor(buf);
  if (upload === 2) arena9Post(buf);
  return buf;
}

/** Tiles 46/47 e 62/63 que o jogo copia de $C5:FE5C na carga (bloco de pressão `082E`) [GFX §3.2]. */
export function patchPressureTiles(rom: RomView, buf: Uint8Array): void {
  const d = decodeZte(rom.data, 0xc5fe5c).data;
  buf.set(d.subarray(0, 64), 46 * 32);
  buf.set(d.subarray(512, 576), 62 * 32);
}

/** CGRAM 0–127 do BG: 8 paletas do script + correção $C4:4E2F (cores 13–15 da pal. 7 → pal. 2 e 3). */
export function arenaBgCgram(rom: RomView, stage: number): Uint16Array {
  const r = arenaRecord(rom, stage), out = new Uint16Array(128);
  for (let i = 0; i < 8; i++) out.set(readBgr555(rom.bytes(rom.p24(r.gfx + 24 + 3 * i), 32), 0, 16), 16 * i);
  for (const k of [13, 14, 15]) { out[32 + k] = out[112 + k]; out[48 + k] = out[112 + k]; }
  return out;
}

export function hudMap(rom: RomView): Uint16Array {
  const e = codesToEntries(rom, decodeMapCodes(rom, HUD_MAP, 96).codes, HUD_TABLE);
  for (let i = 0; i < 96; i++) e[i] = (e[i] + 0x2200) & 0xffff;
  return e;
}

/** OBJ $6000–$7FFF (16 KB) comum à partida [CAT §3]; as vagas 32×32 dos jogadores ficam zeradas. */
export function objCommonBytes(rom: RomView, stage: number): Uint8Array {
  const buf = new Uint8Array(0x4000), z = (a: number) => decodeZte(rom.data, a).data;
  const at = (word: number) => (word - 0x6000) * 2;
  buf.set(z(0xc8fd36).subarray(0, 0x800), at(0x6800));
  buf.set(z(0xd187ce).subarray(0, 0x800), at(0x7000));
  buf.set(z(0xd18f93).subarray(0, 0x800), at(0x7400));
  buf.set(z(0xd1967f).subarray(0, 0x800), at(0x7800));
  buf.set(z(0xc5013b).subarray(0, 0x800), at(0x7c00));
  const box = z(0xc7fea1);
  buf.set(box.subarray(0, 128), at(0x64c0));
  buf.set(box.subarray(512, 640), at(0x65c0));
  if (stage === 3) {                               // $C8:FA44: bolas da arena 3, tiles 0–5 e 16–21 sobre $7C00
    const orb = z(0xc8fa44);
    for (const t of [0, 1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21]) buf.set(orb.subarray(32 * t, 32 * t + 32), at(0x7c00) + 32 * t);
  }
  return buf;
}

export function loadArena(rom: RomView, stage: number): ArenaAssets {
  const r = arenaRecord(rom, stage);
  const tiles = arenaTileBytes(rom, stage);
  patchPressureTiles(rom, tiles);
  const bg2Codes = decodeMapCodes(rom, r.bg2Map).codes;
  const objCgram = new Uint16Array(128);
  objCgram.set(readBgr555(rom.bytes(0xd7e6dc, 32), 0, 16), 112);
  const pa = PAL_ANIM[stage];
  const palAnim: PalAnim[] = pa ? [{ first: 80, period: pa.ticks,
    frames: Array.from({ length: pa.frames }, (_, k) => readBgr555(rom.bytes(pa.addr + 32 * k, 32), 0, 16)) }] : [];
  return {
    stage, record: r.addr,
    bgTiles: decodeTiles(tiles, 4),
    bgCgram: arenaBgCgram(rom, stage),
    bg1: codesToEntries(rom, decodeMapCodes(rom, r.bg1Map).codes, r.bg1Tbl),
    bg2Base: codesToEntries(rom, bg2Codes, r.bg2Tbl),
    floor: codesToEntries(rom, decodeMapCodes(rom, r.floorMap).codes, r.bg2Tbl),
    logicBase: codesToLogic(rom, bg2Codes),
    removeN: r.removeN,
    tileAnim: r.tileAnim ? decodeTileAnim(rom, r.tileAnim) : null,
    palAnim,
    colorMath: COLOR_MATH[stage] ?? 'none',
    hudMap: hudMap(rom),
    bg3Font: decodeTiles(rom.bytes(0xd1bc16, 1024), 2),
    bg3Banners: decodeTiles(rom.bytes(0xd0f57b, 1024), 2),
    objCommon: decodeTiles(objCommonBytes(rom, stage), 4),
    objCgram,
  };
}
```

`web/src/rom/arena-build.ts`:

```ts
// Montagem de referência da arena na carga [ARN §2.4]: 3×3 dos spawns + remoção de N soft pelo RNG do jogo.
// Porte de arena_rom.build_arena e render_rom.apply_static_objects. O núcleo (plano 6) tem a sua própria montagem;
// esta serve aos goldens e a ferramentas de conferência.
import type { RomView } from './view';
import { arenaRecord } from './assets-arena';
import { decodeMapCodes, codesToEntries, logicOf } from './decode/tilemap';

export const FALLBACK_LIST = 0xc41327;
/** (col, lin) de P1..P5 [spec §3.1]. */
export const DEFAULT_SPAWNS: ReadonlyArray<readonly [number, number]> = [[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]];
const CLEAR_PATH = [0, -0x40, 2, 0x40, 0x40, -2, -2, -0x40, -0x40];   // $C4:1865, cumulativo

export interface ArenaBuild { bg2: Uint16Array; logic: Uint16Array; floor: Uint16Array; seed: number; soft: number }

/** Offsets (lin·$40 + col·2) da lista $C4:1327, até $FFFF (113 casas). */
export function fallbackList(rom: RomView): number[] {
  const out: number[] = [];
  for (let a = FALLBACK_LIST; ; a += 2) { const v = rom.u16(a); if (v === 0xffff) return out; out.push(v); }
}

export function buildArena(rom: RomView, stage: number, seed = 0xc689, spawns = DEFAULT_SPAWNS): ArenaBuild {
  const r = arenaRecord(rom, stage);
  const codes = decodeMapCodes(rom, r.bg2Map).codes, fcodes = decodeMapCodes(rom, r.floorMap).codes;
  const bg2 = codesToEntries(rom, codes, r.bg2Tbl), floor = codesToEntries(rom, fcodes, r.bg2Tbl);
  const logic = new Uint16Array(1024);
  for (let i = 0; i < 1024; i++) logic[i] = logicOf(rom, codes[i]);
  const clear = (i: number) => { bg2[i] = floor[i]; logic[i] = logicOf(rom, fcodes[i]); };
  for (const [col, lin] of spawns) {
    let off = lin * 0x40 + col * 2;
    for (const d of CLEAR_PATH) { off += d; clear(off >> 1); }
  }
  let s = seed & 0xffff;
  const rnd = (n: number) => { s = ((s | 1) * 0x383) & 0xffff; return (s * (n & 0xff)) >>> 16; };
  const fb = fallbackList(rom);
  let left = r.removeN;
  outer: while (left) {
    let done = false;
    for (let t = 0; t < 15 && !done; t++) {
      const col = rnd(13), lin = rnd(11), i = (lin * 0x40 + col * 2 + 0x44) >> 1;
      if (logic[i] === 0xcc80) { clear(i); left--; done = true; }
    }
    if (done) continue;
    for (const off of fb) if (logic[off >> 1] === 0xcc80) { clear(off >> 1); left--; continue outer; }
    break;
  }
  let soft = 0;
  for (let i = 0; i < 1024; i++) if (logic[i] === 0xcc80) soft++;
  return { bg2, logic, floor, seed: s, soft };
}

/** Elementos fixos que os objetos da arena gravam no BG2 na carga: setas (7), pads (8), gangorras (9). */
export function staticObjects(rom: RomView, stage: number): { off: number; word: number }[] {
  const out: { off: number; word: number }[] = [];
  if (stage === 7) for (let a = 0xc3918e; rom.u16(a) !== 0; a += 4) out.push({ off: rom.u16(a), word: rom.u16(a + 2) });
  if (stage === 8) for (const off of [0x1c8, 0x1d0, 0x1d8]) out.push({ off, word: 0x1c6e });
  if (stage === 9) for (let a = 0xc39524; rom.u16(a) !== 0xffff; a += 4) {
    const o = rom.u16(a), off = rom.u16(a + 2);
    const w = o === 0 ? [0x08ec, 0x48e2, 0x48e0] : [0x08e0, 0x08e2, 0x08e4];
    w.forEach((word, k) => out.push({ off: off + 2 * k, word }));
  }
  return out;
}

export function applyStatic(bg2: Uint16Array, objs: { off: number; word: number }[]): void {
  for (const { off, word } of objs) bg2[off >> 1] = word;
}
```

- [ ] **Step 4: Rodar.**
  - Com ROM: `SB4_ROM="…" npx vitest run tests/rom/assets-arena tests/rom/ppu-golden` → 17 + 12 passam. Os 11 renders batem byte a byte, e o teste de desempenho mostra mediana < 4 ms (medido ~0,6 ms).
  - Sem ROM: tudo pula.
  - Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/assets-arena.ts web/src/rom/arena-build.ts web/tests/rom/assets-arena.test.ts web/tests/rom/ppu-golden.test.ts
git commit -m "feat(rom): assets das 10 arenas, montagem de referência e golden do render só de BG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Personagens e rostos do HUD

**Possui:** `web/src/rom/assets-char.ts`, `web/tests/rom/assets-char.test.ts`.

**Files:**
- Create: o módulo e o teste.

**Interfaces:**
- Produces: `CHAR_SHEETS`, `VICTORY_SHEETS`, `CHAR_PALETTES`, `HUD_HEAD_BLOCKS`, `HUD_HEAD_SRC`, `HUD_HEAD_DST`, `sheetFrame(rom, sheet, g)`, `hudHeadBuffer(rom)`, `hudHeadTiles(rom, buf, entry)` e `loadCharacter(rom, c, heads: () => Uint8Array): CharacterAssets`.
- Consumes: T6 (`decodeTiles`, `readBgr555`, `decodeZte`), `gfx-anims.json` (T5).
- Fontes: [ANI §2.3–2.5] e D3. C1: a folha vem **sempre** da tabela `$C2:0730`, o que dá o personagem 5 em `$CD:1800`.

- [ ] **Step 1: Escrever o teste** `web/tests/rom/assets-char.test.ts`:

```ts
import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadCharacter, hudHeadBuffer, CHAR_SHEETS, VICTORY_SHEETS } from '../../src/rom/assets-char';

interface Fx {
  chars: { char: number; sheet: number; victorySheet: number; framesSha1: string; victorySha1: string;
    palettes: { slot: number; addr: number; attr: number; sha1: string }[] }[];
  hudHeads: { char: number; slot: number; entry: number; sha1: string }[];
}
const cat = (xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };

describe.skipIf(!ROM)('personagens (gfx-anims.json)', () => {
  const fx = fixture<Fx>('gfx-anims.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('folhas (C1: personagem 5 em $CD:1800), quadros, paletas e VICTORY', () => {
    expect(fx.chars.map(c => c.sheet)).toEqual([0xd20000, 0xcb0000, 0xcb8000, 0xcc0000, 0xcc8000, 0xcd1800]);
    for (const e of fx.chars) {
      expect(view.p24(CHAR_SHEETS + 3 * e.char)).toBe(e.sheet);
      expect(view.p24(VICTORY_SHEETS + 3 * e.char)).toBe(e.victorySheet);
      const ch = loadCharacter(view, e.char, () => hudHeadBuffer(view));
      expect(sha1Hex(cat(Array.from({ length: 64 }, (_, g) => ch.frame(g))))).toBe(e.framesSha1);
      expect(sha1Hex(cat(Array.from({ length: 4 }, (_, g) => ch.victoryFrame(g))))).toBe(e.victorySha1);
      expect(ch.palettes.map(p => sha1Hex(u16le(p)))).toEqual(e.palettes.map(p => p.sha1));
      expect(e.palettes.map(p => p.attr)).toEqual([0, 2, 8, 10, 12]);
    }
  });
  it('rostos do HUD: entrada (6+c)·5+slot', () => {
    const buf = hudHeadBuffer(view);
    for (const h of fx.hudHeads) {
      const t = loadCharacter(view, h.char, () => buf).hudHead(h.slot);
      expect(t.count).toBe(6);
      expect(sha1Hex(t.px)).toBe(h.sha1);
    }
  });
  it('personagem fora de 0..5 é erro', () => {
    expect(() => loadCharacter(view, 6, () => new Uint8Array(0))).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `SB4_ROM="…" npx vitest run tests/rom/assets-char` → FAIL.

- [ ] **Step 3: Implementar** `web/src/rom/assets-char.ts`:

```ts
// Personagens [ANI §2.3–2.5, GFX §3.3] e rostos do HUD ($C4:6170/$C4:617F/$C4:61F7).
import type { CharacterAssets, Tiles } from './types';
import type { RomView } from './view';
import { decodeTiles } from './decode/tiles';
import { readBgr555 } from './decode/palette';
import { decodeZte } from './decode/zte';

export const CHAR_SHEETS = 0xc20730, VICTORY_SHEETS = 0xc28ebf, CHAR_PALETTES = 0xc2779d;
export const HUD_HEAD_BLOCKS = 0xc46170, HUD_HEAD_SRC = 0xc4617f, HUD_HEAD_DST = 0xc461f7;

/** Quadro 32×32 (índices) de uma folha de 16 tiles de largura: g → +(g&3)·$80 + (g>>2)·$800, linhas de tiles a cada $200. */
export function sheetFrame(rom: RomView, sheet: number, g: number): Uint8Array {
  const base = sheet + (g & 3) * 0x80 + (g >> 2) * 0x800, out = new Uint8Array(1024);
  for (let r = 0; r < 4; r++) {
    const t = decodeTiles(rom.bytes(base + r * 0x200, 128), 4);
    for (let k = 0; k < 4; k++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      out[(r * 8 + y) * 32 + k * 8 + x] = t.px[k * 64 + y * 8 + x];
  }
  return out;
}

/** Buffer $7F:208C: os 5 blocos ZTE de $C4:6170 em $1000·i (20 KB). */
export function hudHeadBuffer(rom: RomView): Uint8Array {
  const buf = new Uint8Array(0x5000);
  for (let i = 0; i < 5; i++) buf.set(decodeZte(rom.data, rom.p24(HUD_HEAD_BLOCKS + 3 * i)).data.subarray(0, 0x1000), 0x1000 * i);
  return buf;
}

/** Rosto do HUD da entrada `e` (= $4A·5 + slot): 3 linhas de 2 tiles (64 B) a partir de buffer + u16($C4:617F + 2e), linhas a cada $200.
 *  Ordem dos 6 tiles: (0,0) (1,0) (0,1) (1,1) (0,2) (1,2) — vão para os tiles de BG $201+2·slot, +1, +$10, +$11, +$20, +$21. */
export function hudHeadTiles(rom: RomView, buf: Uint8Array, e: number): Tiles {
  const src = rom.u16(HUD_HEAD_SRC + 2 * e), raw = new Uint8Array(192);
  for (let r = 0; r < 3; r++) raw.set(buf.subarray(src + r * 0x200, src + r * 0x200 + 64), 64 * r);
  return decodeTiles(raw, 4);
}

export function loadCharacter(rom: RomView, c: number, heads: () => Uint8Array): CharacterAssets {
  if (!(c >= 0 && c <= 5)) throw new RangeError(`personagem inválido: ${c}`);
  const sheet = rom.p24(CHAR_SHEETS + 3 * c), vsheet = rom.p24(VICTORY_SHEETS + 3 * c);
  const frames = new Map<number, Uint8Array>();
  return {
    char: c,
    frame: g => { let f = frames.get(g); if (!f) { f = sheetFrame(rom, sheet, g); frames.set(g, f); } return f; },
    palettes: Array.from({ length: 5 }, (_, s) => readBgr555(rom.bytes(rom.p24(CHAR_PALETTES + 32 * c + 4 * s), 32), 0, 16)),
    victoryFrame: g => sheetFrame(rom, vsheet, g),
    hudHead: slot => hudHeadTiles(rom, heads(), (6 + c) * 5 + slot),
  };
}
```

- [ ] **Step 4: Rodar.** Com ROM: 3 passam. Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/assets-char.ts web/tests/rom/assets-char.test.ts
git commit -m "feat(rom): quadros, paletas e folha VICTORY dos personagens e rostos do HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Catálogo das telas, `SceneAssets`, Modo 7 do DRAW GAME e fatias do áudio

**Possui:** `web/scripts/rom-facts/gfx-catalog.ts`, `web/src/rom/catalog.ts` (gerado), `web/src/rom/assets-scene.ts`, `web/tests/rom/assets-scene.test.ts`.

**Files:**
- Create: o gerador, o `catalog.ts` gerado, o módulo e o teste.

**Interfaces:**
- Produces:
  - `VramSeg`, `SceneCatalog`, `SCENES: Record<SceneId, SceneCatalog>`;
  - `segmentBytes(rom, seg, zte)`, `loadScene(rom, id, zte): SceneAssets`, `loadMode7Draw(rom) → {chr, map}`;
  - `AUDIO_CPU`, `AUDIO_DATA`, `audioSlices(rom): AudioRomSlices`.
- Consumes: T6 (`decodeZte`, `decodeM7Rle`, `readBgr555`, `decodeTiles`), `SceneId`/`SCENE_IDS` (T1), `gfx-scenes.json` (T3), `analise/investigacao/graficos-formato/catalogo.json`.

- [ ] **Step 1: Escrever o teste** `web/tests/rom/assets-scene.test.ts`:

```ts
import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadScene, loadMode7Draw, audioSlices, segmentBytes } from '../../src/rom/assets-scene';
import { SCENES } from '../../src/rom/catalog';
import { decodeZte } from '../../src/rom/decode/zte';
import { SCENE_IDS, type SceneId } from '../../src/rom/types';

interface Fx { scenes: { id: SceneId; segments: { vramByte: number; bytes: number; sha1: string }[]; written: number;
  vramSha1: string; cgramSha1: string; cgramLinesEqualCapture: number }[] }

describe('catálogo das telas (sem ROM)', () => {
  it('tem as 11 telas, com 16 linhas de CGRAM cada', () => {
    expect(Object.keys(SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) expect(SCENES[id].cgram).toHaveLength(16);
  });
  it('contagem de segmentos por tela = catalogo.json', () => {
    expect(SCENE_IDS.map(id => SCENES[id].vram.length)).toEqual([32, 21, 22, 21, 20, 25, 25, 24, 55, 22, 22]);
  });
});

describe.skipIf(!ROM)('telas montadas da ROM (gfx-scenes.json)', () => {
  const fx = fixture<Fx>('gfx-scenes.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  const cache = new Map<number, Uint8Array>();
  const zte = (a: number) => { let d = cache.get(a); if (!d) { d = decodeZte(view.data, a).data; cache.set(a, d); } return d; };
  for (const e of fx.scenes) it(e.id, () => {
    expect(e.cgramLinesEqualCapture).toBe(16);
    const s = loadScene(view, e.id, zte);
    const segs = SCENES[e.id].vram.map(g => ({ vramByte: g.vramByte, bytes: g.bytes, sha1: sha1Hex(segmentBytes(view, g, zte)) }));
    expect(segs).toEqual(e.segments);
    expect(s.written.reduce((n, v) => n + v, 0)).toBe(e.written);
    expect(sha1Hex(s.vram)).toBe(e.vramSha1);
    expect(sha1Hex(u16le(s.cgram))).toBe(e.cgramSha1);
    expect([s.bgTiles.count, s.bg3Tiles.count, s.objTiles.count]).toEqual([1024, 512, 512]);
  });
  it('Modo 7 do DRAW GAME separado em chr e map', () => {
    const m = loadMode7Draw(view);
    expect([m.chr.length, m.map.length]).toEqual([16384, 16384]);
  });
  it('fatias do áudio [AUD §1.1]', () => {
    const a = audioSlices(view);
    expect([a.cpu.base, a.cpu.bytes.length, a.data.base, a.data.bytes.length]).toEqual([0xc00190, 0x65a, 0xd90000, 0x59c94]);
  });
});
```

- [ ] **Step 2: Escrever o gerador** `web/scripts/rom-facts/gfx-catalog.ts` e rodar:

```ts
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
```

```bash
cd web && node scripts/rom-facts/gfx-catalog.ts
```
Expected:
- `cenas: title vsmode ffa players rules charsel stagesel scoreboard victory draw1 draw2`;
- `src/rom/catalog.ts` com ~360 linhas, cabeçalho "GERADO … não editar" e **nenhuma** descrição (`grep -c descricao src/rom/catalog.ts` → 0).

- [ ] **Step 3: Rodar e ver falhar.** `npx vitest run tests/rom/assets-scene` → FAIL (`assets-scene.ts` não existe).

- [ ] **Step 4: Implementar** `web/src/rom/assets-scene.ts`. Armadilhas:
  - os segmentos são aplicados **na ordem** (os posteriores sobrescrevem);
  - o endereço de VRAM dá a volta em `& $FFFF`;
  - a CGRAM tem 16 linhas × 32 bytes.

```ts
// Telas: VRAM e CGRAM montadas pelos segmentos do catálogo [CAT §5, GFX §4]; Modo 7 do DRAW GAME; fatias do áudio.
import type { AudioRomSlices, SceneAssets, SceneId } from './types';
import type { RomView } from './view';
import { SCENES, type VramSeg } from './catalog';
import { decodeZte } from './decode/zte';
import { decodeM7Rle } from './decode/m7rle';
import { readBgr555 } from './decode/palette';
import { decodeTiles } from './decode/tiles';

/** Bytes de um segmento do catálogo. */
export function segmentBytes(rom: RomView, s: VramSeg, zte: (addr: number) => Uint8Array): Uint8Array {
  let d: Uint8Array;
  if (s.kind === 'zte') d = zte(s.src).subarray(s.offset, s.offset + s.bytes);
  else if (s.kind === 'raw') d = rom.bytes(s.src + s.offset, s.bytes);
  else if (s.kind === 'zero') d = new Uint8Array(s.bytes);
  else d = new Uint8Array(s.bytes).fill(s.value);
  if (d.length !== s.bytes) throw new RangeError(`segmento curto: VRAM $${s.vramByte.toString(16)}`);
  return d;
}

export function loadScene(rom: RomView, id: SceneId, zte: (addr: number) => Uint8Array): SceneAssets {
  const sc = SCENES[id];
  if (!sc) throw new RangeError(`tela desconhecida: ${id}`);
  const vram = new Uint8Array(0x10000), written = new Uint8Array(0x10000);
  for (const s of sc.vram) {
    const d = segmentBytes(rom, s, zte);
    for (let i = 0; i < s.bytes; i++) { const o = (s.vramByte + i) & 0xffff; vram[o] = d[i]; written[o] = 1; }
  }
  const cgram = new Uint16Array(256);
  sc.cgram.forEach((a, i) => cgram.set(readBgr555(rom.bytes(a, 32), 0, 16), 16 * i));
  return { id, vram, written, cgram, bgTiles: decodeTiles(vram, 4, 0, 1024), bg3Tiles: decodeTiles(vram, 2, 0xa000, 512),
    objTiles: decodeTiles(vram, 4, 0xc000, 512) };
}

/** DRAW GAME, fase Modo 7: pixels $CD:9800 + mapa $D6:60D9 → `chr` (256 tiles × 64 bytes) e `map` (128×128). */
export function loadMode7Draw(rom: RomView): { chr: Uint8Array; map: Uint8Array } {
  const v = decodeM7Rle(rom.data, 0xcd9800, 0xd660d9).vram, chr = new Uint8Array(0x4000), map = new Uint8Array(0x4000);
  for (let i = 0; i < 0x4000; i++) { map[i] = v[2 * i]; chr[i] = v[2 * i + 1]; }
  return { chr, map };
}

export const AUDIO_CPU = [0xc00190, 0xc007ea] as const, AUDIO_DATA = [0xd90000, 0xde9c94] as const;
export function audioSlices(rom: RomView): AudioRomSlices {
  const sl = ([a, b]: readonly [number, number]) => ({ base: a, bytes: rom.bytes(a, b - a) });
  return { cpu: sl(AUDIO_CPU), data: sl(AUDIO_DATA) };
}
```

- [ ] **Step 5: Rodar.** Sem ROM: 2 passam e 13 pulam. Com ROM: 15 passam. Depois `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 6: Commit.**
```bash
git add web/scripts/rom-facts/gfx-catalog.ts web/src/rom/catalog.ts web/src/rom/assets-scene.ts web/tests/rom/assets-scene.test.ts
git commit -m "feat(rom): catálogo das telas, VRAM/CGRAM por tela, Modo 7 do DRAW GAME e fatias do áudio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 4

### Task 13: `createRomAssets` com cache e verificação final

**Possui:** `web/src/rom/assets.ts` (substitui o stub da T1), `web/tests/rom/assets.test.ts`.

**Files:**
- Replace: `web/src/rom/assets.ts`
- Create: `web/tests/rom/assets.test.ts`

**Interfaces:**
- Produces: `BOMB_SCRIPTS` e `createRomAssets(bytes): RomAssets`, com todos os métodos e cache por chave.
- Consumes: T6, T7, T10, T11 e T12.

- [ ] **Step 1: Escrever o teste** `web/tests/rom/assets.test.ts`:

```ts
import { ROM } from './helpers';
import { createRomAssets } from '../../src/rom/assets';
import { sheetFrame } from '../../src/rom/assets-char';
import { SCENE_IDS } from '../../src/rom/types';

describe.skipIf(!ROM)('RomAssets (createRomAssets)', () => {
  const A = ROM ? createRomAssets(ROM) : null;
  it('cache: a mesma chamada devolve o mesmo objeto', () => {
    expect(A!.arena(1)).toBe(A!.arena(1));
    expect(A!.character(2)).toBe(A!.character(2));
    expect(A!.anim(0xd81693)).toBe(A!.anim(0xd81693));
    expect(A!.scene('title')).toBe(A!.scene('title'));
    expect(A!.mode7Draw()).toBe(A!.mode7Draw());
    expect(A!.audioData()).toBe(A!.audioData());
  });
  it('as 10 arenas e as 11 telas carregam', () => {
    for (let s = 1; s <= 10; s++) expect(A!.arena(s).stage).toBe(s);
    expect(() => A!.arena(0)).toThrow(RangeError);
    expect(() => A!.arena(11)).toThrow(RangeError);
    for (const id of SCENE_IDS) expect(A!.scene(id).cgram).toHaveLength(256);
  });
  it('playerAnim: mesma animação para os 6 personagens; índices ↑ → ↓ ← e +8 parado [spec §7.4]', () => {
    for (let c = 0; c < 6; c++) {
      expect(A!.playerAnim(0xc276c5, c, 1)).toBe(A!.anim(0xd81693));   // andar →
      expect(A!.playerAnim(0xc276c5, c, 0)).toBe(A!.anim(0xd816ac));   // andar ↑
      expect(A!.playerAnim(0xc276c5, c, 4)).toBe(A!.anim(0xd81661));   // andar ↓
      expect(A!.playerAnim(0xc276c5, c, 5)).toBe(A!.anim(0xd8167a));   // andar ←
      expect(A!.playerAnim(0xc276c5, c, 12)).toBe(A!.anim(0xd81645));  // parado ↓
    }
    expect(A!.playerAnim(0xc276c5, 0, 12).map(f => [f.pieces[0].tile, f.dur])).toEqual([[6, 255]]);
  });
  it('personagem 5 lê a folha pela tabela $C2:0730 (C1)', () => {
    expect(A!.character(5).frame(7)).toEqual(sheetFrame(A!.rom, 0xcd1800, 7));
    expect(() => A!.character(6)).toThrow(RangeError);
  });
  it('bombScript: normal e remota', () => {
    expect(A!.bombScript(0).slice(0, 4)).toEqual([{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }, { word: 0x0b04, dur: 16 }, { word: 0x0b06, dur: 16 }]);
    expect(A!.bombScript(1).map(f => f.dur)).toEqual([16, 16, 16, 16]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `SB4_ROM="…" npx vitest run tests/rom/assets.test.ts` → FAIL, porque o stub lança "ainda não implementado".

- [ ] **Step 3: Substituir** `web/src/rom/assets.ts`:

```ts
// RomAssets: decodifica sob demanda e guarda em cache (spec §2.3).
import type { Anim, ArenaAssets, AudioRomSlices, CharacterAssets, RomAssets, SceneAssets, SceneId } from './types';
import { RomView } from './view';
import { decodeZte } from './decode/zte';
import { decodeAnim } from './decode/anim';
import { decodeBombScript } from './decode/bombscript';
import { loadArena } from './assets-arena';
import { loadCharacter, hudHeadBuffer } from './assets-char';
import { loadScene, loadMode7Draw, audioSlices } from './assets-scene';

export const BOMB_SCRIPTS = 0xc156a8;     // 7 × ptr24, indexado pelo tipo da bomba [ANI §5.1]

function memo<K, V>(m: Map<K, V>, k: K, make: () => V): V {
  let v = m.get(k);
  if (v === undefined) { v = make(); m.set(k, v); }
  return v;
}

export function createRomAssets(bytes: Uint8Array): RomAssets {
  const rom = new RomView(bytes);
  const ztes = new Map<number, Uint8Array>(), arenas = new Map<number, ArenaAssets>(), chars = new Map<number, CharacterAssets>();
  const anims = new Map<number, Anim>(), scenes = new Map<SceneId, SceneAssets>();
  let heads: Uint8Array | null = null, m7: { chr: Uint8Array; map: Uint8Array } | null = null, audio: AudioRomSlices | null = null;
  const zte = (a: number) => memo(ztes, a, () => decodeZte(bytes, a).data);
  const anim = (a: number) => memo(anims, a, () => decodeAnim(rom, a));
  return {
    rom,
    arena: s => memo(arenas, s, () => loadArena(rom, s)),
    character: c => memo(chars, c, () => loadCharacter(rom, c, () => (heads ??= hudHeadBuffer(rom)))),
    anim,
    playerAnim: (tab1, c, dirIdx) => anim(rom.p24(rom.p24(tab1 + 3 * c) + 3 * dirIdx)),
    bombScript: t => decodeBombScript(rom, rom.p24(BOMB_SCRIPTS + 3 * t)).frames,
    scene: id => memo(scenes, id, () => loadScene(rom, id, zte)),
    mode7Draw: () => (m7 ??= loadMode7Draw(rom)),
    audioData: () => (audio ??= audioSlices(rom)),
  };
}
```

- [ ] **Step 4: Verificação final.**
```bash
cd web
npx vitest run                    # 238 antigos + 72 novos passam; 63 pulados
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run   # 238 + 135 passam, 0 pulados
npx tsc --noEmit
npm run build
```
Repetir a conferência manual da T8, passo 6: com a ROM real, depois de carregar, `romState.assets.arena(1)` funciona no console do navegador (`?debug=1`).

- [ ] **Step 5: Commit.**
```bash
git add web/src/rom/assets.ts web/tests/rom/assets.test.ts
git commit -m "feat(rom): createRomAssets com decodificação sob demanda e cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aceite do plano (spec §11, linha 5)

| Critério | Onde | Comando |
|---|---|---|
| Aceita a ROM conhecida | `validate.test.ts` (ROM real), `assets-state.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/validate tests/rom/assets-state` |
| Rejeita arquivo truncado, 1 byte alterado e cabeçalho errado (buffers sintéticos) | `validate.test.ts` | `npx vitest run tests/rom/validate.test.ts` |
| Remove o cabeçalho de copiadora | `validate.test.ts` (sintético e real) | idem |
| Ida e volta no IndexedDB (`fake-indexeddb` como devDependency) | `validate-store.test.ts`, `assets-state.test.ts` | `npx vitest run tests/rom/validate-store tests/rom/assets-state` |
| Golden de ZTE (91 blocos) e do Modo 7 | `decode-gfx-rom.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/decode-gfx-rom` |
| Golden do BG das arenas (11 envios) e das paletas | `assets-arena.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/assets-arena` |
| Golden da montagem das arenas (BG1, BG2, piso, lógico, semente final) | `assets-arena.test.ts` | idem |
| Golden das animações (141 + literais + `$C1:7D5F`) | `decode-anim-rom.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/decode-anim-rom` |
| Telas: VRAM e CGRAM por tela, com hash por segmento (extra, §10.2) | `assets-scene.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/assets-scene` |
| PPU sintética: flips, 16×16, prioridades, faixas 8×8 e 16×16, `half`/`add`, ordem da OAM | `ppu.test.ts` | `npx vitest run tests/rom/ppu.test.ts` |
| Golden do render só de BG (arenas 1, 2, 4, 6 e 7, e as outras por paridade) | `ppu-golden.test.ts` | `SB4_ROM="…" npx vitest run tests/rom/ppu-golden` |
| `renderPpu` de uma arena abaixo de 4 ms no Node | `ppu-golden.test.ts`, `ppu.test.ts` | idem |
| Tudo verde, com e sem ROM; build | – | `npx vitest run && SB4_ROM="…" npx vitest run && npx tsc --noEmit && npm run build` |
| Contratos para os planos 7, 10 e 11 (`drawRomBattle` stub, `AudioSink`/`NoopSink`, `romState`, `renderPpu`, `RomAssets`) | `assets-contracts.test.ts`, `assets.test.ts` | – |
| Nada da ROM no repositório | revisão | `git diff --stat` mostra só `.ts`/`.py`/`.json`; os JSON só têm números e SHA-1 |

## Riscos

- **R1. Os fixtures dependem de arquivos fora do git.** São a ROM e as capturas em `analise/extraido/` do projeto principal (`validacao_chamadas.json`, `cenas/*.vram|cgram`, `animacoes.json`). Sem eles, os scripts das T3–T5 falham no `open()`. Mitigação: os JSON gerados são versionados, e os testes só precisam deles e da ROM. Se as capturas sumirem, dá para regenerá-las com `scenes.py`/`dump_json.py` das frentes (GFX §8, ANI §12).
- **R2. Merge de `package.json`/`tsconfig.json` com o plano 6.** Os dois instalam `@types/node` e mudam `types` (D9). Resolva pela união. Se o plano 6 já tiver entrado, a T2 só acrescenta `fake-indexeddb`.
- **R3. Rostos do HUD com personagem ≠ slot.** A entrada `(6 + c)·5 + slot` só foi conferida com c = slot (D3). Se estiver errada, o efeito é só visual: rosto trocado no HUD quando dois jogadores escolhem personagens fora da ordem padrão. Verificar no emulador com P1 = personagem 5 (`my_arena_char5.bin`), lendo `$4A` em `$C4:60D8` ou a VRAM `$2010`.
- **R4. Tempo no CI.** Os testes de desempenho usam a mediana de 40 execuções e limite de 4 ms (medido 0,6 ms). Numa máquina muito lenta, pode oscilar; nesse caso, não troque o limite, investigue.
- **R5. Painel e atalhos.** O painel engole teclas enquanto está aberto (D12). Se o plano 10 abrir o painel pela tela de Opções, o foco volta ao jogo quando ele fecha. Uma tela que dependa de tecla segurada pode ver um `keyup` sem `keydown`, e o `InputManager` atual tolera isso.
- **R6. Modo 7 "mínimo".** Não emula o recorte de 13 bits nem o +1 de linha (D1). Serve para o DRAW GAME do plano 10, que ajusta a posição visualmente. Se o plano 10 precisar de fidelidade de pixel no zoom, estender `Mode7Layer` com acordo.
- **R7. `render_rom.py` como verdade nas arenas 3, 5, 8, 9 e 10.** Nessas arenas, o modelo difere do emulador só por quadros de animação, sprites e fundo da arena 8 (ARN §6). O golden de paridade garante o porte, não esses detalhes, que são dos planos 7 e 8.
