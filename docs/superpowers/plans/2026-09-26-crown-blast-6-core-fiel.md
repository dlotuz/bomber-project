# Crown Blast: Plano 6, Núcleo fiel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever `web/src/core` nas unidades da ROM (1/256 px, grade 17×13, códigos de 16 bits, LCG do jogo), com todas as regras do Battle Mode da §3 da spec, os contratos de extensão da §2.5 para os planos 7–11, a IA adaptada (§9) e o fallback sem ROM continuando jogável.

**Architecture:**
- O núcleo antigo vai inteiro para `web/src/legacy-core/` na 1ª tarefa (renomeação mecânica). Assim o jogo, o render e os testes antigos continuam verdes enquanto o núcleo novo nasce em `web/src/core/` nos caminhos finais. Na onda 4 o render, a sessão e as telas voltam a importar `../core`; na onda 5 o legado é apagado.
- A fundação (onda 1) cria os tipos, as unidades, o RNG, os contratos (`hooks.ts`, registros, `battle-layers.ts`) e o **esqueleto do passo** (`step.ts`) já na ordem da §3.4, chamando funções de módulos que nascem como *stubs* com a assinatura final. Cada tarefa da onda 2 preenche um módulo. A onda 3 integra e prova a ordem com cenários de ponta a ponta.
- As tabelas de regra da ROM viram constantes TS geradas (`core/tables/*.ts`) por extratores Node (`scripts/rom-facts/core-*.ts`). Os traços do emulador viram fixtures JSON (`tests/fixtures/rom/*.json`) gerados por scripts Python que usam o core instrumentado das frentes.

**Tech Stack:** TypeScript 7 (`tsc --noEmit`), Vite 8, Vitest 5, Node 24 (extratores com *type stripping*), Python do venv das frentes para os fixtures.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md` (§1, §2.1, §2.2, §2.5, §2.6, §3 inteira, §9, §10, §11 linha 6 e aceite). Fontes: [MEC] `analise/investigacao/mecanicas/RELATORIO.md` (+ `movesim.py`, `itemsim.py`, `t*.py`), [ARN] `analise/investigacao/arenas-cenario/RELATORIO.md` (+ `arena_rom.py`), [ANI] `analise/investigacao/animacoes-sprites/RELATORIO.md`.

## Global Constraints

- Worktree `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity`, branch `feat/fidelity`, código em `web/`. Antes de começar: 238 testes verdes (`cd web && npx vitest run`) e `npx tsc --noEmit` limpo. **Cada tarefa termina com `npx vitest run` e `npx tsc --noEmit` verdes.**
- ROM local: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"` (SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`). Testes que precisam dela usam `describe.skipIf(!rom)`. **Nunca versionar bytes da ROM, imagens extraídas ou áudio.** Só fatos numéricos.
- O núcleo não importa nada de `render/`, `audio/`, `input/`, `rom/`, e não lê a ROM. `step` é determinístico: nada de `Math.random`, `Date`, DOM. Estado só com `number`, `boolean`, `string`, `null`, arrays e objetos simples (hash JSON trivial).
- **Tick** = passo lógico de 1/60 s, sem *lag* do SNES. Todas as durações abaixo são em ticks.
- **Casa (col, lin)**: col 0..16, lin 0..12; campo col 2..14 × lin 1..11; paredes col 1 e 15, lin 0 e 12; `cell = lin·17 + col`. ARN e MNT escrevem (lin, col): converter sempre.
- Posição em 1/256 px, coordenadas de tela: centro `X = (16·col − 1)·256`, `Y = (16·(lin+2) − 1)·256`; casa de um ponto `col = ⌊(px+8)/16⌋`, `lin = ⌊(py+8)/16⌋ − 2`.
- RNG: `seed = ((seed | 1)·0x383) & 0xFFFF; valor = (seed·(n & 0xFF)) >>> 16`. Semente de boot `0x0012`. A IA **não** consome o RNG do jogo.
- `BTN = {UP:1, DOWN:2, LEFT:4, RIGHT:8, A:16, B:32, Y:64, START:128, X:256, L:512, R:1024, SELECT:2048}`.
- Arquivos de registro compartilhados (`core/stages/index.ts`, `core/mounts/index.ts`, `render/layers-index.ts`): os planos 8 e 9 **só acrescentam linhas**. As interfaces de `core/hooks.ts`, `core/ai/hints.ts` e `render/battle-layers.ts` só mudam com acordo registrado no PR.
- Extratores (`web/scripts/rom-facts/core-*.ts`) rodam com `node scripts/rom-facts/core-all.ts` (Node 24 remove os tipos sozinho): só sintaxe apagável (sem `enum`, sem *parameter properties*), imports relativos **com** extensão `.ts`, e nenhum import de `src/`.
- Python dos fixtures: `PY="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/venv/bin/python"` com `SNES9X_CORE="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-mecanicas/snes9x/libretro/snes9x_libretro.dylib"`.
- Commits em PT-BR no estilo `feat(core): ...`, um por tarefa, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Textos visíveis ao jogador em PT-BR. Comentários de código em PT-BR.

---

## Ondas e tarefas

Tarefas da mesma onda mexem em arquivos **disjuntos** (cada tarefa diz "Possui") e dependem só de ondas anteriores. Podem rodar em worktrees separadas e ser mescladas no fim da onda.

| Onda | Tarefas (paralelas) | Depende de |
|---|---|---|
| **1** | T1 Fundação e contratos · T2 Fatos da ROM (tabelas geradas) · T3 Fixtures do emulador | – |
| **2** | T4 Movimento · T5 Montagem da rodada e prêmio do Racer · T6 Bombas, explosões, chamas e queima · T7 Chute e botão X · T8 Voadores (soco, luva, quique, borda, itens voando) · T9 Máquina de ação e botões (A/B/X/Y, P) · T10 Itens, drops e perdas · T11 Doenças e contágio · T12 Acerto, invencibilidade, morte e atordoamento · T13 Relógio, pressão e TIME UP · T14 Fim de rodada, partida e times · T15 Bad Bomber | onda 1 |
| **3** | T16 Integração do passo e cenários de ponta a ponta | onda 2 |
| **4** | T17 IA: porte (perigo, navegação, decisões) · T18 Entrada (botão X) · T19 Sessão e render de fallback | onda 3 |
| **5** | T20 IA: ações, doenças, pressão, Bad Bomber e aceite §9 · T21 Remoção do legado | onda 4 |

Caminho crítico: T1 → T6 → T16 → T17 → T20.

## Mapa de arquivos

```
web/src/core/
  types.ts        BTN, CODE, ITEM, DISEASE, FLAME_PIECE, BURN, Rules, Phase, PlayerAct, Player, Bomb, Flyer,
                  PressureState, BadBomberState, RoundResult, RoundState, GameEvent, defaultRules      (T1)
  units.ts        grade 17×13, 1/256 px, casa ↔ posição, romOff, spawns, faces, volta pela borda       (T1)
  rng.ts          Rng16, rnd, makeRng, permuteSpawns (RNG separado das opções extras)                  (T1)
  constants.ts    tempos e máximos da §3, STAGE_NAMES, rangeOf                                         (T1)
  state.ts        createPlayer, emptyRound, códigos de item, setAct/setFace, standing, newId            (T1)
  hooks.ts        StageModule, MountModule                                                              (T1)
  hash.ts         hashState (cópia do legado)                                                           (T1)
  step.ts         passo na ordem da §3.4                                                   (T1 esqueleto, T16)
  layouts.ts      LAYOUTS: miniaturas das fases derivadas de STAGE_FACTS                               (T16)
  index.ts        API pública                                                              (T1, T16 acrescenta)
  movement.ts     porte de movesim.py                                                                   (T4)
  setup.ts        createRound (§3.3)          racer.ts  prêmios do Racer (§3.14)                        (T5)
  bombs.ts        colocação, pavio, explosão, chama, queima, remota                                     (T6)
  kick.ts         chute e X                                                                             (T7)
  flyers.ts       soco, luva, quique, borda, itens voando                                               (T8)
  actions.ts      máquina de ação, A/B/X/Y, golpe P, empurrão                                           (T9)
  items.ts        efeitos, coleta, drops da morte, perdas por atordoamento/$2B                          (T10)
  disease.ts      11 doenças, contágio, cura                                                            (T11)
  hit.ts          acerto, invencibilidade, morte, atordoamento                                          (T12)
  clock.ts        relógio        pressure.ts  pressão e Morte Súbita                                    (T13)
  round-end.ts    vitória, comemoração, empate, TIME UP     match.ts  partida, coroas, times           (T14)
  bad-bomber.ts   Bomber Vingador                                                                       (T15)
  stages/index.ts STAGES[0..10] vazios (plano 8 preenche)     mounts/index.ts MOUNTS no-op (plano 9)    (T1)
  ai/hints.ts     AiStageHints, AiMountHints                                                            (T1)
  ai/index.ts     stub (T1) → IA (T17, T20); ai/level.ts, danger.ts, nav.ts, brain.ts (T17); ai/actions.ts, ai/bad.ts (T20)
  tables/*.ts     GERADOS: movement, stages, items, cells, flights, misc                                (T2)
web/src/render/battle-layers.ts, layers-index.ts     contratos de camadas                               (T1)
web/src/legacy-core/**                               núcleo antigo (T1 cria por renomeação, T21 apaga)
web/scripts/rom-facts/core-*.ts                      extratores Node                                    (T2)
web/scripts/rom-facts/core-fixtures/*.py             geradores de fixtures                              (T3)
web/tests/core/**            testes novos (kit.ts de T1; um arquivo por módulo)
web/tests/rom/facts.test.ts  fatos = ROM (pula sem SB4_ROM)                                            (T2)
web/tests/fixtures/rom/{movement,rounds}.json                                                          (T3)
```

## Decisões deste plano sobre lacunas da spec

Cada item diz o que a spec deixava aberto e o que este plano fixa. Os marcados 🟡 seguem provisórios como na §12 da spec.

1. **Transição sem quebrar o build:** o núcleo antigo vira `src/legacy-core/` (T1) e só é apagado em T21. Arquivos fora da posse do plano 6 recebem **só a troca do caminho de import** em T1 e a volta em T18/T19: `src/app/{tick,settings}.ts`, `src/game/config.ts`, `src/screens/*.ts`, `scripts/snapshots.mjs`, `tests/client/*.ts`. O plano 10 vem depois e não disputa esses arquivos.
2. **`KeyMap` ganha `x`** (§2.6). Para o `tsc` continuar limpo, T18 acrescenta a linha `x: 'X'` em `ACTION_LABEL` de `src/screens/settings-screen.ts` (arquivo do plano 10; mudança de 1 linha registrada aqui). `KEY_FIELDS` vira `up, down, left, right, a, b, y, x, start`: o índice de `b` (5) não muda.
3. **`battle-layers.ts` não depende do plano 5** (que roda em paralelo): o parâmetro de assets é tipado `object` e o objeto de sprite é `BattleObj`, estruturalmente igual ao `ObjEntry` da §2.4. Métodos TS são bivariantes, então o plano 7 implementa `draw(s, b, a: RomAssets, frame)` sem cast. **Pós-merge com o plano 5** (1ª tarefa do plano 7): trocar `object` por `import type { RomAssets } from '../rom/assets'` e `BattleObj` por `ObjEntry`.
4. **Extratores sem `vite-node`**: não está instalado; usar `node` 24 com *type stripping* e `allowImportingTsExtensions` no `tsconfig.json` (T2). T2 instala `@types/node` (devDependency) porque não há tipos do Node no projeto; se o plano 5 instalar o mesmo pacote, o conflito no `package.json` se resolve mantendo uma linha. `tests/rom/facts.test.ts` é do plano 6 e **não** usa `tests/rom/helpers.ts` do plano 5: tem seu próprio carregador `scripts/rom-facts/core-rom.ts`.
5. **Tabelas com fórmula** (§2.2): `SPEED` (níveis `[224,256,288,320,352,384,512,128]` × vetores unitários), `A20` (`i<8 → 7−i; i<16 → 0; i<24 → −(i−15)`) e a espiral da pressão (anéis) são emitidas como fórmula; o teste de fatos compara com a ROM.
6. **Chamadas de RNG das arenas antes dos itens (A4), medido no emulador para este plano:** com 5 jogadores e semente de boot, **só a fase 6** consome RNG entre a remoção e os itens (1 chamada, o `64 + rnd(64)` de `$1EAA`). As fases 2 e 3 sorteiam depois dos itens. O fixture `rounds.json` traz as sementes medidas; o teste da fase 6 injeta um `init` falso de 1 chamada.
7. **Códigos de item na grade:** item `id` (1..`$1F`, `$30..$3F`) = `0x0940 + id`; caveira `$21..$2B` = `0x0980 + id` (§3.1). Decodificação: `lo = v & 0xFF; lo ≥ 0x80 ? lo − 0x80 : lo − 0x40`.
8. **Pavio das doenças:** a tabela `$C1:56E8` = `[62, 253, 126]` são **valores do contador** (como o 126 normal). Logo `$27` explode 63 ticks depois e `$28`, 254.
9. **Semântica do contador:** a bomba nasce com `fuse = 126` e `born = tick`; no passo de objetos ela é ignorada no tick em que nasceu; depois, a cada tick, se `fuse === 0` explode, senão `fuse −= fuseStep` (mín. 0). Isso dá 127 / 64 / 253 ticks (C5).
10. **Cadeia:** a bomba atingida recebe `chainAt = tick + 2` e explode no passo de objetos desse tick. B (remota) marca `chainAt = tick` (explode no mesmo tick). Bomba chutada que entra em casa com chama: `chainAt = tick + 1` (A6 🟡).
11. **Chama:** grava `FLAME` com `cellT0 = tick` e `cellAux = peça`; volta a `FLOOR` quando `tick − cellT0 ≥ 25`. A última casa escrita de cada braço é a ponta. Braços na ordem cima, direita, baixo, esquerda (🟡; importa para a arena 6). O braço **não** entra na casa de outra bomba (A12). Casas com código especial passável (`0040`, `0C00`, `0F41`, `0001`) não recebem `FLAME`: chamam `STAGES[n].onFlameCell` e o braço segue.
12. **Queima:** soft ou item atingido vira `BURNING` com `cellAux = BURN.SOFT | BURN.ITEM`; aos 24 ticks o soft revela o item escondido (ou vira `FLOOR`) e o item vira `FLOOR`. `BURNING` segura a chama.
13. **Colocação de bomba:** só em casa `FLOOR`, com bomba livre, sem outra bomba ali; `$24` impede; `$25` exige todas livres e dá fogo 10; fogo total dá fogo 7; o tipo vem de `MOUNTS.current.bombType?.(p) ?? p.bombType`.
14. **Chute** (código `$C2:4307` lido para este plano): dispara após o movimento se `p.kick || MOUNTS.current.kicks?.(p)`, a casa vizinha na face tem exatamente `BOMB` parada com `fuse ∉ {0, 1}`, e `KICK_MASK[subY·16 + subX] & KICK_DIRBIT[face/2]`. A bomba sai da grade e começa a andar já no passo de objetos do mesmo tick. Para antes de casa com `code & 0x8400`, outra bomba, jogador de pé ou ovo; item é esmagado. X para **as bombas chutadas pelo jogador** na casa em que o centro delas está.
15. **Voadores:** posição de chão `(x, y)` + altura `z` (px, ≤ 0). Scripts horizontais somam `dy` em `z`; verticais somam em `y` (o arco já vem embutido, [MEC §5.4]). Arremesso da luva sai da mão: horizontal com `z = −16`, vertical com `y − 16`. Começam a andar no tick seguinte ao da criação. Volta pela borda: col > 16 → `x −= 272 px`; col < 0 → `x += 272 px`; lin > 12 → `y −= 208 px`; lin < 0 → `y += 208 px` (🟡 vertical; bate com "lin 2 para cima pousa na lin 10" do t49 com o P4 em (2,11)). Casa fora do campo conta como ocupada.
16. **Pouso de bomba:** `FLOOR` → bomba parada; `FLAME` → pousa e `chainAt = tick + 2` (🟡); `BURNING` → some e volta ao dono (🟡); jogador de pé → atordoa e quica; resto → quica. Itens voando: `FLOOR` → item; `BURNING` → some; resto (inclusive chama) → quica; jogadores não bloqueiam itens.
17. **Perdas no atordoamento** (código `$C2:51C4…$C2:5592` lido para este plano): `n = ((rnd(255) & 6) >> 1) + 1`. Para cada perda: índice 0 se doente, senão 1 se tem traje, senão `rnd(13)`; até 8 tentativas; depois varre 0..12. Ordem dos 13: doença, traje, patins (mín. 1), bomba (mín. 1), fogo −1, tipo de bomba, soco, luva, chute, atravessa-soft (só se a casa atual não for soft/pressão), atravessa-bomba, P, fogo total. `$2B`: a cada `tick & 31 === 0`, 1 tentativa `rnd(12)+1` e depois varre 1..11.
18. **Prêmios do Racer** (`$C2:08F4`, código lido): 0 bomba+1 · 1 perfurante · 2 fogo+1 · 3 fogo total · 4 patins+1 · 5 remota+luva · 6 luva · 7 luva · 8 chute · 9 nada · 10 nada · 11 atravessa-bomba · 12 atravessa-soft · 13 patins−1 (mín. 1) · 14 soco · 15 coração · 16 P. A corrida bônus (plano 10) sorteia com `drawRacerPrize(rng) = rnd(rng, 17)`.
19. **Invisível `$29`:** contador `diseaseT` sobe 1 por tick; visível no tick se `(INVISIBLE_PATTERN[(t >> 3) & 63] >> (t & 7)) & 1` (`$C2:4E06`). O core só expõe `invisibleVisible(p)`; quem esconde é o render.
20. **Durações das ações** (ANI §3 + MEC): `lift` 4, `throw` 20, `punch` 8 (🟡: trava o movimento), `pPunch` 35 (avanço nos 4 primeiros), `detonate` 3, `stunned` 63, vítima do P `pushed` 12. Ações sem trava: `idle`, `walk`, `carryIdle`, `carryWalk`. `actT0` reinicia quando `act` ou `face` mudam.
21. **Fase `won`:** jogadores de pé ficam congelados e imunes; bombas e voadores congelam; chamas, queimas, pressão e Bad Bombers seguem. O relógio só anda em `play` (e nos 10 ticks do `intro`).
22. **Contágio:** pares em ordem de slot; passa de quem tem para quem não tem, cura quem passou, e `contactLock` (bits por slot) impede a volta até o contato acabar.
23. **Drops da morte:** categoria *k* (0..9) sai no tick `hitT0 + 22 + 4k`, mesmo que vazia. Casa: `i = rnd(113)`; até 15 vezes, se `FREE_CELLS[i]` não está livre (`code ≠ FLOOR` ou jogador de pé nela), `i = (i + rnd(8)) % 113`; depois, a 1ª livre da lista; sem nenhuma, o item se perde.
24. **Bad Bomber (🟡 A9):** nasce em `x = −16` (morreu com X < 128) ou `x = 271`, `y` = Y da morte limitado a [32, 224], anda 1 px/tick até a moldura. Na moldura, o direcional ao longo do lado move 1 px/tick; num canto vale a direção de qualquer um dos dois lados (a curva é automática); segurando a direção até o canto, ele para ali se ela deixar de fazer sentido. Não arremessa a menos de 16 px de um canto. Arremessa para dentro, com os scripts da luva, a partir de `(x, y)` com `z = −16` (horizontal) ou `y − 16` (vertical). Sai (`state = 'out'`) no gatilho da pressão; quem morre depois do gatilho não vira Bad Bomber.
25. **Rodada com todos mortos:** fica em `play` até o último `dying` acabar e então `over` DRAW `dead` no mesmo tick.
26. **Opção "Spawns aleatórios"** (extra): `permuteSpawns(seed)` (mulberry32, fora do RNG do jogo) com `seed = match.spawnSeed + roundNo`. Padrão **Não**.
27. **Semente da sessão:** `createMatch(rules, stage, seed)` aceita número (16 bits) ou `Rng16`. A tela de batalha continua passando `cfg.seed ?? app.seed()`; trocar `app.seed()` pela semente de boot persistente entre partidas é do plano 10 (`src/app/**`).
28. **Aceite da IA (§9, 50 rodadas × 10 fases)** é caro: fica em `tests/core/ai/accept.test.ts` sob `describe.skipIf(!process.env.CB_SLOW)`. Uma versão curta (5 rodadas por fase) roda sempre.
29. **Testes de ROM do plano 6:** `tests/rom/facts.test.ts` (T2) e `tests/rom/pressure-facts.test.ts` (T13).
30. **Evento de arena/montaria:** `GameEvent` ganha `{type:'stage'|'mount'; id; slot?; cell?}` para os planos 8 e 9 não precisarem editar `types.ts`. `MountModule` ganha `init?(s)` e `onStunLoss?(s, p, ev)` opcionais (aditivo).
31. **Códigos especiais vêm do `init` da arena:** a tabela lógica `$C4:0892` só tem `0000`, `CC80`, `EC40` e `2E00` (conferido na ROM para este plano). As bolas (`0F41`), setas (`0040`) e pads (`0C00`) são gravados pelos objetos da fase, isto é, pelo `StageModule.init` do plano 8. A remoção/abertura de soft grava o lógico do **mapa de piso** (`arena_rom.clear`). Na fase 4 o mapa de piso tem códigos ≥ 16 (a grama) e `$C4:0892` só cobre 0..15, o que daria `EC40`; como a §3.5, a §4.3 e a A10 mandam tratar o piso especial como piso normal, o gerador (`scripts/rom-facts/core-stages.ts`) grava `0000` quando o código do piso é ≥ 16 e a base do BG2 na casa não é `EC40` (revisão final: com `EC40` a abertura 3×3 emparedava os jogadores dos cantos).

## Testes antigos substituídos (e por quê)

Os testes antigos passam para `tests/legacy-core/` em T1 (continuam rodando contra `src/legacy-core/`) e são apagados em T21. Os de `tests/client/` são adaptados em T18/T19.

| Antigo | Substituído por | Por quê |
|---|---|---|
| `tests/core/rng.test.ts` | `tests/core/rng.test.ts` | mulberry32 → LCG da ROM |
| `tests/core/setup.test.ts` | `units.test.ts`, `setup.test.ts`, `setup-golden.test.ts` | grade 15×13 → 17×13; layout fixo → remoção aleatória; itens por peso → listas fixas |
| `tests/core/movement.test.ts` | `movement.test.ts`, `movement-golden.test.ts` | `CORNER_SUB` → tabelas de assistência de canto; intro 90 → 10+52 |
| `tests/core/bombs.test.ts` | `bombs.test.ts` | pavio 128 → 127; chama 33 → 25; cadeia 0 → +2; morte 78 → 65; `passers` → casa própria livre |
| `tests/core/abilities.test.ts` | `kick.test.ts`, `flyers.test.ts`, `actions.test.ts` | chute automático por máscara; soco 17 ticks por script; luva com mira 2–5; P = golpe em jogador |
| `tests/core/items.test.ts` | `items.test.ts`, `disease.test.ts` | 11 doenças sem duração; contágio cura quem passa; cura ao pegar item |
| `tests/core/round.test.ts` | `clock.test.ts`, `pressure.test.ts`, `round-end.test.ts`, `hit.test.ts` | pressão 205/14/36+2·lin; Morte Súbita = espiral inteira; TIME UP sempre empate |
| `tests/core/match.test.ts` | `match.test.ts`, `step.test.ts` (determinismo) | RNG atravessa rodadas; hashes do core novo |
| `tests/core/ai.test.ts`, `ai-sim.test.ts` | `tests/core/ai/*.test.ts` | unidades e tempos novos (§9) |
| `tests/core/helpers.ts`, `simkit.ts` | `tests/core/kit.ts`, `tests/core/ai/simkit.ts` | estado novo |
| `tests/client/{session,tick,view,draw-game,art,input-loop,screens}.test.ts` | os mesmos, adaptados (T18/T19) | fases `won/timeUp/over`, grade nova, `formatClock(clock)`, botão X, ícones dos itens novos |

---
## Onda 1

### Task 1: Fundação, contratos e esqueleto do passo

**Possui:** `web/src/legacy-core/**` (criado por renomeação), `web/tests/legacy-core/**` (idem), `web/src/core/**` exceto `tables/`, `web/src/render/battle-layers.ts`, `web/src/render/layers-index.ts`, `web/tests/core/{kit,units,rng,state,hooks,step}.test.ts` e `web/tests/core/kit.ts`; **só as linhas de import** de `web/src/{app/settings,app/tick,game/config,game/session,input/input,render/draw-game,render/view,screens/characters,screens/menu,screens/settings-screen,screens/stage}.ts` e `web/tests/client/*.ts`.

**Files:**
- Rename: `web/src/core/` → `web/src/legacy-core/`; `web/tests/core/` → `web/tests/legacy-core/`
- Create: `web/src/core/{types,units,rng,constants,state,hooks,hash,step,index}.ts`
- Create (stubs com assinatura final, preenchidos na onda 2): `web/src/core/{movement,setup,racer,bombs,kick,flyers,actions,items,disease,hit,clock,pressure,round-end,match,bad-bomber}.ts`
- Create: `web/src/core/stages/index.ts`, `web/src/core/mounts/index.ts`, `web/src/core/ai/hints.ts`, `web/src/core/ai/index.ts`
- Create: `web/src/render/battle-layers.ts`, `web/src/render/layers-index.ts`
- Test: `web/tests/core/kit.ts`, `web/tests/core/{units,rng,state,hooks,step}.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (todas as tarefas seguintes usam estes nomes):
  - `types.ts`: `BTN`, `DIR_BTNS`, `CODE`, `ITEM`, `DISEASE`, `FLAME_PIECE`, `BURN`, `Rules`, `defaultRules()`, `Phase`, `PlayerAct`, `Player`, `Bomb`, `FlightId`, `Flyer`, `Falling`, `PressureState`, `BadBomberState`, `RoundResult`, `RoundState`, `GameEvent`.
  - `units.ts`: `GRID_W=17`, `GRID_H=13`, `CELLS=221`, `SUB=256`, `cellOf(col,lin)`, `colOf(cell)`, `linOf(cell)`, `px(v)`, `centerX(col)`, `centerY(lin)`, `colAt(x)`, `linAt(y)`, `inGrid`, `inField`, `cellAt(x,y)` (−1 fora da grade), `cellCenter(cell): [x,y]`, `romOff(col,lin)`, `cellFromRomOff(off)`, `SPAWNS`, `spawnX(col)`, `spawnY(lin)`, `WRAP_X`, `WRAP_Y`, `faceStep(cell, face)`, `subX(x)`, `subY(y)`, `FACE_OF_DIR`.
  - `rng.ts`: `Rng16`, `BOOT_SEED=0x12`, `makeRng(seed?)`, `rnd(r,n)`, `permuteSpawns(seed): number[]`.
  - `constants.ts`: todos os tempos da §3 (lista no código), `STAGE_NAMES`, `rangeOf(fire)`.
  - `state.ts`: `createPlayer`, `isPillar`, `isWall`, `emptyRound(stage, rules, rng?)`, `isItemCode`, `isEggCode`, `itemCode(id)`, `itemOfCode(v)`, `setAct(s,p,act,left?)`, `setFace(s,p,face)`, `standing(p)`, `playerCell(p)`, `newId(s)`.
  - `hooks.ts`: `StageModule`, `MountModule` (spec §2.5 + `init?`, `onStunLoss?`).
  - `stages/index.ts`: `STAGES: StageModule[]` (11 entradas, índice = fase). `mounts/index.ts`: `NO_MOUNT`, `MOUNTS.current`.
  - `ai/hints.ts`: `AiStageHints`, `AiMountHints`. `ai/index.ts`: `AiLevel`, `AI_LEVELS`, `AiState`, `createAi`, `aiRoll`, `aiInputs` (stub: tudo 0).
  - `step.ts`: `step(s, inputs)`, `playerTick(s,p,btn,ev)`, `tickObjects(s,inputs,ev)`.
  - Assinaturas dos stubs (cada uma é implementada pela tarefa indicada):

| Arquivo (tarefa) | Exporta |
|---|---|
| `movement.ts` (T4) | `nibble(btn)`, `blockedFor(p, v): [boolean, boolean]`, `moveStep(s, p, btn, level): number`, `movePlayer(s, p, btn, ev): void` |
| `setup.ts` (T5) | `interface RoundOptions { racerPrize?: {slot:number; prize:number} \| null; spawnOrder?: readonly number[]; chars?: readonly number[] }`, `createRound(stage, rules, rng, opts?): RoundState` |
| `racer.ts` (T5) | `RACER_PRIZES = 17`, `applyRacerPrize(p, prize)`, `drawRacerPrize(rng): number` |
| `bombs.ts` (T6) | `fuseOf(p)`, `bombFireOf(p)`, `canPlaceBomb(p)`, `bombAt(s, cell)`, `bombById(s, id)`, `addBomb(s, owner, cell, init?)` (real em T1), `refundBomb(s, b)` (real em T1), `placeBomb(s, p, ev): boolean`, `explodeBomb(s, b, ev)`, `removeBomb(s, b, refund)` (real em T1), `detonateRemote(s, p, ev): boolean`, `revealCell(s, cell, ev)`, `tickBombs(s, ev)`, `tickCells(s, ev)` |
| `kick.ts` (T7) | `tryKick(s, p, ev): boolean`, `slideStep(s, b, ev)`, `stopKick(s, p)` |
| `flyers.ts` (T8) | `handFrom(x, y, dir)` (real em T1), `launchBomb(s, b, flight, dir, from): Flyer` (real em T1), `spawnItemFlyer(s, item, cell, script): Flyer` (real em T1), `aimThrow(s, cell, face, self): 2\|3\|4\|5`, `punchBomb(s, p, ev): boolean`, `startLift(s, p, ev): boolean`, `throwHeld(s, p, ev)`, `dropHeld(s, p)`, `tickFlyers(s, ev)` |
| `actions.ts` (T9) | `tickAct(s, p, ev): boolean`, `playerActions(s, p, btn, pressed, released, ev)`, `startPPunch(s, p, ev)`, `applyPush(s, p, ev): boolean` |
| `items.ts` (T10) | `applyItem(s, p, id, ev)`, `pickup(s, p, ev)`, `dropCategory(s, p, k, ev)`, `placeDropped(s, id): number`, `loseItems(s, p, n, ev)`, `leakOne(s, p, ev)` |
| `disease.ts` (T11) | `applyDiseaseInput(s, p, btn): number`, `speedLevel(s, p): number`, `tickDisease(s, p, ev)`, `inContact(a, b): boolean`, `contagion(s, ev)`, `rollSkull(s): number`, `cureAndThrow(s, p, ev)`, `invisibleVisible(p): boolean` |
| `hit.ts` (T12) | `isImmune(s, p)`, `tickInv(p)`, `checkHit(s, p, ev)`, `hitPlayer(s, p, cause, ev)`, `tickDeath(s, p, ev)`, `stunPlayer(s, p, ev)` |
| `clock.ts` (T13) | `initClock(timeIdx)` (real já em T1), `pressureTriggerSec(timeIdx)`, `clockText(c)`, `tickClock(s, ev)` |
| `pressure.ts` (T13) | `pressureSpiral(): readonly number[]`, `triggerPressure(s, ev)`, `tickPressure(s, ev)` |
| `round-end.ts` (T14) | `groupsStanding(s): number`, `checkRoundEnd(s, ev)`, `tickEndPhases(s, ev)` |
| `match.ts` (T14) | `MatchState`, `createMatch(rules, stage, seed?, chars?)`, `startRound(m)`, `finishRound(m, s)`, `setRacerPrize(m, slot, prize)`, `clearRacerPrize(m)` |
| `bad-bomber.ts` (T15) | `becomeBad(s, p)`, `tickBadBombers(s, inputs, ev)`, `clearBadBombers(s, ev)` |

- [ ] **Step 1: Mover o núcleo antigo para `legacy-core`**

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
git mv src/core src/legacy-core
git mv tests/core tests/legacy-core
# código fora do núcleo: '../core' → '../legacy-core'
grep -rl "from '\.\./core'" src | xargs sed -i '' "s#from '\.\./core'#from '../legacy-core'#"
# testes do cliente: '../../src/core' → '../../src/legacy-core'
grep -rl "src/core'" tests/client | xargs sed -i '' "s#src/core'#src/legacy-core'#"
# testes antigos do núcleo: '../../src/core/x' → '../../src/legacy-core/x'
grep -rl "src/core/" tests/legacy-core | xargs sed -i '' "s#src/core/#src/legacy-core/#g"
grep -rn "src/core\|'\.\./core'" src tests   # esperado: nada
```

- [ ] **Step 2: Conferir que nada quebrou**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 238 testes PASS, `tsc` sem erros.

- [ ] **Step 3: Escrever os testes da fundação**

`web/tests/core/kit.ts`:

```ts
import { defaultRules, type GameEvent, type Player, type RoundState, type Rules } from '../../src/core/types';
import { emptyRound } from '../../src/core/state';
import { makeRng } from '../../src/core/rng';
import { step } from '../../src/core/step';
import { cellOf, centerX, centerY } from '../../src/core/units';

export const C = cellOf;

export function rules(p: Partial<Rules> = {}): Rules {
  return { ...defaultRules(), ...p };
}

/** Arena de teste: paredes + pilares (col ímpar × lin par), sem soft; fase `play` no tick 100.
 *  Os `players` primeiros slots ficam presentes nos spawns (1 px fora do centro, como na ROM). */
export function arena(opts: { stage?: number; players?: number; rules?: Partial<Rules>; seed?: number } = {}): RoundState {
  const n = opts.players ?? 2;
  const r = rules({ active: [0, 1, 2, 3, 4].map(i => i < n), ...opts.rules });
  const s = emptyRound(opts.stage ?? 1, r, makeRng(opts.seed ?? 0x12));
  s.phase = 'play'; s.tick = 100; s.phaseT0 = 100;
  return s;
}

/** Põe o jogador `slot` no centro da casa (col, lin), deslocado (dx, dy) px. */
export function put(s: RoundState, slot: number, col: number, lin: number, dx = 0, dy = 0): Player {
  const p = s.players[slot];
  p.present = true; p.state = 'alive';
  p.x = centerX(col) + dx * 256; p.y = centerY(lin) + dy * 256;
  return p;
}

export function setCell(s: RoundState, col: number, lin: number, code: number): void { s.grid[cellOf(col, lin)] = code; }
export function codeAt(s: RoundState, col: number, lin: number): number { return s.grid[cellOf(col, lin)]; }

type Inputs = readonly number[] | ((s: RoundState) => readonly number[]);

/** Roda `n` passos; devolve todos os eventos. */
export function run(s: RoundState, n: number, inputs: Inputs = [0, 0, 0, 0, 0]): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, typeof inputs === 'function' ? inputs(s) : inputs));
  return out;
}

/** Roda até `pred` ficar verdadeiro (no máximo `max` passos). Devolve o tick em que ficou, ou −1. */
export function runUntil(s: RoundState, pred: (s: RoundState, ev: GameEvent[]) => boolean, max = 20000, inputs: Inputs = [0, 0, 0, 0, 0]): number {
  for (let i = 0; i < max; i++) {
    const ev = step(s, typeof inputs === 'function' ? inputs(s) : inputs);
    if (pred(s, ev)) return s.tick;
  }
  return -1;
}
```

`web/tests/core/units.test.ts`:

```ts
import {
  GRID_W, GRID_H, CELLS, cellOf, colOf, linOf, centerX, centerY, cellAt, romOff, cellFromRomOff,
  SPAWNS, spawnX, spawnY, faceStep, subX, subY, px, inField, FACE_OF_DIR,
} from '../../src/core/units';

describe('unidades e grade', () => {
  it('grade 17×13 e cell = lin·17 + col', () => {
    expect([GRID_W, GRID_H, CELLS]).toEqual([17, 13, 221]);
    expect(cellOf(2, 1)).toBe(19);
    expect([colOf(19), linOf(19)]).toEqual([2, 1]);
  });
  it('centro da casa em 1/256 px (X = 16·col − 1, Y = 16·(lin+2) − 1)', () => {
    expect(px(centerX(2))).toBe(31);
    expect(px(centerY(1))).toBe(47);
    expect(px(centerX(14))).toBe(223);
    expect(px(centerY(11))).toBe(207);
  });
  it('hitbox: col 10 = X 152..167; lin 1 = Y 44..55 (t25)', () => {
    const y = centerY(1);
    expect(cellAt(152 * 256, y)).toBe(cellOf(10, 1));
    expect(cellAt(167 * 256 + 255, y)).toBe(cellOf(10, 1));
    expect(cellAt(168 * 256, y)).toBe(cellOf(11, 1));
    const x = centerX(10);
    expect(cellAt(x, 44 * 256)).toBe(cellOf(10, 1));
    expect(cellAt(x, 55 * 256)).toBe(cellOf(10, 1));
    expect(cellAt(x, 56 * 256)).toBe(cellOf(10, 2));
    expect(cellAt(x, 43 * 256)).toBe(cellOf(10, 0));
  });
  it('romOff e volta: $0044 = (2,1)', () => {
    expect(romOff(2, 1)).toBe(0x44);
    expect(cellFromRomOff(0x44)).toBe(cellOf(2, 1));
    expect(cellFromRomOff(romOff(14, 11))).toBe(cellOf(14, 11));
  });
  it('spawns 1 px fora do centro, na casa certa', () => {
    expect(SPAWNS).toEqual([[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]]);
    for (const [col, lin] of SPAWNS) {
      expect(px(spawnX(col))).toBe(16 * col);
      expect(px(spawnY(lin))).toBe(16 * (lin + 2));
      expect(cellAt(spawnX(col), spawnY(lin))).toBe(cellOf(col, lin));
    }
  });
  it('faces: 0 cima, 2 direita, 4 baixo, 6 esquerda; diagonais ficam no horizontal', () => {
    const c = cellOf(5, 5);
    expect([faceStep(c, 0), faceStep(c, 2), faceStep(c, 4), faceStep(c, 6)]).toEqual([cellOf(5, 4), cellOf(6, 5), cellOf(5, 6), cellOf(4, 5)]);
    expect(FACE_OF_DIR).toEqual([0, 2, 2, 2, 4, 6, 6, 6]);
  });
  it('subposição: centro = (7,7)', () => {
    expect([subX(centerX(4)), subY(centerY(3))]).toEqual([7, 7]);
    expect(subX(centerX(4) - 256)).toBe(6);
  });
  it('campo jogável col 2..14 × lin 1..11', () => {
    expect(inField(2, 1) && inField(14, 11)).toBe(true);
    expect(inField(1, 5) || inField(15, 5) || inField(5, 0) || inField(5, 12)).toBe(false);
  });
});
```

`web/tests/core/rng.test.ts`:

```ts
import { makeRng, rnd, BOOT_SEED, permuteSpawns } from '../../src/core/rng';

describe('RNG da ROM ($C3:54B3)', () => {
  it('boot $12: 5 chamadas rnd($FF) dão 66, 79, 196, 147, 197 e a semente vira $C689 (t52)', () => {
    const r = makeRng();
    expect(BOOT_SEED).toBe(0x12);
    expect([0, 0, 0, 0, 0].map(() => rnd(r, 0xffff))).toEqual([66, 79, 196, 147, 197]);
    expect(r.seed).toBe(0xc689);
  });
  it('remoção de blocos começa com col/lin 2,5 9,6 6,0 12,0 3,2 9,5 e a semente $77F9', () => {
    const r = makeRng(0xc689);
    const v: number[] = [];
    for (let i = 0; i < 6; i++) { v.push(rnd(r, 13)); v.push(rnd(r, 11)); }
    expect(v).toEqual([2, 5, 9, 6, 6, 0, 12, 0, 3, 2, 9, 5]);
    expect(r.seed).toBe(0x77f9);
  });
  it('só n & $FF importa: rnd(256) é sempre 0 mas avança a semente', () => {
    const r = makeRng(0x1234);
    expect(rnd(r, 256)).toBe(0);
    expect(r.seed).toBe(((0x1235 * 0x383) & 0xffff));
  });
  it('semente de 16 bits, serializável', () => {
    const r = makeRng(0x12345);
    expect(r.seed).toBe(0x2345);
    const copy = JSON.parse(JSON.stringify(r));
    expect(rnd(copy, 100)).toBe(rnd(makeRng(0x2345), 100));
  });
  it('permuteSpawns: permutação determinística de 0..4, fora do RNG do jogo', () => {
    const a = permuteSpawns(7), b = permuteSpawns(7);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
    const distinct = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => permuteSpawns(k).join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
```

`web/tests/core/state.test.ts`:

```ts
import { CODE, defaultRules } from '../../src/core/types';
import { emptyRound, itemCode, itemOfCode, isItemCode, isEggCode, setAct, setFace, createPlayer, isPillar } from '../../src/core/state';
import { rangeOf, STAGE_NAMES } from '../../src/core/constants';
import { cellOf } from '../../src/core/units';

describe('estado', () => {
  it('rodada vazia: paredes nas bordas, pilares em col ímpar × lin par, resto piso', () => {
    const s = emptyRound(1, defaultRules());
    expect(s.grid.length).toBe(221);
    expect(s.grid[cellOf(1, 5)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(15, 5)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(8, 0)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(8, 12)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(3, 2)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(2, 2)]).toBe(CODE.FLOOR);
    expect(isPillar(13, 10) && !isPillar(14, 10)).toBe(true);
    expect(s.phase).toBe('intro');
    expect(s.clock).toEqual({ sec: 181, sub: 1 });
  });
  it('jogador inicial: nível 1, 1 bomba, fogo 0, sem invencibilidade, olhando para baixo', () => {
    const p = createPlayer(0, true);
    expect([p.speedLv, p.bombsCap, p.bombsFree, p.fire, p.inv, p.face, p.costume, p.carry]).toEqual([1, 1, 1, 0, 0, 4, -1, -1]);
    expect(p.act).toBe('idle');
  });
  it('códigos de item: 0940+id, caveira 0980+id, ovo 0970+t', () => {
    expect(itemCode(0x01)).toBe(0x0941);
    expect(itemCode(0x21)).toBe(0x09a1);
    expect(itemCode(0x3a)).toBe(0x097a);
    for (const id of [0x01, 0x0f, 0x12, 0x21, 0x2b, 0x30, 0x3f]) expect(itemOfCode(itemCode(id))).toBe(id);
    expect(isItemCode(0x0941) && isItemCode(0x09a1) && !isItemCode(CODE.BOMB) && !isItemCode(CODE.PAD)).toBe(true);
    expect(isEggCode(0x097c) && !isEggCode(0x0941)).toBe(true);
  });
  it('alcance: fogo 0..8 → 2..10, fogo 9 → 10, fogo 10 → 1', () => {
    expect([0, 1, 7, 8, 9, 10].map(rangeOf)).toEqual([2, 3, 9, 10, 10, 1]);
  });
  it('setAct/setFace reiniciam actT0 só quando mudam', () => {
    const s = emptyRound(1, defaultRules());
    const p = s.players[0];
    s.tick = 50; setAct(s, p, 'walk'); expect(p.actT0).toBe(50);
    s.tick = 60; setAct(s, p, 'walk'); expect(p.actT0).toBe(50);
    s.tick = 70; setFace(s, p, 2); expect(p.actT0).toBe(70);
    s.tick = 80; setAct(s, p, 'throw', 20); expect([p.actT0, p.actLeft]).toEqual([80, 20]);
  });
  it('nomes das fases em PT-BR', () => {
    expect(STAGE_NAMES).toEqual(['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
      'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria']);
  });
});
```

`web/tests/core/hooks.test.ts`:

```ts
import { STAGES } from '../../src/core/stages';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';
import { romLayers, fallbackLayers, registerRomLayer, registerFallbackLayer } from '../../src/render/battle-layers';
import { emptyRound } from '../../src/core/state';
import { defaultRules } from '../../src/core/types';

describe('pontos de extensão (§2.5)', () => {
  it('STAGES tem 11 entradas (índice = fase) e começam vazias', () => {
    expect(STAGES.length).toBe(11);
    for (let n = 1; n <= 10; n++) expect(Object.keys(STAGES[n])).toEqual([]);
  });
  it('montaria padrão é no-op', () => {
    const s = emptyRound(1, defaultRules());
    const p = s.players[0];
    expect(MOUNTS.current).toBe(NO_MOUNT);
    expect(NO_MOUNT.onHit(s, p, [])).toBe(false);
    expect(NO_MOUNT.onY(s, p, [])).toBe(false);
    NO_MOUNT.tick(s, []);
    NO_MOUNT.revealEgg(s, 20, []);
    NO_MOUNT.stepOnEgg(s, p, 20, []);
  });
  it('registros de camadas começam vazios e aceitam registro', () => {
    expect(romLayers.length).toBe(0);
    expect(fallbackLayers.length).toBe(0);
    registerRomLayer({ id: 't', draw() {} });
    registerFallbackLayer({ id: 't', draw() {} });
    expect(romLayers.map(l => l.id)).toEqual(['t']);
    expect(fallbackLayers.map(l => l.id)).toEqual(['t']);
    romLayers.length = 0; fallbackLayers.length = 0;
  });
});
```

`web/tests/core/step.test.ts`:

```ts
import { step } from '../../src/core/step';
import { emptyRound } from '../../src/core/state';
import { defaultRules, BTN } from '../../src/core/types';
import { INTRO_TICKS } from '../../src/core/constants';

describe('esqueleto do passo', () => {
  it('intro: 62 ticks e então play; entradas só atualizam prevBtn', () => {
    const s = emptyRound(1, defaultRules());
    expect(INTRO_TICKS).toBe(62);
    for (let i = 1; i < 62; i++) { step(s, [BTN.A, 0, 0, 0, 0]); expect(s.phase).toBe('intro'); }
    step(s, [BTN.A, 0, 0, 0, 0]);
    expect([s.tick, s.phase, s.phaseT0]).toEqual([62, 'play', 62]);
    expect(s.players[0].prevBtn).toBe(BTN.A);
  });
  it('over: step não avança nem emite', () => {
    const s = emptyRound(1, defaultRules());
    s.phase = 'over';
    expect(step(s, [0, 0, 0, 0, 0])).toEqual([]);
    expect(s.tick).toBe(0);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/core`
Expected: FAIL (módulos `src/core/*` não existem).

- [ ] **Step 5: Escrever `types.ts`**

```ts
import type { Rng16 } from './rng';

export const BTN = {
  UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128, X: 256, L: 512, R: 1024, SELECT: 2048,
} as const;
export const DIR_BTNS = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT;

/** Códigos de 16 bits da grade lógica da ROM ($7E:2800), spec §3.1. */
export const CODE = {
  FLOOR: 0x0000, HARD: 0xec40, SOFT: 0xcc80, BOMB: 0xc900, BURNING: 0xedc0, PRESSURE: 0xee80,
  FLAME: 0x1000, ITEM: 0x0940, SKULL: 0x0980, FALLING: 0x0001, ORB: 0x0f41, ARROW: 0x0040,
  PAD: 0x0c00, PAD_FLAME: 0x1c00,
} as const;

/** IDs de item da ROM (tabela $C1:60A0). */
export const ITEM = {
  BOMB: 0x01, PIERCE: 0x02, FIRE: 0x03, FULL_FIRE: 0x04, SPEED: 0x05, REMOTE: 0x06, GLOVE: 0x07, VEST: 0x08,
  HEART: 0x09, PASS_SOFT: 0x0a, PASS_BOMB: 0x0b, CLOCK: 0x0c, PUNCH: 0x0d, KICK: 0x0e, COSTUME: 0x0f,
  STAR: 0x11, P: 0x12, SKULL: 0x21, EGG: 0x30,
} as const;

export const DISEASE = {
  FAST: 0x21, SLOW: 0x22, DIARRHEA: 0x23, CONSTIPATION: 0x24, LOW_FIRE: 0x25, NO_STOP: 0x26,
  SHORT_FUSE: 0x27, LONG_FUSE: 0x28, INVISIBLE: 0x29, REVERSE: 0x2a, LEAK: 0x2b, SWAP: 0x2c,
} as const;

/** Peça da chama guardada em cellAux quando grid = FLAME (o render mapeia para as palavras da §7.1). */
export const FLAME_PIECE = {
  CENTER: 0, ARM_UP: 1, ARM_RIGHT: 2, ARM_DOWN: 3, ARM_LEFT: 4, TIP_UP: 5, TIP_RIGHT: 6, TIP_DOWN: 7, TIP_LEFT: 8,
} as const;

/** Tipo de queima em cellAux quando grid = BURNING. */
export const BURN = { SOFT: 0, ITEM: 1 } as const;

export interface Rules {
  cpuLevel: 0 | 1 | 2;
  matches: number;          // coroas para vencer (1..5)
  timeIdx: number;          // 0..4 → 1:00, 2:00, 3:00, 5:00, ∞
  suddenDeath: boolean;
  badBomber: boolean;
  racer: boolean;
  randomSpawns: boolean;    // extra, não original (§6.13); padrão Não
  mode: 'ffa' | 'team';
  teams: number[];          // time de cada slot (0/1)
  active: boolean[];        // slot participa?
}

export function defaultRules(): Rules {
  return {
    cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false, racer: false,
    randomSpawns: false, mode: 'ffa', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, true],
  };
}

export type Phase = 'intro' | 'play' | 'won' | 'timeUp' | 'over';

export type PlayerAct = 'idle' | 'walk' | 'lift' | 'carryIdle' | 'carryWalk' | 'throw' | 'punch' | 'pPunch'
  | 'detonate' | 'stunned' | 'dying' | 'victory' | 'mounting' | 'dismount' | 'launched' | 'pushed' | 'shocked'
  | 'dance' | 'bad';

export interface Player {
  slot: number; present: boolean; char: number; team: number;
  x: number; y: number;                  // 1/256 px, coordenadas de tela (+$11..$13 / +$15..$17)
  moveDir: number;                       // 0..7, 8 = parado (+$60)
  face: 0 | 2 | 4 | 6;                   // +$62
  lastDir: number;                       // últimos botões de direção apertados (doença $26)
  speedLv: number; bombsCap: number; bombsFree: number; fire: number; fullFire: boolean;
  bombType: 0 | 1 | 2; glove: boolean; punch: boolean; kick: boolean; pItem: boolean;
  passSoft: boolean; passBomb: boolean; heart: boolean;
  costume: number;                       // -1 ou 0..7
  disease: number;                       // 0 ou $21..$2B
  diseaseT: number;                      // contador +$4E (padrão do invisível)
  contactLock: number;                   // bits por slot: contágio travado enquanto dura o contato
  inv: number;                           // invencibilidade em ticks (+$96)
  effect: { kind: 0 | 2 | 0x0a; left: number };   // +$E4/+$E6: 2 = lento (montaria E), $0A = invertido (arena 6)
  act: PlayerAct; actT0: number; actLeft: number; // actLeft > 0 = ação travada
  carry: number;                         // id da bomba na mão (luva) ou -1
  throwQueued: boolean;                  // A solto durante o levantamento
  push: { vx: number; vy: number; left: number }; // movimento forçado (P, empurrão), 1/256 px por tick
  walkT: number;                         // ticks andando (passo a cada 20)
  state: 'alive' | 'dying' | 'out' | 'bad';
  hitT0: number;                         // tick do acerto fatal (-1)
  prevBtn: number;
  mount: unknown | null;                 // plano 9
}

export interface Bomb {
  id: number; owner: number;             // slot do dono (o Bad Bomber usa o próprio slot)
  bad: boolean;                          // bomba de Bad Bomber (cadência própria)
  cell: number; x: number; y: number;    // casa atual e centro em 1/256 px (anda no chute)
  fuse: number;                          // contador da ROM (126 normal); explode ao ser processada com 0
  fire: number;                          // nível de fogo; alcance = rangeOf(fire)
  type: 0 | 1 | 2;                       // 0 normal, 1 remota, 2 perfurante
  state: 'idle' | 'kicked' | 'held' | 'air';
  dir: 0 | 2 | 4 | 6; step: number; kickedBy: number;   // chute
  turn: number;                          // chute: nova face ao chegar na próxima casa (-1 = nenhuma; arena 7)
  chainAt: number;                       // tick marcado para explodir (0 = não)
  born: number;                          // tick de criação
}

export type FlightId = 'punch' | 'bounce' | 'throw2' | 'throw3' | 'throw4' | 'throw5' | 'item';

export interface Flyer {
  id: number; kind: 'bomb' | 'item';
  ref: number;                           // id da bomba ou id do item/caveira
  x: number; y: number;                  // chão, 1/256 px
  z: number;                             // altura em px (≤ 0 = acima do chão); o render desenha em (x, y + z·256)
  dir: 0 | 1 | 2 | 3;                    // 0 cima, 1 direita, 2 baixo, 3 esquerda (índice dos scripts)
  flight: FlightId; script: number;      // script = índice em ITEM_FLIGHT quando flight = 'item'
  i: number;                             // passo atual do script
  born: number;
}

export interface Falling { cell: number; t0: number; land: number }

export interface PressureState {
  trigger: number;                       // tick T do gatilho (-1 = ainda não)
  next: number;                          // próximo índice da espiral
  total: number;                         // 80 ou 143 passos
  falling: Falling[];
}

export interface BadBomberState {
  slot: number; x: number; y: number;    // px inteiros na moldura (X ∈ {15, 239}, Y ∈ {32, 224})
  phase: 'enter' | 'patrol';
  face: 0 | 2 | 4 | 6;
  live: number;                          // id da bomba arremessada ainda viva (-1)
  readyAt: number;                       // tick a partir do qual pode pegar outra bomba
}

export interface RoundResult { kind: 'win' | 'draw'; winner: number | null; reason: 'last' | 'dead' | 'time' }

export interface RoundState {
  tick: number; phase: Phase; phaseT0: number;
  stage: number; rules: Rules; rng: Rng16;
  clock: { sec: number; sub: number };
  grid: number[]; cellT0: number[]; cellAux: number[];
  floor: number[];                       // palavra de BG do piso por casa; 0 = a da ROM (arena 6 repinta)
  hidden: [number, number][];            // (cell, item), consumida ao revelar
  players: Player[];                     // 5 slots; present = false para Nenhum
  bombs: Bomb[]; flyers: Flyer[];
  pressure: PressureState; bad: BadBomberState[];
  stageState: unknown; mountState: unknown;
  diseaseOnce24: boolean;                // $1EE4
  result: RoundResult | null;
  nextId: number;
  lastHit: number;                       // tick do último acerto fatal
  endAt: number;                         // tick em que a vitória é decidida (0 = ainda não)
  celebT0: number;                       // início dos 128 ticks de comemoração (-1)
  counted: boolean;                      // finishRound já contou a coroa
}

export type GameEvent =
  | { type: 'bomb_placed'; slot: number; cell: number }
  | { type: 'explosion'; cell: number; owner: number }
  | { type: 'item_picked'; slot: number; item: number }
  | { type: 'disease_passed'; from: number; to: number }
  | { type: 'footstep'; slot: number }
  | { type: 'bomb_kicked'; slot: number }
  | { type: 'punch'; slot: number }
  | { type: 'p_punch'; slot: number }
  | { type: 'throw'; slot: number }
  | { type: 'bomb_bounce'; cell: number }
  | { type: 'bomb_landed'; cell: number }
  | { type: 'player_hit'; slot: number }
  | { type: 'stunned'; slot: number }
  | { type: 'hurry' }
  | { type: 'pressure_step'; cell: number }
  | { type: 'victory_sfx'; slot: number }
  | { type: 'time_up' }
  | { type: 'round_over'; result: RoundResult }
  | { type: 'stage'; id: string; slot?: number; cell?: number }   // eventos das arenas (plano 8)
  | { type: 'mount'; id: string; slot?: number; cell?: number };  // eventos das montarias (plano 9)
```

- [ ] **Step 6: Escrever `units.ts`, `rng.ts`, `constants.ts`, `hash.ts`**

`units.ts`:

```ts
export const GRID_W = 17;
export const GRID_H = 13;
export const CELLS = GRID_W * GRID_H;
export const SUB = 256;

export const cellOf = (col: number, lin: number): number => lin * GRID_W + col;
export const colOf = (cell: number): number => cell % GRID_W;
export const linOf = (cell: number): number => Math.floor(cell / GRID_W);
/** 1/256 px → px (piso, vale para negativos). */
export const px = (v: number): number => Math.floor(v / SUB);
export const centerX = (col: number): number => (16 * col - 1) * SUB;
export const centerY = (lin: number): number => (16 * (lin + 2) - 1) * SUB;
export const colAt = (x: number): number => Math.floor((px(x) + 8) / 16);
export const linAt = (y: number): number => Math.floor((px(y) + 8) / 16) - 2;
export const inGrid = (col: number, lin: number): boolean => col >= 0 && col < GRID_W && lin >= 0 && lin < GRID_H;
export const inField = (col: number, lin: number): boolean => col >= 2 && col <= 14 && lin >= 1 && lin <= 11;
/** Casa do ponto (x, y); -1 fora da grade. */
export function cellAt(x: number, y: number): number {
  const col = colAt(x), lin = linAt(y);
  return inGrid(col, lin) ? cellOf(col, lin) : -1;
}
export const cellCenter = (cell: number): [number, number] => [centerX(colOf(cell)), centerY(linOf(cell))];
/** Offset na grade da ROM $7E:2800 (para comparar com traços): lin·$40 + col·2. */
export const romOff = (col: number, lin: number): number => lin * 0x40 + col * 2;
export const cellFromRomOff = (off: number): number => cellOf((off & 0x3f) >> 1, off >> 6);

/** Casas (col, lin) de P1..P5. */
export const SPAWNS: readonly (readonly [number, number])[] = [[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]];
/** Spawn 1 px fora do centro: (16·col, 16·(lin+2)). */
export const spawnX = (col: number): number => 16 * col * SUB;
export const spawnY = (lin: number): number => 16 * (lin + 2) * SUB;

/** Volta pela borda: 17 colunas (272 px) e 13 linhas (208 px). */
export const WRAP_X = 272 * SUB;
export const WRAP_Y = 208 * SUB;

const FACE_DCOL = [0, 0, 1, 0, 0, 0, -1, 0];
const FACE_DLIN = [-1, 0, 0, 0, 1, 0, 0, 0];
export const faceDcol = (face: number): number => FACE_DCOL[face];
export const faceDlin = (face: number): number => FACE_DLIN[face];
/** Casa vizinha na face (0 cima, 2 direita, 4 baixo, 6 esquerda). */
export const faceStep = (cell: number, face: number): number => cell + FACE_DLIN[face] * GRID_W + FACE_DCOL[face];
/** Face a partir da direção de movimento 0..7 (diagonais ficam no horizontal). */
export const FACE_OF_DIR: readonly (0 | 2 | 4 | 6)[] = [0, 2, 2, 2, 4, 6, 6, 6];
/** Subposição dentro da casa (0..15; centro = 7), como ((X−8) & 15) da ROM. */
export const subX = (x: number): number => (px(x) - 8) & 15;
export const subY = (y: number): number => (px(y) - 8) & 15;
```

`rng.ts`:

```ts
export interface Rng16 { seed: number }

export const BOOT_SEED = 0x0012;

export function makeRng(seed: number = BOOT_SEED): Rng16 {
  return { seed: seed & 0xffff };
}

/** RNG da ROM ($C3:54B3): 0..n-1; só (n & $FF) importa. */
export function rnd(r: Rng16, n: number): number {
  r.seed = ((r.seed | 1) * 0x383) & 0xffff;
  return (r.seed * (n & 0xff)) >>> 16;
}

/** Ordem aleatória dos spawns (opção extra, §6.13). mulberry32 separado: não toca no RNG do jogo. */
export function permuteSpawns(seed: number): number[] {
  let t = seed >>> 0;
  const next = (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const a = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const k = a[i]; a[i] = a[j]; a[j] = k;
  }
  return a;
}
```

`constants.ts`:

```ts
/** Contador do pavio (explode 127 ticks depois de colocada). */
export const FUSE = 126;
/** Contador do pavio com as caveiras $27 / $28 ($C1:56E8 = [62, 253, 126]). */
export const FUSE_SHORT = 62;
export const FUSE_LONG = 253;
export const FLAME_TICKS = 25;
export const BURN_TICKS = 24;
export const CHAIN_DELAY = 2;
/** Morte: animação 1..21, drops a partir de 22 a cada 4, fora de jogo em 65. */
export const DEATH_ANIM_END = 21;
export const DROP_START = 22;
export const DROP_EVERY = 4;
export const OUT_AT = 65;
export const STUN_TICKS = 63;
export const HIT_INV = 96;
export const VEST_INV = 511;
/** Máximos por item: o item só sobe se valor+1 < limite ($C0:0B4C/48/50 = 9, 8, 6). */
export const MAX_BOMBS = 8;
export const MAX_FIRE = 7;
export const MAX_SPEED = 5;
export const INTRO_CLOCK_TICKS = 10;
export const INTRO_TICKS = 62;           // 10 com relógio + 15 de fade-in + 37 parados
export const WIN_DELAY = 2;
export const CELEBRATE_TICKS = 128;
export const VICTORY_SFX_AT = 31;
export const TIME_UP_TICKS = 160;
export const HURRY_BAND_TICKS = 192;
export const PRESSURE_BORDER_AT = 192;
export const PRESSURE_FIRST = 205;
export const PRESSURE_EVERY = 14;
export const PRESSURE_STEPS_NORMAL = 80;
export const PRESSURE_STEPS_SD = 143;
export const fallTicks = (lin: number): number => 36 + 2 * lin;
export const TIME_MINUTES = [1, 2, 3, 5, 30];
export const CLOCK_FROZEN_FROM = 600;
export const LIFT_TICKS = 4;
export const THROW_TICKS = 20;
export const PUNCH_TICKS = 8;
export const DETONATE_TICKS = 3;
export const P_TICKS = 35;
export const P_ADVANCE_TICKS = 4;
export const P_SPEED = 4 * 256;           // 4 px/tick
export const P_PUSH_TICKS = 12;
export const KICK_STEPS = 8;              // 8 passos de 2 px por casa
export const BAD_COOLDOWN = 48;
export const FOOTSTEP_EVERY = 20;
export const CONTACT_PX = 8;
export const LEAK_EVERY = 32;
export const BOREDOM_TICKS = 383;         // só visual (plano 7)

export const STAGE_NAMES = [
  'O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria',
];

/** Alcance da chama pelo nível de fogo: 0..8 → 2..10; 9 → 10; 10 → 1 (caveira $25). */
export const rangeOf = (fire: number): number => (fire === 10 ? 1 : Math.min(fire, 8) + 2);
```

`hash.ts`: copiar `src/legacy-core/hash.ts` sem mudanças.

- [ ] **Step 7: Escrever `state.ts`, `hooks.ts`, registros e dicas de IA**

`state.ts`:

```ts
import { CODE, type Player, type PlayerAct, type RoundState, type Rules } from './types';
import { makeRng, type Rng16 } from './rng';
import { CELLS, GRID_H, GRID_W, SPAWNS, cellAt, cellOf, spawnX, spawnY } from './units';
import { PRESSURE_STEPS_NORMAL, PRESSURE_STEPS_SD } from './constants';
import { initClock } from './clock';

export function createPlayer(slot: number, present: boolean, team = 0, char = slot): Player {
  const [col, lin] = SPAWNS[slot];
  return {
    slot, present, char, team,
    x: spawnX(col), y: spawnY(lin), moveDir: 8, face: 4, lastDir: 0,
    speedLv: 1, bombsCap: 1, bombsFree: 1, fire: 0, fullFire: false,
    bombType: 0, glove: false, punch: false, kick: false, pItem: false,
    passSoft: false, passBomb: false, heart: false, costume: -1,
    disease: 0, diseaseT: 0, contactLock: 0, inv: 0, effect: { kind: 0, left: 0 },
    act: 'idle', actT0: 0, actLeft: 0, carry: -1, throwQueued: false,
    push: { vx: 0, vy: 0, left: 0 }, walkT: 0,
    state: present ? 'alive' : 'out', hitT0: -1, prevBtn: 0, mount: null,
  };
}

/** Pilar da grade padrão: col ímpar × lin par dentro do campo, ex.: (3,2). */
export const isPillar = (col: number, lin: number): boolean =>
  col >= 3 && col <= 13 && lin >= 2 && lin <= 10 && col % 2 === 1 && lin % 2 === 0;
export const isWall = (col: number, lin: number): boolean => col <= 1 || col >= 15 || lin === 0 || lin === 12;

/** Rodada sem blocos (paredes + pilares), fase intro. Base para createRound e para os testes. */
export function emptyRound(stage: number, rules: Rules, rng: Rng16 = makeRng()): RoundState {
  const grid = new Array<number>(CELLS).fill(CODE.FLOOR);
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 0; col < GRID_W; col++) {
    if (isWall(col, lin) || isPillar(col, lin)) grid[cellOf(col, lin)] = CODE.HARD;
  }
  return {
    tick: 0, phase: 'intro', phaseT0: 0, stage, rules, rng, clock: initClock(rules.timeIdx),
    grid, cellT0: new Array<number>(CELLS).fill(0), cellAux: new Array<number>(CELLS).fill(0),
    floor: new Array<number>(CELLS).fill(0), hidden: [],
    players: [0, 1, 2, 3, 4].map(i => createPlayer(i, rules.active[i] ?? false, rules.teams[i] ?? 0)),
    bombs: [], flyers: [],
    pressure: { trigger: -1, next: 0, total: rules.suddenDeath ? PRESSURE_STEPS_SD : PRESSURE_STEPS_NORMAL, falling: [] },
    bad: [], stageState: null, mountState: null, diseaseOnce24: false, result: null,
    nextId: 1, lastHit: -1, endAt: 0, celebT0: -1, counted: false,
  };
}

export const isItemCode = (v: number): boolean => (v & 0xff00) === 0x0900;
export const isEggCode = (v: number): boolean => v >= 0x0970 && v <= 0x097f;
/** Palavra da grade para o item `id`: 0940+id; caveira ($20..$2F) 0980+id. */
export const itemCode = (id: number): number => (id >= 0x20 && id < 0x30 ? CODE.SKULL + id : CODE.ITEM + id);
export const itemOfCode = (v: number): number => { const lo = v & 0xff; return lo >= 0x80 ? lo - 0x80 : lo - 0x40; };

/** Troca a ação; reinicia actT0 só quando muda (como $C1:7657). `left` > 0 trava a ação. */
export function setAct(s: RoundState, p: Player, act: PlayerAct, left = 0): void {
  if (p.act !== act) { p.act = act; p.actT0 = s.tick; }
  p.actLeft = left;
}
export function setFace(s: RoundState, p: Player, face: 0 | 2 | 4 | 6): void {
  if (p.face !== face) { p.face = face; p.actT0 = s.tick; }
}
export const standing = (p: Player): boolean => p.present && p.state === 'alive';
export const playerCell = (p: Player): number => cellAt(p.x, p.y);
export const newId = (s: RoundState): number => s.nextId++;
```

`hooks.ts`:

```ts
import type { Bomb, GameEvent, Player, RoundState } from './types';
import type { AiMountHints, AiStageHints } from './ai/hints';

/** Módulo de arena (plano 8). Todos os ganchos são opcionais. */
export interface StageModule {
  /** Depois da remoção de soft e ANTES dos itens (consome RNG na ordem da ROM). */
  init?(s: RoundState): void;
  /** Passo 5 da §3.4. */
  tick?(s: RoundState, ev: GameEvent[]): void;
  /** Arena 2: nível de velocidade efetivo (recebe o nível já com doença). */
  speedLevel?(s: RoundState, p: Player, lv: number): number;
  /** Arena 2: quanto o pavio cai neste tick (0, 1 ou 2). */
  fuseStep?(s: RoundState, b: Bomb): number;
  /** Arenas 3, 6, 8: casa de chama com código especial, ou toda casa de chama (a arena decide). */
  onFlameCell?(s: RoundState, cell: number, armDir: number, ev: GameEvent[]): void;
  /** Arenas 6, 9: o jogador entrou numa casa. */
  onEnterCell?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  /** Arena 8: jogador de pé na casa (chamado todo tick). */
  onStand?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  /** Arenas 6, 7: bomba chutada prestes a entrar em `cell`. */
  kickedBombEnter?(s: RoundState, b: Bomb, cell: number): 'go' | 'stop' | { turn: number };
  /** Arena 5 (cerca): chamado a cada tick de movimento forçado. */
  outOfBounds?(s: RoundState, p: Player, ev: GameEvent[]): void;
  ai?: AiStageHints;
}

/** Ovos e montarias (plano 9). */
export interface MountModule {
  init?(s: RoundState): void;
  revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void;          // item $30 revelado
  stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  onHit(s: RoundState, p: Player, ev: GameEvent[]): boolean;               // true = absorveu o golpe
  onY(s: RoundState, p: Player, ev: GameEvent[]): boolean;                 // true = consumiu o Y
  onStunLoss?(s: RoundState, p: Player, ev: GameEvent[]): boolean;         // true = perdeu a montaria no atordoamento
  passes?(p: Player, code: number): boolean;                                // tipo 2 atravessa soft
  bombType?(p: Player): 0 | 1 | 2 | null;                                   // tipo 3: bomba perfurante
  kicks?(p: Player): boolean;                                               // tipo A
  tick(s: RoundState, ev: GameEvent[]): void;                               // projéteis, ovo reserva
  ai?: AiMountHints;
}
```

`stages/index.ts`:

```ts
import type { StageModule } from '../hooks';

/** STAGES[n] = módulo da fase n (1..10); índice 0 sem uso. O plano 8 só ACRESCENTA linhas no fim deste
 *  arquivo, no formato `import { stageN } from './stageN'; STAGES[N] = stageN;`. */
export const STAGES: StageModule[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
```

`mounts/index.ts`:

```ts
import type { MountModule } from '../hooks';

export const NO_MOUNT: MountModule = {
  revealEgg() {}, stepOnEgg() {}, onHit: () => false, onY: () => false, tick() {},
};

/** Módulo de montarias ativo. O plano 9 só ACRESCENTA no fim: `import { eggs } from './eggs'; MOUNTS.current = eggs;`. */
export const MOUNTS: { current: MountModule } = { current: NO_MOUNT };
```

`ai/hints.ts`:

```ts
import type { RoundState } from '../types';

/** Dicas de IA por arena (plano 8). Tudo opcional; ausente = regra padrão. */
export interface AiStageHints {
  /** Casas a evitar agora (ex.: arena 6, piso-caveira). */
  avoid?(s: RoundState, slot: number): readonly number[];
  /** Casa onde para uma bomba chutada de `cell` na `face` (arena 7: setas). null = regra padrão. */
  kickEnd?(s: RoundState, cell: number, face: number): number | null;
  /** Casas-alvo com prioridade (arena 8: pad para frear). */
  goals?(s: RoundState, slot: number): readonly number[];
  /** Perigo extra: casa → ticks até ficar mortal (arena 3: rota das bolas). */
  danger?(s: RoundState): ReadonlyMap<number, number>;
}

/** Dicas de IA das montarias (plano 9). */
export interface AiMountHints {
  /** Deve apertar Y agora? */
  useY?(s: RoundState, slot: number): boolean;
  /** Valor de ir buscar o ovo na casa (0 = ignorar). */
  eggValue?(s: RoundState, slot: number, cell: number): number;
}
```

`ai/index.ts` (stub; T17 substitui):

```ts
import type { RoundState } from '../types';

export interface AiLevel { react: number; mistake: number; hunt: boolean; margin: number; open: boolean; alert: number; trap: boolean; wary: boolean }

/** Fraco, Normal, Forte (índice = rules.cpuLevel). Mesmos valores do legado. */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4, open: false, alert: 20, trap: false, wary: false },
  { react: 8, mistake: 5, hunt: true, margin: 8, open: true, alert: 2, trap: false, wary: true },
  { react: 2, mistake: 0, hunt: true, margin: 4, open: true, alert: 0, trap: true, wary: false },
];

export interface AiState { round: RoundState | null; brains: unknown[]; bombsSig: number }

export function createAi(): AiState { return { round: null, brains: [], bombsSig: 0 }; }

/** 0..99 derivado só de (tick, slot, sal): a IA não consome o RNG do jogo. */
export function aiRoll(tick: number, slot: number, salt: number): number {
  let h = Math.imul(tick + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}

export function aiInputs(_s: RoundState, _ai: AiState, _cpu: readonly boolean[], _levelIdx: number): number[] {
  return [0, 0, 0, 0, 0];
}
```

- [ ] **Step 8: Escrever os stubs dos módulos da onda 2**

Cada stub tem a assinatura final e corpo mínimo; a tarefa dona substitui o arquivo inteiro. `clock.ts` já traz `initClock` real.

```ts
// clock.ts (T13)
import type { GameEvent, RoundState } from './types';
import { TIME_MINUTES } from './constants';
export function initClock(timeIdx: number): { sec: number; sub: number } {
  return { sec: (TIME_MINUTES[timeIdx] ?? 3) * 60 + 1, sub: 1 };
}
export function pressureTriggerSec(timeIdx: number): number { return timeIdx === 0 ? 41 : 61; }
export function clockText(c: { sec: number }): string { return `${Math.floor(c.sec / 60)}:${String(c.sec % 60).padStart(2, '0')}`; }
export function tickClock(_s: RoundState, _ev: GameEvent[]): void {}
```

```ts
// pressure.ts (T13)
import type { GameEvent, RoundState } from './types';
export function pressureSpiral(): readonly number[] { return []; }
export function triggerPressure(_s: RoundState, _ev: GameEvent[]): void {}
export function tickPressure(_s: RoundState, _ev: GameEvent[]): void {}
```

```ts
// movement.ts (T4)
import { BTN, type GameEvent, type Player, type RoundState } from './types';
export function nibble(btn: number): number {
  return (btn & BTN.RIGHT ? 1 : 0) | (btn & BTN.LEFT ? 2 : 0) | (btn & BTN.DOWN ? 4 : 0) | (btn & BTN.UP ? 8 : 0);
}
export function blockedFor(_p: Player, _v: number): [boolean, boolean] { return [false, false]; }
export function moveStep(_s: RoundState, _p: Player, _btn: number, _level: number): number { return 8; }
export function movePlayer(_s: RoundState, _p: Player, _btn: number, _ev: GameEvent[]): void {}
```

```ts
// setup.ts (T5)
import type { RoundState, Rules } from './types';
import type { Rng16 } from './rng';
import { emptyRound } from './state';
export interface RoundOptions {
  racerPrize?: { slot: number; prize: number } | null;
  spawnOrder?: readonly number[];
  chars?: readonly number[];
}
export function createRound(stage: number, rules: Rules, rng: Rng16, _opts: RoundOptions = {}): RoundState {
  return emptyRound(stage, rules, rng);
}
```

```ts
// racer.ts (T5)
import type { Player } from './types';
import { rnd, type Rng16 } from './rng';
export const RACER_PRIZES = 17;
export function applyRacerPrize(_p: Player, _prize: number): void {}
export function drawRacerPrize(rng: Rng16): number { return rnd(rng, RACER_PRIZES); }
```

```ts
// bombs.ts (T6) — addBomb, bombAt, bombById, removeBomb e refundBomb já são reais (T8, T13 e T15 dependem deles)
import { CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { BAD_COOLDOWN, FUSE } from './constants';
import { cellCenter } from './units';
import { newId } from './state';
export function fuseOf(_p: Player): number { return FUSE; }
export function bombFireOf(p: Player): number { return p.fire; }
export function canPlaceBomb(p: Player): boolean { return p.bombsFree > 0; }
export function bombAt(s: RoundState, cell: number): Bomb | undefined { return s.bombs.find(b => b.state === 'idle' && b.cell === cell); }
export function bombById(s: RoundState, id: number): Bomb | undefined { return s.bombs.find(b => b.id === id); }
/** Cria uma bomba; parada (padrão) ocupa a grade. */
export function addBomb(s: RoundState, owner: number, cell: number, init: Partial<Bomb> = {}): Bomb {
  const [x, y] = cellCenter(cell);
  const b: Bomb = { id: newId(s), owner, bad: false, cell, x, y, fuse: FUSE, fire: 0, type: 0, state: 'idle',
    dir: 4, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: s.tick, ...init };
  if (b.state === 'idle') s.grid[cell] = CODE.BOMB;
  s.bombs.push(b);
  return b;
}
/** Devolve a bomba ao dono (ou inicia a cadência do Bad Bomber: +48 ticks). */
export function refundBomb(s: RoundState, b: Bomb): void {
  if (b.bad) {
    const bb = s.bad.find(q => q.slot === b.owner);
    if (bb && bb.live === b.id) { bb.live = -1; bb.readyAt = s.tick + BAD_COOLDOWN; }
    return;
  }
  const p = s.players[b.owner];
  if (p) p.bombsFree = Math.min(p.bombsCap, p.bombsFree + 1);
}
/** Tira a bomba do jogo sem explodir (pressão, pouso em bloco queimando). */
export function removeBomb(s: RoundState, b: Bomb, refund: boolean): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  if (b.state === 'idle' && s.grid[b.cell] === CODE.BOMB) s.grid[b.cell] = CODE.FLOOR;
  if (refund) refundBomb(s, b);
}
export function placeBomb(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function explodeBomb(_s: RoundState, _b: Bomb, _ev: GameEvent[]): void {}
export function detonateRemote(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function revealCell(_s: RoundState, _cell: number, _ev: GameEvent[]): void {}
export function tickBombs(_s: RoundState, _ev: GameEvent[]): void {}
export function tickCells(_s: RoundState, _ev: GameEvent[]): void {}
```

```ts
// kick.ts (T7)
import type { Bomb, GameEvent, Player, RoundState } from './types';
export function tryKick(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function slideStep(_s: RoundState, _b: Bomb, _ev: GameEvent[]): void {}
export function stopKick(_s: RoundState, _p: Player): void {}
```

```ts
// flyers.ts (T8) — handFrom, launchBomb e spawnItemFlyer já são reais (T10, T11 e T15 criam voadores)
import { CODE, type Bomb, type FlightId, type Flyer, type GameEvent, type Player, type RoundState } from './types';
import { ITEM_FLIGHT } from './tables/flights';
import { SUB, cellCenter } from './units';
import { newId } from './state';
/** Ponto de partida de um arremesso a partir da mão em (x, y): horizontal com altura −16; vertical 16 px acima. */
export function handFrom(x: number, y: number, dir: 0 | 1 | 2 | 3): { x: number; y: number; z: number } {
  return dir === 0 || dir === 2 ? { x, y: y - 16 * SUB, z: 0 } : { x, y, z: -16 };
}
/** Tira a bomba da grade e a põe no ar. */
export function launchBomb(s: RoundState, b: Bomb, flight: FlightId, dir: 0 | 1 | 2 | 3, from: { x: number; y: number; z: number }): Flyer {
  if (b.state === 'idle' && s.grid[b.cell] === CODE.BOMB) s.grid[b.cell] = CODE.FLOOR;
  b.state = 'air';
  const f: Flyer = { id: newId(s), kind: 'bomb', ref: b.id, x: from.x, y: from.y, z: from.z, dir, flight, script: 0, i: 0, born: s.tick };
  s.flyers.push(f);
  return f;
}
/** Item (ou caveira) voando de `cell` pelo script ITEM_FLIGHT[script] (3, 4 ou 5 casas), saindo da altura da mão. */
export function spawnItemFlyer(s: RoundState, item: number, cell: number, script: number): Flyer {
  const dir = ITEM_FLIGHT[script].dir;
  const [cx, cy] = cellCenter(cell);
  const from = handFrom(cx, cy, dir);
  const f: Flyer = { id: newId(s), kind: 'item', ref: item, x: from.x, y: from.y, z: from.z, dir, flight: 'item', script, i: 0, born: s.tick };
  s.flyers.push(f);
  return f;
}
export function aimThrow(_s: RoundState, _cell: number, _face: number, _self: number): 2 | 3 | 4 | 5 { return 5; }
export function punchBomb(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function startLift(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function throwHeld(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function dropHeld(_s: RoundState, _p: Player): void {}
export function tickFlyers(_s: RoundState, _ev: GameEvent[]): void {}
```

```ts
// actions.ts (T9)
import type { GameEvent, Player, RoundState } from './types';
export function tickAct(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function playerActions(_s: RoundState, _p: Player, _btn: number, _pressed: number, _released: number, _ev: GameEvent[]): void {}
export function startPPunch(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function applyPush(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
```

```ts
// items.ts (T10)
import type { GameEvent, Player, RoundState } from './types';
export function applyItem(_s: RoundState, _p: Player, _id: number, _ev: GameEvent[]): void {}
export function pickup(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function dropCategory(_s: RoundState, _p: Player, _k: number, _ev: GameEvent[]): void {}
export function placeDropped(_s: RoundState, _id: number): number { return -1; }
export function loseItems(_s: RoundState, _p: Player, _n: number, _ev: GameEvent[]): void {}
export function leakOne(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
```

```ts
// disease.ts (T11)
import type { GameEvent, Player, RoundState } from './types';
export function applyDiseaseInput(_s: RoundState, _p: Player, btn: number): number { return btn; }
export function speedLevel(_s: RoundState, p: Player): number { return p.speedLv; }
export function tickDisease(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function inContact(_a: Player, _b: Player): boolean { return false; }
export function contagion(_s: RoundState, _ev: GameEvent[]): void {}
export function rollSkull(_s: RoundState): number { return 0x21; }
export function cureAndThrow(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function invisibleVisible(_p: Player): boolean { return true; }
```

```ts
// hit.ts (T12)
import type { GameEvent, Player, RoundState } from './types';
export function isImmune(_s: RoundState, _p: Player): boolean { return false; }
export function tickInv(_p: Player): void {}
export function checkHit(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function hitPlayer(_s: RoundState, _p: Player, _cause: 'flame' | 'pressure', _ev: GameEvent[]): void {}
export function tickDeath(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function stunPlayer(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
```

```ts
// round-end.ts (T14)
import type { GameEvent, RoundState } from './types';
export function groupsStanding(_s: RoundState): number { return 2; }
export function checkRoundEnd(_s: RoundState, _ev: GameEvent[]): void {}
export function tickEndPhases(_s: RoundState, _ev: GameEvent[]): void {}
```

```ts
// match.ts (T14)
import type { RoundState, Rules } from './types';
import { makeRng, type Rng16 } from './rng';
import { createRound } from './setup';
export interface MatchState {
  rules: Rules; stage: number; rng: Rng16; roundNo: number; crowns: number[]; over: boolean;
  racerPrize: { slot: number; prize: number } | null; spawnSeed: number; chars: number[];
}
export function createMatch(rules: Rules, stage: number, seed: number | Rng16 = 0x12, chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const rng = typeof seed === 'number' ? makeRng(seed) : { seed: seed.seed };
  return { rules: { ...rules, teams: [...rules.teams], active: [...rules.active] }, stage, rng, roundNo: 0,
    crowns: [0, 0, 0, 0, 0], over: false, racerPrize: null, spawnSeed: rng.seed, chars: [...chars] };
}
export function startRound(m: MatchState): RoundState { m.roundNo++; return createRound(m.stage, m.rules, { seed: m.rng.seed }); }
export function finishRound(_m: MatchState, _s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  return { winners: [], matchOver: false, champions: [] };
}
export function setRacerPrize(m: MatchState, slot: number, prize: number): void { m.racerPrize = { slot, prize }; }
export function clearRacerPrize(m: MatchState): void { m.racerPrize = null; }
```

```ts
// bad-bomber.ts (T15)
import type { GameEvent, Player, RoundState } from './types';
export function becomeBad(_s: RoundState, p: Player): void { p.state = 'out'; }
export function tickBadBombers(_s: RoundState, _inputs: readonly number[], _ev: GameEvent[]): void {}
export function clearBadBombers(_s: RoundState, _ev: GameEvent[]): void {}
```

- [ ] **Step 9: Escrever `step.ts` (ordem da §3.4) e `index.ts`**

`step.ts`:

```ts
import type { GameEvent, Player, RoundState } from './types';
import { INTRO_CLOCK_TICKS, INTRO_TICKS } from './constants';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { tickClock } from './clock';
import { tickPressure } from './pressure';
import { applyDiseaseInput, contagion, tickDisease } from './disease';
import { playerActions } from './actions';
import { pickup } from './items';
import { checkHit, tickDeath, tickInv } from './hit';
import { tickBombs, tickCells } from './bombs';
import { tickFlyers } from './flyers';
import { tickBadBombers } from './bad-bomber';
import { checkRoundEnd, tickEndPhases } from './round-end';

/** Passo 3 da §3.4, para um jogador. */
export function playerTick(s: RoundState, p: Player, raw: number, ev: GameEvent[]): void {
  if (!p.present || p.state === 'bad') return;   // o Bad Bomber lê a entrada em tickBadBombers
  if (p.state === 'dying') { tickDeath(s, p, ev); p.prevBtn = raw; return; }
  if (p.state !== 'alive' || s.phase === 'won') { p.prevBtn = raw; return; }   // em `won` quem está de pé congela
  tickInv(p);
  const btn = applyDiseaseInput(s, p, raw);
  playerActions(s, p, btn, btn & ~p.prevBtn, p.prevBtn & ~btn, ev);
  pickup(s, p, ev);
  tickDisease(s, p, ev);
  checkHit(s, p, ev);
  p.prevBtn = btn;
}

/** Passo 4 da §3.4: objetos. */
export function tickObjects(s: RoundState, inputs: readonly number[], ev: GameEvent[]): void {
  tickBombs(s, ev);          // pavio, deslize, cadeia, explosões
  tickCells(s, ev);          // fim de chamas e queimas (revela itens)
  tickFlyers(s, ev);
  tickPressure(s, ev);
  tickBadBombers(s, inputs, ev);
  MOUNTS.current.tick(s, ev);
}

export function step(s: RoundState, inputs: readonly number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'over') return ev;
  s.tick++;
  if (s.phase === 'intro') {
    if (s.tick <= INTRO_CLOCK_TICKS) tickClock(s, ev);
    for (const p of s.players) p.prevBtn = inputs[p.slot] ?? 0;
    if (s.tick >= INTRO_TICKS) { s.phase = 'play'; s.phaseT0 = s.tick; }
    return ev;
  }
  if (s.phase === 'timeUp') { tickEndPhases(s, ev); return ev; }
  if (s.phase === 'play') { tickClock(s, ev); if (s.phase !== 'play') return ev; }
  for (const p of s.players) playerTick(s, p, inputs[p.slot] ?? 0, ev);
  tickObjects(s, inputs, ev);
  STAGES[s.stage]?.tick?.(s, ev);
  contagion(s, ev);
  checkRoundEnd(s, ev);
  tickEndPhases(s, ev);
  return ev;
}
```

`index.ts`:

```ts
export * from './types';
export * from './units';
export * from './rng';
export * from './constants';
export type { StageModule, MountModule } from './hooks';
export type { AiStageHints, AiMountHints } from './ai/hints';
export { STAGES } from './stages';
export { MOUNTS, NO_MOUNT } from './mounts';
export { emptyRound, itemCode, itemOfCode, isItemCode, isEggCode, standing, playerCell } from './state';
export { createRound, type RoundOptions } from './setup';
export { step } from './step';
export { createMatch, startRound, finishRound, setRacerPrize, clearRacerPrize, type MatchState } from './match';
export { drawRacerPrize, RACER_PRIZES } from './racer';
export { clockText } from './clock';
export { invisibleVisible } from './disease';
export { hashState } from './hash';
export { AI_LEVELS, createAi, aiInputs, aiRoll, type AiLevel, type AiState } from './ai';
```

- [ ] **Step 10: Escrever os contratos de camadas**

`web/src/render/battle-layers.ts`:

```ts
import type { RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';

/** Estruturalmente igual ao ObjEntry da PPU (spec §2.4). Declarado aqui para não depender do plano 5. */
export interface BattleObj {
  x: number; y: number; size: 16 | 32; pal: number; prio: 0 | 1 | 2 | 3;
  hflip: boolean; vflip: boolean; src: { tile: number } | { px: Uint8Array };
}

/** Implementado pelo plano 7. */
export interface RomBattleBuilder {
  setBg2(col: number, lin: number, word: number): void;
  setBg1(col: number, lin: number, word: number): void;
  sprite(e: BattleObj, sortY: number, order: number): void;   // ordem de desenho de [ANI §1.4]
  cgram(index: number, bgr555: number): void;
  bg1Scroll(hofs: number): void;
}

/** `a` é o RomAssets do plano 5 (aqui `object`; a implementação declara `a: RomAssets`). */
export interface RomBattleLayer { id: string; draw(s: RoundState, b: RomBattleBuilder, a: object, frame: number): void }
export interface FallbackBattleLayer { id: string; draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void }

export const romLayers: RomBattleLayer[] = [];
export const fallbackLayers: FallbackBattleLayer[] = [];
export function registerRomLayer(l: RomBattleLayer): void { romLayers.push(l); }
export function registerFallbackLayer(l: FallbackBattleLayer): void { fallbackLayers.push(l); }
```

`web/src/render/layers-index.ts`:

```ts
// Índice dos módulos de camada: cada import registra as camadas do módulo (efeito colateral).
// Os planos 8 e 9 só ACRESCENTAM linhas `import './rom/stages/stageN';` / `import './fallback/stages/stageN';`.
export {};
```

- [ ] **Step 11: Rodar os testes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (238 antigos em `tests/legacy-core` e `tests/client` + os novos de `tests/core`); `tsc` limpo.

- [ ] **Step 12: Commit**

```bash
git add -A web/src web/tests
git commit -m "$(cat <<'MSG'
feat(core): fundação do núcleo fiel — tipos, unidades da ROM, RNG, contratos e esqueleto do passo

O núcleo antigo vai para src/legacy-core até a troca do render e da sessão.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 2: Fatos da ROM — extratores e tabelas geradas

**Possui:** `web/scripts/rom-facts/core-*.ts`, `web/src/core/tables/**`, `web/tests/core/tables.test.ts`, `web/tests/rom/facts.test.ts`, as linhas `allowImportingTsExtensions`, `resolveJsonModule` e `types` de `web/tsconfig.json`, a devDependency `@types/node` em `web/package.json`/`package-lock.json`.

**Files:**
- Create: `web/scripts/rom-facts/{core-rom,core-emit,core-movement,core-stages,core-items,core-flights,core-misc,core-all}.ts`
- Create (gerados pelo `core-all.ts`, versionados): `web/src/core/tables/{movement,stages,items,cells,flights,misc}.ts`
- Modify: `web/tsconfig.json` (`"allowImportingTsExtensions": true`, `"resolveJsonModule": true` e `"types": ["vitest/globals", "node"]` em `compilerOptions`; o JSON é para os goldens de T4/T5 importarem os fixtures)
- Modify: `web/package.json`, `web/package-lock.json` (`npm i -D @types/node@^24`: os testes importam `node:fs`/`node:crypto` e hoje não há tipos do Node)
- Test: `web/tests/core/tables.test.ts` (sem ROM), `web/tests/rom/facts.test.ts` (com ROM)

**Interfaces:**
- Consumes: nada (independente de T1; nenhum import de `src/`).
- Produces (constantes usadas pela onda 2):
  - `tables/movement.ts`: `SPEED_BY_LEVEL`, `DIR_VEC`, `speedVec(level, dir): [number, number]`, `a20(i)`, `A20` (24), `DPAD` (16, índice = nibble R1 L2 D4 U8), `SUBPOS` (256, já `& 15`), `TBL` (4 × 112: `[cruzamento $C3:2C60, corredor vertical $C3:2D40, corredor horizontal $C3:2CD0, cruzamento]`), `DIAM` (256 pares), `PAR` (4), `KICK_MASK` (256, `$C3:2EB0`), `KICK_DIRBIT` (4: bit da face/2, `$C2:4068[face]`).
  - `tables/stages.ts`: `interface StageFacts { base: readonly number[]; floorLogic: readonly number[]; remove: number }`, `STAGE_FACTS` (10; `base`/`floorLogic` = 221 códigos, `cell = lin·17 + col`).
  - `tables/items.ts`: `STAGE_ITEMS: readonly (readonly [number, number])[][]` (10 listas de `[romOff, item]` na ordem da ROM; `romOff = 0x44` = sorteada).
  - `tables/cells.ts`: `FREE_CELLS: readonly number[]` (113 casas de `$C4:1327`, na ordem, já como `cell`).
  - `tables/flights.ts`: `type Script = readonly (readonly [number, number])[]`, `PUNCH`, `BOUNCE`, `KICK_STEP` (4 scripts cada, índice 0 ↑ 1 → 2 ↓ 3 ←), `THROW: Readonly<Record<2 | 3 | 4 | 5, readonly Script[]>>`, `ITEM_FLIGHT: readonly { dir: 0 | 1 | 2 | 3; cells: 3 | 4 | 5; script: Script }[]` (12).
  - `tables/misc.ts`: `CAPSULE_TYPES` (14), `FUSE_TABLE` (`[62, 253, 126]`), `MAX_CAPS` (`{ bombs: 9, fire: 8, speed: 6 }`), `INVISIBLE_PATTERN` (64), `RACER_HANDLERS` (17), `STUN_LOSS_HANDLERS` (13).
  - `scripts/rom-facts/core-rom.ts`: `ROM_SHA1`, `interface Rom`, `romFromBytes(buf)`, `loadRom(path)`. `scripts/rom-facts/core-misc.ts` também exporta `extractPressureSteps(rom): number[]` (usado por T13).

- [ ] **Step 1: Escrever o teste sem ROM** `web/tests/core/tables.test.ts`

```ts
import { DPAD, SUBPOS, PAR, TBL, A20, DIAM, KICK_MASK, KICK_DIRBIT, speedVec, SPEED_BY_LEVEL } from '../../src/core/tables/movement';
import { STAGE_FACTS } from '../../src/core/tables/stages';
import { STAGE_ITEMS } from '../../src/core/tables/items';
import { FREE_CELLS } from '../../src/core/tables/cells';
import { PUNCH, BOUNCE, KICK_STEP, THROW, ITEM_FLIGHT } from '../../src/core/tables/flights';
import { CAPSULE_TYPES, FUSE_TABLE, MAX_CAPS, INVISIBLE_PATTERN, RACER_HANDLERS, STUN_LOSS_HANDLERS } from '../../src/core/tables/misc';

const cell = (col: number, lin: number) => lin * 17 + col;
const count = (list: readonly (readonly [number, number])[], item: number) => list.filter(([, i]) => i === item).length;
const sum = (s: readonly (readonly [number, number])[], k: 0 | 1) => s.reduce((a, v) => a + v[k], 0);

describe('tabelas de movimento', () => {
  it('DPAD, PAR e subposição do centro', () => {
    expect(DPAD).toEqual([8, 2, 6, 8, 4, 3, 5, 8, 0, 1, 7, 8, 8, 8, 8, 8]);
    expect(PAR).toEqual([1, 3, 0, 2]);
    expect(SUBPOS.length).toBe(256);
    expect(SUBPOS[7 * 16 + 7]).toBe(12);
    expect(SUBPOS.slice(0, 16)).toEqual([7, 7, 7, 7, 7, 7, 7, 8, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it('velocidade por nível (1/256 px/tick), diagonais sem normalizar', () => {
    expect(SPEED_BY_LEVEL).toEqual([224, 256, 288, 320, 352, 384, 512, 128]);
    expect(speedVec(1, 2)).toEqual([256, 0]);
    expect(speedVec(1, 3)).toEqual([256, 256]);
    expect(speedVec(6, 4)).toEqual([0, 512]);
    expect(speedVec(7, 6)).toEqual([-128, 0]);
    expect(speedVec(5, 8)).toEqual([0, 0]);
  });
  it('empurrão contra parede $C3:2A20', () => {
    expect(A20).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -2, -3, -4, -5, -6, -7, -8]);
  });
  it('tabelas de direção e diamante', () => {
    expect(TBL.length).toBe(4);
    for (const t of TBL) expect(t.length).toBe(0x70);
    expect(TBL[0].slice(0, 8)).toEqual([0, 0, 3, 3, 4, 5, 5, 0]);
    expect(TBL[1].slice(0, 8)).toEqual([0, 16, 16, 4, 4, 4, 112, 0]);
    expect(TBL[2].slice(0, 8)).toEqual([18, 2, 2, 2, 50, 6, 6, 6]);
    expect(TBL[3]).toEqual(TBL[0]);
    expect(DIAM.length).toBe(256);
    expect(DIAM[0]).toEqual([7, 0]);
    expect(DIAM[16]).toEqual([0, 6]);
  });
  it('máscara do chute: centro dispara para as 4 faces; 2 px antes não dispara para a direita', () => {
    expect(KICK_DIRBIT).toEqual([0x01, 0x04, 0x10, 0x40]);
    expect(KICK_MASK.slice(7 * 16, 7 * 16 + 16)).toEqual([0x40, 0x51, 0x51, 0x51, 0x51, 0x51, 0x55, 0x55, 0x55, 0x55, 0x15, 0x15, 0x15, 0x15, 0x15, 0x04]);
    expect(KICK_MASK[7 * 16 + 7] & 0x55).toBe(0x55);
    expect(KICK_MASK[7 * 16 + 5] & KICK_DIRBIT[1]).toBe(0);
  });
});

describe('fases', () => {
  it('N removidos por fase', () => {
    expect(STAGE_FACTS.map(f => f.remove)).toEqual([14, 14, 12, 4, 8, 14, 4, 0, 4, 14]);
  });
  it('fase 1: toda casa sem pilar é soft; paredes nas bordas', () => {
    const b = STAGE_FACTS[0].base;
    expect(b.length).toBe(221);
    expect(b.filter(v => v === 0xcc80).length).toBe(113);
    expect(b[cell(1, 5)]).toBe(0xec40);
    expect(b[cell(15, 5)]).toBe(0xec40);
    expect(b[cell(8, 0)]).toBe(0xec40);
    expect(b[cell(8, 12)]).toBe(0xec40);
    expect(b[cell(3, 2)]).toBe(0xec40);
    expect(STAGE_FACTS[0].floorLogic[cell(2, 1)]).toBe(0x0000);
  });
  it('fases 5 e 8 sem blocos; casas das bolas (3), setas (7) e pads (8) livres na base (os objetos vêm do init da arena)', () => {
    expect(STAGE_FACTS[4].base.filter(v => v === 0xcc80).length).toBe(0);
    expect(STAGE_FACTS[7].base.filter(v => v === 0xcc80).length).toBe(0);
    expect(STAGE_FACTS.map(f => f.base.filter(v => v === 0xcc80).length)).toEqual([113, 113, 111, 93, 0, 113, 85, 0, 101, 113]);
    expect([cell(6, 5), cell(10, 7)].map(c => STAGE_FACTS[2].base[c])).toEqual([0, 0]);
    expect([cell(4, 3), cell(12, 3), cell(12, 9), cell(4, 9)].map(c => STAGE_FACTS[6].base[c])).toEqual([0, 0, 0, 0]);
    expect([cell(4, 7), cell(8, 7), cell(12, 7)].map(c => STAGE_FACTS[7].base[c])).toEqual([0, 0, 0]);
  });
});

describe('itens e casas', () => {
  it('totais por fase', () => {
    expect(STAGE_ITEMS.map(l => l.length)).toEqual([30, 31, 35, 26, 0, 34, 35, 0, 32, 33]);
  });
  it('fase 1 = 8 bombas, 5 fogo, 3 patins, 3 chute, 2 soco, 2 luva, 2 P, 1 caveira $21, 4 ovos; todas sorteadas', () => {
    const l = STAGE_ITEMS[0];
    expect([0x01, 0x03, 0x05, 0x0e, 0x0d, 0x07, 0x12, 0x21, 0x30].map(i => count(l, i))).toEqual([8, 5, 3, 3, 2, 2, 2, 1, 4]);
    expect(l.every(([off]) => off === 0x44)).toBe(true);
  });
  it('fase 10 tem 8 trajes; fases 3, 6 e 7 têm 1 fogo total', () => {
    expect(count(STAGE_ITEMS[9], 0x0f)).toBe(8);
    expect([2, 5, 6].map(k => count(STAGE_ITEMS[k], 0x04))).toEqual([1, 1, 1]);
  });
  it('lista $C4:1327: 113 casas distintas do campo, sem pilar, na ordem da ROM', () => {
    expect(FREE_CELLS.length).toBe(113);
    expect(new Set(FREE_CELLS).size).toBe(113);
    expect(FREE_CELLS.slice(0, 3)).toEqual([cell(10, 3), cell(11, 11), cell(12, 1)]);
    for (const c of FREE_CELLS) {
      const col = c % 17, lin = Math.floor(c / 17);
      expect(col >= 2 && col <= 14 && lin >= 1 && lin <= 11).toBe(true);
      expect(col % 2 === 1 && lin % 2 === 0).toBe(false);
    }
  });
});

describe('scripts de voo', () => {
  it('soco: 17 passos; horizontal 48 px com pico 10; vertical para cima −48', () => {
    expect(PUNCH[1].map(v => v[0])).toEqual([3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0, 0]);
    expect(sum(PUNCH[1], 1)).toBe(0);
    expect(PUNCH[0].map(v => v[1])).toEqual([-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -3, -3, -3, 0, 1, 0, 0]);
    expect(sum(PUNCH[2], 1)).toBe(48);
    expect(sum(PUNCH[3], 0)).toBe(-48);
  });
  it('quique: 8 passos, 1 casa', () => {
    expect(BOUNCE[1]).toEqual([[3, -4], [3, -2], [3, 0], [3, 0], [2, 2], [2, 4], [0, 0], [0, 0]]);
    expect(sum(BOUNCE[0], 1)).toBe(-16);
    for (const s of BOUNCE) expect(s.length).toBe(8);
  });
  it('luva: 2..5 casas a partir da mão (Y−16)', () => {
    for (const n of [2, 3, 4, 5] as const) {
      expect(sum(THROW[n][1], 0)).toBe(16 * n);
      expect(sum(THROW[n][1], 1)).toBe(16);        // desce da mão ao chão
      expect(sum(THROW[n][0], 1)).toBe(-16 * n + 16);
      expect(sum(THROW[n][2], 1)).toBe(16 * n + 16);
      expect(THROW[n][0].length).toBe(11);
    }
  });
  it('chute: 8 × 2 px', () => {
    expect(KICK_STEP[1]).toEqual(new Array(8).fill([2, 0]));
    expect(KICK_STEP[0]).toEqual(new Array(8).fill([0, -2]));
  });
  it('itens voando ($C1:6715): 12 = 4 direções × 5/4/3 casas, mesmos scripts da luva', () => {
    expect(ITEM_FLIGHT.map(f => f.dir)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
    expect(ITEM_FLIGHT.map(f => f.cells)).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3]);
    expect(ITEM_FLIGHT[1].script).toEqual(THROW[5][1]);
  });
});

describe('outros fatos', () => {
  it('valores', () => {
    expect(CAPSULE_TYPES).toEqual([0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f, 0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f]);
    expect(FUSE_TABLE).toEqual([62, 253, 126]);
    expect(MAX_CAPS).toEqual({ bombs: 9, fire: 8, speed: 6 });
    expect(INVISIBLE_PATTERN.length).toBe(64);
    expect(INVISIBLE_PATTERN.slice(0, 16)).toEqual([0x55, 0x55, 0x55, 0x33, 0x33, 0x33, 7, 7, 7, 0x0f, 0x0f, 0x0f, 0, 0x0f, 0, 0x0f]);
    expect(INVISIBLE_PATTERN.slice(16).every(v => v === 0)).toBe(true);
    expect(RACER_HANDLERS).toEqual([0x0954, 0x0965, 0x096c, 0x097b, 0x0982, 0x0991, 0x0997, 0x0997, 0x099e, 0x09a9, 0x09a9, 0x09aa, 0x09b5, 0x09bc, 0x09dd, 0x09e4, 0x09eb]);
    expect(STUN_LOSS_HANDLERS).toEqual([0x545a, 0x556c, 0x52d4, 0x5318, 0x534c, 0x5378, 0x53d6, 0x5402, 0x54db, 0x5507, 0x5540, 0x54af, 0x542e]);
  });
});
```

- [ ] **Step 2: Escrever o teste com ROM** `web/tests/rom/facts.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRom, ROM_SHA1 } from '../../scripts/rom-facts/core-rom.ts';
import { GENERATORS } from '../../scripts/rom-facts/core-all.ts';

const path = process.env.SB4_ROM;
const rom = path ? loadRom(path) : null;
const src = (name: string) => readFileSync(fileURLToPath(new URL(`../../src/core/tables/${name}.ts`, import.meta.url)), 'utf8');

describe.skipIf(!rom)('fatos do núcleo = ROM', () => {
  it('é a ROM suportada', () => {
    expect(rom!.sha1).toBe(ROM_SHA1);
  });
  for (const g of GENERATORS) {
    it(`core/tables/${g.name}.ts regenerado a partir da ROM é idêntico ao versionado`, () => {
      expect(g.render(rom!)).toBe(src(g.name));
    });
  }
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/core/tables.test.ts tests/rom/facts.test.ts`
Expected: FAIL (tabelas e extratores inexistentes).

- [ ] **Step 4: Escrever o leitor da ROM e o emissor**

`web/scripts/rom-facts/core-rom.ts`:

```ts
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ROM_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';

export interface Rom {
  sha1: string;
  u8(a: number): number; s8(a: number): number; u16(a: number): number; s16(a: number): number;
  u24(a: number): number; bytes(a: number, n: number): number[];
}

/** Endereço SNES HiROM ($C0–$FF, espelhos $40–$7D) → offset no arquivo. */
const off = (a: number): number => (((a >> 16) & 0x3f) << 16) | (a & 0xffff);

export function romFromBytes(buf: Uint8Array): Rom {
  const b = buf.length % 0x8000 === 512 ? buf.subarray(512) : buf;
  if (b.length !== 4194304) throw new Error(`ROM com tamanho inesperado: ${b.length}`);
  const sha1 = createHash('sha1').update(b).digest('hex');
  const u8 = (a: number): number => b[off(a)];
  const u16 = (a: number): number => u8(a) | (u8(a + 1) << 8);
  return {
    sha1, u8, u16,
    s8: a => ((u8(a) << 24) >> 24),
    s16: a => ((u16(a) << 16) >> 16),
    u24: a => u16(a) | (u8(a + 2) << 16),
    bytes: (a, n) => Array.from({ length: n }, (_, i) => u8(a + i)),
  };
}

export function loadRom(path: string): Rom {
  const rom = romFromBytes(new Uint8Array(readFileSync(path)));
  if (rom.sha1 !== ROM_SHA1) throw new Error(`ROM não suportada (SHA-1 ${rom.sha1})`);
  return rom;
}

export const hex = (a: number): string => `$${(a >> 16).toString(16).toUpperCase()}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
```

`web/scripts/rom-facts/core-emit.ts`:

```ts
/** Cabeçalho dos arquivos gerados. */
export function header(script: string, sha1: string, sources: string[]): string {
  return [
    `// GERADO por scripts/rom-facts/${script} — NÃO EDITAR. Rode: SB4_ROM=… node scripts/rom-facts/core-all.ts`,
    `// ROM SHA-1 ${sha1}`,
    ...sources.map(s => `// ${s}`),
    '',
  ].join('\n');
}

const h = (v: number): string => (v < 0 ? `-0x${(-v).toString(16)}` : `0x${v.toString(16)}`);

/** Lista de números, 16 por linha. */
export function nums(values: readonly number[], useHex = false, perLine = 16): string {
  const f = useHex ? h : String;
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += perLine) lines.push('  ' + values.slice(i, i + perLine).map(f).join(', ') + ',');
  return `[\n${lines.join('\n')}\n]`;
}

export function pairs(values: readonly (readonly [number, number])[], perLine = 8): string {
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += perLine) lines.push('  ' + values.slice(i, i + perLine).map(([a, b]) => `[${a}, ${b}]`).join(', ') + ',');
  return `[\n${lines.join('\n')}\n]`;
}
```

- [ ] **Step 5: Escrever os extratores**

Cada extrator exporta `render(rom): string` (texto completo do arquivo TS). Os que têm fórmula conferem a ROM contra ela e lançam erro se divergirem.

`web/scripts/rom-facts/core-movement.ts`:

```ts
import type { Rom } from './core-rom.ts';
import { header, nums, pairs } from './core-emit.ts';

const LEVELS = [224, 256, 288, 320, 352, 384, 512, 128];
const DIRS: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 0]];
const a20 = (i: number): number => (i < 8 ? 7 - i : i < 16 ? 0 : -(i - 15));

export function renderMovement(rom: Rom): string {
  for (let lv = 0; lv < 8; lv++) for (let d = 0; d < 9; d++) {
    const a = 0xc32a50 + lv * 64 + d * 4;
    const [ex, ey] = [DIRS[d][0] * LEVELS[lv], DIRS[d][1] * LEVELS[lv]];
    if (rom.s16(a) !== ex || rom.s16(a + 2) !== ey) throw new Error(`SPEED ≠ fórmula em nível ${lv}, dir ${d}`);
  }
  for (let i = 0; i < 24; i++) if (rom.s16(0xc32a20 + 2 * i) !== a20(i)) throw new Error(`A20 ≠ fórmula em ${i}`);
  const tbl = [0xc32c60, 0xc32d40, 0xc32cd0].map(a => rom.bytes(a, 0x70));
  const diam: [number, number][] = Array.from({ length: 256 }, (_, i) => [rom.s16(0xc32620 + 4 * i), rom.s16(0xc32622 + 4 * i)]);
  return header('core-movement.ts', rom.sha1, [
    'SPEED $C3:2A50 e A20 $C3:2A20 (conferidos contra a fórmula), DPAD $C3:2C50, SUBPOS $C3:2520 (& 15),',
    'TBL $C3:2C60 / $C3:2D40 / $C3:2CD0, DIAM $C3:2620, PAR $C2:4F25, KICK_MASK $C3:2EB0, KICK_DIRBIT $C2:4068[face]',
  ]) + [
    `export const SPEED_BY_LEVEL: readonly number[] = ${JSON.stringify(LEVELS).replace(/,/g, ', ')};`,
    `export const DIR_VEC: readonly (readonly [number, number])[] = ${pairs(DIRS, 9)};`,
    'export function speedVec(level: number, dir: number): [number, number] {',
    '  const v = SPEED_BY_LEVEL[level] ?? 0; const d = DIR_VEC[dir] ?? DIR_VEC[8];',
    '  return [d[0] * v, d[1] * v];',
    '}',
    'export const a20 = (i: number): number => (i < 8 ? 7 - i : i < 16 ? 0 : -(i - 15));',
    'export const A20: readonly number[] = Array.from({ length: 24 }, (_, i) => a20(i));',
    `export const DPAD: readonly number[] = ${nums(rom.bytes(0xc32c50, 16))};`,
    `export const SUBPOS: readonly number[] = ${nums(rom.bytes(0xc32520, 256).map(v => v & 15))};`,
    `const T_CROSS = ${nums(tbl[0], true)};`,
    `const T_VERT = ${nums(tbl[1], true)};`,
    `const T_HORIZ = ${nums(tbl[2], true)};`,
    '/** Índice = PAR[paridade]: 0 e 3 cruzamento, 1 corredor vertical, 2 corredor horizontal (como TBL do movesim.py). */',
    'export const TBL: readonly (readonly number[])[] = [T_CROSS, T_VERT, T_HORIZ, T_CROSS];',
    `export const DIAM: readonly (readonly [number, number])[] = ${pairs(diam)};`,
    `export const PAR: readonly number[] = ${nums(rom.bytes(0xc24f25, 4))};`,
    `export const KICK_MASK: readonly number[] = ${nums(rom.bytes(0xc32eb0, 256), true)};`,
    `export const KICK_DIRBIT: readonly number[] = ${nums([0, 2, 4, 6].map(f => rom.u8(0xc24068 + f)), true)};`,
    '',
  ].join('\n');
}
```

`web/scripts/rom-facts/core-stages.ts` (porte de `arena_rom.py`: `arena_record`, `decode_map`, `logic_of`):

```ts
import type { Rom } from './core-rom.ts';
import { header, nums } from './core-emit.ts';

/** Mapa de arena: 1 byte ignorado + tokens u16 `código | rep << 10` ($C4:08D3), 32×32 entradas. */
function decodeMap(rom: Rom, src: number): number[] {
  const out: number[] = [];
  let a = src + 1;
  while (out.length < 1024) {
    const w = rom.u16(a); a += 2;
    for (let k = 0; k <= (w >> 10); k++) out.push(w & 0x3ff);
  }
  return out.slice(0, 1024);
}
const logicOf = (rom: Rom, code: number): number => (code < 16 ? rom.u16(0xc40892 + 2 * code) : 0xec40);

export function renderStages(rom: Rom): string {
  const table = rom.u24(0xc40074);   // variante 0 (Battle)
  const stages = Array.from({ length: 10 }, (_, idx) => {
    const rec = rom.u24(table + 3 * idx);
    const bg2 = decodeMap(rom, rom.u24(rec + 0x09)), floor = decodeMap(rom, rom.u24(rec + 0x0c));
    const base: number[] = [], floorLogic: number[] = [];
    for (let lin = 0; lin < 13; lin++) for (let col = 0; col < 17; col++) {
      base.push(logicOf(rom, bg2[lin * 32 + col]));
      floorLogic.push(logicOf(rom, floor[lin * 32 + col]));
    }
    return { base, floorLogic, remove: rom.u8(rec + 0x1e) };
  });
  const remove = stages.map(s => s.remove).join(',');
  if (remove !== '14,14,12,4,8,14,4,0,4,14') throw new Error(`ordem das arenas inesperada: ${remove}`);
  return header('core-stages.ts', rom.sha1, [
    'registro da arena: p24(p24($C4:0074) + 3·idx), idx = fase − 1; mapa BG2 rec+$09, piso rec+$0C, N rec+$1E;',
    'lógico $C4:0892[código] (código ≥ 16 → EC40). Casa (col, lin) = entrada lin·32 + col do mapa.',
  ]) + [
    'export interface StageFacts { base: readonly number[]; floorLogic: readonly number[]; remove: number }',
    '/** Índice 0..9 = fases 1..10; base/floorLogic com 221 códigos (cell = lin·17 + col). */',
    'export const STAGE_FACTS: readonly StageFacts[] = [',
    ...stages.map(s => `  { remove: ${s.remove},\n    base: ${nums(s.base, true, 17).replace(/\n/g, '\n    ')},\n    floorLogic: ${nums(s.floorLogic, true, 17).replace(/\n/g, '\n    ')} },`),
    '];',
    '',
  ].join('\n');
}
```

`web/scripts/rom-facts/core-items.ts` (porte de `itemsim.stage_list` e `FALLBACK`) gera **dois** arquivos:

```ts
import type { Rom } from './core-rom.ts';
import { header, nums, pairs } from './core-emit.ts';

export function stageList(rom: Rom, stage: number): [number, number][] {
  const rec = rom.u24(rom.u24(0xc36233) + 3 * (stage - 1));   // variante A
  let a = rom.u24(rec + 24);
  const out: [number, number][] = [];
  for (;;) { const c = rom.u16(a); if (c === 0xffff) return out; out.push([c, rom.u16(a + 2)]); a += 4; }
}

export function freeCellOffsets(rom: Rom): number[] {
  const out: number[] = [];
  for (let a = 0xc41327; ; a += 2) { const v = rom.u16(a); if (v === 0xffff) return out; out.push(v); }
}

export function renderItems(rom: Rom): string {
  return header('core-items.ts', rom.sha1, ['listas de itens escondidos: registro p24($C3:6233 + 3·(fase−1)), lista em rec+24,',
    'pares (u16 romOff, u16 item) até $FFFF; romOff $0044 = casa sorteada']) + [
    '/** Índice 0..9 = fases 1..10. [romOff, item] na ordem da ROM (a ordem importa para o sorteio). */',
    'export const STAGE_ITEMS: readonly (readonly [number, number])[][] = [',
    ...Array.from({ length: 10 }, (_, k) => `  ${pairs(stageList(rom, k + 1), 8).replace(/\n/g, '\n  ')},`),
    '];',
    '',
  ].join('\n');
}

export function renderCells(rom: Rom): string {
  const cells = freeCellOffsets(rom).map(off => (off >> 6) * 17 + ((off & 0x3f) >> 1));
  if (cells.length !== 113) throw new Error(`$C4:1327 com ${cells.length} casas`);
  return header('core-items.ts', rom.sha1, ['lista $C4:1327 (113 casas sem pilar, romOff → cell = lin·17 + col)']) +
    `export const FREE_CELLS: readonly number[] = ${nums(cells)};\n`;
}
```

`web/scripts/rom-facts/core-flights.ts` (porte de `export_tables.script`):

```ts
import type { Rom } from './core-rom.ts';
import { header, pairs } from './core-emit.ts';

/** Script de voo: pares (s8 dx, s8 dy) em $C1:off até um byte $80/$81/$82. */
function script(rom: Rom, off: number): [number, number][] {
  const s: [number, number][] = [];
  for (let a = 0xc10000 | off; ![0x80, 0x81, 0x82].includes(rom.u8(a)); a += 2) {
    s.push([rom.s8(a), rom.s8(a + 1)]);
    if (s.length > 64) throw new Error(`script sem fim em $C1:${off.toString(16)}`);
  }
  return s;
}
const table = (rom: Rom, a: number, n: number): number[] => Array.from({ length: n }, (_, i) => rom.u16(a + 2 * i));
const four = (rom: Rom, a: number): string =>
  `[\n${table(rom, a, 4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n]`;

export function renderFlights(rom: Rom): string {
  const pb = table(rom, 0xc12126, 8);
  const sumOf = (s: [number, number][], k: 0 | 1) => s.reduce((a, v) => a + v[k], 0);
  const items = Array.from({ length: 12 }, (_, i) => {
    const s = script(rom, rom.u16(0xc16715 + 4 * i));
    const dir = rom.u16(0xc16717 + 4 * i);
    const cells = dir === 1 || dir === 3 ? Math.abs(sumOf(s, 0)) / 16 : dir === 0 ? (16 - sumOf(s, 1)) / 16 : (sumOf(s, 1) - 16) / 16;
    if (![3, 4, 5].includes(cells)) throw new Error(`voo de item ${i}: ${cells} casas`);
    return { dir, cells, s };
  });
  return header('core-flights.ts', rom.sha1, [
    'soco e quique $C1:2126 (8 u16: 4 soco + 4 quique), luva $C1:2571/2569/2561/2559 (2/3/4/5 casas),',
    'chute $C1:35C9, itens voando $C1:6715 (12 × {u16 script, u16 dir}); índice de direção 0 ↑ 1 → 2 ↓ 3 ←',
  ]) + [
    'export type Script = readonly (readonly [number, number])[];',
    `export const PUNCH: readonly Script[] = [\n${pb.slice(0, 4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n];`,
    `export const BOUNCE: readonly Script[] = [\n${pb.slice(4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n];`,
    `export const KICK_STEP: readonly Script[] = ${four(rom, 0xc135c9)};`,
    'export const THROW: Readonly<Record<2 | 3 | 4 | 5, readonly Script[]>> = {',
    `  2: ${four(rom, 0xc12571).replace(/\n/g, '\n  ')},`,
    `  3: ${four(rom, 0xc12569).replace(/\n/g, '\n  ')},`,
    `  4: ${four(rom, 0xc12561).replace(/\n/g, '\n  ')},`,
    `  5: ${four(rom, 0xc12559).replace(/\n/g, '\n  ')},`,
    '};',
    'export const ITEM_FLIGHT: readonly { dir: 0 | 1 | 2 | 3; cells: 3 | 4 | 5; script: Script }[] = [',
    ...items.map(f => `  { dir: ${f.dir}, cells: ${f.cells}, script: ${pairs(f.s, 12)} },`),
    '];',
    '',
  ].join('\n');
}
```

`web/scripts/rom-facts/core-misc.ts`:

```ts
import type { Rom } from './core-rom.ts';
import { header, nums } from './core-emit.ts';

/** Passos da espiral da pressão ($C1:724E): deltas s16 cumulativos a partir de $0044; $7000 = fim sem Morte Súbita; −$8000 = fim. */
export function extractPressureSteps(rom: Rom): number[] {
  const out: number[] = [];
  for (let a = 0xc1724e; ; a += 2) { const v = rom.s16(a); out.push(v); if (v === -0x8000) return out; }
}

export function renderMisc(rom: Rom): string {
  const u24list = (a: number, n: number) => Array.from({ length: n }, (_, i) => rom.u16(a + 3 * i));
  return header('core-misc.ts', rom.sha1, [
    'CAPSULE_TYPES $C1:5DA4 (14), FUSE_TABLE $C1:56E8 (3), MAX_CAPS $C0:0B4C/48/50, INVISIBLE_PATTERN $C2:4F68 (64),',
    'RACER_HANDLERS $C2:08F4 (17 × u24, parte baixa), STUN_LOSS_HANDLERS $C2:519D (13 × u24, parte baixa)',
  ]) + [
    `export const CAPSULE_TYPES: readonly number[] = ${nums(rom.bytes(0xc15da4, 14), true)};`,
    `export const FUSE_TABLE: readonly number[] = ${nums(rom.bytes(0xc156e8, 3))};`,
    `export const MAX_CAPS = { bombs: ${rom.u16(0xc00b4c)}, fire: ${rom.u16(0xc00b48)}, speed: ${rom.u16(0xc00b50)} } as const;`,
    `export const INVISIBLE_PATTERN: readonly number[] = ${nums(rom.bytes(0xc24f68, 64), true)};`,
    `export const RACER_HANDLERS: readonly number[] = ${nums(u24list(0xc208f4, 17), true)};`,
    `export const STUN_LOSS_HANDLERS: readonly number[] = ${nums(u24list(0xc2519d, 13), true)};`,
    '',
  ].join('\n');
}
```

`web/scripts/rom-facts/core-all.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRom, type Rom } from './core-rom.ts';
import { renderMovement } from './core-movement.ts';
import { renderStages } from './core-stages.ts';
import { renderItems, renderCells } from './core-items.ts';
import { renderFlights } from './core-flights.ts';
import { renderMisc } from './core-misc.ts';

export const GENERATORS: { name: string; render(rom: Rom): string }[] = [
  { name: 'movement', render: renderMovement },
  { name: 'stages', render: renderStages },
  { name: 'items', render: renderItems },
  { name: 'cells', render: renderCells },
  { name: 'flights', render: renderFlights },
  { name: 'misc', render: renderMisc },
];

if (fileURLToPath(import.meta.url) === process.argv[1]) {   // caminho com espaços: comparar caminhos, não URLs
  const path = process.env.SB4_ROM;
  if (!path) throw new Error('defina SB4_ROM');
  const rom = loadRom(path);
  for (const g of GENERATORS) {
    const out = fileURLToPath(new URL(`../../src/core/tables/${g.name}.ts`, import.meta.url));
    writeFileSync(out, g.render(rom));
    console.log(`gerado ${out}`);
  }
}
```

(`import type { Rom }` separado: com *type stripping* o `type` inline dentro de `{ loadRom, type Rom }` também é apagado pelo Node 24; se a versão local reclamar, dividir em dois imports.)

- [ ] **Step 6: Ligar `allowImportingTsExtensions` e gerar as tabelas**

Em `web/tsconfig.json`, dentro de `compilerOptions`, acrescentar `"allowImportingTsExtensions": true,` e `"resolveJsonModule": true,`, e trocar `"types": ["vitest/globals"]` por `"types": ["vitest/globals", "node"]`. Depois:

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
npm i -D @types/node@^24
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" node scripts/rom-facts/core-all.ts
ls src/core/tables
```
Expected: `cells.ts flights.ts items.ts misc.ts movement.ts stages.ts`, sem exceção ("≠ fórmula", "ordem das arenas", "voo de item").

- [ ] **Step 7: Rodar os testes**

Run: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/core/tables.test.ts tests/rom/facts.test.ts && npx vitest run tests/rom/facts.test.ts && npx tsc --noEmit`
Expected: com ROM, tudo PASS; sem `SB4_ROM`, `facts.test.ts` aparece como *skipped*; `tsc` limpo.

- [ ] **Step 8: Commit**

```bash
git add web/scripts/rom-facts/core-*.ts web/src/core/tables web/tests/core/tables.test.ts web/tests/rom/facts.test.ts web/tsconfig.json web/package.json web/package-lock.json
git commit -m "$(cat <<'MSG'
feat(core): extratores de fatos da ROM e tabelas de regra geradas (movimento, fases, itens, voos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Fixtures do emulador (movimento e montagem das rodadas)

**Possui:** `web/scripts/rom-facts/core-fixtures/**`, `web/tests/fixtures/rom/{movement,rounds}.json`.

**Files:**
- Create: `web/scripts/rom-facts/core-fixtures/{gen_movement,gen_rounds,check}.py`
- Create (gerados, versionados): `web/tests/fixtures/rom/movement.json`, `web/tests/fixtures/rom/rounds.json`

Esta tarefa não tem teste TS (os consumidores são os goldens de T4 e T5, que também conferem a forma dos arquivos). A verificação é o `check.py` e as asserções dos próprios geradores, que abortam em qualquer divergência entre modelo e emulador.

**Interfaces:**
- Consumes: `analise/investigacao/mecanicas/{mec,movesim,itemsim}.py`, savestates `analise/estados/st_arena01.bin`, `st_arena05.bin`, `st_stage00..09.bin`.
- Produces:
  - `movement.json`: `{ source, romSha1, ticks, trials: { stage, grid: number[221], level, x0, y0, inputs: [btnMask, count][], d: number[] }[] }` — `btnMask` no formato `BTN` do core (UP 1, DOWN 2, LEFT 4, RIGHT 8); `d` = deltas `[dx1, dy1, dx2, dy2, …]` em 1/256 px, um par por tick lógico (posição depois do tick *k* = `x0 + Σdx`).
  - `rounds.json`: `{ source, romSha1, rng: { start, calls: [n, v][], final }, stages: { [fase]: { soft: number[] (romOff, ordenados), items: [romOff, item][], afterRemove, afterItems } } }` — 5 jogadores, semente de boot.

- [ ] **Step 1: Escrever o verificador** `web/scripts/rom-facts/core-fixtures/check.py`

```python
"""Confere a forma e os números conhecidos dos fixtures (valores medidos no emulador para o plano 6)."""
import json, os, sys
D = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests/fixtures/rom'))
m = json.load(open(os.path.join(D, 'movement.json')))
assert m['romSha1'] == '38f4394986bd39fcbe32a722a3fe103ee6177d9b'
assert m['ticks'] >= 20000, m['ticks']
assert os.path.getsize(os.path.join(D, 'movement.json')) < 400 * 1024
n = 0
for t in m['trials']:
    assert len(t['grid']) == 221 and t['stage'] in (1, 5)
    k = sum(c for _, c in t['inputs']); assert len(t['d']) == 2 * k; n += k
assert n == m['ticks']
r = json.load(open(os.path.join(D, 'rounds.json')))
assert r['rng']['start'] == 0x12 and len(r['rng']['calls']) == 207 and r['rng']['final'] == 0x5e71
st = [r['stages'][str(k)] for k in range(1, 11)]
assert [len(s['soft']) for s in st] == [80, 80, 80, 70, 0, 80, 62, 0, 78, 80]
assert [len(s['items']) for s in st] == [30, 31, 35, 26, 0, 34, 35, 0, 32, 33]
assert [s['afterRemove'] for s in st] == [0x5191, 0x5191, 0x25d9, 0x1fc9, 0x9401, 0x5191, 0x1fc9, 0xc689, 0xe4c1, 0x5191]
assert [s['afterItems'] for s in st] == [0x5e71, 0x3bc1, 0xc9b1, 0xcfd9, 0x9401, 0x61b3, 0x4219, 0xc689, 0x0d41, 0xc9b1]
print('fixtures ok', m['ticks'], 'ticks')
```

- [ ] **Step 2: Escrever `gen_rounds.py`** (é o `t61.py` para as 10 fases + o `t52.py`)

```python
"""Gera tests/fixtures/rom/rounds.json: soft blocks, itens escondidos e sementes das 10 fases (5 jogadores, boot),
mais a sequência de 207 chamadas de RNG do t52. Roda no core instrumentado da frente mecanicas."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
MEC = os.path.normpath(os.path.join(HERE, '../../../../analise/investigacao/mecanicas'))
sys.path.insert(0, MEC); os.chdir(MEC)
from mec import *          # noqa: E402,F401  (Dbg, grid, OUT)
import itemsim             # noqa: E402

OUT_JSON = os.path.normpath(os.path.join(HERE, '../../../tests/fixtures/rom/rounds.json'))

def rng_calls():
    e = Dbg("st_stage00"); e.run(1)
    seed0 = e.r16(0xAE)
    e.tap('A', hold=2, after=0)
    e.bp(0xC354B3); e.bp(0xC354F3)
    for _ in range(700): e.run(1)
    calls, cur = [], None
    for r in e.log():
        if r['t'] != 'EXEC': continue
        if r['pc'] == 0xC354B3: cur = r['y']
        elif r['pc'] == 0xC354F3 and cur is not None: calls.append([cur, r['a']]); cur = None
    s = seed0
    for n, v in calls:
        s, m = itemsim.rng(s, n)
        assert m == v, 'modelo do RNG divergiu'
    return {'start': seed0, 'calls': calls, 'final': s}

def stage(s):
    base = json.load(open(OUT + 'layouts_base.json'))
    e = Dbg(f"st_stage{s:02d}"); e.run(1)
    e.tap('A', hold=2, after=0)
    e.bp(0xC4179C); e.bp(0xC4121D)
    seedR = seedI = None
    for _ in range(900):
        st = e.save(); n0 = e.lib.dbg_count()
        e.run(1)
        new = [r for r in e.log()[n0:] if r['t'] == 'EXEC']
        if seedR is None and any(r['pc'] == 0xC4179C for r in new):
            e.load(st); seedR = e.r16(0xAE); e.run(1)
        if any(r['pc'] == 0xC4121D for r in new):
            e.load(st); e.run(1)
            for _ in range(10): e.run(1)
            break
    rows = base[str(s + 1)]['base']
    soft = {(r + 1) * 64 + (c + 2) * 2 for r in range(11) for c in range(13) if rows[r][c] == 'x'}
    soft = itemsim.carve(soft)
    soft, after_remove = itemsim.remove_random(soft, base[str(s + 1)]['remove'], seedR)
    g = grid(e)
    real = {r * 64 + c * 2 for r in range(14) for c in range(16) if g[r][c] == 0xCC80}
    assert soft == real, f'fase {s+1}: layout do modelo ≠ emulador'
    w = e.wram(); i = 0x8000; items = []
    while True:
        cc = w[i] | w[i + 1] << 8
        if cc == 0xFFFF: break
        items.append([cc, w[i + 2] | w[i + 3] << 8]); i += 4
    seed = after_remove
    if s + 1 == 6: seed, _ = itemsim.rng(seed, 64)       # arena 6: 64 + rnd(64) antes dos itens
    tab, after_items = itemsim.build(real, itemsim.stage_list(s + 1), seed)
    assert [list(t) for t in tab] == items, f'fase {s+1}: itens do modelo ≠ emulador'
    return {'soft': sorted(real), 'items': items, 'afterRemove': after_remove, 'afterItems': after_items}

if __name__ == '__main__':
    out = {'source': 'scripts/rom-facts/core-fixtures/gen_rounds.py (t61.py nas 10 fases + t52.py)',
           'romSha1': '38f4394986bd39fcbe32a722a3fe103ee6177d9b', 'rng': rng_calls(),
           'stages': {str(s + 1): stage(s) for s in range(10)}}
    json.dump(out, open(OUT_JSON, 'w'), separators=(',', ':'))
    print('ok', OUT_JSON)
```

- [ ] **Step 3: Escrever `gen_movement.py`** (é o `t33.py` gravando o traço, com o modelo conferido quadro a quadro)

```python
"""Gera tests/fixtures/rom/movement.json: cenários do t33 (st_arena01 semente 5, 60 tentativas, 6 bombas;
st_arena05 semente 6, 60 tentativas, 12 bombas). Cada tick lógico é gravado pelo movesim; a cada quadro o
emulador é conferido e qualquer divergência aborta (o fixture só sai com 0 divergências)."""
import sys, os, json, random
HERE = os.path.dirname(os.path.abspath(__file__))
MEC = os.path.normpath(os.path.join(HERE, '../../../../analise/investigacao/mecanicas'))
sys.path.insert(0, MEC); os.chdir(MEC)
from mec import *          # noqa
import movesim             # noqa

OUT_JSON = os.path.normpath(os.path.join(HERE, '../../../tests/fixtures/rom/movement.json'))
BTN = {'UP': 1, 'DOWN': 2, 'LEFT': 4, 'RIGHT': 8}          # BTN do core
COMBOS = [['UP'], ['DOWN'], ['LEFT'], ['RIGHT'], ['UP', 'LEFT'], ['UP', 'RIGHT'], ['DOWN', 'LEFT'], ['DOWN', 'RIGHT'], []]

def gridd(e):
    w = e.wram()
    return {r * 0x40 + c * 2: w[0x2800 + r * 0x40 + c * 2] | w[0x2801 + r * 0x40 + c * 2] << 8 for r in range(14) for c in range(17)}

def run(st, seed, trials, nbombs, stage):
    random.seed(seed)
    e = TDbg(st); e.run(1); base = e.save(); out = []
    for _ in range(trials):
        e.load(base); g = gridd(e)
        free = [(c, r) for r in range(1, 12) for c in range(2, 15) if g[r * 0x40 + c * 2] == 0]
        c, r = random.choice(free)
        for _ in range(nbombs):
            bc, br = random.choice(free)
            if (bc, br) != (c, r): e.w16(0x2800 + br * 0x40 + bc * 2, 0xC900)
        g = gridd(e)
        lvl = random.choice([1, 1, 2, 3, 4, 5, 0, 6, 7]); e.w8(0x340, lvl)
        X = (cx(c) + random.randint(-7, 8)) << 8; Y = (cy(r) + random.randint(-7, 8)) << 8
        if g.get(movesim.cell_of(X >> 8, Y >> 8), 1) != 0: continue
        e.w16(0x311, X & 0xFFFF); e.w8(0x313, X >> 16); e.w16(0x315, Y & 0xFFFF); e.w8(0x317, Y >> 16)
        e.run(1)
        X = e.r16(0x311) | e.r8(0x313) << 16; Y = e.r16(0x315) | e.r8(0x317) << 16
        x0, y0 = X, Y; seq = []
        for _ in range(6):
            cb = random.choice(COMBOS); seq += [cb] * random.randint(3, 25)
        inputs, d = [], []
        for cb in seq:
            dp = sum(movesim.BTN[b] for b in cb)
            k = e.step(p0=cb)
            for _ in range(k):
                nx, ny, _ = movesim.step(X, Y, dp, lvl, g)
                d += [nx - X, ny - Y]; X, Y = nx, ny
                mask = sum(BTN[b] for b in cb)
                if inputs and inputs[-1][0] == mask: inputs[-1][1] += 1
                else: inputs.append([mask, 1])
            EX = e.r16(0x311) | e.r8(0x313) << 16; EY = e.r16(0x315) | e.r8(0x317) << 16
            assert (EX, EY) == (X, Y), f'divergência em {st} tentativa com início {(c, r)}'
        grid17 = [g.get(lin * 0x40 + col * 2, 0) for lin in range(13) for col in range(17)]
        out.append({'stage': stage, 'grid': grid17, 'level': lvl, 'x0': x0, 'y0': y0, 'inputs': inputs, 'd': d})
    return out

if __name__ == '__main__':
    trials = run('st_arena01', 5, 60, 6, 1) + run('st_arena05', 6, 60, 12, 5)
    ticks = sum(n for t in trials for _, n in t['inputs'])
    json.dump({'source': 'scripts/rom-facts/core-fixtures/gen_movement.py (t33.py st_arena01 5 60 6 + st_arena05 6 60 12)',
               'romSha1': '38f4394986bd39fcbe32a722a3fe103ee6177d9b', 'ticks': ticks, 'trials': trials},
              open(OUT_JSON, 'w'), separators=(',', ':'))
    print('ok', ticks, 'ticks', OUT_JSON)
```

- [ ] **Step 4: Gerar os fixtures**

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
export SNES9X_CORE="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-mecanicas/snes9x/libretro/snes9x_libretro.dylib"
PY="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/venv/bin/python"
mkdir -p tests/fixtures/rom
"$PY" scripts/rom-facts/core-fixtures/gen_rounds.py 2>&1 | grep -v '^Map_'
"$PY" scripts/rom-facts/core-fixtures/gen_movement.py 2>&1 | grep -v '^Map_'
ls -l tests/fixtures/rom
```
Expected: `ok …/rounds.json` e `ok N ticks …/movement.json` com N ≥ 20000. Se `ticks < 20000`, aumentar as tentativas das duas chamadas de `run` para 70 (a contagem de 20.034 do relatório era por quadro; a de ticks lógicos varia com o *lag*). Se o arquivo passar de 400 KB, reduzir para 55 tentativas cada, mantendo ≥ 20.000 ticks.

- [ ] **Step 5: Verificar**

Run: `python3 scripts/rom-facts/core-fixtures/check.py`
Expected: `fixtures ok N ticks`.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/rom-facts/core-fixtures web/tests/fixtures/rom/movement.json web/tests/fixtures/rom/rounds.json
git commit -m "$(cat <<'MSG'
test(core): fixtures do emulador — traço de movimento (≥ 20.000 ticks) e montagem das 10 fases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
## Onda 2

Todas as tarefas desta onda substituem **o arquivo inteiro** do stub que possuem e podem chamar as funções dos outros stubs pelos nomes da tabela de T1 (que ainda são no-op na worktree delas). Por isso cada teste exercita o próprio módulo diretamente; as combinações entre módulos são provadas em T16. Testes usam `tests/core/kit.ts` (`arena`, `put`, `setCell`, `codeAt`, `run`, `runUntil`, `C`).

### Task 4: Movimento (porte de `movesim.py`)

**Possui:** `web/src/core/movement.ts`, `web/tests/core/movement.test.ts`, `web/tests/core/movement-golden.test.ts`.

**Interfaces:**
- Consumes: `tables/movement` (T2), `units`, `state.setAct/setFace`, `disease.speedLevel` (stub devolve `p.speedLv`), `STAGES[n].onEnterCell/onStand`, `MOUNTS.current.passes`, fixture `movement.json` (T3).
- Produces: `nibble(btn)`, `blockedFor(p, v): [bloqueia, éBomba]`, `moveStep(s, p, btn, level): number` (um tick da ROM, devolve a direção 0..8), `movePlayer(s, p, btn, ev)` (nível efetivo, `moveDir`, `face`, `act` walk/idle/carryWalk/carryIdle, `footstep` a cada 20 ticks andando, ganchos de arena).

- [ ] **Step 1: Escrever os testes** `web/tests/core/movement.test.ts`

Casos medidos com `t100.py` (nível 1, andando para baixo, grade da fase 5). `rel` = (px − centro) da casa inicial.

```ts
import { arena, put, setCell, C } from './kit';
import { moveStep, movePlayer, blockedFor, nibble } from '../../src/core/movement';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { px, centerX, centerY, cellAt } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';

function walk(col: number, lin: number, dx: number, btn: number, n: number, level = 1): [number, number][] {
  const s = arena();
  const p = put(s, 0, col, lin, dx, 0);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { moveStep(s, p, btn, level); out.push([px(p.x) - px(centerX(col)), px(p.y) - px(centerY(lin))]); }
  return out;
}

describe('assistência de canto (t100, nível 1, para baixo)', () => {
  const OPEN: [number, number, number[]][] = [   // dx, tick em que entra na linha 2 (y ≥ +9), x nos 8 primeiros ticks
    [-9, 11, [-8, -7, -6, -5, -4, -3, -2, -1]], [-8, 10, [-7, -6, -5, -4, -3, -2, -1, 0]],
    [-7, 9, [-6, -5, -4, -3, -2, -1, 0, 0]], [-4, 9, [-3, -2, -1, -1, -1, -1, 0, 0]],
    [-3, 9, [-3, -2, -1, -1, -1, -1, 0, 0]], [-1, 9, [-1, 0, 0, 0, 0, 0, 0, 0]], [0, 9, [0, 0, 0, 0, 0, 0, 0, 0]],
    [1, 9, [1, 0, 0, 0, 0, 0, 0, 0]], [3, 9, [3, 2, 1, 1, 1, 1, 0, 0]], [4, 9, [3, 2, 1, 1, 1, 1, 0, 0]],
    [7, 9, [6, 5, 4, 3, 2, 1, 0, 0]], [8, 10, [7, 6, 5, 4, 3, 2, 1, 0]], [9, 11, [8, 7, 6, 5, 4, 3, 2, 1]],
  ];
  it.each(OPEN)('abertura (col 4, lin 1), dx=%i: entra no tick %i', (dx, enter, x8) => {
    const tr = walk(4, 1, dx, BTN.DOWN, 20);
    expect(tr.findIndex(([, y]) => y >= 9) + 1).toBe(enter);
    expect(tr.slice(0, 8).map(([x]) => x)).toEqual(x8);
  });
  it('pilar à frente (col 3, lin 1), |dx| ≤ 3: não anda', () => {
    for (const dx of [-3, -2, -1, 0, 1, 2, 3]) expect(walk(3, 1, dx, BTN.DOWN, 30)[29]).toEqual([dx, 0]);
  });
  it('pilar à frente, |dx| ≥ 4: desliza 1 px/tick e entra em diagonal', () => {
    expect(walk(3, 1, 4, BTN.DOWN, 30).slice(0, 6)).toEqual([[5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 1]]);
    expect(walk(3, 1, -4, BTN.DOWN, 30).slice(0, 6)).toEqual([[-5, 0], [-6, 0], [-7, 0], [-8, 0], [-9, 0], [-10, 1]]);
    const finals: [number, [number, number]][] = [[-9, [-16, 30]], [-8, [-16, 29]], [-6, [-16, 27]], [-4, [-16, 25]], [4, [16, 25]], [7, [16, 28]], [9, [16, 30]]];
    for (const [dx, f] of finals) expect(walk(3, 1, dx, BTN.DOWN, 30)[29]).toEqual(f);
  });
  it('parede ou bloco à frente, alinhado: para no centro', () => {
    const s = arena(); setCell(s, 4, 2, CODE.SOFT);
    const p = put(s, 0, 4, 1);
    for (let i = 0; i < 20; i++) moveStep(s, p, BTN.DOWN, 1);
    expect([p.x, p.y]).toEqual([centerX(4), centerY(1)]);
  });
});

describe('velocidade e regras', () => {
  it('nível 1 = 1 px/tick; nível 5 = 1,5; nível 6 = 2; nível 7 = 0,5 (linha 1 livre)', () => {
    for (const [lv, dist] of [[1, 60], [5, 90], [6, 120], [7, 30]] as const) {
      const s = arena(); const p = put(s, 0, 2, 1);
      for (let i = 0; i < 60; i++) moveStep(s, p, BTN.RIGHT, lv);
      expect(p.x - centerX(2)).toBe(dist * 256);
    }
  });
  it('parado zera as frações', () => {
    const s = arena(); const p = put(s, 0, 2, 1);
    for (let i = 0; i < 3; i++) moveStep(s, p, BTN.RIGHT, 7);
    expect(p.x & 0xff).toBe(0x80);
    expect(moveStep(s, p, 0, 7)).toBe(8);
    expect(p.x & 0xff).toBe(0);
  });
  it('nibble do direcional: R1 L2 D4 U8', () => {
    expect([nibble(BTN.RIGHT), nibble(BTN.LEFT), nibble(BTN.DOWN), nibble(BTN.UP), nibble(BTN.UP | BTN.RIGHT | BTN.A)]).toEqual([1, 2, 4, 8, 9]);
  });
  it('bloqueio pelos bits: soft/bomba/queimando/pressão/parede bloqueiam; item, chama e piso não', () => {
    const p = arena().players[0];
    const b = (v: number) => blockedFor(p, v)[0];
    expect([CODE.HARD, CODE.SOFT, CODE.BOMB, CODE.BURNING, CODE.PRESSURE].map(b)).toEqual([true, true, true, true, true]);
    expect([CODE.FLOOR, CODE.FLAME, 0x0941, 0x09a1, CODE.FALLING, CODE.ARROW, CODE.ORB].map(b)).toEqual([false, false, false, false, false, false, false]);
    expect(blockedFor(p, CODE.BOMB)).toEqual([true, true]);
    p.passSoft = true; p.passBomb = true;
    expect([b(CODE.SOFT), b(CODE.BOMB), b(CODE.HARD)]).toEqual([false, false, true]);
  });
  it('bomba na própria casa não prende; depois de sair não volta', () => {
    const s = arena(); const p = put(s, 0, 5, 1);
    setCell(s, 5, 1, CODE.BOMB);
    for (let i = 0; i < 16; i++) moveStep(s, p, BTN.RIGHT, 1);
    expect(cellAt(p.x, p.y)).toBe(C(6, 1));
    for (let i = 0; i < 30; i++) moveStep(s, p, BTN.LEFT, 1);
    expect(cellAt(p.x, p.y)).toBe(C(6, 1));
  });
});

describe('movePlayer', () => {
  it('face segue a direção (diagonal fica no horizontal); act walk/idle; actT0 reinicia', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    s.tick = 200; movePlayer(s, p, BTN.RIGHT | BTN.DOWN, ev);
    expect([p.face, p.act, p.actT0]).toEqual([2, 'walk', 200]);
    s.tick = 201; movePlayer(s, p, 0, ev);
    expect([p.act, p.moveDir, p.actT0]).toEqual(['idle', 8, 201]);
  });
  it('contra a parede continua olhando para ela', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    movePlayer(s, p, BTN.UP, ev);
    expect(p.face).toBe(0);
  });
  it('footstep a cada 20 ticks andando', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    for (let i = 0; i < 60; i++) { s.tick++; movePlayer(s, p, BTN.RIGHT, ev); }
    expect(ev.filter(e => e.type === 'footstep').length).toBe(3);
  });
  it('com bomba na mão: carryWalk/carryIdle', () => {
    const s = arena(); const p = put(s, 0, 2, 1); p.carry = 7; const ev: GameEvent[] = [];
    movePlayer(s, p, BTN.RIGHT, ev); expect(p.act).toBe('carryWalk');
    movePlayer(s, p, 0, ev); expect(p.act).toBe('carryIdle');
  });
  it('usa o nível da doença/efeito (speedLevel) e chama onEnterCell/onStand', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    const entered: number[] = []; let stood = 0;
    STAGES[1] = { onEnterCell: (_s, _p, c) => { entered.push(c); }, onStand: () => { stood++; } };
    try {
      for (let i = 0; i < 16; i++) movePlayer(s, p, BTN.RIGHT, ev);
      expect(entered).toEqual([C(3, 1)]);
      expect(stood).toBe(16);
    } finally { STAGES[1] = {}; }
  });
});
```

`web/tests/core/movement-golden.test.ts`:

```ts
import fixture from '../fixtures/rom/movement.json';
import { arena } from './kit';
import { moveStep } from '../../src/core/movement';

interface Trial { stage: number; grid: number[]; level: number; x0: number; y0: number; inputs: [number, number][]; d: number[] }

describe('golden de movimento (≥ 20.000 ticks do emulador)', () => {
  it('fixture bem formado', () => {
    expect(fixture.romSha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
    expect(fixture.ticks).toBeGreaterThanOrEqual(20000);
  });
  it('0 divergências', () => {
    let ticks = 0, bad = 0, first = '';
    for (const [n, t] of (fixture.trials as Trial[]).entries()) {
      const s = arena({ stage: t.stage });
      s.grid = [...t.grid];
      const p = s.players[0];
      p.x = t.x0; p.y = t.y0;
      let x = t.x0, y = t.y0, k = 0;
      for (const [mask, count] of t.inputs) for (let i = 0; i < count; i++, k++) {
        moveStep(s, p, mask, t.level);
        x += t.d[2 * k]; y += t.d[2 * k + 1];
        ticks++;
        if (p.x !== x || p.y !== y) { bad++; if (!first) first = `tentativa ${n}, tick ${k}: ${p.x},${p.y} ≠ ${x},${y}`; p.x = x; p.y = y; }
      }
    }
    expect(first).toBe('');
    expect(bad).toBe(0);
    expect(ticks).toBe(fixture.ticks);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/movement.test.ts tests/core/movement-golden.test.ts`
Expected: FAIL (stub não anda).

- [ ] **Step 3: Implementar `movement.ts`** (porte linha a linha de `movesim.step`; `cell_of` com as mesmas máscaras)

```ts
import { BTN, type GameEvent, type Player, type RoundState } from './types';
import { GRID_W, FACE_OF_DIR, cellAt } from './units';
import { A20, DIAM, DPAD, PAR, SUBPOS, TBL, speedVec } from './tables/movement';
import { setAct, setFace } from './state';
import { speedLevel } from './disease';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { FOOTSTEP_EVERY } from './constants';

/** Vizinhos N NE E SE S SW W NW, deslocamentos cumulativos em casas (NB do movesim, em unidades de casa). */
const NB = [-GRID_W, 1, GRID_W, GRID_W, -1, -1, -GRID_W, -GRID_W];

export function nibble(btn: number): number {
  return (btn & BTN.RIGHT ? 1 : 0) | (btn & BTN.LEFT ? 2 : 0) | (btn & BTN.DOWN ? 4 : 0) | (btn & BTN.UP ? 8 : 0);
}

/** blocked() do movesim com atravessa-soft/atravessa-bomba/montaria: [bloqueia ($82), é bomba ($86)]. */
export function blockedFor(p: Player, v: number): [boolean, boolean] {
  const lo = v & 0xefc0;
  if (lo === 0) return [false, false];
  if (lo === 0xc900) return p.passBomb ? [false, false] : [true, true];
  if (lo === 0xcc80) return p.passSoft || MOUNTS.current.passes?.(p, v) ? [false, false] : [true, false];
  return [(v & 0x8000) !== 0, false];
}

/** cell_of do movesim: ((py−$18) & $F0) e ((px+8) & $1F0), em casas. */
const cellOfPx = (xp: number, yp: number): number => (((yp - 24) & 0xf0) >> 4) * GRID_W + (((xp + 8) & 0x1f0) >> 4);
const parity = (xp: number, yp: number): number => PAR[((((yp + 8) & 0x10) | (((xp + 8) & 0x10) >> 1)) >> 3) & 3];

function neigh(s: RoundState, p: Player, cell: number): [number, number] {
  let b82 = 0, b86 = 0, c = cell;
  for (let i = 0; i < 8; i++) {
    c += NB[i];
    const [bl, bo] = blockedFor(p, s.grid[c] ?? 0);
    if (bl) b82 |= 1 << i;
    if (bo) b86 |= 1 << i;
  }
  return [b82, b86];
}

/** Um tick de movimento, idêntico a movesim.step. Devolve a direção (0..7, 8 = parado). */
export function moveStep(s: RoundState, p: Player, btn: number, level: number): number {
  let X = p.x, Y = p.y;
  const xp = X >> 8, yp = Y >> 8;
  const din = DPAD[nibble(btn)];
  if (din === 8) { p.x = X & ~0xff; p.y = Y & ~0xff; return 8; }
  const cell0 = cellOfPx(xp, yp);
  let [b82] = neigh(s, p, cell0);
  let xs = (xp - 8) & 15, ys = (yp - 8) & 15;
  const code = SUBPOS[ys * 16 + xs] & 15;
  const p84 = parity(xp, yp);
  const t = TBL[p84 & 3];
  const v = t[code * 8 + din];
  let d = v & 15;
  if (v & 0xf0 && (1 << (v >> 4)) & b82) {
    d = 8;
    if (p84) d = t[0x68 + (din & 7)] & 15;
  }
  let [vx, vy] = d < 9 ? speedVec(level, d) : [0, 0];
  const txp = (X + vx) >> 8, typ = (Y + vy) >> 8;
  const tcell = cellOfPx(txp, typ);
  if (tcell !== cell0 && !p.passBomb && ((s.grid[tcell] ?? 0) & 0xefc0) === 0xc900) return d;   // entrar em casa com bomba zera tudo
  let b86: number;
  [b82, b86] = neigh(s, p, tcell);
  ys = (typ - 8) & 15; xs = (txp - 8) & 15;
  let pxv = 0, pyv = 0;
  if (b82 & 0x01) pyv = A20[ys];
  if (pyv === 0 && b82 & 0x10) pyv = A20[8 + ys];
  if (b82 & 0x04) pxv = A20[8 + xs];
  if (pxv === 0 && b82 & 0x40) pxv = A20[xs];
  if (b86 & 0x01 && A20[ys]) { if (vy < 0) vy = 0; pyv = 0; }
  if (b86 & 0x04 && A20[8 + xs]) { if (vx >= 0) vx = 0; pxv = 0; }
  if (b86 & 0x10 && A20[8 + ys]) { if (vy >= 0) vy = 0; pyv = 0; }
  if (b86 & 0x40 && A20[xs]) { if (vx < 0) vx = 0; pxv = 0; }
  if (parity(txp, typ) === 0 && pxv === 0 && pyv === 0) [pxv, pyv] = DIAM[ys * 16 + xs];
  vx += pxv >= 0 ? (pxv & 0xff) << 8 : -((-pxv) << 8);
  vy += pyv >= 0 ? (pyv & 0xff) << 8 : -((-pyv) << 8);
  X += vx; Y += vy;
  if (vx === 0 && vy === 0) { X &= ~0xff; Y &= ~0xff; }
  p.x = X; p.y = Y;
  return d;
}

/** Movimento de um tick com nível efetivo, face, ação de andar, passos e ganchos de arena. */
export function movePlayer(s: RoundState, p: Player, btn: number, ev: GameEvent[]): void {
  const before = cellAt(p.x, p.y);
  const din = DPAD[nibble(btn)];
  const d = moveStep(s, p, btn, speedLevel(s, p));
  p.moveDir = d;
  const moving = din !== 8;
  if (moving) setFace(s, p, FACE_OF_DIR[d !== 8 ? d : din]);
  setAct(s, p, p.carry >= 0 ? (moving ? 'carryWalk' : 'carryIdle') : moving ? 'walk' : 'idle');
  if (moving) { if (++p.walkT % FOOTSTEP_EVERY === 0) ev.push({ type: 'footstep', slot: p.slot }); } else p.walkT = 0;
  const now = cellAt(p.x, p.y);
  const st = STAGES[s.stage];
  if (now !== before && now >= 0) st?.onEnterCell?.(s, p, now, ev);
  if (now >= 0) st?.onStand?.(s, p, now, ev);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/movement.test.ts tests/core/movement-golden.test.ts && npx tsc --noEmit`
Expected: PASS, 0 divergências. Se o golden divergir, compare com `movesim.step` linha a linha antes de mexer nos testes: o golden é a autoridade.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/movement.ts web/tests/core/movement.test.ts web/tests/core/movement-golden.test.ts
git commit -m "$(cat <<'MSG'
feat(core): movimento fiel (porte do movesim) com golden de 20.000 ticks do emulador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Montagem da rodada e prêmio do Racer

**Possui:** `web/src/core/setup.ts`, `web/src/core/racer.ts`, `web/tests/core/setup.test.ts`, `web/tests/core/setup-golden.test.ts`, `web/tests/core/racer.test.ts`.

**Interfaces:**
- Consumes: `tables/{stages,items,cells,misc}` (T2), `rounds.json` (T3), `state.emptyRound`, `STAGES[n].init`, `MOUNTS.current.init`.
- Produces: `createRound(stage, rules, rng, opts?)` (§3.3 exata), `RoundOptions`; `applyRacerPrize(p, prize)`, `drawRacerPrize(rng)`, `RACER_PRIZES`.

- [ ] **Step 1: Escrever os testes**

`web/tests/core/setup-golden.test.ts`:

```ts
import fixture from '../fixtures/rom/rounds.json';
import { createRound } from '../../src/core/setup';
import { makeRng, rnd } from '../../src/core/rng';
import { rules } from './kit';
import { CODE } from '../../src/core/types';
import { romOff, colOf, linOf } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';

type StageFx = { soft: number[]; items: [number, number][]; afterRemove: number; afterItems: number };
const stages = fixture.stages as Record<string, StageFx>;
const off = (c: number) => romOff(colOf(c), linOf(c));

describe('golden: montagem das 10 fases (5 jogadores, semente de boot)', () => {
  it('RNG: as 207 chamadas do t52 batem', () => {
    const r = makeRng(fixture.rng.start);
    for (const [n, v] of fixture.rng.calls as [number, number][]) expect(rnd(r, n)).toBe(v);
    expect(r.seed).toBe(fixture.rng.final);
  });
  for (let k = 1; k <= 10; k++) {
    it(`fase ${k}: soft blocks, itens escondidos e sementes`, () => {
      const fx = stages[String(k)];
      let atInit = -1;
      STAGES[k] = { init: s => { atInit = s.rng.seed; if (k === 6) rnd(s.rng, 64); } };   // arena 6: 64 + rnd(64) (plano 8)
      try {
        const s = createRound(k, rules(), makeRng());
        expect(atInit).toBe(fx.afterRemove);
        const soft = s.grid.map((v, c) => (v === CODE.SOFT ? off(c) : -1)).filter(v => v >= 0).sort((a, b) => a - b);
        expect(soft).toEqual(fx.soft);
        expect(s.hidden.map(([c, i]) => [off(c), i])).toEqual(fx.items);
        expect(s.rng.seed).toBe(fx.afterItems);
      } finally { STAGES[k] = {}; }
    });
  }
});
```

`web/tests/core/setup.test.ts`:

```ts
import { createRound } from '../../src/core/setup';
import { makeRng } from '../../src/core/rng';
import { rules } from './kit';
import { CODE } from '../../src/core/types';
import { cellOf, SPAWNS, spawnX, spawnY } from '../../src/core/units';
import { STAGE_ITEMS } from '../../src/core/tables/items';
import { STAGES } from '../../src/core/stages';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

const around = (col: number, lin: number) => [-1, 0, 1].flatMap(dl => [-1, 0, 1].map(dc => cellOf(col + dc, lin + dl)));

describe('montagem da rodada (§3.3)', () => {
  it('1 chamada rnd($FF) por jogador presente: fase 8 com 5 jogadores termina em $C689; com 2, em $4FAB', () => {
    expect(createRound(8, rules(), makeRng()).rng.seed).toBe(0xc689);
    expect(createRound(8, rules({ active: [true, true, false, false, false] }), makeRng()).rng.seed).toBe(0x4fab);
  });
  it('fase 5: 15 tentativas sem soft e a lista também sem soft → termina (semente $9401)', () => {
    expect(createRound(5, rules(), makeRng()).rng.seed).toBe(0x9401);
  });
  it('3×3 em volta de cada spawn presente fica livre', () => {
    const s = createRound(1, rules(), makeRng());
    for (const [col, lin] of SPAWNS) for (const c of around(col, lin)) expect(s.grid[c] === CODE.SOFT).toBe(false);
  });
  it('spawn ausente não abre o 3×3 (P5 desligado na fase 1)', () => {
    const s = createRound(1, rules({ active: [true, true, true, true, false] }), makeRng());
    expect(around(8, 6).some(c => s.grid[c] === CODE.SOFT)).toBe(true);
  });
  it('itens escondidos só sob soft, sem repetir casa, na quantidade da lista', () => {
    for (const k of [1, 2, 3, 4, 6, 7, 9, 10]) {
      const s = createRound(k, rules(), makeRng());
      expect(s.hidden.length).toBe(STAGE_ITEMS[k - 1].length);
      expect(new Set(s.hidden.map(([c]) => c)).size).toBe(s.hidden.length);
      for (const [c] of s.hidden) expect(s.grid[c]).toBe(CODE.SOFT);
    }
  });
  it('init da arena roda depois da remoção e antes dos itens; init da montaria também', () => {
    const order: string[] = [];
    STAGES[4] = { init: s => { order.push(`stage:${s.hidden.length}`); } };
    MOUNTS.current = { ...NO_MOUNT, init: s => { order.push(`mount:${s.hidden.length}`); } };
    try { createRound(4, rules(), makeRng()); } finally { STAGES[4] = {}; MOUNTS.current = NO_MOUNT; }
    expect(order).toEqual(['stage:0', 'mount:0']);
  });
  it('status inicial: nível 1, 1 bomba, fogo 0, sem invencibilidade; nos spawns, olhando para baixo', () => {
    const s = createRound(1, rules(), makeRng());
    s.players.forEach((p, i) => {
      expect([p.speedLv, p.bombsCap, p.bombsFree, p.fire, p.inv, p.face]).toEqual([1, 1, 1, 0, 0, 4]);
      expect([p.x, p.y]).toEqual([spawnX(SPAWNS[i][0]), spawnY(SPAWNS[i][1])]);
      expect(p.act).toBe('idle');
    });
    expect(s.phase).toBe('intro');
  });
  it('fase 5: 5 bombas, fogo 4, chute, soco, luva e P', () => {
    const p = createRound(5, rules(), makeRng()).players[0];
    expect([p.bombsCap, p.bombsFree, p.fire, p.kick, p.punch, p.glove, p.pItem]).toEqual([5, 5, 4, true, true, true, true]);
  });
  it('prêmio do Racer vale só com a regra ligada, em Todos contra Todos, para o slot premiado', () => {
    const on = rules({ racer: true });
    const s = createRound(1, on, makeRng(), { racerPrize: { slot: 2, prize: 0 } });
    expect(s.players.map(p => p.bombsCap)).toEqual([1, 1, 2, 1, 1]);
    expect(createRound(1, rules(), makeRng(), { racerPrize: { slot: 2, prize: 0 } }).players[2].bombsCap).toBe(1);
    expect(createRound(1, rules({ racer: true, mode: 'team' }), makeRng(), { racerPrize: { slot: 2, prize: 0 } }).players[2].bombsCap).toBe(1);
  });
  it('spawnOrder (opção extra) troca as casas de nascimento e abre o 3×3 nelas', () => {
    const s = createRound(1, rules(), makeRng(), { spawnOrder: [4, 3, 2, 1, 0] });
    expect([s.players[0].x, s.players[0].y]).toEqual([spawnX(8), spawnY(6)]);
    for (const c of around(8, 6)) expect(s.grid[c] === CODE.SOFT).toBe(false);
  });
  it('chars vão para os jogadores', () => {
    expect(createRound(1, rules(), makeRng(), { chars: [5, 4, 3, 2, 1] }).players.map(p => p.char)).toEqual([5, 4, 3, 2, 1]);
  });
});
```

`web/tests/core/racer.test.ts`:

```ts
import { applyRacerPrize, drawRacerPrize, RACER_PRIZES } from '../../src/core/racer';
import { createPlayer } from '../../src/core/state';
import { makeRng } from '../../src/core/rng';

const fresh = () => createPlayer(0, true);

describe('prêmios do Racer ($C2:08F4)', () => {
  it('17 entradas; sorteio rnd(17)', () => {
    expect(RACER_PRIZES).toBe(17);
    const r = makeRng();
    for (let i = 0; i < 50; i++) { const v = drawRacerPrize(r); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(17); }
  });
  it('efeitos na ordem da ROM', () => {
    const cases: [number, (p: ReturnType<typeof fresh>) => unknown, unknown][] = [
      [0, p => [p.bombsCap, p.bombsFree], [2, 2]],
      [1, p => p.bombType, 2],
      [2, p => p.fire, 1],
      [3, p => p.fullFire, true],
      [4, p => p.speedLv, 2],
      [5, p => [p.bombType, p.glove], [1, true]],
      [6, p => p.glove, true],
      [7, p => p.glove, true],
      [8, p => [p.kick, p.passBomb], [true, false]],
      [9, p => JSON.stringify(p), JSON.stringify(fresh())],
      [10, p => JSON.stringify(p), JSON.stringify(fresh())],
      [11, p => [p.passBomb, p.kick], [true, false]],
      [12, p => p.passSoft, true],
      [13, p => p.speedLv, 1],
      [14, p => p.punch, true],
      [15, p => p.heart, true],
      [16, p => p.pItem, true],
    ];
    for (const [prize, get, want] of cases) { const p = fresh(); applyRacerPrize(p, prize); expect(get(p)).toEqual(want); }
  });
  it('patins −1 não desce abaixo de 1; bomba+1 respeita o máximo 8', () => {
    const p = fresh(); p.speedLv = 3; applyRacerPrize(p, 13); expect(p.speedLv).toBe(2);
    p.bombsCap = 8; p.bombsFree = 8; applyRacerPrize(p, 0); expect(p.bombsCap).toBe(8);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/setup.test.ts tests/core/setup-golden.test.ts tests/core/racer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `racer.ts`**

```ts
import type { Player } from './types';
import { rnd, type Rng16 } from './rng';
import { MAX_CAPS } from './tables/misc';

export const RACER_PRIZES = 17;

/** Efeito do prêmio `prize` (índice em $C2:08F4, código lido em $C2:0954..$C2:09EB). */
export function applyRacerPrize(p: Player, prize: number): void {
  switch (prize) {
    case 0: if (p.bombsCap + 1 < MAX_CAPS.bombs) { p.bombsCap++; p.bombsFree++; } break;
    case 1: p.bombType = 2; break;
    case 2: if (p.fire + 1 < MAX_CAPS.fire) p.fire++; break;
    case 3: p.fullFire = true; break;
    case 4: if (p.speedLv + 1 < MAX_CAPS.speed) p.speedLv++; break;
    case 5: p.bombType = 1; p.glove = true; break;
    case 6: case 7: p.glove = true; break;
    case 8: p.kick = true; p.passBomb = false; break;
    case 11: p.passBomb = true; p.kick = false; break;
    case 12: p.passSoft = true; break;
    case 13: if (p.speedLv > 1) p.speedLv--; break;
    case 14: p.punch = true; break;
    case 15: p.heart = true; break;
    case 16: p.pItem = true; break;
    default: break;                        // 9 e 10: nada
  }
}

/** Sorteio provisório da corrida bônus (A2): uniforme nas 17 entradas. */
export function drawRacerPrize(rng: Rng16): number { return rnd(rng, RACER_PRIZES); }
```

- [ ] **Step 4: Implementar `setup.ts`** (porte de `arena_rom.build_arena` + `itemsim.build`)

```ts
import { CODE, type RoundState, type Rules } from './types';
import { rnd, type Rng16 } from './rng';
import { emptyRound } from './state';
import { GRID_W, SPAWNS, cellFromRomOff, cellOf, spawnX, spawnY } from './units';
import { STAGE_FACTS } from './tables/stages';
import { STAGE_ITEMS } from './tables/items';
import { FREE_CELLS } from './tables/cells';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { applyRacerPrize } from './racer';

export interface RoundOptions {
  racerPrize?: { slot: number; prize: number } | null;
  spawnOrder?: readonly number[];      // spawnOrder[slot] = índice em SPAWNS
  chars?: readonly number[];
}

/** 3×3 em volta do spawn: caminho cumulativo 0, −$40, +2, +$40, +$40, −2, −2, −$40, −$40 ($C4:1865). */
const CLEAR_PATH = [0, -GRID_W, 1, GRID_W, GRID_W, -1, -1, -GRID_W, -GRID_W];

/** Casa sorteada como no ROM: col = rnd(13), lin = rnd(11) → offset lin·$40 + col·2 + $44. */
function rollCell(s: RoundState): number {
  const col = rnd(s.rng, 13), lin = rnd(s.rng, 11);
  return cellOf(col + 2, lin + 1);
}

export function createRound(stage: number, rules: Rules, rng: Rng16, opts: RoundOptions = {}): RoundState {
  const s = emptyRound(stage, rules, rng);
  const facts = STAGE_FACTS[stage - 1];
  const order = opts.spawnOrder ?? [0, 1, 2, 3, 4];
  for (const p of s.players) {
    const [col, lin] = SPAWNS[order[p.slot]];
    p.x = spawnX(col); p.y = spawnY(lin); p.char = opts.chars?.[p.slot] ?? p.slot;
  }
  // 1. uma chamada rnd($FF) por jogador presente ($C2:02CD)
  for (const p of s.players) if (p.present) rnd(s.rng, 0xff);
  // 2. layout-base da fase
  s.grid = [...facts.base];
  const clear = (c: number): void => { s.grid[c] = facts.floorLogic[c]; };
  // 3. 3×3 em volta de cada jogador presente
  for (const p of s.players) {
    if (!p.present) continue;
    let c = cellOf(SPAWNS[order[p.slot]][0], SPAWNS[order[p.slot]][1]);
    for (const d of CLEAR_PATH) { c += d; clear(c); }
  }
  // 4. remove N soft blocks ($C4:179C)
  for (let left = facts.remove; left > 0; left--) {
    let done = false;
    for (let k = 0; k < 15 && !done; k++) { const c = rollCell(s); if (s.grid[c] === CODE.SOFT) { clear(c); done = true; } }
    if (done) continue;
    const c = FREE_CELLS.find(f => s.grid[f] === CODE.SOFT);
    if (c === undefined) break;
    clear(c);
  }
  // 5. objetos e sorteios da arena; montarias
  STAGES[stage]?.init?.(s);
  MOUNTS.current.init?.(s);
  // 6. itens escondidos ($C4:121D)
  const used = new Set<number>();
  for (const [off, item] of STAGE_ITEMS[stage - 1]) {
    let placed = -1;
    if (off === 0x44) {
      for (let k = 0; k < 15 && placed < 0; k++) { const c = rollCell(s); if (s.grid[c] === CODE.SOFT && !used.has(c)) placed = c; }
      if (placed < 0) placed = FREE_CELLS.find(f => s.grid[f] === CODE.SOFT && !used.has(f)) ?? -1;
    } else {
      const c = cellFromRomOff(off);
      if (s.grid[c] === CODE.SOFT) placed = c;
    }
    if (placed < 0) continue;
    used.add(placed);
    s.hidden.push([placed, item]);
  }
  // 7. status inicial
  for (const p of s.players) {
    if (!p.present || stage !== 5) continue;
    p.bombsCap = 5; p.bombsFree = 5; p.fire = 4; p.kick = true; p.punch = true; p.glove = true; p.pItem = true;
  }
  const rp = opts.racerPrize;
  if (rp && rules.racer && rules.mode === 'ffa' && s.players[rp.slot]?.present) applyRacerPrize(s.players[rp.slot], rp.prize);
  return s;
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/core/setup.test.ts tests/core/setup-golden.test.ts tests/core/racer.test.ts && npx tsc --noEmit`
Expected: PASS nas 10 fases.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/setup.ts web/src/core/racer.ts web/tests/core/setup.test.ts web/tests/core/setup-golden.test.ts web/tests/core/racer.test.ts
git commit -m "$(cat <<'MSG'
feat(core): montagem fiel da rodada (RNG por jogador, 3×3, remoção, itens da fase) e prêmios do Racer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 6: Bombas, explosões, chamas e queima

**Possui:** `web/src/core/bombs.ts`, `web/tests/core/bombs.test.ts`.

**Interfaces:**
- Consumes: `constants` (FUSE, FUSE_SHORT, FUSE_LONG, FLAME_TICKS, BURN_TICKS, CHAIN_DELAY, rangeOf), `state` (itemCode, isItemCode, newId, playerCell), `units` (faceStep, inField, cellCenter), `STAGES[n].fuseStep/onFlameCell`, `MOUNTS.current.bombType/revealEgg`, `kick.slideStep` (stub).
- Produces: todas as funções de `bombs.ts` da tabela de T1 (mantém `addBomb`, `bombAt`, `bombById`, `refundBomb`, `removeBomb` como estão), mais `setFlame(s, cell, piece)` e `burnCell(s, cell, kind)`.

Regras (decisões 9–13): pavio com `born`; `chainAt`; braços cima → direita → baixo → esquerda; última casa escrita = ponta; `HARD`/`PRESSURE`/`BURNING` param sem chama; `SOFT` queima e para (perfurante segue); item queima e para; outra bomba recebe `chainAt = tick + 2` e para o braço sem chama na casa dela; `FLOOR`/`FLAME` recebem `FLAME`; outro código passável chama `onFlameCell(s, cell, face, ev)` e o braço segue. Em `won` as bombas congelam; chamas e queimas continuam. Remota (tipo 1) não conta pavio.

- [ ] **Step 1: Escrever os testes** `web/tests/core/bombs.test.ts`

```ts
import { arena, put, setCell, codeAt, run, runUntil, C } from './kit';
import { addBomb, placeBomb, detonateRemote, tickBombs, bombAt, fuseOf, bombFireOf, canPlaceBomb } from '../../src/core/bombs';
import { BURN, CODE, FLAME_PIECE, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { STAGES } from '../../src/core/stages';

const explodedAt = (s: ReturnType<typeof arena>, max = 400) => runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion'), max);

describe('colocação', () => {
  it('A coloca na casa do jogador; gasta 1 bomba; não coloca em cima de outra', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const ev: GameEvent[] = [];
    expect(placeBomb(s, p, ev)).toBe(true);
    expect([codeAt(s, 4, 1), p.bombsFree]).toEqual([CODE.BOMB, 0]);
    expect(ev).toEqual([{ type: 'bomb_placed', slot: 0, cell: C(4, 1) }]);
    p.bombsFree = 1;
    expect(placeBomb(s, p, ev)).toBe(false);
  });
  it('só em casa de piso', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    setCell(s, 4, 1, itemCode(3));
    expect(placeBomb(s, p, [])).toBe(false);
  });
  it('doenças: $27/$28 mudam o contador; $25 fogo 10 e só com todas livres; $24 impede; fogo total = 7', () => {
    const p = arena().players[0];
    p.disease = 0x27; expect(fuseOf(p)).toBe(62);
    p.disease = 0x28; expect(fuseOf(p)).toBe(253);
    p.disease = 0; expect(fuseOf(p)).toBe(126);
    p.fullFire = true; expect(bombFireOf(p)).toBe(7);
    p.disease = 0x25; expect(bombFireOf(p)).toBe(10);
    p.bombsCap = 2; p.bombsFree = 1; expect(canPlaceBomb(p)).toBe(false);
    p.bombsFree = 2; expect(canPlaceBomb(p)).toBe(true);
    p.disease = 0x24; expect(canPlaceBomb(p)).toBe(false);
  });
});

describe('pavio', () => {
  it('explode 127 ticks depois do tick da colocação (t24)', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    placeBomb(s, p, []);                         // tick 100
    expect(explodedAt(s)).toBe(227);
  });
  it('pavio $27 = 63 ticks; $28 = 254 ticks', () => {
    for (const [d, t] of [[0x27, 163], [0x28, 354]]) {
      const s = arena(); const p = put(s, 0, 4, 1); p.disease = d;
      placeBomb(s, p, []);
      expect(explodedAt(s)).toBe(t);
    }
  });
  it('fuseStep da arena: 2 por tick → 64 ticks', () => {
    STAGES[1] = { fuseStep: () => 2 };
    try {
      const s = arena(); placeBomb(s, put(s, 0, 4, 1), []);
      expect(explodedAt(s)).toBe(164);
    } finally { STAGES[1] = {}; }
  });
  it('remota não explode pelo pavio; B detona a mais antiga no mesmo tick', () => {
    const s = arena(); const p = put(s, 0, 2, 1);
    const a = addBomb(s, 0, C(4, 1), { type: 1 }); const b = addBomb(s, 0, C(6, 1), { type: 1 });
    expect(run(s, 300).some(e => e.type === 'explosion')).toBe(false);
    expect(detonateRemote(s, p, [])).toBe(true);
    const ev = run(s, 1);
    expect(ev.filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: a.cell, owner: 0 }]);
    expect(s.bombs).toEqual([b]);
  });
  it('em `won` as bombas congelam', () => {
    const s = arena(); const b = addBomb(s, 0, C(4, 1));
    s.phase = 'won';
    tickBombs(s, []); s.tick++; tickBombs(s, []);
    expect(b.fuse).toBe(126);
  });
});

describe('explosão', () => {
  function boom(col: number, lin: number, fire: number, type: 0 | 1 | 2 = 0) {
    const s = arena();
    const b = addBomb(s, 0, C(col, lin), { fire, type, fuse: 0 });
    b.born = 0;
    const ev = run(s, 1);                          // tick 101
    return { s, ev };
  }
  it('fogo 0 = alcance 2; peças centro/braço/ponta; parede e pilar param', () => {
    const { s } = boom(4, 1, 0);
    expect([codeAt(s, 4, 1), codeAt(s, 5, 1), codeAt(s, 6, 1), codeAt(s, 7, 1)]).toEqual([CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.FLOOR]);
    expect([codeAt(s, 3, 1), codeAt(s, 2, 1), codeAt(s, 4, 2), codeAt(s, 4, 3), codeAt(s, 4, 0)]).toEqual([CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.HARD]);
    const aux = (c: number, l: number) => s.cellAux[C(c, l)];
    expect([aux(4, 1), aux(5, 1), aux(6, 1), aux(3, 1), aux(2, 1), aux(4, 2), aux(4, 3)])
      .toEqual([FLAME_PIECE.CENTER, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.TIP_RIGHT, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.TIP_LEFT, FLAME_PIECE.ARM_DOWN, FLAME_PIECE.TIP_DOWN]);
    const { s: s2 } = boom(3, 1, 3);
    expect(codeAt(s2, 3, 2)).toBe(CODE.HARD);
    expect(codeAt(s2, 3, 3)).toBe(CODE.FLOOR);
  });
  it('alcance por fogo (t64): 7 → 9 casas; 10 → 1 casa', () => {
    const { s } = boom(2, 1, 7);
    expect(codeAt(s, 11, 1)).toBe(CODE.FLAME);
    expect(codeAt(s, 12, 1)).toBe(CODE.FLOOR);
    const { s: s2 } = boom(6, 1, 10);
    expect([codeAt(s2, 7, 1), codeAt(s2, 8, 1)]).toEqual([CODE.FLAME, CODE.FLOOR]);
  });
  it('chama dura 25 ticks em todas as casas (t23)', () => {
    const { s } = boom(4, 1, 0);                   // explodiu no tick 101
    run(s, 24);                                    // tick 125
    expect([codeAt(s, 4, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLAME, CODE.FLAME]);
    run(s, 1);                                     // tick 126 = 101 + 25
    expect([codeAt(s, 4, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLOOR, CODE.FLOOR]);
  });
  it('soft: queima 24 ticks e revela o item escondido; sem item vira piso', () => {
    const s = arena();
    setCell(s, 5, 1, CODE.SOFT); setCell(s, 4, 2, CODE.SOFT);
    s.hidden = [[C(5, 1), 0x03]];
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);                                     // tick 101
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), s.cellAux[C(5, 1)]]).toEqual([CODE.BURNING, CODE.FLOOR, BURN.SOFT]);
    run(s, 23);
    expect(codeAt(s, 5, 1)).toBe(CODE.BURNING);
    run(s, 1);                                     // tick 125 = 101 + 24
    expect([codeAt(s, 5, 1), codeAt(s, 4, 2)]).toEqual([itemCode(0x03), CODE.FLOOR]);
    expect(s.hidden).toEqual([]);
  });
  it('perfurante atravessa e queima todos os soft do alcance', () => {
    const s = arena();
    setCell(s, 5, 1, CODE.SOFT); setCell(s, 6, 1, CODE.SOFT);
    const b = addBomb(s, 0, C(4, 1), { fuse: 0, fire: 2, type: 2 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), codeAt(s, 7, 1), codeAt(s, 8, 1)]).toEqual([CODE.BURNING, CODE.BURNING, CODE.FLAME, CODE.FLAME]);
  });
  it('item no braço queima (some) e segura a chama; não reaparece', () => {
    const s = arena(); setCell(s, 5, 1, itemCode(0x01));
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), s.cellAux[C(5, 1)]]).toEqual([CODE.BURNING, CODE.FLOOR, BURN.ITEM]);
    run(s, 24);
    expect(codeAt(s, 5, 1)).toBe(CODE.FLOOR);
  });
  it('bloco queimando segura a chama', () => {
    const s = arena(); setCell(s, 5, 1, CODE.BURNING); s.cellT0[C(5, 1)] = 100;
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);
    expect(codeAt(s, 6, 1)).toBe(CODE.FLOOR);
  });
  it('reação em cadeia: a bomba atingida explode 2 ticks depois; o braço não entra na casa dela (t99)', () => {
    const s = arena();
    const a = addBomb(s, 0, C(4, 1), { fuse: 0 }); a.born = 0;
    addBomb(s, 1, C(6, 1));
    const ev1 = run(s, 1);                         // tick 101
    expect(ev1.filter(e => e.type === 'explosion').length).toBe(1);
    expect(codeAt(s, 6, 1)).toBe(CODE.BOMB);
    expect(run(s, 1).some(e => e.type === 'explosion')).toBe(false);
    expect(run(s, 1).filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(6, 1), owner: 1 }]);   // tick 103
  });
  it('explosão devolve a bomba ao dono', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    placeBomb(s, p, []);
    expect(p.bombsFree).toBe(0);
    explodedAt(s);
    expect(p.bombsFree).toBe(1);
  });
  it('código especial passável: chama onFlameCell e o braço segue', () => {
    const s = arena(); setCell(s, 5, 1, CODE.ARROW);
    const calls: [number, number][] = [];
    STAGES[1] = { onFlameCell: (_s, cell, dir) => { calls.push([cell, dir]); } };
    try {
      const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
      run(s, 1);
    } finally { STAGES[1] = {}; }
    expect(calls).toEqual([[C(5, 1), 2]]);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1)]).toEqual([CODE.ARROW, CODE.FLAME]);
  });
  it('bombAt só acha bomba parada', () => {
    const s = arena(); const b = addBomb(s, 0, C(4, 1));
    expect(bombAt(s, C(4, 1))).toBe(b);
    b.state = 'held';
    expect(bombAt(s, C(4, 1))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/bombs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `bombs.ts`** (substitui o stub; mantém literalmente `bombAt`, `bombById`, `addBomb`, `refundBomb`, `removeBomb` do stub)

```ts
import { BURN, CODE, DISEASE, FLAME_PIECE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { BAD_COOLDOWN, BURN_TICKS, CHAIN_DELAY, FLAME_TICKS, FUSE, FUSE_LONG, FUSE_SHORT, rangeOf } from './constants';
import { CELLS, cellCenter, colOf, faceStep, inGrid, linOf } from './units';
import { isItemCode, itemCode, newId, playerCell } from './state';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { slideStep } from './kick';

const ARM = [FLAME_PIECE.ARM_UP, 0, FLAME_PIECE.ARM_RIGHT, 0, FLAME_PIECE.ARM_DOWN, 0, FLAME_PIECE.ARM_LEFT];
const TIP = [FLAME_PIECE.TIP_UP, 0, FLAME_PIECE.TIP_RIGHT, 0, FLAME_PIECE.TIP_DOWN, 0, FLAME_PIECE.TIP_LEFT];

export function fuseOf(p: Player): number {
  return p.disease === DISEASE.SHORT_FUSE ? FUSE_SHORT : p.disease === DISEASE.LONG_FUSE ? FUSE_LONG : FUSE;
}
export function bombFireOf(p: Player): number {
  return p.disease === DISEASE.LOW_FIRE ? 10 : p.fullFire ? 7 : p.fire;
}
export function canPlaceBomb(p: Player): boolean {
  if (p.bombsFree <= 0 || p.disease === DISEASE.CONSTIPATION) return false;
  return p.disease !== DISEASE.LOW_FIRE || p.bombsFree === p.bombsCap;
}

// bombAt, bombById, addBomb, refundBomb, removeBomb: copiar do stub de T1 sem mudanças.

export function placeBomb(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!canPlaceBomb(p)) return false;
  const cell = playerCell(p);
  if (cell < 0 || s.grid[cell] !== CODE.FLOOR) return false;
  if (s.bombs.some(b => b.cell === cell && (b.state === 'idle' || b.state === 'kicked'))) return false;
  addBomb(s, p.slot, cell, { fuse: fuseOf(p), fire: bombFireOf(p), type: MOUNTS.current.bombType?.(p) ?? p.bombType });
  p.bombsFree--;
  ev.push({ type: 'bomb_placed', slot: p.slot, cell });
  return true;
}

export function setFlame(s: RoundState, cell: number, piece: number): void {
  s.grid[cell] = CODE.FLAME; s.cellT0[cell] = s.tick; s.cellAux[cell] = piece;
}
export function burnCell(s: RoundState, cell: number, kind: number): void {
  s.grid[cell] = CODE.BURNING; s.cellT0[cell] = s.tick; s.cellAux[cell] = kind;
}

export function explodeBomb(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  refundBomb(s, b);
  const st = STAGES[s.stage];
  const c0 = b.cell;
  const v0 = s.grid[c0];
  if (v0 === CODE.BOMB || v0 === CODE.FLOOR || v0 === CODE.FLAME) setFlame(s, c0, FLAME_PIECE.CENTER);
  else st?.onFlameCell?.(s, c0, -1, ev);
  ev.push({ type: 'explosion', cell: c0, owner: b.owner });
  const range = rangeOf(b.fire);
  for (const face of [0, 2, 4, 6]) {
    let c = c0, last = -1;
    for (let k = 1; k <= range; k++) {
      c = faceStep(c, face);
      if (!inGrid(colOf(c), linOf(c))) break;
      const v = s.grid[c];
      if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) break;
      if (v === CODE.SOFT) { burnCell(s, c, BURN.SOFT); if (b.type === 2) continue; break; }
      if (isItemCode(v)) { burnCell(s, c, BURN.ITEM); break; }
      if (v === CODE.BOMB) {
        const o = bombAt(s, c);
        if (o && (o.chainAt === 0 || o.chainAt > s.tick + CHAIN_DELAY)) o.chainAt = s.tick + CHAIN_DELAY;
        break;
      }
      if (v === CODE.FLOOR || v === CODE.FLAME) { setFlame(s, c, ARM[face]); last = c; continue; }
      st?.onFlameCell?.(s, c, face, ev);         // código especial passável: a arena decide; o braço segue
    }
    if (last >= 0) s.cellAux[last] = TIP[face];
  }
}

export function detonateRemote(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  const b = s.bombs
    .filter(x => x.owner === p.slot && !x.bad && x.type === 1 && (x.state === 'idle' || x.state === 'kicked') && x.chainAt === 0)
    .sort((a, c) => a.id - c.id)[0];
  if (!b) return false;
  b.chainAt = s.tick;
  return true;
}

export function revealCell(s: RoundState, cell: number, ev: GameEvent[]): void {
  s.grid[cell] = CODE.FLOOR; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
  const k = s.hidden.findIndex(([c]) => c === cell);
  if (k < 0) return;
  const item = s.hidden[k][1];
  s.hidden.splice(k, 1);
  if (item >= 0x30 && item <= 0x3f) MOUNTS.current.revealEgg(s, cell, ev);
  else s.grid[cell] = itemCode(item);
}

export function tickBombs(s: RoundState, ev: GameEvent[]): void {
  if (s.phase === 'won') return;
  const st = STAGES[s.stage];
  for (const b of [...s.bombs]) {
    if (!s.bombs.includes(b)) continue;
    if (b.born === s.tick || b.state === 'held' || b.state === 'air') continue;
    if (b.chainAt && s.tick >= b.chainAt) { explodeBomb(s, b, ev); continue; }
    if (b.state === 'kicked') {
      slideStep(s, b, ev);
      if (s.grid[b.cell] === CODE.FLAME && !b.chainAt) b.chainAt = s.tick + 1;
    }
    if (b.type === 1) continue;
    if (b.fuse === 0) { explodeBomb(s, b, ev); continue; }
    b.fuse = Math.max(0, b.fuse - (st?.fuseStep?.(s, b) ?? 1));
  }
}

export function tickCells(s: RoundState, ev: GameEvent[]): void {
  for (let c = 0; c < CELLS; c++) {
    const v = s.grid[c];
    if (v === CODE.FLAME && s.tick - s.cellT0[c] >= FLAME_TICKS) { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    else if (v === CODE.BURNING && s.tick - s.cellT0[c] >= BURN_TICKS) {
      if (s.cellAux[c] === BURN.SOFT) revealCell(s, c, ev);
      else { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    }
  }
}
```

(`cellCenter`, `newId`, `BAD_COOLDOWN` e `FUSE` são usados pelas funções copiadas do stub.)

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/bombs.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/bombs.ts web/tests/core/bombs.test.ts
git commit -m "$(cat <<'MSG'
feat(core): bombas fiéis — pavio 127, chama 25, cadeia +2, queima 24, perfurante, remota

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Chute e botão X

**Possui:** `web/src/core/kick.ts`, `web/tests/core/kick.test.ts`.

**Interfaces:**
- Consumes: `tables/movement` (`KICK_MASK`, `KICK_DIRBIT`), `tables/flights` (`KICK_STEP`), `bombs.bombAt`, `state`, `units`, `STAGES[n].kickedBombEnter`, `MOUNTS.current.kicks`.
- Produces: `tryKick(s, p, ev): boolean`, `slideStep(s, b, ev)` (um tick do deslize; chamado por `tickBombs`), `stopKick(s, p)`.

Regras (decisão 14): o chute dispara com a bomba **parada** na casa vizinha da face, `fuse ∉ {0,1}`, e a máscara da subposição; a bomba sai da grade. Em `step === 0` (alinhada), antes de entrar na próxima casa, para se `code & 0x8400`, ovo, outra bomba parada/chutada ou jogador de pé; senão consulta `kickedBombEnter` (`'stop'` para; `{turn}` entra e vira ao chegar); item é esmagado; casa com chama marca `chainAt = tick + 1`. Anda `KICK_STEP[face/2][step]` (2 px) por tick; 8 passos por casa.

- [ ] **Step 1: Escrever os testes** `web/tests/core/kick.test.ts`

```ts
import { arena, put, setCell, codeAt, C } from './kit';
import { tryKick, slideStep, stopKick } from '../../src/core/kick';
import { addBomb } from '../../src/core/bombs';
import { CODE, type Bomb, type GameEvent, type RoundState } from '../../src/core/types';
import { centerX, centerY } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { STAGES } from '../../src/core/stages';

function slide(s: RoundState, b: Bomb, n: number, ev: GameEvent[] = []): void {
  for (let i = 0; i < n; i++) { s.tick++; if (b.state === 'kicked') slideStep(s, b, ev); }
}
function setup(bombCol = 5, lin = 1) {
  const s = arena();
  const p = put(s, 0, bombCol - 1, lin); p.kick = true; p.face = 2;
  const b = addBomb(s, 1, C(bombCol, lin));
  return { s, p, b };
}

describe('chute (t36, t41, t91)', () => {
  it('dispara no centro olhando para a bomba; a bomba sai da grade', () => {
    const { s, p, b } = setup(); const ev: GameEvent[] = [];
    expect(tryKick(s, p, ev)).toBe(true);
    expect([b.state, b.dir, b.kickedBy, codeAt(s, 5, 1)]).toEqual(['kicked', 2, 0, CODE.FLOOR]);
    expect(ev).toEqual([{ type: 'bomb_kicked', slot: 0 }]);
  });
  it('não dispara sem Chute, 2 px antes do centro, nem com pavio 1', () => {
    let k = setup(); k.p.kick = false; expect(tryKick(k.s, k.p, [])).toBe(false);
    k = setup(); k.p.x = centerX(4) - 2 * 256; expect(tryKick(k.s, k.p, [])).toBe(false);
    k = setup(); k.p.x = centerX(4) - 256; expect(tryKick(k.s, k.p, [])).toBe(true);
    k = setup(); k.b.fuse = 1; expect(tryKick(k.s, k.p, [])).toBe(false);
  });
  it('2 px/tick, 8 ticks por casa; para alinhada antes da parede (col 14)', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []);
    slide(s, b, 1); expect(b.x).toBe(centerX(5) + 2 * 256);
    slide(s, b, 7); expect([b.cell, b.x]).toEqual([C(6, 1), centerX(6)]);
    slide(s, b, 64); expect([b.cell, b.state]).toEqual([C(14, 1), 'kicked']);
    slide(s, b, 1); expect([b.state, codeAt(s, 14, 1), b.x, b.y]).toEqual(['idle', CODE.BOMB, centerX(14), centerY(1)]);
  });
  it('para antes de jogador, soft e outra bomba', () => {
    for (const block of ['player', 'soft', 'bomb'] as const) {
      const { s, p, b } = setup();
      if (block === 'player') put(s, 1, 8, 1);
      if (block === 'soft') setCell(s, 8, 1, CODE.SOFT);
      if (block === 'bomb') addBomb(s, 1, C(8, 1));
      tryKick(s, p, []);
      slide(s, b, 40);
      expect([b.state, b.cell]).toEqual(['idle', C(7, 1)]);
    }
  });
  it('item no caminho é esmagado e a bomba segue', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, itemCode(0x03));
    tryKick(s, p, []);
    slide(s, b, 100);
    expect([codeAt(s, 7, 1), b.cell]).toEqual([CODE.FLOOR, C(14, 1)]);
  });
  it('ovo bloqueia', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, 0x097a);
    tryKick(s, p, []); slide(s, b, 40);
    expect(b.cell).toBe(C(6, 1));
  });
  it('X para a bomba chutada pelo jogador na casa em que ela está', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []);
    slide(s, b, 12);                               // centro em x = centro(5) + 24 px → casa 6
    stopKick(s, p);
    expect([b.state, b.cell, b.x, codeAt(s, 6, 1)]).toEqual(['idle', C(6, 1), centerX(6), CODE.BOMB]);
  });
  it('entrar em casa com chama marca a explosão para o tick seguinte', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, CODE.FLAME);
    tryKick(s, p, []);
    slide(s, b, 8);                                // chega em (6,1) no tick 108
    slide(s, b, 1);                                // tick 109: decide entrar em (7,1)
    expect(b.chainAt).toBe(110);
  });
  it('kickedBombEnter: stop para antes; {turn} entra e vira', () => {
    STAGES[1] = { kickedBombEnter: (_s, _b, cell) => (cell === C(8, 3) ? { turn: 4 } : 'go') };
    try {
      const { s, p, b } = setup(5, 3);
      tryKick(s, p, []);
      slide(s, b, 200);
      expect([b.state, b.cell]).toEqual(['idle', C(8, 11)]);
    } finally { STAGES[1] = {}; }
    STAGES[1] = { kickedBombEnter: (_s, _b, cell) => (cell === C(9, 1) ? 'stop' : 'go') };
    try {
      const { s, p, b } = setup();
      tryKick(s, p, []); slide(s, b, 100);
      expect(b.cell).toBe(C(8, 1));
    } finally { STAGES[1] = {}; }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/kick.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `kick.ts`**

```ts
import { CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { KICK_DIRBIT, KICK_MASK } from './tables/movement';
import { KICK_STEP } from './tables/flights';
import { KICK_STEPS } from './constants';
import { SUB, cellAt, cellCenter, faceStep, subX, subY } from './units';
import { isEggCode, isItemCode, playerCell, standing } from './state';
import { bombAt } from './bombs';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';

/** Chute automático ($C2:4307): depois do movimento, olhando para uma bomba parada vizinha. */
export function tryKick(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!(p.kick || MOUNTS.current.kicks?.(p))) return false;
  const here = playerCell(p);
  if (here < 0 || !(KICK_MASK[subY(p.y) * 16 + subX(p.x)] & KICK_DIRBIT[p.face >> 1])) return false;
  const n = faceStep(here, p.face);
  if (s.grid[n] !== CODE.BOMB) return false;
  const b = bombAt(s, n);
  if (!b || b.fuse <= 1) return false;
  b.state = 'kicked'; b.dir = p.face; b.step = 0; b.kickedBy = p.slot; b.turn = -1;
  s.grid[n] = CODE.FLOOR;
  ev.push({ type: 'bomb_kicked', slot: p.slot });
  return true;
}

function park(s: RoundState, b: Bomb, cell: number): void {
  b.state = 'idle'; b.step = 0; b.cell = cell; b.turn = -1;
  [b.x, b.y] = cellCenter(cell);
  s.grid[cell] = CODE.BOMB;
}

/** Um tick do deslize ($C1:34D0/$C1:35E1). */
export function slideStep(s: RoundState, b: Bomb, _ev: GameEvent[]): void {
  if (b.step === 0) {
    const next = faceStep(b.cell, b.dir);
    const v = s.grid[next] ?? CODE.HARD;
    const blocked = (v & 0x8400) !== 0 || isEggCode(v)
      || s.bombs.some(o => o !== b && o.cell === next && (o.state === 'idle' || o.state === 'kicked'))
      || s.players.some(q => standing(q) && playerCell(q) === next);
    const verdict = blocked ? 'stop' : STAGES[s.stage]?.kickedBombEnter?.(s, b, next) ?? 'go';
    if (verdict === 'stop') { park(s, b, b.cell); return; }
    if (typeof verdict === 'object') b.turn = verdict.turn;
    if (isItemCode(v)) s.grid[next] = CODE.FLOOR;         // item esmagado
    if (v === CODE.FLAME) b.chainAt = s.tick + 1;
  }
  const [dx, dy] = KICK_STEP[b.dir >> 1][b.step];
  b.x += dx * SUB; b.y += dy * SUB;
  if (++b.step === KICK_STEPS) {
    b.step = 0;
    b.cell = faceStep(b.cell, b.dir);
    [b.x, b.y] = cellCenter(b.cell);
    if (b.turn >= 0) { b.dir = b.turn as 0 | 2 | 4 | 6; b.turn = -1; }
  }
}

/** Botão X: para as bombas chutadas por `p` na casa do centro delas. */
export function stopKick(s: RoundState, p: Player): void {
  for (const b of s.bombs) if (b.state === 'kicked' && b.kickedBy === p.slot) park(s, b, cellAt(b.x, b.y));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/kick.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/kick.ts web/tests/core/kick.test.ts
git commit -m "$(cat <<'MSG'
feat(core): chute automático pela máscara da ROM, deslize de 2 px/tick e parada com X

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 8: Voadores — soco, luva, quique, volta pela borda, itens voando

**Possui:** `web/src/core/flyers.ts`, `web/tests/core/flyers.test.ts`.

**Interfaces:**
- Consumes: `tables/flights`, `bombs` (`bombAt`, `bombById`, `removeBomb`), `hit.stunPlayer` (stub), `state`, `units`.
- Produces: as funções de `flyers.ts` da tabela de T1 (mantém `handFrom`, `launchBomb`, `spawnItemFlyer` do stub).

Regras (decisões 15 e 16): voadores começam a andar no tick seguinte ao da criação; cada tick aplica um passo do script (horizontal: `x += dx`, `z += dy`; vertical: `y += dy`), depois a volta pela borda; no último passo, pousa. Soco sai do centro da casa da bomba com `z = 0`; arremesso da luva e itens saem de `handFrom(centro da casa, dir)`. Quique: script `BOUNCE` na mesma direção a partir do centro da casa de pouso; depois de 32 quiques seguidos a bomba some e volta ao dono (proteção contra laço; 🟡). Soco: pose `punch` de 8 ticks mesmo sem bomba. Luva: `lift` de 4 ticks; arremesso: pose `throw` de 20 ticks, mira 2/3/4 no 1º jogador de pé na direção, senão 5.

- [ ] **Step 1: Escrever os testes** `web/tests/core/flyers.test.ts`

```ts
import { arena, put, setCell, codeAt, C } from './kit';
import { punchBomb, startLift, throwHeld, aimThrow, tickFlyers, spawnItemFlyer, dropHeld } from '../../src/core/flyers';
import { addBomb, bombById } from '../../src/core/bombs';
import { CODE, type GameEvent, type RoundState } from '../../src/core/types';
import { itemCode } from '../../src/core/state';

function fly(s: RoundState, n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; tickFlyers(s, ev); }
  return ev;
}
function punchSetup(bomb: [number, number], player: [number, number], face: 0 | 2 | 4 | 6, players = 2) {
  const s = arena({ players });
  const p = put(s, 0, player[0], player[1]); p.punch = true; p.face = face;
  const b = addBomb(s, 0, C(bomb[0], bomb[1]));
  return { s, p, b };
}

describe('soco (t42, t43, t49)', () => {
  it('3 casas em 17 ticks, pavio congelado; pose de soco', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2); const ev: GameEvent[] = [];
    expect(punchBomb(s, p, ev)).toBe(true);
    expect([b.state, codeAt(s, 5, 1), p.act, p.actLeft]).toEqual(['air', CODE.FLOOR, 'punch', 8]);
    expect(ev).toEqual([{ type: 'punch', slot: 0 }]);
    fly(s, 16);
    expect(b.state).toBe('air');
    const ev2 = fly(s, 1);
    expect([b.state, b.cell, codeAt(s, 8, 1), b.fuse]).toEqual(['idle', C(8, 1), CODE.BOMB, 126]);
    expect(ev2).toEqual([{ type: 'bomb_landed', cell: C(8, 1) }]);
    expect(s.flyers).toEqual([]);
  });
  it('arco horizontal com pico de 10 px', () => {
    const { s, p } = punchSetup([5, 1], [4, 1], 2);
    punchBomb(s, p, []);
    let minZ = 0;
    for (let i = 0; i < 17; i++) { fly(s, 1); if (s.flyers[0]) minZ = Math.min(minZ, s.flyers[0].z); }
    expect(minZ).toBe(-10);
  });
  it('sem bomba à frente: só a pose', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
    expect(punchBomb(s, p, [])).toBe(false);
    expect(p.act).toBe('punch');
  });
  it('pouso em casa ocupada quica 1 casa em 8 ticks', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.SOFT);
    punchBomb(s, p, []);
    const ev = fly(s, 25);
    expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
    expect(ev.filter(e => e.type === 'bomb_bounce').length).toBe(1);
  });
  it('volta pela borda: da col 13 para a direita pousa na col 2 (17 + 3 × 8 ticks)', () => {
    const { s, p, b } = punchSetup([13, 3], [12, 3], 2);
    punchBomb(s, p, []);
    fly(s, 40); expect(b.state).toBe('air');
    fly(s, 1); expect([b.state, b.cell]).toEqual(['idle', C(2, 3)]);
  });
  it('volta pela borda: da lin 2 para cima, com jogador em (2,11), pousa na lin 10 (t49)', () => {
    const { s, p, b } = punchSetup([2, 2], [2, 3], 0, 4);
    put(s, 3, 2, 11);
    punchBomb(s, p, []);
    const ev = fly(s, 33);
    expect([b.state, b.cell]).toEqual(['idle', C(2, 10)]);
    expect(ev.filter(e => e.type === 'bomb_bounce').length).toBe(2);
  });
  it('pouso em bloco queimando: a bomba some', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.BURNING);
    punchBomb(s, p, []);
    fly(s, 17);
    expect(bombById(s, b.id)).toBeUndefined();
    expect(s.flyers).toEqual([]);
    expect(p.bombsFree).toBe(1);
  });
  it('pouso em chama: vira bomba e explode em 2 ticks', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.FLAME);
    punchBomb(s, p, []);
    fly(s, 17);
    expect([b.state, b.chainAt]).toEqual(['idle', s.tick + 2]);
  });
  it('em `won` voadores congelam', () => {
    const { s, p } = punchSetup([5, 1], [4, 1], 2);
    punchBomb(s, p, []);
    s.phase = 'won';
    fly(s, 30);
    expect(s.flyers.length).toBe(1);
  });
});

describe('luva (t48)', () => {
  it('levanta em 4 ticks; a bomba sai da grade e fica na mão', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true;
    const b = addBomb(s, 0, C(4, 1));
    expect(startLift(s, p, [])).toBe(true);
    expect([b.state, p.carry, codeAt(s, 4, 1), p.act, p.actLeft]).toEqual(['held', b.id, CODE.FLOOR, 'lift', 4]);
    expect(startLift(s, p, [])).toBe(false);
  });
  it('sem alvo: 5 casas em 12 ticks (horizontal) e 11 ticks (vertical)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []);
    const ev: GameEvent[] = [];
    throwHeld(s, p, ev);
    expect([p.carry, p.act, p.actLeft]).toEqual([-1, 'throw', 20]);
    expect(ev).toEqual([{ type: 'throw', slot: 0 }]);
    fly(s, 11); expect(b.state).toBe('air');
    fly(s, 1); expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
    const s2 = arena(); const q = put(s2, 0, 4, 11); q.glove = true; q.face = 0;
    const b2 = addBomb(s2, 0, C(4, 11)); startLift(s2, q, []); throwHeld(s2, q, []);
    fly(s2, 11);
    expect([b2.state, b2.cell]).toEqual(['idle', C(4, 6)]);
  });
  it('mira: o 1º jogador a 2, 3 ou 4 casas; senão 5', () => {
    const s = arena({ players: 3 });
    put(s, 0, 4, 1); put(s, 1, 7, 1); put(s, 2, 12, 5);
    expect(aimThrow(s, C(4, 1), 2, 0)).toBe(3);
    expect(aimThrow(s, C(4, 1), 6, 0)).toBe(5);
    put(s, 1, 5, 1);
    expect(aimThrow(s, C(4, 1), 2, 0)).toBe(5);    // a 1 casa não conta
  });
  it('cair em cima de jogador quica (e o atordoa, T12)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    put(s, 1, 7, 1);
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []); throwHeld(s, p, []);
    fly(s, 12 + 8);                               // THROW[3] horizontal tem 12 passos + quique de 8
    expect([b.state, b.cell]).toEqual(['idle', C(8, 1)]);
  });
  it('dropHeld: a bomba da mão cai na casa se estiver livre', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true;
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []);
    dropHeld(s, p);
    expect([b.state, p.carry, codeAt(s, 4, 1)]).toEqual(['idle', -1, CODE.BOMB]);
  });
});

describe('itens voando ($C1:6715)', () => {
  it('script 1 = 5 casas para a direita, pousa como item', () => {
    const s = arena();
    spawnItemFlyer(s, 0x03, C(8, 5), 1);
    fly(s, 12);
    expect(codeAt(s, 13, 5)).toBe(itemCode(0x03));
    expect(s.flyers).toEqual([]);
  });
  it('casa ocupada quica; bloco queimando some', () => {
    const s = arena(); setCell(s, 13, 5, CODE.SOFT);
    spawnItemFlyer(s, 0x21, C(8, 5), 1);
    fly(s, 20);
    expect(codeAt(s, 14, 5)).toBe(itemCode(0x21));
    const s2 = arena(); setCell(s2, 13, 5, CODE.BURNING);
    spawnItemFlyer(s2, 0x03, C(8, 5), 1);
    fly(s2, 12);
    expect([s2.flyers.length, codeAt(s2, 13, 5)]).toEqual([0, CODE.BURNING]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/flyers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `flyers.ts`** (substitui o stub; `handFrom`, `launchBomb`, `spawnItemFlyer` ficam como estão)

```ts
import { CODE, type Bomb, type FlightId, type Flyer, type GameEvent, type Player, type RoundState } from './types';
import { BOUNCE, ITEM_FLIGHT, PUNCH, THROW, type Script } from './tables/flights';
import { CHAIN_DELAY, LIFT_TICKS, PUNCH_TICKS, THROW_TICKS } from './constants';
import { SUB, WRAP_X, WRAP_Y, cellAt, cellCenter, colAt, colOf, faceStep, inField, inGrid, linAt, linOf } from './units';
import { itemCode, newId, playerCell, setAct, standing } from './state';
import { bombAt, bombById, removeBomb } from './bombs';
import { stunPlayer } from './hit';

const MAX_BOUNCES = 32;

// handFrom, launchBomb, spawnItemFlyer: copiar do stub de T1 sem mudanças.

function scriptOf(f: Flyer): Script {
  switch (f.flight) {
    case 'punch': return PUNCH[f.dir];
    case 'bounce': return BOUNCE[f.dir];
    case 'item': return ITEM_FLIGHT[f.script].script;
    default: return THROW[Number(f.flight.slice(5)) as 2 | 3 | 4 | 5][f.dir];
  }
}
const vertical = (dir: number): boolean => dir === 0 || dir === 2;

function wrap(f: Flyer): void {
  const col = colAt(f.x), lin = linAt(f.y);
  if (col > 16) f.x -= WRAP_X; else if (col < 0) f.x += WRAP_X;
  if (lin > 12) f.y -= WRAP_Y; else if (lin < 0) f.y += WRAP_Y;
}

function bounce(s: RoundState, f: Flyer, cell: number, ev: GameEvent[]): void {
  [f.x, f.y] = cellCenter(cell); f.z = 0; f.flight = 'bounce'; f.i = 0;
  if (f.kind === 'bomb') { f.script++; ev.push({ type: 'bomb_bounce', cell }); }
}

function land(s: RoundState, f: Flyer, ev: GameEvent[]): void {
  const cell = cellAt(f.x, f.y);
  const out = cell < 0 || !inField(colOf(cell), linOf(cell));
  const v = out ? CODE.HARD : s.grid[cell];
  const drop = (): void => { s.flyers.splice(s.flyers.indexOf(f), 1); };
  if (f.kind === 'item') {
    if (!out && v === CODE.BURNING) { drop(); return; }
    if (!out && v === CODE.FLOOR) { s.grid[cell] = itemCode(f.ref); s.cellT0[cell] = s.tick; drop(); return; }
    bounce(s, f, cell, ev);
    return;
  }
  const b = bombById(s, f.ref);
  if (!b) { drop(); return; }
  if (!out && v === CODE.BURNING) { drop(); removeBomb(s, b, true); return; }
  const victims = out ? [] : s.players.filter(q => standing(q) && playerCell(q) === cell);
  if (victims.length) { for (const q of victims) stunPlayer(s, q, ev); bounce(s, f, cell, ev); }
  else if (!out && (v === CODE.FLOOR || v === CODE.FLAME)) {
    drop();
    b.state = 'idle'; b.cell = cell; [b.x, b.y] = cellCenter(cell);
    s.grid[cell] = CODE.BOMB;
    if (v === CODE.FLAME) b.chainAt = s.tick + CHAIN_DELAY;
    ev.push({ type: 'bomb_landed', cell });
    return;
  } else bounce(s, f, cell, ev);
  if (f.script > MAX_BOUNCES) { drop(); removeBomb(s, b, true); }
}

export function tickFlyers(s: RoundState, ev: GameEvent[]): void {
  if (s.phase === 'won') return;
  for (const f of [...s.flyers]) {
    if (f.born === s.tick || !s.flyers.includes(f)) continue;
    const sc = scriptOf(f);
    const [dx, dy] = sc[f.i++];
    f.x += dx * SUB;
    if (vertical(f.dir)) f.y += dy * SUB; else f.z += dy;
    wrap(f);
    if (f.i >= sc.length) land(s, f, ev);
  }
}

export function aimThrow(s: RoundState, cell: number, face: number, self: number): 2 | 3 | 4 | 5 {
  let c = cell;
  for (let k = 1; k <= 4; k++) {
    c = faceStep(c, face);
    if (!inGrid(colOf(c), linOf(c))) break;
    if (k >= 2 && s.players.some(q => q.slot !== self && standing(q) && playerCell(q) === c)) return k as 2 | 3 | 4;
  }
  return 5;
}

export function punchBomb(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!p.punch) return false;
  setAct(s, p, 'punch', PUNCH_TICKS);
  const n = faceStep(playerCell(p), p.face);
  const b = bombAt(s, n);
  if (!b) return false;
  const [x, y] = cellCenter(n);
  launchBomb(s, b, 'punch', (p.face >> 1) as 0 | 1 | 2 | 3, { x, y, z: 0 });
  ev.push({ type: 'punch', slot: p.slot });
  return true;
}

export function startLift(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  if (!p.glove || p.carry >= 0) return false;
  const b = bombAt(s, playerCell(p));
  if (!b) return false;
  s.grid[b.cell] = CODE.FLOOR;
  b.state = 'held'; p.carry = b.id; p.throwQueued = false;
  setAct(s, p, 'lift', LIFT_TICKS);
  return true;
}

export function throwHeld(s: RoundState, p: Player, ev: GameEvent[]): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const cell = playerCell(p);
  const dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  const n = aimThrow(s, cell, p.face, p.slot);
  const [x, y] = cellCenter(cell);
  launchBomb(s, b, `throw${n}` as FlightId, dir, handFrom(x, y, dir));
  setAct(s, p, 'throw', THROW_TICKS);
  ev.push({ type: 'throw', slot: p.slot });
}

export function dropHeld(s: RoundState, p: Player): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const c = playerCell(p);
  if (c >= 0 && s.grid[c] === CODE.FLOOR && !bombAt(s, c)) {
    b.state = 'idle'; b.cell = c; [b.x, b.y] = cellCenter(c); s.grid[c] = CODE.BOMB;
  } else removeBomb(s, b, true);
}
```

(`newId` e `ITEM_FLIGHT` continuam usados por `launchBomb`/`spawnItemFlyer`.)

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/flyers.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/flyers.ts web/tests/core/flyers.test.ts
git commit -m "$(cat <<'MSG'
feat(core): voadores fiéis — soco em 17 ticks, luva com mira 2–5, quique, volta pela borda e itens voando

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 9: Máquina de ação e botões (A/B/X/Y, golpe P, empurrão)

**Possui:** `web/src/core/actions.ts`, `web/tests/core/actions.test.ts`.

**Interfaces:**
- Consumes: `movement.movePlayer`, `kick.tryKick/stopKick`, `bombs.placeBomb/detonateRemote`, `flyers.punchBomb/startLift/throwHeld`, `hit.isImmune`, `MOUNTS.current.onY`, `STAGES[n].outOfBounds`, `state`, `units`, `constants` (P_*, DETONATE_TICKS).
- Produces: `tickAct(s, p, ev): boolean` (true = travado neste tick), `playerActions(s, p, btn, pressed, released, ev)`, `startPPunch(s, p, ev)`, `applyPush(s, p, ev): boolean`.

O avanço do P e o empurrão da vítima usam o mesmo movimento forçado (`p.push`, `applyPush`): para alinhado antes de casa sólida (bit `$8000`); o avanço nem começa se a casa da frente for sólida.

Ordem dentro de `playerActions` (decisão 20): soltar A com bomba na mão (arremessa; durante o `lift` só marca `throwQueued`) → `tickAct` (se travado, acaba) → `movePlayer` → `tryKick` → A (luva: levantar se há bomba na casa; senão colocar) ou diarreia (`$23`: coloca sozinho) → B (detona remota + pose `detonate` 3) → X (`stopKick`) → Y (`MOUNTS.current.onY` tem precedência; senão P; senão soco).

- [ ] **Step 1: Escrever os testes** `web/tests/core/actions.test.ts`

```ts
import { arena, put, setCell, C } from './kit';
import { playerActions, tickAct, startPPunch } from '../../src/core/actions';
import { BTN, CODE, type GameEvent, type Player, type RoundState } from '../../src/core/types';
import { centerX } from '../../src/core/units';
import { setAct } from '../../src/core/state';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';
import { STAGES } from '../../src/core/stages';

function ticks(s: RoundState, ps: Player[], n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; for (const p of ps) playerActions(s, p, 0, 0, 0, ev); }
  return ev;
}

describe('golpe P (t45, t46)', () => {
  it('avança 16 px em 4 ticks e empurra quem está na casa da frente 48 px em 12 ticks', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 5, 1);
    p.pItem = true; p.face = 2;
    const ev: GameEvent[] = [];
    playerActions(s, p, BTN.Y, BTN.Y, 0, ev);
    expect([p.act, p.actLeft]).toEqual(['pPunch', 35]);
    expect(ev).toContainEqual({ type: 'p_punch', slot: 0 });
    expect([q.act, q.push.left]).toEqual(['pushed', 12]);
    ticks(s, [p, q], 4);
    expect(p.x).toBe(centerX(5));
    ticks(s, [p, q], 8);
    expect(q.x).toBe(centerX(8));
    ticks(s, [p, q], 30);
    expect([p.act, q.act]).toEqual(['idle', 'idle']);
  });
  it('a vítima para alinhada antes de soft', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 5, 1);
    setCell(s, 7, 1, CODE.SOFT);
    p.face = 2; startPPunch(s, p, []);
    ticks(s, [p, q], 12);
    expect(q.x).toBe(centerX(6));
  });
  it('contra parede dura o avanço não sai do lugar', () => {
    const s = arena(); const p = put(s, 0, 14, 1); p.face = 2;
    startPPunch(s, p, []);
    ticks(s, [p], 4);
    expect(p.x).toBe(centerX(14));
  });
  it('cada tick de movimento forçado (4 do avanço + 12 da vítima) consulta outOfBounds da arena', () => {
    let calls = 0;
    STAGES[1] = { outOfBounds: () => { calls++; } };
    try {
      const s = arena(); const p = put(s, 0, 4, 3); const q = put(s, 1, 5, 3); p.face = 2;
      startPPunch(s, p, []);
      ticks(s, [p, q], 12);
    } finally { STAGES[1] = {}; }
    expect(calls).toBe(16);
  });
});

describe('máquina de ação', () => {
  it('ação travada dura exatamente actLeft ticks e volta para idle', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    setAct(s, p, 'throw', 20);
    const locked: boolean[] = [];
    for (let i = 0; i < 21; i++) { s.tick++; locked.push(tickAct(s, p, [])); }
    expect(locked.filter(Boolean).length).toBe(20);
    expect(locked[20]).toBe(false);
    expect(p.act).toBe('idle');
  });
  it('travado não obedece a Y', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.pItem = true;
    setAct(s, p, 'stunned', 10);
    playerActions(s, p, BTN.Y, BTN.Y, 0, []);
    expect(p.act).toBe('stunned');
  });
  it('soltar A durante o levantamento marca o arremesso para o fim dele', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    p.carry = 5; setAct(s, p, 'lift', 4);
    playerActions(s, p, 0, 0, BTN.A, []);
    expect(p.throwQueued).toBe(true);
  });
  it('B: pose de detonar por 3 ticks, mesmo sem remota', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    playerActions(s, p, BTN.B, BTN.B, 0, []);
    expect([p.act, p.actLeft]).toEqual(['detonate', 3]);
  });
  it('Y: a montaria tem precedência sobre o P', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.pItem = true;
    MOUNTS.current = { ...NO_MOUNT, onY: () => true };
    try { playerActions(s, p, BTN.Y, BTN.Y, 0, []); } finally { MOUNTS.current = NO_MOUNT; }
    expect(p.act).toBe('idle');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `actions.ts`**

```ts
import { BTN, CODE, DISEASE, type GameEvent, type Player, type PlayerAct, type RoundState } from './types';
import { DETONATE_TICKS, P_ADVANCE_TICKS, P_PUSH_TICKS, P_SPEED, P_TICKS } from './constants';
import { cellAt, cellCenter, faceDcol, faceDlin, faceStep } from './units';
import { playerCell, setAct, standing } from './state';
import { movePlayer } from './movement';
import { stopKick, tryKick } from './kick';
import { detonateRemote, placeBomb } from './bombs';
import { punchBomb, startLift, throwHeld } from './flyers';
import { isImmune } from './hit';
import { MOUNTS } from './mounts';
import { STAGES } from './stages';

const FREE: ReadonlySet<PlayerAct> = new Set(['idle', 'walk', 'carryIdle', 'carryWalk', 'victory', 'dying', 'bad']);
/** Bloqueia o avanço/empurrão: parede, pilar, soft, bomba, queimando, pressão (bit $8000). */
const solid = (v: number): boolean => (v & 0x8000) !== 0;

/** Movimento forçado de um tick (vítima do P). Para alinhada antes de casa sólida. */
export function applyPush(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const pu = p.push;
  if (pu.left <= 0) return false;
  const c0 = playerCell(p), c1 = cellAt(p.x + pu.vx, p.y + pu.vy);
  if (c1 !== c0 && (c1 < 0 || solid(s.grid[c1]))) { pu.left = 0; [p.x, p.y] = cellCenter(c0); return false; }
  p.x += pu.vx; p.y += pu.vy; pu.left--;
  STAGES[s.stage]?.outOfBounds?.(s, p, ev);
  return true;
}

export function tickAct(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (p.push.left > 0) applyPush(s, p, ev);
  if (p.actLeft <= 0) return false;
  if (--p.actLeft === 0) {
    if (p.act === 'lift') { if (p.throwQueued) throwHeld(s, p, ev); else setAct(s, p, 'carryIdle'); }
    else if (!FREE.has(p.act)) setAct(s, p, p.carry >= 0 ? 'carryIdle' : 'idle');
  }
  return true;
}

export function startPPunch(s: RoundState, p: Player, ev: GameEvent[]): void {
  const front = faceStep(playerCell(p), p.face);
  const vx = faceDcol(p.face) * P_SPEED, vy = faceDlin(p.face) * P_SPEED;
  if (p.punch) punchBomb(s, p, ev);
  for (const q of s.players) {
    if (q === p || !standing(q) || isImmune(s, q) || playerCell(q) !== front) continue;
    q.push = { vx, vy, left: P_PUSH_TICKS };
    setAct(s, q, 'pushed', P_PUSH_TICKS);
  }
  // avanço de 16 px (4 px/tick × 4) como movimento forçado; contra casa sólida à frente não sai do lugar
  if (!solid(s.grid[front] ?? CODE.HARD)) p.push = { vx, vy, left: P_ADVANCE_TICKS };
  setAct(s, p, 'pPunch', P_TICKS);
  ev.push({ type: 'p_punch', slot: p.slot });
}

export function playerActions(s: RoundState, p: Player, btn: number, pressed: number, released: number, ev: GameEvent[]): void {
  if (released & BTN.A && p.carry >= 0) {
    if (p.act === 'lift' && p.actLeft > 0) p.throwQueued = true;
    else { throwHeld(s, p, ev); return; }
  }
  if (tickAct(s, p, ev)) return;
  movePlayer(s, p, btn, ev);
  tryKick(s, p, ev);
  if (pressed & BTN.A) { if (p.carry < 0 && !(p.glove && startLift(s, p, ev))) placeBomb(s, p, ev); }
  else if (p.disease === DISEASE.DIARRHEA && p.carry < 0) placeBomb(s, p, ev);
  if (pressed & BTN.B) { detonateRemote(s, p, ev); setAct(s, p, 'detonate', DETONATE_TICKS); }
  if (pressed & BTN.X) stopKick(s, p);
  if (pressed & BTN.Y && !MOUNTS.current.onY(s, p, ev)) {
    if (p.pItem) startPPunch(s, p, ev);
    else if (p.punch) punchBomb(s, p, ev);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/actions.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/actions.ts web/tests/core/actions.test.ts
git commit -m "$(cat <<'MSG'
feat(core): máquina de ação e botões A/B/X/Y, golpe P com avanço de 16 px e empurrão de 48 px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: Itens, drops da morte e perdas

**Possui:** `web/src/core/items.ts`, `web/tests/core/items.test.ts`.

**Interfaces:**
- Consumes: `tables/{misc,cells}`, `rng.rnd`, `state`, `flyers.spawnItemFlyer` (real desde T1), `disease.cureAndThrow/rollSkull` (stubs), `MOUNTS.current.stepOnEgg/onStunLoss`.
- Produces: `applyItem`, `pickup`, `dropCategory`, `placeDropped`, `loseItems`, `leakOne`, e `STUN_LOSS: readonly ((s, p, ev) => number | null)[]` (13 perdas na ordem de `$C2:519D`; devolve o item a arremessar, `0` = perdeu sem arremessar, `null` = não tinha).

Regras: tabela §3.8 (máximos pela `MAX_CAPS`: só sobe se `valor + 1 < limite`); `$0B` zera o chute e `$0E` zera o atravessa-bomba; `$0F` = `costume = rnd(8)`; `$0C` e `$11` sem efeito no Battle; `$21..$2C` põem a doença. Coleta: item na casa do jogador → piso; doente → `cureAndThrow` antes do efeito; ovo → `MOUNTS.current.stepOnEgg`. Drops da morte e perdas: decisões 17 e 23.

- [ ] **Step 1: Escrever os testes** `web/tests/core/items.test.ts`

```ts
import { arena, put, setCell, codeAt, C } from './kit';
import { applyItem, pickup, dropCategory, placeDropped, loseItems, leakOne } from '../../src/core/items';
import { CODE, ITEM, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { makeRng, rnd } from '../../src/core/rng';
import { FREE_CELLS } from '../../src/core/tables/cells';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

const onGrid = (s: ReturnType<typeof arena>, id: number) => s.grid.filter(v => v === itemCode(id)).length;

describe('efeitos (§3.8)', () => {
  it('máximos: bombas 8, fogo 7, patins 5', () => {
    const s = arena(); const p = s.players[0];
    for (let i = 0; i < 12; i++) { applyItem(s, p, ITEM.BOMB, []); applyItem(s, p, ITEM.FIRE, []); applyItem(s, p, ITEM.SPEED, []); }
    expect([p.bombsCap, p.bombsFree, p.fire, p.speedLv]).toEqual([8, 8, 7, 5]);
  });
  it('habilidades, exclusões e efeitos especiais', () => {
    const s = arena(); const p = s.players[0];
    applyItem(s, p, ITEM.KICK, []); applyItem(s, p, ITEM.PASS_BOMB, []);
    expect([p.kick, p.passBomb]).toEqual([false, true]);
    applyItem(s, p, ITEM.KICK, []);
    expect([p.kick, p.passBomb]).toEqual([true, false]);
    applyItem(s, p, ITEM.PIERCE, []); expect(p.bombType).toBe(2);
    applyItem(s, p, ITEM.REMOTE, []); expect(p.bombType).toBe(1);
    applyItem(s, p, ITEM.VEST, []); expect(p.inv).toBe(511);
    for (const [id, key] of [[ITEM.FULL_FIRE, 'fullFire'], [ITEM.GLOVE, 'glove'], [ITEM.HEART, 'heart'], [ITEM.PASS_SOFT, 'passSoft'], [ITEM.PUNCH, 'punch'], [ITEM.P, 'pItem']] as const) {
      applyItem(s, p, id, []); expect(p[key]).toBe(true);
    }
    applyItem(s, p, 0x22, []); expect(p.disease).toBe(0x22);
  });
  it('traje: costume = rnd(8)', () => {
    const s = arena(); const p = s.players[0];
    const r = makeRng(s.rng.seed); const want = rnd(r, 8);
    applyItem(s, p, ITEM.COSTUME, []);
    expect(p.costume).toBe(want);
  });
});

describe('coleta', () => {
  it('pega o item da casa, limpa a grade e emite item_picked', () => {
    const s = arena(); const p = put(s, 0, 4, 1); setCell(s, 4, 1, itemCode(ITEM.FIRE));
    const ev: GameEvent[] = [];
    pickup(s, p, ev);
    expect([p.fire, codeAt(s, 4, 1)]).toEqual([1, CODE.FLOOR]);
    expect(ev).toEqual([{ type: 'item_picked', slot: 0, item: ITEM.FIRE }]);
  });
  it('ovo vai para a montaria (grade fica como a montaria deixar)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); setCell(s, 4, 1, 0x097c);
    const got: number[] = [];
    MOUNTS.current = { ...NO_MOUNT, stepOnEgg: (_s, _p, cell) => { got.push(cell); } };
    try { pickup(s, p, []); } finally { MOUNTS.current = NO_MOUNT; }
    expect(got).toEqual([C(4, 1)]);
    expect(codeAt(s, 4, 1)).toBe(0x097c);
  });
});

describe('drops da morte ($C2:1258)', () => {
  it('cada categoria sai inteira; fogo total, coração e doença não saem', () => {
    const s = arena(); const p = s.players[0];
    Object.assign(p, { bombsCap: 4, fire: 3, speedLv: 3, glove: true, bombType: 1, passSoft: true, punch: true, kick: true, passBomb: false, pItem: true, fullFire: true, heart: true });
    for (let k = 0; k < 10; k++) dropCategory(s, p, k, []);
    expect([onGrid(s, ITEM.BOMB), onGrid(s, ITEM.GLOVE), onGrid(s, ITEM.REMOTE), onGrid(s, ITEM.PASS_SOFT), onGrid(s, ITEM.FIRE),
      onGrid(s, ITEM.PUNCH), onGrid(s, ITEM.KICK), onGrid(s, ITEM.SPEED), onGrid(s, ITEM.P), onGrid(s, ITEM.FULL_FIRE)])
      .toEqual([3, 1, 1, 1, 3, 1, 1, 2, 1, 0]);
    expect([p.bombsCap, p.fire, p.speedLv, p.glove, p.fullFire, p.heart]).toEqual([1, 0, 1, false, true, true]);
  });
  it('casa: FREE_CELLS[rnd(113)] se livre', () => {
    const s = arena({ players: 0 });
    const r = makeRng(s.rng.seed); const i = rnd(r, 113);
    expect(placeDropped(s, ITEM.BOMB)).toBe(FREE_CELLS[i]);
    expect(s.grid[FREE_CELLS[i]]).toBe(itemCode(ITEM.BOMB));
  });
  it('ocupada: avança rnd(8) na lista (até 15 vezes)', () => {
    const s = arena({ players: 0 });
    const r = makeRng(s.rng.seed); const i = rnd(r, 113);
    let j = i;
    do { j = (j + rnd(r, 8)) % 113; } while (j === i);
    s.grid[FREE_CELLS[i]] = CODE.SOFT;
    const got = placeDropped(s, ITEM.FIRE);
    expect(got).toBe(FREE_CELLS[j]);
    expect(s.grid[got]).toBe(itemCode(ITEM.FIRE));
  });
  it('jogador de pé ocupa a casa; sem casa livre o item se perde', () => {
    const s = arena();
    for (const c of FREE_CELLS) s.grid[c] = CODE.SOFT;
    expect(placeDropped(s, ITEM.FIRE)).toBe(-1);
  });
});

describe('perdas por atordoamento ($C2:51C4)', () => {
  it('doença é a 1ª perda: sai como caveira voando', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x22; p.fire = 3;
    loseItems(s, p, 1, []);
    expect([p.disease, p.fire]).toEqual([0, 3]);
    expect(s.flyers.map(f => [f.kind, f.ref >= 0x21 && f.ref <= 0x2b])).toEqual([['item', true]]);
  });
  it('traje é a 2ª prioridade', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.costume = 3; p.fire = 3;
    loseItems(s, p, 1, []);
    expect([p.costume, p.fire]).toEqual([-1, 3]);
    expect(s.flyers[0].ref).toBe(ITEM.COSTUME);
  });
  it('só fogo: perde 1 por vez e cada um voa', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.fire = 3;
    loseItems(s, p, 2, []);
    expect(p.fire).toBe(1);
    expect(s.flyers.map(f => f.ref)).toEqual([ITEM.FIRE, ITEM.FIRE]);
  });
  it('nada a perder: termina sem voadores', () => {
    const s = arena(); const p = put(s, 0, 8, 5);
    loseItems(s, p, 4, []);
    expect(s.flyers).toEqual([]);
    expect([p.speedLv, p.bombsCap]).toEqual([1, 1]);
  });
  it('$2B perde 1 item e nunca a própria doença', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x2b; p.kick = true;
    leakOne(s, p, []);
    expect([p.disease, p.kick]).toEqual([0x2b, false]);
    expect(s.flyers[0].ref).toBe(ITEM.KICK);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/items.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `items.ts`**

```ts
import { CODE, ITEM, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { VEST_INV } from './constants';
import { MAX_CAPS } from './tables/misc';
import { FREE_CELLS } from './tables/cells';
import { isEggCode, isItemCode, itemCode, itemOfCode, playerCell, standing } from './state';
import { spawnItemFlyer } from './flyers';
import { cureAndThrow, rollSkull } from './disease';
import { MOUNTS } from './mounts';

export function applyItem(s: RoundState, p: Player, id: number, _ev: GameEvent[]): void {
  switch (id) {
    case ITEM.BOMB: if (p.bombsCap + 1 < MAX_CAPS.bombs) { p.bombsCap++; p.bombsFree++; } break;
    case ITEM.PIERCE: p.bombType = 2; break;
    case ITEM.FIRE: if (p.fire + 1 < MAX_CAPS.fire) p.fire++; break;
    case ITEM.FULL_FIRE: p.fullFire = true; break;
    case ITEM.SPEED: if (p.speedLv + 1 < MAX_CAPS.speed) p.speedLv++; break;
    case ITEM.REMOTE: p.bombType = 1; break;
    case ITEM.GLOVE: p.glove = true; break;
    case ITEM.VEST: p.inv = VEST_INV; break;
    case ITEM.HEART: p.heart = true; break;
    case ITEM.PASS_SOFT: p.passSoft = true; break;
    case ITEM.PASS_BOMB: p.passBomb = true; p.kick = false; break;
    case ITEM.PUNCH: p.punch = true; break;
    case ITEM.KICK: p.kick = true; p.passBomb = false; break;
    case ITEM.COSTUME: p.costume = rnd(s.rng, 8); break;
    case ITEM.P: p.pItem = true; break;
    default: if (id >= 0x21 && id <= 0x2c) { p.disease = id; p.diseaseT = 0; } break;   // $0C, $11: sem efeito no Battle
  }
}

export function pickup(s: RoundState, p: Player, ev: GameEvent[]): void {
  const c = playerCell(p);
  if (c < 0 || !isItemCode(s.grid[c])) return;
  if (isEggCode(s.grid[c])) { MOUNTS.current.stepOnEgg(s, p, c, ev); return; }
  const id = itemOfCode(s.grid[c]);
  s.grid[c] = CODE.FLOOR;
  if (p.disease) cureAndThrow(s, p, ev);
  applyItem(s, p, id, ev);
  ev.push({ type: 'item_picked', slot: p.slot, item: id });
}

/** Casa livre para um drop da morte ($C2:3922): rnd(113) na lista, avança rnd(8) até 15 vezes, depois a 1ª livre. */
export function placeDropped(s: RoundState, id: number): number {
  const free = (c: number): boolean => s.grid[c] === CODE.FLOOR && !s.players.some(q => standing(q) && playerCell(q) === c);
  let i = rnd(s.rng, 113);
  let cell = free(FREE_CELLS[i]) ? FREE_CELLS[i] : -1;
  for (let k = 0; k < 15 && cell < 0; k++) { i = (i + rnd(s.rng, 8)) % 113; if (free(FREE_CELLS[i])) cell = FREE_CELLS[i]; }
  if (cell < 0) cell = FREE_CELLS.find(free) ?? -1;
  if (cell >= 0) { s.grid[cell] = itemCode(id); s.cellT0[cell] = s.tick; }
  return cell;
}

/** Categoria k (0..9) dos drops da morte, inteira, na ordem de $C2:38F4. */
export function dropCategory(s: RoundState, p: Player, k: number, _ev: GameEvent[]): void {
  const units: number[] = [];
  const rep = (id: number, n: number): void => { for (let i = 0; i < n; i++) units.push(id); };
  switch (k) {
    case 0: rep(ITEM.BOMB, p.bombsCap - 1); p.bombsCap = 1; p.bombsFree = Math.min(p.bombsFree, 1); break;
    case 1: if (p.glove) units.push(ITEM.GLOVE); p.glove = false; break;
    case 2: if (p.bombType) units.push(p.bombType === 1 ? ITEM.REMOTE : ITEM.PIERCE); p.bombType = 0; break;
    case 3: if (p.passSoft) units.push(ITEM.PASS_SOFT); p.passSoft = false; break;
    case 4: rep(ITEM.FIRE, p.fire); p.fire = 0; break;
    case 5: if (p.punch) units.push(ITEM.PUNCH); p.punch = false; break;
    case 6: if (p.kick) units.push(ITEM.KICK); p.kick = false; break;
    case 7: if (p.passBomb) units.push(ITEM.PASS_BOMB); p.passBomb = false; break;
    case 8: rep(ITEM.SPEED, p.speedLv - 1); p.speedLv = 1; break;
    case 9: if (p.pItem) units.push(ITEM.P); p.pItem = false; break;
  }
  for (const id of units) placeDropped(s, id);
}

type Loss = (s: RoundState, p: Player, ev: GameEvent[]) => number | null;
const flag = (key: 'punch' | 'glove' | 'kick' | 'passBomb' | 'pItem' | 'fullFire', id: number): Loss =>
  (_s, p) => { if (!p[key]) return null; p[key] = false; return id; };

/** As 13 perdas de $C2:519D, na ordem da ROM. */
export const STUN_LOSS: readonly Loss[] = [
  (s, p) => { if (!p.disease) return null; p.disease = 0; return rollSkull(s); },
  (s, p, ev) => {
    if (MOUNTS.current.onStunLoss?.(s, p, ev)) return 0;
    if (p.costume < 0) return null; p.costume = -1; return ITEM.COSTUME;
  },
  (_s, p) => { if (p.speedLv <= 1) return null; p.speedLv--; return ITEM.SPEED; },
  (_s, p) => { if (p.bombsCap <= 1) return null; p.bombsCap--; if (p.bombsFree > 0) p.bombsFree--; return ITEM.BOMB; },
  (_s, p) => { if (p.fire <= 0) return null; p.fire--; return ITEM.FIRE; },
  (_s, p) => { if (!p.bombType) return null; const id = p.bombType === 1 ? ITEM.REMOTE : ITEM.PIERCE; p.bombType = 0; return id; },
  flag('punch', ITEM.PUNCH),
  flag('glove', ITEM.GLOVE),
  flag('kick', ITEM.KICK),
  (s, p) => { if (((s.grid[playerCell(p)] ?? 0) & 0xc000) !== 0 || !p.passSoft) return null; p.passSoft = false; return ITEM.PASS_SOFT; },
  flag('passBomb', ITEM.PASS_BOMB),
  flag('pItem', ITEM.P),
  flag('fullFire', ITEM.FULL_FIRE),
];

function tryLoss(s: RoundState, p: Player, idx: number, ev: GameEvent[]): boolean {
  const id = STUN_LOSS[idx](s, p, ev);
  if (id === null) return false;
  if (id > 0) spawnItemFlyer(s, id, playerCell(p), rnd(s.rng, 12));
  return true;
}

/** Perde `n` itens: por perda, até 8 tentativas (doença → traje/montaria → rnd(13)); depois varre 0..12. */
export function loseItems(s: RoundState, p: Player, n: number, ev: GameEvent[]): void {
  for (let k = 0; k < n; k++) {
    let ok = false;
    for (let a = 0; a < 8 && !ok; a++) {
      const idx = p.disease ? 0 : p.costume >= 0 || p.mount !== null ? 1 : rnd(s.rng, 13);
      ok = tryLoss(s, p, idx, ev);
    }
    for (let idx = 0; idx < 13 && !ok; idx++) ok = tryLoss(s, p, idx, ev);
    if (!ok) return;
  }
}

/** Doença $2B ($C2:5270): 1 tentativa rnd(12)+1 e depois varre 1..11 (nunca a própria doença). */
export function leakOne(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (tryLoss(s, p, rnd(s.rng, 12) + 1, ev)) return;
  for (let idx = 1; idx < 12; idx++) if (tryLoss(s, p, idx, ev)) return;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/items.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/items.ts web/tests/core/items.test.ts
git commit -m "$(cat <<'MSG'
feat(core): itens da ROM, drops da morte em casa sorteada e perdas por atordoamento/$2B

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 11: Doenças (11 caveiras) e contágio

**Possui:** `web/src/core/disease.ts`, `web/tests/core/disease.test.ts`.

**Interfaces:**
- Consumes: `rng.rnd`, `tables/misc.INVISIBLE_PATTERN`, `flyers.spawnItemFlyer` (real), `items.leakOne` (stub), `STAGES[n].speedLevel`, `state`, `units`.
- Produces: `applyDiseaseInput`, `speedLevel`, `tickDisease`, `inContact`, `contagion`, `rollSkull`, `cureAndThrow`, `invisibleVisible`.

Regras (§3.9, decisões 19 e 22): `$21` nível 6, `$22` nível 7, efeito `kind 2` nível 7 (depois do gancho da arena); `$26` sem direção repete a última; `$2A` e efeito `$0A` invertem ↑↓ e ←→; `$2B` perde 1 item quando `tick & 31 === 0`; efeitos caem 1 a cada 4 ticks (`tick & 3 === 0`); caveira nova = `rnd(12)+1 | $20`, sorteando de novo `$2C` e `$24` depois da 1ª vez na rodada; contágio só em `play`. (`$23`, `$24`, `$25`, `$27`, `$28` são aplicadas por T6/T9.)

- [ ] **Step 1: Escrever os testes** `web/tests/core/disease.test.ts`

```ts
import { arena, put } from './kit';
import { applyDiseaseInput, speedLevel, tickDisease, contagion, rollSkull, cureAndThrow, invisibleVisible, inContact } from '../../src/core/disease';
import { BTN, type GameEvent } from '../../src/core/types';
import { centerX } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';

describe('entrada', () => {
  it('$2A e efeito $0A invertem ↑↓ e ←→', () => {
    const s = arena(); const p = s.players[0];
    p.disease = 0x2a;
    expect(applyDiseaseInput(s, p, BTN.UP | BTN.LEFT | BTN.A)).toBe(BTN.DOWN | BTN.RIGHT | BTN.A);
    p.disease = 0; p.effect = { kind: 0x0a, left: 64 };
    expect(applyDiseaseInput(s, p, BTN.DOWN)).toBe(BTN.UP);
  });
  it('$26: sem direção, repete a última', () => {
    const s = arena(); const p = s.players[0]; p.disease = 0x26;
    applyDiseaseInput(s, p, BTN.RIGHT);
    expect(applyDiseaseInput(s, p, BTN.A)).toBe(BTN.RIGHT | BTN.A);
    p.disease = 0;
    expect(applyDiseaseInput(s, p, 0)).toBe(0);
  });
});

describe('velocidade', () => {
  it('$21 → 6, $22 → 7, efeito lento → 7; senão o nível dos patins; gancho da arena', () => {
    const s = arena(); const p = s.players[0]; p.speedLv = 3;
    expect(speedLevel(s, p)).toBe(3);
    p.disease = 0x21; expect(speedLevel(s, p)).toBe(6);
    p.disease = 0x22; expect(speedLevel(s, p)).toBe(7);
    p.disease = 0; p.effect = { kind: 2, left: 64 }; expect(speedLevel(s, p)).toBe(7);
    p.effect = { kind: 0, left: 0 };
    STAGES[1] = { speedLevel: () => 6 };
    try { expect(speedLevel(s, p)).toBe(6); } finally { STAGES[1] = {}; }
  });
  it('efeito $0A com left 64 dura 256 ticks', () => {
    const s = arena(); const p = s.players[0]; p.effect = { kind: 0x0a, left: 64 };
    for (let i = 0; i < 255; i++) { s.tick++; tickDisease(s, p, []); }
    expect(p.effect.kind).toBe(0x0a);
    s.tick++; tickDisease(s, p, []);
    expect(p.effect).toEqual({ kind: 0, left: 0 });
  });
});

describe('caveira', () => {
  it('sorteio: nunca $2C; $24 só 1 vez por rodada', () => {
    const s = arena();
    const got = Array.from({ length: 300 }, () => rollSkull(s));
    expect(got.every(id => id >= 0x21 && id <= 0x2b)).toBe(true);
    expect(got.filter(id => id === 0x24).length).toBeLessThanOrEqual(1);
    expect(new Set(got).size).toBeGreaterThanOrEqual(9);
  });
  it('cura ao pegar item: a doença sai voando como caveira nova', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x22;
    cureAndThrow(s, p, []);
    expect(p.disease).toBe(0);
    expect(s.flyers.length).toBe(1);
    expect(s.flyers[0].kind).toBe('item');
    expect(s.flyers[0].ref).toBeGreaterThanOrEqual(0x21);
  });
  it('invisível: padrão $C2:4F68 (0x55 no começo, some de vez depois de 128 ticks)', () => {
    const p = arena().players[0]; p.disease = 0x29;
    const vis = (t: number) => { p.diseaseT = t; return invisibleVisible(p); };
    expect([0, 1, 2, 3].map(vis)).toEqual([true, false, true, false]);
    expect(vis(24)).toBe(true);                       // 0x33, bit 0
    expect(vis(26)).toBe(false);                      // 0x33, bit 2
    expect(vis(128)).toBe(false);
    p.disease = 0;
    expect(invisibleVisible(p)).toBe(true);
  });
});

describe('contágio (t65)', () => {
  it('|dx| ≤ 8 e |dy| ≤ 8 px: passa e cura quem passou; não volta enquanto o contato continua', () => {
    const s = arena(); const a = put(s, 0, 4, 1); const b = put(s, 1, 4, 1, 8, 0);
    a.disease = 0x21;
    const ev: GameEvent[] = [];
    contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
    expect(ev).toEqual([{ type: 'disease_passed', from: 0, to: 1 }]);
    contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
    b.x = centerX(8); contagion(s, ev);              // separou: trava sai
    b.x = a.x; contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0x21, 0]);
  });
  it('9 px não é contato; fora de `play` não passa', () => {
    const s = arena(); const a = put(s, 0, 4, 1); const b = put(s, 1, 4, 1, 9, 0);
    expect(inContact(a, b)).toBe(false);
    b.x = a.x; a.disease = 0x21; s.phase = 'won';
    contagion(s, []);
    expect(b.disease).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/disease.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `disease.ts`**

```ts
import { BTN, DIR_BTNS, DISEASE, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { CONTACT_PX, LEAK_EVERY } from './constants';
import { INVISIBLE_PATTERN } from './tables/misc';
import { px } from './units';
import { playerCell, standing } from './state';
import { spawnItemFlyer } from './flyers';
import { leakOne } from './items';
import { STAGES } from './stages';

function swapDirs(b: number): number {
  let out = b & ~DIR_BTNS;
  if (b & BTN.UP) out |= BTN.DOWN;
  if (b & BTN.DOWN) out |= BTN.UP;
  if (b & BTN.LEFT) out |= BTN.RIGHT;
  if (b & BTN.RIGHT) out |= BTN.LEFT;
  return out;
}

export function applyDiseaseInput(_s: RoundState, p: Player, btn: number): number {
  let b = btn;
  if (b & DIR_BTNS) p.lastDir = b & DIR_BTNS;
  else if (p.disease === DISEASE.NO_STOP) b |= p.lastDir;
  if (p.disease === DISEASE.REVERSE || p.effect.kind === 0x0a) b = swapDirs(b);
  return b;
}

export function speedLevel(s: RoundState, p: Player): number {
  let lv = p.disease === DISEASE.FAST ? 6 : p.disease === DISEASE.SLOW ? 7 : p.speedLv;
  const st = STAGES[s.stage];
  if (st?.speedLevel) lv = st.speedLevel(s, p, lv);
  return p.effect.kind === 2 ? 7 : lv;
}

export function tickDisease(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.effect.kind && (s.tick & 3) === 0 && --p.effect.left <= 0) p.effect = { kind: 0, left: 0 };
  if (!p.disease) return;
  p.diseaseT++;
  if (p.disease === DISEASE.LEAK && (s.tick & (LEAK_EVERY - 1)) === 0) leakOne(s, p, ev);
}

export function inContact(a: Player, b: Player): boolean {
  return Math.abs(px(a.x) - px(b.x)) <= CONTACT_PX && Math.abs(px(a.y) - px(b.y)) <= CONTACT_PX;
}

export function contagion(s: RoundState, ev: GameEvent[]): void {
  if (s.phase !== 'play') return;
  const live = s.players.filter(standing);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const bitA = 1 << a.slot, bitB = 1 << b.slot;
    if (!inContact(a, b)) { a.contactLock &= ~bitB; b.contactLock &= ~bitA; continue; }
    if (a.contactLock & bitB) continue;
    const [from, to] = a.disease && !b.disease ? [a, b] : b.disease && !a.disease ? [b, a] : [null, null];
    if (!from || !to) continue;
    to.disease = from.disease; to.diseaseT = 0; from.disease = 0;
    a.contactLock |= bitB; b.contactLock |= bitA;
    ev.push({ type: 'disease_passed', from: from.slot, to: to.slot });
  }
}

/** Caveira nova ($C2:5481): rnd(12)+1 | $20; $2C sorteia de novo; $24 só 1 vez por rodada ($1EE4). */
export function rollSkull(s: RoundState): number {
  for (;;) {
    const id = (rnd(s.rng, 12) + 1) | 0x20;
    if (id === DISEASE.SWAP) continue;
    if (id === DISEASE.CONSTIPATION) { if (s.diseaseOnce24) continue; s.diseaseOnce24 = true; }
    return id;
  }
}

export function cureAndThrow(s: RoundState, p: Player, _ev: GameEvent[]): void {
  if (!p.disease) return;
  p.disease = 0;
  const id = rollSkull(s);
  spawnItemFlyer(s, id, playerCell(p), rnd(s.rng, 12));
}

/** $C2:4E06: visível se o bit (t & 7) de PATTERN[(t >> 3) & 63] estiver ligado. */
export function invisibleVisible(p: Player): boolean {
  if (p.disease !== DISEASE.INVISIBLE) return true;
  const t = p.diseaseT;
  return ((INVISIBLE_PATTERN[(t >> 3) & 63] >> (t & 7)) & 1) === 1;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/disease.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/disease.ts web/tests/core/disease.test.ts
git commit -m "$(cat <<'MSG'
feat(core): 11 doenças sem duração, contágio que cura quem passa e caveira nova ao pegar item

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: Acerto, invencibilidade, morte e atordoamento

**Possui:** `web/src/core/hit.ts`, `web/tests/core/hit.test.ts`.

**Interfaces:**
- Consumes: `constants` (HIT_INV, STUN_TICKS, DROP_*, OUT_AT), `rng.rnd`, `items.dropCategory/loseItems` (stubs), `flyers.dropHeld`, `bad-bomber.becomeBad` (stub), `MOUNTS.current.onHit`, `state`.
- Produces: `isImmune`, `tickInv`, `checkHit`, `hitPlayer`, `tickDeath`, `stunPlayer`.

Regras (§3.10): acerto pela casa do centro; chama só com `inv ≤ 0`; absorção montaria → traje (`inv 96`) → coração (`inv 96`) → morte; `PRESSURE` mata sempre; em `won`, quem está de pé é imune. Morte: `hitT0 = tick`, doença some, bomba da mão cai (`dropHeld`); `tickDeath` com `k = tick − hitT0`: drops da categoria `(k−22)/4` em `k = 22, 26, …, 58`; em `k = 65`, `becomeBad` (regra ligada e pressão ainda não disparada) ou `out`. Atordoamento: bomba da mão cai, empurrão cancelado, `stunned` por 63, perde `((rnd(255) & 6) >> 1) + 1` itens, evento `stunned`.

- [ ] **Step 1: Escrever os testes** `web/tests/core/hit.test.ts`

```ts
import { arena, put, setCell } from './kit';
import { checkHit, hitPlayer, tickDeath, stunPlayer, tickInv, isImmune } from '../../src/core/hit';
import { CODE, type GameEvent } from '../../src/core/types';
import { makeRng, rnd } from '../../src/core/rng';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

describe('acerto', () => {
  it('hitbox da chama (t25): X 167 na col 10 morre; X 168 não', () => {
    for (const [dx, dies] of [[8, true], [9, false], [-7, true]] as const) {   // centro da col 10 = 159 px
      const s = arena(); const p = put(s, 0, 10, 1, dx, 0);
      setCell(s, 10, 1, CODE.FLAME);
      checkHit(s, p, []);
      expect(p.state === 'dying').toBe(dies);
    }
  });
  it('morte: estado, tick do acerto, doença some, evento', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x21;
    setCell(s, 4, 1, CODE.FLAME);
    const ev: GameEvent[] = [];
    checkHit(s, p, ev);
    expect([p.state, p.hitT0, s.lastHit, p.disease, p.act, p.actT0]).toEqual(['dying', 100, 100, 0, 'dying', 100]);
    expect(ev).toEqual([{ type: 'player_hit', slot: 0 }]);
  });
  it('invencível não morre na chama; tickInv desconta 1 por tick', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.inv = 2;
    setCell(s, 4, 1, CODE.FLAME);
    checkHit(s, p, []); expect(p.state).toBe('alive');
    tickInv(p); tickInv(p); expect(p.inv).toBe(0);
    checkHit(s, p, []); expect(p.state).toBe('dying');
  });
  it('ordem de absorção: montaria → traje → coração → morte', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.costume = 2; p.heart = true;
    let mountHits = 0;
    MOUNTS.current = { ...NO_MOUNT, onHit: () => { mountHits++; return mountHits === 1; } };
    try {
      hitPlayer(s, p, 'flame', []); expect([mountHits, p.costume, p.heart, p.inv]).toEqual([1, 2, true, 0]);
      hitPlayer(s, p, 'flame', []); expect([p.costume, p.heart, p.inv, p.state]).toEqual([-1, true, 96, 'alive']);
      hitPlayer(s, p, 'flame', []); expect([p.heart, p.inv, p.state]).toEqual([false, 96, 'alive']);
      hitPlayer(s, p, 'flame', []); expect(p.state).toBe('dying');
    } finally { MOUNTS.current = NO_MOUNT; }
  });
  it('bloco de pressão mata mesmo com coração e invencibilidade', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.heart = true; p.inv = 300;
    setCell(s, 4, 1, CODE.PRESSURE);
    checkHit(s, p, []);
    expect(p.state).toBe('dying');
  });
  it('em `won` quem está de pé é imune', () => {
    const s = arena(); const p = put(s, 0, 4, 1); s.phase = 'won';
    setCell(s, 4, 1, CODE.PRESSURE);
    expect(isImmune(s, p)).toBe(true);
    checkHit(s, p, []);
    expect(p.state).toBe('alive');
  });
});

describe('linha do tempo da morte (t29)', () => {
  it('1–21 animação, 22–64 pós-morte, 65 fora de jogo', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    hitPlayer(s, p, 'flame', []);                   // tick 100
    for (let k = 1; k <= 64; k++) { s.tick++; tickDeath(s, p, []); expect(p.state).toBe('dying'); }
    s.tick++; tickDeath(s, p, []);
    expect(p.state).toBe('out');
  });
});

describe('atordoamento (t44)', () => {
  it('63 ticks de stunned, 1 chamada rnd(255) para o número de perdas, evento', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    const r = makeRng(s.rng.seed); rnd(r, 0xff);
    const ev: GameEvent[] = [];
    stunPlayer(s, p, ev);
    expect([p.act, p.actLeft]).toEqual(['stunned', 63]);
    expect(s.rng.seed).toBe(r.seed);
    expect(ev).toEqual([{ type: 'stunned', slot: 0 }]);
  });
  it('em `won` não atordoa', () => {
    const s = arena(); const p = put(s, 0, 4, 1); s.phase = 'won';
    stunPlayer(s, p, []);
    expect(p.act).toBe('idle');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/hit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `hit.ts`**

```ts
import { CODE, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { DROP_EVERY, DROP_START, HIT_INV, OUT_AT, STUN_TICKS } from './constants';
import { playerCell, setAct } from './state';
import { dropCategory, loseItems } from './items';
import { dropHeld } from './flyers';
import { becomeBad } from './bad-bomber';
import { MOUNTS } from './mounts';

export const isImmune = (s: RoundState, p: Player): boolean => s.phase === 'won' && p.state === 'alive';

export function tickInv(p: Player): void { if (p.inv > 0) p.inv--; }

export function checkHit(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.state !== 'alive' || isImmune(s, p)) return;
  const c = playerCell(p);
  if (c < 0) return;
  const v = s.grid[c];
  if (v === CODE.PRESSURE) hitPlayer(s, p, 'pressure', ev);
  else if (v === CODE.FLAME && p.inv <= 0) hitPlayer(s, p, 'flame', ev);
}

export function hitPlayer(s: RoundState, p: Player, cause: 'flame' | 'pressure', ev: GameEvent[]): void {
  if (p.state !== 'alive') return;
  if (cause === 'flame') {
    if (MOUNTS.current.onHit(s, p, ev)) return;
    if (p.costume >= 0) { p.costume = -1; p.inv = HIT_INV; return; }
    if (p.heart) { p.heart = false; p.inv = HIT_INV; return; }
  }
  if (p.carry >= 0) dropHeld(s, p);
  p.state = 'dying'; p.hitT0 = s.tick; s.lastHit = s.tick;
  p.disease = 0; p.push.left = 0;
  setAct(s, p, 'dying', 0);
  ev.push({ type: 'player_hit', slot: p.slot });
}

export function tickDeath(s: RoundState, p: Player, ev: GameEvent[]): void {
  const k = s.tick - p.hitT0;
  const d = k - DROP_START;
  if (d >= 0 && d % DROP_EVERY === 0 && d / DROP_EVERY < 10) dropCategory(s, p, d / DROP_EVERY, ev);
  if (k >= OUT_AT) {
    if (s.rules.badBomber && s.pressure.trigger < 0) becomeBad(s, p);
    else p.state = 'out';
  }
}

export function stunPlayer(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.state !== 'alive' || isImmune(s, p)) return;
  if (p.carry >= 0) dropHeld(s, p);
  p.push.left = 0;
  setAct(s, p, 'stunned', STUN_TICKS);
  const n = ((rnd(s.rng, 0xff) & 6) >> 1) + 1;
  loseItems(s, p, n, ev);
  ev.push({ type: 'stunned', slot: p.slot });
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/hit.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/hit.ts web/tests/core/hit.test.ts
git commit -m "$(cat <<'MSG'
feat(core): acerto pela casa do centro, absorção montaria/traje/coração, morte em 65 e atordoamento de 63

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 13: Relógio, pressão, Morte Súbita e TIME UP

**Possui:** `web/src/core/clock.ts`, `web/src/core/pressure.ts`, `web/tests/core/clock.test.ts`, `web/tests/core/pressure.test.ts`, `web/tests/rom/pressure-facts.test.ts`.

**Interfaces:**
- Consumes: `constants`, `units`, `bombs.removeBomb` (real), `round-end.groupsStanding` (stub devolve 2), `bad-bomber.clearBadBombers` (stub), `scripts/rom-facts/core-misc.extractPressureSteps` e `core-rom.loadRom` (T2).
- Produces: `initClock`, `pressureTriggerSec`, `clockText`, `tickClock(s, ev)`; `pressureSpiral()`, `triggerPressure(s, ev)`, `tickPressure(s, ev)`.

Regras (§3.11): `sec = minutos·60 + 1`, `sub = 1`; por tick `if (--sub === 0) { sec--; sub = 60 }`; com `sec ≥ 600` não anda. Só em `play`: quando `sec` vira 61 (41 na opção 1:00) → gatilho; quando vira 0 com ≥ 2 grupos de pé → `timeUp` (`phaseT0 = tick`, evento `time_up`). Pressão a partir do gatilho T: bordas (lin 0 e 12, col 2..14) viram `PRESSURE` em T+192; passo *k* em T+205+14k até 80 (143 com Morte Súbita); casa `HARD`/`PRESSURE` gasta o passo sem bloco nem evento; senão `pressure_step`, grava `FALLING` se a casa era piso, e pousa em `t0 + 36 + 2·lin`: vira `PRESSURE`, remove bomba (volta ao dono), item e soft; esconde o item escondido. Quem estiver na casa morre no próprio processamento (T12).

- [ ] **Step 1: Escrever os testes**

`web/tests/core/clock.test.ts`:

```ts
import { initClock, clockText, pressureTriggerSec } from '../../src/core/clock';
import { emptyRound } from '../../src/core/state';
import { step } from '../../src/core/step';
import { rules, runUntil } from './kit';

describe('relógio (§3.11)', () => {
  it('início minutos·60 + 1, sub 1; ∞ = 30:01', () => {
    expect([0, 1, 2, 3, 4].map(i => initClock(i).sec)).toEqual([61, 121, 181, 301, 1801]);
    expect(initClock(2).sub).toBe(1);
    expect(clockText({ sec: 180 })).toBe('3:00');
    expect(clockText({ sec: 1801 })).toBe('30:01');
    expect([pressureTriggerSec(0), pressureTriggerSec(2)]).toEqual([41, 61]);
  });
  it('intro: 10 ticks levam 3:01/1 a 3:00/51; o 1º segundo jogado dura 51 ticks', () => {
    const s = emptyRound(1, rules());
    for (let i = 0; i < 10; i++) step(s, [0, 0, 0, 0, 0]);
    expect(s.clock).toEqual({ sec: 180, sub: 51 });
    for (let i = 10; i < 62; i++) step(s, [0, 0, 0, 0, 0]);
    expect([s.phase, s.clock.sec, s.clock.sub]).toEqual(['play', 180, 51]);
    expect(runUntil(s, st => st.clock.sec === 179)).toBe(113);
  });
  it('∞ não decrementa', () => {
    const s = emptyRound(1, rules({ timeIdx: 4 }));
    for (let i = 0; i < 500; i++) step(s, [0, 0, 0, 0, 0]);
    expect(s.clock).toEqual({ sec: 1801, sub: 1 });
  });
  it('HURRY na virada 1:02 → 1:01 (tick 7193 com 3:00); 0:42 → 0:41 com 1:00 (tick 1193)', () => {
    const s = emptyRound(1, rules());
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'hurry'))).toBe(7193);
    expect([s.clock.sec, s.pressure.trigger]).toEqual([61, 7193]);
    const s1 = emptyRound(1, rules({ timeIdx: 0 }));
    expect(runUntil(s1, (_s, ev) => ev.some(e => e.type === 'hurry'))).toBe(1193);
  });
  it('0:00 com 2 de pé → timeUp no tick 10853, com evento', () => {
    const s = emptyRound(1, rules());
    s.pressure.trigger = 1e9;                      // desliga a pressão (senão, depois da integração, ela mata os jogadores antes do 0:00)
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'time_up'))).toBe(10853);
    expect([s.phase, s.phaseT0, s.clock.sec]).toEqual(['timeUp', 10853, 0]);
  });
});
```

`web/tests/core/pressure.test.ts`:

```ts
import { arena, setCell, codeAt, C } from './kit';
import { pressureSpiral, tickPressure } from '../../src/core/pressure';
import { addBomb } from '../../src/core/bombs';
import { CODE, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';

/** Só o controlador da pressão, tick a tick (isolado dos jogadores). */
function pump(s: ReturnType<typeof arena>, n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; tickPressure(s, ev); }
  return ev;
}

function triggered(sd = false) {
  const s = arena({ rules: { suddenDeath: sd, timeIdx: 4 } });
  s.pressure.total = sd ? 143 : 80;
  s.pressure.trigger = 100;                       // gatilho no tick 100
  return s;
}

describe('espiral ($C1:724E)', () => {
  it('143 casas: anel externo de (2,1) no sentido horário, depois os internos', () => {
    const sp = pressureSpiral();
    expect(sp.length).toBe(143);
    expect(new Set(sp).size).toBe(143);
    expect(sp.slice(0, 13)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(c => C(c, 1)));
    expect([sp[13], sp[22], sp[23], sp[34], sp[35], sp[43]]).toEqual([C(14, 2), C(14, 11), C(13, 11), C(2, 11), C(2, 10), C(2, 2)]);
    expect([sp[44], sp[79], sp[80], sp[142]]).toEqual([C(3, 2), C(3, 3), C(4, 3), C(9, 6)]);
  });
});

describe('controlador da pressão (t72)', () => {
  it('bordas em T+192; 1º passo em T+205 em (2,1); pousa em 36 + 2·lin; 1 passo a cada 14 ticks', () => {
    const s = triggered();
    pump(s, 191); expect(codeAt(s, 5, 0)).toBe(CODE.HARD);
    pump(s, 1); expect([codeAt(s, 5, 0), codeAt(s, 2, 12), codeAt(s, 1, 0)]).toEqual([CODE.PRESSURE, CODE.PRESSURE, CODE.HARD]);
    const ev = pump(s, 13);                        // tick 305
    expect(ev).toEqual([{ type: 'pressure_step', cell: C(2, 1) }]);
    expect(codeAt(s, 2, 1)).toBe(CODE.FALLING);
    expect(pump(s, 14)).toEqual([{ type: 'pressure_step', cell: C(3, 1) }]);   // 319
    pump(s, 23); expect(codeAt(s, 2, 1)).toBe(CODE.FALLING);                   // 342
    pump(s, 1); expect(codeAt(s, 2, 1)).toBe(CODE.PRESSURE);                   // 343 = 305 + 38
  });
  it('Morte Súbita Off: 80 passos, 62 blocos na arena de pilares; On: 143 passos, 113 blocos', () => {
    for (const [sd, blocks, last] of [[false, 62, 100 + 205 + 14 * 79], [true, 113, 100 + 205 + 14 * 142]] as const) {
      const s = triggered(sd);
      const ev = pump(s, last + 100 - s.tick);
      const steps = ev.filter(e => e.type === 'pressure_step');
      expect(steps.length).toBe(blocks);
      expect(s.pressure.next).toBe(sd ? 143 : 80);
    }
  });
  it('casa dura gasta o passo: (3,2) é pilar, o passo 44 não tem bloco', () => {
    const s = triggered();
    s.pressure.next = 44;
    s.tick = 100 + 205 - 1;
    const ev: GameEvent[] = [];
    s.tick++; tickPressure(s, ev);
    expect([ev, s.pressure.next]).toEqual([[], 45]);
  });
  it('ao pousar: apaga a bomba sem explodir (volta ao dono), o item e cobre o soft', () => {
    const s = triggered();
    const p = s.players[0]; p.bombsFree = 0;
    const b = addBomb(s, 0, C(2, 1));
    setCell(s, 3, 1, itemCode(0x03)); setCell(s, 4, 1, CODE.SOFT);
    s.hidden = [[C(4, 1), 0x01]];
    pump(s, 205 + 28 + 38);
    expect([s.bombs.includes(b), p.bombsFree]).toEqual([false, 1]);
    expect([codeAt(s, 2, 1), codeAt(s, 3, 1), codeAt(s, 4, 1)]).toEqual([CODE.PRESSURE, CODE.PRESSURE, CODE.PRESSURE]);
    expect(s.hidden).toEqual([]);
  });
});
```

`web/tests/rom/pressure-facts.test.ts`:

```ts
import { loadRom } from '../../scripts/rom-facts/core-rom.ts';
import { extractPressureSteps } from '../../scripts/rom-facts/core-misc.ts';
import { pressureSpiral } from '../../src/core/pressure';

const path = process.env.SB4_ROM;
const rom = path ? loadRom(path) : null;

describe.skipIf(!rom)('espiral da pressão = $C1:724E', () => {
  it('mesma ordem; marcador $7000 depois de 80 passos', () => {
    const steps = extractPressureSteps(rom!);
    const cells: number[] = [];
    let off = 0x44, marker = -1;
    for (const d of steps) {
      if (d === -0x8000) break;
      if (d === 0x7000) { marker = cells.length; continue; }
      off += d;
      cells.push((off >> 6) * 17 + ((off & 0x3f) >> 1));
    }
    expect(marker).toBe(80);
    expect(cells).toEqual([...pressureSpiral()]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/clock.test.ts tests/core/pressure.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `clock.ts`** (mantém `initClock`, `pressureTriggerSec` e `clockText` do stub)

```ts
import type { GameEvent, RoundState } from './types';
import { CLOCK_FROZEN_FROM, TIME_MINUTES } from './constants';
import { triggerPressure } from './pressure';
import { groupsStanding } from './round-end';

export function initClock(timeIdx: number): { sec: number; sub: number } {
  return { sec: (TIME_MINUTES[timeIdx] ?? 3) * 60 + 1, sub: 1 };
}
export function pressureTriggerSec(timeIdx: number): number { return timeIdx === 0 ? 41 : 61; }
export function clockText(c: { sec: number }): string { return `${Math.floor(c.sec / 60)}:${String(c.sec % 60).padStart(2, '0')}`; }

export function tickClock(s: RoundState, ev: GameEvent[]): void {
  const c = s.clock;
  if (c.sec >= CLOCK_FROZEN_FROM) return;
  if (--c.sub > 0) return;
  c.sec--; c.sub = 60;
  if (s.phase !== 'play') return;
  if (c.sec === pressureTriggerSec(s.rules.timeIdx)) triggerPressure(s, ev);
  if (c.sec === 0 && groupsStanding(s) >= 2) { s.phase = 'timeUp'; s.phaseT0 = s.tick; ev.push({ type: 'time_up' }); }
}
```

- [ ] **Step 4: Implementar `pressure.ts`**

```ts
import { CODE, type GameEvent, type RoundState } from './types';
import { PRESSURE_BORDER_AT, PRESSURE_EVERY, PRESSURE_FIRST, fallTicks } from './constants';
import { cellOf, linOf } from './units';
import { removeBomb } from './bombs';
import { clearBadBombers } from './bad-bomber';

let SPIRAL: number[] | null = null;

/** Espiral horária a partir de (2,1), anel a anel (fórmula equivalente a $C1:724E). */
export function pressureSpiral(): readonly number[] {
  if (SPIRAL) return SPIRAL;
  const out: number[] = [];
  for (let k = 0; k < 6; k++) {
    const x0 = 2 + k, x1 = 14 - k, y0 = 1 + k, y1 = 11 - k;
    if (x0 > x1 || y0 > y1) break;
    for (let x = x0; x <= x1; x++) out.push(cellOf(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(cellOf(x1, y));
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(cellOf(x, y1));
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(cellOf(x0, y));
  }
  return (SPIRAL = out);
}

export function triggerPressure(s: RoundState, ev: GameEvent[]): void {
  if (s.pressure.trigger >= 0) return;
  s.pressure.trigger = s.tick;
  ev.push({ type: 'hurry' });
  clearBadBombers(s, ev);
}

function land(s: RoundState, cell: number): void {
  for (const b of s.bombs.filter(x => x.cell === cell && (x.state === 'idle' || x.state === 'kicked'))) removeBomb(s, b, true);
  s.grid[cell] = CODE.PRESSURE; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
  s.hidden = s.hidden.filter(([c]) => c !== cell);
}

export function tickPressure(s: RoundState, ev: GameEvent[]): void {
  const pr = s.pressure;
  if (pr.trigger < 0) return;
  const e = s.tick - pr.trigger;
  if (e === PRESSURE_BORDER_AT) for (let col = 2; col <= 14; col++) { s.grid[cellOf(col, 0)] = CODE.PRESSURE; s.grid[cellOf(col, 12)] = CODE.PRESSURE; }
  if (e >= PRESSURE_FIRST && (e - PRESSURE_FIRST) % PRESSURE_EVERY === 0 && pr.next < pr.total) {
    const c = pressureSpiral()[pr.next++];
    const v = s.grid[c];
    if (v !== CODE.HARD && v !== CODE.PRESSURE) {
      if (v === CODE.FLOOR) s.grid[c] = CODE.FALLING;
      pr.falling.push({ cell: c, t0: s.tick, land: s.tick + fallTicks(linOf(c)) });
      ev.push({ type: 'pressure_step', cell: c });
    }
  }
  for (const f of [...pr.falling]) if (f.land === s.tick) { land(s, f.cell); pr.falling.splice(pr.falling.indexOf(f), 1); }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/core/clock.test.ts tests/core/pressure.test.ts && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/rom/pressure-facts.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/clock.ts web/src/core/pressure.ts web/tests/core/clock.test.ts web/tests/core/pressure.test.ts web/tests/rom/pressure-facts.test.ts
git commit -m "$(cat <<'MSG'
feat(core): relógio da ROM, pressão 205/14/36+2·lin com Morte Súbita e TIME UP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 14: Fim de rodada, partida e times

**Possui:** `web/src/core/round-end.ts`, `web/src/core/match.ts`, `web/tests/core/round-end.test.ts`, `web/tests/core/match.test.ts`.

**Interfaces:**
- Consumes: `state` (`standing`, `setAct`), `flyers.dropHeld`, `setup.createRound`, `rng`, `constants` (WIN_DELAY, CELEBRATE_TICKS, VICTORY_SFX_AT, TIME_UP_TICKS).
- Produces: `groupsStanding`, `checkRoundEnd`, `tickEndPhases`; `MatchState`, `createMatch`, `startRound`, `finishRound`, `setRacerPrize`, `clearRacerPrize`.

Regras (§3.12, decisões 21 e 25): "de pé" = `present && state === 'alive'`; grupos = jogadores (Todos contra Todos) ou times com alguém de pé (Em Equipes). Em `play`, quando grupos ≤ 1 pela 1ª vez, `endAt = tick + 2`; em `endAt`, se resta 1 grupo → `won` (todos de pé em `victory`, congelados e imunes); se 0, espera. `won`: `celebT0` = 1º tick sem ninguém `dying`; `victory_sfx` em `celebT0 + 31`; `over` (vitória, `last`) em `celebT0 + 128`. Todos mortos: `over` (empate, `dead`) no 1º tick sem `dying`. `timeUp`: `over` (empate, `time`) em `phaseT0 + 160`. Vencedor = menor slot de pé. `over` emite `round_over`. Partida: `finishRound` conta uma vez, só com `phase === 'over'`; Em Equipes dá +1 a todos os presentes do time; `m.rng` recebe a semente da rodada.

- [ ] **Step 1: Escrever os testes**

`web/tests/core/round-end.test.ts`:

```ts
import { arena, put } from './kit';
import { step } from '../../src/core/step';
import { groupsStanding } from '../../src/core/round-end';
import type { GameEvent, RoundState } from '../../src/core/types';

/** Roda até o tick `until`, chamando `before(tick)` antes de cada passo (para simular fim de animação de morte). */
function drive(s: RoundState, until: number, before: (t: number) => void = () => {}): GameEvent[] {
  const ev: GameEvent[] = [];
  while (s.tick < until && s.phase !== 'over') { before(s.tick + 1); ev.push(...step(s, [0, 0, 0, 0, 0])); }
  return ev;
}
function dies(s: RoundState, slot: number, at: number): void {
  const p = s.players[slot]; p.state = 'dying'; p.hitT0 = at; s.lastHit = at;
}

describe('fim de rodada (t75, t86, t95, t97, t103)', () => {
  it('vitória decidida 2 ticks depois; 128 de comemoração depois das animações; victory_sfx em +31', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 8, 5);
    dies(s, 1, 100);                                 // P2 atingido no tick 100
    const ev = drive(s, 400, t => { if (t === 165) s.players[1].state = 'out'; });
    expect(s.endAt).toBe(103);
    expect(s.celebT0).toBe(165);
    expect(ev.filter(e => e.type === 'victory_sfx')).toEqual([{ type: 'victory_sfx', slot: 0 }]);
    expect([s.phase, s.phaseT0]).toEqual(['over', 165 + 128]);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
    expect(ev.filter(e => e.type === 'round_over').length).toBe(1);
  });
  it('em `won` o vencedor fica em victory', () => {
    const s = arena(); put(s, 0, 4, 1); dies(s, 1, 100);
    drive(s, 103);
    expect([s.phase, s.players[0].act]).toEqual(['won', 'victory']);
  });
  it('todos mortos: empate no tick em que a última animação termina, sem os 128', () => {
    const s = arena(); dies(s, 0, 100); dies(s, 1, 110);
    drive(s, 400, t => { if (t === 165) s.players[0].state = 'out'; if (t === 175) s.players[1].state = 'out'; });
    expect([s.phase, s.phaseT0]).toEqual(['over', 175]);
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'dead' });
  });
  it('se o último de pé morre dentro dos 2 ticks, vira empate', () => {
    const s = arena(); put(s, 0, 4, 1); dies(s, 1, 100);
    drive(s, 400, t => { if (t === 102) dies(s, 0, 102); if (t === 165) s.players[1].state = 'out'; if (t === 167) s.players[0].state = 'out'; });
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'dead' });
  });
  it('TIME UP: 160 ticks congelado e empate', () => {
    const s = arena(); s.phase = 'timeUp'; s.phaseT0 = 100;
    drive(s, 400);
    expect([s.phase, s.phaseT0]).toEqual(['over', 260]);
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'time' });
  });
  it('times: a rodada acaba quando resta 1 time de pé; vencedor = menor slot de pé', () => {
    const s = arena({ players: 4, rules: { mode: 'team', teams: [1, 0, 0, 1, 0] } });
    for (const [slot, col] of [[0, 4], [1, 6], [2, 8], [3, 10]]) put(s, slot, col, 1);
    expect(groupsStanding(s)).toBe(2);
    s.players[1].state = 'out'; s.players[2].state = 'out';
    expect(groupsStanding(s)).toBe(1);
    drive(s, 400);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
});
```

`web/tests/core/match.test.ts`:

```ts
import { createMatch, startRound, finishRound, setRacerPrize, clearRacerPrize } from '../../src/core/match';
import { rules } from './kit';
import type { RoundState } from '../../src/core/types';

const over = (s: RoundState, winner: number | null): RoundState => {
  s.phase = 'over';
  s.result = winner === null ? { kind: 'draw', winner: null, reason: 'time' } : { kind: 'win', winner, reason: 'last' };
  return s;
};

describe('partida', () => {
  it('semente de boot por padrão; RNG passa de rodada para rodada', () => {
    const m = createMatch(rules(), 1);
    expect(m.rng.seed).toBe(0x12);
    const s = startRound(m);
    expect(s.rng).not.toBe(m.rng);
    s.rng.seed = 0x4321;
    finishRound(m, over(s, 0));
    expect(m.rng.seed).toBe(0x4321);
    expect(startRound(m).players.length).toBe(5);
    expect(m.roundNo).toBe(2);
  });
  it('coroas acumulam; a partida acaba na meta; empate não dá coroa; conta uma vez', () => {
    const m = createMatch(rules({ matches: 2 }), 1);
    expect(finishRound(m, over(startRound(m), 2))).toEqual({ winners: [2], matchOver: false, champions: [] });
    const s = over(startRound(m), 2);
    expect(finishRound(m, s)).toEqual({ winners: [2], matchOver: true, champions: [2] });
    expect(finishRound(m, s).winners).toEqual([]);
    expect(m.crowns).toEqual([0, 0, 2, 0, 0]);
    const m2 = createMatch(rules(), 1);
    finishRound(m2, over(startRound(m2), null));
    expect(m2.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('rodada que não acabou não conta', () => {
    const m = createMatch(rules(), 1);
    expect(finishRound(m, startRound(m)).winners).toEqual([]);
  });
  it('Em Equipes: +1 para todos os presentes do time do vencedor', () => {
    const m = createMatch(rules({ mode: 'team', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, false] }), 1);
    finishRound(m, over(startRound(m), 2));
    expect(m.crowns).toEqual([1, 0, 1, 0, 0]);
  });
  it('regras copiadas; prêmio do Racer guardado na partida (aplicação na rodada: T16)', () => {
    const r = rules({ racer: true });
    const m = createMatch(r, 1);
    r.active[0] = false;
    expect(m.rules.active[0]).toBe(true);
    setRacerPrize(m, 1, 0);
    expect(m.racerPrize).toEqual({ slot: 1, prize: 0 });
    clearRacerPrize(m);
    expect(m.racerPrize).toBeNull();
  });
  it('spawns aleatórios usam o RNG separado e não mudam a semente do jogo', () => {
    const a = createMatch(rules({ randomSpawns: true }), 8, 0x12);
    const b = createMatch(rules(), 8, 0x12);
    expect(startRound(a).rng.seed).toBe(startRound(b).rng.seed);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/round-end.test.ts tests/core/match.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `round-end.ts`**

```ts
import type { GameEvent, RoundResult, RoundState } from './types';
import { CELEBRATE_TICKS, TIME_UP_TICKS, VICTORY_SFX_AT, WIN_DELAY } from './constants';
import { setAct, standing } from './state';
import { dropHeld } from './flyers';

export function groupsStanding(s: RoundState): number {
  const st = s.players.filter(standing);
  return s.rules.mode === 'team' ? new Set(st.map(p => p.team)).size : st.length;
}

const winnerSlot = (s: RoundState): number | null => s.players.find(standing)?.slot ?? null;

function finish(s: RoundState, ev: GameEvent[], result: RoundResult): void {
  s.phase = 'over'; s.phaseT0 = s.tick; s.result = result;
  ev.push({ type: 'round_over', result });
}

export function checkRoundEnd(s: RoundState, _ev: GameEvent[]): void {
  if (s.phase !== 'play') return;
  if (s.endAt === 0) { if (groupsStanding(s) <= 1) s.endAt = s.tick + WIN_DELAY; return; }
  if (s.tick !== s.endAt || groupsStanding(s) !== 1) return;
  s.phase = 'won'; s.phaseT0 = s.tick;
  for (const p of s.players) {
    if (!standing(p)) continue;
    if (p.carry >= 0) dropHeld(s, p);
    p.push.left = 0;
    setAct(s, p, 'victory', 0);
  }
}

export function tickEndPhases(s: RoundState, ev: GameEvent[]): void {
  const dying = s.players.some(p => p.present && p.state === 'dying');
  if (s.phase === 'play') {
    if (s.endAt && s.tick >= s.endAt && groupsStanding(s) === 0 && !dying) finish(s, ev, { kind: 'draw', winner: null, reason: 'dead' });
    return;
  }
  if (s.phase === 'won') {
    if (s.celebT0 < 0) { if (dying) return; s.celebT0 = s.tick; }
    if (s.tick === s.celebT0 + VICTORY_SFX_AT) ev.push({ type: 'victory_sfx', slot: winnerSlot(s) ?? 0 });
    if (s.tick >= s.celebT0 + CELEBRATE_TICKS) finish(s, ev, { kind: 'win', winner: winnerSlot(s), reason: 'last' });
    return;
  }
  if (s.phase === 'timeUp' && s.tick >= s.phaseT0 + TIME_UP_TICKS) finish(s, ev, { kind: 'draw', winner: null, reason: 'time' });
}
```

- [ ] **Step 4: Implementar `match.ts`**

```ts
import type { RoundState, Rules } from './types';
import { BOOT_SEED, makeRng, permuteSpawns, type Rng16 } from './rng';
import { createRound } from './setup';

export interface MatchState {
  rules: Rules; stage: number; rng: Rng16; roundNo: number; crowns: number[]; over: boolean;
  racerPrize: { slot: number; prize: number } | null;
  spawnSeed: number;                 // semente do RNG separado das opções extras
  chars: number[];
}

export function createMatch(rules: Rules, stage: number, seed: number | Rng16 = BOOT_SEED, chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const rng = typeof seed === 'number' ? makeRng(seed) : { seed: seed.seed };
  return {
    rules: { ...rules, teams: [...rules.teams], active: [...rules.active] }, stage, rng, roundNo: 0,
    crowns: [0, 0, 0, 0, 0], over: false, racerPrize: null, spawnSeed: rng.seed, chars: [...chars],
  };
}

export function startRound(m: MatchState): RoundState {
  m.roundNo++;
  const spawnOrder = m.rules.randomSpawns ? permuteSpawns(m.spawnSeed + m.roundNo) : undefined;
  return createRound(m.stage, m.rules, { seed: m.rng.seed }, { racerPrize: m.racerPrize, spawnOrder, chars: m.chars });
}

export function finishRound(m: MatchState, s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  const champions = (): number[] => [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
  if (s.phase !== 'over' || s.counted || !s.result) return { winners: [], matchOver: m.over, champions: champions() };
  s.counted = true;
  m.rng = { seed: s.rng.seed };
  let winners: number[] = [];
  const w = s.result.winner;
  if (s.result.kind === 'win' && w !== null) {
    winners = m.rules.mode === 'team'
      ? [0, 1, 2, 3, 4].filter(i => m.rules.active[i] && m.rules.teams[i] === m.rules.teams[w])
      : [w];
  }
  for (const i of winners) m.crowns[i]++;
  const ch = champions();
  m.over = ch.length > 0;
  return { winners, matchOver: m.over, champions: ch };
}

export function setRacerPrize(m: MatchState, slot: number, prize: number): void { m.racerPrize = { slot, prize }; }
export function clearRacerPrize(m: MatchState): void { m.racerPrize = null; }
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/core/round-end.test.ts tests/core/match.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/round-end.ts web/src/core/match.ts web/tests/core/round-end.test.ts web/tests/core/match.test.ts
git commit -m "$(cat <<'MSG'
feat(core): fim de rodada fiel (vitória +2, comemoração 128, empate, TIME UP 160), partida e times

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 15: Bad Bomber ("Bomber Vingador")

**Possui:** `web/src/core/bad-bomber.ts`, `web/tests/core/bad-bomber.test.ts`.

**Interfaces:**
- Consumes: `bombs.addBomb` (real), `flyers.launchBomb/handFrom` (reais), `flyers.aimThrow` (stub devolve 5), `state.setAct`, `units`, `constants.FUSE`.
- Produces: `becomeBad(s, p)`, `tickBadBombers(s, inputs, ev)`, `clearBadBombers(s, ev)`.

Regras (§3.13, decisão 24): moldura `X ∈ {15, 239}`, `Y ∈ {32, 224}` em px inteiros; entrada a 1 px/tick; na moldura 1 px/tick pelo direcional; A (borda de subida) arremessa para dentro se não houver bomba viva, `tick ≥ readyAt` e o ponto está a ≥ 16 px dos cantos; a bomba é `bad`, fogo 1, pavio 126, dono = slot; a cadência (`live = -1`, `readyAt = tick + 48`) é feita por `refundBomb` quando ela explode ou some.

- [ ] **Step 1: Escrever os testes** `web/tests/core/bad-bomber.test.ts`

```ts
import { arena, put, C } from './kit';
import { becomeBad, tickBadBombers, clearBadBombers } from '../../src/core/bad-bomber';
import { removeBomb } from '../../src/core/bombs';
import { BTN, type GameEvent, type RoundState } from '../../src/core/types';

function tick(s: RoundState, btn: number, ev: GameEvent[] = [], slot = 1): GameEvent[] {
  s.tick++;
  const inputs = [0, 0, 0, 0, 0]; inputs[slot] = btn;
  tickBadBombers(s, inputs, ev);
  return ev;
}
function badAt(x: number, y: number) {
  const s = arena({ rules: { badBomber: true } });
  const p = put(s, 1, 4, 3);
  becomeBad(s, p);
  const b = s.bad[0];
  b.x = x; b.y = y; b.phase = 'patrol';
  return { s, p, b };
}

describe('Bad Bomber (t79–t82)', () => {
  it('entra pelo lado em que morreu e anda 1 px/tick até a moldura', () => {
    const s = arena({ rules: { badBomber: true } });
    const p = put(s, 1, 4, 3);                       // X = 63 < 128 → esquerda
    becomeBad(s, p);
    expect([p.state, p.act, s.bad[0].x, s.bad[0].y, s.bad[0].phase]).toEqual(['bad', 'bad', -16, 79, 'enter']);
    for (let i = 0; i < 30; i++) tick(s, 0);
    expect(s.bad[0].phase).toBe('enter');
    tick(s, 0);
    expect([s.bad[0].x, s.bad[0].phase]).toEqual([15, 'patrol']);
    const s2 = arena({ rules: { badBomber: true } });
    becomeBad(s2, put(s2, 1, 12, 3));
    expect(s2.bad[0].x).toBe(271);
    for (let i = 0; i < 32; i++) tick(s2, 0);
    expect([s2.bad[0].x, s2.bad[0].phase]).toEqual([239, 'patrol']);
  });
  it('depois do gatilho da pressão, quem morre não vira Bad Bomber', () => {
    const s = arena({ rules: { badBomber: true } });
    s.pressure.trigger = 50;
    const p = put(s, 1, 4, 3);
    becomeBad(s, p);
    expect([p.state, s.bad.length]).toEqual(['out', 0]);
  });
  it('anda 1 px/tick pelo lado; num canto vale a direção do outro lado; para no canto', () => {
    const { s, b } = badAt(15, 100);
    tick(s, BTN.UP); expect([b.x, b.y]).toEqual([15, 99]);
    tick(s, BTN.LEFT); expect([b.x, b.y]).toEqual([15, 99]);        // perpendicular: não anda
    for (let i = 0; i < 100; i++) tick(s, BTN.UP);
    expect([b.x, b.y]).toEqual([15, 32]);                            // parou no canto
    tick(s, BTN.RIGHT); expect([b.x, b.y]).toEqual([16, 32]);        // curva automática
  });
  it('arremessa para dentro com A: bomba de fogo 1, pavio cheio, voo da luva', () => {
    const { s, b } = badAt(15, 80);
    const ev = tick(s, BTN.A);
    const bomb = s.bombs[0];
    expect([bomb.bad, bomb.fire, bomb.fuse, bomb.owner, bomb.state, bomb.cell]).toEqual([true, 1, 126, 1, 'air', C(1, 3)]);
    expect(s.flyers.map(f => [f.flight, f.dir])).toEqual([['throw5', 1]]);
    expect(b.live).toBe(bomb.id);
    expect(ev).toEqual([{ type: 'throw', slot: 1 }]);
    tick(s, 0); tick(s, BTN.A);
    expect(s.bombs.length).toBe(1);                                  // uma por vez
  });
  it('cadência: só pega outra 48 ticks depois de a anterior sumir', () => {
    const { s, b } = badAt(15, 80);
    tick(s, BTN.A);
    removeBomb(s, s.bombs[0], true);                                 // tick 101
    expect([b.live, b.readyAt]).toEqual([-1, 149]);
    tick(s, 0); tick(s, BTN.A);
    expect(s.bombs.length).toBe(0);
    while (s.tick < 148) tick(s, 0);
    tick(s, BTN.A);
    expect(s.bombs.length).toBe(1);
  });
  it('não arremessa a menos de 16 px de um canto', () => {
    const { s } = badAt(15, 40);
    tick(s, BTN.A);
    expect(s.bombs.length).toBe(0);
  });
  it('sai de cena no gatilho da pressão', () => {
    const { s, p } = badAt(15, 80);
    clearBadBombers(s, []);
    expect([p.state, s.bad]).toEqual(['out', []]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/bad-bomber.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `bad-bomber.ts`**

```ts
import { BTN, type BadBomberState, type GameEvent, type Player, type RoundState } from './types';
import { FUSE } from './constants';
import { SUB, cellAt, px } from './units';
import { setAct } from './state';
import { addBomb } from './bombs';
import { aimThrow, handFrom, launchBomb } from './flyers';

const X_MIN = 15, X_MAX = 239, Y_MIN = 32, Y_MAX = 224, CORNER_GAP = 16;

export function becomeBad(s: RoundState, p: Player): void {
  if (s.pressure.trigger >= 0) { p.state = 'out'; return; }
  p.state = 'bad';
  setAct(s, p, 'bad');
  const left = px(p.x) < 128;
  s.bad.push({
    slot: p.slot, x: left ? -16 : 271, y: Math.min(Y_MAX, Math.max(Y_MIN, px(p.y))),
    phase: 'enter', face: left ? 2 : 6, live: -1, readyAt: 0,
  });
}

export function clearBadBombers(s: RoundState, _ev: GameEvent[]): void {
  for (const b of s.bad) s.players[b.slot].state = 'out';
  s.bad = [];
}

function patrol(b: BadBomberState, btn: number): void {
  const vertical = b.x === X_MIN || b.x === X_MAX, horizontal = b.y === Y_MIN || b.y === Y_MAX;
  if (btn & BTN.UP && vertical && b.y > Y_MIN) { b.y--; b.face = 0; }
  else if (btn & BTN.DOWN && vertical && b.y < Y_MAX) { b.y++; b.face = 4; }
  else if (btn & BTN.LEFT && horizontal && b.x > X_MIN) { b.x--; b.face = 6; }
  else if (btn & BTN.RIGHT && horizontal && b.x < X_MAX) { b.x++; b.face = 2; }
}

function tryThrow(s: RoundState, b: BadBomberState, ev: GameEvent[]): void {
  if (b.live >= 0 || s.tick < b.readyAt) return;
  const vertical = b.x === X_MIN || b.x === X_MAX;
  const nearCorner = vertical
    ? b.y - Y_MIN < CORNER_GAP || Y_MAX - b.y < CORNER_GAP
    : b.x - X_MIN < CORNER_GAP || X_MAX - b.x < CORNER_GAP;
  if (nearCorner) return;
  const face = b.x === X_MIN ? 2 : b.x === X_MAX ? 6 : b.y === Y_MIN ? 4 : 0;
  const x = b.x * SUB, y = b.y * SUB;
  const cell = cellAt(x, y);
  const n = aimThrow(s, cell, face, b.slot);
  const bomb = addBomb(s, b.slot, cell, { state: 'air', fire: 1, bad: true, fuse: FUSE });
  const dir = (face >> 1) as 0 | 1 | 2 | 3;
  launchBomb(s, bomb, `throw${n}`, dir, handFrom(x, y, dir));
  b.live = bomb.id; b.face = face;
  ev.push({ type: 'throw', slot: b.slot });
}

export function tickBadBombers(s: RoundState, inputs: readonly number[], ev: GameEvent[]): void {
  for (const b of [...s.bad]) {
    const p = s.players[b.slot];
    const btn = inputs[b.slot] ?? 0;
    const pressed = btn & ~p.prevBtn;
    p.prevBtn = btn;
    if (b.phase === 'enter') {
      b.x += b.x < X_MIN ? 1 : -1;
      if (b.x === X_MIN || b.x === X_MAX) b.phase = 'patrol';
      continue;
    }
    patrol(b, btn);
    if (pressed & BTN.A) tryThrow(s, b, ev);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/bad-bomber.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/bad-bomber.ts web/tests/core/bad-bomber.test.ts
git commit -m "$(cat <<'MSG'
feat(core): Bad Bomber — moldura a 1 px/tick, arremesso com mira da luva e cadência de +48

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
## Onda 3

### Task 16: Integração do passo e cenários de ponta a ponta

**Possui:** `web/src/core/step.ts`, `web/src/core/index.ts`, `web/src/core/layouts.ts` (novo), `web/tests/core/scenarios.test.ts`, `web/tests/core/determinism.test.ts`, `web/tests/core/layouts.test.ts`; e **correções de integração** em qualquer `web/src/core/*.ts` da onda 2 (a onda 3 tem uma tarefa só; cada correção vem com o teste de cenário que a revelou).

**Interfaces:**
- Consumes: tudo da onda 2.
- Produces: `LAYOUTS: string[][]` (10 × 11 linhas × 13 colunas, `#` duro, `x` soft, `.` piso, `?` especial; derivado de `STAGE_FACTS.base`, para a miniatura da seleção de fase) e `STAGE_NAMES` exportados por `core/index.ts`; `step` validado na ordem da §3.4.

- [ ] **Step 1: Mesclar a onda 2 e rodar tudo**

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
npx vitest run && npx tsc --noEmit
```
Expected: PASS (cada módulo foi testado isoladamente; os stubs sumiram).

- [ ] **Step 2: Escrever os cenários** `web/tests/core/scenarios.test.ts`

```ts
import { arena, put, setCell, codeAt, run, runUntil, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { BTN, CODE, ITEM, type GameEvent } from '../../src/core/types';
import { cellAt } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { createMatch, setRacerPrize, startRound, clearRacerPrize } from '../../src/core/match';

const inp = (p0 = 0, p1 = 0, p2 = 0): number[] => [p0, p1, p2, 0, 0];
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some(e => e.type === type);

describe('ponta a ponta', () => {
  it('A coloca; explode 127 ticks depois; a chama do tick t atinge no t+1; vitória 2 + 65 + 128', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 6, 1);
    run(s, 1, inp(BTN.A));                                        // tick 101
    expect(s.bombs[0].born).toBe(101);
    run(s, 48, inp(BTN.DOWN));                                     // foge para (4,4)
    expect(cellAt(s.players[0].x, s.players[0].y)).toBe(C(4, 4));
    expect(runUntil(s, (_s, ev) => has(ev, 'explosion'))).toBe(228);
    expect(s.players[1].state).toBe('alive');
    run(s, 1);
    expect([s.players[1].state, s.players[1].hitT0]).toEqual(['dying', 229]);
    expect(runUntil(s, st => st.phase === 'over')).toBe(229 + 65 + 128);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
  it('chute: andar contra a bomba com Chute a leva até a parede', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.kick = true; put(s, 1, 8, 5);
    const b = addBomb(s, 1, C(6, 1));
    const ev = run(s, 120, inp(BTN.RIGHT));
    expect(ev.filter(e => e.type === 'bomb_kicked').length).toBe(1);
    expect([b.state, b.cell]).toEqual(['idle', C(14, 1)]);
  });
  it('soco na cabeça: atordoa 63 e o atingido perde itens, que voam', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
    const q = put(s, 1, 8, 1); q.fire = 2;
    addBomb(s, 0, C(5, 1));
    const ev = run(s, 18, inp(BTN.Y));
    expect(ev).toContainEqual({ type: 'stunned', slot: 1 });
    expect([q.act, q.fire < 2]).toEqual(['stunned', true]);
    expect(s.flyers.some(f => f.kind === 'item' && f.ref === ITEM.FIRE)).toBe(true);
  });
  it('luva: A, A de novo e segura (pavio congela), solta → 5 casas', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2; put(s, 1, 8, 5);
    run(s, 1, inp(BTN.A));                                         // 101: coloca
    run(s, 1);                                                     // 102
    run(s, 1, inp(BTN.A));                                         // 103: levanta
    const b = s.bombs[0];
    expect(b.state).toBe('held');
    const fuse = b.fuse;
    run(s, 9, inp(BTN.A));                                         // segura até 112
    expect(b.fuse).toBe(fuse);
    run(s, 1);                                                     // 113: solta → arremessa
    run(s, 12);
    expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
  });
  it('pegar item cura a doença e a arremessa como caveira nova', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x22; put(s, 1, 8, 5);
    setCell(s, 5, 1, itemCode(ITEM.FIRE));
    const t = runUntil(s, (_s, ev) => has(ev, 'item_picked'), 60, inp(BTN.RIGHT));
    expect(t).toBeGreaterThan(0);
    expect([p.disease, p.fire]).toEqual([0, 1]);
    expect(s.flyers.some(f => f.kind === 'item' && f.ref >= 0x21 && f.ref <= 0x2b)).toBe(true);
  });
  it('drops da morte: no tick hitT0 + 22 as bombas extras aparecem inteiras', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.bombsCap = 3; p.bombsFree = 3; put(s, 1, 8, 5);
    setCell(s, 4, 1, CODE.FLAME); s.cellT0[C(4, 1)] = 100;
    run(s, 1);                                                     // 101: atingido
    expect(p.hitT0).toBe(101);
    run(s, 21);                                                    // 122
    expect(s.grid.filter(v => v === itemCode(ITEM.BOMB)).length).toBe(0);
    run(s, 1);                                                     // 123 = 101 + 22
    expect(s.grid.filter(v => v === itemCode(ITEM.BOMB)).length).toBe(2);
  });
  it('bloco de pressão mata mesmo com coração e invencibilidade', () => {
    const s = arena(); const p = put(s, 0, 2, 1); p.heart = true; p.inv = 500; put(s, 1, 8, 6);
    s.pressure.trigger = 100;
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'player_hit' && e.slot === 0))).toBe(100 + 205 + 38 + 1);
  });
  it('contágio por contato no passo', () => {
    const s = arena(); const a = put(s, 0, 4, 1); a.disease = 0x21; const b = put(s, 1, 5, 1);
    expect(runUntil(s, (_s, ev) => has(ev, 'disease_passed'), 20, inp(BTN.RIGHT))).toBeGreaterThan(0);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
  });
  it('$2B perde 1 item quando tick & 31 = 0', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x2b; p.kick = true; put(s, 1, 2, 1);
    run(s, 27);                                                    // 127
    expect(p.kick).toBe(true);
    run(s, 1);                                                     // 128
    expect(p.kick).toBe(false);
  });
  it('remota: B detona no mesmo tick', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.bombType = 1; put(s, 1, 8, 5);
    run(s, 1, inp(BTN.A));
    run(s, 48, inp(BTN.DOWN));
    run(s, 100);
    expect(s.bombs.length).toBe(1);
    const ev = run(s, 1, inp(BTN.B));
    expect(ev.filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(4, 1), owner: 0 }]);
  });
  it('em `won` as bombas restantes não explodem', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 8, 5);
    addBomb(s, 0, C(12, 9));
    setCell(s, 8, 5, CODE.FLAME); s.cellT0[C(8, 5)] = 100;
    const ev = run(s, 400);
    expect(ev.filter(e => e.type === 'explosion').length).toBe(0);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
  it('Bad Bomber: vira Bad 65 ticks depois do acerto, entra, arremessa e a cadência vale', () => {
    const s = arena({ players: 3, rules: { badBomber: true } });
    put(s, 0, 8, 5); put(s, 1, 4, 3); put(s, 2, 12, 9);
    setCell(s, 4, 3, CODE.FLAME); s.cellT0[C(4, 3)] = 100;
    run(s, 1);                                                     // 101: P2 atingido
    run(s, 65);                                                    // 166
    expect([s.players[1].state, s.bad.length, s.bad[0].x]).toEqual(['bad', 1, -16]);
    run(s, 31);                                                    // 197
    expect(s.bad[0].phase).toBe('patrol');
    run(s, 1, inp(0, BTN.A));                                      // 198
    expect(s.bombs.some(b => b.bad && b.state === 'air')).toBe(true);
    const t = runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion' && e.owner === 1), 400);
    expect(t).toBeGreaterThan(198);
    expect(s.bad[0].readyAt).toBe(t + 48);
  });
  it('prêmio do Racer aplicado em toda rodada da partida', () => {
    const m = createMatch({ ...arena().rules, racer: true, active: [true, true, false, false, false] }, 1);
    setRacerPrize(m, 1, 0);
    expect(startRound(m).players[1].bombsCap).toBe(2);
    expect(startRound(m).players[1].bombsCap).toBe(2);
    clearRacerPrize(m);
    expect(startRound(m).players[1].bombsCap).toBe(1);
  });
});
```

`web/tests/core/determinism.test.ts`:

```ts
import { createMatch, startRound, finishRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { hashState } from '../../src/core/hash';
import { rules } from './kit';

/** 20.000 ticks com entradas pseudoaleatórias próprias do teste (não usam o RNG do jogo). */
function play(seed: number): string[] {
  const m = createMatch(rules({ timeIdx: 0 }), 1, seed);
  let s = startRound(m);
  let x = seed >>> 0;
  const next = (): number => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x >>> 16; };
  const out: string[] = [];
  for (let t = 1; t <= 20000; t++) {
    step(s, [0, 1, 2, 3, 4].map(() => { const r = next(); return (r & 0x0f) | (r & 0x10 ? 16 : 0) | (r & 0x20 ? 64 : 0); }));
    if (s.phase === 'over') { finishRound(m, s); s = startRound(m); }
    if (t % 1000 === 0) out.push(hashState(s));
  }
  return out;
}

describe('determinismo (20.000 ticks)', () => {
  it('mesma semente e entradas → mesmos hashes', () => {
    expect(play(0x12)).toEqual(play(0x12));
  });
  it('sementes diferentes → hashes diferentes', () => {
    expect(play(0x12)).not.toEqual(play(0x34));
  });
  it('o estado é JSON puro (ida e volta idêntica)', () => {
    const m = createMatch(rules(), 3);
    const s = startRound(m);
    for (let i = 0; i < 300; i++) step(s, [16, 0, 64, 0, 0]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

`web/tests/core/layouts.test.ts`:

```ts
import { LAYOUTS, STAGE_NAMES } from '../../src/core';

describe('LAYOUTS (miniaturas)', () => {
  it('10 fases de 11 × 13; fase 1 = todo soft com pilares; fase 5 sem soft; fase 3 com as casas das bolas livres', () => {
    expect(LAYOUTS.length).toBe(10);
    for (const l of LAYOUTS) { expect(l.length).toBe(11); for (const r of l) expect(r.length).toBe(13); }
    expect(LAYOUTS[0][0]).toBe('xxxxxxxxxxxxx');
    expect(LAYOUTS[0][1]).toBe('x#x#x#x#x#x#x');
    expect(LAYOUTS[4].join('').includes('x')).toBe(false);
    expect(LAYOUTS[2][4][4]).toBe('.');              // bola da fase 3: o objeto vem do init da arena (plano 8)
    expect(STAGE_NAMES.length).toBe(10);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/core/scenarios.test.ts tests/core/determinism.test.ts tests/core/layouts.test.ts`
Expected: FAIL em `layouts.test.ts` (sem `LAYOUTS`); nos cenários, cada falha aponta um problema de integração.

- [ ] **Step 4: Criar `layouts.ts` e exportar**

```ts
import { CODE } from './types';
import { cellOf } from './units';
import { STAGE_FACTS } from './tables/stages';

/** Miniatura da grade-base de cada fase (campo 13 × 11): # duro, x soft, . piso, ? especial. */
export const LAYOUTS: string[][] = STAGE_FACTS.map(f => Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 13 }, (_, c) => {
    const v = f.base[cellOf(c + 2, r + 1)];
    return v === CODE.HARD ? '#' : v === CODE.SOFT ? 'x' : v === CODE.FLOOR ? '.' : '?';
  }).join('')));
```

Em `core/index.ts`, acrescentar `export { LAYOUTS } from './layouts';`.

- [ ] **Step 5: Corrigir a integração até os cenários passarem**

Para cada cenário que falhar: localizar a regra da spec (§3.4–§3.13) e a decisão deste plano, corrigir o módulo responsável e rodar de novo o teste unitário dele (que não pode quebrar). Pontos em que a ordem importa e que costumam falhar:
- a bomba colocada no tick *t* não pode andar o pavio no mesmo *t* (`born`);
- o chute é decidido depois do movimento, e o deslize começa no passo de objetos do mesmo tick;
- o jogador atingido no tick *t* só vira `out` em *t* + 65, dentro do `playerTick` (antes de `checkRoundEnd`);
- `tickEndPhases` roda depois de `checkRoundEnd` no mesmo tick;
- o Bad Bomber lê a própria entrada em `tickBadBombers` (o `playerTick` não mexe no `prevBtn` dele).

- [ ] **Step 6: Rodar tudo**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (inclusive os testes unitários da onda 2 e os goldens).

- [ ] **Step 7: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "$(cat <<'MSG'
feat(core): integração do passo na ordem da ROM, cenários de ponta a ponta e determinismo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
## Onda 4

### Task 17: IA — porte para o núcleo novo (perigo, navegação, decisões)

**Possui:** `web/src/core/ai/{index,level,danger,nav,brain}.ts` (substitui o stub `ai/index.ts`; `ai/hints.ts` fica), `web/tests/core/ai/{simkit.ts,danger.test.ts,behavior.test.ts,sim.test.ts}`.

**Interfaces:**
- Consumes: núcleo integrado (T16); modelo a portar: `web/src/legacy-core/ai.ts` (funções `hazards`, `blastCells`, `slideEnd`, `search`, `route`, `exits`, `refuge`, `escape`, `hasRefuge`, `tryBomb`, `waryEscape`, `think`, `steer`, `aiInputs`) e seus testes `web/tests/legacy-core/{ai,ai-sim}.test.ts`.
- Produces (mesma API pública do legado, nomes finais):
  - `ai/level.ts`: `AiLevel`, `AI_LEVELS` (valores do stub), `aiRoll(tick, slot, salt)`.
  - `ai/danger.ts`: `SAFE`, `interface Hazard { at: Int32Array; end: Int32Array }`, `interface Extra { cell: number; fire: number; pierce: boolean; t?: number }`, `hazards(s, forSlot, extra?): Hazard`, `dangerMap(s, forSlot = -1, extra?): Int32Array` (= `hazards(...).at`), `crossCells(s, cell, fire, pierce): { cells: number[]; bombs: number[] }`, `kickPath(s, b): { cell: number; t: number; trail: number[] }`, `flightEnd(s, f): { cell: number; t: number }`, `pressureCells(s): Map<number, number>`, `blockedUntil(s): Int32Array`.
  - `ai/nav.ts`: `ticksPerCell(s, p)`, `search(...)`, `route(...)`, `exits(...)`, `refuge(...)`, `escape(...)`, `steer(s, p, next): number`.
  - `ai/brain.ts`: `Brain`, `think(s, p, level, brain, ai)`.
  - `ai/index.ts`: `AiState { round: RoundState | null; brains: Brain[]; lastOut: number[] }`, `createAi()`, `aiInputs(s, ai, cpu, levelIdx): number[]`, e reexporta `AI_LEVELS`, `aiRoll`, `SAFE`, `dangerMap`.

**Semântica do perigo (diferente do legado — é o ponto traiçoeiro):** tudo em *offsets* de tick a partir do próximo (1 = próximo tick). Uma bomba que explode no passo de objetos do offset `t` fere quem está na casa nos offsets `t+1 … t+25`: `at = t + 1`, `end = t + 26`. Chama já na grade: `at = 1`, `end = cellT0 + 26 − tick`. Pressão: `at = pouso − tick + 1`, `end = SAFE`. `t` de uma bomba parada = `fuse + 1` (com `fuseStep` da arena: 2 → `⌈fuse/2⌉ + 1`, 0 → `2·fuse + 1`); `chainAt` → `chainAt − tick`; cadeia: a 1ª bomba alcançada em cada braço recebe `t = min(t, t_origem + 2)`, até estabilizar; remota de adversário: `t = 0` (perigo permanente); remota do próprio `forSlot`: ignorada; bomba na mão: ignorada; bomba no ar: `flightEnd` (passos restantes do script, quiques previstos com as regras de T8) + `fuse + 1`; chutada: `kickPath` (mesmas paradas de `slideStep`, 8 ticks por casa; explode onde estiver quando `t` acabar ou 1 tick depois de entrar em chama), e toda a trilha fica marcada. Bomba hipotética (`extra`): `t = 127`.

**Regras do porte (o resto é o algoritmo do legado, função a função):**
1. Grade 15×13 → 17×13: casas do campo `col 2..14`, `lin 1..11` (legado `gx 1..13` = `col − 1`). Vizinhos por `faceStep`.
2. Passável para o jogador `p`: `!blockedFor(p, code)[0]`, a própria casa atual sempre; `BURNING` passa a ser passável no offset `cellT0 + 25 − tick` (`blockedUntil`); bomba parada bloqueia (exceto com atravessa-bomba).
3. Tempo por casa: `ticksPerCell = ⌈4096 / SPEED_BY_LEVEL[speedLevel(s, p)]⌉` (16 px × 256).
4. `steer`: direção da casa seguinte; se o deslocamento perpendicular ao centro for de 1 a 3 px, manda antes a perpendicular rumo ao centro (zona morta do pilar, §9.2); senão manda a direção e deixa a assistência de canto alinhar.
5. A é borda: a IA só manda `A` num tick se não mandou no anterior (`lastOut[slot]`).
6. A IA não lê `s.hidden` nem `s.rng`; o sorteio é `aiRoll`.
7. Níveis, prioridades (fugir → item → bomba com fuga garantida → caçar/blocos → passear), `wary`, `open`, `trap`, `alert` e `react`: iguais ao legado.

- [ ] **Step 1: Escrever os testes**

`web/tests/core/ai/simkit.ts`:

```ts
import { createAi, aiInputs, type AiState } from '../../../src/core/ai';
import { step } from '../../../src/core/step';
import type { GameEvent, RoundState } from '../../../src/core/types';

/** Roda `n` ticks com a IA nos slots `cpu`; os outros ficam parados. */
export function play(s: RoundState, cpu: boolean[], level: number, n: number, ai: AiState = createAi()): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n && s.phase !== 'over'; i++) ev.push(...step(s, aiInputs(s, ai, cpu, level)));
  return ev;
}
```

`web/tests/core/ai/danger.test.ts`:

```ts
import { arena, put, setCell, C } from '../kit';
import { dangerMap, SAFE, kickPath, pressureCells } from '../../../src/core/ai/danger';
import { addBomb } from '../../../src/core/bombs';
import { CODE } from '../../../src/core/types';

describe('mapa de perigo (offsets a partir do próximo tick)', () => {
  it('bomba recém-colocada: cruz letal a partir do offset 128; resto seguro', () => {
    const s = arena(); addBomb(s, 0, C(6, 1));
    const d = dangerMap(s);
    for (const c of [C(6, 1), C(5, 1), C(4, 1), C(7, 1), C(8, 1), C(6, 2), C(6, 3)]) expect(d[c]).toBe(128);
    expect([d[C(9, 1)], d[C(6, 4)], d[C(10, 5)]]).toEqual([SAFE, SAFE, SAFE]);
  });
  it('pilar e soft param a cruz como no núcleo', () => {
    const s = arena(); addBomb(s, 0, C(5, 1), { fire: 3 }); setCell(s, 7, 1, CODE.SOFT);
    const d = dangerMap(s);
    expect([d[C(5, 2)], d[C(7, 1)], d[C(8, 1)]]).toEqual([SAFE, 128, SAFE]);
  });
  it('cadeia: +2 por elo', () => {
    const s = arena();
    addBomb(s, 0, C(4, 1), { fuse: 10 });
    addBomb(s, 1, C(6, 1), { fuse: 100 });
    const d = dangerMap(s);
    expect([d[C(4, 1)], d[C(6, 1)], d[C(8, 1)]]).toEqual([12, 14, 14]);
  });
  it('chama atual é letal já no próximo tick', () => {
    const s = arena(); setCell(s, 6, 1, CODE.FLAME); s.cellT0[C(6, 1)] = 100;
    expect(dangerMap(s)[C(6, 1)]).toBe(1);
  });
  it('remota de adversário é perigo permanente; a própria não', () => {
    const s = arena(); addBomb(s, 1, C(6, 1), { type: 1 });
    expect(dangerMap(s, 0)[C(6, 1)]).toBe(1);
    expect(dangerMap(s, 1)[C(6, 1)]).toBe(SAFE);
  });
  it('bomba chutada que não para a tempo explode no meio do caminho, com a trilha marcada', () => {
    const s = arena(); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 1), { fuse: 20 });
    s.grid[C(5, 1)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0;
    const k = kickPath(s, b);
    expect([k.cell, k.t]).toEqual([C(7, 1), 21]);
    expect(k.trail).toEqual([C(5, 1), C(6, 1), C(7, 1)]);
    const d = dangerMap(s);
    expect([d[C(6, 1)], d[C(9, 1)]]).toEqual([22, 22]);
  });
  it('pressão: cronograma exato mesmo antes do gatilho (pelo relógio)', () => {
    const s = arena(); s.clock = { sec: 62, sub: 10 };
    const pc = pressureCells(s);
    expect(pc.get(C(2, 1))).toBe(10 + 205 + 38);
    expect(pc.get(C(3, 1))).toBe(10 + 219 + 38);
    expect(dangerMap(s)[C(2, 1)]).toBe(10 + 205 + 38 + 1);
  });
});
```

`web/tests/core/ai/behavior.test.ts`:

```ts
import { arena, put, setCell, C } from '../kit';
import { play } from './simkit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { addBomb } from '../../../src/core/bombs';
import { itemCode } from '../../../src/core/state';
import { createMatch, startRound } from '../../../src/core/match';
import { step } from '../../../src/core/step';
import { hashState } from '../../../src/core/hash';
import { ITEM } from '../../../src/core/types';
import { rules } from '../kit';

const CPU0 = [true, false, false, false, false];

describe('IA: comportamento', () => {
  it('foge da bomba colocada na própria casa', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    addBomb(s, 0, C(4, 1));
    play(s, CPU0, 1, 160);
    expect(s.players[0].state).toBe('alive');
  });
  it('pega um item próximo', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    setCell(s, 6, 1, itemCode(ITEM.FIRE));
    const ev = play(s, CPU0, 1, 90);
    expect(ev).toContainEqual({ type: 'item_picked', slot: 0, item: ITEM.FIRE });
  });
  it('não vai buscar item numa casa que uma bomba vai atingir antes de ela chegar', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 12, 9);
    setCell(s, 8, 3, itemCode(ITEM.FIRE));
    addBomb(s, 1, C(9, 3), { fuse: 40 });
    play(s, CPU0, 2, 200);
    expect(s.players[0].state).toBe('alive');
  });
  it('não lê os itens escondidos: estados que só diferem em `hidden` dão as mesmas entradas', () => {
    const mk = () => { const m = createMatch(rules(), 1); return startRound(m); };
    const a = mk(), b = mk();
    b.hidden = b.hidden.map(([c]) => [c, ITEM.P] as [number, number]);
    const ai1 = createAi(), ai2 = createAi();
    const cpu = [true, true, true, true, true];
    for (let t = 0; t < 400; t++) {
      const i1 = aiInputs(a, ai1, cpu, 2), i2 = aiInputs(b, ai2, cpu, 2);
      expect(i1).toEqual(i2);
      step(a, i1); step(b, i2);
      if (a.grid.some((v, i) => v !== b.grid[i])) break;    // depois que um item diferente aparece, divergir é legítimo
    }
  });
  it('é determinística', () => {
    const run = () => { const m = createMatch(rules(), 1, 7); const s = startRound(m); play(s, [true, true, true, true, true], 1, 3000); return hashState(s); };
    expect(run()).toBe(run());
  });
});
```

`web/tests/core/ai/sim.test.ts`:

```ts
import { createMatch, startRound } from '../../../src/core/match';
import { play } from './simkit';
import { rules } from '../kit';

describe('simulação só de CPUs', () => {
  it('10 rodadas × 5 CPUs Normal na fase 1: todas terminam; no máximo 3 por tempo', () => {
    let byTime = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = startRound(createMatch(rules({ cpuLevel: 1 }), 1, seed));
      play(s, [true, true, true, true, true], 1, 12000);
      expect(s.phase).toBe('over');
      if (s.result!.reason === 'time') byTime++;
    }
    expect(byTime).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/ai`
Expected: FAIL (stub não joga; `danger.ts` não existe).

- [ ] **Step 3: Implementar `ai/level.ts` e `ai/danger.ts`**

`ai/level.ts`: mover `AiLevel`, `AI_LEVELS` e `aiRoll` do stub de T1 sem mudanças.

`ai/danger.ts`:

```ts
import { CODE, type Bomb, type Flyer, type RoundState } from '../types';
import { CELLS, WRAP_X, WRAP_Y, SUB, cellAt, cellCenter, colAt, colOf, faceStep, inField, inGrid, linAt, linOf } from '../units';
import { BURN_TICKS, CHAIN_DELAY, FLAME_TICKS, KICK_STEPS, PRESSURE_EVERY, PRESSURE_FIRST, fallTicks, rangeOf } from '../constants';
import { BOUNCE, ITEM_FLIGHT, PUNCH, THROW, type Script } from '../tables/flights';
import { isEggCode, isItemCode, playerCell, standing } from '../state';
import { STAGES } from '../stages';
import { pressureSpiral } from '../pressure';
import { pressureTriggerSec } from '../clock';

export const SAFE = 1_000_000;
export interface Hazard { at: Int32Array; end: Int32Array }
export interface Extra { cell: number; fire: number; pierce: boolean; t?: number }

/** Casas atingidas por uma explosão em `cell` (mesmas regras de explodeBomb) e as bombas alcançadas (cadeia). */
export function crossCells(s: RoundState, cell: number, fire: number, pierce: boolean): { cells: number[]; bombs: number[] } {
  const cells = [cell], bombs: number[] = [];
  const range = rangeOf(fire);
  for (const face of [0, 2, 4, 6]) {
    let c = cell;
    for (let k = 1; k <= range; k++) {
      c = faceStep(c, face);
      if (!inGrid(colOf(c), linOf(c))) break;
      const v = s.grid[c];
      if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) break;
      if (v === CODE.BOMB) { bombs.push(c); break; }
      cells.push(c);
      if (v === CODE.SOFT) { if (pierce) continue; break; }
      if (isItemCode(v)) break;
    }
  }
  return { cells, bombs };
}

function fuseTicks(s: RoundState, b: Bomb): number {
  if (b.chainAt) return Math.max(1, b.chainAt - s.tick);
  const st = STAGES[s.stage]?.fuseStep?.(s, b) ?? 1;
  return st >= 2 ? Math.ceil(b.fuse / 2) + 1 : st === 0 ? 2 * b.fuse + 1 : b.fuse + 1;
}

/** Previsão do deslize (mesmas paradas de slideStep, jogadores nas posições atuais). */
export function kickPath(s: RoundState, b: Bomb): { cell: number; t: number; trail: number[] } {
  let cell = b.cell, dir = b.dir as number, stepN = b.step, turn = b.turn;
  let t = fuseTicks(s, b);
  const hint = STAGES[s.stage]?.ai?.kickEnd?.(s, b.cell, b.dir);
  if (hint != null) return { cell: hint, t, trail: [b.cell, hint] };
  const trail = [cell];
  for (let o = 1; o <= t; o++) {
    if (stepN === 0) {
      const next = faceStep(cell, dir);
      const v = s.grid[next] ?? CODE.HARD;
      const blocked = (v & 0x8400) !== 0 || isEggCode(v)
        || s.bombs.some(x => x !== b && x.cell === next && x.state === 'idle')
        || s.players.some(q => standing(q) && playerCell(q) === next);
      if (blocked) return { cell, t, trail };
      if (v === CODE.FLAME) t = Math.min(t, o + 1);
    }
    if (++stepN === KICK_STEPS) {
      stepN = 0; cell = faceStep(cell, dir); trail.push(cell);
      if (turn >= 0) { dir = turn; turn = -1; }
    }
  }
  return { cell, t, trail };
}

function scriptOf(f: Flyer): Script {
  if (f.flight === 'punch') return PUNCH[f.dir];
  if (f.flight === 'bounce') return BOUNCE[f.dir];
  if (f.flight === 'item') return ITEM_FLIGHT[f.script].script;
  return THROW[Number(f.flight.slice(5)) as 2 | 3 | 4 | 5][f.dir];
}

/** Casa e offset de pouso de um voador (até 8 quiques, regras de T8). */
export function flightEnd(s: RoundState, f: Flyer): { cell: number; t: number } {
  let x = f.x, y = f.y, i = f.i, sc = scriptOf(f), t = 0;
  for (let bounces = 0; bounces <= 8; bounces++) {
    for (; i < sc.length; i++, t++) {
      const [dx, dy] = sc[i];
      x += dx * SUB; if (f.dir === 0 || f.dir === 2) y += dy * SUB;
      const col = colAt(x), lin = linAt(y);
      if (col > 16) x -= WRAP_X; else if (col < 0) x += WRAP_X;
      if (lin > 12) y -= WRAP_Y; else if (lin < 0) y += WRAP_Y;
    }
    const cell = cellAt(x, y);
    const v = cell >= 0 && inField(colOf(cell), linOf(cell)) ? s.grid[cell] : CODE.HARD;
    const player = s.players.some(q => standing(q) && playerCell(q) === cell);
    if (!player && (v === CODE.FLOOR || v === CODE.FLAME || v === CODE.BURNING)) return { cell, t };
    [x, y] = cellCenter(cell); sc = BOUNCE[f.dir]; i = 0;
  }
  return { cell: cellAt(x, y), t };
}

/** Casa → offset de pouso do bloco de pressão (prevê o gatilho pelo relógio). */
export function pressureCells(s: RoundState): Map<number, number> {
  const pr = s.pressure, out = new Map<number, number>();
  let T = pr.trigger;
  if (T < 0) {
    const trig = pressureTriggerSec(s.rules.timeIdx), c = s.clock;
    if (c.sec >= 600 || c.sec <= trig) return out;
    T = s.tick + (c.sec - trig - 1) * 60 + c.sub;
  }
  for (const f of pr.falling) out.set(f.cell, f.land - s.tick);
  const sp = pressureSpiral();
  for (let k = pr.next; k < pr.total; k++) {
    const at = T + PRESSURE_FIRST + PRESSURE_EVERY * k;
    if (at <= s.tick) continue;
    const c = sp[k], v = s.grid[c];
    if (v === CODE.HARD || v === CODE.PRESSURE) continue;
    out.set(c, at + fallTicks(linOf(c)) - s.tick);
  }
  return out;
}

/** Offset em que cada casa BURNING volta a ser passável (0 = já é). */
export function blockedUntil(s: RoundState): Int32Array {
  const out = new Int32Array(CELLS);
  for (let c = 0; c < CELLS; c++) if (s.grid[c] === CODE.BURNING) out[c] = s.cellT0[c] + BURN_TICKS + 1 - s.tick;
  return out;
}

interface Blast { cell: number; t: number; fire: number; pierce: boolean; trail: number[]; perm?: boolean }

export function hazards(s: RoundState, forSlot = -1, extra?: Extra): Hazard {
  const at = new Int32Array(CELLS).fill(SAFE), end = new Int32Array(CELLS).fill(0);
  const mark = (c: number, a: number, e: number): void => { at[c] = Math.min(at[c], a); end[c] = Math.max(end[c], e); };
  const blasts: Blast[] = [];
  for (const b of s.bombs) {
    if (b.state === 'held') continue;
    if (b.type === 1 && !b.chainAt) { if (b.owner === forSlot && !b.bad) continue; blasts.push({ cell: b.cell, t: 0, fire: b.fire, pierce: false, trail: [], perm: true }); continue; }
    if (b.state === 'kicked') { const k = kickPath(s, b); blasts.push({ cell: k.cell, t: k.t, fire: b.fire, pierce: b.type === 2, trail: k.trail }); continue; }
    if (b.state === 'air') {
      const f = s.flyers.find(x => x.kind === 'bomb' && x.ref === b.id);
      if (!f) continue;
      const e = flightEnd(s, f);
      blasts.push({ cell: e.cell, t: e.t + b.fuse + 1, fire: b.fire, pierce: b.type === 2, trail: [] });
      continue;
    }
    blasts.push({ cell: b.cell, t: fuseTicks(s, b), fire: b.fire, pierce: b.type === 2, trail: [] });
  }
  if (extra) blasts.push({ cell: extra.cell, t: extra.t ?? 127, fire: extra.fire, pierce: extra.pierce, trail: [] });
  const crosses = blasts.map(x => crossCells(s, x.cell, x.fire, x.pierce));
  for (let changed = true, guard = 0; changed && guard <= blasts.length; guard++) {
    changed = false;
    blasts.forEach((a, ia) => {
      for (const bc of crosses[ia].bombs) blasts.forEach(b => {
        if (b.cell === bc && b.t > a.t + CHAIN_DELAY) { b.t = a.t + CHAIN_DELAY; changed = true; }
      });
    });
  }
  blasts.forEach((b, k) => { for (const c of crosses[k].cells.concat(b.trail)) mark(c, b.t + 1, b.perm ? SAFE : b.t + 1 + FLAME_TICKS); });
  for (let c = 0; c < CELLS; c++) if (s.grid[c] === CODE.FLAME) mark(c, 1, s.cellT0[c] + FLAME_TICKS + 1 - s.tick);
  for (const [c, land] of pressureCells(s)) mark(c, land + 1, SAFE);
  const extraDanger = STAGES[s.stage]?.ai?.danger?.(s);
  if (extraDanger) for (const [c, o] of extraDanger) mark(c, o, o + FLAME_TICKS);
  return { at, end };
}

export function dangerMap(s: RoundState, forSlot = -1, extra?: Extra): Int32Array {
  return hazards(s, forSlot, extra).at;
}
```

(Remota de adversário: `t = 0` → `at = 1`: perigo imediato e permanente enquanto ela existir.)

- [ ] **Step 4: Portar `nav.ts`, `brain.ts` e `index.ts`**

Copiar de `src/legacy-core/ai.ts` as funções `heapPush`, `heapPop`, `search`, `route`, `exits`, `refuge`, `escape`, `hasRefuge`, `standing`, `mate`, `foeCells`, `bombUseful`, `enemiesNear`, `tryBomb`, `waryEscape`, `ownBombs`, `think`, `steer` e `aiInputs`, aplicando as regras do porte acima e estas trocas mecânicas:

| Legado | Núcleo novo |
|---|---|
| `idx(gx, gy)`, `cellX(p.x)`, `cellY(p.y)` | `cellOf(col, lin)`, `playerCell(p)` |
| `s.arena.cells[i] === CELL.HARD/SOFT` | `blockedFor(p, s.grid[i])[0]` (andar) e `crossCells` (chama) |
| `s.arena.items[i] !== ITEM.NONE` | `isItemCode(s.grid[i]) && !isEggCode(s.grid[i])` (ovos: `MOUNTS.current.ai?.eggValue`, T20) |
| `s.arena.flame[i]` | `s.grid[i] === CODE.FLAME` (já dentro de `hazards`) |
| `p.alive && p.dying === 0` | `standing(p)` |
| `s.frame` | `s.tick` |
| `FUSE_FRAMES` | 127 (via `Extra.t` padrão) |
| `speedSub(p)`, `T`, `MOVE_BOMB_SUB` | `ticksPerCell(s, p)` |
| `flameRange(p)`, `p.pierce` | `bombFireOf(p)`, `p.bombType === 2` |
| `PRESSURE_LEAD`, `pressureOrder` | `pressureCells(s)` (cronograma exato) |
| `hits(hz, i, from, to, margin)` | mesma fórmula com `[at, end)` desta tarefa |
| `BTN` da direção + `A` | `steer(...)`; A só na borda (`lastOut`) |

`ai/index.ts` reexporta `AI_LEVELS`, `aiRoll`, `SAFE`, `dangerMap` e define `AiState` com `lastOut: number[]`. O `core/index.ts` já exporta `./ai`.

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/core/ai && npx vitest run && npx tsc --noEmit`
Expected: PASS. Se o `sim.test.ts` falhar só pela contagem de empates, ajuste a agressividade **sem** mexer no núcleo (como no plano 4: `hunt` na pressão também para o Fraco).

- [ ] **Step 6: Commit**

```bash
git add web/src/core/ai web/tests/core/ai
git commit -m "$(cat <<'MSG'
feat(core): IA portada para o núcleo fiel — perigo com pavio 127, chama 25, cadeia +2 e cronograma da pressão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 18: Entrada — botão X (e L, R, SELECT no gamepad)

**Possui:** `web/src/input/input.ts`, a linha de `ACTION_LABEL` em `web/src/screens/settings-screen.ts` (decisão 2), `web/tests/client/input-loop.test.ts`.

**Interfaces:**
- Consumes: `BTN` do núcleo novo (`X`, `L`, `R`, `SELECT`).
- Produces: `KeyMap` com `x`; `KEY_FIELDS = ['up','down','left','right','a','b','y','x','start']`; `DEFAULT_KEYMAPS` com `x: 'KeyI'` (P1) e `x: 'Numpad5'` (P2); gamepad *standard*: A = 1, B = 0, Y = 2, X = 3, L = 4, R = 5, SELECT = 8, START = 9, direcional 12–15 ou eixo esquerdo (§2.6).

- [ ] **Step 1: Acrescentar os testes** ao fim de `web/tests/client/input-loop.test.ts` (e trocar o import de `BTN` para `'../../src/core'`)

```ts
describe('botão X e botões extras (§2.6)', () => {
  it('teclado: I (P1) e Numpad5 (P2) = X', () => {
    expect(readKeyMap(new Set(['KeyI']), DEFAULT_KEYMAPS[0])).toBe(BTN.X);
    expect(readKeyMap(new Set(['Numpad5']), DEFAULT_KEYMAPS[1])).toBe(BTN.X);
  });
  it('gamepad standard: X = 3, L = 4, R = 5, SELECT = 8', () => {
    const pad = (i: number) => ({ buttons: Array.from({ length: 16 }, (_, k) => ({ pressed: k === i })), axes: [0, 0] });
    expect([readGamepad(pad(3)), readGamepad(pad(4)), readGamepad(pad(5)), readGamepad(pad(8))]).toEqual([BTN.X, BTN.L, BTN.R, BTN.SELECT]);
  });
  it('X entra na lista de remapeamento sem mudar o índice de B', () => {
    expect(KEY_FIELDS).toEqual(['up', 'down', 'left', 'right', 'a', 'b', 'y', 'x', 'start']);
  });
});
```

(Acrescentar `KEY_FIELDS` ao import de `../../src/input/input` no topo do arquivo.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/client/input-loop.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `src/input/input.ts`: `import { BTN } from '../core';`; `KeyMap` ganha `x: string`; `KEY_FIELDS` como acima; `DEFAULT_KEYMAPS[0].x = 'KeyI'`, `DEFAULT_KEYMAPS[1].x = 'Numpad5'`; em `readKeyMap`, `if (down.has(m.x)) v |= BTN.X;`; em `readGamepad`, depois do `Y`: `if (b(3)) v |= BTN.X; if (b(4)) v |= BTN.L; if (b(5)) v |= BTN.R; if (b(8)) v |= BTN.SELECT;`. O comentário do layout vira `A = 1, B = 0, Y = 2, X = 3, L = 4, R = 5, SELECT = 8, START = 9, d-pad 12–15`.
Em `src/screens/settings-screen.ts`, `ACTION_LABEL` ganha `x: 'X',` depois de `y`. (`normalizeKeyMap` em `app/settings.ts` já completa `x` com o padrão para configurações salvas antigas, porque parte de `{ ...def }`.)

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/input/input.ts web/src/screens/settings-screen.ts web/tests/client/input-loop.test.ts
git commit -m "$(cat <<'MSG'
feat(input): botão X no teclado (I / Numpad5) e X, L, R, SELECT no gamepad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
### Task 19: Sessão e render de fallback no núcleo novo

**Possui:** `web/src/game/session.ts`, `web/src/game/config.ts` (import e `spawns`), `web/src/app/{tick,settings}.ts` (import), a linha de import de `web/src/screens/{characters,menu,settings-screen,stage}.ts`, `web/src/render/{draw-game,view,draw-screens,sprite-bank}.ts`, `web/src/render/art/**`, `web/scripts/snapshots.mjs` (2 linhas), `web/tests/client/{session,tick,screens,menu,art,draw-game,view}.test.ts`.

Sessão e render andam juntos porque `draw-screens.ts` desenha `session.round`: separar deixaria um dos lados com o tipo errado.

**Interfaces:**
- Consumes: núcleo integrado (T16), `aiInputs` (T17, pode estar em andamento: com o stub as CPUs ficam paradas), `fallbackLayers` e `layers-index` (T1).
- Produces: sessão com `round.phase === 'over'` → `roundOver`; constantes `ROUND_OVER_FRAMES = 63` (fade 15 + preto 48), `SCOREBOARD_FRAMES = 512` (fade-in 15 + 497), `SKIP_AFTER = 19` (15 + 4); `drawRound` lendo a grade de códigos, `cellAux`, `bombs`, `flyers`, `bad`; `ViewState { roundKey; walk; lastPos }` (as explosões saem da visão: a chama vem da grade); `formatClock(clock)`; `dyingVisible(age)`; `itemIcon(id)` pelos IDs da ROM.

- [ ] **Step 1: Trocar os imports de volta para o núcleo**

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
grep -rl "legacy-core'" src/app src/game src/screens src/render tests/client | xargs sed -i '' "s#legacy-core'#core'#"
grep -rn "legacy-core" src tests/client          # esperado: nada fora de src/legacy-core
```

- [ ] **Step 2: Atualizar os testes do cliente**

`tests/client/session.test.ts`:
- import: `import { BTN, INTRO_TICKS } from '../../src/core';` e troque todo `INTRO_FRAMES + 1` por `INTRO_TICKS`;
- `winRound` passa a ser:

```ts
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_TICKS);
  s.round.players.forEach((p, i) => { if (i !== winner && p.present) p.state = 'out'; });
  for (let i = 0; i < 400 && s.phase === 'battle'; i++) updateSession(s, idle);
};
```

- em "padrões": `[3, 2, false, 'ffa']` (spawns aleatórios agora vêm desligados, §6.13);
- em "começa em batalha": `expect(s.round.phase).toBe('play')`;
- em "START pausa e retoma": `s.round.frame` → `s.round.tick` (duas vezes);
- em "modo time": `s.round.players.forEach(p => { if (p.team !== 0) p.state = 'out'; }); for (let i = 0; i < 400 && s.phase === 'battle'; i++) updateSession(s, idle);` no lugar de `run(s, 1)`;
- em "empate por tempo esgotado": `s.round.clock = { sec: 1, sub: 1 }; for (let i = 0; i < 400 && s.phase === 'battle'; i++) updateSession(s, idle);` no lugar de `s.round.timeLeft = 1; run(s, 1);`.

`tests/client/tick.test.ts` (substituir o `it` inteiro):

```ts
import { tickGame } from '../../src/app/tick';
import { createSession } from '../../src/game/session';
import { createView } from '../../src/render/view';
import { parseConfig } from '../../src/game/config';
import { BTN, INTRO_TICKS } from '../../src/core';

const idle = [0, 0, 0, 0, 0];

describe('tickGame', () => {
  it('não avança o núcleo nem a visão durante a pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    const v = createView();
    for (let i = 0; i < INTRO_TICKS; i++) tickGame(s, v, idle);
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]); tickGame(s, v, idle);
    expect(s.paused).toBe(true);
    const t = s.round.tick;
    for (let i = 0; i < 60; i++) { tickGame(s, v, idle); expect(s.stepped).toBe(false); }
    expect(s.round.tick).toBe(t);
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]); tickGame(s, v, idle);
    expect(s.round.tick).toBeGreaterThan(t);
  });
});
```

`tests/client/screens.test.ts`: import `INTRO_TICKS` no lugar de `INTRO_FRAMES`; no teste "formação com humanos", `idle(app, INTRO_TICKS);`, `s.round.players.forEach((p, i) => { if (i !== 0) p.state = 'out'; });` e `idle(app, 140);` no lugar de `idle(app, 1);` (2 ticks até decidir + 128 de comemoração).

`tests/client/menu.test.ts`: nada além do import (Step 1).

`tests/client/art.test.ts`, teste "8 ícones 16×16 com borda opaca" vira:

```ts
  it('ícones 16×16 com borda opaca para todos os itens do Battle (IDs da ROM)', () => {
    for (const id of [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x11, 0x12, 0x21, 0x2b, 0x30, 0x3f]) {
      const p = itemIcon(id);
      expect([p.w, p.h]).toEqual([16, 16]);
      expect(alphaAt(p, 0, 0)).toBe(255);
      expect(alphaAt(p, 15, 15)).toBe(255);
    }
  });
```

`tests/client/view.test.ts` (substituir inteiro):

```ts
import { createView, updateView, walkFrame, flameShrink, flamePart, formatClock, dyingVisible, roundOverText } from '../../src/render/view';
import { createRound, makeRng, defaultRules, FLAME_PIECE } from '../../src/core';

describe('visão', () => {
  it('peças da chama a partir de cellAux', () => {
    expect([FLAME_PIECE.CENTER, FLAME_PIECE.ARM_UP, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.TIP_UP, FLAME_PIECE.TIP_DOWN, FLAME_PIECE.TIP_LEFT, FLAME_PIECE.TIP_RIGHT].map(flamePart))
      .toEqual(['center', 'v', 'h', 'up', 'down', 'left', 'right']);
  });
  it('a chama afina no começo e no fim dos 25 ticks', () => {
    expect([flameShrink(0), flameShrink(2), flameShrink(10), flameShrink(18), flameShrink(21), flameShrink(24)]).toEqual([2, 1, 0, 1, 2, 2]);
  });
  it('contador de caminhada sobe quando o jogador se move e zera parado', () => {
    const r = createRound(1, defaultRules(), makeRng());
    const v = createView();
    updateView(v, r, []);
    r.players[0].x += 256; updateView(v, r, []);
    expect(v.walk[0]).toBe(1);
    updateView(v, r, []);
    expect(v.walk[0]).toBe(0);
  });
  it('quadro de caminhada', () => {
    expect([walkFrame(0), walkFrame(8), walkFrame(16), walkFrame(24)]).toEqual([0, 0, 2, 0]);
  });
  it('relógio da ROM', () => {
    expect(formatClock({ sec: 180, sub: 51 })).toBe('3:00');
    expect(formatClock({ sec: 1801, sub: 1 })).toBe('30:01');
  });
  it('morrendo: pisca nos ticks 1..21 e some depois', () => {
    expect([dyingVisible(1), dyingVisible(4), dyingVisible(16), dyingVisible(22), dyingVisible(60)]).toEqual([true, false, true, false, false]);
  });
  it('texto de fim de rodada', () => {
    expect(roundOverText([], 'ffa', [0, 1, 0, 1, 0])).toBe('EMPATE!');
    expect(roundOverText([2], 'ffa', [0, 1, 0, 1, 0])).toBe('P3 VENCEU!');
  });
});
```

`tests/client/draw-game.test.ts`: manter `fakeBank`/`fakeCtx`/`findTag`, trocar `newRound({})` por `createRound(1, defaultRules(), makeRng())` (de `../../src/core`) e o bloco de imports por:

```ts
import { drawRound, PLAYER_COLORS } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import { createRound, makeRng, defaultRules, CODE, cellOf } from '../../src/core';
import type { SpriteBank } from '../../src/render/sprite-bank';
```

e acrescentar:

```ts
describe('drawRound: grade de códigos', () => {
  it('desenha chama, soft, item e bomba pelas casas da ROM (x = 16·col − 8, y = 16·lin + 24)', () => {
    const round = createRound(1, defaultRules(), makeRng());
    round.grid[cellOf(4, 1)] = CODE.FLAME; round.cellT0[cellOf(4, 1)] = round.tick;
    const view = createView(); updateView(view, round, []);
    const ctx = fakeCtx();
    drawRound(ctx, round, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    expect(ctx.calls.some(c => c.x === 16 * 4 - 8 && c.y === 16 * 1 + 24)).toBe(true);
  });
});
```

(Nos testes existentes de etiqueta, a checagem "morrendo esconde a etiqueta" usa `p.state = 'dying'; p.hitT0 = round.tick` no lugar de `p.dying = …`.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/client`
Expected: FAIL (sessão e render ainda no formato antigo).

- [ ] **Step 4: Adaptar `session.ts`**

Mudanças no arquivo atual (o resto fica igual):

```ts
import { BTN, createMatch, startRound, finishRound, step, createAi, aiInputs, type AiState, type GameEvent, type MatchState, type RoundState } from '../core';

/** Fim de rodada → placar: fade-out 15 + preto 48 (§6.10). O plano 10 troca pelas telas com brilho. */
export const ROUND_OVER_FRAMES = 63;
export const SCOREBOARD_FRAMES = 512;   // fade-in 15 + 497
export const SKIP_AFTER = 19;           // fade-in 15 + 4
```

- `createSession`: `const match = createMatch(cfg.rules, cfg.stage, seed & 0xffff, cfg.chars);`
- no caso `'battle'`: `if (s.round.phase === 'over') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }`.

Em `config.ts`: `randomSpawns: q.get('spawns') === '1',` (padrão Não) e o comentário da URL passa a dizer `&spawns=1`.

- [ ] **Step 5: Reescrever `view.ts`**

```ts
import { FLAME_PIECE, FLAME_TICKS, clockText, type GameEvent, type RoundState } from '../core';
import type { FlamePart } from './art/flames';
import { displayName } from '../game/config';

export interface ViewState { roundKey: RoundState | null; walk: number[]; lastPos: [number, number][] }

export function createView(): ViewState {
  return { roundKey: null, walk: [0, 0, 0, 0, 0], lastPos: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
}

/** Atualiza a visão depois de um tick do núcleo. A chama vem da grade; aqui só o ritmo de caminhada. */
export function updateView(v: ViewState, round: RoundState, _events: GameEvent[]): void {
  if (v.roundKey !== round) { v.roundKey = round; v.walk = [0, 0, 0, 0, 0]; v.lastPos = round.players.map(p => [p.x, p.y] as [number, number]); }
  round.players.forEach((p, i) => {
    const [lx, ly] = v.lastPos[i];
    v.walk[i] = p.x !== lx || p.y !== ly ? v.walk[i] + 1 : 0;
    v.lastPos[i] = [p.x, p.y];
  });
}

const WALK_SEQ = [1, 0, 2, 0];
export function walkFrame(counter: number): number { return counter === 0 ? 0 : WALK_SEQ[(counter >> 3) & 3]; }

/** Afinamento da arte de fallback pela idade da chama (0..24). */
export function flameShrink(age: number): number {
  if (age < 2) return 2;
  if (age < 4) return 1;
  const left = FLAME_TICKS - 1 - age;
  if (left <= 3) return 2;
  if (left <= 7) return 1;
  return 0;
}

const PART: Record<number, FlamePart> = {
  [FLAME_PIECE.CENTER]: 'center', [FLAME_PIECE.ARM_UP]: 'v', [FLAME_PIECE.ARM_DOWN]: 'v', [FLAME_PIECE.ARM_LEFT]: 'h',
  [FLAME_PIECE.ARM_RIGHT]: 'h', [FLAME_PIECE.TIP_UP]: 'up', [FLAME_PIECE.TIP_DOWN]: 'down', [FLAME_PIECE.TIP_LEFT]: 'left',
  [FLAME_PIECE.TIP_RIGHT]: 'right',
};
export const flamePart = (piece: number): FlamePart => PART[piece] ?? 'center';

export function formatClock(clock: { sec: number; sub: number }): string { return clockText(clock); }

/** `age` = ticks desde o acerto: pisca de 4 em 4 até o 21 e depois some (§3.10). */
export function dyingVisible(age: number): boolean {
  if (age > 21) return false;
  return ((age >> 2) & 1) === 0;
}

export function roundOverText(winners: number[], mode: 'ffa' | 'team', teams: number[], names: readonly string[] = []): string {
  if (winners.length === 0) return 'EMPATE!';
  if (mode === 'team') return teams[winners[0]] === 0 ? 'TIME VERMELHO VENCEU!' : 'TIME BRANCO VENCEU!';
  return `${displayName(names, winners[0])} VENCEU!`;
}
```

(`left = 24 − age`: afina nos 4 primeiros e nos 8 últimos ticks.)

- [ ] **Step 6: Reescrever `drawRound` em `draw-game.ts`**

`drawTextCentered`, `PLAYER_COLORS`, `TEAM_TAG_COLORS` e `HUD_BOTTOM` ficam. Novo corpo:

```ts
import { BURN, CODE, GRID_H, GRID_W, cellOf, isItemCode, itemOfCode, px, invisibleVisible, clockText, type RoundState } from '../core';
import { fallbackLayers } from './battle-layers';
import './layers-index';
// …

const tileX = (col: number) => 16 * col - 8;
const tileY = (lin: number) => 16 * lin + 24;
const FACE_TO_DIR = [1, 0, 4, 0, 2, 0, 3];      // face 0/2/4/6 → DIR da arte (1 cima, 4 direita, 2 baixo, 3 esquerda)

export function drawHud(ctx: CanvasRenderingContext2D, round: RoundState, bank: SpriteBank, chars: number[], crowns: number[]): void {
  // … moldura igual …
  const clock = bank.plainText(clockText(round.clock), '#ffffff');
  // … rostos: `if (!p.present) return;` e `ctx.globalAlpha = p.state === 'alive' ? 1 : 0.35;` …
}

export function drawRound(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank,
  chars: number[], frame: number, crowns: number[]): void {
  const tiles = bank.tiles(round.stage);
  ctx.fillStyle = tiles.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 0; col < GRID_W; col++) {
    const c = cellOf(col, lin), v = round.grid[c];
    const x = tileX(col), y = tileY(lin);
    const border = col <= 1 || col >= 15 || lin === 0 || lin === 12;
    const base = border ? tiles.wall : v === CODE.HARD || v === CODE.PRESSURE ? tiles.hard : (col + lin) % 2 ? tiles.floorAlt : tiles.floor;
    ctx.drawImage(base, x, y);
    if (border) continue;
    if (v === CODE.SOFT) ctx.drawImage(tiles.soft, x, y);
    else if (v === CODE.BURNING) ctx.drawImage(round.cellAux[c] === BURN.SOFT ? tiles.burning[(frame >> 2) & 1] : tiles.burning[1], x, y);
    else if (isItemCode(v)) ctx.drawImage(bank.item(itemOfCode(v)), x, y);
    else if (v === CODE.FLAME) ctx.drawImage(bank.flame(flamePart(round.cellAux[c]), flameShrink(round.tick - round.cellT0[c])), x, y);
    else if (v === CODE.FALLING) { ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x + 2, y + 10, 12, 5); }
  }
  for (const l of fallbackLayers) l.draw(round, ctx, bank, frame);
  for (const b of round.bombs) {
    if (b.state === 'idle' || b.state === 'kicked') ctx.drawImage(bank.bomb((frame >> 3) & 1), px(b.x) - 7, px(b.y) - 7);
  }
  for (const f of round.flyers) {
    const img = f.kind === 'bomb' ? bank.bomb(0) : bank.item(f.ref);
    ctx.drawImage(img, px(f.x) - 7, px(f.y) + f.z - 7);
  }
  const shown = round.players.filter(p => p.present && (p.state === 'alive' || p.state === 'dying')).sort((p, q) => p.y - q.y || p.slot - q.slot);
  for (const p of shown) {
    if (p.state === 'dying' && !dyingVisible(round.tick - p.hitT0)) continue;
    if (p.state === 'alive' && (!invisibleVisible(p) || (p.inv & 2) !== 0)) continue;
    const sx = px(p.x) - 7, sy = px(p.y) - 11;
    const frameIdx = p.state === 'dying' ? 0 : walkFrame(view.walk[p.slot]);
    ctx.drawImage(bank.bomber(chars[p.slot], FACE_TO_DIR[p.face], frameIdx), sx, sy);
    if (p.carry >= 0) ctx.drawImage(bank.bomb(0), sx, sy - 12);
    if (p.state === 'alive') {
      const color = round.rules.mode === 'team' ? TEAM_TAG_COLORS[p.team] : PLAYER_COLORS[p.slot];
      const tag = bank.text(`${p.slot + 1}P`, color);
      ctx.drawImage(tag, sx + 8 - Math.floor(tag.width / 2), Math.max(HUD_BOTTOM, sy - 9));
    }
  }
  ctx.globalAlpha = 0.7;
  for (const b of round.bad) ctx.drawImage(bank.bomber(chars[b.slot], FACE_TO_DIR[b.face], 0), b.x - 8, b.y - 12);
  ctx.globalAlpha = 1;
  drawHud(ctx, round, bank, chars, crowns);
}
```

(Imports de `view.ts`: `flameShrink`, `flamePart`, `walkFrame`, `dyingVisible`, `type ViewState`.)

- [ ] **Step 7: Adaptar `draw-screens.ts`, `art/items.ts` e `snapshots.mjs`**

`draw-screens.ts`:
- placar: `if (!p.present) return;`;
- tira a linha do texto de intro (`PRONTOS?/JÁ!`): a ROM não tem READY/GO (§6.8);
- no `roundOver`: `const r = s.round.result; drawTextCentered(ctx, bank, roundOverText(r?.winner != null ? [r.winner] : [], s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 100, 2);`.

`art/items.ts` — `itemIcon(id)` passa a receber o ID da ROM:

```ts
import { textPix } from './font';

/** ID da ROM → ícone desenhado (1..8 = os de antes). */
const LEGACY: Record<number, number> = { 0x01: 1, 0x03: 2, 0x05: 3, 0x0e: 4, 0x0d: 6, 0x07: 7, 0x02: 8 };
/** Os demais: placa com uma letra. */
const LETTER: Record<number, [string, string]> = {
  0x04: ['F', '#ff3b1a'], 0x06: ['R', '#2d6bff'], 0x08: ['V', '#ffd23f'], 0x09: ['C', '#ff4f7a'], 0x0a: ['S', '#8f5cff'],
  0x0b: ['B', '#28c2b0'], 0x0c: ['T', '#6ad0ff'], 0x0f: ['J', '#ffb000'], 0x11: ['E', '#ffffff'], 0x12: ['P', '#ff7a1a'],
};

export function itemIcon(id: number): Pix {
  if (id >= 0x21 && id <= 0x2c) return legacyIcon(5);
  if (LEGACY[id]) return legacyIcon(LEGACY[id]);
  const [ch, bg] = id >= 0x30 && id <= 0x3f ? ['O', '#f0e6c8'] : LETTER[id] ?? ['X', '#888888'];
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, '#0b0b14');
  fillRect(p, 1, 1, 14, 14, '#ffffff');
  fillRect(p, 2, 2, 12, 12, bg);
  const g = textPix(ch, '#0b0b14', null);
  blit(p, g, Math.floor((16 - g.w) / 2), Math.floor((16 - g.h) / 2));
  return p;
}
```

(A função antiga vira `function legacyIcon(item: number): Pix` com o mesmo corpo; `textPix(s, color, null)` é a assinatura já usada por `sprite-bank.plainText`.)

`scripts/snapshots.mjs`: `window.__crown.session.round.arena.flame.some(f => f > 20)` → `window.__crown.session.round.grid.some(v => v === 0x1000)`; `if (i !== 2) p.alive = false;` → `if (i !== 2) p.state = 'out';`.

- [ ] **Step 8: Rodar tudo e as screenshots**

Run: `npx vitest run && npx tsc --noEmit && npm run build && npm run snap`
Expected: testes e build verdes; `web/snapshots/*.png` gerados. Conferir à vista: `11-battle.png` e `12-explosion.png` com a grade 17×13 alinhada ao HUD, chama em cruz, bomba no centro da casa; `20-stage5.png` sem soft blocks; `21-stage8.png` sem blocos (pads e camadas das arenas vêm no plano 8).

- [ ] **Step 9: Commit**

```bash
git add web/src web/tests/client web/scripts/snapshots.mjs
git commit -m "$(cat <<'MSG'
feat(client): sessão e arte de fallback sobre o núcleo fiel (grade 17×13, códigos da ROM, itens novos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---
## Onda 5

### Task 20: IA — ações, doenças, pressão, Bad Bomber, dicas e aceite da §9

**Possui:** `web/src/core/ai/**` (menos `hints.ts`), `web/tests/core/ai/{actions,accept}.test.ts`.

**Interfaces:**
- Consumes: IA de T17; `crossCells`, `kickPath`, `hazards`; `STAGES[n].ai` e `MOUNTS.current.ai` (`AiStageHints`, `AiMountHints`); `aimThrow`; `swapDirs` equivalente (a IA inverte a própria saída quando doente de `$2A` ou com efeito `$0A`, porque o núcleo inverte de novo).
- Produces: `ai/actions.ts` → `decideActions(s, p, level, brain, ai): number` (bits de botão somados à direção do `steer`); `ai/bad.ts` → `badInputs(s, slot, level): number`; `aiInputs` passa a chamar os dois; `hazards` e `think` passam a usar as dicas.

Regras de decisão (cada uma só quando a fuga continua garantida pelo mapa de perigo):
1. **Soco (Y):** tem Soco, bomba parada na casa da frente, e a casa de pouso (3 casas adiante, com volta pela borda) tem adversário de pé, ou o soco tira a bomba da rota de fuga.
2. **Golpe P (Y):** tem P, adversário na casa da frente, e o destino do empurrão (até 3 casas, parando antes de sólido) é letal em até 30 ticks pelo `hazards` (chama prevista ou pressão).
3. **Luva:** parado sobre a própria bomba recém-colocada e `aimThrow` ≤ 4 (há alvo): A de novo, segura ao menos 4 ticks e solta mirando; senão não levanta.
4. **Chute:** a navegação trata a casa da bomba vizinha como passável quando `p.kick` e o `kickPath` resultante não cruza a rota de fuga; `hazards` já prevê a bomba chutada.
5. **X:** bomba chutada pela CPU cuja cruz, na casa atual, pega um adversário de pé → X.
6. **B:** remota própria cuja cruz pega um adversário e não pega a CPU (nem a rota dela nos próximos 25 ticks) → B.
7. **Doenças:** caveira no chão vale −∞ como objetivo (não pega); doente de qualquer coisa, persegue contato com adversário (objetivo = casa do adversário, sem bomba); `$24`/`$25`: não planeja bombas; `$2A` ou efeito `$0A`: inverte a saída; `$26`: quando parar é necessário, manda a direção oposta por 1 tick.
8. **Pressão:** casas de `pressureCells` com pouso em até 120 ticks nunca são destino.
9. **Bad Bomber de CPU (`state === 'bad'`):** anda pela moldura até alinhar com um adversário de pé a 2–5 casas para dentro (mesma linha/coluna) e aperta A (borda) quando `live < 0` e `tick ≥ readyAt`.
10. **Dicas:** `avoid` = casas proibidas na navegação; `goals` = objetivos extras com prioridade acima de blocos; `danger` entra em `hazards`; `kickEnd` entra em `kickPath` (T17 já faz); `MOUNTS.current.ai.useY(s, slot)` → Y (borda); `eggValue(s, slot, cell) > 0` torna o ovo objetivo com esse peso.

- [ ] **Step 1: Escrever os testes**

`web/tests/core/ai/actions.test.ts`:

```ts
import { arena, put, setCell, C } from '../kit';
import { play } from './simkit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { crossCells } from '../../../src/core/ai/danger';
import { addBomb } from '../../../src/core/bombs';
import { BTN, CODE } from '../../../src/core/types';
import { itemCode, playerCell } from '../../../src/core/state';
import { STAGES } from '../../../src/core/stages';
import { MOUNTS, NO_MOUNT } from '../../../src/core/mounts';
import { step } from '../../../src/core/step';

const CPU0 = [true, false, false, false, false];

describe('IA: ações (§9.3)', () => {
  it('soco: bomba à frente e adversário no pouso → Y', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.punch = true; p.face = 2; put(s, 1, 8, 3);
    addBomb(s, 1, C(5, 3), { fuse: 90 });
    expect(play(s, CPU0, 2, 12)).toContainEqual({ type: 'punch', slot: 0 });
  });
  it('luva: levanta a própria bomba e arremessa no adversário a 3 casas', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 2; put(s, 1, 7, 3);
    addBomb(s, 0, C(4, 3));
    expect(play(s, CPU0, 2, 40)).toContainEqual({ type: 'throw', slot: 0 });
  });
  it('golpe P: empurra o adversário para dentro de uma explosão', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.pItem = true; p.face = 2; put(s, 1, 5, 3);
    addBomb(s, 1, C(9, 3), { fuse: 15 });
    expect(play(s, CPU0, 2, 10)).toContainEqual({ type: 'p_punch', slot: 0 });
  });
  it('X: para a própria bomba chutada quando a cruz pega um adversário', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 3), { fuse: 120, fire: 1 });
    s.grid[C(5, 3)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0; b.kickedBy = 0;
    play(s, CPU0, 2, 60);
    expect(b.state).toBe('idle');
    expect(crossCells(s, b.cell, b.fire, false).cells).toContain(C(8, 5));
  });
  it('B: detona a remota quando a cruz pega um adversário e não a CPU', () => {
    const s = arena(); put(s, 0, 4, 5); put(s, 1, 8, 3);
    addBomb(s, 0, C(6, 3), { type: 1 });
    expect(play(s, CPU0, 2, 12)).toContainEqual({ type: 'explosion', cell: C(6, 3), owner: 0 });
    expect(s.players[0].state).toBe('alive');
  });
});

describe('IA: doenças e dicas', () => {
  it('não pega caveira', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    setCell(s, 5, 1, itemCode(0x21)); setCell(s, 4, 2, itemCode(0x22));
    play(s, CPU0, 2, 150);
    expect(s.players[0].disease).toBe(0);
  });
  it('doente, procura contato para passar a doença', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x22; put(s, 1, 8, 5);
    expect(play(s, CPU0, 2, 450)).toContainEqual({ type: 'disease_passed', from: 0, to: 1 });
  });
  it('com controles invertidos ($2A) ainda foge da própria bomba', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x2a; put(s, 1, 12, 9);
    addBomb(s, 0, C(4, 1));
    play(s, CPU0, 2, 160);
    expect(s.players[0].state).toBe('alive');
  });
  it('dica da arena: casa em `avoid` nunca é pisada', () => {
    STAGES[1] = { ai: { avoid: () => [C(5, 1)] } };
    try {
      const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
      setCell(s, 6, 1, itemCode(0x03));
      const ai = createAi();
      for (let i = 0; i < 200; i++) { step(s, aiInputs(s, ai, CPU0, 2)); expect(playerCell(s.players[0])).not.toBe(C(5, 1)); }
    } finally { STAGES[1] = {}; }
  });
  it('dica da montaria: useY → Y na borda', () => {
    MOUNTS.current = { ...NO_MOUNT, ai: { useY: () => true } };
    try {
      const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
      const ai = createAi();
      const outs = Array.from({ length: 6 }, () => { const o = aiInputs(s, ai, CPU0, 2); step(s, o); return o[0] & BTN.Y; });
      expect(outs.some(Boolean)).toBe(true);
      expect(outs.every((v, i) => !(v && outs[i - 1]))).toBe(true);   // nunca dois ticks seguidos
    } finally { MOUNTS.current = NO_MOUNT; }
  });
});

describe('IA: Bad Bomber de CPU (§9.7)', () => {
  it('depois de entrar, alinha com um alvo e arremessa', () => {
    const s = arena({ players: 3, rules: { badBomber: true } });
    put(s, 0, 4, 3); put(s, 1, 8, 5); put(s, 2, 12, 9);
    setCell(s, 4, 3, CODE.FLAME); s.cellT0[C(4, 3)] = 100;
    const ev = play(s, CPU0, 2, 1 + 65 + 31 + 250);
    expect(ev).toContainEqual({ type: 'throw', slot: 0 });
  });
});
```

`web/tests/core/ai/accept.test.ts`:

```ts
import { createMatch, startRound } from '../../../src/core/match';
import { play } from './simkit';
import { rules } from '../kit';

/** §9.10: rodadas só de CPUs nas 10 fases terminam; por fase, no máximo 30 % por tempo. */
function batch(perStage: number): void {
  for (let stage = 1; stage <= 10; stage++) {
    let byTime = 0;
    for (let k = 0; k < perStage; k++) {
      const level = k % 3;
      const s = startRound(createMatch(rules({ cpuLevel: level as 0 | 1 | 2 }), stage, 1000 * stage + k));
      play(s, [true, true, true, true, true], level, 12000);
      expect(s.phase, `fase ${stage}, rodada ${k}`).toBe('over');
      if (s.result!.reason === 'time') byTime++;
    }
    expect(byTime / perStage, `fase ${stage}`).toBeLessThanOrEqual(0.3);
  }
}

describe('aceite da IA (§9)', () => {
  it('rápido: 5 rodadas por fase', () => batch(5), 300_000);
  it.skipIf(!process.env.CB_SLOW)('completo: 50 rodadas por fase', () => batch(50), 3_600_000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/ai/actions.test.ts tests/core/ai/accept.test.ts`
Expected: FAIL nos casos de ações novas.

- [ ] **Step 3: Implementar `ai/actions.ts`, `ai/bad.ts` e as dicas**

- `decideActions` roda depois de `think`/`steer`, na ordem B → X → Y (montaria, P, soco) → luva, e devolve no máximo um botão de ação por tick; todos são bordas (`lastOut`).
- Luva: guarde em `Brain` o tick em que levantou (`liftAt`) e mantenha A até `tick ≥ liftAt + 4` e a mira confirmar alvo; solte (A fora da saída) para arremessar.
- `badInputs`: posição do Bad Bomber em `s.bad`; alvo = adversário de pé cuja linha (lado esquerdo/direito) ou coluna (cima/baixo) bate com a posição do Bad Bomber a 2–5 casas para dentro; mova-se na moldura rumo à linha/coluna do alvo mais próximo; ao alinhar e fora dos 16 px dos cantos, A.
- Doenças: em `think`, filtre objetivos de caveira; com doença, adicione o objetivo "casa do adversário mais próximo" com prioridade acima de blocos; para `$24`/`$25`, desligue `tryBomb`; aplique `swapDirs` na saída de `steer` quando `p.disease === 0x2a || p.effect.kind === 0x0a`.
- Dicas: `hazards` já soma `STAGES[n].ai.danger`; em `search`, trate as casas de `avoid` como bloqueadas; em `think`, `goals` entra antes de blocos/adversários; ovos (`isEggCode`) viram objetivo com peso `MOUNTS.current.ai?.eggValue?.(s, slot, cell) ?? 0`.

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/core/ai && npx tsc --noEmit`
Expected: PASS. Depois, uma vez: `CB_SLOW=1 npx vitest run tests/core/ai/accept.test.ts` — PASS (anote o tempo no PR).

- [ ] **Step 5: Commit**

```bash
git add web/src/core/ai web/tests/core/ai
git commit -m "$(cat <<'MSG'
feat(core): IA usa soco, P, luva, chute, X e B, lida com doenças e pressão, joga de Bad Bomber e lê as dicas das arenas/montarias

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 21: Remoção do núcleo antigo

**Possui:** `web/src/legacy-core/**`, `web/tests/legacy-core/**` (apaga).

**Interfaces:**
- Consumes: T18 e T19 já tiraram os últimos imports de `legacy-core`; T17 já portou a IA.
- Produces: repositório sem código morto.

- [ ] **Step 1: Conferir que ninguém importa o legado**

Run: `cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web" && grep -rn "legacy-core" src tests scripts --include=*.ts --include=*.mjs | grep -v "^src/legacy-core\|^tests/legacy-core"`
Expected: nada.

- [ ] **Step 2: Apagar e rodar tudo**

```bash
git rm -r -q src/legacy-core tests/legacy-core
npx vitest run && npx tsc --noEmit && npm run build
```
Expected: verde. A contagem de testes cai pelos antigos de `tests/legacy-core` (cerca de metade dos 238 iniciais; substituídos, ver tabela no topo do plano).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'MSG'
chore(core): remove o núcleo antigo (substituído pelo núcleo fiel)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

## Aceite do plano

Critérios da §11 da spec para o plano 6, com os comandos (em `web/`):

| Critério | Comando / onde |
|---|---|
| Todos os goldens sem ROM da §10.2 | `npx vitest run tests/core` — movimento 20.000 ticks (`movement-golden`), canto `t100` (`movement`), soft e itens das 10 fases + RNG 207 (`setup-golden`), pavio 127 / chama 25 / cadeia +2 / morte 65 (`bombs`, `hit`, `scenarios`), hitbox `t25` (`units`, `hit`), alcance `t64` (`bombs`), chute (`kick`), soco/borda/atordoamento (`flyers`, `scenarios`), luva (`flyers`, `scenarios`), P (`actions`), contágio e `$2B` (`disease`, `scenarios`), pressão (`pressure`), rodada (`round-end`, `clock`, `scenarios`), Bad Bomber (`bad-bomber`, `scenarios`) |
| Testes unitários de cada regra da §3 com os números | um arquivo por módulo em `tests/core/` (tabela "Mapa de arquivos") |
| Determinismo: 2 × 20.000 ticks → mesmo hash | `npx vitest run tests/core/determinism.test.ts` e `tests/core/ai/behavior.test.ts` ("é determinística") |
| IA: aceite da §9 | `npx vitest run tests/core/ai` e `CB_SLOW=1 npx vitest run tests/core/ai/accept.test.ts` (50 rodadas × 10 fases, ≤ 30 % por tempo) |
| Jogo jogável no fallback | `npm run snap` e conferir `web/snapshots/*.png`; `npm run dev` + `?quick&humans=1` jogando com teclado (A/B/X/Y) |
| `facts.test.ts` verde com a ROM | `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/rom` |
| Build e suíte inteira | `npx vitest run && npx tsc --noEmit && npm run build` (sem `SB4_ROM`, os testes de ROM aparecem como *skipped*) |
| Contratos da §2.5 no lugar | `core/hooks.ts`, `core/stages/index.ts`, `core/mounts/index.ts`, `core/ai/hints.ts`, `render/battle-layers.ts`, `render/layers-index.ts` (T1) |
| Nada da ROM no repositório | `git diff --stat main -- web | grep -Ei '\.(sfc|png|bin|spc|brr)$'` vazio; `tests/fixtures/rom/*.json` só com números |

## Riscos

1. **Golden de movimento com *lag*:** o traço conta ticks lógicos por quadro (`TDbg.step` devolve *k* ticks). Se o emulador mostrar divergência em algum quadro, o gerador aborta; aí o problema é de modelo e deve ser investigado com `t33.py` antes de relaxar qualquer teste.
2. **Ordem entre objetos:** a ROM processa bombas, chamas e voadores numa lista única por ordem de criação; aqui é por categoria (bombas → células → voadores → pressão → Bad Bombers → montarias). Casos de borda (bomba pousando no mesmo tick em que uma chama nasce na casa) podem diferir por 1 tick. Os cenários de T16 cobrem os casos medidos; divergências novas vão para a §12 da spec.
3. **Regras provisórias (🟡) com efeito em RNG:** perdas no atordoamento e sorteio de caveira consomem o RNG do jogo; se a ordem real das chamadas diferir (ex.: o `rnd(12)` da direção do voo antes do `rnd(12)` da caveira), as sementes das rodadas seguintes mudam. Verificação: `t44.py`/`t66.py` com log de `$C3:54B3`.
4. **Volta vertical pela borda (208 px):** decidida para bater com o `t49`; se um traço novo mostrar outro valor, muda uma constante (`WRAP_Y`).
5. **`battle-layers.ts` tipado com `object`:** depende do ajuste pós-merge com o plano 5 (decisão 3). Se esquecido, o plano 7 compila, mas perde checagem de tipo em `a`.
6. **Custo do aceite completo da IA:** 500 rodadas podem levar dezenas de minutos; por isso fica atrás de `CB_SLOW`. A versão rápida (50 rodadas) roda sempre.
7. **Arenas e montarias ainda vazias:** até os planos 8 e 9, as fases 2–10 usam só a grade-base (sem bolas, setas, pads nem gangorras: esses objetos nascem no `init` do plano 8); os números das §4 e §5 não são testados aqui.
8. **Transição por `legacy-core`:** até T21, há dois núcleos no repositório; qualquer arquivo novo deve importar `src/core`, nunca `src/legacy-core`.
9. **Piso especial da fase 4 (resolvido na revisão final):** o mapa de piso da fase 4 tem 76 casas com código ≥ 16 (grama), que a tabela `$C4:0892` levaria a `EC40`. Isso emparedava os 4 cantos e a casa de cada jogador (100 % das rodadas por tempo). O gerador passou a gravar `0000` (piso normal, §3.5/§4.3/A10) quando a base do BG2 não é `EC40`; o golden de soft/itens não mudou. Se um traço da ROM mostrar `$7E:2800` diferente depois da montagem (`s08_verify_build.py`), rever a regra ali.

## Resultado da execução (2026-09-26)

Branch `feat/p6`: 404 testes com `SB4_ROM` (396 + 9 pulados sem a ROM), `tsc` limpo, `npm run build` ok, aceite §9 (`CB_SLOW=1`, 50 rodadas × 10 fases) verde. Executado em 5 ondas com até 12 tarefas em paralelo; cada tarefa revisada; revisão final (branch inteira, com fuzz) + uma rodada de correções, re-revisada.

### Fidelidade conferida
- Movimento: 21.440 ticks do traço do emulador, 0 divergências; atravessa-bomba confirmado no emulador.
- Montagem da rodada: soft, itens escondidos e sementes das 10 fases; 207 chamadas do LCG.
- Tempos: pavio 127, chama 25, cadeia +2, queima 24, morte 65, pressão 205/14/36+2·lin (espiral = `$C1:724E`).
- Perda de itens no atordoamento: `rnd(13)` incondicional em até 8 tentativas, saída antecipada em `$C2:5268` (conferido no disassembly).
- Padrão da invisibilidade: 64 bytes reais de `$C2:4F68` (48..63 = espelho de 0..15).
- Perda de capacidade de bombas: sem "dívida" (`$C2:5318`, `$C1:5588`); atordoado não é atordoado de novo (`$C2:0E86`).

### Decisões tomadas durante a execução
- Uma bomba por casa: `bombOccupies` no pouso, colocação, soltura, deslize e parada do chute (o fuzz achou bombas-fantasma).
- Fase 4: grama/terra dos cantos (códigos ≥16 sobre base não-parede) é piso normal — os jogadores não nascem emparedados.
- IA: `fork` do "e se?" faz cópia profunda (hash da rodada idêntico antes/depois de `aiInputs`, testado); remota de dono fora de jogo é bloqueio, não perigo; Forte com 18% de rodadas por tempo.
- Bad Bomber: não age no tick em que nasce, não arremessa fora de `play`, só nasce em `play`.
- Relógio para em 0:00; bordas da pressão marcam `cellT0`.

### Pendências
- Fase 10 em 28% de rodadas por tempo (limite 30%) — margem pequena.
- Fase 8 isenta do limite até haver itens pegos (plano 8 traz o caça-níquel).
- Bomba chutada sem casa livre para parar fica "chutada" parada até explodir pelo pavio.
- Registros `STAGES`/`MOUNTS` começam vazios; planos 8/9 os preenchem (testes usam `withStage`/`withMount`).
