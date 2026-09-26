# Crown Blast: Plano 8, Arenas especiais

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preencher os módulos das arenas 2 a 10 (spec §4) sobre o núcleo fiel do plano 6: mecânicas no `core/stages/`, dicas de IA no `core/ai/stages/`, camadas de desenho com a ROM (`render/rom/stages/`) e sem ela (`render/fallback/stages/`), com testes que usam os números medidos.

**Architecture:**
- Cada arena é um `StageModule` (`core/hooks.ts`, plano 6) em `core/stages/stageN.ts`, registrado em `STAGES[N]`. O estado da arena vive em `s.stageState` (tipos em `core/stages/state.ts`, criados na onda 1 para que render, IA e núcleo trabalhem em paralelo).
- Todo acesso dos módulos a **funções** do núcleo passa por `core/stages/kit.ts` (onda 1); tipos, `units` e constantes (estáveis desde o plano 6 T1) podem ser importados direto. Se um nome do plano 6 mudar, só o kit muda.
- As tabelas da ROM usadas pelas arenas viram constantes geradas em `core/stages/tables.ts` por `scripts/rom-facts/stages.ts` (onda 1), conferidas com a ROM por `tests/stages/rom-facts.test.ts`.
- As camadas se registram sozinhas (`registerRomLayer` / `registerFallbackLayer`) e desenham só quando `s.stage === N`. `render/layers-index.ts` recebe uma linha de import por arquivo de camada.
- Onda 1 = fundação pequena (contratos, esqueletos, tabelas). Onda 2 = uma tarefa por arena (a arena 8 em três), todas em arquivos disjuntos. Onda 3 = integração com partidas só de CPU.

