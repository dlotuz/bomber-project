# Crown Blast: fidelidade ao Battle Mode do SB4 (design v2)

**Data:** 2026-09-25 · **Branch:** `feat/fidelity`
**Substitui** as seções 3 a 10, 13 e 14 da spec v1 (`2026-09-25-crown-blast-web-design.md`). A §12 da v1 (webhook Crown Cup) fica suspensa. A §2 da v1 (stack e invariantes do núcleo) continua valendo, com as mudanças da §2 abaixo.
**Fonte de verdade:** os relatórios da investigação da ROM, citados por sigla:

| Sigla | Relatório |
|---|---|
| MEC | `analise/investigacao/mecanicas/RELATORIO.md` |
| GFX | `analise/investigacao/graficos-formato/RELATORIO.md` (+ `catalogo.md`/`catalogo.json` = CAT, `STATUS.md`) |
| ANI | `analise/investigacao/animacoes-sprites/RELATORIO.md` |
| ARN | `analise/investigacao/arenas-cenario/RELATORIO.md` |
| MNT | `analise/investigacao/montarias-e-telas/RELATORIO.md` |
| AUD | `analise/investigacao/audio/RELATORIO.md` |

Exemplo de citação: [MEC §4] = seção 4 do relatório de mecânicas.

---

## 1. Objetivo e decisões

### 1.1 Objetivo
O Battle Mode do Crown Blast deve ser **idêntico** ao do Super Bomberman 4 em mecânicas, gráficos e usabilidade.
- Os gráficos, e depois o som, são lidos da ROM do próprio usuário **no navegador**.
- Os textos são em PT-BR, desenhados pelo nosso jogo no estilo da ROM.
- Sem ROM, o jogo continua jogável com a arte desenhada por código (fallback).
- O núcleo continua determinístico, para permitir online no futuro.

### 1.2 Decisões do usuário (obrigatórias)
1. **Meta:** Battle Mode idêntico. O modo história fica de fora. O webhook do Crown Cup sai por enquanto: coroas e placar ficam só dentro do jogo.
2. **ROM do usuário:**
   - O usuário carrega o `.sfc` uma vez, por seletor de arquivo ou arrastando.
   - O arquivo é validado pelo cabeçalho e pelo hash da ROM conhecida, e fica guardado no IndexedDB.
   - Nada da Hudson ou da Konami entra no repositório ou no site.
   - Sem ROM, vale a arte desenhada por código.
3. **Telas:**
   - Layout, fontes, cores e gráficos da ROM.
   - Textos em PT-BR desenhados por nós, com os glifos da ROM quando existem.
   - Os caracteres que faltam (acentos e letras ausentes) ganham glifos próprios no mesmo estilo.
4. **Escopo:** tudo o que o Battle original tem. A lista está nas §3 a §8.
5. **Determinismo:** o núcleo é função pura de estado + entradas. O RNG passa a ser o LCG do jogo.
6. **Execução:** em paralelo, dividida nos planos 5 a 11 (§11).
7. **Testes:**
   - Os testes que usam a ROM pulam sozinhos quando ela não está disponível. O caminho da ROM vem da variável de ambiente `SB4_ROM`.
   - Só entram no repositório fatos: números, posições e hashes. Bytes da ROM e imagens extraídas nunca entram.
8. Os pontos que a investigação não fechou estão na §12, cada um com o comportamento provisório.

### 1.3 Convenções
- **Tick** é um passo lógico de 1/60 s. Todas as durações desta spec são em ticks lógicos, sem o *lag* do SNES [MEC §1].
  - "f" é usado só para **tempos de tela** (fades, menus), medidos em frames de vídeo no emulador.
- **Casa (col, lin)** segue a grade da ROM `$7E:2800`:
  - col 0..16 e lin 0..12;
  - área jogável: col 2..14 × lin 1..11;
  - paredes: col 1 e 15, lin 0 e 12;
  - col 0 e 16: moldura fora do campo.
  - ARN e MNT escrevem as casas como **(lin, col)**. Esta spec converte tudo para (col, lin).
- **Endereços** em `$BB:AAAA` HiROM. Offset no arquivo = `((BB & $3F) << 16) | AAAA`, o que para os bancos `$C0`–`$FF` equivale a `endereço − $C00000`.
- **Status:** ✅ = medido/confirmado nos relatórios · 🟡 = provável (ver §12).

### 1.4 Fora de escopo
- Modo história e demo do título.
- Logo HUDSON e intro da história.
- Password.
- Modos Championship e Bombermania. Aparecem no menu VS, desabilitados (§6.3).
- Webhook do Crown Cup e online.
- **Comportamento da CPU original** (não foi investigado). A IA continua sendo a nossa (§9).
- Emular o *lag* do SNES.
- Tabelas de senha (`$7F:70BD`, 13 tipos de ovo).

### 1.5 Conflitos entre os relatórios e como foram resolvidos
| # | Conflito | Decisão |
|---|---|---|
| C1 | Folha do personagem 5: `$CD:0000–7FFF` [GFX §3.3] × `$CD:1800` [ANI §2.4] | Ler a base em tempo de execução pela tabela `$C2:0730` (`p24($C2:0730 + 3·char)`). O código usa essa tabela, e as duas medições concordam no banco |
| C2 | Queima de soft block: 30 f [ARN §2.6] × 24 ticks [MEC §4, ANI §7] | **24 ticks** (6 quadros × 4). Os 30 f incluem *lag* |
| C3 | Chama: 32 f [ARN §2.6] × 25 ticks [MEC §4, ANI §6] | **25 ticks** |
| C4 | Pressão: 1º bloco ~198 + 13 f depois do HURRY [ARN §2.6] × 205 ticks [MEC §7.2]. Queda de "38 f" [ARN] × 36 + 2·lin [MEC] × grid em t0+37 [ANI §8] | **205 ticks** até o 1º passo; o controlador liga (bordas → `EE80`) em **+192** (205 − 13). Queda **36 + 2·lin**; os 38 f da ARN são o caso lin 1. A diferença de 1 tick da ANI vai para a §12 (A11) |
| C5 | Pavio na arena 2: 124/61/250 f [ARN §7.1] × 127 ticks [MEC §4] | A ARN mede a partir de outro ponto (−3). O mecanismo é o contador de 126 decrementado **1 por tick (normal), 2 por tick (rápido) e só nos ticks pares (lento)**. Isso dá **127 / 64 / 253** ticks do tick da colocação até a explosão |
| C6 | "Música 19/23/5/14" [MNT §B.6–B.12] × IDs da AUD | MNT confundiu números decimais e misturou música, SFX e voz. Vale a AUD, medida por gancho em `$C3:4A44/4A7F/4AF9`: `$13` jingle, **SFX** `$17` na vitória da rodada, **STOP** no TIME UP (sem apito), música `$18` + voz `$0E` no DRAW |
| C7 | Racer Bomber: "roleta" [MEC §7.6] × "minijogo de corrida Mode 7, PRESS B!" [MNT §A.9] | MNT viu a tela. É uma **corrida bônus** depois da VICTORY cujo resultado grava o prêmio (`$1F50`). O prêmio vale em **toda rodada** da partida seguinte. Como a corrida decide o prêmio está em aberto (§12, A2) |
| C8 | "5 chamadas de RNG por jogador" na carga [ARN §2.4] | Pela conta, `$12` → `$C689` em **5 chamadas no total**. Logo, **1 chamada por jogador** (5 jogadores). Com menos jogadores: §12 (A3) |
| C9 | Invencível "489 quadros" [ANI §4] × colete 511 ticks [MEC §3.4] | Os 489 são do teste da ANI (`+$96 = $1E9`). Colete = **511** |
| C10 | Morte "78 quadros" [ANI §4, v1] × 65 ticks [MEC §3.5] | **65 ticks** |
| C11 | Intro: 10 ticks de lógica "com tela preta" [MEC §7.1] × contador caindo "durante o fade" [MNT §B.7] | Vale a MEC, medida por tick: 10 ticks de lógica em preto, depois fade-in de 15 f e espera de 37 f **sem lógica**. As duas fontes concordam nos 52 f do início do fade-in até o controle e no 1º segundo de 51 ticks |
| C12 | Chute parando depois de ~2 casas nas arenas 1 e 7 [ARN §8] × regra de parada [MEC §5.3] | Vale a MEC, com parada só em obstáculo, bomba ou jogador. A observação da ARN vai para a §12 (A6) |
| C13 | Paleta do jogador "OBJ 0,1,4,5,6" [ANI] × "slots 8,9,12,13,14" [GFX] | É a mesma coisa: paleta OBJ *n* = linha 8+*n* da CGRAM |

---

## 2. Arquitetura

### 2.1 Visão geral
```
web/src/
  rom/          [novo, plano 5] validação, IndexedDB, leitura HiROM, decodificadores, modelo de assets
  core/         [plano 6] simulação fiel; tabelas de regra em core/tables/ (geradas, §2.2)
    stages/     [plano 8] módulos das arenas especiais (hooks do core)
    mounts/     [plano 9] ovos e montarias (hooks do core)
    ai/         [plano 6; stages/ e mounts.ts dos planos 8 e 9] IA
  render/
    ppu/        [plano 5] PPU de software (modo 1 + modo 7 mínimo) → ImageData 256×224
    rom/        [plano 7] cena da partida a partir da ROM (arena, HUD, objetos, jogadores)
      stages/   [plano 8]  mounts/ [plano 9]
    fallback/   [planos 8 e 9: stages/ e mounts/] camadas extras da arte por código
    text/       [plano 10] fontes (glifos da ROM + glifos próprios), textos PT-BR
    screens-rom/[plano 10] telas a partir da ROM
    (arquivos atuais: draw-game.ts, view.ts, draw-screens.ts, art/, sprite-bank.ts = fallback)
  audio/        [plano 11; sink.ts do plano 5] APU (SPC700+DSP) em AudioWorklet, lado CPU em TS
  screens/ app/ input/ game/   [plano 10]
web/scripts/rom-facts/   [planos 5 e 6] extratores de fatos da ROM (Node, via SB4_ROM)
web/tests/rom/           testes que exigem a ROM (pulam sem SB4_ROM)
web/tests/fixtures/rom/  fatos e traços: números, posições, hashes. Nunca bytes nem imagens
```
Invariantes que continuam valendo:
- O núcleo não importa nada de `render/`, `audio/`, `input/` nem `rom/`.
- O núcleo não lê a ROM.
- `step` é determinístico.
- O hash JSON do estado é o teste de sincronia.

### 2.2 Fatos da ROM no núcleo
O núcleo precisa de tabelas de regra que estão na ROM. Exemplos:
- velocidades e tabelas de assistência de canto;
- listas de itens por fase;
- lista das 113 casas `$C4:1327`;
- scripts de voo e perdas por atordoamento;
- tabelas de prêmio.

Como o jogo tem de rodar sem ROM, essas tabelas viram **constantes TS, isto é, fatos numéricos de regra**:
- Ficam em `web/src/core/tables/*.ts` e são **geradas** por `web/scripts/rom-facts/*.ts` (rodar com `SB4_ROM=… npx vite-node scripts/rom-facts/<x>.ts`).
- Cada arquivo gerado tem um cabeçalho com o endereço de origem, o SHA-1 da ROM e o aviso "gerado, não editar".
- Sempre que existir fórmula equivalente, o gerador emite a fórmula em vez da tabela. Exemplos: o empurrão `$C3:2A20` (`7,6,…,0,…,−1…−8`) e a lista `$C4:1327`, se for a ordem linha a linha das casas sem pilar.
- `tests/rom/facts.test.ts` refaz cada extração a partir da ROM e compara com as constantes.

**O que nunca vai para o núcleo nem para o repositório:** tiles, paletas, mapas de BG, sequências e samples de áudio, código 65816/SPC e textos da ROM. Tudo isso é lido em tempo de execução pelo `rom/`.

### 2.3 `web/src/rom/` (plano 5)
**Validação** (`rom/validate.ts`):
1. Se `tamanho % $8000 == 512`, descarta os 512 bytes do cabeçalho de copiadora.
2. Exige **4.194.304 bytes**.
3. Confere o cabeçalho interno em `$FFC0`:
   - título `"SUPER BOMBERMAN 4    "` (21 bytes);
   - mapa `$31` (HiROM, FastROM);
   - tamanho `$0C`;
   - checksum `$B460`, complemento `$4B9F`.
