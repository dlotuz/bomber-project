# Montarias da senha 0164 (tipos 1, 4, 5, 6, 9, B)

Endereços `$BB:AAAA` (HiROM; offset no arquivo = `endereço & $3FFFFF`). ✅ medido/confirmado, 🟡 provável.

## Senha

| Fato | Status |
|---|---|
| Na tela PASSWORD, **0164** + START grava `$7F:70BD = 1` (~220 f depois, na animação do Bomberman montado). 1234 não grava. | ✅ `pw.py 0164`, `pw.py 1234` |
| A flag continua ligada no Battle (`mx_arena01`: `$7F:70BD = 1`). | ✅ `tobattle3.py` |
| Só três pontos leem a flag: `$C1:5DC0` (bloco revela ovo), `$C3:196F` (ovo do prêmio da arena 8) e `$C2:AAF1` (escrita). | ✅ busca por `BD 70 7F` |
| Com a flag: `rnd(26)` em `$C1:5D87` = `31 32 33 34 35 36 39 3A 3B 3C 3D 3E 3F` × 2. Sem: `rnd(14)` em `$C1:5DA4`. | ✅ |
| Tipos 0, 7 e 8 não saem em nenhuma tabela. | ✅ |

## Os 6 tipos novos

Classe do ovo pela regra da ROM (id ≥ `$38` = máquina, `$D8:D2CC`): 1, 4, 5, 6 normais; 9, B de máquina.
Montar, desmontar, invencibilidade e velocidade padrão iguais aos 7 tipos do Battle (`battery.py`). Habilidade do Y pela tabela `$C2:465F`.

| Tipo | Aparência | Habilidade | Números | Status |
|---|---|---|---|---|
| **1** | Fantasminha verde-água | **Passiva: atravessa bombas** (testes `$C2:33B6`, `$C2:4339`, `$C2:4EB0`, os mesmos do item `$0B`). Por isso nunca chuta. | Atravessou a bomba em (31,47) andando de 78 até 42 | ✅ |
| **4** | Polvo vermelho | **Y: investida** (`$C2:4691` → rotina `$C2:26E0`, que simula o direcional da face `$C2:47C1` e chama o movimento normal `$C2:2F3A`). | 4 px/f na face até não sair do lugar: parede 33→221, 223; bloco macio em x=128 para em 111 sem quebrar; bomba em 31 vindo de 90 para em 50 sem empurrar; atravessa jogadores. Sem bomba nem virar durante; Y repete sem recarga. Montaria na animação parada. | ✅ `t4.py`, `t45b.py`, `ysheet.py` |
| **5** | Pato verde | **Y: varredura** (`$C2:46AF`, só com `$90` ≠ 0 = blocos macios restantes): objeto `$C1:6A3F` percorre a espiral `$C1:724E` (143 casas, (2,1) → horário → (9,6)), 1 casa por tick a partir do tick seguinte, queimando cada bloco macio (`$C1:4288`; os itens aparecem normalmente). | 80 blocos → 0 em ~143 f. Um 2º Y cria outro objeto. | ✅ `t5.py`, `t5b.py`, `t45b.py` |
| **6** | Iéti azul | **Passiva: fogo total.** `$C2:510C` grava bomba+`$23` = `[$C0:0B48]` − 1 = 7. | Alcance 9 casas (tipo 2: 2) | ✅ `t6.py` |
| **9** | Tartaruga (máquina) | **Y: soco** sem o item, mesmo montado (`$C2:48E3` pula o "montado → sai"), sem a pose de soco (`$C2:4914`). | Bomba em 31 socada a partir de 51: voo de 3 casas, volta pela borda e quica até (208,48) | ✅ `t9.py` |
| **B** | Robô de corda (máquina) | **Passiva: velocidade** nível `[$C0:0B50]` = 6 (`$C2:2F40`, antes da doença). | 2 px/f (o 1,4 de `battery.py` era a parede) | ✅ |

## Gráficos

`facts_extra.py` (anim = +$08−1, anim2 = +$38−1, folha p24(`$C4:70DC` + 3·t), paleta OBJ 2 achada uma vez na ROM). O tipo 2 roda junto como controle e bate com `web/src/render/rom/mounts/facts.ts`.

| Tipo | Folha (crua) | Paleta OBJ 2 | Montando (+$38) |
|---|---|---|---|
| 1 | `$D4:E000` | `$D7:F67C` | `$D8:8C69` |
| 4 | `$D4:6000` | `$D7:EEBC` | `$D8:613B` |
| 5 | `$D4:7800` | `$D7:EF7C` | `$D8:6FFC` |
| 6 | `$D4:B000` | `$D7:F21C` | `$D8:8379` |
| 9 | `$D4:1800` | `$D7:EDBC` | `$D8:4C66` |
| B | `$D4:3000` | `$D7:EE1C` | `$D8:5683` |

`fixture_extra.py` grava `web/tests/fixtures/rom/mount-render-extra.json` (peças da OAM, só fatos). O tipo 2 bate com a fixture antiga nas 4 direções.

## Como reproduzir

Core snes9x (normal e com o patch `arenas-cenario/snes9x_dbg.patch`) compilado no scratchpad. Caminhos em `lib.py` (`SB4_ROM`, `SNES9X_CORE`).
Estados em `analise/estados/mx_*.bin` (fora do git): `boot.py` → `mx_title`/`mx_password`; `pw.py 0164` → `mx_after_0164`; `tobattle.py` → `mx_tb`; `tobattle3.py` → `mx_arena01`.
Python com Pillow: `<scratchpad>/venv/bin/python <script>.py`.

## Em aberto

- 🟡 Investida (4) contra bomba de lado ou na diagonal: só medida em linha reta.
- 🟡 Ordem tipo B × arena 2 (esteira): o core deixa o nível da arena vencer, como já fazia com doença.