**Tech Stack:** TypeScript 7 (`tsc --noEmit`), Vite 8, Vitest 5, Node 24 (gerador com *type stripping*).

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md`: §1, §2.5, §3 (núcleo em que as arenas se penduram), §4 inteira, §9 item 8, §10, §11 linha 8 e aceite, §12 A4/A10. Fontes: [ARN] `analise/investigacao/arenas-cenario/RELATORIO.md` §7 e os scripts `b01`–`b21`; [MEC] `analise/investigacao/mecanicas/RELATORIO.md` §5.2, §5.8, §6. Os fatos novos deste plano (marcados **[medido p/ plano 8]**) vieram do disassembly (`analise/ferramentas/dis65816.py`) e do emulador instrumentado (`analise/investigacao/mecanicas/py`, `…/arenas-cenario/harness.py`) e estão listados em "Decisões".

## Global Constraints

- Worktree `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity`, branch `feat/fidelity`, código em `web/`. **Este plano roda na onda 2 da spec, depois do merge dos planos 5 e 6.** Cada tarefa termina com `cd web && npx vitest run && npx tsc --noEmit` verdes.
- ROM local: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"` (SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`). Testes que precisam dela usam `describe.skipIf(!process.env.SB4_ROM)`. **Nunca versionar bytes da ROM, imagens extraídas ou áudio.** Só fatos numéricos.
- O núcleo (`core/**`) não importa nada de `render/`, `audio/`, `input/`, `rom/`. Nada de `Math.random`, `Date` ou DOM no núcleo. Estado da arena só com números, booleanos, strings, `null`, arrays e objetos simples (hash JSON).
- Unidades do plano 6: tick = 1/60 s sem lag; `cell = lin·17 + col`; posição do jogador em 1/256 px em coordenadas de tela, centro da casa `X = (16·col − 1)·256`, `Y = (16·(lin+2) − 1)·256`. ARN escreve (lin, col): **converter sempre**.
- **RNG dos objetos de arena:** a ROM usa `$C3:5489` = `rnd` com `Y = $FFFF`, isto é, `n & $FF = $FF`. No código: `rnd255(s) = rnd(s.rng, 0xff)`. Onde a ROM chama `$C3:54B3` direto com `Y = N`, usa-se `rnd(s.rng, N)`. A IA não consome o RNG.
- **Posse deste plano** (spec §11 + a decisão D14): `web/src/core/stages/**` (menos as linhas já existentes de `index.ts`), `web/src/core/ai/stages/**`, `web/src/render/rom/stages/**`, `web/src/render/fallback/stages/**`, `web/tests/stages/**`, `web/scripts/rom-facts/stages.ts`. Arquivos compartilhados em que **só se acrescentam linhas**: `web/src/core/stages/index.ts` e `web/src/render/layers-index.ts`.
- Mudanças fora da posse só na Task 1 e só se a verificação dela mandar (cada uma registrada no PR como acordo de interface, spec §11).
- Commits em PT-BR no estilo `feat(stages): ...`, um por tarefa, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Comentários de código em PT-BR.

---

## Ondas e tarefas

Tarefas da mesma onda mexem em arquivos **disjuntos** (cada uma diz "Possui") e dependem só das ondas anteriores; podem rodar em worktrees separadas e ser mescladas no fim da onda.

| Onda | Tarefas (paralelas) | Depende de |
|---|---|---|
| **1** | T1 Sincronia com os planos 5/6, kit e esqueletos · T2 Tabelas da ROM das arenas (gerador + fatos) | merge dos planos 5 e 6 |
| **2** | T3 Arena 2 · T4 Arena 3 · T5 Arena 4 · T6 Arena 5 · T7 Arena 6 · T8 Arena 7 · T9 Arena 8: máquina · T10 Arena 8: prêmios · T11 Arena 8: desenho · T12 Arena 9 · T13 Arena 10 | onda 1 |
| **3** | T14 Integração: partidas só de CPU nas 9 arenas, determinismo, screenshots | onda 2 |

T5 (arena 4) e T13 (arena 10) são curtas (≈20–30 min); o controlador pode dá-las a um mesmo implementador sem conflito de arquivos. Caminho crítico: T1 → T9 → T14.

## Mapa de arquivos

```
web/src/core/stages/
  index.ts          (plano 6) + 9 linhas `import { stageN } from './stageN'; STAGES[N] = stageN;`       (T1)
  kit.ts            ponte para o núcleo do plano 6 (único ponto de contato)                           (T1)
  state.ts          tipos do stageState de cada arena                                                 (T1)
  events.ts         ids dos eventos `{type:'stage'}` e SFX de cada um (para o plano 11)               (T1)
  tables.ts         GERADO: tabelas da ROM das arenas                                                 (T2)
  stage2.ts … stage10.ts   módulos (T1 cria vazios; cada tarefa da onda 2 preenche o seu)
  stage8-prizes.ts  execução dos prêmios do caça-níquel                                               (T1 esqueleto, T10)
web/src/core/ai/stages/stage{3,6,7,8,9}.ts   AiStageHints por arena                          (T1 esqueleto, onda 2)
web/src/render/rom/stages/romkit.ts          o que as camadas usam do RomAssets (plano 5)            (T1)
web/src/render/rom/stages/stage{2,3,7,8,9,10}.ts        camadas com a ROM                    (T1 esqueleto, onda 2)
web/src/render/fallback/stages/geom.ts       casa/ponto → tela do fallback (plano 6)                 (T1)
web/src/render/fallback/stages/stage{2,3,5,6,7,8,9}.ts  camadas sem a ROM                    (T1 esqueleto, onda 2)
web/src/render/layers-index.ts  (plano 6) + 13 linhas de import                                       (T1)
web/scripts/rom-facts/stages.ts              gerador de tables.ts                                     (T2)
web/tests/stages/kit.ts                      helpers de teste (arena, rodada real, fakes)             (T1)
web/tests/stages/{contracts,rom-facts,stage2..stage10,stage8-prizes,render-*,cpu}.test.ts
```

## Decisões deste plano sobre lacunas da spec

Os itens **[medido p/ plano 8]** foram conferidos no emulador ou lidos no código da ROM durante a escrita deste plano (comandos na coluna "Como"). 🟡 = provisório, como na §12 da spec.

| # | Lacuna | Decisão | Como |
|---|---|---|---|
| D1 | A4: RNG das arenas entre a remoção e os itens | **Só a arena 6** consome (1 chamada: `$1EAA = 64 + (rnd255 & 63)`). As arenas 2 e 8 sorteiam no **1º tick lógico do objeto** (tick 1 do intro): arena 2 = 1 chamada, arena 8 = 3. A arena 3 não sorteia na carga. Sementes com 5 jogadores e boot: fase 2 depois dos itens `$3BC1` → `$D6C3` no 1º tick; fase 6 `$5191` → init `$7033` → itens `$61B3`, `$1EAA = 111`; fase 8 `$C689` → `$C2F3`, rolos em `pos = 16, 24, 16`; fase 3 depois dos itens `$C9B1` | emulador: `t61.py` estendido às 10 fases + log de `$C3:54B3` por tick |
| D2 | A10-2: "`rnd(256)`" | É `$C3:5489` = `rnd(255)`. Temporizador `320 + rnd255` (320–574). Na troca: **primeiro** o novo temporizador, **depois** o modo = `A2_MODES[rnd255 & 31]`. Aviso SFX `$26` quando o contador (depois do decremento) vale 128. Trocas medidas: ticks lógicos 534 (modo 1), 900 (1), 1317 (0), 1660 (2) | `$C3:0AAF…0B48`; emulador (TDbg) |
| D3 | Objetos da arena no intro | A ROM roda os objetos nos 10 ticks lógicos do intro; o passo do plano 6 não chama `tick` no intro. Como nada mais consome RNG até o 1º tick de `play`, a arena faz o 1º sorteio na 1ª chamada e desconta os 10 ticks já passados (arena 2: `left = t − 10`). O resultado por tick de relógio é idêntico | `$C1:03E5` (`$1ED8 = 10`) |
| D4 | Ordem dos objetos | Na ROM os objetos de arena (criados na carga) rodam **antes** das bombas de cada tick; no nosso passo o `tick` da arena vem depois. Para ver as chamas no mesmo tick que a ROM, as arenas 3 e 8 só reagem a chama com `cellT0 < s.tick` | ordem da lista de objetos `$C0:F3DD` |
| D5 | Arena 2: pavio lento | Decrementa quando `(s.tick & 1) === 0` (`$016C` bit 0; `$016C` sobe 1 por tick lógico em `$C1:09CF`). Colocada em tick par → 253; em tick ímpar → 252 🟡 (paridade absoluta não medida). HOFS do BG1: soma em `(s.tick & 3) === 0` 🟡 | `$C1:3CC5`, `$C1:09CF` |
| D6 | Arena 3: efeito do toque | O toque liga `$C0 |= 2`, que leva à **mesma rotina de atordoamento da bomba na cabeça** (`$C2:4C54` → `$C2:0E29`: perde 1–4 itens por `$C2:51C4`, 64 ticks parado) e dá `inv = 64` se `inv` era 0. Os "66 ticks" e o "fogo −1 / bombas −1 e fogo −1" da ARN §7.2 eram uma amostra das perdas aleatórias. Usa-se `stunPlayer` do plano 6 + `inv = 64` | `$C3:0A57`, `$C2:59D6`, `$C2:4C54` |
| D7 | Arena 3: regras exatas | Bolas criadas na ordem (10,7), (6,5). Disparo: chama na casa da bola (via `onFlameCell`) e vizinha com chama na ordem baixo, esquerda, cima, direita → direção oposta (0 cima, 1 dir, 2 baixo, 3 esq). No disparo: a casa da bola volta a piso, `turnSet = rnd255 & 3`, 8 casas, `softArmed = false`. Avaliação do destino: `(g & $30) == $30`, `(g & $EFC0) == C900`, soft, `g & $C000` bloqueiam; soft só é destruído (queima 24) se `softArmed`, e aí `softArmed = false`. Falha: `dir += A3_TURN[turnSet][fails]`, `fails++`; 4 falhas → para. Destino livre: vira piso (esmaga item) e rola 16 ticks. Ao chegar: pressão → a bola some; `fails = 0`, `softArmed = true`; `--cellsLeft` | `$C3:06EE…0A56` |
| D8 | A10-5: arena 5 | O choque vem de **dois testes no movimento forçado** (golpe P): casa na borda do campo andando para a cerca (col 2 com `vx < 0`, col 14 com `vx > 0`, lin 1 com `vy < 0`, lin 11 com `vy > 0`, `$C2:319B`) ou ponto fora de `x ∈ [24, 232)`, `y ∈ [40, 216)` (`$C2:20DF`). **Andar contra a cerca não dá choque** (conferido no emulador). Choque = perdas 1–4 + 64 ticks + SFX `$18`, act `shocked` | `$C2:1005`; emulador (harness, P2 empurrado pelo P) |
| D9 | A10-6: arena 6 | Por explosão, **4 sorteios** antes de qualquer casa: `v = rnd255 & 15`, 0 → 1, para cima, direita, baixo, esquerda; o centro usa o `v` da esquerda e é processado depois dos braços. Casa com `grid & $2000` não é repintada. Contador: `--counter === 0` → `1C0C` e `counter = 64 + (rnd255 & 63)`; senão `(counter & 7) == 2` → `1C08` | `$C1:3DD9`, `$C1:550B`, `$C1:406F` |
| D10 | Arena 6: `1C08` | Além de parar a bomba chutada, **deixa o jogador lento (nível 7)** enquanto a casa dele mostra `1C08` (a spec dizia "o jogador não sofre nada"). Precedência da ROM (`$C2:2F3A`): montaria `$0B` > arena 6 `1C08` > arena 2 > efeito lento > doença > nível próprio | `$C2:2F5F`; emulador: 256 → 128 por tick |
| D11 | Arena 6: `1C0A` e `1C0C` | Testados **todo tick** em que o jogador está no chão sob controle (`onStand`). `1C0A`: se a casa na face não tem bit `$8000`, alinha o eixo perpendicular ao centro e empurra a 2 px/tick até o centro da casa seguinte (medido 72 → 95 em 12 ticks). `1C0C`: `effect = {$0A, $40}`, SFX `$0A` só se `effect.kind` era 0 | `$C2:1676`, `$C2:1D3F` |
| D12 | A10-8: arena 8 | Símbolo = `(pos >> 3) & 3`, `pos` = 0..30 de 2 em 2. Pad *i* → rolo *i* (pads (4,7), (8,7), (12,7)). Ao ligar: rolo do pad aceso `calls = 0`, os outros dois recebem `A8_PRESET[rnd255 & 3]`, todos `delay = 1`, pads `1C4E`. Um rolo por tick em rodízio (1, 2, 3). Freio: `calls = max(calls, 384)`, `delay = 3`, pad `1C6E`, SFX `$27`. Parada: alinhado e `delay ≥ 4`. SFX `$01` quando algum rolo alinhou (checado depois do rolo 3). Prêmio depois do rolo 3 com os 3 parados; SFX `$17` ao começar | `$C3:11C7…1A83`, `$C3:1B61` |
| D13 | A10-8: queda dos itens | Itens caem de `Y = 64` na coluna X de uma lista escolhida pelo **último rolo a parar** (rolo 1 → X 48/64/80/64, rolo 2 → 112/128/144/128, rolo 3 → 176/192/208/192), um por vez em rodízio; script de queda `A8_FALL_PICK[rnd255 & 15]` (desce 1–6 casas, aterrissa na lin 3–8). Lotes de 3 (1 no `14D6`) a cada 64 ticks, o 1º 48 ticks depois do prêmio; SFX `$12` por item. `1526`: 128 ticks depois do último lote cai uma **bomba de fogo 4** sem dono (X = lista[`rnd255 & 3`], script `A8_BOMB_FALL[rnd255 & 7]`). `1611`, `163A`, `16A2` e a chuva `17AD` também soltam **até 2 ovos** (`A8_EGGS[rnd(14)]`) se houver menos de 2 ovos/montarias em jogo 🟡. Jackpot: pressão total (143 passos) uma vez por rodada, começando já (bordas no tick seguinte, 1º passo 13 depois). Chuva: 16 ondas a cada 64 ticks; onda *k* = `rnd(3) + 3` itens iguais `A8_RAIN[k & 7]`. Item `$11` segue sem efeito; `$2D` = caveira `$2D` sem efeito 🟡 | `$C3:14D6…17FF`, `$C3:1852…19D0`, `$C1:6873`, `$C1:1CC3` |
| D14 | Posse extra | O gerador `web/scripts/rom-facts/stages.ts` é deste plano (arquivo novo, não disputado) | – |
| D15 | Arena 9 medida | Estados iniciais (`$C3:9524`): gangorras da esquerda 0, da direita 1. Ponta de cima: estado 0 → B (col 6/12), estado 1 → A (col 4/10). Vira quando alguém **entra andando na ponta de cima** ou **aterrissa (pulo ou quique) em qualquer ponta**; depois da virada são lançados os jogadores de pé na nova ponta de cima (o que aterrissou na ponta de baixo é relançado). Palavras: estado 0 `08EC 48E2 48E0`, estado 1 `08E0 08E2 08E4`, transição `08E6 08E8 08EA` por 2 ticks. Pulo (a partir do tick seguinte à virada): `dy = 0,0,0,−6,−10,−13,−15,−16,−16,−16,−15,−13,−10,−6`, pousa no 14º. Com ← ou → apertado no tick da virada: ±8 px/tick nos ticks 3..14 (96 px), volta pela borda quando `x < −24` (`+272`) ou `x > 278` (`−272`, 🟡 espelhado); se a casa de pouso não é livre (`grid & $8000`), quica casa a casa com o script do quique da bomba (dx `3,3,3,3,2,2,0,0`, altura `−4,−6,−6,−6,−4,0,0,0`) até achar casa livre | emulador (`b17`–`b19` estendidos, posição por tick) |
| D16 | Arenas 7 e 8: casas especiais e chama | O plano 6 não grava `FLAME` nas casas `0040`/`0C00` e chama `onFlameCell`. As arenas 7 e 8 gravam `FLAME` nelas (letal e visível, como na ROM) e, no `tick`, devolvem `ARROW`/`PAD` quando o núcleo as volta a `FLOOR` (a ROM faz isso nos ganchos de `$C1:534F`) | `$C1:532C…` |
| D17 | Eventos | `{type:'stage', id, slot?, cell?}` do plano 6. Ids e SFX em `core/stages/events.ts` (tabela abaixo) para o plano 11 | – |
| D18 | Desenho das arenas | Plano 7 desenha BG1/BG2 da arena (incluindo `floor[]` repintado da arena 6), *color math* e o script de tiles `rec+$12` (relógios/engrenagens da 2, plateia da 3, pilar da 5, soft da 6/7, `$04C` da 10). Plano 8 desenha: HOFS da 2, bolas da 3, setas da 7, pads/rolos/quedas da 8 (e cor 0 = `$0000`), gangorras e paleta 5 da 9, paleta 5 da 10 | spec §4, §7.1 |

Eventos de arena (`core/stages/events.ts`):

| id | Quando | SFX |
|---|---|---|
| `a2_warn` | 128 ticks antes da troca de modo | `$26` |
| `a2_mode0`/`a2_mode1`/`a2_mode2` | troca de modo (mesmo se repetir) | – |
| `a3_roll` | bola disparada (`cell`) | – 🟡 |
| `a3_hit` | bola atordoou (`slot`) | (o `stunned` do núcleo toca) |
| `a5_shock` | choque na cerca (`slot`) | `$18` |
| `a6_reverse` | pisou em `1C0C` sem efeito ativo (`slot`) | `$0A` |
| `a8_start` | máquina ligada (`cell` do pad) | – |
| `a8_click` | algum rolo alinhou (depois do rolo 3) | `$01` |
| `a8_brake` | freio (`cell` do pad) | `$27` |
| `a8_prize` / `a8_nothing` | prêmio começa / combinação sem prêmio | `$17` / – |
| `a8_drop` | item, ovo ou bomba começa a cair | `$12` |
| `a9_launch` | jogador lançado (`slot`) | – 🟡 |

---

## Onda 1

### Task 1: Sincronia com os planos 5 e 6, kit e esqueletos

**Possui:** `web/src/core/stages/{kit,state,events}.ts`, `web/src/core/stages/stage{2..10}.ts` e `stage8-prizes.ts` (esqueletos), as linhas acrescentadas em `web/src/core/stages/index.ts` e `web/src/render/layers-index.ts`, `web/src/core/ai/stages/stage{3,6,7,8,9}.ts` (esqueletos), `web/src/render/rom/stages/{romkit,stage2,stage3,stage7,stage8,stage9,stage10}.ts` (esqueletos), `web/src/render/fallback/stages/{geom,stage2,stage3,stage5,stage6,stage7,stage8,stage9}.ts` (esqueletos), `web/tests/stages/{kit.ts,contracts.test.ts}`.

**Files:**
- Create: os arquivos acima.
- Modify (só acrescentar linhas): `web/src/core/stages/index.ts`, `web/src/render/layers-index.ts`.

**Interfaces:**
- Consumes (plano 6, Task 1 já escrita): `core/types` (`CODE`, `BURN`, `FLAME_PIECE`, `BTN`, `Player`, `Bomb`, `Flyer`, `RoundState`, `GameEvent`), `core/units`, `core/rng` (`rnd`, `makeRng`), `core/state` (`setAct`, `standing`, `playerCell`, `itemCode`, `isEggCode`, `newId`), `core/constants`, `core/hit.stunPlayer`, `core/bombs.addBomb`, `core/flyers.launchBomb`, `core/hooks.StageModule`, `core/ai/hints.AiStageHints`, `core/stages.STAGES`, `render/battle-layers` (`registerRomLayer`, `registerFallbackLayer`, `RomBattleBuilder`, `BattleObj`), `tests/core/kit` (`arena`, `put`, `run`, `runUntil`, `setCell`, `codeAt`, `C`); plano 5: `rom/decode/zte` (nome confirmado no Step 1).
- Produces (usado por todas as tarefas seguintes):
  - `core/stages/kit.ts`: reexporta o que as arenas usam e define `rnd255`, `INTRO_LOGIC`, `stageEvent`, `armIndex`, `flameOver`, `burnSoft`, `restoreFloor`, `floorWord`, `onGround`, `stun`, `shock`, `landItem`, `landBomb`, `startJackpotPressure`, `eggsInPlay`, `wrapPx`.
  - `core/stages/state.ts`: `Stage2State`, `Orb`, `Stage3State`, `Stage6State`, `Reel`, `Fall`, `PrizeRun`, `Stage8State`, `Seesaw`, `Jump`, `Stage9State`.
  - `core/stages/events.ts`: `STAGE_SFX`.
  - `core/stages/stageN.ts`: `export const stageN: StageModule`. `stage8-prizes.ts`: `startPrize`, `tickPrize`, `tickFalls`.
  - `core/ai/stages/stageN.ts`: `export const stageNAi: AiStageHints`.
  - `render/rom/stages/romkit.ts`: `StageRomAssets`, `assetsOf`, `animFrameAt`, `writePaletteFrame`, `decodeZteAt`. `render/fallback/stages/geom.ts`: `cellLeft`, `cellTop`, `CELL_PX`, `scrX`, `scrY`.
  - `tests/stages/kit.ts`: `stageArena`, `fullRound`, `toPlay`, `stageEvents`, `fakeBuilder`, `fakeAssets`, `fakeCtx`, `mirror`.

- [ ] **Step 1: Verificar os contratos reais dos planos 5 e 6 (depois do merge)**

Ler o código mesclado e preencher a tabela abaixo no PR. Para cada "não", aplicar a adaptação indicada (e só ela).

| # | Verificar | Esperado | Se não |
|---|---|---|---|
| 1 | `core/step.ts`: `STAGES[s.stage]?.tick?.(s, ev)` só em `play`/`won`, depois de `tickObjects` | sim (plano 6 T1) | ajustar `INTRO_LOGIC` do kit para o nº de ticks lógicos do intro sem `tick` de arena |
| 2 | `core/movement.ts`: `onEnterCell` quando a casa muda e `onStand` todo tick, dentro de `movePlayer` | sim (plano 6 T4) | – |
| 3 | `core/bombs.ts` (T6): `onFlameCell(s, cell, armDir, ev)` é chamado para **toda** casa alcançada, inclusive o centro e as especiais; nas comuns depois de gravar `FLAME` (ou `BURNING` no soft). Anotar a codificação de `armDir` (centro e cada braço) e a ordem (centro antes ou depois dos braços) | centro = `-1`, braços = face 0/2/4/6; centro primeiro; braços cima, dir, baixo, esq | ajustar só `armIndex()` do kit. Se o núcleo só chamar para códigos especiais, pedir ao dono do plano 6 (acordo no PR) a chamada para todas as casas: é 1 linha no laço do braço |
| 4 | `core/bombs.ts`: `fuse −= fuseStep` com mínimo 0; `born` ignorado no tick de criação | decisão 9 do plano 6 | – |
| 5 | `core/kick.ts` (T7): `kickedBombEnter(s, b, cell)` antes de a bomba entrar em `cell`; `'stop'` para alinhada na casa atual; `{turn: face}` entra em `cell` e segue na face nova; `b.dir` usa faces 0/2/4/6 | sim | adaptar só `stage6.kickedBombEnter`/`stage7.kickedBombEnter` |
| 6 | `core/actions.ts` (T9): `applyPush` move por `p.push` e chama `outOfBounds(s, p, ev)` a cada tick de movimento forçado; jogador com `actLeft > 0` não recebe entrada nem `movePlayer` | sim | registrar no PR |
| 7 | `core/hit.ts` (T12): `stunPlayer(s, p, ev)` faz perdas + 63 ticks + `setAct(..., 'stunned', 63)` + evento `stunned` | sim | – |
| 8 | `core/flyers.ts` (T8): um `Flyer` `{kind:'item', flight:'bounce', dir:2}` recém-criado quica e pousa como item (decisão 16 do plano 6); `launchBomb(s, b, 'bounce', 2, {x, y, z: 0})` idem para bomba | sim | ajustar só `landItem`/`landBomb` do kit |
| 9 | `core/bombs.ts`: `addBomb(s, -1, cell, …)` e a explosão/remoção não indexam `players[-1]` | guarda `owner >= 0` | pedir ao dono do plano 6 a guarda de 1 linha (acordo no PR); até lá `landBomb` usa `owner = -1` e o teste de T10 que faz a bomba explodir fica `it.todo` |
| 10 | `core/pressure.ts` (T13): passo quando `tick === trigger + 192` (bordas), `trigger + 205 + 14k` (passos); `total` lido a cada passo | sim | ajustar só `startJackpotPressure` |
| 11 | Plano 5: função que decodifica um bloco ZTE a partir de um endereço (spec §2.3 `rom/decode/zte.ts`) e `RomAssets.anim(addr)`, `RomAssets.rom.u16` | `decodeZte(rom, addr): Uint8Array` | ajustar só `decodeZteAt` do `romkit` |
| 12 | Plano 6 T19: sistema de coordenadas do fallback | tela SNES 256×224: casa (col, lin) em `x = 16·col − 8`, `y = 16·lin + 24` | ajustar só `geom.ts` |
| 13 | `tests/core/kit.ts` exporta `arena`, `put`, `run`, `runUntil`, `setCell`, `codeAt`, `C` | sim (plano 6 T1) | – |
| 14 | `core/disease.ts` (T11): `speedLevel(s, p)` termina com `STAGES[s.stage]?.speedLevel?.(s, p, lv) ?? lv` (nível da arena vence doença e efeito, D10) | sim (contrato §2.5: "recebe o nível já com doença") | pedir ao dono do plano 6 a linha (acordo no PR) |

**Resultado da verificação (Task 1, base `53d5ed8` = planos 5 + 6 antes da correção final):**

| # | Real | Adaptação |
|---|---|---|
| 1 | sim: `step` volta cedo em `intro`/`timeUp`/`over`; `tick` da arena roda em `play`/`won` depois de `tickObjects`. Intro = 62 ticks, relógio nos 10 primeiros | `INTRO_LOGIC = 10` mantido |
| 2 | sim (`movePlayer`: `onEnterCell` se a casa mudou, `onStand` todo tick com casa ≥ 0) | – |
| 3 | **não**: o núcleo só chamava `onFlameCell` no centro com código especial e nos braços em código especial passável. Codificação e ordem conferem (centro `-1` primeiro, braços face 0/2/4/6 em cima, dir, baixo, esq) | **acordo no PR (núcleo, `bombs.ts`)**: centro sempre chama (depois do `setFlame` se houver); braços chamam também depois de `setFlame` (piso/chama) e depois de `burnCell` (soft e item, já `BURNING`). Bomba em cadeia não chama (a chama para antes). `tests/core/bombs.test.ts` ("código especial passável…") passa a esperar a lista de todas as casas. `armIndex` sem mudança. Travado em `tests/stages/contracts.test.ts` |
| 4 | sim (`fuse = max(0, fuse − fuseStep)`; `born === tick` pulado) | – |
| 5 | sim; `'stop'` estaciona na casa atual (a correção final do plano 6 põe `park` com recuo para a casa anterior se a atual estiver ocupada); `{turn}` grava `b.turn` e vira ao chegar | – |
| 6 | sim (`applyPush` → `outOfBounds` a cada tick de movimento; `tickAct` devolve true com `actLeft > 0` e pula entrada/`movePlayer`). Obs.: contra casa sólida o empurrão para alinhado e **não** chama `outOfBounds` nesse tick | registrado |
| 7 | sim (`stunPlayer`: solta a bomba da mão, zera `push.left`, `setAct('stunned', 63)`, perdas `((rnd255 & 6) >> 1) + 1`, evento `stunned`; nada se não está vivo ou está imune em `won`) | – |
| 8 | sim (`Flyer` item `bounce` dir 2 pousa como item em piso, some em `BURNING`, quica no resto; `launchBomb` idem). `Flyer.dir` é 0..3 (0 cima, 1 dir, 2 baixo, 3 esq) | – |
| 9 | sim: `refundBomb` faz `const p = s.players[b.owner]; if (p) …` (guarda equivalente); nenhum outro ponto indexa pelo dono | nenhuma; o teste de T10 da bomba pode ser `it` normal. Travado em `contracts.test.ts` |
| 10 | sim (bordas em `tick − trigger === 192`, passos em `205 + 14k`, `total` lido a cada passo) | – |
| 11 | **não**: `rom/decode/zte.ts` exporta `decodeZte(rom: Uint8Array, addr, limit = 0x10000): { data: Uint8Array; used: number }` (bytes do arquivo, não o `RomView`). `RomAssets.rom` é `RomView` (`u8/u16/u24/p24/s8/s16/bytes` e `data: Uint8Array`); `RomAssets.anim(addr): AnimFrame[]` com a mesma forma de `RomAnimFrame` | `decodeZteAt` passa `a.rom.data` e devolve `.data`; `StageRomAssets.rom` ganhou `readonly data?: Uint8Array` (opcional, os fakes não têm) |
| 12 | sim (`draw-game.ts`: `tileX = 16·col − 8`, `tileY = 16·lin + 24`; voadores em `px(x) − 7`) | – |
| 13 | sim (`arena({stage, players, rules, seed})`, `put`, `run`, `runUntil`, `setCell`, `codeAt`, `C`) | – |
| 14 | **não**: o gancho era aplicado antes do efeito lento (`effect.kind === 2` vencia a arena) | **acordo no PR (núcleo, `disease.ts`)**: `lv` = doença; `effect.kind === 2` → 7; por fim `STAGES[s.stage]?.speedLevel?.(s, p, lv) ?? lv`. Testes do plano 6 inalterados. Travado em `contracts.test.ts` |
| – | `tests/core/hooks.test.ts` esperava `STAGES[n]` vazios | **acordo**: a asserção vira `toBeDefined()` (os esqueletos ainda são `{}`, mas a onda 2 os preenche) |

- [ ] **Step 2: Escrever o teste dos contratos**

`web/tests/stages/contracts.test.ts`:

```ts
import { STAGES } from '../../src/core/stages';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/layers-index';
import { armIndex, rnd255, floorWord, wrapPx } from '../../src/core/stages/kit';
import { STAGE_SFX } from '../../src/core/stages/events';
import { stageArena, mirror } from './kit';
import { cellOf } from '../../src/core/units';

describe('contratos do plano 8', () => {
  it('STAGES[2..10] são os módulos do plano 8', () => {
    for (let n = 2; n <= 10; n++) expect(STAGES[n], `fase ${n}`).toBeDefined();
    expect(STAGES.length).toBe(11);
  });
  it('camadas registradas, uma por arquivo', () => {
    expect(romLayers.map(l => l.id).filter(id => id.startsWith('stage')).sort())
      .toEqual(['stage10', 'stage2', 'stage3', 'stage7', 'stage8', 'stage9']);
    expect(fallbackLayers.map(l => l.id).filter(id => id.startsWith('stage')).sort())
      .toEqual(['stage2', 'stage3', 'stage5', 'stage6', 'stage7', 'stage8', 'stage9']);
  });
  it('rnd255 é o $C3:5489 (n efetivo $FF)', () => {
    const s = stageArena(1);
    const m = mirror(s.rng.seed);
    expect(rnd255(s)).toBe(m.rnd(0xff));
    expect(s.rng.seed).toBe(m.seed());
  });
  it('armIndex: 0..3 = cima, direita, baixo, esquerda; 4 = centro', () => {
    expect([armIndex(0), armIndex(2), armIndex(4), armIndex(6), armIndex(-1)]).toEqual([0, 1, 2, 3, 4]);
  });
  it('floorWord: 0 em floor[] = palavra padrão pedida', () => {
    const s = stageArena(1);
    expect(floorWord(s, cellOf(5, 5), 0x1c06)).toBe(0x1c06);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    expect(floorWord(s, cellOf(5, 5), 0x1c06)).toBe(0x1c0a);
  });
  it('wrapPx: x < −24 soma 272; x > 278 subtrai 272', () => {
    expect([wrapPx(-25), wrapPx(-24), wrapPx(279), wrapPx(278)]).toEqual([247, -24, 7, 278]);
  });
  it('tabela de SFX dos eventos de arena', () => {
    expect(STAGE_SFX).toEqual({ a2_warn: 0x26, a5_shock: 0x18, a6_reverse: 0x0a, a8_click: 0x01, a8_brake: 0x27, a8_prize: 0x17, a8_drop: 0x12 });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/contracts.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Escrever `core/stages/kit.ts`**

```ts
// Ponte única entre os módulos de arena e o núcleo do plano 6. Se um nome do núcleo mudar, só este arquivo muda.
import { BURN, CODE, FLAME_PIECE, type Bomb, type GameEvent, type Player, type RoundState, type Flyer } from '../types';
import { rnd } from '../rng';
import { cellAt, cellOf, centerX, centerY, colOf, linOf, px } from '../units';
import { isEggCode, itemCode, newId, playerCell, setAct, standing } from '../state';
import { PRESSURE_BORDER_AT, PRESSURE_STEPS_SD, STUN_TICKS, FUSE } from '../constants';
import { stunPlayer } from '../hit';
import { addBomb } from '../bombs';
import { launchBomb } from '../flyers';

export { BURN, CODE, rnd, cellAt, cellOf, centerX, centerY, colOf, linOf, px, playerCell, setAct, standing, itemCode };
export type { Bomb, GameEvent, Player, RoundState };

/** rnd com Y = $FFFF ($C3:5489): n efetivo $FF. É o sorteio de todos os objetos de arena. */
export const rnd255 = (s: RoundState): number => rnd(s.rng, 0xff);

/** Ticks lógicos do intro em que a ROM já roda os objetos de arena e o nosso passo não chama `tick` (D3). */
export const INTRO_LOGIC = 10;

export function stageEvent(ev: GameEvent[], id: string, extra: { slot?: number; cell?: number } = {}): void {
  ev.push({ type: 'stage', id, ...extra });
}

/** armDir do núcleo → 0 cima, 1 direita, 2 baixo, 3 esquerda, 4 centro (conferido na Task 1, item 3). */
export function armIndex(armDir: number): 0 | 1 | 2 | 3 | 4 {
  if (armDir < 0) return 4;
  return ((armDir >> 1) & 3) as 0 | 1 | 2 | 3;
}

/** Grava chama numa casa especial (arenas 7 e 8, D16): letal e visível; o núcleo a apaga aos 25 ticks. */
export function flameOver(s: RoundState, cell: number, armDir: number): void {
  const k = armIndex(armDir);
  s.grid[cell] = CODE.FLAME;
  s.cellT0[cell] = s.tick;
  s.cellAux[cell] = [FLAME_PIECE.ARM_UP, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_DOWN, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.CENTER][k];
}

/** Soft → queimando 24 ticks (o núcleo revela o item escondido no fim), como $C1:4288. */
export function burnSoft(s: RoundState, cell: number): void {
  s.grid[cell] = CODE.BURNING;
  s.cellT0[cell] = s.tick;
  s.cellAux[cell] = BURN.SOFT;
}

/** Volta a casa ao piso lógico ($C1:532C sem os ganchos): apaga item, chama ou código especial. */
export function restoreFloor(s: RoundState, cell: number): void {
  s.grid[cell] = CODE.FLOOR;
  s.cellAux[cell] = 0;
}

/** Palavra de piso da casa: floor[cell] ou, se 0, a palavra padrão da arena. */
export const floorWord = (s: RoundState, cell: number, dflt: number): number => s.floor[cell] || dflt;

/** De pé e sob controle (sem ação travada nem empurrão). */
export const onGround = (p: Player): boolean => standing(p) && p.actLeft === 0 && p.push.left === 0;

/** Atordoamento do núcleo (perdas 1–4 + 63 ticks). */
export function stun(s: RoundState, p: Player, ev: GameEvent[]): void { stunPlayer(s, p, ev); }

/** Choque da cerca (arena 5): atordoamento com act `shocked` e SFX $18. */
export function shock(s: RoundState, p: Player, ev: GameEvent[]): void {
  p.push = { vx: 0, vy: 0, left: 0 };
  stunPlayer(s, p, ev);
  setAct(s, p, 'shocked', p.actLeft > 0 ? p.actLeft : STUN_TICKS);
  stageEvent(ev, 'a5_shock', { slot: p.slot });
}

/** Item (ou ovo) que termina de cair na casa: piso → item; queimando/pressão → some; resto → quica (voador do núcleo). */
export function landItem(s: RoundState, item: number, cell: number): void {
  const g = cell >= 0 ? s.grid[cell] : CODE.HARD;
  if (g === CODE.FLOOR) { s.grid[cell] = itemCode(item); s.cellT0[cell] = s.tick; return; }
  if (g === CODE.BURNING || g === CODE.PRESSURE || g === CODE.FALLING || cell < 0) return;
  const f: Flyer = { id: newId(s), kind: 'item', ref: item, x: centerX(colOf(cell)), y: centerY(linOf(cell)), z: 0,
    dir: 2, flight: 'bounce', script: 0, i: 0, born: s.tick };
  s.flyers.push(f);
}

/** Bomba (fogo 4, sem dono) que termina de cair: jogador de pé → atordoa e quica; piso → bomba parada; resto → quica. */
export function landBomb(s: RoundState, cell: number, ev: GameEvent[]): void {
  if (cell < 0) return;
  const hit = s.players.filter(p => standing(p) && playerCell(p) === cell);
  for (const p of hit) stunPlayer(s, p, ev);
  const g = s.grid[cell];
  if (g === CODE.BURNING || g === CODE.PRESSURE) return;
  if (g === CODE.FLOOR && hit.length === 0) { addBomb(s, -1, cell, { fire: 4, fuse: FUSE }); return; }
  const b: Bomb = addBomb(s, -1, cell, { fire: 4, fuse: FUSE, state: 'air' });
  launchBomb(s, b, 'bounce', 2, { x: centerX(colOf(cell)), y: centerY(linOf(cell)), z: 0 });
}

/** Jackpot do caça-níquel ($C1:7027): pressão total começando já, sem aviso. */
export function startJackpotPressure(s: RoundState): void {
  // Bordas no tick seguinte e 1º passo 13 depois; antes do tick 191 o gatilho não pode ser negativo (🟡, atrasa as bordas).
  if (s.pressure.trigger < 0) s.pressure.trigger = Math.max(0, s.tick - (PRESSURE_BORDER_AT - 1));
  s.pressure.total = PRESSURE_STEPS_SD;
}

/** Ovos no chão + ovos voando + montarias (substituto do $1ED4 da ROM, 🟡). */
export function eggsInPlay(s: RoundState, extra = 0): number {
  let n = extra;
  for (const v of s.grid) if (isEggCode(v)) n++;
  for (const f of s.flyers) if (f.kind === 'item' && f.ref >= 0x30 && f.ref <= 0x3f) n++;
  for (const p of s.players) if (p.mount !== null) n++;
  return n;
}

/** Volta pela borda do voo da gangorra, em px (D15). */
export const wrapPx = (x: number): number => (x < -24 ? x + 272 : x > 278 ? x - 272 : x);

```

- [ ] **Step 5: Escrever `core/stages/state.ts` e `core/stages/events.ts`**

`state.ts`:

```ts
/** Arena 2: modo global. */
export interface Stage2State { mode: 0 | 1 | 2; left: number; started: boolean; hofs: number }

/** Arena 3: bola (x, y em px de tela, centro da casa = (16·col − 1, 16·(lin+2) − 1)). */
export interface Orb {
  x: number; y: number; cell: number;
  rolling: boolean; dir: 0 | 1 | 2 | 3;      // 0 cima, 1 direita, 2 baixo, 3 esquerda
  stepLeft: number;                          // ticks até a próxima casa (16..1)
  cellsLeft: number; fails: number; turnSet: number;
  softArmed: boolean; alive: boolean;
  flamedAt: number;                          // tick em que a chama pegou a bola parada (-1)
}
export interface Stage3State { orbs: Orb[] }

/** Arena 6. */
export interface Stage6State {
  counter: number;          // $1EAA
  v: number[];              // v da explosão atual por braço (0 = sem explosão)
  center: number;           // casa do centro a repintar depois dos braços (-1)
  snap: number[];           // por slot: coordenada-alvo do empurrão em 1/256 px (-1)
  snapAxis: number[];       // por slot: 0 = x, 1 = y
}

/** Arena 8. */
export interface Reel { pos: number; calls: number; delay: number; delayCnt: number; braking: boolean }
export interface Fall { kind: 'item' | 'bomb'; id: number; x: number; y: number; script: number; i: number; born: number }
export interface PrizeRun {
  routine: number; queue: number[]; next: number; batch: number; wait: number; colIdx: number;
  after: 'idle' | 'bomb'; bombPhase: 0 | 1 | 2; rain: { wave: number; itemIdx: number } | null;
}
export interface Stage8State {
  started: boolean; phase: 'idle' | 'spin' | 'prize';
  reels: Reel[]; turn: number; stopped: number; lastStopped: number; click: boolean;
  jackpotUsed: boolean; prize: PrizeRun | null; falls: Fall[];
  lastRoutine: number;      // rotina do último resultado (0x14F7 = nada), para testes e IA
}

/** Arena 9. */
export interface Seesaw { a: number; b: number; state: 0 | 1; transUntil: number }
export interface Jump { slot: number; t: number; dx: -1 | 0 | 1; baseY: number; born: number; hop: number /* -1 = pulo */ }
export interface Stage9State { saws: Seesaw[]; jumps: Jump[] }
```

`events.ts`:

```ts
/** SFX de cada evento `{type:'stage'}` (D17). Eventos ausentes daqui não tocam som. */
export const STAGE_SFX: Record<string, number> = {
  a2_warn: 0x26, a5_shock: 0x18, a6_reverse: 0x0a, a8_click: 0x01, a8_brake: 0x27, a8_prize: 0x17, a8_drop: 0x12,
};
```

- [ ] **Step 6: Escrever os esqueletos e registrar**

Para N em 2..10 (menos 8, abaixo), `web/src/core/stages/stageN.ts`:

```ts
import type { StageModule } from '../hooks';
/** Arena N (spec §4.x). Preenchido pela tarefa da arena. */
export const stageN: StageModule = {};
```

A arena 8 é dividida entre T9, T10 e T11, que rodam em paralelo; por isso o esqueleto de `web/src/core/stages/stage8.ts` já traz os nomes compartilhados (a T9 mantém este trecho sem mudança):

```ts
import type { StageModule } from '../hooks';
import type { RoundState } from '../types';
import { cellOf } from '../units';
import type { Reel, Stage8State } from './state';

/** Pads (4,7), (8,7), (12,7) = A8_PADS (conferido com a ROM no teste da T9). */
export const PADS = [cellOf(4, 7), cellOf(8, 7), cellOf(12, 7)];
export const REEL_MASK = [4, 2, 1];
export const PAD_IDLE = 0x1c6e;
export const PAD_LIT = 0x1c4e;
export const sym = (r: Reel): number => (r.pos >> 3) & 3;
export function newStage8(): Stage8State {
  const reel = (): Reel => ({ pos: 0, calls: 0, delay: 1, delayCnt: 0, braking: false });
  return { started: false, phase: 'idle', reels: [reel(), reel(), reel()], turn: 0, stopped: 0, lastStopped: 0,
    click: false, jackpotUsed: false, prize: null, falls: [], lastRoutine: 0 };
}
export const st8 = (s: RoundState): Stage8State => (s.stageState ??= newStage8()) as Stage8State;
export const stage8: StageModule = {};
```

`web/src/core/stages/stage8-prizes.ts`:

```ts
import type { GameEvent, RoundState } from '../types';
import type { Stage8State } from './state';
export function startPrize(_s: RoundState, _a: Stage8State, _routine: number, _ev: GameEvent[]): void {}
/** true = o prêmio terminou (a máquina volta a parada no tick seguinte). */
export function tickPrize(_s: RoundState, _a: Stage8State, _ev: GameEvent[]): boolean { return true; }
export function tickFalls(_s: RoundState, _a: Stage8State, _ev: GameEvent[]): void {}
```

Para N em {3, 6, 7, 8, 9}, `web/src/core/ai/stages/stageN.ts`:

```ts
import type { AiStageHints } from '../hints';
export const stageNAi: AiStageHints = {};
```

Para N em {2, 3, 7, 8, 9, 10}, `web/src/render/rom/stages/stageN.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
registerRomLayer({ id: 'stageN', draw(s) { if (s.stage !== N) return; } });
```

Para N em {2, 3, 5, 6, 7, 8, 9}, `web/src/render/fallback/stages/stageN.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stageN', draw(s) { if (s.stage !== N) return; } });
```

(`N` é o número literal em cada arquivo.) Acrescentar no **fim** de `web/src/core/stages/index.ts`:

```ts
import { stage2 } from './stage2'; STAGES[2] = stage2;
import { stage3 } from './stage3'; STAGES[3] = stage3;
import { stage4 } from './stage4'; STAGES[4] = stage4;
import { stage5 } from './stage5'; STAGES[5] = stage5;
import { stage6 } from './stage6'; STAGES[6] = stage6;
import { stage7 } from './stage7'; STAGES[7] = stage7;
import { stage8 } from './stage8'; STAGES[8] = stage8;
import { stage9 } from './stage9'; STAGES[9] = stage9;
import { stage10 } from './stage10'; STAGES[10] = stage10;
```

Acrescentar no fim de `web/src/render/layers-index.ts`:

```ts
import './rom/stages/stage2'; import './rom/stages/stage3'; import './rom/stages/stage7';
import './rom/stages/stage8'; import './rom/stages/stage9'; import './rom/stages/stage10';
import './fallback/stages/stage2'; import './fallback/stages/stage3'; import './fallback/stages/stage5';
import './fallback/stages/stage6'; import './fallback/stages/stage7'; import './fallback/stages/stage8';
import './fallback/stages/stage9';
```

Atenção: `tests/core/hooks.test.ts` do plano 6 espera `STAGES[n]` vazios. Esse teste passa a falhar por construção; trocar a asserção dele por `expect(STAGES.length).toBe(11)` é mudança de 1 linha no arquivo do plano 6, registrada no PR (acordo). Se o arquivo não importar `layers-index`, o teste de camadas dele continua valendo.

- [ ] **Step 7: Escrever `romkit.ts` e `geom.ts`**

`web/src/render/rom/stages/romkit.ts`:

```ts
import type { RomBattleBuilder } from '../../battle-layers';
import { decodeZte } from '../../../rom/decode/zte';   // nome conferido na Task 1, item 11

export interface RomPiece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
export interface RomAnimFrame { dur: number; mx: number; my: number; pieces: RomPiece[] }
/** O que as camadas de arena usam do RomAssets do plano 5 (§2.3), por tipagem estrutural. */
export interface StageRomAssets {
  rom: { u8(a: number): number; u16(a: number): number };
  anim(addr: number): RomAnimFrame[];
}
export const assetsOf = (a: object): StageRomAssets => a as StageRomAssets;

/** Quadro de uma animação em loop, `t` ticks depois do início. */
export function animFrameAt(anim: RomAnimFrame[], t: number): RomAnimFrame {
  const total = anim.reduce((n, f) => n + Math.max(1, f.dur), 0);
  let r = ((t % total) + total) % total;
  for (const f of anim) { const d = Math.max(1, f.dur); if (r < d) return f; r -= d; }
  return anim[0];
}

/** Paleta animada: quadro `k = ⌊tick/ticks⌋ mod frames`, 16 cores a partir de `base + 32k`, escritas em cgBase..cgBase+15. */
export function writePaletteFrame(b: RomBattleBuilder, a: StageRomAssets, base: number, frames: number, ticks: number, tick: number, cgBase: number): number {
  const k = Math.floor(tick / ticks) % frames;
  for (let i = 0; i < 16; i++) b.cgram(cgBase + i, a.rom.u16(base + 32 * k + 2 * i));
  return k;
}

/** Bloco ZTE decodificado a partir do endereço SNES (plano 5). */
export function decodeZteAt(a: StageRomAssets, addr: number): Uint8Array {
  return decodeZte(a.rom as never, addr);
}
```

`web/src/render/fallback/stages/geom.ts`:

```ts
// Casa e ponto → tela do fallback (conferido com o plano 6 T19 na Task 1, item 12).
export const CELL_PX = 16;
export const cellLeft = (col: number): number => 16 * col - 8;
export const cellTop = (lin: number): number => 16 * lin + 24;
/** Ponto em px de tela do núcleo (centro da casa = 16·col − 1) → canto do pixel no canvas. */
export const scrX = (xpx: number): number => xpx + 1;
export const scrY = (ypx: number): number => ypx + 1;
```

- [ ] **Step 8: Escrever `tests/stages/kit.ts`**

```ts
import { defaultRules, type GameEvent, type RoundState } from '../../src/core/types';
import { STAGES } from '../../src/core/stages';
import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import type { BattleObj, RomBattleBuilder } from '../../src/render/battle-layers';
import type { StageRomAssets, RomAnimFrame } from '../../src/render/rom/stages/romkit';
import { arena } from '../core/kit';
export { arena, put, run, runUntil, setCell, codeAt, C } from '../core/kit';

/** Arena vazia do plano 6 (paredes + pilares em col ímpar × lin par) em `play` no tick 100, com o init da arena. */
export function stageArena(stage: number, players = 2, seed = 0x12): RoundState {
  const s = arena({ stage, players, seed });
  STAGES[stage].init?.(s);
  return s;
}

/** Rodada real (remoção, init da arena, itens) com 5 jogadores e semente `seed`, em `intro`. */
export function fullRound(stage: number, seed = 0x12): RoundState {
  return startRound(createMatch(defaultRules(), stage, seed));
}

/** Roda o intro inteiro (62 ticks) e o 1º tick de play. Devolve os eventos desse 1º tick. */
export function toPlay(s: RoundState): GameEvent[] {
  let ev: GameEvent[] = [];
  while (s.phase === 'intro') ev = step(s, [0, 0, 0, 0, 0]);
  return step(s, [0, 0, 0, 0, 0]);
}

export type StageEvent = Extract<GameEvent, { type: 'stage' }>;
export const stageEvents = (ev: GameEvent[], id?: string): StageEvent[] =>
  ev.filter((e): e is StageEvent => e.type === 'stage' && (id === undefined || e.id === id));

/** Espelho do LCG para calcular valores esperados sem tocar no estado. */
export function mirror(seed: number) {
  let sd = seed & 0xffff;
  return {
    rnd(n: number): number { sd = ((sd | 1) * 0x383) & 0xffff; return (sd * (n & 0xff)) >>> 16; },
    seed: () => sd,
  };
}

/** Builder falso do plano 7: grava as chamadas. */
export function fakeBuilder() {
  const calls = {
    bg2: new Map<string, number>(), bg1: new Map<string, number>(),
    sprites: [] as { e: BattleObj; sortY: number; order: number }[],
    cgram: new Map<number, number>(), scroll: [] as number[],
  };
  const b: RomBattleBuilder = {
    setBg2: (c, l, w) => { calls.bg2.set(`${c},${l}`, w); },
    setBg1: (c, l, w) => { calls.bg1.set(`${c},${l}`, w); },
    sprite: (e, sortY, order) => { calls.sprites.push({ e, sortY, order }); },
    cgram: (i, v) => { calls.cgram.set(i, v); },
    bg1Scroll: h => { calls.scroll.push(h); },
  };
  return { b, calls };
}

/** RomAssets falso: u16(a) = a & 0x7fff; anim(a) = 2 quadros de 1 peça (tile = a & 0xff, depois +1). */
export function fakeAssets(): StageRomAssets {
  return {
    rom: { u8: a => a & 0xff, u16: a => a & 0x7fff },
    anim: (a: number): RomAnimFrame[] => [
      { dur: 4, mx: 0, my: 0, pieces: [{ dx: -8, dy: -8, tile: a & 0xff, hflip: false, vflip: false, big: false, palAdd: 0 }] },
      { dur: 4, mx: 0, my: 0, pieces: [{ dx: -8, dy: -8, tile: (a & 0xff) + 1, hflip: false, vflip: false, big: false, palAdd: 0 }] },
    ],
  };
}

/** Contexto 2D falso: grava o nome de cada método chamado. */
export function fakeCtx(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(t, k) { if (typeof k === 'string' && k in t) return t[k]; return (..._a: unknown[]) => { log.push(String(k)); }; },
    set(t, k, v) { t[String(k)] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}
```

- [ ] **Step 9: Rodar os testes**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: `contracts.test.ts` PASS; o resto verde (com o ajuste de 1 linha do Step 6 em `tests/core/hooks.test.ts`, se preciso).

- [ ] **Step 10: Commit**

```bash
git add web/src/core/stages web/src/core/ai/stages web/src/render/rom/stages web/src/render/fallback/stages \
  web/src/render/layers-index.ts web/tests/stages
git commit -m "$(cat <<'MSG'
feat(stages): fundação do plano 8 — kit do núcleo, estados, eventos e esqueletos das arenas 2–10

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Tabelas da ROM das arenas (gerador + fatos)

**Possui:** `web/scripts/rom-facts/stages.ts`, `web/src/core/stages/tables.ts`, `web/tests/stages/rom-facts.test.ts`.

**Files:**
- Create: os três arquivos acima.

**Interfaces:**
- Consumes: nada do `src/` (o gerador lê a ROM sozinho, como os extratores do plano 6).
- Produces (`core/stages/tables.ts`): `A2_MODES`, `A3_ORBS`, `A3_TURN`, `A6_REPAINT`, `A7_ARROWS`, `A8_PADS`, `A8_PRIZE`, `A8_L149F`, `A8_L14A9`, `A8_L14B6`, `A8_L14BE`, `A8_L14C1`, `A8_L14C5`, `A8_L14CE`, `A8_RAIN`, `A8_PRESET`, `A8_REEL_ROWS`, `A8_COLS_ALL`, `A8_COLS`, `A8_FALL_PICK`, `A8_FALL_DY`, `A8_BOMB_FALL`, `A8_EGGS`, `A9_SAWS`, `A9_PAL`, `A10_PAL`. Gerador: `extractStageTables(rom: Uint8Array): StageTables`, `renderTables(t): string`.

- [ ] **Step 1: Escrever o teste de fatos**

`web/tests/stages/rom-facts.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { extractStageTables } from '../../scripts/rom-facts/stages';
import * as T from '../../src/core/stages/tables';

const ROM_PATH = process.env.SB4_ROM;

describe('tabelas das arenas: formas conhecidas (sem ROM)', () => {
  it('arena 2: 16 normal, 13 rápido, 3 lento', () => {
    expect([0, 1, 2].map(m => T.A2_MODES.filter(x => x === m).length)).toEqual([16, 13, 3]);
  });
  it('arena 8: contagens de prêmio (18/12/12/6/4/4/4/1/1/1/1) e cantos da tabela', () => {
    const count = (r: number) => T.A8_PRIZE.filter(x => x === r).length;
    expect([0x14f7, 0x14f9, 0x1611, 0x1526, 0x1662, 0x14d6, 0x163a, 0x15bf, 0x16a2, 0x1682, 0x17ad].map(count))
      .toEqual([18, 12, 12, 6, 4, 4, 4, 1, 1, 1, 1]);
    expect([T.A8_PRIZE[0], T.A8_PRIZE[21], T.A8_PRIZE[42], T.A8_PRIZE[63]]).toEqual([0x15bf, 0x16a2, 0x17ad, 0x1682]);
  });
  it('arena 8: scripts de queda somam 16·n px (n = 1..6)', () => {
    const tot = T.A8_FALL_PICK.map(a => T.A8_FALL_DY[a].reduce((x, y) => x + y, 0));
    expect(tot).toEqual([16, 48, 96, 16, 48, 64, 16, 80, 48, 16, 64, 16, 32, 16, 48, 16]);
    for (const a of Object.keys(T.A8_FALL_DY)) expect(T.A8_FALL_DY[Number(a)].length).toBe(11);
  });
});

describe.skipIf(!ROM_PATH)('tabelas das arenas = ROM', () => {
  it('extractStageTables(ROM) reproduz tables.ts', () => {
    const t = extractStageTables(new Uint8Array(readFileSync(ROM_PATH!)));
    const { A9_PAL, A10_PAL, ...rest } = T;
    expect(t).toEqual({ ...rest, A9_PAL, A10_PAL });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/rom-facts.test.ts`
Expected: FAIL (arquivos inexistentes).

- [ ] **Step 3: Escrever o gerador**

`web/scripts/rom-facts/stages.ts` (Node 24 com *type stripping*: só sintaxe apagável, imports relativos com `.ts`, nada de `src/`):

```ts
// Gera web/src/core/stages/tables.ts a partir da ROM. Uso: SB4_ROM=… node scripts/rom-facts/stages.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface StageTables { [k: string]: unknown }

function view(rom0: Uint8Array) {
  const rom = rom0.length % 0x8000 === 512 ? rom0.subarray(512) : rom0;
  const off = (a: number): number => ((a >> 16) & 0x3f) << 16 | (a & 0xffff);
  const u8 = (a: number): number => rom[off(a)];
  const u16 = (a: number): number => u8(a) | (u8(a + 1) << 8);
  const s8 = (a: number): number => { const v = u8(a); return v >= 0x80 ? v - 0x100 : v; };
  return { rom, u8, u16, s8 };
}
const cellPair = (off: number): [number, number] => [(off & 0x3f) >> 1, off >> 6];   // offset $2800 → (col, lin)
const list = (u8: (a: number) => number, a: number): number[] => { const n = u8(a); return Array.from({ length: n }, (_, i) => u8(a + 1 + i)); };

export function extractStageTables(rom0: Uint8Array): StageTables {
  const { u8, u16, s8 } = view(rom0);
  const words = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => u16(a + 2 * i));
  const bytes = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => u8(a + i));
  // arena 3: $C3:9401 = lista de offsets terminada em 0
  const orbs: [number, number][] = [];
  for (let a = 0xc39401; u16(a) !== 0; a += 2) orbs.push(cellPair(u16(a)));
  // $C3:087D: 4 ponteiros de 3 bytes → tabelas de 4 bytes no banco C3
  const turn = [0, 1, 2, 3].map(i => bytes(0xc30000 | u16(0xc3087d + 3 * i), 4));
  // arena 7: $C3:918E = (offset, palavra) até offset 0
  const arrows: [number, number, number][] = [];
  for (let a = 0xc3918e; u16(a) !== 0; a += 4) { const [c, l] = cellPair(u16(a)); arrows.push([c, l, u16(a + 2)]); }
  // arena 8: pads nas chamadas de $C3:1291 (LDY #$01C8/$01D0/$01D8)
  const pads = [u16(0xc31294), u16(0xc3129b), u16(0xc312a2)].map(cellPair);
  const colsOf = (a: number): number[] => { const r: number[] = []; for (let x = a; u16(x) !== 0; x += 2) r.push(u16(x)); return r; };
  // $C1:6984: 16 × (ptr16, dir, 0) → scripts (dx, dy) por tick até $80; guardamos só dy
  const fallPick = Array.from({ length: 16 }, (_, i) => u16(0xc16984 + 4 * i));
  const fallDy: Record<number, number[]> = {};
  const script = (p: number): number[] => { const r: number[] = []; for (let a = 0xc10000 | p; u8(a) !== 0x80; a += 2) r.push(s8(a + 1)); return r; };
  // bomba que cai ($C1:1D2D): 8 grupos de 4 ponteiros (cima, dir, baixo, esq); usa o de baixo
  const bombFall = Array.from({ length: 8 }, (_, i) => u16((0xc10000 | u16(0xc11d2d + 3 * i)) + 4));
  for (const p of [...fallPick, ...bombFall]) fallDy[p] ??= script(p);
  const saws: [number, number, number][] = [];
  for (let a = 0xc39524; u16(a) !== 0xffff; a += 4) { const [c, l] = cellPair(u16(a + 2)); saws.push([u16(a), c, l]); }
  return {
    A2_MODES: bytes(0xc30b11, 32),
    A3_ORBS: orbs,
    A3_TURN: turn,
    A6_REPAINT: words(0xc15558, 16),
    A7_ARROWS: arrows,
    A8_PADS: pads,
    A8_PRIZE: words(0xc31414, 64),
    A8_L149F: list(u8, 0xc3149f), A8_L14A9: list(u8, 0xc314a9), A8_L14B6: list(u8, 0xc314b6),
    A8_L14BE: bytes(0xc314be, 3), A8_L14C1: list(u8, 0xc314c1), A8_L14C5: bytes(0xc314c5, 9), A8_L14CE: list(u8, 0xc314ce),
    A8_RAIN: bytes(0xc31494, 8),
    A8_PRESET: [0, 1, 2, 3].map(i => words(0xc31b61 + 4 * i, 2)),
    A8_REEL_ROWS: words(0xc311a5, 16),
    A8_COLS_ALL: colsOf(0xc31173),
    A8_COLS: [colsOf(0xc31187), colsOf(0xc31191), colsOf(0xc3119b)],
    A8_FALL_PICK: fallPick,
    A8_FALL_DY: fallDy,
    A8_BOMB_FALL: bombFall,
    A8_EGGS: bytes(0xc15da4, 14),
    A9_SAWS: saws,
    A9_PAL: 0xd7dddc,
    A10_PAL: 0xd7e47c,
  };
}

const hex = (v: number): string => '0x' + v.toString(16);
const lit = (v: unknown): string => Array.isArray(v) ? `[${v.map(lit).join(', ')}]`
  : typeof v === 'number' ? (v > 9 ? hex(v) : String(v))
  : `{ ${Object.entries(v as object).map(([k, x]) => `${hex(Number(k))}: ${lit(x)}`).join(', ')} }`;

export function renderTables(t: StageTables, sha1: string): string {
  const doc: Record<string, string> = {
    A2_MODES: '$C3:0B11: modo da arena 2 por (rnd255 & 31). 0 normal, 1 rápido, 2 lento.',
    A3_ORBS: '$C3:9401: bolas da arena 3 (col, lin), na ordem de criação.',
    A3_TURN: '$C3:087D: soma na direção a cada falha, por conjunto (rnd255 & 3).',
    A6_REPAINT: '$C1:5558: piso repintado da arena 6 por v (1..15; índice 0 sem uso).',
    A7_ARROWS: '$C3:918E: setas da arena 7 (col, lin, palavra); face = palavra − 0x1CC0.',
    A8_PADS: '$C3:1291: pads do caça-níquel (col, lin); pad i → rolo i.',
    A8_PRIZE: '$C3:1414: rotina de prêmio por s1·16 + s2·4 + s3.',
    A8_L149F: '$C3:149F', A8_L14A9: '$C3:14A9', A8_L14B6: '$C3:14B6', A8_L14BE: '$C3:14BE (cópia fixa)',
    A8_L14C1: '$C3:14C1', A8_L14C5: '$C3:14C5 (cópia fixa)', A8_L14CE: '$C3:14CE',
    A8_RAIN: '$C3:1494: item de cada onda da chuva (onda & 7).',
    A8_PRESET: '$C3:1B61: contagem inicial dos 2 outros rolos ao ligar, por rnd255 & 3.',
    A8_REEL_ROWS: '$C3:11A5: fonte ($7F:xxxx) de cada linha de 8 px do rolo, por pos/2.',
    A8_COLS_ALL: '$C3:1173: X (px) de queda da chuva e dos ovos dela.',
    A8_COLS: '$C3:1187/1191/119B: X (px) de queda pelo último rolo a parar (1, 2, 3).',
    A8_FALL_PICK: '$C1:6984: script de queda dos itens por rnd255 & 15.',
    A8_FALL_DY: 'dy (px) por tick de cada script de queda.',
    A8_BOMB_FALL: '$C1:1D2D (grupo, script de baixo): queda da bomba do prêmio 1526 por rnd255 & 7.',
    A8_EGGS: '$C1:5DA4: tipo do ovo por rnd(14).',
    A9_SAWS: '$C3:9524: gangorras (estado inicial, col e lin da ponta A); B = A + 2 colunas.',
    A9_PAL: '$D7:DDDC: 6 quadros da paleta 5 da arena 9, 14 ticks cada.',
    A10_PAL: '$D7:E47C: 4 quadros da paleta 5 da arena 10, 15 ticks cada.',
  };
  const lines = [`// GERADO por web/scripts/rom-facts/stages.ts a partir da ROM SHA-1 ${sha1}. Não editar.`];
  for (const [k, v] of Object.entries(t)) {
    const type = k === 'A8_FALL_DY' ? ': Readonly<Record<number, readonly number[]>>' : '';
    lines.push(`/** ${doc[k]} */`, `export const ${k}${type} = ${lit(v)};`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('stages.ts')) {
  const buf = new Uint8Array(readFileSync(process.env.SB4_ROM!));
  const sha1 = createHash('sha1').update(buf.length % 0x8000 === 512 ? buf.subarray(512) : buf).digest('hex');
  writeFileSync(new URL('../../src/core/stages/tables.ts', import.meta.url), renderTables(extractStageTables(buf), sha1));
}
```

- [ ] **Step 4: Gerar `tables.ts` e conferir os valores**

Run: `cd web && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" node scripts/rom-facts/stages.ts`

O arquivo gerado **tem de conter exatamente** estes valores (lidos da ROM para este plano; qualquer diferença = bug no gerador):

```ts
export const A2_MODES = [0, 1, 0, 0, 1, 1, 0, 1, 2, 0, 0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 0, 1];
export const A3_ORBS = [[0xa, 7], [6, 5]];
export const A3_TURN = [[1, 2, 3, 0], [3, 2, 1, 0], [1, 2, 3, 0], [3, 2, 1, 0]];
export const A6_REPAINT = [0x1c0a, 0x1c06, 0x1c0a, 0x1c06, 0x1c0a, 0x1c0a, 0x1c06, 0x1c0a, 0x1c06, 0x1c0a, 0x1c06, 0x1c0a, 0x1c06, 0x1c06, 0x1c0a, 0x1c0a];
export const A7_ARROWS = [[4, 3, 0x1cc2], [4, 9, 0x1cc0], [0xc, 3, 0x1cc4], [0xc, 9, 0x1cc6]];
export const A8_PADS = [[4, 7], [8, 7], [0xc, 7]];
export const A8_PRIZE = [0x15bf, 0x1526, 0x1526, 0x14f7, 0x1526, 0x14f9, 0x14f9, 0x14f7, 0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x14f7,
  0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f9, 0x16a2, 0x1662, 0x1662, 0x14f9, 0x14d6, 0x14d6, 0x1611, 0x14f7, 0x1611, 0x1611, 0x163a,
  0x1526, 0x14f9, 0x14f9, 0x14f7, 0x14f9, 0x1662, 0x14d6, 0x1611, 0x14f9, 0x14d6, 0x17ad, 0x1611, 0x14f7, 0x1611, 0x1611, 0x163a,
  0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x14f7, 0x1662, 0x1611, 0x1611, 0x14f7, 0x1611, 0x1611, 0x1611, 0x14f7, 0x163a, 0x163a, 0x1682];
export const A8_L149F = [1, 3, 0x11, 5, 4, 0xe, 7, 0xd, 0x2d];
export const A8_L14A9 = [0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2b];
export const A8_L14B6 = [3, 1, 5, 7, 0xd, 0xe, 0x11];
export const A8_L14BE = [0x11, 0x11, 0x11];
export const A8_L14C1 = [1, 3, 5];
export const A8_L14C5 = [3, 4, 3, 3, 4, 3, 3, 4, 3];
export const A8_L14CE = [1, 3, 0x11, 5, 0xe, 7, 0xd];
export const A8_RAIN = [1, 3, 0x11, 5, 4, 0xe, 7, 0xd];
export const A8_PRESET = [[0x2c, 0x40], [0x44, 0x2c], [0x24, 0x48], [0x4c, 0x20]];
export const A8_REEL_ROWS = [0x9680, 0x9480, 0x9280, 0x9080, 0x9640, 0x9440, 0x9240, 0x9040, 0x9600, 0x9400, 0x9200, 0x9000, 0x96c0, 0x94c0, 0x92c0, 0x90c0];
export const A8_COLS_ALL = [0x30, 0x70, 0xb0, 0x40, 0x80, 0xc0, 0x50, 0x90, 0xd0];
export const A8_COLS = [[0x30, 0x40, 0x50, 0x40], [0x70, 0x80, 0x90, 0x80], [0xb0, 0xc0, 0xd0, 0xc0]];
export const A8_FALL_PICK = [0x69c4, 0x7473, 0x74b8, 0x69c4, 0x7473, 0x748a, 0x69c4, 0x74a1, 0x7473, 0x69c4, 0x748a, 0x69c4, 0x745c, 0x69c4, 0x7473, 0x69c4];
// A8_FALL_DY[s] = [-2, d, d, d, d, d, d, d, d, 1, 1] com d = 2 (69C4), 4 (745C), 6 (7473), 8 (748A), 10 (74A1), 12 (74B8)
export const A8_BOMB_FALL = [0x745c, 0x745c, 0x745c, 0x7473, 0x745c, 0x745c, 0x748a, 0x74a1];
export const A8_EGGS = [0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f, 0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f];
export const A9_SAWS = [[0, 4, 3], [0, 4, 9], [1, 0xa, 3], [1, 0xa, 9]];
export const A9_PAL = 0xd7dddc;
export const A10_PAL = 0xd7e47c;
```

Commitar o `tables.ts` gerado (são fatos numéricos, spec §2.2). Sem a ROM, o implementador escreve este mesmo conteúdo à mão com o cabeçalho "GERADO…" e o SHA-1 acima.

- [ ] **Step 5: Rodar os testes**

Run: `cd web && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/stages/rom-facts.test.ts && npx tsc --noEmit`
Expected: PASS (com e sem `SB4_ROM`).

- [ ] **Step 6: Commit**

```bash
git add web/scripts/rom-facts/stages.ts web/src/core/stages/tables.ts web/tests/stages/rom-facts.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): tabelas da ROM das arenas geradas e conferidas (modos, bolas, piso, setas, caça-níquel, gangorras)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

## Onda 2

Regras comuns da onda 2:
- Cada tarefa **Possui** só os arquivos da sua arena (listados) e seu arquivo de teste. Os esqueletos criados em T1 são substituídos inteiros.
- Os módulos importam o núcleo por `./kit` e também `../units`, `../types` e `./tables`/`./state` (estáveis desde a onda 1). Nada de `render/` no núcleo.
- Os testes usam `tests/stages/kit.ts`. "Arena de teste" = `stageArena(N)`: grade vazia do plano 6 (paredes; pilares em col ímpar × lin par), fase `play`, tick 100, semente `0x12`, init da arena já rodado.

### Task 3: Arena 2 "Rápido e Devagar"

**Possui:** `web/src/core/stages/stage2.ts`, `web/src/render/rom/stages/stage2.ts`, `web/src/render/fallback/stages/stage2.ts`, `web/tests/stages/stage2.test.ts`.

**Interfaces:**
- Consumes: `kit` (`rnd255`, `INTRO_LOGIC`, `stageEvent`), `tables.A2_MODES`, `state.Stage2State`, `registerRomLayer`/`registerFallbackLayer`, `geom`.
- Produces: `stage2: StageModule` (`init`, `tick`, `speedLevel`, `fuseStep`), `st2(s): Stage2State`, `HOFS_STEP = [8, 32, 1]`; camadas `stage2` (ROM: `bg1Scroll`; fallback: véu do modo).

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage2.test.ts`:

```ts
import { stage2, st2 } from '../../src/core/stages/stage2';
import { addBomb } from '../../src/core/bombs';
import { BTN, type GameEvent } from '../../src/core/types';
import { cellOf, centerX } from '../../src/core/units';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage2';
import '../../src/render/fallback/stages/stage2';
import { stageArena, fullRound, toPlay, runUntil, run, put, stageEvents, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 2: golden do emulador (5 jogadores, semente de boot) [D1, D2]', () => {
  it('1º sorteio no 1º tick de play: $3BC1 → $D6C3, temporizador 320 + 213', () => {
    const s = fullRound(2);
    expect(s.rng.seed).toBe(0x3bc1);
    toPlay(s);
    expect(s.rng.seed).toBe(0xd6c3);
    expect(st2(s).left).toBe(533 - 10);   // 10 ticks lógicos do intro já passaram (D3)
  });
  it('trocas nos ticks lógicos 534, 900, 1317, 1660 (relógio 2:52/7, 2:46/1, 2:39/4, 2:33/21)', () => {
    const s = fullRound(2);
    const seen: { sec: number; sub: number; mode: string; seed: number }[] = [];
    const warn: { sec: number; sub: number }[] = [];
    runUntil(s, (st, ev: GameEvent[]) => {
      for (const e of stageEvents(ev)) {
        if (e.id.startsWith('a2_mode')) seen.push({ sec: st.clock.sec, sub: st.clock.sub, mode: e.id, seed: st.rng.seed });
        if (e.id === 'a2_warn') warn.push({ ...st.clock });
      }
      return seen.length === 4;
    }, 3000);
    expect(seen).toEqual([
      { sec: 172, sub: 7, mode: 'a2_mode1', seed: 0x4bdb },
      { sec: 166, sub: 1, mode: 'a2_mode1', seed: 0x61b3 },
      { sec: 159, sub: 4, mode: 'a2_mode0', seed: 0xde4b },
      { sec: 153, sub: 21, mode: 'a2_mode2', seed: 0xb7a3 },
    ]);
    expect(warn[0]).toEqual({ sec: 174, sub: 15 });   // 128 ticks antes da 1ª troca
    expect(warn.length).toBe(4);
  });
});

describe('arena 2: efeitos do modo', () => {
  const speedDelta = (mode: 0 | 1 | 2, lv: number): number => {
    const s = stageArena(2);
    st2(s).mode = mode;
    const p = put(s, 0, 2, 1);
    p.speedLv = lv;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    const x0 = p.x;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    return p.x - x0;
  };
  it('rápido = nível 6 (512/tick) ignorando patins; lento = nível 7 (128/tick); normal = nível próprio', () => {
    expect(speedDelta(1, 5)).toBe(512);
    expect(speedDelta(2, 1)).toBe(128);
    expect(speedDelta(0, 5)).toBe(384);
    expect(speedDelta(0, 1)).toBe(256);
  });
  it('speedLevel sobrepõe a caveira $22', () => {
    const s = stageArena(2);
    st2(s).mode = 1;
    expect(stage2.speedLevel!(s, s.players[0], 7)).toBe(6);
  });
  const fuseTicks = (mode: 0 | 1 | 2, oddStart: boolean): number => {
    const s = stageArena(2);
    st2(s).mode = mode;
    if (oddStart) run(s, 1);
    const born = s.tick;
    addBomb(s, 0, cellOf(8, 5));
    const t = runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion'), 400);
    return t - born;
  };
  it('pavio 127 / 64 / 253 (colocada em tick par) e 252 (ímpar) [D5]', () => {
    expect(fuseTicks(0, false)).toBe(127);
    expect(fuseTicks(1, false)).toBe(64);
    expect(fuseTicks(2, false)).toBe(253);
    expect(fuseTicks(2, true)).toBe(252);
  });
  it('HOFS do BG1: +8 / +32 / +1 a cada 4 ticks, começando em 8', () => {
    for (const [mode, want] of [[0, 24], [1, 72], [2, 10]] as const) {
      const s = stageArena(2);
      st2(s).mode = mode;
      run(s, 8);                                           // ticks 101..108: somas em 104 e 108
      expect(st2(s).hofs).toBe(want);
    }
  });
});

describe('arena 2: camadas', () => {
  it('ROM: bg1Scroll com o HOFS do estado; nada em outra fase', () => {
    const s = stageArena(2);
    st2(s).hofs = 40;
    const { b, calls } = fakeBuilder();
    const layer = romLayers.find(l => l.id === 'stage2')!;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.scroll).toEqual([40]);
    const s1 = stageArena(1);
    layer.draw(s1, b, fakeAssets(), 0);
    expect(calls.scroll).toEqual([40]);
  });
  it('fallback: véu no modo rápido/lento, nada no normal', () => {
    const layer = fallbackLayers.find(l => l.id === 'stage2')!;
    const s = stageArena(2);
    const a = fakeCtx();
    layer.draw(s, a.ctx, {} as never, 0);
    expect(a.log.length).toBe(0);
    st2(s).mode = 1;
    layer.draw(s, a.ctx, {} as never, 0);
    expect(a.log).toContain('fillRect');
  });
  it('ponto de referência: x de centro da col 2', () => { expect(centerX(2)).toBe(31 * 256); });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage2.test.ts`
Expected: FAIL (`st2` não existe).

- [ ] **Step 3: Implementar `core/stages/stage2.ts`**

```ts
import type { StageModule } from '../hooks';
import type { RoundState } from '../types';
import type { Stage2State } from './state';
import { A2_MODES } from './tables';
import { INTRO_LOGIC, rnd255, stageEvent } from './kit';

/** Soma no HOFS do BG1 a cada 4 ticks por modo ($C1:C4DD). */
export const HOFS_STEP = [8, 32, 1];

export const st2 = (s: RoundState): Stage2State =>
  (s.stageState ??= { mode: 0, left: 0, started: false, hofs: 8 }) as Stage2State;

/** Arena 2 ($C3:0AAF): modo global normal/rápido/lento sorteado a cada 320–574 ticks. */
export const stage2: StageModule = {
  init(s) { s.stageState = { mode: 0, left: 0, started: false, hofs: 8 }; },
  tick(s, ev) {
    const a = st2(s);
    if (!a.started) {
      a.started = true;
      // A ROM sorteia no tick lógico 1 do intro; os 10 ticks lógicos do intro já passaram (D3).
      a.left = 320 + rnd255(s) - (s.phase === 'intro' ? 0 : INTRO_LOGIC);
    } else if (--a.left === 0) {
      a.left = 320 + rnd255(s);                          // primeiro o temporizador ($C3:0B39)…
      a.mode = A2_MODES[rnd255(s) & 31] as 0 | 1 | 2;    // …depois o modo ($C3:0B11)
      stageEvent(ev, `a2_mode${a.mode}`);
    } else if (a.left === 128) {
      stageEvent(ev, 'a2_warn');
    }
    if ((s.tick & 3) === 0) a.hofs = (a.hofs + HOFS_STEP[a.mode]) & 0xff;
  },
  speedLevel(s, _p, lv) {
    const m = st2(s).mode;
    return m === 1 ? 6 : m === 2 ? 7 : lv;
  },
  fuseStep(s) {
    const m = st2(s).mode;
    if (m === 1) return 2;
    if (m === 2) return (s.tick & 1) === 0 ? 1 : 0;
    return 1;
  },
};
```

- [ ] **Step 4: Implementar as camadas**

`web/src/render/rom/stages/stage2.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
import { st2 } from '../../../core/stages/stage2';

// Relógios translúcidos do BG1 andando pelo HOFS (o plano 7 cuida do color math 'half' e dos tiles animados).
registerRomLayer({ id: 'stage2', draw(s, b) { if (s.stage !== 2) return; b.bg1Scroll(st2(s).hofs); } });
```

`web/src/render/fallback/stages/stage2.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { st2 } from '../../../core/stages/stage2';
import { cellLeft, cellTop } from './geom';

// Véu leve sobre o campo: vermelho no rápido, azul no lento.
registerFallbackLayer({
  id: 'stage2',
  draw(s, ctx) {
    if (s.stage !== 2) return;
    const m = st2(s).mode;
    if (m === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = m === 1 ? '#ff4040' : '#4060ff';
    ctx.fillRect(cellLeft(2), cellTop(1), 13 * 16, 11 * 16);
    ctx.restore();
  },
});
```

- [ ] **Step 5: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS. Se o golden das trocas falhar só no relógio, conferir o item 1 da Task 1 (intro sem `tick` de arena) antes de mexer no teste.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/stages/stage2.ts web/src/render/rom/stages/stage2.ts web/src/render/fallback/stages/stage2.ts web/tests/stages/stage2.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 2 — modo global normal/rápido/lento com sorteio da ROM, pavio e velocidade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Arena 3 "Bombardeio Orbital"

**Possui:** `web/src/core/stages/stage3.ts`, `web/src/core/ai/stages/stage3.ts`, `web/src/render/rom/stages/stage3.ts`, `web/src/render/fallback/stages/stage3.ts`, `web/tests/stages/stage3.test.ts`.

**Interfaces:**
- Consumes: `kit` (`rnd255`, `burnSoft`, `restoreFloor`, `stun`, `stageEvent`, `standing`, `px`), `units`, `tables.{A3_ORBS, A3_TURN}`, `state.{Orb, Stage3State}`, `romkit`.
- Produces: `stage3` (`init`, `onFlameCell`, `tick`, `ai`), `st3(s)`, `ORB_STEP`; `stage3Ai.danger`; camadas `stage3`.

Regras (D6, D7; código `$C3:06EE…$C3:0AAE`): ver tabela de decisões. Detalhes que pegam:
- A casa da bola parada é regravada com `ORB` todo tick (se não for pressão). A chama **não** grava `FLAME` nela (plano 6, decisão 11): o disparo vem de `onFlameCell` e só vale no tick seguinte (D4).
- O toque vale parada ou rolando, testado antes de mover, para cada jogador de pé que não esteja `stunned`/`shocked`, com `|x − xb| < 8` e `|y − yb| < 8` em px, e só se `inv === 0`.
- Rolando, a bola não está na grade. Ao chegar na casa, se a casa for pressão, a bola some.
- Destino livre é limpo para piso (a bola esmaga item e apaga chama), como `$C1:532C`.

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage3.test.ts`:

```ts
import { stage3, st3 } from '../../src/core/stages/stage3';
import { stage3Ai } from '../../src/core/ai/stages/stage3';
import { CODE } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage3';
import '../../src/render/fallback/stages/stage3';
import { stageArena, fullRound, run, put, setCell, codeAt, stageEvents, mirror, fakeBuilder, fakeAssets, fakeCtx } from './kit';

/** Chama à esquerda da bola de (6,5) no tick atual e aviso de chama na bola: dispara no tick seguinte, para a direita. */
function fire(s: ReturnType<typeof stageArena>, col = 5, lin = 5): void {
  setCell(s, col, lin, CODE.FLAME);
  s.cellT0[cellOf(col, lin)] = s.tick;
  stage3.onFlameCell!(s, cellOf(6, 5), 6, []);
}
const orb65 = (s: ReturnType<typeof stageArena>) => st3(s).orbs[1];

describe('arena 3: carga', () => {
  it('golden: bolas em (10,7) e (6,5), nessa ordem; semente depois dos itens $C9B1 (nenhum sorteio da arena) [D1]', () => {
    const s = fullRound(3);
    expect(s.rng.seed).toBe(0xc9b1);
    expect(st3(s).orbs.map(o => o.cell)).toEqual([cellOf(10, 7), cellOf(6, 5)]);
    expect(codeAt(s, 10, 7)).toBe(CODE.ORB);
    expect(codeAt(s, 6, 5)).toBe(CODE.ORB);
    expect(st3(s).orbs.map(o => [o.x, o.y])).toEqual([[159, 143], [95, 111]]);
  });
});

describe('arena 3: disparo e rolagem', () => {
  it('sai para o lado oposto à chama, 1 px/tick, 16 ticks por casa, 8 casas; 1 rnd255 no disparo', () => {
    const s = stageArena(3);
    const m = mirror(0x12);
    fire(s);
    const ev = run(s, 1);                                      // tick 101: dispara
    const o = orb65(s);
    expect([o.rolling, o.dir, o.cellsLeft, o.turnSet]).toEqual([true, 1, 8, m.rnd(0xff) & 3]);
    expect(s.rng.seed).toBe(m.seed());
    expect(codeAt(s, 6, 5)).toBe(CODE.FLOOR);
    expect(stageEvents(ev, 'a3_roll').length).toBe(1);
    run(s, 16);                                                // tick 117: chega em (7,5)
    expect([o.x, o.cell]).toEqual([111, cellOf(7, 5)]);
    run(s, 112);                                               // tick 229: 8ª casa, (14,5)
    expect([o.x, o.rolling, o.cell]).toEqual([223, false, cellOf(14, 5)]);
    run(s, 1);
    expect(codeAt(s, 14, 5)).toBe(CODE.ORB);
  });
  it('sem chama vizinha não dispara; chama criada neste tick só vale no próximo (D4)', () => {
    const s = stageArena(3);
    stage3.onFlameCell!(s, cellOf(6, 5), 6, []);
    run(s, 1);
    expect(orb65(s).rolling).toBe(false);
    expect(codeAt(s, 6, 5)).toBe(CODE.ORB);
  });
  it('ordem de checagem das vizinhas: baixo antes de esquerda', () => {
    const s = stageArena(3);
    setCell(s, 6, 6, CODE.FLAME); s.cellT0[cellOf(6, 6)] = s.tick;
    fire(s);
    run(s, 1);
    expect(orb65(s).dir).toBe(0);                              // chama embaixo → sobe
  });
  it('bloqueio no 1º passo: vira pela tabela e não destrói o soft (softArmed = false no disparo)', () => {
    const s = stageArena(3);
    setCell(s, 7, 5, CODE.SOFT);
    fire(s);
    run(s, 1);
    const o = orb65(s);
    expect(o.turnSet).toBe(2);                                 // 66 & 3
    expect(o.dir).toBe(2);                                     // 1 + A3_TURN[2][0] = 2 (baixo)
    expect(codeAt(s, 7, 5)).toBe(CODE.SOFT);
  });
  it('depois de andar, o 1º soft em que bate queima (24 ticks) e a bola vira', () => {
    const s = stageArena(3);
    setCell(s, 9, 5, CODE.SOFT);
    fire(s);
    run(s, 33);                                                // tick 133: chega em (8,5)
    expect(codeAt(s, 9, 5)).toBe(CODE.BURNING);
    expect(orb65(s).dir).toBe(2);
  });
  it('4 falhas seguidas: para e volta a ORB na grade', () => {
    const s = stageArena(3);
    setCell(s, 8, 5, CODE.HARD);
    fire(s);
    run(s, 9);                                                 // tick 110: a bola já saiu de (6,5)
    setCell(s, 6, 5, CODE.SOFT);
    run(s, 7);                                                 // tick 117: em (7,5): dir, baixo(pilar), cima(pilar), esq(soft queima)
    const o = orb65(s);
    expect([o.rolling, o.cell]).toEqual([false, cellOf(7, 5)]);
    expect(codeAt(s, 6, 5)).toBe(CODE.BURNING);
    run(s, 1);
    expect(codeAt(s, 7, 5)).toBe(CODE.ORB);
  });
  it('item no caminho é esmagado', () => {
    const s = stageArena(3);
    setCell(s, 8, 5, 0x0941);
    fire(s);
    run(s, 17);                                                // em (7,5) avalia (8,5): livre, vira piso
    expect(codeAt(s, 8, 5)).toBe(CODE.FLOOR);
  });
  it('parada sobre pressão: a bola some', () => {
    const s = stageArena(3);
    setCell(s, 6, 5, CODE.PRESSURE);
    run(s, 1);
    expect(orb65(s).alive).toBe(false);
  });
});

describe('arena 3: toque no jogador [D6]', () => {
  it('a < 8 px: atordoa, inv = 64, só uma vez enquanto inv > 0; não mata', () => {
    const s = stageArena(3);
    const p = put(s, 0, 6, 5, 7, 0);                           // 7 px à direita do centro da bola
    const ev = run(s, 10);
    expect(stageEvents(ev, 'a3_hit').length).toBe(1);
    expect(ev.filter(e => e.type === 'stunned').length).toBe(1);
    expect(p.state).toBe('alive');
    expect(p.inv).toBeGreaterThan(50);
  });
  it('a 8 px não toca', () => {
    const s = stageArena(3);
    put(s, 0, 6, 5, 8, 0);
    expect(stageEvents(run(s, 5), 'a3_hit').length).toBe(0);
  });
  it('bola rolando atordoa quem está no caminho', () => {
    const s = stageArena(3);
    const p = put(s, 0, 10, 5);
    fire(s);
    const ev = run(s, 70);
    expect(stageEvents(ev, 'a3_hit').map(e => e.slot)).toEqual([0]);
    expect(p.state).toBe('alive');
  });
});

describe('arena 3: IA e camadas', () => {
  it('danger: casas à frente da bola rolando, com o tempo de chegada', () => {
    const s = stageArena(3);
    fire(s);
    run(s, 1);
    const d = stage3Ai.danger!(s);
    expect(d.get(cellOf(7, 5))).toBe(16);
    expect(d.get(cellOf(8, 5))).toBe(32);
    expect(d.get(cellOf(14, 5))).toBe(128);
    expect(d.has(cellOf(6, 6))).toBe(false);
  });
  it('danger: bola parada com chama pega prevê a rota a partir do tick seguinte', () => {
    const s = stageArena(3);
    fire(s);
    const d = stage3Ai.danger!(s);
    expect(d.get(cellOf(7, 5))).toBe(17);
  });
  it('ROM: um sprite por bola viva, na posição da bola, prioridade 2', () => {
    const s = stageArena(3);
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage3')!.draw(s, b, fakeAssets(), 0);
    expect(calls.sprites.length).toBe(2);
    expect(calls.sprites.map(c => [c.e.x, c.e.y, c.e.prio])).toEqual([[151, 135, 2], [87, 103, 2]]);
  });
  it('fallback: desenha as bolas', () => {
    const s = stageArena(3);
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage3')!.draw(s, a.ctx, {} as never, 0);
    expect(a.log.filter(x => x === 'arc').length).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage3.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `core/stages/stage3.ts`**

```ts
import type { StageModule } from '../hooks';
import { CODE, type GameEvent, type RoundState } from '../types';
import { cellAt, cellOf } from '../units';
import type { Orb, Stage3State } from './state';
import { A3_ORBS, A3_TURN } from './tables';
import { burnSoft, px, restoreFloor, rnd255, stageEvent, standing, stun } from './kit';
import { stage3Ai } from '../ai/stages/stage3';

/** Passo em casas por direção: 0 cima, 1 direita, 2 baixo, 3 esquerda ($C3:09F8). */
export const ORB_STEP = [-17, 1, 17, -1];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/** Vizinha com chama → direção de saída, na ordem checada pela ROM ($C3:0A00). */
const TRIGGER: readonly [number, 0 | 1 | 2 | 3][] = [[17, 0], [-1, 1], [-17, 2], [1, 3]];

function newOrb(col: number, lin: number): Orb {
  return { x: 16 * col - 1, y: 16 * (lin + 2) - 1, cell: cellOf(col, lin), rolling: false, dir: 0, stepLeft: 0,
    cellsLeft: 0, fails: 0, turnSet: 0, softArmed: true, alive: true, flamedAt: -1 };
}
export const st3 = (s: RoundState): Stage3State =>
  (s.stageState ??= { orbs: A3_ORBS.map(([c, l]) => newOrb(c, l)) }) as Stage3State;

/** Direção de disparo se a bola parada foi pega por chama (null = não dispara). */
export function triggerDir(s: RoundState, o: Orb): 0 | 1 | 2 | 3 | null {
  const hit = TRIGGER.find(([d]) => ((s.grid[o.cell + d] ?? 0) & 0x1000) !== 0);
  return hit ? hit[1] : null;
}

function touch(s: RoundState, o: Orb, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (!standing(p) || p.act === 'stunned' || p.act === 'shocked' || p.inv !== 0) continue;
    if (Math.abs(px(p.x) - o.x) < 8 && Math.abs(px(p.y) - o.y) < 8) {
      stun(s, p, ev);
      p.inv = 64;
      stageEvent(ev, 'a3_hit', { slot: p.slot });
    }
  }
}

function stop(s: RoundState, o: Orb): void {
  o.rolling = false;
  if (s.grid[o.cell] === CODE.PRESSURE) o.alive = false; else s.grid[o.cell] = CODE.ORB;
}

/** $C3:08CA: tenta sair na direção atual, virando pela tabela até 4 falhas. */
function evaluate(s: RoundState, o: Orb): void {
  for (;;) {
    const dest = o.cell + ORB_STEP[o.dir];
    const g = s.grid[dest] ?? CODE.HARD;
    let blocked = true;
    if ((g & 0x30) === 0x30 || (g & 0xefc0) === CODE.BOMB) { /* bloqueia */ }
    else if ((g & 0xefc0) === CODE.SOFT) { if (o.softArmed) { o.softArmed = false; burnSoft(s, dest); } }
    else if (g & 0xc000) { /* bloqueia */ }
    else blocked = false;
    if (!blocked) { restoreFloor(s, dest); o.rolling = true; o.stepLeft = 16; return; }
    o.dir = ((o.dir + A3_TURN[o.turnSet][o.fails]) & 3) as 0 | 1 | 2 | 3;
    if (++o.fails >= 4) { stop(s, o); return; }
  }
}

function arrive(s: RoundState, o: Orb): void {
  o.cell = cellAt(o.x * 256, o.y * 256);
  if (s.grid[o.cell] === CODE.PRESSURE) { o.alive = false; return; }
  o.fails = 0;
  o.softArmed = true;
  if (--o.cellsLeft === 0) { o.rolling = false; return; }   // regrava ORB no próximo tick parado
  evaluate(s, o);
}

function orbTick(s: RoundState, o: Orb, ev: GameEvent[]): void {
  touch(s, o, ev);
  if (o.rolling) {
    o.x += DX[o.dir]; o.y += DY[o.dir];
    if (--o.stepLeft === 0) arrive(s, o);
    return;
  }
  if (o.flamedAt >= 0 && o.flamedAt < s.tick) {
    o.flamedAt = -1;
    const d = triggerDir(s, o);
    if (d !== null) {
      restoreFloor(s, o.cell);
      o.turnSet = rnd255(s) & 3;
      o.fails = 0; o.dir = d; o.cellsLeft = 8; o.softArmed = false;
      stageEvent(ev, 'a3_roll', { cell: o.cell });
      evaluate(s, o);
      return;
    }
  }
  if (s.grid[o.cell] === CODE.PRESSURE) { o.alive = false; return; }
  s.grid[o.cell] = CODE.ORB;
}

/** Arena 3: 2 bolas que rolam quando a chama as pega ($C3:06EE). */
export const stage3: StageModule = {
  init(s) {
    s.stageState = { orbs: A3_ORBS.map(([c, l]) => newOrb(c, l)) };
    for (const o of st3(s).orbs) s.grid[o.cell] = CODE.ORB;
  },
  onFlameCell(s, cell) {
    for (const o of st3(s).orbs) if (o.alive && !o.rolling && o.cell === cell && o.flamedAt < 0) o.flamedAt = s.tick;
  },
  tick(s, ev) { for (const o of st3(s).orbs) if (o.alive) orbTick(s, o, ev); },
  get ai() { return stage3Ai; },   // getter: evita ordem de init no ciclo de imports com a IA
};
```

- [ ] **Step 4: Implementar `core/ai/stages/stage3.ts`**

```ts
import type { AiStageHints } from '../hints';
import { CODE } from '../../types';
import { st3, triggerDir, ORB_STEP } from '../../stages/stage3';

/** Rota das bolas como perigo (§9 item 8): casa → ticks até a bola chegar. Ignora as viradas. */
export const stage3Ai: AiStageHints = {
  danger(s) {
    const out = new Map<number, number>();
    const put = (c: number, t: number) => { const o = out.get(c); if (o === undefined || t < o) out.set(c, t); };
    for (const o of st3(s).orbs) {
      if (!o.alive) continue;
      let dir: number, first: number, n: number;
      if (o.rolling) { dir = o.dir; first = o.stepLeft; n = o.cellsLeft; }
      else if (o.flamedAt >= 0) { const d = triggerDir(s, o); if (d === null) continue; dir = d; first = 17; n = 8; }
      else continue;
      let c = o.cell;
      for (let k = 0; k < n; k++) {
        c += ORB_STEP[dir];
        const g = s.grid[c] ?? CODE.HARD;
        if (g & 0xc000 || (g & 0xefc0) === CODE.BOMB) break;
        put(c, first + 16 * k);
      }
    }
    return out;
  },
};
```

(Rolando, `o.cell` é a casa de onde saiu; a 1ª casa à frente chega em `stepLeft` ticks. Parada com chama, dispara no tick seguinte e chega 16 depois: 17.)

- [ ] **Step 5: Implementar as camadas**

`web/src/render/rom/stages/stage3.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
import { st3 } from '../../../core/stages/stage3';
import { animFrameAt, assetsOf } from './romkit';

/** Animação da bola (objeto $C3:0796: anim $D8:D57E, atributo $0E = paleta OBJ 7). Tiles OBJ da arena 3 incluem $C8:FA44 em $7C00. */
export const ORB_ANIM = 0xd8d57e;

registerRomLayer({
  id: 'stage3',
  draw(s, b, a0) {
    if (s.stage !== 3) return;
    const a = assetsOf(a0);
    const f = animFrameAt(a.anim(ORB_ANIM), s.tick);
    st3(s).orbs.forEach((o, i) => {
      if (!o.alive) return;
      for (const pc of f.pieces) {
        b.sprite({ x: o.x + pc.dx, y: o.y + pc.dy, size: pc.big ? 32 : 16, pal: (7 + pc.palAdd) & 7, prio: 2,
          hflip: pc.hflip, vflip: pc.vflip, src: { tile: pc.tile } }, o.y, 100 + i);
      }
    });
  },
});
```

Se o plano 5 não montar `$C8:FA44` no `objCommon` da arena 3 (Task 1, item 11), esta camada decodifica o bloco com `decodeZteAt(a, 0xc8fa44)` e passa `src: { px }` (16×16 a partir dos tiles `$1C0+`); anotar no PR. Paleta e prioridade são 🟡 (conferir no `npm run snap` contra `analise/extraido/arenas-cenario/shots/a03_touch.png`).

`web/src/render/fallback/stages/stage3.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { st3 } from '../../../core/stages/stage3';
import { scrX, scrY } from './geom';

registerFallbackLayer({
  id: 'stage3',
  draw(s, ctx) {
    if (s.stage !== 3) return;
    for (const o of st3(s).orbs) {
      if (!o.alive) continue;
      ctx.fillStyle = o.rolling ? '#ffb040' : '#c0c8d8';
      ctx.beginPath();
      ctx.arc(scrX(o.x), scrY(o.y), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
});
```

- [ ] **Step 6: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/core/stages/stage3.ts web/src/core/ai/stages/stage3.ts web/src/render/rom/stages/stage3.ts \
  web/src/render/fallback/stages/stage3.ts web/tests/stages/stage3.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 3 — bolas que rolam com a chama, viradas da ROM, atordoamento e rota para a IA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Arena 4 "Não Me Empurre" (curta)

**Possui:** `web/src/core/stages/stage4.ts`, `web/tests/stages/stage4.test.ts`.

A spec (§4.3, A10) deixa o tratamento da grama dos cantos (`1DE0–1DEE`) e da terra (`$9C & $100`, `$C2:210A`) provisório: **piso normal**. O código lido para este plano mostra que `$C2:210A` compara a palavra de BG2 da casa do jogador com `01E0/01E2/01E6/01EE/41E0/41E2/41E8` (tiles da grama) e chama empurrões `$C2:312D…`; o efeito não foi reproduzido no emulador andando por cima (ARN `b20`). Fica como está e vai para os Riscos.

- [ ] **Step 1: Teste**

`web/tests/stages/stage4.test.ts`:

```ts
import { stage4 } from '../../src/core/stages/stage4';
import { CODE } from '../../src/core/types';
import { fullRound } from './kit';

describe('arena 4 (A10: piso normal)', () => {
  it('módulo sem mecânica própria', () => {
    expect(Object.keys(stage4)).toEqual([]);
  });
  it('rodada real: 70 soft blocks com a semente de boot (nenhum sorteio da arena)', () => {
    const s = fullRound(4);
    expect(s.grid.filter(v => v === CODE.SOFT).length).toBe(70);
  });
});
```

- [ ] **Step 2: Implementar** `web/src/core/stages/stage4.ts`:

```ts
import type { StageModule } from '../hooks';
/** Arena 4: sem objeto especial. Grama dos cantos e terra: piso normal (spec §4.3, A10). */
export const stage4: StageModule = {};
```

- [ ] **Step 3: Rodar** `cd web && npx vitest run tests/stages/stage4.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/core/stages/stage4.ts web/tests/stages/stage4.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 4 — sem mecânica própria (grama e terra provisórias como piso)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Arena 5 "Escola de Choques"

**Possui:** `web/src/core/stages/stage5.ts`, `web/src/render/fallback/stages/stage5.ts`, `web/tests/stages/stage5.test.ts`.

**Interfaces:**
- Consumes: `kit.{shock, standing, px}`, `units.{colAt, linAt}`, `actions` (golpe P do plano 6, só nos testes).
- Produces: `stage5.outOfBounds`, `fenceHit(p): boolean`; camada fallback `stage5`.

Regra (D8): chamada pelo núcleo a cada tick de movimento forçado (`applyPush`). Status inicial forte e sem blocos já vêm do `createRound` do plano 6 (§3.3).

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage5.test.ts`:

```ts
import { stage5, fenceHit } from '../../src/core/stages/stage5';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/fallback/stages/stage5';
import { stageArena, fullRound, put, run, stageEvents, fakeCtx } from './kit';

describe('arena 5: cerca [D8]', () => {
  it('empurrado na borda indo para a cerca: choque (act shocked, SFX via a5_shock), empurrão zerado', () => {
    for (const [col, lin, vx, vy] of [[2, 5, -1024, 0], [14, 5, 1024, 0], [6, 1, 0, -1024], [6, 11, 0, 1024]] as const) {
      const s = stageArena(5);
      const p = put(s, 0, col, lin);
      p.push = { vx, vy, left: 5 };
      const ev: GameEvent[] = [];
      stage5.outOfBounds!(s, p, ev);
      expect(p.act, `${col},${lin}`).toBe('shocked');
      expect(p.push.left).toBe(0);
      expect(stageEvents(ev, 'a5_shock').map(e => e.slot)).toEqual([0]);
    }
  });
  it('na borda mas indo para dentro: nada', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 5);
    p.push = { vx: 1024, vy: 0, left: 5 };
    expect(fenceHit(p)).toBe(false);
  });
  it('fora da caixa x ∈ [24,232), y ∈ [40,216): choque', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 5);
    p.x = 23 * 256;
    expect(fenceHit(p)).toBe(true);
    p.x = 24 * 256;
    expect(fenceHit(p)).toBe(false);
    p.x = 100 * 256; p.y = 216 * 256;
    expect(fenceHit(p)).toBe(true);
  });
  it('golpe P contra a cerca: a vítima leva choque (medido: P2 em (2,1) empurrado para a esquerda)', () => {
    const s = stageArena(5);
    const p1 = put(s, 0, 3, 1);
    p1.pItem = true; p1.face = 6;
    const p2 = put(s, 1, 2, 1);
    const ev = run(s, 20, st => (st.tick < 101 ? [BTN.Y, 0, 0, 0, 0] : [0, 0, 0, 0, 0]));
    expect(stageEvents(ev, 'a5_shock').map(e => e.slot)).toEqual([1]);
    expect(p2.act).toBe('shocked');
  });
  it('andar contra a cerca não dá choque (conferido no emulador)', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 1);
    const ev = run(s, 30, [BTN.LEFT, 0, 0, 0, 0]);
    expect(stageEvents(ev, 'a5_shock').length).toBe(0);
    expect(p.act).not.toBe('shocked');
  });
  it('rodada real: sem blocos', () => {
    expect(fullRound(5).grid.filter(v => v === CODE.SOFT).length).toBe(0);
  });
  it('fallback: desenha a cerca', () => {
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage5')!.draw(stageArena(5), a.ctx, {} as never, 0);
    expect(a.log).toContain('strokeRect');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage5.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`web/src/core/stages/stage5.ts`:

```ts
import type { StageModule } from '../hooks';
import type { Player } from '../types';
import { colAt, linAt } from '../units';
import { px, shock, standing } from './kit';

/** $C2:319B (empurrado na borda indo para a cerca) ou $C2:20DF (fora da caixa de pixels). */
export function fenceHit(p: Player): boolean {
  const x = px(p.x), y = px(p.y);
  if (x < 24 || x >= 232 || y < 40 || y >= 216) return true;
  const col = colAt(p.x), lin = linAt(p.y);
  return (col === 2 && p.push.vx < 0) || (col === 14 && p.push.vx > 0)
    || (lin === 1 && p.push.vy < 0) || (lin === 11 && p.push.vy > 0);
}

/** Arena 5: cerca elétrica. */
export const stage5: StageModule = {
  outOfBounds(s, p, ev) {
    if (!standing(p) || p.act === 'shocked' || p.act === 'stunned') return;
    if (fenceHit(p)) shock(s, p, ev);
  },
};
```

`web/src/render/fallback/stages/stage5.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { cellLeft, cellTop } from './geom';

// Cerca elétrica em volta do campo, piscando a cada 9 ticks (ritmo do pilar animado da ROM).
registerFallbackLayer({
  id: 'stage5',
  draw(s, ctx) {
    if (s.stage !== 5) return;
    ctx.save();
    ctx.strokeStyle = (s.tick / 9) & 1 ? '#fff27a' : '#7ad8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellLeft(2) - 1, cellTop(1) - 1, 13 * 16 + 2, 11 * 16 + 2);
    ctx.restore();
  },
});
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS. Se o teste do golpe P falhar porque `applyPush` não chama `outOfBounds`, voltar ao item 6 da Task 1.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/stages/stage5.ts web/src/render/fallback/stages/stage5.ts web/tests/stages/stage5.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 5 — cerca elétrica no empurrão do golpe P e fora da caixa do campo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Arena 6 "Piso Traiçoeiro"

**Possui:** `web/src/core/stages/stage6.ts`, `web/src/core/ai/stages/stage6.ts`, `web/src/render/fallback/stages/stage6.ts`, `web/tests/stages/stage6.test.ts`.

**Interfaces:**
- Consumes: `kit` (`rnd255`, `armIndex`, `floorWord`, `onGround`, `stageEvent`, `setAct`, `playerCell`), `units`, `tables.A6_REPAINT`, `state.Stage6State`.
- Produces: `stage6` (`init`, `onFlameCell`, `tick`, `onStand`, `speedLevel`, `kickedBombEnter`, `ai`), `st6(s)`, `A6_FLOOR = 0x1c06`, `repaint(s, a, cell, v)`; `stage6Ai.{avoid, kickEnd}`; camada fallback `stage6`. O desenho com a ROM é do plano 7 (`floor[]`).

Regras (D9, D10, D11). O piso "normal" da arena 6 é `1C06`; `floor[cell] = 0` significa a palavra da ROM, que é `1C06` nas casas de piso.

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage6.test.ts`:

```ts
import { stage6, st6 } from '../../src/core/stages/stage6';
import { stage6Ai } from '../../src/core/ai/stages/stage6';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { cellOf, centerX, px } from '../../src/core/units';
import { fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/fallback/stages/stage6';
import { stageArena, fullRound, put, run, setCell, stageEvents, mirror, fakeCtx } from './kit';

const HIDDEN_6: [number, number, number][] = [
  [10, 8, 1], [9, 1, 1], [7, 1, 1], [14, 5, 1], [14, 4, 1], [12, 6, 1], [13, 9, 1], [10, 4, 1], [2, 3, 1], [7, 3, 1],
  [3, 7, 3], [11, 9, 3], [10, 7, 3], [8, 9, 3], [6, 9, 3], [6, 4, 3], [13, 7, 5], [6, 11, 5], [6, 1, 5],
  [4, 4, 0x0e], [8, 10, 0x0e], [3, 9, 0x0e], [5, 11, 0x12], [10, 1, 0x12], [4, 5, 7], [14, 7, 7], [2, 6, 0x0d], [10, 6, 0x0d],
  [10, 3, 4], [8, 8, 0x21], [5, 7, 0x30], [6, 8, 0x30], [12, 11, 0x30], [6, 5, 0x30],
];

describe('arena 6: carga [D1]', () => {
  it('golden: $1EAA = 111, itens escondidos e semente $61B3 (1 sorteio do init antes dos itens)', () => {
    const s = fullRound(6);
    expect(st6(s).counter).toBe(111);
    expect(s.rng.seed).toBe(0x61b3);
    expect(s.hidden).toEqual(HIDDEN_6.map(([c, l, i]) => [cellOf(c, l), i]));
  });
});

/** Explosão em (8,5) com braços de 2 casas, na ordem do plano 6 (centro, cima, dir, baixo, esq), e o tick da arena. */
function explode(s: ReturnType<typeof stageArena>): void {
  const call = (c: number, l: number, dir: number) => {
    setCell(s, c, l, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(c, l), dir, []);
  };
  call(8, 5, -1);
  call(8, 4, 0); call(8, 3, 0);
  call(9, 5, 2); call(10, 5, 2);
  call(8, 6, 4); call(8, 7, 4);
  call(7, 5, 6); call(6, 5, 6);
  stage6.tick!(s, []);
}

describe('arena 6: repintura [D9]', () => {
  it('4 sorteios por explosão (v = 15, 4, 3, 5 a partir de $42B9), braços na ordem, centro por último com o v da esquerda', () => {
    const s = stageArena(6);                       // init: 64 + (66 & 63) = 66, semente $42B9
    expect(st6(s).counter).toBe(66);
    explode(s);
    expect(s.rng.seed).toBe(0xc689);
    const f = (c: number, l: number) => s.floor[cellOf(c, l)];
    expect([f(8, 4), f(8, 3)]).toEqual([0x1c0a, 0x1c0a]);   // v = 15
    expect([f(9, 5), f(10, 5)]).toEqual([0x1c0a, 0x1c0a]);  // v = 4
    expect([f(8, 6), f(8, 7)]).toEqual([0x1c06, 0x1c06]);   // v = 3
    expect([f(7, 5), f(6, 5)]).toEqual([0x1c0a, 0x1c08]);   // v = 5; contador 58: 58 & 7 = 2 → caveirinhas
    expect(f(8, 5)).toBe(0x1c0a);                           // centro, v da esquerda
    expect(st6(s).counter).toBe(57);
  });
  it('contador chega a 0: caveira 1C0C e novo contador 64 + (rnd255 & 63)', () => {
    const s = stageArena(6);
    setCell(s, 8, 5, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 5), -1, []);
    st6(s).counter = 1;
    setCell(s, 8, 4, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 4), 0, []);
    expect(s.floor[cellOf(8, 4)]).toBe(0x1c0c);
    expect(st6(s).counter).toBe(114);
    expect(s.rng.seed).toBe(0x331b);
  });
  it('casa com bit $2000 (queimando) não é repintada nem conta', () => {
    const s = stageArena(6);
    setCell(s, 8, 5, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 5), -1, []);
    setCell(s, 8, 4, CODE.BURNING);
    stage6.onFlameCell!(s, cellOf(8, 4), 0, []);
    expect(s.floor[cellOf(8, 4)]).toBe(0);
    expect(st6(s).counter).toBe(66);
  });
});

describe('arena 6: efeitos [D10, D11]', () => {
  it('1C0C: controles invertidos {$0A, $40}, renovado; SFX só se não havia efeito', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    const p = put(s, 0, 5, 5);
    const ev1: GameEvent[] = [];
    stage6.onStand!(s, p, cellOf(5, 5), ev1);
    expect(p.effect).toEqual({ kind: 0x0a, left: 0x40 });
    expect(stageEvents(ev1, 'a6_reverse').length).toBe(1);
    p.effect.left = 10;
    const ev2: GameEvent[] = [];
    stage6.onStand!(s, p, cellOf(5, 5), ev2);
    expect(p.effect.left).toBe(0x40);
    expect(stageEvents(ev2, 'a6_reverse').length).toBe(0);
  });
  it('1C0A: empurra na face, 2 px/tick, até o centro da casa seguinte (medido 72 → 95 em 12 ticks)', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    const p = put(s, 0, 5, 5, -7, 3);                   // x = 72 px; y fora do centro
    p.face = 2;
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect(p.push).toEqual({ vx: 512, vy: 0, left: 12 });
    expect(p.act).toBe('pushed');
    expect(px(p.y)).toBe(111);                          // eixo perpendicular alinhado
    run(s, 13);
    expect(px(p.x)).toBe(95);
  });
  it('1C0A: não empurra se a casa da frente tem bit $8000', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    setCell(s, 6, 5, CODE.SOFT);
    const p = put(s, 0, 5, 5);
    p.face = 2;
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect(p.push.left).toBe(0);
  });
  it('1C08: jogador lento (nível 7, 128/tick) e bomba chutada para antes', () => {
    const s = stageArena(6);
    s.floor[cellOf(3, 1)] = 0x1c08;
    const p = put(s, 0, 3, 1);
    expect(stage6.speedLevel!(s, p, 1)).toBe(7);
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    const x0 = p.x;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    expect(p.x - x0).toBe(128);
    expect(stage6.kickedBombEnter!(s, s.bombs[0] as never, cellOf(3, 1))).toBe('stop');
    expect(stage6.kickedBombEnter!(s, s.bombs[0] as never, cellOf(4, 1))).toBe('go');
  });
  it('piso normal 1C06 (floor = 0) não faz nada', () => {
    const s = stageArena(6);
    const p = put(s, 0, 5, 5);
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect([p.effect.kind, p.push.left]).toEqual([0, 0]);
    expect(stage6.speedLevel!(s, p, 1)).toBe(1);
  });
});

describe('arena 6: IA e fallback', () => {
  it('avoid: casas de piso 1C0C e 1C0A', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    s.floor[cellOf(6, 5)] = 0x1c0a;
    s.floor[cellOf(7, 5)] = 0x1c08;
    expect([...stage6Ai.avoid!(s, 0)].sort((a, b) => a - b)).toEqual([cellOf(5, 5), cellOf(6, 5)]);
  });
  it('kickEnd: para antes do 1C08', () => {
    const s = stageArena(6);
    s.floor[cellOf(8, 1)] = 0x1c08;
    expect(stage6Ai.kickEnd!(s, cellOf(3, 1), 2)).toBe(cellOf(7, 1));
  });
  it('fallback: pinta as casas repintadas', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage6')!.draw(s, a.ctx, {} as never, 0);
    expect(a.log).toContain('fillRect');
  });
  it('referência: centro da col 5 = 79 px', () => { expect(px(centerX(5))).toBe(79); });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage6.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `core/stages/stage6.ts`**

```ts
import type { StageModule } from '../hooks';
import { CODE, type Player, type RoundState } from '../types';
import { centerX, centerY, colOf, faceStep, linOf } from '../units';
import type { Stage6State } from './state';
import { A6_REPAINT } from './tables';
import { armIndex, floorWord, onGround, playerCell, rnd255, setAct, stageEvent } from './kit';
import { stage6Ai } from '../ai/stages/stage6';

export const A6_FLOOR = 0x1c06;

export const st6 = (s: RoundState): Stage6State =>
  (s.stageState ??= { counter: 64, v: [0, 0, 0, 0], center: -1, snap: [-1, -1, -1, -1, -1], snapAxis: [0, 0, 0, 0, 0] }) as Stage6State;

/** $C1:550B: repinta uma casa de chama com v e conta $1EAA. */
export function repaint(s: RoundState, a: Stage6State, cell: number, v: number): void {
  if (s.grid[cell] & 0x2000) return;                              // $C1:406F
  s.floor[cell] = A6_REPAINT[v];
  if (--a.counter === 0) {
    s.floor[cell] = 0x1c0c;
    a.counter = 64 + (rnd255(s) & 63);
  } else if ((a.counter & 7) === 2) {
    s.floor[cell] = 0x1c08;
  }
}

function flushCenter(s: RoundState, a: Stage6State): void {
  if (a.center >= 0) { repaint(s, a, a.center, a.v[3]); a.center = -1; }
}

const w = (s: RoundState, cell: number): number => (s.grid[cell] === CODE.FLOOR ? floorWord(s, cell, A6_FLOOR) : -1);

function startPush(s: RoundState, a: Stage6State, p: Player, cell: number): void {
  const dest = faceStep(cell, p.face);
  if (s.grid[dest] & 0x8000) return;
  const horiz = p.face === 2 || p.face === 6;
  let target: number, dist: number;
  if (horiz) { p.y = centerY(linOf(cell)); target = centerX(colOf(dest)); dist = target - p.x; }
  else { p.x = centerX(colOf(cell)); target = centerY(linOf(dest)); dist = target - p.y; }
  const sgn = Math.sign(dist);
  const ticks = Math.ceil(Math.abs(dist) / 512);
  p.push = { vx: horiz ? sgn * 512 : 0, vy: horiz ? 0 : sgn * 512, left: ticks };
  setAct(s, p, 'pushed', ticks);
  a.snap[p.slot] = target;
  a.snapAxis[p.slot] = horiz ? 0 : 1;
}

/** Arena 6: explosões repintam o piso ($C1:3DD9); pisos com efeito ($C2:1676, $C2:2F5F, $C1:39CF). */
export const stage6: StageModule = {
  init(s) {
    s.stageState = { counter: 64 + (rnd255(s) & 63), v: [0, 0, 0, 0], center: -1, snap: [-1, -1, -1, -1, -1], snapAxis: [0, 0, 0, 0, 0] };
  },
  onFlameCell(s, cell, armDir) {
    const a = st6(s);
    const k = armIndex(armDir);
    if (k === 4) {                                                // nova explosão: 4 sorteios antes de qualquer casa
      flushCenter(s, a);
      for (let i = 0; i < 4; i++) a.v[i] = (rnd255(s) & 15) || 1;
      a.center = cell;
      return;
    }
    if (a.v[k]) repaint(s, a, cell, a.v[k]);
  },
  tick(s) {
    const a = st6(s);
    flushCenter(s, a);
    a.v = [0, 0, 0, 0];
    for (const p of s.players) {
      const t = a.snap[p.slot];
      if (t < 0 || p.push.left > 0) continue;
      if (a.snapAxis[p.slot] === 0) p.x = t; else p.y = t;
      a.snap[p.slot] = -1;
    }
  },
  onStand(s, p, cell, ev) {
    if (!onGround(p)) return;
    const word = w(s, cell);
    if (word === 0x1c0c) {
      if (p.effect.kind === 0) stageEvent(ev, 'a6_reverse', { slot: p.slot });
      p.effect = { kind: 0x0a, left: 0x40 };
    } else if (word === 0x1c0a) {
      startPush(s, st6(s), p, cell);
    }
  },
  speedLevel(s, p, lv) {
    const c = playerCell(p);
    return c >= 0 && w(s, c) === 0x1c08 ? 7 : lv;
  },
  kickedBombEnter(s, _b, cell) { return w(s, cell) === 0x1c08 ? 'stop' : 'go'; },
  get ai() { return stage6Ai; },
};
```

Se a Task 1 (item 3) mostrou que o núcleo chama o centro **depois** dos braços, trocar o gatilho dos 4 sorteios para "1ª chamada de braço desde o último `flushCenter`" (guardar `a.v[0] === 0` como marcador) e manter o resto; o teste "4 sorteios por explosão" continua valendo com a ordem de chamada do núcleo.

- [ ] **Step 4: Implementar `core/ai/stages/stage6.ts`**

```ts
import type { AiStageHints } from '../hints';
import { CODE, type RoundState } from '../../types';
import { faceStep } from '../../units';
import { floorWord, playerCell, standing } from '../../stages/kit';
import { A6_FLOOR } from '../../stages/stage6';

const word = (s: RoundState, c: number): number =>
  s.grid[c] === CODE.FLOOR ? floorWord(s, c, A6_FLOOR) : -1;

/** Evitar caveira (1C0C) e listras (1C0A); bomba chutada para antes das caveirinhas (1C08). */
export const stage6Ai: AiStageHints = {
  avoid(s) {
    const out: number[] = [];
    for (let c = 0; c < s.grid.length; c++) { const w = word(s, c); if (w === 0x1c0c || w === 0x1c0a) out.push(c); }
    return out;
  },
  kickEnd(s, cell, face) {
    let c = cell;
    for (let i = 0; i < 16; i++) {
      const n = faceStep(c, face);
      const g = s.grid[n] ?? CODE.HARD;
      if (g & 0x8400 || (g & 0xefc0) === CODE.BOMB || word(s, n) === 0x1c08) return c;
      if (s.players.some(p => standing(p) && playerCell(p) === n)) return c;
      c = n;
    }
    return c;
  },
};
```

- [ ] **Step 5: Implementar `render/fallback/stages/stage6.ts`**

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { cellLeft, cellTop } from './geom';

const TINT: Record<number, string> = { 0x1c0a: '#e0c040', 0x1c0c: '#c040e0', 0x1c08: '#40c0e0' };

// Piso repintado: listras (amarelo), caveira (roxo), caveirinhas (ciano), meio transparente sobre o piso.
registerFallbackLayer({
  id: 'stage6',
  draw(s, ctx) {
    if (s.stage !== 6) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    s.floor.forEach((w, c) => {
      const t = TINT[w];
      if (!t || s.grid[c] !== CODE.FLOOR) return;
      ctx.fillStyle = t;
      ctx.fillRect(cellLeft(colOf(c)), cellTop(linOf(c)), 16, 16);
    });
    ctx.restore();
  },
});
```

- [ ] **Step 6: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/core/stages/stage6.ts web/src/core/ai/stages/stage6.ts web/src/render/fallback/stages/stage6.ts web/tests/stages/stage6.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 6 — repintura do piso pela ROM, listras, caveira, caveirinhas lentas e parada do chute

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

> Regra para todas as arenas com IA: o módulo expõe a dica por **getter** (`get ai() { return stageNAi; }`). O arquivo da IA importa helpers do módulo da arena e o módulo importa a IA; com o getter, a ordem de inicialização do ciclo de imports não importa.

### Task 8: Arena 7 "Esconde-Explode"

**Possui:** `web/src/core/stages/stage7.ts`, `web/src/core/ai/stages/stage7.ts`, `web/src/render/rom/stages/stage7.ts`, `web/src/render/fallback/stages/stage7.ts`, `web/tests/stages/stage7.test.ts`.

**Interfaces:**
- Consumes: `kit.{flameOver, standing, playerCell}`, `units`, `tables.A7_ARROWS`, núcleo do chute (plano 6 T7) nos testes.
- Produces: `stage7` (`init`, `tick`, `onFlameCell`, `kickedBombEnter`, `ai`), `ARROWS: {cell, face, word}[]`, `arrowAt(cell)`; `stage7Ai.kickEnd`; camadas `stage7` (ROM: palavras das setas; fallback: setas e moitas por cima).

As moitas são BG1 com prioridade 1 (o plano 7 já as desenha por cima dos sprites a partir do mapa da arena). A versão com setas giratórias e alçapões (`$C3:0E37`, `$C3:0D48`) não é usada no Battle.

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage7.test.ts`:

```ts
import { stage7, ARROWS } from '../../src/core/stages/stage7';
import { stage7Ai } from '../../src/core/ai/stages/stage7';
import { addBomb } from '../../src/core/bombs';
import { BTN, CODE } from '../../src/core/types';
import { cellOf, centerX, px } from '../../src/core/units';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage7';
import '../../src/render/fallback/stages/stage7';
import { stageArena, fullRound, put, run, setCell, codeAt, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 7: setas', () => {
  it('4 setas em circuito horário: (4,3) →, (4,9) ↑, (12,3) ↓, (12,9) ←', () => {
    expect(ARROWS.map(a => [a.cell, a.face, a.word])).toEqual([
      [cellOf(4, 3), 2, 0x1cc2], [cellOf(4, 9), 0, 0x1cc0], [cellOf(12, 3), 4, 0x1cc4], [cellOf(12, 9), 6, 0x1cc6]]);
  });
  it('rodada real: lógico 0040 nas 4 casas e 62 soft blocks', () => {
    const s = fullRound(7);
    for (const a of ARROWS) expect(s.grid[a.cell]).toBe(CODE.ARROW);
    expect(s.grid.filter(v => v === CODE.SOFT).length).toBe(62);
  });
  it('bomba chutada que entra na seta vira para a direção dela', () => {
    const s = stageArena(7);
    expect(stage7.kickedBombEnter!(s, null as never, cellOf(4, 3))).toEqual({ turn: 2 });
    expect(stage7.kickedBombEnter!(s, null as never, cellOf(5, 3))).toBe('go');
  });
  it('chute de ponta a ponta: para baixo em (4,2), vira em (4,3) para a direita, vira em (12,3) para baixo (b14)', () => {
    const s = stageArena(7, 1);
    const p = put(s, 0, 4, 1, 0, -6);                         // 6 px acima do centro: o chute dispara ao andar (máscara)
    p.kick = true;
    const b = addBomb(s, 0, cellOf(4, 2));
    const cells: number[] = [];
    for (let i = 0; i < 120 && s.bombs.includes(b); i++) {
      run(s, 1, i < 10 ? [BTN.DOWN, 0, 0, 0, 0] : [0, 0, 0, 0, 0]);
      if (cells[cells.length - 1] !== b.cell) cells.push(b.cell);
    }
    expect(cells).toContain(cellOf(5, 3));
    expect(cells).toContain(cellOf(12, 5));
    expect(cells).not.toContain(cellOf(4, 4));
  });
  it('jogador não é afetado pela seta', () => {
    const s = stageArena(7, 1);
    const p = put(s, 0, 4, 1);
    run(s, 70, [BTN.DOWN, 0, 0, 0, 0]);
    expect(px(p.x)).toBe(px(centerX(4)));
    expect(px(p.y)).toBeGreaterThan(16 * (5 + 2) - 1 - 16);
  });
  it('chama sobre a seta: vira FLAME (letal) e a seta volta quando a chama acaba (D16)', () => {
    const s = stageArena(7);
    stage7.onFlameCell!(s, cellOf(4, 3), 2, []);
    expect(codeAt(s, 4, 3)).toBe(CODE.FLAME);
    run(s, 26);
    expect(codeAt(s, 4, 3)).toBe(CODE.ARROW);
  });
});

describe('arena 7: IA e camadas', () => {
  it('kickEnd segue as setas: de (4,2) para baixo, com parede em (12,4), para em (12,3)', () => {
    const s = stageArena(7);
    setCell(s, 12, 4, CODE.HARD);
    expect(stage7Ai.kickEnd!(s, cellOf(4, 2), 4)).toBe(cellOf(12, 3));
  });
  it('ROM: palavra de cada seta no BG2, exceto sob chama', () => {
    const s = stageArena(7);
    setCell(s, 12, 9, CODE.FLAME);
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage7')!.draw(s, b, fakeAssets(), 0);
    expect([...calls.bg2.entries()].sort()).toEqual([['12,3', 0x1cc4], ['4,3', 0x1cc2], ['4,9', 0x1cc0]]);
  });
  it('fallback: setas e moitas', () => {
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage7')!.draw(stageArena(7), a.ctx, {} as never, 0);
    expect(a.log.filter(x => x === 'fill').length).toBeGreaterThanOrEqual(4);
    expect(a.log.filter(x => x === 'fillRect').length).toBe(36);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage7.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `core/stages/stage7.ts`**

```ts
import type { StageModule } from '../hooks';
import { CODE, type RoundState } from '../types';
import { cellOf } from '../units';
import { A7_ARROWS } from './tables';
import { flameOver } from './kit';
import { stage7Ai } from '../ai/stages/stage7';

/** Setas da arena 7 ($C3:0EFF, lista $C3:918E): face = palavra − 0x1CC0. */
export const ARROWS = A7_ARROWS.map(([c, l, w]) => ({ cell: cellOf(c, l), face: (w - 0x1cc0) as 0 | 2 | 4 | 6, word: w }));
export const arrowAt = (cell: number) => ARROWS.find(a => a.cell === cell);

function apply(s: RoundState): void {
  for (const a of ARROWS) if (s.grid[a.cell] === CODE.FLOOR) s.grid[a.cell] = CODE.ARROW;
}

/** Arena 7: setas desviam a bomba chutada; moitas são só visuais (BG1, plano 7). */
export const stage7: StageModule = {
  init(s) { apply(s); },
  tick(s) { apply(s); },                                  // devolve a seta quando a chama acaba (gancho $C1:534F)
  onFlameCell(s, cell, armDir) { if (s.grid[cell] === CODE.ARROW) flameOver(s, cell, armDir); },
  kickedBombEnter(_s, _b, cell) { const a = arrowAt(cell); return a ? { turn: a.face } : 'go'; },
  get ai() { return stage7Ai; },
};
```

- [ ] **Step 4: Implementar `core/ai/stages/stage7.ts`**

```ts
import type { AiStageHints } from '../hints';
import { CODE } from '../../types';
import { faceStep } from '../../units';
import { playerCell, standing } from '../../stages/kit';
import { arrowAt } from '../../stages/stage7';

/** Onde para a bomba chutada, seguindo as setas (§9 item 8). Para antes de $8400, bomba ou jogador de pé. */
export const stage7Ai: AiStageHints = {
  kickEnd(s, cell, face) {
    let c = cell, f = face;
    for (let i = 0; i < 64; i++) {
      const n = faceStep(c, f);
      const g = s.grid[n] ?? CODE.HARD;
      if (g & 0x8400 || (g & 0xefc0) === CODE.BOMB || s.players.some(p => standing(p) && playerCell(p) === n)) return c;
      c = n;
      const a = arrowAt(c);
      if (a) f = a.face;
    }
    return c;
  },
};
```

- [ ] **Step 5: Implementar as camadas**

`web/src/render/rom/stages/stage7.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { ARROWS } from '../../../core/stages/stage7';

// As setas não estão no mapa de piso: a ROM as repõe por gancho ($C1:534F). Sob chama/bomba, o plano 7 desenha o resto.
registerRomLayer({
  id: 'stage7',
  draw(s, b) {
    if (s.stage !== 7) return;
    for (const a of ARROWS) if (s.grid[a.cell] === CODE.ARROW) b.setBg2(colOf(a.cell), linOf(a.cell), a.word);
  },
});
```

`web/src/render/fallback/stages/stage7.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { ARROWS } from '../../../core/stages/stage7';
import { cellLeft, cellTop } from './geom';

/** Moitas (spec §4.6), em (col, lin): 36 casas. */
export const BUSHES: [number, number][] = [
  // (7–9, 2–3) + (8, 4)
  [7, 2], [8, 2], [9, 2], [7, 3], [8, 3], [9, 3], [8, 4],
  // (3–5, 5–7) + (3, 4) e (5, 4)
  [3, 5], [4, 5], [5, 5], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [3, 4], [5, 4],
  // (11–13, 5–7) + (11, 4) e (13, 4)
  [11, 5], [12, 5], [13, 5], [11, 6], [12, 6], [13, 6], [11, 7], [12, 7], [13, 7], [11, 4], [13, 4],
  // (7–9, 8–9) + (8, 10)
  [7, 8], [8, 8], [9, 8], [7, 9], [8, 9], [9, 9], [8, 10],
];

registerFallbackLayer({
  id: 'stage7',
  draw(s, ctx) {
    if (s.stage !== 7) return;
    for (const a of ARROWS) {
      if (s.grid[a.cell] !== CODE.ARROW) continue;
      const x = cellLeft(colOf(a.cell)) + 8, y = cellTop(linOf(a.cell)) + 8;
      const ang = (a.face / 2) * (Math.PI / 2);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = '#ffe070';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#2f7a2f';
    for (const [c, l] of BUSHES) ctx.fillRect(cellLeft(c), cellTop(l), 16, 16);
    ctx.restore();
  },
});
```

- [ ] **Step 6: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/core/stages/stage7.ts web/src/core/ai/stages/stage7.ts web/src/render/rom/stages/stage7.ts \
  web/src/render/fallback/stages/stage7.ts web/tests/stages/stage7.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 7 — setas que desviam a bomba chutada, chama sobre a seta e moitas no fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Arena 8 "Caça-Níquel" — máquina (pads, rolos, freio, resultado)

**Possui:** `web/src/core/stages/stage8.ts`, `web/src/core/ai/stages/stage8.ts`, `web/tests/stages/stage8.test.ts`.

**Interfaces:**
- Consumes: `kit` (`rnd255`, `flameOver`, `stageEvent`, `standing`, `playerCell`), `units`, `tables.{A8_PADS, A8_PRESET, A8_PRIZE}`, `state.{Reel, Stage8State}`, `stage8-prizes.{startPrize, tickPrize, tickFalls}` (esqueleto da T1; T10 preenche em paralelo).
- Produces: `stage8` (`init`, `tick`, `onFlameCell`, `ai`), `st8(s)`, `newStage8()`, `PADS`, `REEL_MASK = [4, 2, 1]`, `PAD_IDLE = 0x1c6e`, `PAD_LIT = 0x1c4e`, `sym(r)`, `stepReel(a, i): boolean`, `startMachine(s, a, i, ev)`; `stage8Ai.goals`.

Regras (D12, código `$C3:11F6…$C3:1413` e `$C3:19D1…$C3:1A82`):
- 1ª chamada (1º tick de `play`, D3): 3 × `pos = (rnd255 & 3)·8`, rolos 1, 2, 3; pads `1C6E`; máquina parada.
- Parada: todo tick, pads 1, 2, 3 nessa ordem; o 1º com `FLAME` e `cellT0 < tick` (D4) liga a máquina (`startMachine`). O rolo 1 é atualizado no tick seguinte.
- Girando: um rolo por tick (1, 2, 3, 1, …). Em cada atualização: freio (jogador de pé na casa do pad, 1 vez por volta da máquina), depois `stepReel`. Depois do rolo 3: SFX de alinhamento e, se os 3 pararam, o resultado.
- Depois de `nada` ou do fim de um prêmio, a máquina volta a parada e só confere os pads a partir do tick seguinte.
- Pads: lógico `PAD` (a arena devolve `PAD` quando o núcleo zera a chama, D16); palavra em `floor[pad]`: `1C6E` parada/freada, `1C4E` girando.

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage8.test.ts`:

```ts
import { stage8, st8, newStage8, stepReel, PADS, sym, PAD_IDLE, PAD_LIT } from '../../src/core/stages/stage8';
import { stage8Ai } from '../../src/core/ai/stages/stage8';
import { A8_PADS } from '../../src/core/stages/tables';
import { CODE } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { stageArena, fullRound, toPlay, put, run, runUntil, setCell, codeAt, stageEvents, mirror } from './kit';

function lightPad(s: ReturnType<typeof stageArena>, i: number): void {
  s.grid[PADS[i]] = CODE.FLAME;
  s.cellT0[PADS[i]] = s.tick;
}

describe('arena 8: carga e 1º tick [D1]', () => {
  it('golden: sem sorteio na carga ($C689); no 1º tick de play 3 sorteios → $C2F3, rolos em 16, 24, 16', () => {
    const s = fullRound(8);
    expect(s.rng.seed).toBe(0xc689);
    for (const c of PADS) expect(s.grid[c]).toBe(CODE.PAD);
    toPlay(s);
    expect(s.rng.seed).toBe(0xc2f3);
    expect(st8(s).reels.map(r => r.pos)).toEqual([16, 24, 16]);
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
    expect(PADS).toEqual(A8_PADS.map(([c, l]) => cellOf(c, l)));
  });
});

describe('arena 8: rolo [D12]', () => {
  it('sem freio: anda 1 passo por chamada; freio automático em 384; para alinhado com atraso ≥ 4 (411 chamadas, pos 16)', () => {
    const a = newStage8();
    let n = 0;
    while (!(a.stopped & 4) && n < 2000) { stepReel(a, 0); n++; }
    expect([n, a.reels[0].pos, a.reels[0].delay, a.reels[0].calls]).toEqual([411, 16, 5, 411]);
    expect(a.lastStopped).toBe(4);
    expect(sym(a.reels[0])).toBe(2);
  });
  it('freado na 1ª chamada (calls = 384, atraso 3) a partir de pos 16: para em 19 chamadas, pos 24', () => {
    const a = newStage8();
    Object.assign(a.reels[1], { pos: 16, calls: 384, delay: 3 });
    let n = 0;
    while (!(a.stopped & 2) && n < 200) { stepReel(a, 1); n++; }
    expect([n, a.reels[1].pos]).toEqual([19, 24]);
  });
});

describe('arena 8: máquina', () => {
  it('chama no pad 1 liga: rolo 1 em 0, os outros com A8_PRESET[rnd255 & 3]; pads acesos; rodízio 1 por tick', () => {
    const s = stageArena(8);
    const m = mirror(0x12);
    lightPad(s, 0);
    const ev = run(s, 1);                                         // tick 101: 1º tick (3 sorteios) e liga (1 sorteio)
    const a = st8(s);
    expect([m.rnd(0xff) & 3, m.rnd(0xff) & 3, m.rnd(0xff) & 3].map(v => v * 8)).toEqual([16, 24, 0]);
    expect(m.rnd(0xff) & 3).toBe(3);
    expect(s.rng.seed).toBe(m.seed());
    expect(a.phase).toBe('spin');
    expect(a.reels.map(r => r.calls)).toEqual([0, 0x4c, 0x20]);
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_LIT, PAD_LIT, PAD_LIT]);
    expect(stageEvents(ev, 'a8_start').map(e => e.cell)).toEqual([PADS[0]]);
    run(s, 3);
    expect(a.reels.map(r => r.calls)).toEqual([1, 0x4d, 0x21]);
  });
  it('chama criada neste tick só liga no próximo (D4)', () => {
    const s = stageArena(8);
    run(s, 1);
    s.grid[PADS[2]] = CODE.FLAME; s.cellT0[PADS[2]] = s.tick + 1;   // como se a chama nascesse no próximo passo de objetos
    run(s, 1);
    expect(st8(s).phase).toBe('idle');
  });
  it('todos os pads ocupados: cada rolo freia na 1ª atualização; resultado no tick 158 = (3, 0, 1) → nada', () => {
    const s = stageArena(8, 3);
    put(s, 0, 4, 7).inv = 400;                                    // de pé na chama do pad 1, invencível
    put(s, 1, 8, 7); put(s, 2, 12, 7);
    lightPad(s, 0);
    let brakes = 0;
    const t = runUntil(s, (_s, ev) => {
      brakes += stageEvents(ev, 'a8_brake').length;
      return stageEvents(ev).some(e => e.id === 'a8_nothing' || e.id === 'a8_prize');
    }, 400);
    const a = st8(s);
    expect(t).toBe(158);
    expect(brakes).toBe(3);
    expect(a.reels.map(r => r.pos)).toEqual([24, 0, 8]);
    expect(a.reels.map(sym)).toEqual([3, 0, 1]);
    expect(a.lastRoutine).toBe(0x14f7);
    expect(a.lastStopped).toBe(1);
    expect(a.phase).toBe('idle');
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
  });
  it('ninguém nos pads: resultado no tick 1334 = (0, 2, 2) → 3 caveiras ($14F9), último a parar = rolo 1', () => {
    const s = stageArena(8);
    lightPad(s, 0);
    const t = runUntil(s, (_s, ev) => stageEvents(ev).some(e => e.id === 'a8_prize' || e.id === 'a8_nothing'), 2000);
    const a = st8(s);
    expect(t).toBe(1334);
    expect(a.reels.map(sym)).toEqual([0, 2, 2]);
    expect(a.lastRoutine).toBe(0x14f9);
    expect(a.lastStopped).toBe(4);
  });
  it('chama sobre o pad vira FLAME (letal) e o pad volta depois da chama (D16)', () => {
    const s = stageArena(8);
    run(s, 1);
    stage8.onFlameCell!(s, PADS[1], 2, []);
    expect(codeAt(s, 8, 7)).toBe(CODE.FLAME);
    run(s, 26);
    expect(codeAt(s, 8, 7)).toBe(CODE.PAD);
  });
  it('IA: com a máquina girando, os pads dos rolos sem freio e não parados são alvos', () => {
    const s = stageArena(8);
    lightPad(s, 0);
    run(s, 1);
    st8(s).reels[1].braking = true;
    expect([...stage8Ai.goals!(s, 0)]).toEqual([PADS[0], PADS[2]]);
    st8(s).phase = 'idle';
    expect([...stage8Ai.goals!(s, 0)]).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage8.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `core/stages/stage8.ts`**

```ts
import type { StageModule } from '../hooks';
import { CODE, type GameEvent, type RoundState } from '../types';
import { cellOf } from '../units';
import type { Reel, Stage8State } from './state';
import { A8_PRESET, A8_PRIZE } from './tables';
import { flameOver, playerCell, rnd255, stageEvent, standing } from './kit';
import { startPrize, tickFalls, tickPrize } from './stage8-prizes';
import { stage8Ai } from '../ai/stages/stage8';

// ---- mantidos exatamente como no esqueleto da T1 (a T10, a T11 e a IA dependem deles) ----
/** Pads (4,7), (8,7), (12,7) = A8_PADS (conferido com a ROM no teste da T9). */
export const PADS = [cellOf(4, 7), cellOf(8, 7), cellOf(12, 7)];
export const REEL_MASK = [4, 2, 1];
export const PAD_IDLE = 0x1c6e;
export const PAD_LIT = 0x1c4e;
export const sym = (r: Reel): number => (r.pos >> 3) & 3;
export function newStage8(): Stage8State {
  const reel = (): Reel => ({ pos: 0, calls: 0, delay: 1, delayCnt: 0, braking: false });
  return { started: false, phase: 'idle', reels: [reel(), reel(), reel()], turn: 0, stopped: 0, lastStopped: 0,
    click: false, jackpotUsed: false, prize: null, falls: [], lastRoutine: 0 };
}
export const st8 = (s: RoundState): Stage8State => (s.stageState ??= newStage8()) as Stage8State;
// ---- fim do trecho do esqueleto ----

/** Um passo do rolo i ($C3:1A10…1A82). Devolve true se o rolo estava alinhado nesta chamada. */
export function stepReel(a: Stage8State, i: number): boolean {
  const r = a.reels[i];
  let aligned = false;
  if (++r.delayCnt >= r.delay) {
    r.delayCnt = 0;
    if ((r.pos & 6) === 0) {
      aligned = true;
      if (r.delay >= 4) {
        if (!(a.stopped & REEL_MASK[i])) a.lastStopped = REEL_MASK[i];
        a.stopped |= REEL_MASK[i];
      } else r.pos = (r.pos + 2) & 31;
    } else r.pos = (r.pos + 2) & 31;
  }
  if (++r.calls >= 384 && (r.calls & 7) === 0) r.delay++;
  return aligned;
}

function setPads(s: RoundState, word: number): void {
  for (const c of PADS) if (s.grid[c] !== CODE.PRESSURE) s.floor[c] = word;
}

/** Liga a máquina pelo pad i ($C3:12DA…132D). */
export function startMachine(s: RoundState, a: Stage8State, i: number, ev: GameEvent[]): void {
  a.reels[i].calls = 0;
  const pair = A8_PRESET[rnd255(s) & 3];
  const others = [0, 1, 2].filter(k => k !== i);
  a.reels[others[0]].calls = pair[0];
  a.reels[others[1]].calls = pair[1];
  for (const r of a.reels) { r.delay = 1; r.braking = false; }
  setPads(s, PAD_LIT);
  a.stopped = 0; a.lastStopped = 0; a.click = false; a.turn = 0; a.phase = 'spin';
  stageEvent(ev, 'a8_start', { cell: PADS[i] });
}

function brake(s: RoundState, a: Stage8State, i: number, ev: GameEvent[]): void {
  const r = a.reels[i];
  if (r.braking || !s.players.some(p => standing(p) && playerCell(p) === PADS[i])) return;
  r.braking = true;
  if (s.grid[PADS[i]] !== CODE.PRESSURE) s.floor[PADS[i]] = PAD_IDLE;
  stageEvent(ev, 'a8_brake', { cell: PADS[i] });
  if (r.calls < 384) { r.calls = 384; r.delay = 3; }
}

/** Arena 8: caça-níquel de 3 rolos ($C3:11C7). */
export const stage8: StageModule = {
  init(s) {
    s.stageState = newStage8();
    for (const c of PADS) { if (s.grid[c] === CODE.FLOOR || s.grid[c] === CODE.PAD) s.grid[c] = CODE.PAD; s.floor[c] = PAD_IDLE; }
  },
  onFlameCell(s, cell, armDir) { if (PADS.includes(cell) && s.grid[cell] === CODE.PAD) flameOver(s, cell, armDir); },
  tick(s, ev) {
    const a = st8(s);
    tickFalls(s, a, ev);
    if (!a.started) {
      a.started = true;
      for (const r of a.reels) r.pos = (rnd255(s) & 3) * 8;
      setPads(s, PAD_IDLE);
    }
    for (const c of PADS) if (s.grid[c] === CODE.FLOOR) s.grid[c] = CODE.PAD;
    if (a.phase === 'idle') {
      for (let i = 0; i < 3; i++) {
        if (s.grid[PADS[i]] === CODE.FLAME && s.cellT0[PADS[i]] < s.tick) { startMachine(s, a, i, ev); break; }
      }
      return;
    }
    if (a.phase === 'prize') {
      if (tickPrize(s, a, ev)) { a.prize = null; a.phase = 'idle'; }
      return;
    }
    const i = a.turn;
    a.turn = (i + 1) % 3;
    brake(s, a, i, ev);
    if (stepReel(a, i)) a.click = true;
    if (i !== 2) return;
    if (a.click) { stageEvent(ev, 'a8_click'); a.click = false; }
    if ((a.stopped & 7) !== 7) return;
    a.stopped = 0;
    const routine = A8_PRIZE[sym(a.reels[0]) * 16 + sym(a.reels[1]) * 4 + sym(a.reels[2])];
    a.lastRoutine = routine;
    setPads(s, PAD_IDLE);
    if (routine === 0x14f7) { a.phase = 'idle'; stageEvent(ev, 'a8_nothing'); return; }
    a.phase = 'prize';
    const before = ev.length;
    startPrize(s, a, routine, ev);
    // Com o esqueleto de stage8-prizes (T10 ainda não mesclada) o evento sai daqui; depois, de startPrize.
    if (!ev.slice(before).some(e => e.type === 'stage' && e.id === 'a8_prize')) stageEvent(ev, 'a8_prize');
  },
  get ai() { return stage8Ai; },
};
```

- [ ] **Step 4: Implementar `core/ai/stages/stage8.ts`**

```ts
import type { AiStageHints } from '../hints';
import { PADS, REEL_MASK, st8 } from '../../stages/stage8';

/** Pisar no pad para frear o rolo (§9 item 8): pads dos rolos girando, sem freio e não parados. */
export const stage8Ai: AiStageHints = {
  goals(s) {
    const a = st8(s);
    if (a.phase !== 'spin') return [];
    return PADS.filter((_, i) => !a.reels[i].braking && !(a.stopped & REEL_MASK[i]));
  },
};
```

- [ ] **Step 5: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS. Os números 158/1334, (3,0,1)/(0,2,2) e as posições vêm do modelo do código da ROM (`$C3:19D1`); se falharem, comparar `stepReel` com a ordem: atraso, alinhamento, parada, avanço, contagem.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/stages/stage8.ts web/src/core/ai/stages/stage8.ts web/tests/stages/stage8.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 8 — caça-níquel da ROM (pads, 3 rolos em rodízio, freio, parada e resultado)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: Arena 8 — prêmios (itens, ovos, bomba, chuva, jackpot)

**Possui:** `web/src/core/stages/stage8-prizes.ts`, `web/tests/stages/stage8-prizes.test.ts`.

**Interfaces:**
- Consumes: `kit` (`rnd`, `rnd255`, `stageEvent`, `landItem`, `landBomb`, `startJackpotPressure`, `eggsInPlay`, `cellAt`), `tables` (`A8_*`), `state.{Stage8State, PrizeRun, Fall}`. **Não** importa `stage8.ts` (para não depender da T9 em paralelo).
- Produces: `startPrize(s, a, routine, ev)`, `tickPrize(s, a, ev): boolean`, `tickFalls(s, a, ev)`, `colsFor(a)`, `FALL_START_Y = 64`.

Regras (D13; código `$C3:14D6…$C3:17FF`, `$C3:1852`, `$C3:188E`, `$C3:18C3…19D0`, `$C1:6873`, `$C1:1CC3`):

| Rotina | Fila (sorteios na hora do prêmio) | Lote | Extra |
|---|---|---|---|
| `14D6` | 1 × `A8_L149F[rnd(9)]` | 1 | – |
| `14F9` | 3 × `A8_L14A9[rnd(12)]` | 3 | – |
| `1526` | 3 × `A8_L14A9[rnd(12)]` | 3 | bomba 128 ticks depois do fim da fila |
| `15BF` | 12 × `A8_L14A9[rnd(12)]` | 3 | jackpot (1 vez por rodada) |
| `1611` | 3 × `A8_L14B6[rnd(7)]`, depois ovos | 3 | até 2 ovos |
| `163A` | ovos, depois `A8_L14BE` (3 × `$11`, sem sorteio) | 3 | até 2 ovos |
| `1662` | 6 × `A8_L14C1[rnd(3)]` | 3 | – |
| `1682` | `A8_L14C5` (9, sem sorteio) | 3 | – |
| `16A2` | 18 × `A8_L14CE[rnd(7)]`, depois ovos | 3 | até 2 ovos |
| `17AD` | ovos (colunas `A8_COLS_ALL`), depois chuva | – | 16 ondas |

- Ovo: se `eggsInPlay(s, ovos caindo) < 2`: tipo `A8_EGGS[rnd(14)]`, X = `cols[rnd255 & 3]`, cai como item (script `A8_FALL_PICK[rnd255 & 15]`). Duas tentativas.
- Fila: 48 ticks depois do prêmio sai o 1º lote; depois, um lote a cada 64. Cada item: X = `cols[colIdx++ % 4]` (cols = `colsFor(a)`: último rolo a parar), script `A8_FALL_PICK[rnd255 & 15]`, evento `a8_drop`. Fila vazia no momento do lote → fim (ou fase da bomba).
- Bomba (`1526`): 64 + 64 ticks depois do fim, X = `cols[rnd255 & 3]`, script `A8_BOMB_FALL[rnd255 & 7]`, fogo 4, sem dono.
- Chuva: 48 ticks, depois a cada 64: `n = rnd(3) + 3` itens `A8_RAIN[onda & 7]` em X de `A8_COLS_ALL` em rodízio; na 16ª onda, fim.
- Queda: começa em `Y = 64` no tick seguinte à criação, soma `A8_FALL_DY[script][i]` por tick (11 ticks) e aterrissa na casa de `(X, Y)`: item → `landItem`; bomba → `landBomb`.

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage8-prizes.test.ts` (dirige `tickFalls`/`tickPrize` direto, na mesma ordem do `stage8.tick`, para não depender da T9 em paralelo):

```ts
import { startPrize, tickPrize, tickFalls, colsFor } from '../../src/core/stages/stage8-prizes';
import { st8 } from '../../src/core/stages/stage8';
import type { Stage8State } from '../../src/core/stages/state';
import { A8_FALL_DY, A8_RAIN } from '../../src/core/stages/tables';
import { CODE, type GameEvent, type RoundState } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { stageArena, codeAt, setCell, stageEvents, mirror } from './kit';

function prizeArena(routine: number, lastStopped = 4, tick = 100) {
  const s = stageArena(8);
  s.tick = tick;
  const a = st8(s);
  a.started = true; a.phase = 'prize'; a.lastStopped = lastStopped;
  const ev: GameEvent[] = [];
  startPrize(s, a, routine, ev);
  return { s, a, ev };
}
/** n ticks do caça-níquel em prêmio: quedas e depois o prêmio (ordem de stage8.tick). */
function advance(s: RoundState, a: Stage8State, n: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    s.tick++;
    tickFalls(s, a, out);
    if (a.phase === 'prize' && tickPrize(s, a, out)) { a.prize = null; a.phase = 'idle'; }
  }
  return out;
}
const fallTotal = (script: number): number => A8_FALL_DY[script].reduce((x, y) => x + y, 0);

describe('arena 8: prêmios [D13]', () => {
  it('$14F9: 3 caveiras sorteadas (24, 24, 2A); SFX do prêmio; 1º lote aos 48 ticks nas colunas do rolo 1', () => {
    const { s, a, ev } = prizeArena(0x14f9);
    expect(a.prize!.queue).toEqual([0x24, 0x24, 0x2a]);
    expect(s.rng.seed).toBe(0xc581);
    expect(stageEvents(ev, 'a8_prize').length).toBe(1);
    advance(s, a, 47);
    expect(a.falls.length).toBe(0);
    const e2 = advance(s, a, 1);                                   // tick 148
    expect(stageEvents(e2, 'a8_drop').length).toBe(3);
    expect(a.falls.map(f => [f.id, f.x, f.y, fallTotal(f.script)])).toEqual([[0x24, 48, 64, 16], [0x24, 64, 64, 64], [0x2a, 80, 64, 96]]);
    expect(s.rng.seed).toBe(0x331b);
    advance(s, a, 11);                                             // tick 159: aterrissam
    expect(codeAt(s, 3, 3)).toBe(itemCode(0x24));
    expect(codeAt(s, 4, 6)).toBe(itemCode(0x24));
    expect(s.flyers.some(f => f.kind === 'item' && f.ref === 0x2a)).toBe(true);   // (5,8) é pilar: quica
    advance(s, a, 53);                                             // tick 212: fila vazia → fim
    expect(a.phase).toBe('idle');
  });
  it('colunas pelo último rolo a parar: 1 → 48/64/80, 2 → 112/128/144, 3 → 176/192/208', () => {
    const a = st8(stageArena(8));
    a.lastStopped = 4; expect(colsFor(a)).toEqual([48, 64, 80, 64]);
    a.lastStopped = 2; expect(colsFor(a)).toEqual([112, 128, 144, 128]);
    a.lastStopped = 1; expect(colsFor(a)).toEqual([176, 192, 208, 192]);
  });
  it('$1611: 3 itens (01, 05, 0E) e 2 ovos já caindo (33 em X 64, 3F em X 80)', () => {
    const { s, a } = prizeArena(0x1611);
    expect(a.prize!.queue).toEqual([0x01, 0x05, 0x0e]);
    expect(a.falls.map(f => [f.id, f.x, fallTotal(f.script)])).toEqual([[0x33, 64, 96], [0x3f, 80, 64]]);
    expect(s.rng.seed).toBe(0x9b59);
  });
  it('teto de ovos: com 2 ovos no chão, nenhum ovo e nenhum sorteio de ovo', () => {
    const s = stageArena(8);
    setCell(s, 5, 5, 0x0972); setCell(s, 7, 5, 0x097c);
    const a = st8(s); a.started = true; a.phase = 'prize'; a.lastStopped = 4;
    const m = mirror(s.rng.seed);
    startPrize(s, a, 0x1611, []);
    expect(a.falls.length).toBe(0);
    m.rnd(7); m.rnd(7); m.rnd(7);
    expect(s.rng.seed).toBe(m.seed());
  });
  it('$163A: 3 × item $11 sem sorteio na fila', () => {
    expect(prizeArena(0x163a).a.prize!.queue).toEqual([0x11, 0x11, 0x11]);
  });
  it('$1682: 03 04 03 03 04 03 03 04 03 em 3 lotes (+48, +112, +176) e fim em +240', () => {
    const { s, a } = prizeArena(0x1682);
    expect(a.prize!.queue).toEqual([3, 4, 3, 3, 4, 3, 3, 4, 3]);
    const drops: number[] = [];
    for (let i = 0; i < 240; i++) if (stageEvents(advance(s, a, 1), 'a8_drop').length) drops.push(s.tick - 100);
    expect(drops).toEqual([48, 112, 176]);
    expect(a.phase).toBe('idle');
  });
  it('$1526: bomba de fogo 4 cai 128 ticks depois do fim da fila (+240) e vira bomba sem dono', () => {
    const { s, a } = prizeArena(0x1526);
    advance(s, a, 239);
    expect(a.falls.some(f => f.kind === 'bomb')).toBe(false);
    advance(s, a, 1);
    expect(a.falls.filter(f => f.kind === 'bomb').map(f => f.born)).toEqual([340]);
    expect(a.phase).toBe('idle');
    advance(s, a, 12);
    expect(s.bombs.some(b => b.fire === 4 && b.owner === -1)).toBe(true);
  });
  it('$15BF: 12 caveiras e pressão total (143 passos) uma vez por rodada', () => {
    const { s, a } = prizeArena(0x15bf, 4, 400);
    expect(a.prize!.queue.length).toBe(12);
    expect(s.pressure.total).toBe(143);
    expect(s.pressure.trigger).toBe(400 - 191);
    expect(a.jackpotUsed).toBe(true);
    s.pressure.trigger = -1; s.pressure.total = 80;
    startPrize(s, a, 0x15bf, []);
    expect([s.pressure.trigger, s.pressure.total]).toEqual([-1, 80]);
  });
  it('$17AD: 16 ondas a cada 64 ticks (a 1ª em +48), 3–5 itens iguais A8_RAIN[onda & 7], depois parada', () => {
    const { s, a } = prizeArena(0x17ad);
    for (let k = 0; k < 16; k++) {
      advance(s, a, k === 0 ? 48 : 64);
      const fresh = a.falls.filter(f => f.born === s.tick && f.kind === 'item');
      expect(fresh.length, `onda ${k}`).toBeGreaterThanOrEqual(3);
      expect(fresh.length, `onda ${k}`).toBeLessThanOrEqual(5);
      expect(fresh.every(f => f.id === A8_RAIN[k & 7]), `onda ${k}`).toBe(true);
    }
    expect(a.phase).toBe('idle');
  });
  it('item que cai em casa queimando some', () => {
    const { s, a } = prizeArena(0x14d6);
    advance(s, a, 48);
    const f = a.falls[0];
    const lin = 2 + fallTotal(f.script) / 16;
    const col = Math.floor((f.x + 8) / 16);
    setCell(s, col, lin, CODE.BURNING);
    advance(s, a, 11);
    expect(codeAt(s, col, lin)).toBe(CODE.BURNING);
    expect(s.flyers.length).toBe(0);
    expect(cellOf(col, lin)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage8-prizes.test.ts`
Expected: FAIL (esqueleto).

- [ ] **Step 3: Implementar `core/stages/stage8-prizes.ts`**

```ts
import { type GameEvent, type RoundState } from '../types';
import { cellAt } from '../units';
import type { Fall, PrizeRun, Stage8State } from './state';
import {
  A8_BOMB_FALL, A8_COLS, A8_COLS_ALL, A8_EGGS, A8_FALL_DY, A8_FALL_PICK, A8_L149F, A8_L14A9, A8_L14B6, A8_L14BE,
  A8_L14C1, A8_L14C5, A8_L14CE, A8_RAIN,
} from './tables';
import { eggsInPlay, landBomb, landItem, rnd, rnd255, stageEvent, startJackpotPressure } from './kit';

export const FALL_START_Y = 64;           // $C1:68A9: Y = $50 − 16

/** Colunas de queda pelo último rolo a parar ($C3:188E). */
export const colsFor = (a: Stage8State): readonly number[] =>
  a.lastStopped & 4 ? A8_COLS[0] : a.lastStopped & 2 ? A8_COLS[1] : A8_COLS[2];

const pick = (s: RoundState, list: readonly number[], n: number): number[] =>
  Array.from({ length: n }, () => list[rnd(s.rng, list.length)]);

function drop(s: RoundState, a: Stage8State, kind: Fall['kind'], id: number, x: number, ev: GameEvent[],
  table: readonly number[] = A8_FALL_PICK, mask = 15): void {
  a.falls.push({ kind, id, x, y: FALL_START_Y, script: table[rnd255(s) & mask], i: 0, born: s.tick });
  stageEvent(ev, 'a8_drop');
}

function dropQueued(s: RoundState, a: Stage8State, P: PrizeRun, id: number, cols: readonly number[], ev: GameEvent[]): void {
  drop(s, a, 'item', id, cols[P.colIdx++ % cols.length], ev);
}

/** $C3:18C3 / $C3:18F3: até 2 ovos, se houver vaga (teto 2, 🟡). */
function eggs(s: RoundState, a: Stage8State, cols: readonly number[], ev: GameEvent[]): void {
  for (let k = 0; k < 2; k++) {
    const falling = a.falls.filter(f => f.kind === 'item' && f.id >= 0x30 && f.id <= 0x3f).length;
    if (eggsInPlay(s, falling) >= 2) return;
    const type = A8_EGGS[rnd(s.rng, 14)];
    drop(s, a, 'item', type, cols[rnd255(s) & 3], ev);
  }
}

export function startPrize(s: RoundState, a: Stage8State, routine: number, ev: GameEvent[]): void {
  const P: PrizeRun = { routine, queue: [], next: 0, batch: 3, wait: 48, colIdx: 0, after: 'idle', bombPhase: 0, rain: null };
  a.prize = P;
  stageEvent(ev, 'a8_prize');
  switch (routine) {
    case 0x14d6: P.queue = pick(s, A8_L149F, 1); P.batch = 1; break;
    case 0x14f9: P.queue = pick(s, A8_L14A9, 3); break;
    case 0x1526: P.queue = pick(s, A8_L14A9, 3); P.after = 'bomb'; break;
    case 0x15bf:
      P.queue = pick(s, A8_L14A9, 12);
      if (!a.jackpotUsed) { a.jackpotUsed = true; startJackpotPressure(s); }
      break;
    case 0x1611: P.queue = pick(s, A8_L14B6, 3); eggs(s, a, colsFor(a), ev); break;
    case 0x163a: eggs(s, a, colsFor(a), ev); P.queue = [...A8_L14BE]; break;
    case 0x1662: P.queue = pick(s, A8_L14C1, 6); break;
    case 0x1682: P.queue = [...A8_L14C5]; break;
    case 0x16a2: P.queue = pick(s, A8_L14CE, 18); eggs(s, a, colsFor(a), ev); break;
    case 0x17ad: eggs(s, a, A8_COLS_ALL, ev); P.rain = { wave: 0, itemIdx: 0 }; break;
  }
}

/** true = acabou (a máquina volta a parada). */
export function tickPrize(s: RoundState, a: Stage8State, ev: GameEvent[]): boolean {
  const P = a.prize;
  if (!P) return true;
  if (P.rain) {
    if (--P.wait > 0) return false;
    const n = rnd(s.rng, 3) + 3;
    const item = A8_RAIN[P.rain.itemIdx];
    for (let k = 0; k < n; k++) dropQueued(s, a, P, item, A8_COLS_ALL, ev);
    P.wait = 64;
    P.rain.itemIdx = (P.rain.itemIdx + 1) & 7;
    return ++P.rain.wave >= 16;
  }
  if (P.bombPhase) {
    if (--P.wait > 0) return false;
    if (P.bombPhase === 1) { P.bombPhase = 2; P.wait = 64; return false; }
    drop(s, a, 'bomb', 0, colsFor(a)[rnd255(s) & 3], ev, A8_BOMB_FALL, 7);
    return true;
  }
  if (--P.wait > 0) return false;
  for (let k = 0; k < P.batch; k++) {
    if (P.next >= P.queue.length) {
      if (P.after === 'bomb') { P.bombPhase = 1; P.wait = 64; return false; }
      return true;
    }
    dropQueued(s, a, P, P.queue[P.next++], colsFor(a), ev);
  }
  P.wait = 64;
  return false;
}

/** Quedas: 11 ticks de script a partir do tick seguinte à criação; depois aterrissam. */
export function tickFalls(s: RoundState, a: Stage8State, ev: GameEvent[]): void {
  for (const f of [...a.falls]) {
    if (f.born === s.tick) continue;
    const dy = A8_FALL_DY[f.script];
    f.y += dy[f.i++];
    if (f.i < dy.length) continue;
    a.falls.splice(a.falls.indexOf(f), 1);
    const cell = cellAt(f.x * 256, f.y * 256);
    if (f.kind === 'item') landItem(s, f.id, cell); else landBomb(s, cell, ev);
  }
}
```

Ordem de RNG dentro do mesmo tick: sorteio da fila → ovos → scripts de queda na ordem de criação. O script do item é sorteado na criação (na ROM, no 1º passo do objeto; nada consome RNG entre os dois, 🟡).

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS. O teste da bomba depende do item 9 da Task 1 (dono −1); se a guarda ainda não existir no núcleo, marcar só a última asserção como `it.todo` e registrar no PR.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/stages/stage8-prizes.ts web/tests/stages/stage8-prizes.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 8 — prêmios do caça-níquel (quedas por coluna, ovos, bomba do 1526, chuva e jackpot)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 11: Arena 8 — desenho (ROM e fallback)

**Possui:** `web/src/render/rom/stages/stage8.ts`, `web/src/render/fallback/stages/stage8.ts`, `web/tests/stages/render-stage8.test.ts`.

**Interfaces:**
- Consumes: `stage8` (esqueleto da T1: `st8`, `PADS`, `PAD_IDLE`, `sym`), `state`, `tables.A8_REEL_ROWS`, `romkit` (`assetsOf`, `animFrameAt`, `decodeZteAt`), `geom`.
- Produces: camadas `stage8`; funções puras `reelRowSources(pos): number[]`, `tile4bpp(buf, off): Uint8Array`, `reelWindowPx(strip, pos): Uint8Array` (16×32 índices).

O que a ROM mostra (D12, D18, ARN §3.1/§3.2):
- Cor 0 da paleta de fundo = `$0000` (`cgram(0, 0)`).
- Pads: palavra `floor[pad]` (`1C6E`/`1C4E`) quando a casa tem `PAD`.
- Rolos: cada rolo é uma janela 16×32 px. A linha *k* (0..3, 8 px) do rolo com posição `pos` é a linha `A8_REEL_ROWS[(pos/2 + k) & 15]` da fita decodificada em `$7F:9000` (64 bytes = 2 tiles 4bpp lado a lado; o endereço da tabela menos `$9000` é o *offset* na fita). A fita é o bloco ZTE que o script gráfico da arena 8 envia para `$7F:9000` (o 4º bloco da lista, `$D3:817E`, 🟡: conferir no Step 4). A janela de cada rolo fica onde o mapa BG da arena 8 usa os tiles `$104`/`$106`/`$108` (canto de cima de cada rolo); desenhar como 2 sprites 16×16 (`src.px`) com prioridade 3 e paleta OBJ 3, copiando para `cgram(128 + 48 + i)` as 16 cores da paleta BG daquela entrada do mapa.
- Quedas: itens e ovos com a animação `$D8:D3AF`, bomba com `$D8:D3A8` (objetos `$C1:6873` e `$C1:1CC3`, atributo `$0E` = paleta OBJ 7), prioridade 2, na posição `(x, y)` da queda (🟡 visual).

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/render-stage8.test.ts`:

```ts
import { reelRowSources, tile4bpp, reelWindowPx } from '../../src/render/rom/stages/stage8';
import '../../src/render/fallback/stages/stage8';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import { st8, PADS, PAD_IDLE } from '../../src/core/stages/stage8';
import { CODE } from '../../src/core/types';
import { stageArena, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 8: desenho', () => {
  it('linhas da janela do rolo: pos 0 → 9680 9480 9280 9080; pos 30 dá a volta', () => {
    expect(reelRowSources(0)).toEqual([0x9680, 0x9480, 0x9280, 0x9080]);
    expect(reelRowSources(30)).toEqual([0x90c0, 0x9680, 0x9480, 0x9280]);
  });
  it('tile 4bpp planar: plano 0 da linha 0 = $80 → pixel (0,0) = 1; plano 3 da linha 7 = $01 → pixel (7,7) = 8', () => {
    const b = new Uint8Array(32);
    b[0] = 0x80; b[16 + 15] = 0x01;
    const t = tile4bpp(b, 0);
    expect([t[0], t[63], t[1]]).toEqual([1, 8, 0]);
  });
  it('janela 16×32: a linha k vem da fita no offset (fonte − $9000), 2 tiles lado a lado', () => {
    const strip = new Uint8Array(0x800);
    strip[0x680] = 0x80;                 // linha 0 (fonte $9680), tile esquerdo, plano 0, 1º pixel
    strip[0x480 + 32] = 0x80;            // linha 1 (fonte $9480), tile direito, plano 0, 1º pixel
    const px = reelWindowPx(strip, 0);
    expect(px.length).toBe(16 * 32);
    expect([px[0], px[8 * 16 + 8], px[1]]).toEqual([1, 1, 0]);
  });
  /** Arena 8 com pads na grade (a T9 roda em paralelo: não depender do init dela). */
  const arena8 = () => { const s = stageArena(8); for (const c of PADS) s.grid[c] = CODE.PAD; return s; };
  it('ROM: cor 0 = $0000, palavra dos pads, 1 sprite por peça de cada queda', () => {
    const s = arena8();
    const a = st8(s);
    a.falls.push({ kind: 'item', id: 1, x: 48, y: 64, script: 0x69c4, i: 0, born: 0 });
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage8')!.draw(s, b, fakeAssets(), 0);
    expect(calls.cgram.get(0)).toBe(0);
    expect(PADS.map(c => calls.bg2.get(`${c % 17},${Math.floor(c / 17)}`))).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
    expect(calls.sprites.filter(x => x.e.x === 40 && x.e.y === 56).length).toBe(1);
  });
  it('ROM: pad sob chama não recebe palavra', () => {
    const s = arena8();
    s.grid[PADS[0]] = CODE.FLAME;
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage8')!.draw(s, b, fakeAssets(), 0);
    expect(calls.bg2.has('4,7')).toBe(false);
  });
  it('fallback: pads, rolos e quedas', () => {
    const s = arena8();
    st8(s).falls.push({ kind: 'bomb', id: 0, x: 64, y: 70, script: 0x745c, i: 0, born: 0 });
    const c = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage8')!.draw(s, c.ctx, {} as never, 0);
    expect(c.log.filter(x => x === 'fillRect').length).toBeGreaterThanOrEqual(6);
    expect(c.log).toContain('arc');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/render-stage8.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`web/src/render/rom/stages/stage8.ts`:

```ts
import { registerRomLayer, type RomBattleBuilder } from '../../battle-layers';
import { CODE, type RoundState } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { st8, PADS, PAD_IDLE } from '../../../core/stages/stage8';
import { A8_REEL_ROWS } from '../../../core/stages/tables';
import { animFrameAt, assetsOf, decodeZteAt, type StageRomAssets } from './romkit';

export const REEL_STRIP = 0xd3817e;     // 🟡 bloco que o script gráfico da arena 8 manda para $7F:9000
export const ITEM_FALL_ANIM = 0xd8d3af;
export const BOMB_FALL_ANIM = 0xd8d3a8;

export const reelRowSources = (pos: number): number[] => [0, 1, 2, 3].map(k => A8_REEL_ROWS[((pos >> 1) + k) & 15]);

/** Tile 4bpp planar SNES (32 bytes) → 64 índices. */
export function tile4bpp(b: Uint8Array, off: number): Uint8Array {
  const out = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    const p0 = b[off + 2 * y], p1 = b[off + 2 * y + 1], p2 = b[off + 16 + 2 * y], p3 = b[off + 17 + 2 * y];
    for (let x = 0; x < 8; x++) {
      const m = 0x80 >> x;
      out[y * 8 + x] = (p0 & m ? 1 : 0) | (p1 & m ? 2 : 0) | (p2 & m ? 4 : 0) | (p3 & m ? 8 : 0);
    }
  }
  return out;
}

/** Janela do rolo (16×32 índices): 4 linhas de 8 px, cada uma com 2 tiles lado a lado da fita. */
export function reelWindowPx(strip: Uint8Array, pos: number): Uint8Array {
  const out = new Uint8Array(16 * 32);
  reelRowSources(pos).forEach((src, k) => {
    const off = src - 0x9000;
    for (let t = 0; t < 2; t++) {
      const tile = tile4bpp(strip, off + 32 * t);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[(k * 8 + y) * 16 + t * 8 + x] = tile[y * 8 + x];
    }
  });
  return out;
}

let stripCache: { a: object; strip: Uint8Array | null } | null = null;
function strip(a: StageRomAssets): Uint8Array | null {
  if (stripCache?.a !== a) {
    let v: Uint8Array | null = null;
    try { v = decodeZteAt(a, REEL_STRIP); } catch { v = null; }
    stripCache = { a, strip: v };
  }
  return stripCache.strip;
}

/** Janelas dos rolos: entradas do mapa (BG1 ou BG2) com tile $104/$106/$108. */
function reelWindows(a: StageRomAssets & { arena?: (n: number) => { bg1: Uint16Array; bg2Base: Uint16Array; bgCgram: Uint16Array } }) {
  const ar = a.arena?.(8);
  if (!ar) return null;
  const found: { x: number; y: number; pal: number }[] = [];
  for (const tileTop of [0x104, 0x106, 0x108]) {
    let hit: { x: number; y: number; pal: number } | null = null;
    for (const map of [ar.bg1, ar.bg2Base]) {
      for (let i = 0; i < 1024 && !hit; i++) if ((map[i] & 0x3ff) === tileTop) hit = { x: 16 * (i & 31) - 8, y: 16 * (i >> 5) + 24, pal: (map[i] >> 10) & 7 };
      if (hit) break;
    }
    if (!hit) return null;
    found.push(hit);
  }
  return { found, cg: ar.bgCgram };
}

function drawReels(s: RoundState, b: RomBattleBuilder, a: StageRomAssets): void {
  const w = reelWindows(a as never);
  const st = strip(a);
  if (!w || !st) return;
  for (let i = 0; i < 16; i++) b.cgram(128 + 48 + i, w.cg[w.found[0].pal * 16 + i]);
  st8(s).reels.forEach((r, i) => {
    const px = reelWindowPx(st, r.pos);
    for (let half = 0; half < 2; half++) {
      b.sprite({ x: w.found[i].x, y: w.found[i].y + 16 * half, size: 16, pal: 3, prio: 3, hflip: false, vflip: false,
        src: { px: px.slice(half * 256, half * 256 + 256) } }, 0, 200 + 2 * i + half);
    }
  });
}

registerRomLayer({
  id: 'stage8',
  draw(s, b, a0) {
    if (s.stage !== 8) return;
    const a = assetsOf(a0);
    b.cgram(0, 0x0000);
    for (const c of PADS) if (s.grid[c] === CODE.PAD) b.setBg2(colOf(c), linOf(c), s.floor[c] || PAD_IDLE);
    drawReels(s, b, a);
    st8(s).falls.forEach((f, n) => {
      const fr = animFrameAt(a.anim(f.kind === 'bomb' ? BOMB_FALL_ANIM : ITEM_FALL_ANIM), s.tick);
      for (const pc of fr.pieces) {
        b.sprite({ x: f.x + pc.dx, y: f.y + pc.dy, size: pc.big ? 32 : 16, pal: (7 + pc.palAdd) & 7, prio: 2,
          hflip: pc.hflip, vflip: pc.vflip, src: { tile: pc.tile } }, f.y, 150 + n);
      }
    });
  },
});
```

Notas: `src.px` 16×16 = 256 índices por metade; a PPU do plano 5 usa a paleta `pal` do sprite para `src.px`. Se `RomAssets` não expuser `arena(n)` com `bg1/bg2Base/bgCgram` (Task 1, item 11), os rolos não são desenhados e o PR registra isso.

`web/src/render/fallback/stages/stage8.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { st8, PADS, sym, PAD_LIT } from '../../../core/stages/stage8';
import { cellLeft, cellTop, scrX, scrY } from './geom';

const SYM_COLOR = ['#e04040', '#40c040', '#4080ff', '#ffd040'];

registerFallbackLayer({
  id: 'stage8',
  draw(s, ctx) {
    if (s.stage !== 8) return;
    const a = st8(s);
    for (const c of PADS) {
      if (s.grid[c] !== CODE.PAD) continue;
      ctx.fillStyle = s.floor[c] === PAD_LIT ? '#ffe060' : '#806020';
      ctx.fillRect(cellLeft(colOf(c)) + 3, cellTop(linOf(c)) + 3, 10, 10);
    }
    a.reels.forEach((r, i) => {                         // 3 janelas na parede de cima, cols 7..9
      ctx.fillStyle = '#101010';
      ctx.fillRect(cellLeft(7 + i), cellTop(0), 16, 16);
      ctx.fillStyle = SYM_COLOR[sym(r)];
      ctx.fillRect(cellLeft(7 + i) + 4, cellTop(0) + 4, 8, 8);
    });
    for (const f of a.falls) {
      ctx.fillStyle = f.kind === 'bomb' ? '#202020' : '#f0f0f0';
      ctx.beginPath(); ctx.arc(scrX(f.x), scrY(f.y), 5, 0, Math.PI * 2); ctx.fill();
    }
  },
});
```

- [ ] **Step 4: Conferir a fita dos rolos com a ROM**

Run: `cd web && SB4_ROM="…/Super Bomberman 4 (USA).sfc" npm run snap` e abrir o screenshot da arena 8 (modo ROM). Os 3 rolos devem mostrar símbolos inteiros e alinhados com `sym(r)` depois da parada. Se estiverem errados, localizar a fonte de `$7F:9000` com o emulador: `analise/investigacao/mecanicas/py` com `Dbg("st_stage07")`, `bp(0xC409A5)` e ler o ponteiro de origem no tick em que `$C4:09E2` escreve em `$7F:9000` (o quadro medido para este plano foi o 366 depois do A na seleção de fase); trocar `REEL_STRIP` e registrar no PR.

- [ ] **Step 5: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/render/rom/stages/stage8.ts web/src/render/fallback/stages/stage8.ts web/tests/stages/render-stage8.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 8 — desenho dos pads, rolos e quedas (ROM e fallback)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: Arena 9 "Gangorra"

**Possui:** `web/src/core/stages/stage9.ts`, `web/src/core/ai/stages/stage9.ts`, `web/src/render/rom/stages/stage9.ts`, `web/src/render/fallback/stages/stage9.ts`, `web/tests/stages/stage9.test.ts`.

**Interfaces:**
- Consumes: `kit` (`setAct`, `standing`, `playerCell`, `stageEvent`, `wrapPx`, `px`), `units`, `tables.{A9_SAWS, A9_PAL}`, `state.{Seesaw, Jump, Stage9State}`, `romkit.writePaletteFrame`.
- Produces: `stage9` (`init`, `onEnterCell`, `tick`, `ai`), `st9(s)`, `upEnd(w)`, `sawWords(w, tick)`, `JUMP_DY`, `HOP_DX`, `HOP_DY`; `stage9Ai.avoid`; camadas `stage9`.

Regras (D15). O lançado fica com `act = 'launched'` travado (`actLeft` grande) e a arena move `p.x`/`p.y` diretamente (a ROM muda o Y do jogador, não uma altura).

- [ ] **Step 1: Escrever os testes**

`web/tests/stages/stage9.test.ts`:

```ts
import { stage9, st9, upEnd, sawWords, JUMP_DY } from '../../src/core/stages/stage9';
import { stage9Ai } from '../../src/core/ai/stages/stage9';
import { BTN, CODE } from '../../src/core/types';
import { cellOf, px } from '../../src/core/units';
import { playerCell } from '../../src/core/state';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage9';
import '../../src/render/fallback/stages/stage9';
import { stageArena, put, run, stageEvents, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 9: gangorras [D15]', () => {
  it('4 gangorras de 3 casas; esquerda estado 0 (ponta de cima B), direita estado 1 (ponta de cima A)', () => {
    const s = stageArena(9);
    const w = st9(s).saws;
    expect(w.map(x => [x.a, x.b, x.state])).toEqual([
      [cellOf(4, 3), cellOf(6, 3), 0], [cellOf(4, 9), cellOf(6, 9), 0], [cellOf(10, 3), cellOf(12, 3), 1], [cellOf(10, 9), cellOf(12, 9), 1]]);
    expect(w.map(upEnd)).toEqual([cellOf(6, 3), cellOf(6, 9), cellOf(10, 3), cellOf(10, 9)]);
    for (const c of [cellOf(4, 3), cellOf(5, 3), cellOf(6, 3)]) expect(s.grid[c]).toBe(CODE.FLOOR);
  });
  it('palavras: estado 0 08EC 48E2 48E0; estado 1 08E0 08E2 08E4; transição 08E6 08E8 08EA por 2 ticks', () => {
    const w = { a: 0, b: 2, state: 0 as 0 | 1, transUntil: 0 };
    expect(sawWords(w, 10)).toEqual([0x08ec, 0x48e2, 0x48e0]);
    w.state = 1;
    expect(sawWords(w, 10)).toEqual([0x08e0, 0x08e2, 0x08e4]);
    w.transUntil = 12;
    expect(sawWords(w, 10)).toEqual([0x08e6, 0x08e8, 0x08ea]);
    expect(sawWords(w, 11)).toEqual([0x08e6, 0x08e8, 0x08ea]);
    expect(sawWords(w, 12)).toEqual([0x08e0, 0x08e2, 0x08e4]);
  });
  it('entrar na ponta de cima lança quem está na outra: pulo de 14 ticks com o perfil medido; depois vai e volta', () => {
    const s = stageArena(9);
    const p1 = put(s, 1, 4, 3);                                   // P2 na ponta A
    const p0 = put(s, 0, 6, 4);                                   // P1 sobe para a ponta B (de cima no estado 0)
    const launches: [number, number][] = [];
    const ys: number[] = [];
    let t0 = -1;
    for (let i = 0; i < 80; i++) {
      const ev = run(s, 1, st => (playerCell(st.players[0]) === cellOf(6, 3) ? [0, 0, 0, 0, 0] : [BTN.UP, 0, 0, 0, 0]));
      for (const e of stageEvents(ev, 'a9_launch')) { launches.push([s.tick, e.slot!]); if (t0 < 0) t0 = s.tick; }
      if (t0 >= 0 && s.tick > t0 && s.tick <= t0 + 15) ys.push(px(p1.y) - 79);   // centro da lin 3 = 79
    }
    expect(launches.slice(0, 3).map(([, slot]) => slot)).toEqual([1, 0, 1]);
    expect(launches[1][0] - launches[0][0]).toBe(15);
    expect(launches[2][0] - launches[1][0]).toBe(15);
    expect(ys).toEqual([...JUMP_DY, 0]);
    expect(JUMP_DY).toEqual([0, 0, 0, -6, -10, -13, -15, -16, -16, -16, -15, -13, -10, -6]);
    expect(p0.state).toBe('alive');
  });
  it('entrar na ponta de baixo não vira', () => {
    const s = stageArena(9);
    put(s, 0, 4, 4);
    const ev = run(s, 30, st => (playerCell(st.players[0]) === cellOf(4, 3) ? [0, 0, 0, 0, 0] : [BTN.UP, 0, 0, 0, 0]));
    expect(stageEvents(ev, 'a9_launch').length).toBe(0);
    expect(st9(s).saws[0].state).toBe(0);
  });
  it('← no início do pulo: voa 8 px/tick (ticks 3..14), dá a volta (−25 → 247), quica no muro até a col 14 (medido b19)', () => {
    const s = stageArena(9);
    const p1 = put(s, 1, 4, 3);
    put(s, 0, 6, 4);
    const xs: number[] = [];
    let t0 = -1, landed = -1;
    // P1 chega na ponta B no tick 108; P2 segura ← nos ticks 106 e 107 (anda 2 px, continua na ponta A) e solta.
    const input = (st: typeof s) => [playerCell(st.players[0]) === cellOf(6, 3) ? 0 : BTN.UP, st.tick === 105 || st.tick === 106 ? BTN.LEFT : 0, 0, 0, 0];
    for (let i = 0; i < 40; i++) {
      const ev = run(s, 1, input);
      if (t0 < 0 && stageEvents(ev, 'a9_launch').some(e => e.slot === 1)) t0 = s.tick;
      if (t0 >= 0 && s.tick > t0 && s.tick <= t0 + 23) xs.push(px(p1.x));
      if (t0 >= 0 && landed < 0 && s.tick > t0 && p1.act !== 'launched') landed = s.tick;
    }
    expect(t0).toBe(108);
    expect(xs).toEqual([63, 63, 63, 55, 47, 39, 31, 23, 15, 7, -1, -9, -17, 247, 239, 236, 233, 230, 227, 225, 223, 223, 223]);
    expect(landed).toBe(t0 + 23);
    expect(playerCell(p1)).toBe(cellOf(14, 3));
  });
  it('IA: evita as pontas de uma gangorra com adversário em cima', () => {
    const s = stageArena(9);
    put(s, 1, 5, 3);
    expect([...stage9Ai.avoid!(s, 0)].sort((a, b) => a - b)).toEqual([cellOf(4, 3), cellOf(6, 3)]);
    expect([...stage9Ai.avoid!(s, 1)]).toEqual([]);
  });
  it('ROM: palavras das 12 casas e paleta 5 animada (6 quadros de 14 ticks a partir de $D7:DDDC)', () => {
    const s = stageArena(9);
    const { b, calls } = fakeBuilder();
    const layer = romLayers.find(l => l.id === 'stage9')!;
    s.tick = 0;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.bg2.size).toBe(12);
    expect(calls.bg2.get('4,3')).toBe(0x08ec);
    expect(calls.bg2.get('12,9')).toBe(0x08e4);
    expect(calls.cgram.get(80)).toBe(0xd7dddc & 0x7fff);
    s.tick = 14;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.cgram.get(80)).toBe((0xd7dddc + 32) & 0x7fff);
  });
  it('fallback: 4 pranchas', () => {
    const c = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage9')!.draw(stageArena(9), c.ctx, {} as never, 0);
    expect(c.log.filter(x => x === 'stroke').length).toBe(4);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/stages/stage9.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `core/stages/stage9.ts`**

```ts
import type { StageModule } from '../hooks';
import { BTN, type GameEvent, type Player, type RoundState } from '../types';
import { cellOf, centerX, centerY, colOf, linOf } from '../units';
import type { Jump, Seesaw, Stage9State } from './state';
import { A9_SAWS } from './tables';
import { playerCell, px, setAct, stageEvent, standing, wrapPx } from './kit';
import { stage9Ai } from '../ai/stages/stage9';

export const JUMP_DY = [0, 0, 0, -6, -10, -13, -15, -16, -16, -16, -15, -13, -10, -6];
export const HOP_DX = [3, 3, 3, 3, 2, 2, 0, 0];
export const HOP_DY = [-4, -6, -6, -6, -4, 0, 0, 0];
const WORDS: Record<'0' | '1' | 't', number[]> = { 0: [0x08ec, 0x48e2, 0x48e0], 1: [0x08e0, 0x08e2, 0x08e4], t: [0x08e6, 0x08e8, 0x08ea] };
const LOCK = 9999;

/** Ponta de cima: estado 0 → B, estado 1 → A. */
export const upEnd = (w: Seesaw): number => (w.state === 0 ? w.b : w.a);
export const sawWords = (w: Seesaw, tick: number): number[] => (tick < w.transUntil ? WORDS.t : WORDS[w.state === 0 ? '0' : '1']);

const newState = (): Stage9State => ({ saws: A9_SAWS.map(([st, c, l]) => ({ a: cellOf(c, l), b: cellOf(c + 2, l), state: st as 0 | 1, transUntil: 0 })), jumps: [] });
export const st9 = (s: RoundState): Stage9State => (s.stageState ??= newState()) as Stage9State;

const airborne = (a: Stage9State, slot: number): boolean => a.jumps.some(j => j.slot === slot);
const free = (s: RoundState, cell: number): boolean => cell >= 0 && (s.grid[cell] & 0x8000) === 0;

function launch(s: RoundState, a: Stage9State, p: Player, ev: GameEvent[]): void {
  const h = p.prevBtn & (BTN.LEFT | BTN.RIGHT);
  const dx: -1 | 0 | 1 = h === BTN.LEFT ? -1 : h === BTN.RIGHT ? 1 : 0;
  const c = playerCell(p);
  p.x = centerX(colOf(c)); p.y = centerY(linOf(c));
  p.push = { vx: 0, vy: 0, left: 0 };
  a.jumps.push({ slot: p.slot, t: -1, dx, baseY: p.y, born: s.tick, hop: -1 });
  setAct(s, p, 'launched', LOCK);
  stageEvent(ev, 'a9_launch', { slot: p.slot });
}

function toggle(s: RoundState, a: Stage9State, w: Seesaw, ev: GameEvent[]): void {
  w.state = w.state === 0 ? 1 : 0;
  w.transUntil = s.tick + 2;
  const up = upEnd(w);
  for (const p of s.players) if (standing(p) && !airborne(a, p.slot) && playerCell(p) === up) launch(s, a, p, ev);
}

function land(s: RoundState, a: Stage9State, j: Jump, p: Player, ev: GameEvent[]): void {
  const c = playerCell(p);
  if (!free(s, c) && j.dx !== 0) { j.hop = 0; return; }             // quica até achar casa livre
  a.jumps.splice(a.jumps.indexOf(j), 1);
  if (c >= 0) p.x = centerX(colOf(c));
  setAct(s, p, 'idle', 0);
  const w = a.saws.find(x => x.a === c || x.b === c);
  if (w) toggle(s, a, w, ev);                                       // pousar em qualquer ponta vira
}

/** Arena 9: gangorras ($C2:1C58, parâmetros $C3:9524). */
export const stage9: StageModule = {
  init(s) { s.stageState = newState(); },
  onEnterCell(s, p, cell, ev) {
    const a = st9(s);
    if (airborne(a, p.slot)) return;
    const w = a.saws.find(x => upEnd(x) === cell);
    if (w) toggle(s, a, w, ev);
  },
  tick(s, ev) {
    const a = st9(s);
    for (const j of [...a.jumps]) {
      if (j.born === s.tick) continue;
      const p = s.players[j.slot];
      if (!standing(p)) { a.jumps.splice(a.jumps.indexOf(j), 1); continue; }
      if (j.hop < 0) {
        j.t++;
        if (j.t >= 3 && j.dx) p.x = wrapPx(px(p.x) + 8 * j.dx) * 256;
        if (j.t < 14) { p.y = j.baseY + JUMP_DY[j.t] * 256; continue; }
        p.y = j.baseY;
        land(s, a, j, p, ev);
      } else {
        p.x = wrapPx(px(p.x) + HOP_DX[j.hop] * j.dx) * 256;
        p.y = j.baseY + HOP_DY[j.hop] * 256;
        if (++j.hop < 8) continue;
        land(s, a, j, p, ev);
      }
    }
  },
  get ai() { return stage9Ai; },
};
```

Conferência do teste do voo: `t = 3..13` somam −8 a partir de 63 (55 … −17, −25 → 247); `t = 14` soma −8 (239) e a casa (15,3) é parede → quique; o quique soma 3,3,3,3,2,2,0,0 (236 … 223) e no fim a casa (14,3) está livre → pousa, `act = 'idle'`. O perfil vertical do teste mostra `JUMP_DY[0..13]` e o 0 do pouso.

- [ ] **Step 4: Implementar a IA e as camadas**

`web/src/core/ai/stages/stage9.ts`:

```ts
import type { AiStageHints } from '../hints';
import { playerCell, standing } from '../../stages/kit';
import { st9 } from '../../stages/stage9';

/** Evitar ponta de gangorra com adversário em cima dela (§9 item 8). */
export const stage9Ai: AiStageHints = {
  avoid(s, slot) {
    const out: number[] = [];
    for (const w of st9(s).saws) {
      const cells = [w.a, w.a + 1, w.b];
      if (s.players.some(p => p.slot !== slot && standing(p) && cells.includes(playerCell(p)))) out.push(w.a, w.b);
    }
    return out;
  },
};
```

`web/src/render/rom/stages/stage9.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
import { colOf, linOf } from '../../../core/units';
import { st9, sawWords } from '../../../core/stages/stage9';
import { A9_PAL } from '../../../core/stages/tables';
import { assetsOf, writePaletteFrame } from './romkit';

registerRomLayer({
  id: 'stage9',
  draw(s, b, a0) {
    if (s.stage !== 9) return;
    for (const w of st9(s).saws) {
      const words = sawWords(w, s.tick);
      [w.a, w.a + 1, w.b].forEach((c, i) => b.setBg2(colOf(c), linOf(c), words[i]));
    }
    writePaletteFrame(b, assetsOf(a0), A9_PAL, 6, 14, s.tick, 80);   // paleta 5: 6 quadros, 14 ticks, ciclo 84
  },
});
```

`web/src/render/fallback/stages/stage9.ts`:

```ts
import { registerFallbackLayer } from '../../battle-layers';
import { colOf, linOf } from '../../../core/units';
import { st9, upEnd } from '../../../core/stages/stage9';
import { cellLeft, cellTop } from './geom';

// Prancha de 3 casas inclinada para o lado da ponta de baixo.
registerFallbackLayer({
  id: 'stage9',
  draw(s, ctx) {
    if (s.stage !== 9) return;
    ctx.save();
    ctx.strokeStyle = '#c08040';
    ctx.lineWidth = 3;
    for (const w of st9(s).saws) {
      const x0 = cellLeft(colOf(w.a)) + 2, x1 = cellLeft(colOf(w.b)) + 14, y = cellTop(linOf(w.a)) + 8;
      const aUp = upEnd(w) === w.a;
      ctx.beginPath();
      ctx.moveTo(x0, y + (aUp ? -5 : 5)); ctx.lineTo(x1, y + (aUp ? 5 : -5));
      ctx.stroke();
    }
    ctx.restore();
  },
});
```

- [ ] **Step 5: Rodar os testes**

Run: `cd web && npx vitest run tests/stages && npx tsc --noEmit`
Expected: PASS. Se o teste de vai e volta falhar porque o núcleo ainda mexe no lançado, conferir o item 6 da Task 1 (ação travada sem `movePlayer`).

- [ ] **Step 6: Commit**

```bash
git add web/src/core/stages/stage9.ts web/src/core/ai/stages/stage9.ts web/src/render/rom/stages/stage9.ts \
  web/src/render/fallback/stages/stage9.ts web/tests/stages/stage9.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 9 — gangorras com o pulo medido, voo com volta pela borda e quique até casa livre

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 13: Arena 10 "Alfaiataria" (curta)

**Possui:** `web/src/core/stages/stage10.ts`, `web/src/render/rom/stages/stage10.ts`, `web/tests/stages/stage10.test.ts`.

A mecânica da arena 10 (8 trajes na lista de itens) já está no núcleo (plano 6, §3.8). *Color math* `add` e os tiles `$04C` são do plano 7 (D18). Fica só a paleta 5 animada: 4 quadros a partir de `$D7:E47C`, 15 ticks cada, ciclo 60.

- [ ] **Step 1: Teste**

`web/tests/stages/stage10.test.ts`:

```ts
import { stage10 } from '../../src/core/stages/stage10';
import { romLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage10';
import { stageArena, fullRound, fakeBuilder, fakeAssets } from './kit';

describe('arena 10', () => {
  it('sem mecânica própria; 8 trajes vêm da lista de itens do núcleo', () => {
    expect(Object.keys(stage10)).toEqual([]);
    expect(fullRound(10).hidden.filter(([, i]) => i === 0x0f).length).toBe(8);
  });
  it('paleta 5: quadros 0, 1, 2, 3, 0 nos ticks 0, 15, 30, 45, 60', () => {
    const s = stageArena(10);
    const layer = romLayers.find(l => l.id === 'stage10')!;
    const got: number[] = [];
    for (const t of [0, 15, 30, 45, 60]) {
      const { b, calls } = fakeBuilder();
      s.tick = t;
      layer.draw(s, b, fakeAssets(), 0);
      got.push(((calls.cgram.get(80)! - (0xd7e47c & 0x7fff)) / 32));
      expect(calls.cgram.size).toBe(16);
    }
    expect(got).toEqual([0, 1, 2, 3, 0]);
  });
});
```

- [ ] **Step 2: Implementar**

`web/src/core/stages/stage10.ts`:

```ts
import type { StageModule } from '../hooks';
/** Arena 10: sem objeto especial; os 8 trajes estão na lista de itens (§3.8). */
export const stage10: StageModule = {};
```

`web/src/render/rom/stages/stage10.ts`:

```ts
import { registerRomLayer } from '../../battle-layers';
import { A10_PAL } from '../../../core/stages/tables';
import { assetsOf, writePaletteFrame } from './romkit';

registerRomLayer({
  id: 'stage10',
  draw(s, b, a0) { if (s.stage !== 10) return; writePaletteFrame(b, assetsOf(a0), A10_PAL, 4, 15, s.tick, 80); },
});
```

- [ ] **Step 3: Rodar** `cd web && npx vitest run tests/stages/stage10.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/core/stages/stage10.ts web/src/render/rom/stages/stage10.ts web/tests/stages/stage10.test.ts
git commit -m "$(cat <<'MSG'
feat(stages): arena 10 — paleta 5 animada da ROM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

## Onda 3

### Task 14: Integração — partidas só de CPU, determinismo, screenshots

**Possui:** `web/tests/stages/cpu.test.ts`.

**Interfaces:**
- Consumes: tudo das ondas 1 e 2; `core/match.{createMatch, startRound}`, `core/step.step`, `core/ai.{createAi, aiInputs}`, `core/hash.hashState`.
- Produces: o aceite da §11 (linha 8) e o relatório do PR.

- [ ] **Step 1: Escrever o teste**

`web/tests/stages/cpu.test.ts`:

```ts
import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { createAi, aiInputs } from '../../src/core/ai';
import { hashState } from '../../src/core/hash';
import { defaultRules, type RoundState } from '../../src/core/types';

const CPU = [true, true, true, true, true];
const MAX = 3 * 60 * 60 + 62 + 600;          // 3:00 + intro + folga (TIME UP e comemoração)

function cpuRound(stage: number, seed: number): RoundState {
  const m = createMatch({ ...defaultRules(), cpuLevel: 1 }, stage, seed);
  const s = startRound(m);
  const ai = createAi();
  for (let i = 0; i < MAX && s.phase !== 'over'; i++) step(s, aiInputs(s, ai, CPU, 1));
  return s;
}

describe('partidas só de CPU nas arenas 2–10 (spec §11, plano 8)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 2 rodadas terminam sem travar`, () => {
      for (const seed of [1, 2]) {
        const s = cpuRound(stage, seed);
        expect(s.phase, `fase ${stage} semente ${seed}`).toBe('over');
        expect(s.result).not.toBeNull();
      }
    }, 120_000);
  }
  it('determinismo: mesma semente → mesmo hash (arenas 3, 8 e 9)', () => {
    for (const stage of [3, 8, 9]) expect(hashState(cpuRound(stage, 7))).toBe(hashState(cpuRound(stage, 7)));
  }, 120_000);
});

describe.skipIf(!process.env.CB_SLOW)('aceite §9 da IA nas arenas especiais (lento)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 50 rodadas, no máximo 30 % terminam por TIME UP`, () => {
      let timeUp = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const s = cpuRound(stage, seed);
        expect(s.phase).toBe('over');
        if (s.result?.reason === 'time') timeUp++;
      }
      expect(timeUp).toBeLessThanOrEqual(15);
    }, 900_000);
  }
});
```

- [ ] **Step 2: Rodar**

Run: `cd web && npx vitest run tests/stages/cpu.test.ts`
Expected: PASS. Se uma arena travar, rodar a rodada isolada, imprimir `s.tick`, `s.phase` e o `stageState` e corrigir **na tarefa da arena** (não no teste). Rodar também `CB_SLOW=1 npx vitest run tests/stages/cpu.test.ts` uma vez e anotar a taxa de TIME UP por arena no PR.

- [ ] **Step 3: Rodada completa e screenshots**

```bash
cd web
npx vitest run && npx tsc --noEmit && npm run build
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/stages
npm run snap
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npm run snap
```

Revisar os screenshots das arenas 2–10 nos dois modos: HOFS da arena 2, bolas da 3, cerca da 5 (fallback), piso repintado da 6, setas e moitas da 7, pads/rolos/quedas da 8, gangorras e paleta da 9, paleta da 10. Comparar o modo ROM com `analise/extraido/arenas-cenario/shots/` e `…/render/`. Registrar no PR o que ficou 🟡 (rolos, sprites das bolas e das quedas).

- [ ] **Step 4: Commit**

```bash
git add web/tests/stages/cpu.test.ts
git commit -m "$(cat <<'MSG'
test(stages): partidas só de CPU nas arenas 2–10 e determinismo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