4. Confere o **SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`** (a ROM investigada, com o patch de tradução em `$E0–$E2`; SHA-256 `68df561d…9f44`) via `crypto.subtle`.

O resultado é `{ok: true, rom}` ou `{ok: false, motivo: 'tamanho'|'cabecalho'|'hash'}`, com mensagem em PT-BR ("Este arquivo não é a ROM suportada de Super Bomberman 4").

**Armazenamento** (`rom/store.ts`):
- Banco IndexedDB `crown-blast`, store `rom`, chave `sb4`, valor `{bytes: ArrayBuffer, sha1, salvaEm}`.
- API: `loadStoredRom()`, `saveRom(bytes)` e `forgetRom()`.
- Nada sai do navegador. Nenhuma chamada de rede.

**Leitura** (`rom/view.ts`): `class RomView { u8(a); u16(a); u24(a); p24(a); bytes(a, n) }`, com endereços SNES `$C0–$FF` (e espelhos `$40–$7D`).

**Decodificadores** (`rom/decode/`), todos portados dos modelos Python validados:
| Arquivo | Formato | Fonte |
|---|---|---|
| `zte.ts` | elisão de tile zerado | [GFX §2.1] |
| `composite.ts` | composição do piso sob os tiles 768–1023, genérica | [GFX §2.2] |
| `arena9.ts` | pós-processamento da arena 9 | [GFX §2.3] |
| `m7rle.ts` | RLE duplo do Modo 7 | [GFX §2.4] |
| `palette.ts` | BGR555 → RGBA; `c8 = c<<3 \| c>>2` | [GFX §2.5] |
| `tiles.ts` | 4bpp e 2bpp planar → índices | [GFX §2.5] |
| `tilemap.ts` | mapa de arena: 1 byte ignorado + tokens `código \| rep<<10` + tabela código→entrada + lógico `$C4:0892` | [ARN §2.3] |
| `anim.ts` | animação (N × `{ptr24, dur, dx, dy}`) e metasprite (N × `{s16 dx, s16 dy, u16 attr}`) | [ANI §2.1–2.2] |
| `bombscript.ts` | `{u16 palavra, u8 dur}` com `FFFF` = loop e `FFFE` = fim | [ANI §5.1] |
| `tileanim.ts` | script de animação de tiles `[W:2][op:1]` (`$A0` espera, `$80` loop, `$90` fim, senão DMA 16×16) | [ARN §3.1] |

**Modelo de assets** (`rom/assets.ts`). Decodifica sob demanda e guarda em cache:
```ts
export interface Tiles { bpp: 2 | 4; count: number; px: Uint8Array }      // count·64 índices de cor
export interface Piece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
export interface AnimFrame { dur: number; mx: number; my: number; pieces: Piece[] }
export type Anim = AnimFrame[];
export interface ArenaAssets {
  stage: number;                  // 1..10
  bgTiles: Tiles;                 // 1024 tiles (32 KB) depois de composite(+arena9)
  bgCgram: Uint16Array;           // 128 cores depois da correção $C4:4E2F
  bg1: Uint16Array; bg2Base: Uint16Array; floor: Uint16Array;   // 32×32 palavras vhopppcc cccccccc
  logicBase: Uint16Array;         // 32×32, só para teste cruzado com core/tables
  tileAnim: TileAnimCmd[] | null; palAnim: PalAnim[]; colorMath: 'none' | 'half' | 'add';
  hudMap: Uint16Array;            // 32×3 (mapa $D6:8EEC, tabela $D6:8F72, +$2200)
  bg3Font: Tiles; bg3Banners: Tiles;  // $D1:BC16, $D0:F57B (2bpp crus)
  objCommon: Tiles;               // OBJ $6000–$7FFF montado conforme CAT §3
  objCgram: Uint16Array;          // 128 cores OBJ; slot 7 = $D7:E6DC
}
export interface CharacterAssets {
  frame(g: number): Uint8Array;   // 32×32 índices; addr = p24($C2:0730+3c) + (g&3)·$80 + (g>>2)·$800, linhas a cada $200
  palettes: Uint16Array[];        // 5 × 16 cores, p24($C2:779D + 32c + 4slot)
  victoryFrame(g: number): Uint8Array;  // folha p24($C2:8EBF+3c)
  hudHead: Tiles;                 // bloco p24($C4:6170 + 3·i)
}
export interface RomAssets {
  rom: RomView;
  arena(stage: number): ArenaAssets;
  character(c: number): CharacterAssets;
  anim(addr: number): Anim;
  playerAnim(tab1: number, char: number, dirIdx: number): Anim;   // p24(p24(tab1+3c)+3·dirIdx) [ANI §2.6]
  bombScript(type: number): { word: number; dur: number }[];
  scene(id: SceneId): SceneAssets;          // CAT §5: tiles VRAM (segmentos zte/raw/zero/fill) + CGRAM
  mode7Draw(): { chr: Uint8Array; map: Uint8Array };
  audioData(): AudioRomSlices;              // [AUD §1.1]: $C0:0190–$C0:07EA e $D9:0000–$DE:9C94
}
```
`catalogo.json` [CAT] é uma lista de endereços e *offsets* (fatos). Ela é transcrita para `rom/catalog.ts`.

**Estado global** (`rom/state.ts`):
- `romState.assets: RomAssets | null`
- `onRomChange(cb)`
- `openRomDialog()`

**Interface de carga** (`rom/ui.ts`): camada DOM fora do canvas.
- No boot sem ROM guardada, aparece um painel: "Crown Blast usa os gráficos e sons da sua cópia de Super Bomberman 4 (USA, com tradução). Arraste o arquivo .sfc aqui ou clique para escolher." Os botões são "Escolher arquivo" e "Jogar sem a ROM".
- O seletor pode ser aberto por clique ou tecla, porque o navegador exige gesto do usuário. Botão de gamepad não serve.
- Erros aparecem no próprio painel.
- A tela de OPÇÕES (§6.13) reabre o painel e permite "Esquecer ROM".

### 2.4 PPU de software e troca ROM ↔ fallback
`render/ppu/` (plano 5) desenha um `PpuFrame` num `ImageData` 256×224. É um subconjunto do SNES suficiente para o Battle:
```ts
export interface BgLayer { map: Uint16Array; mapW: 32 | 64; tiles: Tiles; tile16: boolean; hofs: number; vofs: number }
export interface ScanBand { y0: number; y1: number;          // faixa de linhas [y0, y1)
  bg1Tile16: boolean; bg1?: [number, number]; bg2?: [number, number]; // scroll por faixa (HDMA)
  main: number; sub: number; math: 'none' | 'half' | 'add' } // máscaras BG1=1 BG2=2 BG3=4 OBJ=16
export interface ObjEntry { x: number; y: number; size: 16 | 32; pal: number; prio: 0 | 1 | 2 | 3;
  hflip: boolean; vflip: boolean; src: { tile: number } | { px: Uint8Array } }
export interface PpuFrame { cgram: Uint16Array /*256*/; bg1?: BgLayer; bg2?: BgLayer; bg3?: BgLayer;
  bands: ScanBand[]; objTiles?: Tiles; oam: ObjEntry[] /* índice menor na frente */; mode7?: Mode7Layer; backdrop?: number }
export function renderPpu(f: PpuFrame, out: ImageData): void;
```
Regras do modo 1 [ANI §1.4, ARN §2.1]:
- Ordem de prioridade: BG3 com prioridade alta, OBJ prio 3, BG1 prio 1, BG2 prio 1, OBJ prio 2, BG1 prio 0, BG2 prio 0, OBJ prio 1, BG3 prio 0, OBJ prio 0.
- A cor 0 é transparente.
- *Color math* por faixa: `half` = (main+sub)/2 e `add` = saturada.
- Os tiles 16×16 usam os tiles n, n+1, n+16 e n+17.
- OBJ de 32×32 usa 4×4 tiles, com linhas de 16.

`src.px` permite desenhar um quadro do personagem direto da folha, sem emular os slots de VRAM e o DMA de 1 jogador por quadro. Isso é um detalhe de hardware que pode ser ignorado [ANI §1.3].

**Brilho e fades:** ficam fora da PPU. Vale para os dois modos: depois de desenhar, o app aplica um retângulo preto com alfa `1 − b/15`, com `b` de 0 a 15. Isso equivale à escala linear do INIDISP.

**Troca:** cada tela decide por `romState.assets`.
- Partida: `screens/battle.ts` chama `drawRomBattle(ctx, round, vis, assets, frame)` (plano 7). Se não há ROM, chama `drawRound(...)` (fallback, `render/draw-game.ts`).
- Menus: cada tela do plano 10 tem as duas versões.
- Trocar de ROM no meio do jogo só troca o desenho. O estado não muda.

### 2.5 Pontos de extensão entre planos
Os arquivos de contrato são criados na **onda 1**. Assim os planos 7 a 11 trabalham em paralelo sem se bloquear.
| Contrato | Arquivo (criado por) | Uso |
|---|---|---|
| `StageModule` e registro `STAGES[1..10]` | `core/hooks.ts` + `core/stages/index.ts` (plano 6, módulos vazios) | plano 8 preenche `core/stages/stageN.ts` |
| `MountModule` e registro | `core/hooks.ts` + `core/mounts/index.ts` (plano 6, *no-op*) | plano 9 preenche |
| `RomBattleLayer` / `FallbackBattleLayer` e registros | `render/battle-layers.ts` + `render/layers-index.ts` (plano 6; o índice importa os módulos de camada) | planos 8 e 9 registram camadas; os planos 7 e 6 (fallback) as chamam |
| `drawRomBattle(ctx, round, vis, assets, frame): boolean` | `render/rom/battle.ts` (**stub** do plano 5, que devolve `false`) | plano 7 implementa; plano 10 chama |
| `AudioSink` e `NoopSink` | `audio/sink.ts` (plano 5) | plano 10 chama nas telas; plano 11 implementa |
| `AiStageHints` / `AiMountHints` | `core/ai/hints.ts` (plano 6) | planos 8 e 9 |

```ts
// core/hooks.ts (plano 6)
export interface StageModule {
  init?(s: RoundState): void;                        // depois da remoção de soft e ANTES dos itens (consome RNG na ordem da ROM)
  tick?(s: RoundState, ev: GameEvent[]): void;       // passo 5 da §3.4
  speedLevel?(s: RoundState, p: Player, lv: number): number;  // arena 2
  fuseStep?(s: RoundState, b: Bomb): number;         // arena 2: quanto o pavio cai neste tick (0, 1 ou 2)
  onFlameCell?(s: RoundState, cell: number, armDir: number, ev: GameEvent[]): void;  // arenas 3, 6, 8
  onEnterCell?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;       // arenas 6, 9
  onStand?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;           // arena 8 (freio)
  kickedBombEnter?(s: RoundState, b: Bomb, cell: number): 'go' | 'stop' | { turn: number };  // arenas 6, 7
  outOfBounds?(s: RoundState, p: Player, ev: GameEvent[]): void;  // arena 5 (cerca)
  ai?: AiStageHints;
}
export interface MountModule {
  revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void;          // item $30 revelado
  stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  onHit(s: RoundState, p: Player, ev: GameEvent[]): boolean;               // true = absorveu o golpe
  onY(s: RoundState, p: Player, ev: GameEvent[]): boolean;                 // true = consumiu o Y
  passes?(p: Player, code: number): boolean;                                // tipo 2 atravessa soft
  bombType?(p: Player): number | null;                                      // tipo 3: bomba perfurante
  kicks?(p: Player): boolean;                                               // tipo A
  tick(s: RoundState, ev: GameEvent[]): void;                               // projéteis, ovo reserva
  ai?: AiMountHints;
}
```
```ts
// render/battle-layers.ts (plano 6)
export interface RomBattleBuilder {           // implementado pelo plano 7
  setBg2(col: number, lin: number, word: number): void;
  setBg1(col: number, lin: number, word: number): void;
  sprite(e: ObjEntry, sortY: number, order: number): void;   // ordem de desenho de [ANI §1.4]
  cgram(index: number, bgr555: number): void;
  bg1Scroll(hofs: number): void;
}
export interface RomBattleLayer { id: string; draw(s: RoundState, b: RomBattleBuilder, a: RomAssets, frame: number): void }
export interface FallbackBattleLayer { id: string; draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void }
export const romLayers: RomBattleLayer[]; export const fallbackLayers: FallbackBattleLayer[];
```
```ts
// audio/sink.ts (plano 5)
export interface AudioSink {
  bank(id: 0x2f | 0x30): void; music(id: number): void; sfx(id: number): void;
  voice(id: number): void; stop(): void; fade(): void; tick(): void;   // tick = 1 vez por tick de jogo (fila de SFX)
}
```
Arquivos compartilhados na onda 2: `core/stages/index.ts`, `core/mounts/index.ts` e o índice de camadas `render/layers-index.ts`. Cada plano só **acrescenta linhas** neles. Conflitos de merge nesses arquivos são resolvidos por concatenação.

### 2.6 Entrada
- `BTN` ganha os botões que faltavam: `{UP:1, DOWN:2, LEFT:4, RIGHT:8, A:16, B:32, Y:64, START:128, X:256, L:512, R:1024, SELECT:2048}`.
- O núcleo usa A, B, X e Y.
- START é tratado pela sessão (pausa).
- Teclas padrão:
  - P1: WASD + J (A), K (B), L (Y), I (X), Enter (START).
  - P2: setas + Numpad1 (A), Numpad2 (B), Numpad3 (Y), Numpad5 (X), NumpadEnter (START).
- Gamepad no layout *standard*: A = 1, B = 0, Y = 2, X = 3, L = 4, R = 5, SELECT = 8, START = 9, direcional em 12 a 15 ou no eixo esquerdo. Tudo remapeável (§6.13).

---

## 3. Núcleo fiel (plano 6)

### 3.1 Unidades, grade e códigos
**Posição** em 1/256 px, igual a `+$11..$13` / `+$15..$17` da ROM, em **coordenadas de tela** [MEC §2]:
- Centro da casa: `X = 16·col − 1` e `Y = 16·(lin + 2) − 1`.
- Casa de um ponto: `col = ⌊(X+8)/16⌋` e `lin = ⌊(Y+8)/16⌋ − 2`.
- Os spawns ficam **1 px fora do centro**, em `(16·col, 16·(lin+2))`, e se alinham no 1º movimento:

| | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|
| Casa (col, lin) | (2,1) | (14,11) | (14,1) | (2,11) | (8,6) |

**Grade:**
- `GRID_W = 17`, `GRID_H = 13`, `cell = lin·17 + col`.
- Ajudante `romOff(col, lin) = lin·$40 + col·2`, para comparar com traços (ex.: `$0044` = (2,1)).
- A volta pela borda soma ou subtrai 272 px, isto é, 17 colunas [MEC §5.4].

**Grade lógica = códigos de 16 bits da ROM** [MEC §2, ARN §2.3]. As regras de bloqueio vêm dos bits, como no `movesim.py`. A arena 3 herda o comportamento certo do código `0F41` automaticamente.
| Código | Significado |
|---|---|
| `0000` | piso |
| `EC40` | pilar ou parede |
| `CC80` | soft block |
| `C900` | bomba parada |
| `EDC0` | queimando (soft ou item) |
| `EE80` | bloco de pressão |
| `1000` | chama |
| `0940+id` | item |
| `0980+id` | caveira |
| `0970+t` | ovo tipo *t* (item `$30–$3F`) |
| `0001` | bloco de pressão caindo |
| `0F41` | bola (arena 3) |
| `0040` | seta (arena 7) |
| `0C00` | pad (arena 8; `1C00` com chama) |

Ao lado da grade, arrays auxiliares:
- `cellT0[]`: tick de início (chama, queima, queda);
- `cellAux[]`: peça da chama, tipo de queima, direção da seta;
- `floor[]`: piso visual por casa, que a arena 6 repinta.

**Estado em arrays simples** (`number[]`), para o hash JSON continuar trivial.

### 3.2 RNG [MEC §6.3, ARN §2.4]
```ts
export interface Rng16 { seed: number }                 // 16 bits
export function rnd(r: Rng16, n: number): number {      // 0..n-1; só (n & $FF) importa
  r.seed = ((r.seed | 1) * 0x383) & 0xffff;
  return (r.seed * (n & 0xff)) >>> 16;
}
```
- Semente inicial **`$0012`**, como no boot. O RNG só avança quando alguém o chama.
- O estado **atravessa rodadas e partidas** dentro da sessão. Não há novo sorteio de semente por rodada.
- `?seed=N` na URL e o `MatchConfig.seed` trocam a semente inicial (testes e, no futuro, online).
- A IA **não** consome o RNG (`aiRoll`, §9).
- As opções extras que não existem no original (spawns aleatórios, §6.13) usam um RNG separado, derivado da semente da partida. Assim a sequência do jogo não muda.

### 3.3 Montagem da rodada [MEC §6.1–6.3, ARN §2.4]
Ordem exata de consumo do RNG:
1. **1 chamada `rnd($FF)` por jogador presente**, em `$C2:02CD`.
   - Com 5 jogadores, `$12` vira `$C689`.
   - Com menos jogadores: §12, A3.
2. Carrega o **layout-base** da fase (`core/tables/stages.ts`, gerado do mapa `rec+$09` com o lógico `$C4:0892`):
   - fases 1, 2, 6 e 10: todas as casas sem pilar são soft;
   - fases 3, 4, 7 e 9: casas especiais ou vazias fixas;
   - fases 5 e 8: sem blocos.
3. Para cada **jogador presente**, abre o 3×3 em volta do spawn, pelo caminho cumulativo `0, −$40, +2, +$40, +$40, −2, −2, −$40, −$40`.
4. Remove **N** soft blocks (`rec+$1E`):

| Fase | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| N | 14 | 14 | 12 | 4 | 8 | 14 | 4 | 0 | 4 | 14 |
| Soft final (5 jogadores, semente do boot) | 80 | 80 | 80 | 70 | 0 | 80 | 62 | 0 | 78 | 80 |

   Cada remoção:
   - até 15 tentativas de `col = rnd(13)`, `lin = rnd(11)`, offset `lin·$40 + col·2 + $44`;
   - aceita se a casa for soft;
   - se nenhuma tentativa servir, usa a 1ª soft da lista `$C4:1327` (113 casas sem pilar);
   - se a lista também não tiver soft, termina.
5. `STAGES[n].init?(s)`: objetos e sorteios próprios da fase (§4).
6. **Itens escondidos** (lista fixa da fase, `rec+$18`, §3.8). Para cada entrada `(casa, item)`:
   - se a casa for `$0044`: até 15 tentativas de `rnd(13)`, `rnd(11)`, aceitando casa soft **sem item**; senão, a 1ª da lista `$C4:1327` que sirva;
   - se a casa for fixa: só entra se for soft.
   - Resultado: tabela `hidden` com pares (casa, item). O bloco queimando consulta essa tabela quando termina.
7. **Status inicial:**
   - todos: velocidade nível 1, 1 bomba, fogo 0 (alcance 2), invencibilidade 0;
   - **fase 5:** 5 bombas, fogo 4, Chute, Soco, Luva e **P** [MEC §8];
   - prêmio do Racer, quando houver (§3.14).

### 3.4 Estado e ordem do passo
```ts
export type Phase = 'intro' | 'play' | 'won' | 'timeUp' | 'over';
export interface RoundState {
  tick: number; phase: Phase; phaseT0: number;
  stage: number; rules: Rules; rng: Rng16;
  clock: { sec: number; sub: number };            // §3.11
  grid: number[]; cellT0: number[]; cellAux: number[]; floor: number[];
  hidden: [number, number][];                     // (cell, item), consumida ao revelar
  players: Player[];                              // 5 slots; present=false para Off
  bombs: Bomb[]; flyers: Flyer[];                 // voando/quicando: bombas, itens, caveiras
  pressure: PressureState; bad: BadBomberState[];
  stageState: unknown;                            // do módulo da arena (plano 8)
  mountState: unknown;                            // do plano 9 (ovos no chão, vagas $1ED4-$1ED6)
  diseaseOnce24: boolean;                         // $1EE4
  result: RoundResult | null;
}
export interface Player {
  slot: number; present: boolean; char: number; team: number;
  x: number; y: number; moveDir: number /*0..7, 8 = parado*/; face: 0 | 2 | 4 | 6;
  speedLv: number; bombsCap: number; bombsFree: number; fire: number; fullFire: boolean;
  bombType: 0 | 1 | 2; glove: boolean; punch: boolean; kick: boolean; pItem: boolean;
  passSoft: boolean; passBomb: boolean; heart: boolean; costume: number /* -1 ou 0..7 */;
  disease: number /* 0 ou $21..$2B */; contactLock: number; inv: number;
  effect: { kind: 0 | 2 | 0x0a; left: number };   // +$E4/+$E6: 2 = lento (montaria E), $0A = invertido (arena 6)
  act: PlayerAct; actT0: number; actLeft: number; // estado e animação (§7.4)
  carry: number; state: 'alive' | 'dying' | 'out' | 'bad'; prevBtn: number;
  mount: unknown | null;                          // plano 9
}
export type PlayerAct = 'idle' | 'walk' | 'lift' | 'carryIdle' | 'carryWalk' | 'throw' | 'punch' | 'pPunch'
  | 'detonate' | 'stunned' | 'dying' | 'victory' | 'mounting' | 'dismount' | 'launched' | 'pushed' | 'shocked'
  | 'dance' | 'bad';