## Aceite do plano (spec §11, linha 8)

| Critério da spec | Onde | Comando |
|---|---|---|
| Arena 2: probabilidades (16/13/3 de 32) e temporizador; velocidade e pavio 127/64/253 | `rom-facts.test.ts`, `stage2.test.ts` (golden das trocas 534/900/1317/1660) | `npx vitest run tests/stages/stage2.test.ts tests/stages/rom-facts.test.ts` |
| Bolas: gatilho, 16 ticks por casa, 8 casas, virada, atordoamento + 64 de imunidade | `stage3.test.ts` (D6: atordoamento do núcleo, não 66 fixos) | `npx vitest run tests/stages/stage3.test.ts` |
| Repintura e efeitos da 6 | `stage6.test.ts` (golden da carga, sorteios por explosão, 1C0A/1C0C/1C08) | `npx vitest run tests/stages/stage6.test.ts` |
| Setas da 7 | `stage7.test.ts` | `npx vitest run tests/stages/stage7.test.ts` |
| Caça-níquel: liga, gira a cada 3, freio 384, prêmio pela tabela | `stage8.test.ts`, `stage8-prizes.test.ts`, `render-stage8.test.ts` | `npx vitest run tests/stages/stage8*.test.ts tests/stages/render-stage8.test.ts` |
| Gangorra: 14 ticks, 8 px/tick, volta pela borda | `stage9.test.ts` | `npx vitest run tests/stages/stage9.test.ts` |
| Cerca da 5 | `stage5.test.ts` | `npx vitest run tests/stages/stage5.test.ts` |
| Partidas de CPU sem travar em cada arena | `cpu.test.ts` (curto sempre; 50 rodadas com `CB_SLOW=1`) | `npx vitest run tests/stages/cpu.test.ts` |
| Fatos das arenas = ROM | `rom-facts.test.ts` | `SB4_ROM=… npx vitest run tests/stages/rom-facts.test.ts` |
| Suíte inteira, tipos e build | – | `npx vitest run && npx tsc --noEmit && npm run build` |
| Screenshots das 10 arenas nos dois modos | revisão manual | `npm run snap` (com e sem `SB4_ROM`) |