```
**Passo** `step(s, inputs[5])`:
1. `tick++`.
2. Máquina de fase:
   - `intro`: 10 ticks em que só o relógio anda e as entradas são ignoradas; depois 52 ticks sem lógica (fade + espera, C11); então `play`.
   - `won` e `timeUp`: §3.12.
3. `play` e `won`: **jogadores em ordem P1..P5**. Para cada um:
   - entrada (com doenças e efeitos aplicados);
   - máquina de ação (§3.7), movimento (§3.5) e colocação;
   - coleta de item;
   - **acerto**: se a própria casa tem `1000`, ou `EE80` recém-pousado, no momento do processamento dele.
   Consequência: uma chama criada no tick *t* (os objetos rodam depois dos jogadores) atinge jogadores no tick *t+1*.
4. **Objetos em ordem de criação:**
   - bombas (pavio, deslize), explosões, chamas, queimas;
   - voadores;
   - pressão;
   - Bad Bombers;
   - `MountModule.tick`.
5. `STAGES[stage].tick`.
6. Contágio (§3.9) e verificação de fim (§3.12).

### 3.5 Movimento [MEC §3.1–3.3] ✅ (modelo validado em 20.034 ticks)
Porte fiel de `movesim.py`. As tabelas são extraídas para `core/tables/movement.ts`:
| Tabela | Endereço | Uso |
|---|---|---|
| `SPEED` | `$C3:2A50` (8 níveis × 9 direções, `dx,dy` em 1/256) | velocidade por nível e direção |
| `DPAD` | `$C3:2C50` (16) | nibble do direcional → `din` |
| `CODE` | `$C3:2520` (256) | código de subposição |
| `TBL` | `$C3:2C60` / `$C3:2D40` / `$C3:2CD0` (3 × `$70`) | cruzamento / corredor vertical / corredor horizontal |
| `A20` | `$C3:2A20` (32 × s16) | empurrão contra parede |
| `DIAM` | `$C3:2620` (256 × (s16, s16)) | empurrão diamante |
| `PAR` | `$C2:4F25` (4) | paridade da casa → tabela |
| `KICK_MASK` | `$C3:2EB0` | subposições que disparam o chute (§3.7) |

Velocidade (1/256 px por tick):
| Nível | 0 | **1** (inicial) | 2 | 3 | 4 | **5** (máximo) | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| 1/256 px/tick | 224 | 256 | 288 | 320 | 352 | 384 | 512 | 128 |
| Uso | não usado | inicial | | | | máx. pelos patins | caveira `$21`, arena 2 rápida | caveira `$22`, arena 2 lenta, montaria E |

Algoritmo por tick:
1. `din = DPAD[nibble]`. Sem direção: zera as frações e `moveDir = 8`.
2. `code = CODE[((Y−8)&15)·16 + ((X−8)&15)] & 15`.
3. Tabela escolhida pela paridade da casa.
4. `v = TBL[code·8 + din]`, com a nova direção em `v & 15`.
5. Se `v ≥ $10`, testa o vizinho `1 << (v>>4)` na máscara `$82`. Se estiver bloqueado, para; num corredor, usa `TBL[$68 + din]`.
6. Velocidade = `SPEED[nível][dir]`. As diagonais **não** são normalizadas.
7. Posição tentativa:
   - **Entrar em casa com bomba zera tudo.**
   - `$82`: vizinhos bloqueados. Bloqueiam parede, soft (exceto com atravessa-soft ou montaria tipo 2), bomba (exceto com atravessa-bomba) e queimando.
   - `$86`: só bombas.
   - Aplica os empurrões `A20`.
   - **Bomba vizinha:** zera a componente da velocidade na direção dela, se o jogador já passou do centro.
   - Sem empurrão num cruzamento, aplica `DIAM`.
8. `posição += velocidade`. Se a velocidade for 0, zera as frações.

- `face` segue `moveDir`: 0 = cima, 2 = direita, 4 = baixo, 6 = esquerda. As diagonais ficam no horizontal [ANI §2.6].
- Jogadores **não colidem** entre si.
- A bomba recém-colocada fica na casa do jogador, que anda livre dentro dela; **depois de sair, não volta** [MEC §3.3].
- Comportamento esperado (teste, nível 1 andando para baixo, [MEC §3.2]):

| Situação | Resultado |
|---|---|
| Abertura, \|dx\| ≤ 7 | vira diagonal e entra na casa no mesmo tick que entraria alinhado (tick 9) |
| Abertura, \|dx\| = 8 ou 9 | igual, com 1–2 ticks de atraso |
| Pilar à frente, \|dx\| ≤ 3 | não anda |
| Pilar à frente, \|dx\| ≥ 4 | desliza 1 px/tick e entra em diagonal |
| Parede ou bloco à frente, alinhado | para no centro |

- **Fase 4:** os pisos especiais (`$9C` bit `$100`) ficam de fora; o piso é normal (§12, A10).

### 3.6 Bombas e explosões [MEC §4]
| Regra | Valor |
|---|---|
| Pavio | contador **126** (`$7E`), decrementado 1 por tick. **Explode 127 ticks depois do tick da colocação** |
| Pavio com caveira `$27` / `$28` | 62 / 253 |
| Arena 2 | `fuseStep`: 1 no modo normal, 2 no rápido, 1 só em tick par no lento (C5) |
| Chama | **25 ticks** em todas as casas. O braço inteiro aparece no mesmo tick |
| Reação em cadeia | a bomba atingida explode **2 ticks depois** |
| Alcance | fogo 0..8 → 2..10; fogo 9 → 10; **fogo 10 → 1** (caveira `$25`) |
| Máximos | fogo **7** por item (alcance 9); bombas **8**; patins nível **5** |
| Fogo total (`$04`) | toda bomba nasce com fogo 7 |
| Tipos (`+$43`) | 0 normal; 1 **remota**: explode com B e não explode pelo pavio (§12, A12); 2 **perfurante**: a chama atravessa soft blocks e queima todos no alcance |
| Soft atingido | vira `EDC0` e queima **24 ticks**. No 24º tick revela o item escondido (se houver): tabela `hidden`, e ovos pelo `MountModule.revealEgg` |
| Item atingido | queima (`EDC0`), some e **segura a chama** como um soft block. Não reaparece |
| Bomba atingida | detona em cadeia (+2). O braço para na casa da bomba (§12, A12) |
| Pavio congelado | durante voo (soco, arremesso) e na mão (luva). **Na bomba chutada o pavio continua** |
| `placeBomb` | com A, se houver bomba disponível e a casa não tiver bomba. Emite `bomb_placed` |

### 3.7 Ações: chute, soco, luva, P, B, X
- **Chute** [MEC §5.3], com item `$0E` ou montaria tipo A:
  - **dispara sozinho** quando o jogador olha para uma bomba parada na casa vizinha e a subposição está em `KICK_MASK` (1–2 px antes do centro);
  - a bomba desliza a **2 px/tick** (8 passos por casa), fora da grade enquanto desliza;
  - antes de cada casa nova verifica o destino e **para alinhada** diante de parede ou soft (bits `$8400`), bomba ou **jogador**;
  - **item no caminho é esmagado** e a bomba segue; ovo bloqueia 🟡;
  - **X** para a bomba na casa atual;
  - o pavio continua;
  - `kickedBombEnter` da fase pode desviar ou parar (§4).
- **Soco** [MEC §5.4], com item `$0D` + **Y**, bomba na casa vizinha à frente:
  - voo de **3 casas em 17 ticks**. Horizontal: dx `3,3,4,4,4,4,3,3,3,3,3,3,3,3,2,0,0` e altura `−4,−6,−7,−8,−9,−10,−10,−10,−10,−9,−8,−7,−6,−4,0` (pico 10). Vertical para cima: dy `−4`×10, `−3`×3, `0,+1,0,0`. A vertical para baixo sai do script `$C1:2126` (§3.16);
  - pavio congelado.
  - **Pouso** (`$C1:27A4`):
    - casa livre: vira bomba normal;
    - bloco, bomba, item ou caveira: **quica 1 casa** em 8 ticks (dx `3,3,3,3,2,2,0,0`, altura `−4,−6,−6,−6,−4,0`) e testa de novo;
    - jogador: **atordoa** (§3.10) e quica;
    - bloco queimando: a bomba some 🟡.
  - **Borda:** dá a volta (±272 px), quicando por cima das paredes. Da col 13 para a direita pousa na col 2; da lin 2 para cima, na lin 10.
- **Luva** [MEC §5.5], item `$07`:
  - parado sobre uma bomba (a recém-colocada ou outra), **aperta A de novo e segura**: levanta em 4 ticks, pavio congelado, e o jogador anda normalmente;
  - **soltar A arremessa**, com ~20 ticks travado;
  - mira automática: o **1º jogador a 2, 3 ou 4 casas** na direção; senão **5 casas**;
  - voo de 11–12 ticks (scripts `$C1:2571/2569/2561/2559` para 2/3/4/5 casas);
  - pouso, quique e volta pela borda iguais ao soco.
- **P** [MEC §5.2], item `$12`, **Y**:
  - com P, Y **sempre** faz o golpe;
  - o jogador avança **16 px (4 px/tick, 4 ticks)** e fica **35 ticks** na ação;
  - jogadores na casa da frente são **empurrados 3 casas (48 px, 4 px/tick, 12 ticks)**, parando antes de bomba, soft ou parede;
  - com Soco junto, o golpe também soca a bomba da frente;
  - contra parede dura, o avanço não sai do lugar;
  - fase 5: empurrão contra a cerca atordoa (`outOfBounds`, §4).
- **Y sem P**: soca, se tiver Soco. Com montaria, `MountModule.onY` tem precedência.
- **B:** detona as bombas remotas (§12, A12) e mostra a pose `detonate` por 3 ticks, mesmo sem remota [ANI §3].

### 3.8 Itens [MEC §5.1, §6.2]
| ID | Efeito |
|---|---|
| `$01` | bomba +1 (livre e capacidade), até 8 |
| `$02` | `bombType = 2` (perfurante) |
| `$03` | fogo +1, até 7 |
| `$04` | fogo total |
| `$05` | patins +1, até nível 5 |
| `$06` | `bombType = 1` (remota) |
| `$07` | luva |
| `$08` | colete: `inv = 511` |
| `$09` | coração |
| `$0A` | atravessa soft |
| `$0B` | atravessa bomba e zera o chute |
| `$0C` | para o tempo, 1024 ticks (só existe na tabela; não sai no Battle) |
| `$0D` | soco |
| `$0E` | chute e zera o atravessa-bomba |
| `$0F` | **traje**: `costume = rnd(8)` e vale 1 vida |
| `$12` | **P** |
| `$21..$2B` | caveira com essa doença |
| `$30..$3F` | ovo (plano 9) |

- `$11` só aparece nos prêmios do caça-níquel (§12, A10).
- **Pegar qualquer item cura a doença**, que é arremessada como caveira nova (§3.9).
- SFX: `$08` para item, `$0A` para caveira.

Listas fixas por fase (`rec+$18`, `core/tables/items.ts`):
| Fase | Total | Bomba | Fogo | Patins | Chute | Soco | Luva | P | Caveira `$21` | Ovo `$30` | Outros |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 30 | 8 | 5 | 3 | 3 | 2 | 2 | 2 | 1 | 4 | – |
| 2 | 31 | 10 | 6 | 2 | 3 | 0 | 3 | 2 | 1 | 4 | – |
| 3 | 35 | 10 | 5 | 5 | 2 | 2 | 2 | 3 | 1 | 4 | fogo total 1 |
| 4 | 26 | 6 | 5 | 3 | 2 | 2 | 3 | 5 | 0 | 0 | – |
| 5 | 0 | | | | | | | | | | todos começam fortes |
| 6 | 34 | 10 | 6 | 3 | 3 | 2 | 2 | 2 | 1 | 4 | fogo total 1 |
| 7 | 35 | 10 | 6 | 4 | 5 | 1 | 0 | 3 | 1 | 4 | fogo total 1 |
| 8 | 0 | | | | | | | | | | caça-níquel |
| 9 | 32 | 10 | 6 | 3 | 3 | 3 | 3 | 3 | 1 | 0 | – |
| 10 | 33 | 10 | 6 | 5 | 3 | 0 | 0 | 0 | 1 | 0 | traje 8 |

A **ordem das entradas** vem da ROM (`$C3:7C30`, `…7E14`, `…7FF8`, `…8252`, `…83E2`, `…83E4`, `…8640`, `…8814`, `…88A8`, `…8A68`) e importa para o sorteio. O extrator a preserva.

### 3.9 Caveira: 11 doenças [MEC §5.6]
| ID | Efeito | |
|---|---|---|
| `$21` | rápido: nível de velocidade 6 (2 px/tick). É a caveira das listas | ✅ |
| `$22` | lento: nível 7 (0,5 px/tick) | ✅ |
| `$23` | diarreia: solta bomba sozinho sempre que tem bomba disponível | 🟡 |
| `$24` | prisão de ventre: não solta bombas. **Só sai 1 vez por rodada** (`diseaseOnce24`) | 🟡 |
| `$25` | fogo mínimo: bombas com fogo 10 (alcance 1); só coloca com **todas** as bombas disponíveis | ✅ |
| `$26` | não para: sem direção apertada, repete a última | 🟡 |
| `$27` / `$28` | pavio curto 62 / longo 253 | 🟡 |
| `$29` | invisível: pisca pelo padrão `$C2:4F68` | 🟡 |
| `$2A` | controles invertidos (↑↓ e ←→) | 🟡 |
| `$2B` | perde 1 item a cada **32 ticks**; os itens voam (§3.10) | ✅ |
| `$2C` | troca de posição. **Fica fora do sorteio** | – |

- **Sem duração.** A doença termina por:
  - (a) **pegar qualquer item**: ela vira uma caveira nova de ID `rnd(12)+$21`, sorteando de novo em `$2C` e em `$24` se já saiu; voa 3–5 casas;
  - (b) **contato** `|dx| ≤ 8 e |dy| ≤ 8 px`: passa para o outro e **quem passou fica curado**. Não volta enquanto o contato continuar (`contactLock`). Evento `disease_passed`;
  - (c) atordoamento: é a 1ª perda;
  - (d) morte: some, não é solta.

### 3.10 Acerto, invencibilidade, atordoamento, morte e drops [MEC §3.4–3.5, §5.8, §6.4]
- **Invencibilidade no início: 0.** `inv` cai 1 por tick; a chama não mata com `inv > 0`.
- **Ordem de absorção de um acerto de chama** (🟡, §12 A7):
  1. montaria (`MountModule.onHit`);
  2. traje: some e dá `inv = 96`;
  3. coração: some e dá `inv = 96`;
  4. morte.
- **Bloco de pressão mata sempre**, mesmo com coração, invencibilidade ou montaria.
- **Morte** (tick do acerto = 0):
  - 1–21: animação (`act = 'dying'`);
  - 22–64: pós-morte, com os drops;
  - **65**: `state = 'out'`.
- **Drops da morte**, a cada 4 ticks a partir do 22, uma categoria **inteira**, nesta ordem:
  1. bombas (capacidade − 1);
  2. luva;
  3. tipo de bomba (remota ou perfurante);
  4. atravessa-soft;
  5. **todo o fogo**;
  6. soco;
  7. chute;
  8. atravessa-bomba;
  9. patins (nível − 1);
  10. P.

  Não soltam: fogo total, coração, doença, montaria. Cada unidade aparece **direto** numa casa livre:
  - índice `rnd(113)` na lista `$C4:1327`;
  - se ocupada (bloco, bomba, item, jogador ou piso especial), avança `rnd(8)` casas, até 15 vezes;
  - depois disso, a 1ª livre da lista;
  - grava `0940|id` na hora.
- **Atordoamento**, por bomba (socada, arremessada ou do Bad Bomber) caindo na cabeça, ou pela cerca da fase 5:
  - **63 ticks** parado;
  - perde **1–4 itens** (`(rnd & 6)/2 + 1`, o *n* do `rnd` sai de `$C2:51C4`, §3.16);
  - prioridade: doença, depois montaria ou traje, depois a lista de 13 perdas `$C2:519D`;
  - cada item perdido **voa 3, 4 ou 5 casas** numa direção (`rnd(12)` sobre 12 scripts `$C1:6715`), quica se cair em casa ocupada, dá a volta na borda e some se cair em bloco queimando.
  - Evento `stunned` (SFX `$12` + voz `$02`).

### 3.11 Relógio, pressão, Morte Súbita e TIME UP [MEC §7.2–7.4, ARN §2.6]
**Relógio:**
- `clock = {sec, sub}`. Início `sec = minutos·60 + 1`, `sub = 1`. Opções 1:00, 2:00, **3:00**, 5:00 e ∞.
- ∞ usa `sec = 30·60 + 1`, e o relógio **não decrementa com `sec ≥ 600`**.
- Por tick de relógio: `if (--sub === 0) { sec--; sub = 60 }`.
- Os 10 ticks do `intro` levam de 3:01/1 a **3:00/51**, e por isso o 1º segundo jogado dura 51 ticks (C11).
- Exibição: `⌊sec/60⌋:sec%60`.

**Gatilho da pressão:** quando `sec` passa de **62 para 61** (com a opção 1:00, de **42 para 41**). No tick T do gatilho:
- evento `hurry` (SFX `$15` + voz `$10`; faixa por 192 ticks, §6.9);
- os Bad Bombers saem de cena (🟡, A9).

**Controlador:**
- Em **T+192**, as paredes externas (lin 0 e 12, col 2..14) viram `EE80`.
- O **1º passo é em T+205**; depois, **1 passo a cada 14 ticks**.
- Espiral horária a partir de (2,1): lin 1 →, col 14 ↓, lin 11 ←, col 2 ↑, e depois o anel seguinte.
- Casa já dura (`EC40`/`EE80`) **gasta o passo** sem bloco.
- Passo normal: grava `0001` e, depois de **36 + 2·lin ticks**, vira `EE80`.
- **Ao pousar:**
  - mata quem estiver na casa;
  - apaga a bomba **sem explodir**, e a bomba volta para o dono;
  - apaga o item;
  - cobre o soft block.
- Evento `pressure_step` (SFX `$27`) no início de cada passo com bloco (🟡, A11).

| | Passos | Fim |
|---|---|---|
| Morte Súbita Off | **80** (2 anéis) | para |
| Morte Súbita On | **143** (arena inteira) | acaba por volta de 0:25 |

**0:00 com 2 ou mais de pé:**
- `phase = 'timeUp'`: todos congelam, bombas e objetos inclusive;
- faixa "TIME UP" por **160 ticks** (32 + 128);
- `over` com resultado **DRAW**;
- a música para no 0:00 (STOP, sem apito). Isso vale também com Morte Súbita On.

### 3.12 Fim de rodada, partida e times [MEC §7.1, §7.4, §7.7]
**Vitória:**
- Decidida **2 ticks depois** de restar ≤1 jogador sem estar morrendo.
- `phase = 'won'`: o vencedor fica imune, entra em `act = 'victory'`, e **as bombas congelam**, sem explodir.
- As animações de morte continuam. Quando todas terminam (65 ticks depois do último acerto), vêm **128 ticks** de comemoração e então `over`.
- `victory_sfx` (SFX `$17`) sai 31 ticks depois do início da comemoração (🟡, A17).

**Todos mortos,** ou os últimos morrem no mesmo tick: `over` DRAW **no tick** em que a última animação termina, sem os 128 ticks.

**Resultado:** `RoundResult = {kind: 'win' | 'draw', winner: slot | null, reason: 'last' | 'dead' | 'time'}`.

**Partida:**
- `finishRound(m, s)` soma **+1 coroa** ao vencedor. A tela mostra o +1 durante o preto do fade (§6.10).
- A partida termina quando alguém chega a `Matches` coroas (1–5, padrão 3).
- Coroas zeradas ao voltar para a seleção de fase.
- `m.rng` recebe `s.rng`.

**Team Battle** (🟡, A1): `$01A4 = 32`, times `$1F20+2n`. Provisório:
- a rodada acaba quando resta ≤1 time com alguém de pé;
- todos os membros do time vencedor ganham +1 coroa;
- a partida acaba quando um membro chega a `Matches`;
- as paletas por time vêm de `$C2:7B9D`.

### 3.13 Bad Bomber [MEC §7.5] (regra "Bomber Vingador")
- **Entrada:** depois dos 65 ticks, o morto vira Bad Bomber (`state = 'bad'`, act `bad`). Nasce fora da tela do lado em que morreu (X < 128 → esquerda) e anda 1 px/tick até a moldura.
- **Movimento:**
  - percorre o retângulo **X ∈ {15, 239}, Y ∈ {32, 224}** a **1 px/tick** seguindo o direcional;
  - faz os cantos sozinho;
  - para no ponto do lado em que o direcional deixa de fazer sentido.
- **Status:** 1 bomba, fogo 1 (alcance 3), sem habilidades.
- **Arremesso:**
  - com A, bomba na mão, fora dos cantos e dos trechos vizinhos a eles (`$C2:5CC7`, 🟡);
  - mira da luva: 2/3/4 casas, senão 5;
  - voo de 11 ticks;
  - pousa com pavio cheio (126);
  - na cabeça de alguém, atordoa.
- **Cadência:** só pega outra bomba **depois que a anterior explode + 48 ticks**. Com A apertado direto, o ciclo dá ≈190 ticks.
- **Nunca volta para a partida**, nem matando alguém. Sai de cena no gatilho da pressão (🟡).
- CPU morta com a regra ligada: a IA controla (§9).

### 3.14 Racer Bomber [MEC §7.6, MNT §A.9] (regra "Corrida Bônus"; só no Free-for-All)
- Ligar a regra zera o prêmio (`racerPrize = null`).
- No fim de cada partida, com a regra On, o campeão joga a corrida bônus (§6.12), que define `racerPrize`.
- Na partida seguinte, **em toda rodada**, esse jogador começa com o prêmio, aplicado no passo 7 da §3.3.
- **Prêmios:** tabela de efeitos `$C2:08F4`, extraída para `core/tables/racer.ts`, com 17 entradas.
  - A MEC lista: bomba +1, bomba perfurante, fogo +1, fogo total, patins +1, remota + luva, luva, chute, nada, atravessa-bomba, atravessa-soft, **patins −1**, soco, coração e P.
  - A ordem e os índices saem da ROM (a MNT viu índice 8 = chute).
- **Não mexe na velocidade de todos.** A regra da v1 estava errada.

### 3.15 Eventos (`GameEvent`), consumidos pelo render e pelo áudio
| Evento | Quando | Som [AUD §3] |
|---|---|---|
| `bomb_placed {slot, cell}` | colocar | SFX `$0C` |
| `explosion {cell, owner}` | explosão (1 por bomba) | `$07` |
| `item_picked {slot, item}` | coleta | `$08`; caveira `$0A` |
| `disease_passed {from, to}` | contágio | `$0A` + voz `$04` 🟡 |
| `footstep {slot}` | a cada 20 ticks andando | `$0B` |
| `bomb_kicked {slot}` | chute | `$0D` |
| `punch {slot}` / `p_punch {slot}` | soco / golpe P | `$0D` + voz `$03` |
| `throw {slot}` | arremesso da luva | `$0E` + voz `$03` |
| `bomb_bounce` / `bomb_landed` | quique / pouso | `$0E` 🟡 / `$0F` |
| `player_hit {slot}` | acerto | voz `$06` em +2 ticks; SFX `$10` ≈11 ticks depois da voz |
| `stunned {slot}` | atordoamento | `$12` + voz `$02` 🟡 |
| `hurry` | gatilho da pressão | `$15` + voz `$10` |
| `pressure_step {cell}` | passo com bloco | `$27` |
| `victory_sfx {slot}` | §3.12 | `$17` |
| `time_up` | 0:00 | STOP |
| `round_over {result}` | `over` | – |
| eventos das arenas e montarias | §4, §5 | ver lá |

### 3.16 Fatos a extrair (`scripts/rom-facts/`, plano 6)
Os relatórios dão o endereço, mas não transcrevem a tabela inteira:
- tabelas de movimento (§3.5);
- listas de itens das 10 fases, na ordem;
- lista `$C4:1327`;
- layouts-base (mapa `rec+$09` → lógico);
- scripts de voo:
  - soco em 4 direções (`$C1:2126`);
  - quique;
  - luva (`$C1:2559..2571`);
  - itens que voam (`$C1:6715`, 12 scripts);
  - Bad Bomber;
- lista de perdas `$C2:519D` e o *n* do sorteio em `$C2:51C4`;
- tabela da cápsula `$C1:5DA4`;
- prêmios do Racer (`$C2:08F4`) e roleta (`$C3:2FB0`);
- padrão do invisível `$C2:4F68`.

Todas são validadas por `tests/rom/facts.test.ts`.

---

## 4. Arenas especiais (plano 8) [ARN §7]
Cada fase é um `StageModule` em `core/stages/stageN.ts`, com camadas de render (ROM e fallback) e dicas de IA próprias. A v1 estava errada nas arenas 2, 3, 6 e 8.

### 4.1 Arena 2: "Rápido e Devagar" (modo global) ✅
- **Temporizador:** `t = $140 + rnd(256)`, isto é, 320–575 ticks. O `rnd(256)` com `n & $FF = 0` sempre daria 0: conferir a forma real em `$C3:0AAF` (§12, A10).
- **Aviso:** 128 ticks antes do fim, SFX `$26`.
- **Sorteio do modo** na tabela `$C3:0B11` (32 entradas):

| Modo | Chance | Velocidade dos jogadores | Pavio | BG1 (relógios translúcidos) |
|---|---|---|---|---|
| 0 normal | 16/32 | nível próprio | 127 | +8 a cada 4 ticks |
| 1 rápido | 13/32 | **nível 6 (2 px/tick), ignora patins** | decrementa 2 por tick → **64** | +32 a cada 4 ticks |
| 2 lento | 3/32 | **nível 7 (0,5 px/tick)** | decrementa só em tick par → **253** | +1 a cada 4 ticks |

- Sair o mesmo modo não gera troca visível.
- O HOFS do BG1 fica no `stageState` (depende da história do modo).
- **Visual:**
  - *color math* `half` (BG1 com BG2);
  - animação de tiles: relógios `$0E0–$0E6` em 8 quadros e engrenagens em 4 quadros, 22 ticks por quadro, ciclo de 176.

### 4.2 Arena 3: "Bombardeio Orbital" (2 bolas) ✅
- **Início:** bolas em **(6,5) e (10,7)**, lógico `0F41`.
- **Disparo:** chama na casa da bola. Ela sai para o lado **oposto** à chama; os vizinhos são checados na ordem baixo, esquerda, cima, direita (a 1ª com chama).
- **Movimento:**
  - **1 px/tick, 16 ticks por casa, até 8 casas**, fora da grade enquanto rola;
  - bloqueio (duro, bomba `C900`, casa com bits `$30`): vira `+1/+3/+2` ou `+3/+1/+2` (escolha por `rnd`, `$C3:087D`);
  - 4 falhas seguidas: para;
  - o **1º soft em que bate é destruído** (vira `EDC0`) e a bola vira;
  - parar sobre bloco de pressão: a bola some.
- **Toque em jogador** (`|dx| < 8 e |dy| < 8`, parada ou rolando):
  - **atordoa 66 ticks** (rotina `$C2:0E86`);
  - 1º toque: fogo −1. 2º toque: bombas −1 e fogo −1;
  - depois, **64 ticks imune à bola** (`inv = $40`);
  - **não mata e não explode bombas**.
- **Visual:**
  - bolas: sprites de `$D1:87CE` (anim pela lista de objetos `$C3:93DD`);
  - OBJ extra `$C8:FA44` → `$7C00`;
  - plateia animada: 24 tiles × 2 quadros, 24 ticks.

### 4.3 Arena 4: "Não Me Empurre"
- Sem objeto especial.
- A grama dos cantos (`1DE0–1DEE`) e a terra dura (`144E/146E/14EA`) têm tratamento `$9C & $100` não medido. Provisório: piso normal (§12, A10).

### 4.4 Arena 5: "Escola de Choques"
- Sem blocos. Status inicial forte (§3.3).
- **Cerca:** jogador fora de `x ∈ [24,232)` ou `y ∈ [40,216)` (por empurrão do P ou por voo) → `outOfBounds`, com choque = atordoamento de 63 ticks e perda de itens, act `shocked` (g50/g55).
- **Visual:** pilar `$004` animado em 4 quadros (`$0E0…$0E6`) + moldura `$080–$08E`, 9 ticks por quadro.

### 4.5 Arena 6: "Piso Traiçoeiro" (piso repintado) ✅ (`$C1:3DD9`, `$C1:550B`, `$C2:1676`)
- **Piso inicial:** todo `1C06`.
- **Contador:** `$1EAA = 64 + rnd(64)`, sorteado no `init`.
- **Repintura:** a cada explosão, por braço, sorteia `v = rnd & 15` (≠ 0, detalhe na §12, A10). Cada casa de chama do braço recebe `$C1:5558[v]` ∈ {`1C0A` listras, `1C06` normal}.
  - A cada casa de chama, `$1EAA` cai 1. Em 0, a casa vira **`1C0C` caveira** e o contador volta a 64 + rnd(64).
  - Quando `$1EAA & 7 == 2`, a casa vira **`1C08` caveirinhas**.
- **Efeitos:**
  - **`1C0A`:** ao entrar, o jogador é empurrado na direção em que olha, a **2 px/tick** e sem controle, até a próxima casa (act `pushed`);
  - **`1C0C`:** controles invertidos (`effect = {kind: $0A, left: $40}`, que cai 1 a cada 4 ticks → **256 ticks**), renovado enquanto estiver em cima; SFX `$0A`;
  - **`1C08`:** bomba chutada **para** na casa anterior. O jogador não sofre nada.
- **Visual:**
  - *color math* `half`;
  - soft `$002` animado (`$0E0…$0E6`) + `$082`/`$084`, 9 ticks por quadro.

### 4.6 Arena 7: "Esconde-Explode" ✅
- **Moitas:** BG1 com prioridade 1, cobrem jogadores, bombas, chamas e itens. Só visual. Cruzes nas casas:
  - (7–9, 2–3) + (8, 4);
  - (3–5, 5–7) + (3, 4) e (5, 4);
  - (11–13, 5–7) + (11, 4) e (13, 4);
  - (7–9, 8–9) + (8, 10).
- **Setas** (lógico `0040`, passável; o jogador não é afetado):

| Casa | Direção | Palavra |
|---|---|---|
| (4,3) | → | `1CC2` |
| (12,3) | ↓ | `1CC4` |
| (12,9) | ← | `1CC6` |
| (4,9) | ↑ | `1CC0` |

  **Bomba chutada que entra numa seta vira para a direção dela.**
- **Visual:** soft `$002` animado, 12 ticks por quadro.
- A versão com setas giratórias e alçapões do código (`$C3:0E37`, `$C3:0D48`) **não é usada** no Battle.

### 4.7 Arena 8: "Caça-Níquel" ✅ (`$C3:11C7…$C3:1A83`)
- **Pads** em **(4,7), (8,7), (12,7)**: palavra `1C6E`, lógico `0C00`, passáveis.
- **Liga:** chama em qualquer pad com a máquina parada.
- **Rolos:** os 3 giram, cada um avançando 1 passo a cada 3 ticks, com 16 passos por volta e 4 símbolos. A fórmula exata do símbolo está na §12 (A10).
- **Freio:**
  - jogador **em pé** no pad do rolo (pad *i* → rolo *i*, 🟡): SFX `$27` e o freio começa;
  - sem ninguém, freio automático depois de 384 chamadas por rolo (≈1152 ticks);
  - freando: a cada 8 chamadas o rolo fica 1 tick mais lento; para quando o atraso ≥ 4 e o símbolo está alinhado.
- **Prêmio** = `$C3:1414[r1·16 + r2·4 + r3]`:

| Rotina | Combinações | Efeito |
|---|---|---|
| `14F7` | 18 | nada |
| `14F9` | 12 | 3 caveiras `$21–$2B` |
| `1611` | 12 | 3 de {03,01,05,07,0D,0E,11} |
| `1526` | 6 | 3 caveiras + evento `$C3:1CC3` depois de 128 ticks 🟡 |
| `1662` | 4 | 6 de {01,03,05} |
| `14D6` | 4 | 1 de {01,03,11,05,04,0E,07,0D,2D} |
| `163A` | 4 | 3 × `11` |
| `15BF` (0,0,0) | 1 | 12 caveiras + **pressão total** (construtor `$C1:7027`, 143 passos) |
| `16A2` (1,1,1) | 1 | 18 de {01,03,11,05,0E,07,0D} |
| `1682` (3,3,3) | 1 | `03 04 03 03 04 03 03 04 03` |
| `17AD` (2,2,2) | 1 | chuva: 16 ondas, 1 a cada 64 ticks, 3–5 itens por onda 🟡 |

- Os itens caem do alto (Y = 80). O destino fica em aberto (A10); provisório: sorteio de casa livre como nos drops da morte (§3.10).
- Terminado o prêmio, a máquina fica parada e pode ser religada na hora.
- **Visual:**
  - rolos por DMA `$7F:9000/9200/9400/9600` → tiles `$1040/$1140/$1240/$1340`;
  - cor 0 do fundo = `$0000`.

### 4.8 Arena 9: "Gangorra" ✅/🟡 (`$C2:1C58`, parâmetros `$C3:9524`)
- **Gangorras** de 3 casas (ponta, pivô, ponta), lógico `0000` (passáveis): **(4–6,3), (4–6,9), (10–12,3), (10–12,9)**.
- **Tiles:** `08E0–08EC` inclinada; `08E6/08E8/08EA` na transição, 1–2 ticks.
- **Lançamento:** entrar numa ponta vira a gangorra e **lança quem está na outra ponta**: pulo de **14 ticks**, ápice −16 px (act `launched`).
  - Sem direcional, cai no mesmo lugar e vira a gangorra de novo (vai e volta).
  - **Segurando ← ou → no início do pulo** (só horizontal): voa **8 px/tick** por ~12–13 ticks (~6 casas), dando a volta na borda (±272). Depois quica a **3 px/tick**, com pulinhos de ~9 ticks, casa a casa, **até achar casa livre**, passando por cima de paredes e soft. Cair noutra gangorra vira essa gangorra.
- **Visual:**
  - `arena9Post` (§2.3);
  - paleta 5 animada: 6 quadros `$D7:DDDC…DE7C`, 14 ticks cada, ciclo de 84.

### 4.9 Arena 10: "Alfaiataria"
- **Mecânica:** 8 trajes na lista (§3.8).
- **Visual:**
  - *color math* `add` no campo;
  - paleta 5 animada (`$D7:E47C…E4DC`, 15 ticks, ciclo de 60);
  - tiles `$04C` (`$0E8…$0EE`), 7 ticks por quadro.

### 4.10 Arena 1 e comuns
- Arena 1: sem objeto especial.
- Em todas:
  - itens piscam (cor 79: `7D80` se `frame & 4`, senão `00BF`);
  - `pal4 cor15` é animada.

---

## 5. Ovos e montarias (plano 9) [MNT §A]

### 5.1 Ovo
- **Onde:** item `$30` (4 por rodada nas fases 1, 2, 3, 6 e 7), na lista fixa da fase (§3.8). Não existe regra que ligue ou desligue os ovos.
- **Revelação** (`revealEgg`, `$C1:5DB2`):
  - se `ovos no chão + montarias ativas ≥ 2` (`$1ED4`), **o bloco não dá nada**;
  - senão, tipo = `$C1:5DA4[rnd(14)]` ∈ {2, 3, A, C, D, E, F}, com 1/7 de chance cada;
  - grava `0970 + tipo`.
- `$1ED4`, `$1ED5` e `$1ED6` **zeram a cada rodada**. A montaria não passa para a rodada seguinte.
- **Pisar no ovo** (`stepOnEgg`):
  - act `mounting` por **43 ticks** (chocar e pular);
  - depois fica montado, com vaga de sprite 1 ou 2 (`$1ED5/$1ED6`).
- **2º ovo:**
  - de tipo 0–7 já montado: vira **ovo reserva**, que segue o jogador 1 casa atrás (até 3);
  - de tipo 8–F: não é pego e fica na grade.

### 5.2 Montado
- **Acerto de chama** (`onHit`):
  - **não morre**. Fica 1 tick + **51 ticks** pulando para fora (act `dismount`); a montaria some; depois **32 ticks** de invencibilidade;
  - com ovo reserva: 1 + **44 ticks**; o reserva choca debaixo dele e ele já monta de novo, com 32 de invencibilidade. O tipo do reserva ao remontar está na §12 (A8).
- **Velocidade** igual à dos patins. Bombas com A normalmente. **Não há desmontar voluntário.**
- **Tipos** (Y pela tabela `$C2:465F`):

| Tipo | Aparência | Habilidade |
|---|---|---|
| 2 | peixe verde | passiva: **atravessa soft** (`passes`) |
| 3 | "triceratops" verde | passiva: **bombas perfurantes** (`bombType` → 2) |
| A | bicho redondo amarelo | passiva: **chute** (`kicks`) |
| C | sino dourado | **Y = linha de bombas**: todas as bombas disponíveis em linha, uma por casa, a partir da própria, na direção em que olha; para no obstáculo; SFX `$0C`. Não funciona com as doenças `$24`/`$25` |
| D | alcachofra verde | **Y = lança a montaria**: o jogador cai (1 + 51 ticks + 32 de invencibilidade); o míssil anda **2 px/tick** e **explode em cruz** ao bater em bloco ou jogador (alcance em aberto, A8) |
| E | robô-tanque azul | **Y = tiro lento**: projétil a **2 px/tick**, alcance ≈3 casas, vira nuvem no fim. O atingido recebe `effect = {kind: 2, left: 64}`, isto é, velocidade 0,5 px/tick por 255 ticks. Tem recarga (`+$C6`, valor em A8) |
| F | bola de palhaço | **Y = notas**: projétil a 0,5 px/tick; o atingido **dança** por **192 ticks** sem poder agir (act `dance`) |

- Os tipos 0, 1, 4–9 e B existem no código, mas **não saem no Battle**. Ficam fora do escopo.

### 5.3 Traje (fase 10)
- A mecânica é do plano 6: `costume = rnd(8)`, 1 vida, 96 ticks de invencibilidade ao perder.
- O plano 9 faz o **visual**, pela tabela de animação `$C2:76F5` (índice `costume & 7`) com a 2ª folha `$D4:0000`. A origem exata está na §12 (A7).

### 5.4 Gráficos das montarias
- Gráficos por tipo: `$C4:70DC` (ex.: tipo 3 → `$D3:D02B`).
- Paletas: `$C4:710C`.
- Animações: `$C2:72F9`/`$C2:75A5`, e do jogador montado `$C2:76F5`/`$C2:770D`/`$C2:773D`.
- Tabelas de ação: `$C2:6C1C`, `6C4C`, `6E45`, `6E8D`, `74CD` e `7001`.
- Ovo: `$D8:D271` (ids < `$38`) e `$D8:D2CC` (ids ≥ `$38`).
- Folha das montarias: `$D4:0000`.
- Fallback: desenhos simples por tipo em `render/fallback/mounts/`.

---

## 6. Telas e usabilidade (plano 10) [MNT §B]
**Regras gerais** [MNT §B.0]:
- **Fades:**
  - entre menus: saída **15 f** (brilho 14→0, 1 passo por frame), preto e entrada **15 f**. A entrada começa 58 f depois do botão (medido 57–61);
  - do título para os menus: saída **28 f** (2 f por passo);
  - B do VS para o título: saída 12 f, entrada 28 f (2 f por passo).
- **Cursor:** mão branca apontando à direita (sprite 16×16), **parada**, sem piscar nem balançar.
- **Repetição ao segurar:** 1º passo no frame 0, repete aos **20 f** e depois a cada **5 f**. Na seleção de fase: **36 f** e depois a cada **21 f**.
- **Listas verticais dão a volta.** Valores de regra e Humano/CPU/Nenhum **não dão a volta** (param no limite, mas o SFX 1 toca).
- **SFX de menu:** `$01` mover/alterar, `$02` confirmar (A ou START), `$03` voltar (B), `$04` pausa.
- **Música:** `$01` no título, `$12` nos menus do Battle.
- **Controles:** os menus compartilhados aceitam **qualquer controle P1–P5**. X, Y, L, R e SELECT não fazem nada.

**Textos e fontes:** tudo sai de `render/text/strings.ts` (PT-BR, na caixa de letras do original). Estilos:
| Estilo | Fonte na ROM (fatos em `render/text/glyph-maps.ts`) | Uso |
|---|---|---|
| título de menu | faixas de texto pré-desenhadas do patch (ex.: `$E1:0067`, `$E0:D5DC`, `$E0:4240`, `$E1:B699`) | títulos |
| item de menu | idem, texto vermelho | itens e valores |
| ASCII 8×8 | `$D1:BC16` (BG3, 64 tiles) | mensagens pequenas |
| faixa grande | `$D0:F57B` (PAUSE!/HURRY!/TIME UP!) | faixas da partida |
| sprite azul | `$E0:0021…$E0:37E9` | "Fase N", nomes das fases, "Escolha a fase!" |
| grandes | letras de VICTORY!, SCORE BOARD, BATTLE START!, DRAW GAME (Modo 7) | telas de resultado |

- Os glifos são **recortados** dos textos existentes: `{char, endereço, x, largura}`, que são fatos.
- Letras ausentes e acentos (Á Â Ã À É Ê Í Ó Ô Õ Ú Ç º) ganham glifos próprios em `render/text/extra-glyphs.ts`, com a mesma altura, espessura e índices de cor do estilo.
- Sem ROM: a fonte atual (`render/art/font.ts`) ganha os acentos.
- **Mapas de BG das telas:** o CAT cobre tiles e paletas, mas não os mapas. O plano 10 localiza a origem na ROM (A14). Provisório: montar pela geometria medida, com os números de tile descritos no nosso código.

### 6.1 Início
- **Boot:** sem ROM guardada, painel de carga (§2.3). Com ROM, vai direto ao título.
- Logo HUDSON, intro e demo ficam de fora (§1.4).
- A música e o AudioContext só começam depois do 1º gesto do usuário.

### 6.2 Título [MNT §B.1]
- O logo se monta a partir dos blocos OBJ do CAT `title`. A animação exata está em A14; provisório: fade-in do logo montado.
- **Menu:** 3 linhas, cursor x = 56 em y = 148 / 164 / 180:
  - **"Jogo Normal"** (cinza, pulado pelo cursor);
  - **"Jogo de Batalha"**;
  - **"Opções"** (no lugar de PASSWORD).
- "APERTE START!" pisca 64 f aceso / 64 f apagado.
- ↑/↓ com volta. A ou START confirma (SFX `$02`). B, ←, → não fazem nada.
- Ao voltar do VS, o cursor fica em "Jogo de Batalha".

### 6.3 Modo VS [MNT §B.2]
- Moldura de corda (7,51)–(248,186). Título **"Escolha o modo VS!"** (x 64–190, y 47).
- **Itens** (x 80, y 79/111/143; cursor (56, 80/112/144)):
  - **"Battle Royale"**;
  - **"Campeonato"** e **"Bombermania"**, cinza e pulados pelo cursor (fora do escopo).
- **Battle Royale** → mesma tela com moldura y 67–170 e itens **"Todos contra Todos"** / **"Em Equipes"** (x 85, y 95/127; cursor (61, 96/128)).
- B volta com o cursor lembrado.

### 6.4 Jogadores [MNT §B.3]
- Moldura (7,19)–(248,218). Título **"Defina os jogadores!"**.
- Linhas **"1º Jogador"…"5º Jogador"** (x 48, y 47 + 32·i). Valor em x ≈ 160; cursor (24, 48 + 32·i).
- **Valores:** **"Humano"** (verde), **"CPU"** (vermelho), **"Nenhum"** (azul).
  - ← vai de Humano → CPU → Nenhum; → faz o caminho inverso. Sem volta.
- ↑/↓ com volta.
- **A ou START em qualquer linha** vai para as regras. B volta. Não há "Continuar".
- Com menos de 2 jogadores ativos: A toca `$03` e não avança (A15).

### 6.5 Regras [MNT §B.4]
- Moldura (7,27)–(248,210). Título **"Configure as regras!"**.
- 6 linhas em y = 55 + 24·i, rótulos em x = 32, cursor (16, 56 + 24·i):

| Linha | Valores (padrão em negrito) |
|---|---|
| Nível da CPU | Fraco · **Normal** · Forte |
| Coroas | 1 · 2 · **3** · 4 · 5 |
| Tempo | 1:00 · 2:00 · **3:00** · 5:00 · ∞ |
| Morte Súbita | **Não** · Sim |
| Bomber Vingador | **Não** · Sim |
| Corrida Bônus | **Não** · Sim |

- ←/→ sem volta. A ou START em qualquer linha → personagens. B → jogadores.
- "Spawns aleatórios" sai desta tela e vai para Opções.

### 6.6 Personagens [MNT §B.5]
- Título **"Escolha um personagem!"**.
- **Layout:**
  - retratos de cada jogador na coluna esquerda (x ≈ 24–56, y 36–196);
  - grade 3×2 na moldura (27,35)–(224,188), colunas x = 80/128/176 e linhas y = 88/136;
  - cursor de cada jogador: cantos "[ ]" com a etiqueta "1P"…"5P" na cor do jogador.
- **Todos os humanos escolhem ao mesmo tempo**, cada um com o seu controle:
  - ←/→ dão a volta nas 3 colunas; ↑/↓ alternam as linhas;
  - A ou START confirma (`$02`) e o cursor some;
  - dois jogadores podem pegar o mesmo personagem.
- **CPUs:** quem escolhe é o **P1**, em sequência, depois de confirmar o próprio.
- **B de qualquer jogador**, mesmo depois de confirmar, volta às regras.
- **Fim:** o último A dispara o fade-out na hora (14 f), e a seleção de fase entra 50–64 f depois.
- **Em Equipes:** em seguida vem **"Escolha as equipes!"** (retratos em x = 16, y 32…160; ←/→ movem o jogador entre os lados de um emblema "VS"). Layout não medido (A1).

### 6.7 Fase [MNT §B.6]
- Título **"Escolha a fase!"** em sprite (x 72–180, y 8).
- **Miniatura central** x 72–183 (112 px). As vizinhas ficam a ±128 px, cortadas nas bordas. Tiles das prévias: `$C1:A901`, 8 blocos.
- **"Fase N"** (y 152) e o nome (y 184) são sprites azuis. Nomes:
  1. "O Clássico"
  2. "Rápido e Devagar"
  3. "Bombardeio Orbital"
  4. "Não Me Empurre"
  5. "Escola de Choques"
  6. "Piso Traiçoeiro"
  7. "Esconde-Explode"
  8. "Caça-Níquel"
  9. "Gangorra"
  10. "Alfaiataria"
- **←/→** (qualquer controle): a faixa rola **8 px/f por 16 f** (128 px), começando 1 f depois do botão. O texto troca no fim. Dá a volta (1 ↔ 10). Segurar: 36 f e depois a cada 21 f. ↑/↓ não fazem nada.
- **A ou START** (f0 = botão):

| Frame | Evento |
|---|---|
| f0 | SFX `$02` |
| f48 | música `$13`; o título some em f48–64 |
| f65–207 | **"BATALHA!"** pisca a cada frame |
| f208–277 | "BATALHA!" fixo |
| f208 | voz `$07` |
| f278–292 | fade-out |
| f293–645 | preto; banco `$2F` em +511 e música `$14` em +523 |
| f646 | a rodada é criada e começa o `intro` do core (10 ticks + fade-in de 15 + 37) |

- B → personagens.

### 6.8 Intro da rodada [MNT §B.7, MEC §7.1]
- Sem texto READY/GO.
- O brilho segue o `intro` do core: preto nos 10 primeiros ticks, depois fade-in de 15 e 37 parados.
- O controle é liberado **52 f depois do início do fade-in**.

### 6.9 Partida: faixas e pausa [MNT §B.7–B.8]
- **"RÁPIDO!!"** (faixa verde, no lugar de HURRY!!): no evento `hurry`, cruza y ≈ 128 da direita para a esquerda a **2 px/f**, visível por 192 ticks.
- **"TEMPO ESGOTADO!"** (no lugar de TIME UP!; se não couber na largura da faixa original + 25 %, **"TEMPO!"**): no `time_up`, cai do topo até o centro em 16 f e fica parado.
- **Pausa:**
  - **START de qualquer controle**, inclusive de slots CPU e em partidas só de CPU, pausa e despausa (`$04`); o relógio para;
  - só aparece **"PAUSA!"** (verde com contorno branco) no centro (x ≈ 96–160, y ≈ 110–126); **a tela não escurece**;
  - **não há opção de sair.**
  - Extra não original, necessário no navegador: durante a pausa, **segurar SELECT + START por 60 f** (teclado: Esc por 60 f) volta à seleção de fase. Nada aparece na tela até o gesto se completar.
- **Controle desconectado** (extra): se um gamepad atribuído a um humano desconectar durante a partida, a partida pausa sozinha e mostra "PAUSA!" mais a linha ASCII "CONTROLE n DESCONECTADO". Volta ao reconectar e apertar START, ou com START de outro controle.

### 6.10 Fim de rodada e placar [MNT §B.9–B.10]
**Fim da rodada:**
- Nenhum texto na arena. Pose de vitória e SFX `$17` (§3.12).
- **Depois do `over`** com vencedor:
  1. fade-out 15 f;
  2. **48 f de preto**, com a coroa +1 aplicada no início do preto, FADE do áudio, banco `$30` e música `$15`;
  3. fade-in do **placar** 15 f.
- **Todos mortos:** fade-out 15 f, 48 f de preto (🟡) e **EMPATE** (§6.11).

**Placar:**
- Céu com nuvens; painel verde de x = 8 a 248.
- Faixa **"PLACAR"** (no lugar de SCORE BOARD; x ≈ 50–212, y ≈ 20–52).
- **Linhas** "1P"…"5P" em y = 56 + 32·i: rótulo, retrato do personagem (x 48–80) e **sempre 5 casas de coroa** (x 80/112/144/176/208), qualquer que seja o valor de Coroas. Com menos de 5 jogadores: A15.
- **Coroa nova:** gira pela animação `C3:DA94` (32 quadros; durações 1×10, 2×9, 3×4, 4, 5×3, 6, 7, 8, 10, 14 = 104 f) e para de frente (tile `$106`). Durante o giro a casa fica preta.
- **Avanço:** automático, fade-out **497 f** depois do fim do fade-in. **Pular:** A, B ou START de qualquer controle a partir de **4 f** depois do fim do fade-in.
- **Depois:** fade-out 15 f, 288 f de preto e a próxima rodada (`intro` do core).

### 6.11 EMPATE [MNT §B.12]
- **Cena:** fundo azul-escuro; os 5 personagens de pé sobre um disco com holofotes (quadros por DMA do CAT `draw1/draw2`).
- **Letras** "EMPATE" crescem do centro (Modo 7) entre ~f360 e f474 e depois alternam vermelho, amarelo e verde.
- A textura Modo 7 é recomposta com as letras E, M, A recortadas da "DRAW GAME" original e P, T desenhadas por nós no mesmo estilo.
- **Som:** música `$18` e voz `$0E`.
- **Sem coroa.**
- **Pular:** **só A ou B** (START não), a partir de 4 f depois do fim do fade-in. Sem botão, espera sem limite.
- **Depois:** fade 15 f, 385 f de preto e a próxima rodada.

### 6.12 Placar final, VITÓRIA e Corrida Bônus [MNT §B.11, §A.9]
**Placar final** (alguém chegou a N coroas):
- Mesmo placar, que **não pode ser pulado** (A ignorado).
- Em **f954** (contado como na MNT, com o golpe fatal em f127), a câmera **desce 2 px/f por 128 f** até a arquibancada, sem fade.

**VITÓRIA:**
- **"VITÓRIA!"** (letras laranja; A e Ó por glifos próprios) entra deslizando pela direita (~f1090–1100).
- O troféu dourado com asas fica no centro.
- Os personagens entram correndo pela direita (~f1120–1160) com a animação de palmas `D8:2A81`.
- O campeão pula (~f1180) e fica sobre o troféu (`C3:E7F7`, folha `$C2:8EBF`). Confete a partir de ~f1160.
- **Som:** música `$16` e voz `$0A`.
- **Espera sem limite.** A, B ou START de qualquer controle **a partir de f954** → fade-out 15 f, preto 123 f, **"Escolha a fase!" na mesma fase** e coroas zeradas.

**Corrida Bônus** (Racer On, Todos contra Todos): acontece entre o botão da VITÓRIA e a seleção de fase. É um minijogo Modo 7 com **"APERTE B!"** jogado pelo campeão. O resultado grava `racerPrize`. A mecânica e os gráficos não foram catalogados (A2). Provisório:
- tela própria: a pista é um gradiente e o carro é o sprite do personagem;
- B acelera;
- o prêmio sai de `rnd` sobre a tabela de 17 entradas (§3.14), sorteado no fim da corrida e mostrado com o ícone e o nome em PT-BR.

### 6.13 Opções (extra, não original)
- **Controles:** atribuir dispositivo a P1–P5 (teclado 1/2, gamepad 1–4) e remapear teclas e botões de cada dispositivo (A, B, X, Y, L, R, START, SELECT e direcional).
- **Spawns aleatórios:** Não/Sim (padrão **Não**, como o original). Usa o RNG separado (§3.2).
- **Volume:** música e efeitos.
- **ROM:** estado ("Carregada ✓" / "Não carregada"), "Carregar ROM…" e "Esquecer ROM".
- As configurações ficam no `localStorage`, como hoje.

### 6.14 Fallback das telas
- Sem ROM, cada tela mantém **o mesmo fluxo, as mesmas posições, tempos e textos**, com a arte por código atual: painéis, fonte e cursor.
- O cursor passa a ficar parado e o fundo, fixo.

---

## 7. Gráficos (plano 7: partida; plano 10: telas)

### 7.1 Camadas da partida [ARN §2.1, ANI §1.1]
**Faixas de linhas:**
| Linhas | BG1 | Resto |
|---|---|---|
| 0–23 (HUD) | tiles **8×8**; mapa do HUD; HOFS = 8, VOFS = −33 | – |
| 24–223 (campo) | 16×16 | BG1 e BG2 com HOFS = 8, VOFS = −25 (a arena 2 anima o HOFS do BG1); *color math* conforme a arena (§4) |

**BG2 = campo.** Casa (col, lin) → tela `x = 16·col − 8`, `y = 16·lin + 24`. Palavra de cada casa a partir do core:
| Grade | Palavra do BG2 |
|---|---|
| `EC40` | `bg2Base` |
| `CC80` | `bg2Base` (o soft de cada arena: `1C02`, `0802`…) |
| `0000` | `floor[cell]` do core, que por padrão vale `ArenaAssets.floor` e inclui as sombras sob pilar e parede, que nunca são recalculadas |
| `C900` | script da bomba pelo tipo (normal `0B00/02/04/06` = 20/12/16/16; remota `0B08…0E` = 16×4) a partir do tick da colocação, com o 1º quadro **2 ticks mais curto** (medido 18) |
| `1000` | peça + fase (ver abaixo) |
| `EDC0` soft | `0C20, 0C22, 0C24, 0C26, 0C28, 0C2A`, 4 ticks cada |
| `EDC0` item | `0F2E, 0F4E, 0F6E, 0F8E, 0FAE`, 4 ticks cada (20; depois, piso) |
| `09xx` | palavra do item (pal. 4): bomba `1280`, fogo `1282`, patins `12A2`, soco `12EC`, chute `12A4`, luva `12A6`, P `12A8`, caveira `128A`; os demais pela tabela (A13) |
| `EE80` | `082E` |
| `0001` | piso + sombra |
| especiais | pelas camadas das arenas |

**Peças da chama** (pal. 3): centro `0F6C`; braço horizontal `0F6A` (esquerda `4F6A`); ponta direita `0F66` (esquerda `4F66`); braço vertical `0F68` (para baixo `8F68`); ponta de cima `0F60` (baixo `8F60`).
- Fase A = +`$00`, B = +`$20`, C = +`$40`.
- Sequência por idade: **A2 B2 C2 B2 C2 B2 C2 B2 C2 B2 C2 B2 A1** = 25 ticks.
- A peça vem de `cellAux` (a última explosão a escrever vence).

**BG1:** o mapa da arena (decoração); prioridade 1 **acima dos jogadores** (moitas, placas).

**Animações de cenário:**
- tiles: script `rec+$12` ([ARN §3.1], um comando por tick, copiando 16×16 do buffer de tiles da arena);
- paleta: [ARN §3.2];
- itens piscando: cor 79.

### 7.2 Objetos (OBJ) [ANI §1.4, §5.2, §8]
- **Ordem:** maior `Y` na frente. Com `Y` igual, fica na frente quem foi processado antes (P1 antes de P5, jogadores antes dos objetos).
- **Jogadores:** OBJ prioridade 2; objetos 16×16 ou 32×32 pelo bit 12 do atributo da peça.
- **Bomba em movimento** (chutada, voando, na mão): anim `D8:D3A8`, peça 16×16 em (−8,−8), tile `$180`, paleta OBJ 7. A altura do voo vem do core.
  - Na mão (luva): em (X, Y−16), depois de subir −6, −4, −4, −2 nos 4 ticks do levantamento.
- **Pressão** (por passo com bloco, `t0` do core, casa em lin):
  - **sombra:** OBJ tile `$4E`, `attr $2E`, em (X−8, Y−8), desde t0 até o pouso + 2;
  - **bloco caindo:** OBJ `$4C`, do y = 0 a **8 px/tick**, terminando 8 px acima da casa no tick anterior ao pouso;
  - no pouso, `082E`; o sprite fica mais 2 ticks.
- **Efeitos de paleta e visibilidade** [ANI §4]:
  - caveira (exceto `$29`): quando `frame & 3 == 0`, a paleta alterna entre a normal e toda preta (`$C0:0B5E`, 16 × `0000`) conforme `frame & 4`;
  - invencível: **não desenha quando `inv & 2`**;
  - invisível `$29`: padrão `$C2:4F68`.

### 7.3 HUD [ARN §4]
- **Mapa:** `$D6:8EEC` (tabela `$D6:8F72`, +`$2200`), paleta BG 1 (`$D6:9192`), linhas 0–23.
- **Relógio:**
  - ícone em x 8–23;
  - minutos em x 24; ":" em x 32; segundos em x 40 e 48;
  - dígito *d*: topo `$2F + d` (d = 1..9) e `$39` para o 0; meio +`$10`; base +`$20`.
- **Rostos** P1..P5 em x 72, 104, 136, 168, 200, vindos dos blocos de cabeça do personagem (`$C4:6170`). Não mudam quando o jogador morre.
- **Coroas** em x 88, 120, 152, 184, 216 (linha do meio), pela tabela `$C4:5D11`: 0 → `4F`, 1 → `3B` … 5 → `3F`.

### 7.4 Jogadores e animação [ANI §2–§3]
**Folha, quadro e paleta:**
- Folha: `p24($C2:0730 + 3c)` (C1).
- Quadro *g*: `+ (g&3)·$80 + (g>>2)·$800`, 4 linhas de 128 B a cada `$200`.
- Paleta: `$C2:779D[c·32 + slot·4]`, paleta OBJ 0, 1, 4, 5, 6 para P1..P5.
- Posição na tela: `(X − 16, Y − 24)`.

**Modelo de reprodução:**
- O core dá `act`, `face` e `actT0`. O render escolhe a animação na tabela da ação: `p24(p24(tab1 + 3c) + 3·dirIdx)`, com os índices `[0]` ↑, `[1]` →, `[4]` ↓, `[5]` ← e +8 para parado.
- Amostra em `t = tick − actT0`: percorre os quadros pela duração; `dur = 255` congela; **todas fazem loop**.
- O core **reinicia `actT0` quando `act` ou `face` mudam**, como o `$C1:7657`.
- Os deslocamentos por quadro (`mx`, `my`) são só visuais.

| act | Animação (↑ / → / ↓ / ←) |
|---|---|
| `idle` | `D8:165A` / `1653` / `1645` / `164C` (g0/3/6/9). Depois de **383 ticks** parado, **tédio**: `$C2:6F71` [4 + char] |
| `walk` | `D8:16AC` / `1693` / `1661` / `167A` (12/8/12/8; o ritmo **não** depende da velocidade) |
| `dying` | `D8:1999` (g24:5 g25:5 g26:6 g27:6) e depois oculto |
| `victory` | `D8:2A74` (g45:12 g46:12) |
| `lift` | `D8:1DD2` / `1DB9` / `1D87` / `1DA0` |
| `carryIdle` | `D8:208C` / `2085` / `2077` / `207E` |
| `carryWalk` | `D8:20DE` / `20C5` / `2093` / `20AC` |
| `throw` | `D8:1F48` / `1F41` / `1F33` / `1F3A` |
| `punch` | `D8:205E` / `2045` / `2013` / `202C` |
| `pPunch` | `D8:2ADF` / `2AD8` / `2ACA` / `2AD1` |
| `detonate` | `D8:2AA7` (g47, 3 ticks) |
| `stunned` | `D8:19B2` (girando, 4 ticks por quadro) |
| `shocked` | `D8:2A9A` |
| `launched` / `pushed` / `dance` / montado | tabelas `$C2:6CE8` [0..3], `$C2:6F35`, `$C2:6FC5`, `$C2:7085…7139`, `$C2:7431` e `$C2:76F5`. A ligação exata ação → tabela é trabalho dos planos 8 e 9, conferido no emulador |

**Tela VICTORY:** vencedor `C3:E7F7` com a folha `$C2:8EBF`; os demais, `D8:2A81`.

### 7.5 Telas (plano 10)
- **Cada tela** = segmentos de VRAM + CGRAM do CAT (`cenas.<tela>.vram/cgram`) + mapas (A14) + objetos (cursor, etiquetas, coroas, retratos).
- **DRAW GAME:**
  - Modo 7: `mode7Draw()` (pixels `$CD:9800`, mapa `$D6:60D9`);
  - depois, BG2 de `$CD:B195`, `$CD:C11C`, `$CD:D11F`, `$CD:E122` (tabela `$C2:DC09`).
- **Placar e vitória:** `$C2:9C35` e OBJ `$C9:F997`, `$CA:F0B0`, `$CA:F8B3`, `$CD:E585`. As cabeças do placar são OBJ 32×32, tiles `$80`, `$84`, `$88`, `$C4`, `$C8` (`attr $30…$38`).

---

## 8. Som (plano 11) [AUD]

### 8.1 Arquitetura
Emulação **só do APU** (SPC700 + S-DSP). O lado da CPU é reimplementado em TS: é o `spchost.cpp` portado, cerca de 250 linhas.
- **Núcleo:** blargg `snes_spc` 0.9.0 compilado para **WASM**.
  - Fonte, script de build (emscripten) e aviso da LGPL-2.1 em `web/vendor/snes_spc/`.
  - O `.wasm` gerado é versionado em `web/public/audio/spc.wasm` e carregado como módulo separado e substituível.
  - Antes de publicar, conferir a licença do pacote inteiro (A16).
  - Alternativa sem emscripten: o SMP/DSP do *ares* (ISC).
- **AudioWorklet:** roda o núcleo e o host. O main thread envia um `ArrayBuffer` com as fatias `$C0:0190–$C0:07EA` e `$D9:0000–$DE:9C94`, e depois comandos `{boot | bank | music | sfx | voice | stop | fade}`.
- **Saída:** 32 kHz, reamostrada para a taxa do contexto.
- **Host:**
  - tabelas `$C0:0190` (50 blocos IPL), `$C0:0739` (música → bloco, set, comando), `$C0:0787` (SFX → comando `$32 + id`), `$C0:07B9` (voz → bloco, comando `$63 + id`);
  - sets `$DA:17D2` / `$DA:2118` / `$DA:2238`;
  - handshakes [AUD §1.4], **com 64 ciclos de SMP de folga** depois de cada handshake final;
  - **STOP antes de cada música e de cada bloco**.
- **`AudioSink` real** (§2.5):
  - **1 SFX por tick de jogo**, com fila circular de 64;
  - com o flag `$CA`, descarta tudo menos o `$13`;
  - voz em stream: ignorada se já houver outra;
  - orçamento de 1 pedaço de 64 B por frame + 4 a cada 4º frame (🟡, A16);
  - trocar o banco `$2F` (partida) / `$30` (menus e resultado) exatamente onde o jogo troca, senão as vozes ficam mudas.

### 8.2 Mapa de sons
- **Músicas:**

| ID | Onde |
|---|---|
| `$01` | título |
| `$12` | menus do Battle |
| `$13` | "BATALHA!" |
| `$14` | partida (as 10 arenas; banco `$2F` antes) |
| `$15` | placar |
| `$16` | vitória |
| `$18` | empate |

  Não há música de "hurry".
- **Sequências de transição:** §6.7 (fase → partida), §6.10 (vitória: `$17`, FADE +97, bloco `$30` +113, `$15` +154; próxima rodada: `$2F` + `$14` sem repetir o `$13`), §6.12 (`$16` e voz `$0A`) e §6.11 (STOP no 0:00, FADE +161, `$30` +218, `$18` +228, voz `$0E` +426).
- **SFX da partida:** tabela da §3.15. **SFX de menu:** §6.
- **Arenas:**
  - `$26`: aviso de troca da arena 2;
  - `$27`: freio do caça-níquel;
  - `$0A`: piso-caveira da arena 6.
- **Montarias:** `$0C` na linha de bombas; os demais pelos *call sites* que o plano 9 encontrar.
- **Sem ROM ou antes do gesto do usuário:** silêncio (`NoopSink`).

---

## 9. IA (plano 6: adaptação; planos 8 e 9: dicas)
A CPU original não foi estudada. A IA continua sendo a nossa (níveis Fraco/Normal/Forte), com `aiRoll` sem consumir o RNG do jogo. O que precisa mudar:
1. **Coordenadas e grade novas** (1/256 px, 17×13, códigos). Os tempos novos entram no mapa de perigo:
   - pavio 127, com o `fuseStep` da arena e das doenças `$27`/`$28`;
   - chama 25;
   - **cadeia +2 por elo**;
   - queima 24;
   - pavio congelado no voo e na mão;
   - bombas remotas de adversários: perigo permanente.
2. **Movimento:** a assistência de canto já alinha. A IA manda a direção da abertura. Contra pilar com \|d\| ≤ 3 (zona morta), manda a perpendicular antes.
3. **Ações:**
   - chute: acontece sozinho; a IA precisa prever o próprio chute;
   - soco com Y;
   - golpe P (empurrar adversários para chamas e pressão);
   - luva (segurar A, soltar mirando 2–5);
   - **X** para parar a bomba chutada no ponto útil.
4. **Não trapacear:** a IA **não lê `hidden`**. Teste: dois estados que diferem só em `hidden` produzem as mesmas entradas.
5. **Itens e doenças:**
   - evita caveiras;
   - doente, procura contato seguro com um adversário para passar a doença;
   - `$24`/`$25`/`$2A`/`$26` ajustam o planejamento: não conta com bombas; inverte a saída.
6. **Pressão:** usa o cronograma exato do core (próximo passo, 14 ticks, `36 + 2·lin`) para marcar as casas condenadas.
7. **Bad Bomber de CPU:** anda pela moldura até alinhar com um alvo a 2–5 casas e arremessa, respeitando a cadência.
8. **Dicas por arena** (plano 8, `AiStageHints`):
   - 3: rota das bolas quando uma chama vai atingi-las;
   - 6: evitar `1C0C`; prever o empurrão de `1C0A`;
   - 7: desvio das setas no chute;
   - 8: pisar no pad para frear;
   - 9: evitar ponta de gangorra com adversário na outra.
9. **Montarias** (plano 9, `AiMountHints`):
   - pega ovos;
   - C: usa a linha de bombas quando o adversário está alinhado a ≤ 4 casas e há rota de fuga;
   - D: alinhado a ≤ 5;
   - E: a ≤ 3;
   - F: a ≤ 3.
   Se a CPU original usa Y está em aberto (A8).
10. **Aceite:** partidas só de CPU nas 10 fases terminam sem travar. Em 50 rodadas por fase com sementes fixas, nenhuma rodada fica sem decisão até o TIME UP em mais de 30 % dos casos. Mais os testes atuais de sobrevivência, adaptados.

---

## 10. Testes

### 10.1 Infraestrutura
- `web/tests/rom/helpers.ts`: `export const ROM = process.env.SB4_ROM ? loadAndValidate(process.env.SB4_ROM) : null` e `describe.skipIf(!ROM)`. Sem a variável, os testes aparecem como *skipped*, não como falha.
- Para rodar tudo: `SB4_ROM="/caminho/Super Bomberman 4 (USA).sfc" npm test`.
- **Fixtures** em `web/tests/fixtures/rom/*.json`: só números, posições e hashes (SHA-1 de saídas decodificadas). Cada fixture registra o script de origem e o SHA-1 da ROM.
- Geração dos traços do emulador:
  - usar as ferramentas das frentes (`analise/investigacao/*`, com o core instrumentado do scratchpad);
  - se o emulador não estiver disponível, usar os modelos Python validados (`movesim.py`, `itemsim.py`, `arena_rom.py`, `decomp.py`), que batem com o emulador nos traços citados.

### 10.2 Goldens obrigatórios (traços verificados no emulador)
| Golden | Fonte | Precisa da ROM? |
|---|---|---|
| **Movimento: 20.034 ticks**, 0 divergências. Fases 1 e 5, níveis 0–7, diagonais, bombas espalhadas. Fixture `movement.json` com cenário, entradas por tick e (X, Y) de 24 bits por tick (alvo < 400 KB) | `t33.py st_arena01 5 60 6` e `st_arena05 6 60 12` [MEC §3.2] | não |
| Casos de canto da tabela da §3.5 (nível 1, para baixo) | `t100.py` | não |
| **Soft blocks das 10 fases**, semente `$0012` e 5 jogadores: casas exatas (= `analise/layouts_arenas.txt`), contagens 80/80/80/70/0/80/62/0/78/80 e semente depois da remoção | `t61.py`, `arena_rom.build_arena` [ARN §2.4] | não |
| **Itens escondidos das 10 fases:** pares (casa, item) e semente depois dos itens | `t61.py` | não |
| **RNG:** `$12` → `$C689` em 5 chamadas; sequência de 207 chamadas | `t52.py` | não |
| Pavio 127, chama 25, cadeia +2, morte 65 (linha do tempo 0/1–21/22–64/65) | `t24`, `t23`, `t99`, `t29` | não |
| Hitbox da chama: col 10 morre com X 152..167, não com 168; lin 1 morre com Y 44..55, não com 56 | `t25` | não |
| Alcance por fogo 0..10 | `t64` | não |
| Chute: 2 px/tick, paradas, item esmagado, X | `t36`, `t41`, `t91` | não |
| Soco: 17 ticks e trajetória; volta pela borda (col 13 → 2; lin 2 → 10); atordoamento de 63 | `t42`, `t43`, `t44`, `t49` | não |
| Luva: levantar em 4 ticks, 5 casas, mira 2/3/4 | `t48` | não |
| P: avanço de 16 px e empurrão de 48 px | `t45`, `t46` | não |
| Contágio e cura; `$2B` a cada 32 ticks | `t65`, `t66` | não |
| Pressão: +205, 14, 36 + 2·lin, 80 passos (143 com Morte Súbita), casa dura gasta o passo | `t72` | não |
| Rodada: intro 10 + 52; vitória +2; comemoração 128; TIME UP 160; empate | `t75`, `t86`, `t95`, `t97`, `t103` | não |
| Bad Bomber: moldura, 1 px/tick, cadência | `t79`–`t82` | não |
| **Fatos:** constantes de `core/tables` = ROM | `rom-facts` | sim |
| **ZTE:** 91 blocos distintos (SHA-1 da saída e tamanho comprimido) | `validate_decomp.py` (307/307) | sim |
| **BG das arenas:** 32 KB × 11 envios (com o 2º da arena 9); RLE do Modo 7 | `validate_extra.py` | sim |
| **Montagem das arenas** (BG1, BG2, piso, lógico, semente final) × `arena_rom.py` | `s08_verify_build.py` | sim |
| **Render só do BG** das arenas 1, 2, 4, 6 e 7 (com o quadro de animação e HOFS do instante): hash do `ImageData` = `render_rom.py` (0 px de diferença) | [ARN §6] | sim |
| **Animações:** hash das 141 decodificadas + literais (andar → g4:12 g3:8 g5:12 g3:8; morte g24:5 g25:5 g26:6 g27:6; `$C1:7D5F` = fórmula para g 0..127) | `dump_json.py` | sim |
| **Telas:** reconstrução de VRAM e CGRAM por cena (hash por segmento) | `recipe.py`, `loader_test.py` | sim |
| **Áudio:** RAM do APU depois de `init; blk 2F; mus 14` = bytes dos blocos na ROM (driver 10.075 + 220, `$2E` 5.366, `$2F` 4.515, seq. `$14` 4.064, DIR 144, samples 31.158) | [AUD §5] | sim |

### 10.3 Testes por plano
Os critérios de aceite de cada plano estão na §11. Regras gerais:
- `npm test` e `npm run build` verdes.
- Os 238 testes atuais continuam passando ou são **substituídos conscientemente** (o PR lista quais e por quê; os goldens de hash do core mudam com o core novo).
- `npm run snap` gera screenshots de todas as telas e arenas, nos dois modos quando houver ROM, para revisão visual.

---

## 11. Divisão em planos
**Ondas:**
- **Onda 1:** planos 5 e 6 em paralelo.
- **Onda 2:** planos 7, 8, 9, 10 e 11 em paralelo, **depois do merge de 5 e 6**. Cada plano da onda 2 pode usar tudo o que 5 e 6 produziram.

**Regras de convivência:**
- Cada plano só edita os caminhos que possui.
- Os arquivos de registro compartilhados (§2.5) só recebem linhas acrescentadas.
- Interfaces da §2.5 só mudam com acordo registrado no PR.

| Plano | Possui (caminhos em `web/`) | Depende de | Produz |
|---|---|---|---|
| **5 Carregador da ROM** | `src/rom/**`, `src/render/ppu/**`, `src/render/rom/battle.ts` (stub), `src/audio/sink.ts`, `scripts/rom-facts/gfx-*`, `tests/rom/{helpers,validate,decode,assets,ppu}*`, `tests/fixtures/rom/gfx-*.json`; 1 gancho em `src/main.ts` (painel da ROM) | – | validação, IndexedDB, `RomView`, decodificadores, `RomAssets`, `renderPpu`, painel de carga, `romState`, `AudioSink`/`NoopSink` |
| **6 Núcleo fiel** | `src/core/**` (menos o conteúdo de `stages/` e `mounts/`, que ele só cria vazios), `src/core/ai/**` (menos `ai/stages/` e `ai/mounts.ts`), `src/core/tables/**`, `scripts/rom-facts/core-*`, `src/render/battle-layers.ts`, `src/render/layers-index.ts`, **adaptação mínima** de `src/render/{draw-game,view,draw-screens,sprite-bank}.ts` e `src/render/art/**` (fallback jogável: itens novos, P, caveiras, novas ações), `src/game/session.ts` e `src/input/input.ts` (só o botão X), `tests/core/**`, `tests/fixtures/rom/{movement,rounds,…}.json` | – | tipos `RoundState`/`Player`/`GameEvent`/`BTN`, `createMatch`/`startRound`/`step`/`finishRound`, `StageModule`/`MountModule`, `AiStageHints`/`AiMountHints`, registros vazios, `romLayers`/`fallbackLayers` |
| **7 Gráficos originais (partida)** | `src/render/rom/**` (menos `stages/` e `mounts/`), `src/render/anim/**`, `tests/render-rom/**` | 5 (+6) | `drawRomBattle` real: BG1/BG2/HUD, bombas, chamas, queimas, itens, pressão, jogadores e animações, ordem de desenho, efeitos de paleta, *color math*, animações de cenário, `RomBattleBuilder` |
| **8 Arenas especiais** | `src/core/stages/**`, `src/core/ai/stages/**`, `src/render/rom/stages/**`, `src/render/fallback/stages/**`, `tests/stages/**` | 6 (+5) | `StageModule` 2–10 (§4), camadas ROM e fallback, dicas de IA |
| **9 Ovos e montarias** | `src/core/mounts/**`, `src/core/ai/mounts.ts`, `src/render/rom/mounts/**`, `src/render/fallback/mounts/**`, `tests/mounts/**` | 6 (+5) | `MountModule` (§5), visual do traje, camadas, dicas de IA |
| **10 Telas e usabilidade** | `src/screens/**`, `src/app/**`, `src/input/**`, `src/game/**`, `src/render/text/**`, `src/render/screens-rom/**`, `src/render/draw-screens.ts`, `src/screens/ui.ts`, `src/main.ts` (roteamento), `tests/client/**`, `tests/screens/**` | 5 (+6) | fluxo completo da §6 (fades, repetição, pausa, faixas, placar, empate, vitória, corrida bônus, times), fontes PT-BR, Opções, remapeamento de gamepad, pausa por desconexão, chamadas ao `AudioSink` nas telas |
| **11 Som original** | `src/audio/**` (menos `sink.ts`), `vendor/snes_spc/**`, `public/audio/**`, `tests/audio/**` | 5 | APU em WASM + host TS + AudioWorklet, `AudioSink` real, mapeamento eventos → SFX/voz (§3.15), troca de banco |

### Critérios de aceite por plano
- **5:**
  - aceita a ROM conhecida;
  - rejeita arquivo truncado, 1 byte alterado e cabeçalho errado (buffers sintéticos);
  - remove o cabeçalho de copiadora;
  - ida e volta no IndexedDB (com `fake-indexeddb` como devDependency);
  - goldens de ZTE, Modo 7, BG das arenas, paletas, montagem das arenas e animações (§10.2);
  - PPU: testes sintéticos (flips, 16×16, prioridades, bandas 8×8 e 16×16, `half`/`add`, ordem da OAM) e o golden de render só do BG (arenas 1, 2, 4, 6 e 7);
  - `renderPpu` de uma arena abaixo de 4 ms no Node.
- **6:**
  - todos os goldens sem ROM da §10.2;
  - testes unitários de cada regra da §3, com os números;
  - determinismo: 2 × 20.000 ticks só de CPU → mesmo hash;
  - IA: aceite da §9;
  - jogo jogável no fallback (`npm run snap`);
  - `facts.test.ts` verde com a ROM.
- **7:**
  - com ROM, a 1ª imagem de cada arena (sem sprites) bate com o golden do plano 5;
  - sequências por tick: palavras da bomba (18, 12, 16, 16, 20, 12, 16, …), fases da chama (A2…A1), queima (6 × 4), item atingido (5 × 4), pisca (4/4), sombra e queda da pressão;
  - quadro de cada `act` × direção = tabela da §7.4;
  - ordem de desenho por Y;
  - dígitos, rostos e coroas do HUD;
  - screenshots das 10 arenas.
- **8:** para cada arena, testes com os números da §4:
  - probabilidades e temporizador da 2; velocidade e pavio 127/64/253;
  - bolas: gatilho, 16 ticks por casa, 8 casas, virada, atordoamento de 66 + 64;
  - repintura e efeitos da 6;
  - setas da 7;
  - caça-níquel: liga, gira a cada 3, freio 384, prêmio pela tabela;
  - gangorra: 14 ticks, 8 px/tick, volta pela borda;
  - cerca da 5;
  - partidas de CPU sem travar em cada arena.
- **9:**
  - teto de 2;
  - tipo por `rnd(14)` na tabela;
  - 43 ticks para montar;
  - acerto: 1 + 51 + 32; reserva: 1 + 44;
  - cada habilidade: linha com 3 bombas em x = 80/96/112; míssil D a 5 casas; E deixa o alvo a 128/256 por 255 ticks; F atordoa por 192;
  - tipo 2 atravessa soft; tipo 3 perfura; tipo A chuta;
  - montaria zerada na rodada seguinte.
- **10:**
  - fluxo título → … → vitória → fase com entrada simulada;
  - tempos: fades de 15 e 28; repetição 20/5 e 36/21; rolagem 8 × 16; "BATALHA!" f65–277; placar 497/4; empate só A ou B; placar final sem pular e descida em f954;
  - regras de seleção de personagem: P1 escolhe as CPUs; B de qualquer um volta;
  - pausa por qualquer controle, sem escurecer;
  - desconexão pausa;
  - remapeamento persiste;
  - **todo texto PT-BR tem glifo em todos os estilos**, com e sem ROM;
  - screenshots.
- **11:**
  - golden da RAM do APU (§10.2);
  - fila de 1 SFX por tick (5 explosões no mesmo tick saem em 5 ticks);
  - STOP antes de música e bloco;
  - banco certo por tela;
  - voz ignorada com stream ativo;
  - PCM determinístico (hash do 1º segundo da `$14` a partir de `boot`);
  - verificação auditiva manual contra o jogo.

---

## 12. Pontos em aberto
Cada item traz o **comportamento provisório** e **como verificar** (ferramentas das frentes, no core instrumentado).

| # | Ponto | Provisório | Como verificar |
|---|---|---|---|
| A1 | **Team Battle:** tela "Escolha as equipes!" (layout e controles), condição de vitória por time, coroas por time, paletas `$C2:7B9D` | §3.12 e §6.6: rodada acaba com ≤1 time de pé; +1 coroa para cada membro; tela com retratos em 2 lados | Partida de times em savestate; watch em `$1F20+2n`, `$1F34+2n`, `$7F:204C..2050`; captura da tela |
| A2 | **Corrida bônus:** mecânica, gráficos (Modo 7 não catalogado), como sai o prêmio (`$1F50`), probabilidades, tabela `$C3:2FB0`, se vale em todas as rodadas | §6.12: corrida simples, B acelera, prêmio `rnd` uniforme nas 17 entradas; aplicado em todas as rodadas | `racer_victory.py` + watch de escrita em `$1F50`; trace de `$C2:08A6` em cada rodada; `scenes.py` na tela da corrida |
| A3 | Chamadas de RNG na carga (`$C2:02CD`) com 2–4 jogadores | 1 por jogador presente | Carregar arenas com 2, 3 e 4 jogadores a partir do boot e comparar `$AE` antes da remoção |
| A4 | Chamadas de RNG das fases entre remoção e itens (2: temporizador; 3: bolas?; 6: `$1EAA`; 8: rolos?) | Na ordem do `init` de cada fase; o golden de itens das fases sem objeto aleatório valida o resto | `t61.py` imprime `seedR`/`seedI` por fase; o `seedI` precisa sair do modelo |
| A5 | Doenças `$23`, `$24`, `$26`–`$2A` quadro a quadro; padrão `$C2:4F68` do invisível | Regras da §3.9 lidas no código | `rec.py` com `+$4D` forçado e entradas scriptadas |
| A6 | Chute: dispara sozinho se uma bomba para ao lado de um jogador parado virado para ela? Bomba chutada atravessando chama explode na hora? A parada depois de ~2 casas nas arenas 1 e 7 (ARN) | Regra da MEC §5.3; chutada que entra em casa com `1000` explode no tick seguinte | `t36`/`t41` com os cenários; repetir `b14_kick_down.py` com e sem jogadores |
| A7 | Ordem de absorção do acerto (montaria, traje, coração); o traje vale mesmo 1 vida; gráfico dos trajes | Montaria → traje → coração → morte; folha `$D4:0000` pela `$C2:76F5` | Forçar `+$45`/`+$47`/`+$5C` juntos e atingir; captura na fase 10 |
| A8 | Montarias: alcance da explosão do míssil D; recarga do E (`+$C6`); tipo do ovo reserva ao remontar; SFX de cada habilidade; se a CPU original usa Y | D = alcance 2 (fogo 0); E: 64 ticks de recarga; reserva mantém o próprio tipo; IA com as regras da §9 | `mount_vs.py`, `mount_follow*.py`; ganchos de SFX em `$C3:4A7F` |
| A9 | Bad Bomber: zonas proibidas de arremesso perto dos cantos (`$C2:5CC7`); momento exato da saída na pressão; comportamento em times | Não arremessa a menos de 16 px de um canto; sai no gatilho T | Trace de `$C2:5CC7` e de `$0096` |
| A10 | Arenas:<br>2: forma real do `rnd(256)` (`n & $FF = 0`).<br>3: `0F41` bloqueia movimento? (pelo `movesim` não); regra exata da perda de itens.<br>4: grama e terra (`$9C & $100`).<br>5: detalhe da cerca.<br>6: sorteio de `v`.<br>8: fórmula do símbolo, pad → rolo, destino dos itens, eventos `1526`/`17AD`, item `$11`.<br>9: destino ocupado por outro jogador | Os indicados em §4.1–4.8; `0F41` segue o `blocked()` da ROM; item `$11` = sem efeito | Disassembly de `$C3:0AAF`, `$C3:06EE`, `$C2:210A`, `$C2:5998`, `$C1:3DD9`, `$C3:11C7…`, `$C2:1C58`; os scripts `b*.py` |
| A11 | Pressão: grid visual em t0+37 (ANI) × pouso lógico 36 + 2·lin; gráfico das bordas externas com `EE80`; tick exato do SFX `$27` | Visual segue o lógico; bordas = `082E`; SFX no início do passo | `s16_pressure.py` com log por tick de `$7E:2000` e `$7E:2800` |
| A12 | Bomba remota: B detona todas ou a mais antiga? Explode pelo pavio? O braço da chama para na casa de outra bomba? | Remota: B detona **a mais antiga** e não há pavio; braço para na bomba | `t101.py` com 2–3 remotas; `t99.py` observando o braço |
| A13 | Tabela item → palavra de tile (fogo total, traje, `$11` etc.) | Palavras conhecidas + identificação visual na folha BG (tiles `$280..`) | Achar a tabela lida em `$C1:5997` (revelação) |
| A14 | **Telas:**<br>origem na ROM dos mapas de BG (título, menus, placar, vitória, empate);<br>metasprites do menu (mão, etiquetas nP, títulos em sprite);<br>animação do logo do título;<br>coordenadas dos glifos | Montar pela geometria medida (MNT §B), com os números de tile no nosso código | `scenes.py` com log de DMA para VRAM `$4000`/`$4400` e do "último escritor" de `$7E:5000`; testar o formato de mapa da ARN §2.3 |
| A15 | Placar com menos de 5 jogadores (linhas de slots Off); A na tela de jogadores com menos de 2 ativos | Só linhas dos slots ativos, na posição do slot; A toca `$03` e não avança | Savestates com 2 e 3 jogadores |
| A16 | Áudio:<br>regra exata do orçamento de stream (`$ED`, `$016A/$0166`);<br>SFX `$28`, `$1C`, contexto de `$0E`/`$12`;<br>áudio com Morte Súbita, Bad Bomber e Racer;<br>licença do `snes_spc` inteiro | 1 pedaço de 64 B por tick (+4 a cada 4º); `$0E` quique, `$12` atingido na cabeça; `$1C`/`$28` sem uso | `trace_match.py` com as regras ligadas; conferir o LICENSE do pacote |
| A17 | Tick exato do SFX `$17` (`$C2:0D6A`) em relação ao golpe; preto entre o fim da rodada e o EMPATE | 31 ticks depois do início da comemoração; 48 f de preto | Gancho em `$C2:0D6A` e `run_exp.py vitoria` |
| A18 | Relógio ∞ no HUD (30:01 parado ou símbolo próprio) | Mostrar os dígitos do valor (30:01) | Captura com Tempo ∞ |
| A19 | ROMs diferentes (SB4 japonesa sem patch, outras traduções) | Rejeitar com mensagem clara | Comparar ponteiros das tabelas usadas pelo `rom/` numa ROM japonesa limpa; possível suporte depois |