## Riscos

1. **Plano 6 ainda sendo escrito.** Este plano depende de semânticas que o plano 6 só fixa nas tarefas T6–T19 (chamada de `onFlameCell` para toda casa e sua codificação de `armDir`, `applyPush` → `outOfBounds`, ação travada sem movimento, voadores de item com `bounce`, guarda de dono −1, `speedLevel` com o gancho da arena). A Task 1 confere item a item e concentra as adaptações em `kit.ts`, `armIndex`, `romkit.ts` e `geom.ts`. Mudanças no núcleo são de 1 linha e vão como acordo no PR.
2. **Plano 5 ainda não escrito.** Os nomes `decodeZte`, `RomAssets.anim`, `RomAssets.arena(n)` vêm da §2.3 da spec. Os rolos da arena 8, os sprites das bolas e das quedas são 🟡 visuais (revisão por screenshot); nenhum teste sem ROM depende deles.
3. **Paridade do pavio lento (D5)** e do HOFS da arena 2: a paridade absoluta de `$016C` não foi medida; 253 × 252 ticks conforme o tick da colocação.
4. **Ordem da ROM × passo do núcleo (D3, D4):** o intro sem objetos e o `tick` da arena depois das bombas são compensados (desconto de 10 ticks; `cellT0 < tick`). A chama que some no 25º tick é vista 1 tick a menos pela bola e pela máquina que na ROM.
5. **Arena 6:** a ordem das casas de uma explosão importa para o contador `$1EAA`; se o núcleo chamar os braços em ordem diferente da ROM (cima, direita, baixo, esquerda, centro por último), a sequência de caveiras muda (a sorte continua a mesma). O teste "4 sorteios por explosão" fixa a ordem do núcleo.
6. **Arena 8:** fita dos rolos (`$D3:817E`, 🟡), queda dos ovos (objeto `$C1:6745` não lido: usa-se a mesma queda dos itens, com sorteio de script), teto de ovos (`$1ED4` substituído por `eggsInPlay`), jackpot antes do tick 191 (bordas atrasadas), jackpot com a pressão natural já ativa (só aumenta o total para 143), transformação do item `$11` quando `$1ECA ≥ 3` (`$C1:6960`, semântica de `$1ECA` desconhecida: fica sem efeito).
7. **Arena 9:** o atraso de ~24 ticks visto uma vez ao entrar andando na ponta de baixo (b17 estendido) não foi explicado e não está modelado; destino ocupado por outro jogador (A10) segue sem regra especial; volta pela borda à direita (`x > 278`) é espelhada da esquerda.
8. **Arena 4:** grama dos cantos e terra (`$C2:210A`) continuam como piso normal (A10).
9. **Arena 3:** `0F41` não bloqueia o jogador (segue o `blocked()` do plano 6, provisório da §12 A10); a ARN viu bloqueio. Se o jogo mostrar que bloqueia, a mudança é no `movement.ts` do plano 6.
10. **Tempo dos testes de CPU:** 18 rodadas completas com IA podem passar de 1 minuto; se ficar lento demais, reduzir para 1 semente por arena no teste sempre-ligado e manter as 50 no `CB_SLOW`.
