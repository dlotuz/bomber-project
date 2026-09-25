# Arenas e cenário — relatório da frente `arenas-cenario`

> ROM: `Super Bomberman 4 (USA).sfc` (HiROM, 4 MB). Endereços em `$BB:AAAA` (SNES) e offset de arquivo
> (`offset = endereço − $C00000` para os bancos `$C0–$FF`). Frames = frames do emulador (60 Hz).
> ✅ medido/confirmado · 🟡 provável · ❌ não encontrado / a spec estava errada.
> Scripts: `analise/investigacao/arenas-cenario/`. Imagens/dados: `analise/extraido/arenas-cenario/`.

## 0. Resumo

- ✅ **A arena inteira se monta direto da ROM.** Tiles, paletas, tilemaps BG1/BG2, grid lógico, remoção de soft
  blocks (com o RNG do jogo), HUD e elementos fixos (setas, pads, gangorras) foram reimplementados em Python
  (`arena_rom.py`, `render_rom.py`). O render só com ROM bate **pixel a pixel** com o mesmo render alimentado
  pela VRAM/CGRAM real nas arenas 1, 2, 4, 6 e 7. Nas outras, sobram só os quadros de animação e o HUD (§6).
- ✅ **O layout de soft blocks não é fixo.** O mapa da ROM tem soft em todas as casas livres. Na carga, o jogo
  (1) limpa um 3×3 em volta de cada jogador presente e (2) remove N soft blocks em casas sorteadas pelo RNG
  (`$AE`). A análise anterior achou o layout "fixo" porque o RNG não anda nos menus. A primeira rodada depois do
  boot é sempre igual; as seguintes mudam (§2.4).
- ❌ A tabela §8 da spec estava errada em 4 das 6 arenas pedidas. **Arena 2** não tem esteiras: tem um modo
  global que alterna normal/rápido/lento. **Arena 3** não tem órbitas: tem 2 bolas que rolam quando uma
  explosão as atinge. **Arena 6** não tem alçapões: as explosões repintam o piso com efeitos. **Arena 8** não
  dá item a cada 10 s: é um caça-níquel de 3 rolos com tabela de prêmios. As arenas 7 e 9 estavam parcialmente
  certas (§7).

## 1. Ferramentas e reprodução

| Item | Onde |
|---|---|
| Core snes9x com rastreio (escrita/leitura de WRAM, leitura de ROM, exec de PC, log de DMA, trace de chamadas) | patch `snes9x_dbg.patch` + `dbg.h`/`dbg.cpp`. Cópia compilada em `scratchpad/rom-arenas/snes9x/libretro/snes9x_libretro.dylib` (`make -C libretro platform=osx`). `ac.py` aponta `SNES9X_CORE` para ela |
| Parser de savestate (PPU, CGRAM, OAM, FillRAM, DMA/HDMA), renderizador de BG | `ac.py` (`PPUState`, `render_bg`, `dma_channels`) |
| Leitura das tabelas de arena na ROM, decodificadores, RNG, montagem | `arena_rom.py` |
| Render de conferência só com ROM | `render_rom.py` |
| Harness de medição (limpar casas, posicionar jogador, objetos) | `harness.py` |
| Disassembler | `analise/ferramentas/dis65816.py`; `calls.py` (resume trace de chamadas); `findref.py` (refs a um endereço de WRAM) |

Estados usados. Os `st_arena01..10` ✅ são a arena N (confirmado por screenshot, `shots/mosaico.png`), mas numa
rodada posterior (semente de RNG ≠ boot). Para medir a partir da semente do boot, gerei:
`s04_preload.py` → `pre_loadNN` (tela preta antes da carga, a partir de `st_stage(N-1)` + A);
`s17_refshots.py` → `freshNN` (rodada 1, 3:00); `s21_ready.py` → `readyNN` (+60 frames, já aceita comando).
Todos ficam em `scratchpad/rom-arenas/`.
Python: `PY=/private/tmp/claude-501/.../scratchpad/venv/bin/python`, rodando de dentro de `analise/investigacao/arenas-cenario`.

## 2. Vídeo, camadas e montagem do tilemap

### 2.1 Modo de vídeo e camadas ✅ (`s01_shots.py`, `s02_layers.py`, log de IO)
A tela é dividida por **HDMA**: canais 0/2/3/5/6/7 escrevem `$2105`, `$210D`, `$210E`, `$212C`, `$212D` e `$2131`.
As tabelas ficam em `$7E:9EB0–9EEB` e são regravadas a cada frame (`$C3:4C33…`).

| Linhas | `$2105` | BG1 | Resto |
|---|---|---|---|
| 0–23 (HUD) | `$69`: modo 1, BG3 prio, **BG1 8×8**, BG2/BG3 16×16 | HOFS=8, VOFS=`$FFDF` (−33) → linhas 28–30 do mapa do BG1 | TM=`$17`, TS=0, CGADSUB=0 |
| 24–223 (campo) | `$79`: modo 1, BG3 prio, BG1/BG2/BG3 16×16 | HOFS=8 (arena 2 anima), VOFS=`$FFE7` (−25) | TM=`$17`; TS/CGADSUB por arena (abaixo) |

| Registro | Valor | Significado |
|---|---|---|
| `$2107` BG1SC | `$40` | mapa BG1 em VRAM word `$4000`, 32×32 |
| `$2108` BG2SC | `$44` | mapa BG2 em `$4400`, 32×32 |
| `$2109` BG3SC | `$57` | mapa BG3 em `$5400`, 64×64 |
| `$210B` BG12NBA | `$00` | tiles BG1/BG2 em `$0000` (os mesmos 32 KB) |
| `$210C` BG34NBA | `$55` | tiles BG3 em `$5000` (2bpp) |
| `$2101` OBSEL | `$63` | sprites 16×16/32×32, base `$6000` |
| BG2 scroll | H=8, V=−25 | a coluna *c* e a linha *r* do mapa ficam na tela em `x=16c−8`, `y=16r+24` |

O que cada camada faz:
- **BG2 = o campo inteiro**: piso, sombras, pilares, paredes, moldura, soft blocks, e também bomba, chama, item,
  bloco de pressão, setas, pads e gangorras. `$7E:2000` é a **cópia em WRAM do mapa do BG2** (15 linhas × 32 entradas,
  `$3C0` bytes, enviada por DMA a cada frame para `$4400` em `$C4:0C90`). O "grid visual" da análise anterior é isso.
- **BG1 (linhas 24+) = decoração sobreposta** por arena, em prioridade 0 ou 1: relógios translúcidos (2), moitas (7),
  janelas e moldura do caça-níquel (8), placa "BOMBERMAN 4" (9), luzes (10) etc. As entradas com prioridade 1
  ficam **acima dos jogadores** (sprites com prioridade 2). **BG1 linhas 0–23 = HUD** (`$7E:5700`, `$C0` bytes,
  DMA a cada frame para `$4380` em `$C4:0DB2`).
- **BG3**: vazio durante a partida. É fonte de mensagens (tiles crus `$D1:BC16`→`$5000` e `$D0:F57B`→`$5200`,
  mapa `$7E:6000`).
- **Color math** (segmento do campo): arenas **2 e 6**: TS=`$02` (BG2 na subtela), CGADSUB=`$41`, então os pixels do
  BG1 viram **média (BG1+BG2)/2**. Arena **10**: TS=`$02`, CGADSUB=`$01`, **soma saturada**. Nas outras, sem color math.
  Quem liga isso é o objeto da arena (`$C1:C4A4` na arena 2, `$C4:67B0` na 6, `$C4:67DE` na 10, que gravam `$01BF/$01C0`).

### 2.2 Registro da arena na ROM ✅
`$C4:003E`: variante = (`$024A` ou `$024C`) & 3 (sempre 0 no Battle). Ponteiro da tabela em `$C4:0074 + 3·variante`
(variante 0 → `$C3:6233`), e registro = `r24($C3:6233 + 3·$92)`, com `$92` = arena 0..9.
Os registros têm **`$22` bytes** e as 4 variantes ficam intercaladas (`$C3:62DB + $88·n`).

| Off. | Tam | Campo | Uso (código) |
|---|---|---|---|
| +00 | 3 | lista de gráficos: 8 blocos de tiles ZTE + 8 paletas | `$C4:092E` → `$C4:09A5` ×8, `$C4:4BDD`, `$C4:0A05`, `$C4:4E2F` |
| +03 | 3 | mapa do BG1 (formato §2.3) | `$C4:08D3` → `$7E:5000` |
| +06 | 3 | tabela código→entrada do BG1 | |
| +09 | 3 | mapa do BG2 (com soft blocks) | → `$7E:2000` + índice `$7E:4000` |
| +0C | 3 | mapa do piso (sem soft) | → `$7E:3800` (piso base) |
| +0F | 3 | tabela código→entrada do BG2 e do piso | também salva em `$01B0` |
| +12 | 3 | script de animação de tiles (0 = nenhum) | objeto `$C4:0ED1` (§3.1) |
| +15 | 1 | `$14` = música da partida (igual nas 10; confirmado pela frente `audio`) | `$C3:4A44` |
| +16 | 1 | `$2F` = banco de SFX da partida | `$C3:4A16` |
| +18 | 3 | tabela de itens escondidos (pares `$0044`=casa sorteada + ID) | `$C4:121D` |
| +1B | 3 | lista de objetos da arena (6 bytes: rotina + parâmetro) | loop em `$C4:0300` |
| +1E | 1 | quantos soft blocks aleatórios remover | `$C4:179C` |
| +1F | 3 | `$C3:B6D2` (igual em todas) | 🟡 |

| # | Nome | Registro (off. arquivo) | BG1 mapa/tab | BG2 mapa / piso / tab | Anim | Itens | Objetos | Remove |
|---|---|---|---|---|---|---|---|---|
| 1 | The Classic | `$C3:62DB` (0x0362DB) | `$C0:1361`/`$C0:0B5E` | `$D7:3CE0` / `$D7:3DFF` / `$D6:9B02` | — | `$C3:7C30` | — | 14 |
| 2 | Fast 'n' Slow | `$C3:6363` | `$D7:42BC`/`$D6:9B32` | `$D7:3F96` / `$D7:40ED` / `$D6:9B32` | `$C3:6891` | `$C3:7E14` | `$C3:93C8` | 14 |
| 3 | Orb-ital Bombardment | `$C3:63EB` | `$D7:46E3`/`$D6:9932` | `$D7:43C5` / `$D7:451C` / `$D6:9932` | `$C3:6EF1` | `$C3:7FF8` | `$C3:93DD` | 12 |
| 4 | Don't Push Me | `$C3:6473` | `$D7:4DC5`/`$D6:91F2` | `$D7:4B2F` / `$D7:4C52` / `$D6:91F2` | — | `$C3:8252` | `$C3:9422` | 4 |
| 5 | School of Hard Shocks | `$C3:64FB` | `$D7:513A`/`$D6:99F2` | `$D7:4E8C` / `$D7:4FE3` / `$D6:99F2` | `$C3:71F7` | `$C3:83E2` | `$C3:942B` | 8 |
| 6 | Totally Floored | `$C3:6583` | `$D7:5695`/`$D6:9CC2` | `$D7:5219` / `$D7:5338` / `$D6:9CC2` | `$C3:6C99` | `$C3:83E4` | `$C3:9434` | 14 |
| 7 | Hide and Blow Seek | `$C3:660B` | `$D7:5A62`/`$D6:9842` | `$D7:56FC` / `$D7:5893` / `$D6:9842` | `$C3:6ECA` | `$C3:8640` | `$C3:9482` | 4 |
| 8 | Spinny Slots | `$C3:6693` | `$D7:5EA3`/`$D6:9D52` | `$D7:5B11` / `$D7:5CDA` / `$D6:9D52` | — | `$C3:8814` | `$C3:94BE` | 0 |
| 9 | Seesaw Yeehaw | `$C3:671B` | `$D7:660F`/`$D6:9642` | `$D7:62C9` / `$D7:6440` / `$D6:9642` | — | `$C3:88A8` | `$C3:94D0` | 4 |
| 10 | Sartorial Shenanigans | `$C3:67A3` | `$D7:6944`/`$D6:9EA2` | `$D7:66A6` / `$D7:67F5` / `$D6:9EA2` | `$C3:6CF0` | `$C3:8A68` | `$C3:958C` | 14 |

Lista completa (blocos de tiles, paletas, papéis dos tiles, códigos usados): `extraido/arenas-cenario/arenas_rom.json` (`s20_roles.py`).

**Gráficos** ✅ (confirmado junto com a frente `graficos-formato`). Os 8 blocos são tiles 4bpp com "elisão de
tile zerado" (ZTE: bytes `Z`, `E`; `Z` = 32 zeros, `E` = fim, qualquer outro = 32 bytes crus). Cada bloco tem
`$1000` bytes e os 8 somam 32 KB (`$7F:8000` → VRAM `$0000`). Os blocos 0–3 são da arena. Os blocos 4–7 são
comuns: `$CF:93B4` (HUD e fontes), `$D1:C016`, `$D1:D019`, `$D1:E01C` (bomba, chama, blocos em chamas, itens).
Depois disso, **`$C4:4BDD` compõe os tiles `$300–$3FF` sobre o piso**: todo pixel de cor 0 recebe o pixel do tile
de piso 16×16 nº 8 (tiles 8/9/`$18`/`$19`). É por isso que bomba, chama e item aparecem "sobre o piso" da arena.
Na arena 9 há ainda o pós-processamento `arena9_post` (frente `graficos-formato`), que faz os tiles das gangorras.
**Paletas**: 8 × 32 bytes BGR555 crus para as cores 0–127. As paletas 0–4 são comuns: `$D6:9172`, `$D6:9192` (HUD),
`$D7:E65C`, `$D7:E67C`, `$D6:FFD9`. As paletas 5–7 são da arena. Em seguida `$C4:4E2F` copia as cores 13–15 da
paleta 7 para as paletas 2 e 3, e assim o piso composto nos itens e bombas usa as cores do piso.

### 2.3 Formato do mapa e do grid lógico ✅ (`$C4:08D3`/`$C4:0901`; conferido em 10/10 arenas, `s08_verify_build.py`)
```
mapa: 1 byte ignorado; depois tokens de 16 bits LE até completar 32×32 entradas:
  token & $3FF = código;  token >> 10 = repetições EXTRAS (0..63)
entrada_do_tilemap = u16(tabela + 2·código)     (vhopppcc cccccccc do SNES)
grid_lógico = código<16 ? u16($C4:0892 + 2·código) : $EC40
   tabela $C4:0892: 0→$0000 (vazio), 1→$CC80 (soft), 2→$EC40 (duro), 3..13→0, 14→$2E00, 15→$EC40
```
O mapa do BG2 é convertido em `$2000` (tilemap) e em `$2800` (lógico, `$C4:08B2`). O mapa do piso vai para
`$3800`, e o índice de códigos do piso fica em `$7E:4000`. Linha *r*, coluna *c* → offset `r·$40 + c·2`.
A área jogável vai das colunas 2–14 e linhas 1–11. As colunas 0/1/15/16 e as linhas 0/12 são moldura e parede.

**Códigos do grid lógico `$2800`** ✅: `$0000` vazio · `$EC40` pilar/parede · `$EE80` bloco de pressão (e parede
externa durante a pressão) · `$CC80` soft · `$EDC0` soft queimando · `$C900` bomba parada (a bomba chutada sai do grid
enquanto rola) · `$1000` chama · `$0001–$0007` contagem de perigo que a IA usa (cai 1 a cada 16 frames) ·
`$09xx` item (`$0941` = item 1) · `$0F41` bola da arena 3 · `$0040` seta da arena 7 · `$0C00` pad do caça-níquel
(`$1C00` com chama). `$7F:1000` é o mapa de ocupação por jogador (bits `$10,$20,$40,$80,$100` = P1..P5).

### 2.4 Soft blocks: montagem exata ✅ (`$C4:16CA`, `$C4:179C`; `arena_rom.build_arena`)
1. Soft em todas as casas "1" do mapa da ROM.
2. Para cada jogador presente (`+$24 ≠ 2`): 3×3 centrado na casa do jogador, caminho cumulativo
   `$C4:1865` = `0, −$40, +2, +$40, +$40, −2, −2, −$40, −$40`. Cada casa volta ao piso (entrada de `$3800`, código lógico do piso).
3. Repete `rec+$1E` vezes: sorteia `col = rng(13)` e `lin = rng(11)` e usa offset `lin·$40 + col·2 + $44`.
   Se a casa for soft, remove. Depois de 15 sorteios sem acerto, remove o 1º soft da lista fixa `$C4:1327`.
   Se a lista também não tiver soft, termina.
4. **RNG** (`$C3:54B3`): `seed = ((seed | 1) · $0383) mod 2¹⁶`, `valor = (seed · n) >> 16`. A semente fica em
   `$AE` e vale `$0012` no boot (`$C0:F0E1`). Nos menus ela não anda. Na carga, 5 chamadas por jogador
   (`$C2:02CD`) levam a semente a `$C689`, e então vêm as remoções.
Com 5 jogadores e a semente do boot, resultado: 80/80/80/70/0/80/62/0/78/80 soft blocks. Isso é **idêntico** à WRAM
nas 10 arenas (tilemap, lógico, piso e semente final). Os itens escondidos (`rec+$18`) também são sorteados com o
mesmo RNG (`$C4:121D`).

### 2.5 Papéis dos tiles (entradas BG2) ✅ (`s20_roles.py`)
| Arena | Piso | Sombra sob pilar | Sombra sob parede de cima | Pilar | Soft | Obs. |
|---|---|---|---|---|---|---|
| 1 | `1C08` | `1C0A` | `1C0C` | `1404` | `1C02` | paredes `1442`, moldura `1440` |
| 2 | `1C08` | `1C0C` | `1C0A` | `1404` | `1C02` | |
| 3 | `1C08` | `1C0C` | `1C0A` | `1404` | `1C02` | |
| 4 | `1C08`/`1C0A` e `1DE0–1DEE` (grama dos cantos) | — | — | `1C04` | `0802` | terra `144E/146E/14EA` = duro |
| 5 | `1C08` | = piso | = piso | `1C04` (animado) | — | |
| 6 | `1C06` | = piso | = piso | `1804` | `1C02` (animado) | pisos especiais `1C08/1C0A/1C0C` (§7.3) |
| 7 | `1C08` | `1C0A` | `1C0C` | `1804` | `1C02` (animado) | setas `1CC0–1CC6` |
| 8 | `1C08` | `1C0C` | `1C0E` | `1804` | — | pads `1C6E` |
| 9 | `1C08` | `1C0A` | `1C08` | `1404` | `1C02` | gangorras `08E0–08EC` |
| 10 | `1C08` | = piso | = piso | `1804` | `1C02` | |

A sombra existe **só sob pilar e parede**, nunca sob soft block, e já vem pronta no mapa do piso (`$3800`). O jogo
não recalcula sombras: quando o soft some ou cai um bloco de pressão, as vizinhas não mudam ✅.

### 2.6 O tilemap em jogo ✅ (`s15_softdestroy.py`, `b08_arena6_floor.py`, `s16_pressure.py`)
| Evento | Entradas BG2 (por frame) | Lógico |
|---|---|---|
| Bomba parada | `0B00`→`0B02`→`0B04`→`0B06`, ciclo de 64 f (20/12/16/16) | `$C900` |
| Chama (32 f) | centro `0F6C`, meio horizontal `0F6A` (`4F6A` à esquerda), meio vertical `8F68`, ponta direita `0F66`, ponta esquerda `4F66`, ponta de cima `0F60`, ponta de baixo `8F60`. O dígito do meio varia `6→8→A→8→A…→6`: 2,3,3,2,3,3,2,3,3,2,3,2,1 frames (+`$20` por passo) | `$1000` |
| Soft queimando (30 f) | `0C20`(5) `0C22`(6) `0C24`(5) `0C26`(5) `0C28`(6) `0C2A`(3), depois o piso ou o item | `$EDC0` |
| Item revelado | `$1200 + $200 + tile_visual` (pal. 4), ex.: `1280` = bomba | `$09xx` |
| Fim da chama | volta para a entrada de `$3800` | código do piso (`$C1:5341`), com ganchos por arena para setas, pads e gangorras (`$C1:534F…`) |
| Bloco de pressão | `082E` (pal. 2, tile `$02E`, ZTE `$C5:FE5C`) | `$EE80` |

**Blocos de pressão** ✅ (`$C1:7082`, tabela `$C1:724E`):
- Com Time ≥ 2:00 (`$1F02 ≠ 0`), a virada do relógio **1:02→1:01** cria o objeto "hurry" `$C1:1559`
  (SFX `$15` + voz `$10`, faixa de texto por 192 frames de jogo). Com Time = 1:00, o disparo é em **0:42**.
- ~198 frames depois (medido), começa o controlador `$C1:7030`. Ele marca as paredes externas (linhas 0 e 12,
  colunas 2–14) como `$EE80` e cai um passo da espiral a cada **14 frames**. O 1º passo vem 13 f depois.
- Espiral: começa em (1,2), vai para a direita pela linha 1, desce a coluna 14, volta pela linha 11 e sobe a
  coluna 2. Depois faz o anel interno (2,3)…
- **80 passos** e marcador `$7000`. Continua (+63 passos até o centro) só se `$40≠0`. Com esse construtor,
  `$40 = $1F08` (🟡 = "Sudden Death"). O outro construtor `$C1:7027` usa `$FF`: é o jackpot do caça-níquel.
- Casa já dura é pulada, mas o passo consome os 14 f. Cada bloco marca `$0001` na casa, cai como sprite e vira
  `082E`/`$EE80` **38 f depois**.
- O relógio corre em frames de jogo e sofre lag (segundos medidos de 60–70 f na pressão).

## 3. Animações de cenário

### 3.1 Tiles animados ✅ (`s11/s12_tileanim.py`; formato em `arena_rom.decode_anim_script`)
Script `rec+$12`, interpretado pelo objeto `$C4:0ED1`, **um comando por frame**. Cada comando tem `[W:2][op:1]`:
- `op=$A0`: espera W frames, e o comando gasta 1+W frames;
- `op=$80`: volta ao início; `op=$90`: fim;
- outro valor: `[src:2][banco:1]` → DMA de um 16×16 do buffer `$7F:8000` (64 bytes `src`→VRAM W e 64 bytes `src+$200`→W+`$100`, em `$C4:0A6B`).

| Arena | Tiles 16×16 animados (destino ← quadros) | Período por quadro | Ciclo |
|---|---|---|---|
| 2 | relógios do BG1 `$0E0–$0E6` (8 quadros) + engrenagens `$044,$046,$048,$066,$068,$06A,$06C` (4 quadros) | 22 f | 176 f |
| 3 | 24 tiles da plateia/laterais `$040–$08E`, 2 quadros cada | 24 f | 48 f |
| 5 | pilar `$004` (4 quadros `$0E0…$0E6`) + moldura `$080–$08E` | 9 f | 36 f |
| 6 | **soft block** `$002` (`$0E0…$0E6`) + `$082`/`$084` | 9 f | 36 f |
| 7 | **soft block** `$002` (`$0E0…$0E6`) | 12 f | 48 f |
| 10 | `$04C` (`$0E8…$0EE`) | 7 f | 28 f |
| 8 | rolos do caça-níquel: 4 DMAs por frame `$7F:9000/9200/9400/9600` → `$1040/$1140/$1240/$1340` (`$C4:0B22…`), movidos pelo objeto do caça-níquel | 1 f | — |
| 1, 4, 9 | sem animação de tile | | |

### 3.2 Paletas ✅ (`s13_palanim.py`, `s14_palframes.py`)
| Onde | Cores | Quadros (ROM) | Período |
|---|---|---|---|
| Todas (itens piscando) | 79 (pal. 4, cor 15) | `$00BF` ↔ `$7D80` conforme o bit 2 de `$016C` (`$C1:0965`) | 4 f cada |
| Arena 9 | pal. 5 inteira (anima 12–15) | `$D7:DDDC, DDFC, DE1C, DE3C, DE5C, DE7C` (6 × 32 bytes seguidos) | 14 f cada, ciclo 84 f |
| Arena 10 | pal. 5 inteira (anima 4–8) | `$D7:E47C, E49C, E4BC, E4DC` | 15 f cada, ciclo 60 f |
| Arena 8 | cor 0 (fundo) = `$0000` em jogo (ROM `$4A52`) | objeto do caça-níquel | fixo |

### 3.3 Scroll ✅
Arena 2: o BG1 (relógios translúcidos) anda **+HOFS a cada 4 frames**: +8 no modo normal (2 px/f), +32 no modo
rápido (8 px/f) e +1 no modo lento (0,25 px/f) (`$C1:C4C4`, tabela `$C1:C4DD`). As outras arenas não têm scroll.

## 4. HUD ✅ (`s19_hud.py`; `$C4:0170`, `$C4:18A3`, `$C4:5B30…`)
- Mapa base `$D6:8EEC` (tabela `$D6:8F72`), linhas 0–2, somando `$2200` (prioridade 1, tile+`$200`) → `$7E:5700`.
- BG1 8×8, **paleta 1** (`$D6:9192`): `#399C00 #000000 #085252 #398473 #847300 #EFC67B #630000 #FF0000 #005200 #21AD21 #000094 #0031FF #A5A5A5 #FFFFFF #FFAD00 #006B00`.
- Faixa de y 0–23 (3 linhas de 8 px). Coluna *c* do mapa → x = 8(c−1). A moldura direita é a coluna 0 espelhada, em x=248.

| x (px) | Conteúdo | Tiles (+`$200`) |
|---|---|---|
| 0 / 248 | moldura esquerda / direita | `00/10/20` (a direita com h-flip) |
| 8–23 | ícone do relógio | `0C 0D / 1C 1D / 2C 2D` |
| 24 | minutos | dígito d: topo `$2F+d` (d=1..9), `$39` para 0; meio +`$10`; base +`$20` |
| 32 | `:` | `3A/4A/5A` |
| 40, 48 | segundos | idem |
| 72, 104, 136, 168, 200 (16 px cada) | rosto de P1..P5 | `01 02/11 12/21 22`, `03 04`…, `09 0A`. Os gráficos vêm do personagem escolhido (DMA `$C4:6157` de `$7F:20AC…`, frente `graficos-formato`) |
| 88, 120, 152, 184, 216 (linha do meio) | coroas de P1..P5 (`$1F34…$1F3C`) | tabela `$C4:5D11`: 0→`4F`, 1→`3B`, 2→`3C`, 3→`3D`, 4→`3E`, 5→`3F`, 6..9→`4B–4E` |

## 5. Carregador em TypeScript (tudo a partir da ROM)
```ts
const rec = r24(r24(0xC36233 + 3*arena));            // registro de $22 bytes
const lst = r24(rec+0);
let tiles = concat([0..7].map(i => zte(r24(lst+3*i)).slice(0,0x1000)));  // 32 KB
tiles = compositeFloor(tiles);                        // $C4:4BDD, tiles $300-$3FF
if (arena===9) tiles = arena9Post(tiles);             // graficos-formato
const pal = [0..7].flatMap(i => bgr555(r(r24(lst+3*(8+i)), 32)));  // 128 cores
for (k of [13,14,15]) pal[32+k] = pal[48+k] = pal[112+k];            // $C4:4E2F
const bg1 = decodeMap(r24(rec+3)).map(c => u16(r24(rec+6)+2*c));
const tbl = r24(rec+0x0F);
const codes = decodeMap(r24(rec+9)), floorCodes = decodeMap(r24(rec+0x0C));
const bg2 = codes.map(c=>u16(tbl+2*c)), floor = floorCodes.map(c=>u16(tbl+2*c));
const logic = codes.map(c => c<16 ? u16(0xC40892+2*c) : 0xEC40);
clear3x3AroundPlayers(); removeRandomSoft(rec[0x1E], rng);   // §2.4
applyStaticObjects(arena);   // setas $C3:918E (7), pads $1C8/$1D0/$1D8 = 1C6E (8), gangorras $C3:9524 (9)
const hud = decodeMap(0xD68EEC).slice(0,96).map(c => u16(0xD68F72+2*c)+0x2200);
```
Implementação de referência em Python: `arena_rom.py` e `render_rom.py`.

## 6. Renderização de conferência ✅ (`render_rom.py`, `s18_compare.py`, `s23_state_vs_rom.py`)
`extraido/arenas-cenario/render/arena_NN_rom.png` usa só a ROM (mosaico `todas_rom.png`). `cmp_NN.png` mostra ROM |
emulador | máscara de diferença. As comparações são em cor de 5 bits.

| Arena | ROM × emulador (rodada 1 do boot) | Mesmo render: dados da ROM × VRAM/CGRAM do estado | O que sobra |
|---|---|---|---|
| 1, 4, 7 | ~1 690 px no campo | **0 px** | só os sprites dos 5 jogadores |
| 2 | 2 392 | **0** (com HOFS=`$18` e quadros de anim. do instante) | sprites |
| 6 | 2 062 | **0** (com o quadro de animação do instante) | sprites |
| 5 / 10 / 9 | 1 890 / 1 844 / 1 809 | 202 / 150 / 116 | fase da animação de tile/paleta + sprites |
| 3 | 3 908 | 1 736 | bolas (sprites) + plateia animada |
| 8 | 2 797 | 1 103 | conteúdo dos rolos + sprites |
| HUD | 464 px em todas | 464 | só os rostos (dependem do personagem) |

Contra `analise/arenas/*.png` (= `st_arenaNN`, rodada posterior), o cenário bate, mas **o layout de soft muda**
(outra semente de RNG, §2.4). Isso é o esperado.

## 7. Parte B — mecânicas especiais (medidas)

### Tabela da spec (§8 dela) × medido
| # | Spec | Medido | |
|---|---|---|---|
| 2 | esteiras nas linhas 3/9 a 0,5 px/f | **não há esteiras**: modo global normal/rápido/lento (§7.1) | ❌ |
| 3 | 2 esferas em circuito, 1 casa/32 f, explodem bombas | 2 bolas paradas que **rolam quando a chama as atinge**, 1 px/f; atordoam e tiram itens de quem tocam; não explodem bombas (§7.2) | ❌ |
| 6 | alçapões a cada 240 f, quem cai morre | **não há alçapões**: as explosões repintam o piso com listras (arranque), caveira (controles invertidos) e caveirinhas (param bomba chutada) (§7.3) | ❌ |
| 7 | 4 moitas deixam invisível | ✅ 4 moitas (BG1 prio 1) cobrem jogadores, bombas, chamas e itens. Há também **4 setas** que desviam bomba chutada (§7.4) | 🟡→✅ |
| 8 | 3 casas: pisar sorteia item a cada 10 s | **caça-níquel**: bomba no pad liga, pisar no pad freia o rolo, tabela 4×4×4 de prêmios (§7.5) | ❌ |
| 9 | 4 gangorras: pisar lança para a espelhada | ✅ pisar numa ponta lança **quem está na outra ponta**. Voo horizontal só com ←/→ segurado (§7.6) | 🟡 |

### 7.1 Arena 2 — "Fast 'n' Slow" ✅ (`b01_arena2.py`, `b02_arena2_timer.py`)
- Objeto `$C3:0AAF` (liga `$9C|=$80`). Timer `$10 = $140 + rng(256)` (320–575 f).
  Aos 128 f do fim toca o SFX `$26`. No fim sorteia `$1EB6` na tabela `$C3:0B11` (32 entradas):
  **0 normal 16/32, 1 rápido 13/32, 2 lento 3/32** (quando sai o mesmo modo, não há troca visível).
- Efeito global (todos os jogadores), que **ignora o nível de patins**:

| Modo | Velocidade do jogador (`$C2:2F81`, nível 6/7 da tabela `$C3:2A50`) | Pavio (`$C1:3CC5`) | BG1 |
|---|---|---|---|
| 0 | nível normal (1 px/f no nível 1) | 124 f pelo mesmo método (a análise anterior contou 128 desde o botão) | +2 px/f |
| 1 rápido | **2,0 px/f** | **61 f** (decrementa 2×/f) | +8 px/f |
| 2 lento | **0,5 px/f** | **250 f** (decrementa em frames pares) | +0,25 px/f |
- Trocas medidas em 6000 f: 485, 1268, 1611, 2091, 2636, 3156, 3695, 4185, 4592, 4933, 5952.

### 7.2 Arena 3 — bolas ✅ (`b03`–`b06`; `$C3:06EE`)
- Posições iniciais em `$C3:9401`: **(5,6) e (7,10)**. Lógico `$0F41`, bloqueiam passagem enquanto estão paradas.
- **Disparo**: quando uma chama está na casa da bola (`$C3:0A00`), ela sai para o lado **oposto** à chama.
  Checa vizinhas na ordem baixo, esq., cima, dir. (a 1ª com chama); direções `$C3:09F8`/`$C3:09E8`.
- Movimento: **1 px/f, 16 f por casa, até 8 casas**. Enquanto rola, sai do grid.
  Bloqueio (parede/duro, bomba `$C900`, casa com bits `$30`) → vira (`$C3:087D`: +1/+3/+2 ou +3/+1/+2, escolha aleatória).
  Em 4 falhas, para. O 1º soft block em que bate **é destruído** (`$C1:4288` → `$EDC0`) e ela vira.
  Se parar sobre bloco de pressão, some.
- **Toque em jogador** (|dx|<8 e |dy|<8, parada ou rolando; `$C3:0A57`): o jogador fica **atordoado 66 f**
  (rotina `$C2:0E86`, sem controle) e **perde itens**: 1º toque, fogo −1; 2º toque, bombas −1 e fogo −1.
  Depois ganha `+$96 = $40` (64 f imune à bola). **Não mata e não explode bombas.**

### 7.3 Arena 6 — piso repintado ✅ (`b07`–`b09`, `b21_a6_kick.py`; `$C1:3DD9`, `$C1:550B`, `$C2:1676`)
- Em cada explosão (`$9C&4`) o jogo sorteia `v=rng`&15 (≠0) **por direção**. Cada casa de chama daquele braço
  repinta o piso (`$3800`) com `$C1:5558[v]` ∈ {`1C0A` listras, `1C06` normal}.
  O contador global `$1EAA` (começa em 64 + rng(64)) cai 1 por casa de chama: em 0 a casa vira **`1C0C` caveira**
  e o contador volta a 64..127. Quando `$1EAA & 7 == 2`, a casa vira **`1C08` caveirinhas**. O piso inicial é todo `1C06`.
- Efeitos:
  - **`1C0A` (listras)**: ao entrar, o jogador é empurrado na direção em que olha, a **2 px/f**, sem controle, até a próxima casa (medido 72→95 px em 12 f; rotinas `$C2:1D3F/1DE2`).
  - **`1C0C` (caveira)**: **controles invertidos** (`+$E4=$0A`, `+$E6=$40` cai 1 a cada 4 f → **256 f**, renovado enquanto estiver em cima) e SFX `$0A`.
  - **`1C08`**: **bomba chutada para** na casa anterior (`$C1:39CF`). O jogador não sofre nada.
- A animação do soft block `$002` e dos tiles `$082/$084` é só visual (§3.1).

### 7.4 Arena 7 — moitas e setas ✅ (`b10`, `b12`, `b14_kick_down.py`, `shots/a07_bush_big.png`)
- **Moitas**: BG1 com prioridade 1 em 4 cruzes: (2–3,7–9)+(4,8); (5–7,3–5)+(4,3),(4,5); (5–7,11–13)+(4,11),(4,13);
  (8–9,7–9)+(10,8). Tudo o que está embaixo fica escondido: jogadores (OBJ prio 2), bomba, chama e item (BG2).
  Não há regra de jogo, só a cobertura visual. Screenshot com P1, P2 e bomba escondidos.
- **Setas** (`$C3:0EFF`, lista `$C3:918E`): (3,4) → direita `1CC2`, (9,4) → cima `1CC0`, (3,12) → baixo `1CC4`,
  (9,12) → esquerda `1CC6`. Formam um circuito horário. O lógico é `$0040` (passável). **Jogador não é afetado.**
  **Bomba chutada que entra na casa vira para a direção da seta** (medido: chutada para baixo em (3,4), sai para a direita).
  Velocidade da bomba chutada: 2 px/f.
- Existe no código uma versão de setas que giram a cada 96 f (`$C3:0E37`) e alçapões de 3 estados a cada 320 f (`$C3:0D48`,
  tiles `1DC0/2/4`, lógico `$2C00/$2C80/$AC80`). **Nenhuma das 10 arenas de batalha usa.** 🟡 (modo história?)

### 7.5 Arena 8 — caça-níquel ✅ (`b16_slot.py`; `$C3:11C7…$C3:1A83`)
- Pads em **(7,4), (7,8), (7,12)**: tile `1C6E`, lógico `$0C00`, passável.
- **Liga**: chama em qualquer pad com a máquina parada. Os 3 rolos giram: cada rolo avança 1 passo a cada 3 f, em
  16 passos por volta, 4 símbolos de 4 passos. Símbolo = (`pos`>>3)&3.
- **Freio**: jogador **em pé** no pad do rolo (mapa `$7F:1000`) → SFX `$27` e o rolo começa a frear na hora.
  Sem ninguém, o freio automático começa depois de 384 chamadas por rolo (≈1152 f).
  Freando, a cada 8 chamadas o rolo fica 1 f mais lento. Para quando o atraso ≥4 e o símbolo está alinhado.
  Medido sem freio: resultado ~1256 f depois de ligar.
- **Prêmio** = tabela `$C3:1414`[r1·16 + r2·4 + r3] (rotinas em `$C3:xxxx`). Listas de itens: 1º byte = N, depois N IDs.

| Rotina | Combinações (de 64) | Efeito |
|---|---|---|
| `14F7` | 18 | nada |
| `14F9` | 12 | 3 itens sorteados de `$C3:14A9` = caveiras `21–2B` |
| `1611` | 12 | 3 itens de {03,01,05,07,0D,0E,11} (`$C3:14B6`) |
| `1526` | 6 | 3 caveiras e, 128 f depois, evento extra `$C3:1CC3` 🟡 |
| `1662` | 4 | 6 itens de {01,03,05} |
| `14D6` | 4 | 1 item de {01,03,11,05,04,0E,07,0D,2D} |
| `163A` | 4 | 3 × item `11` |
| `15BF` (0,0,0) | 1 | 12 caveiras + **pressão total** (`$C1:7027`) |
| `16A2` (1,1,1) | 1 | 18 itens de {01,03,11,05,0E,07,0D} |
| `1682` (3,3,3) | 1 | 9 itens em sequência: `03 04 03 03 04 03 03 04 03` |
| `17AD` (2,2,2) | 1 | chuva de itens: 16 ondas a cada 64 f, com 3–5 itens por onda 🟡 |

As chances por prêmio seriam essas contagens/64 **se** os rolos parassem em símbolo uniforme e independente 🟡. Na
prática dependem do tempo e de quem pisa nos pads. Os itens caem do alto (Y=80). Quando o prêmio termina, a máquina
volta ao estado parado (`$C3:1291`) e pode ser religada na hora. **Não há recarga fixa de 10 s.**

### 7.6 Arena 9 — gangorras ✅/🟡 (`b17`–`b19_seesaw*.py`; `$C3:215C`, param. `$C3:9524`)
- 4 gangorras de 3 casas (ponta, pivô, ponta): **(3,4–6), (9,4–6), (3,10–12), (9,10–12)**. Lógico `$0000` (passáveis).
  Tiles `08E0–08EC` (inclinadas para um lado ou para o outro) e `08E6/08E8/08EA` (transição, 1–2 f).
- Entrar numa ponta vira a gangorra. **Quem está na outra ponta é lançado** (`$C2:1C58`): pulo de **14 f**, ápice −16 px.
  Sem direcional, cai no mesmo lugar, e essa queda vira a gangorra de novo (vai e volta).
- **Segurando ←/→ no início do pulo** (só horizontal; ↑/↓ não): voa **8 px/f** por ~12–13 f (~6 casas).
  Dá a volta na borda (+272 px = 17 colunas; medido x −25 → 247). Depois entra no estado `$C2:2026`: quica a
  3 px/f, com pulinhos de ~9 f, **casa a casa até achar casa livre**. Passa por cima de parede e soft; medido
  (3,4) → esquerda → caiu em (3,12). Como as gangorras ficam a 6 colunas uma da outra, costuma cair na gangorra do
  outro lado da mesma linha, que então vira.
- 🟡 O que acontece se o destino tiver outro jogador não foi medido.

### 7.7 Outras mecânicas encontradas (flags `$9C`) 🟡
| Arena | Flag | Código | Observado |
|---|---|---|---|
| 4 | `$0100` | `$C2:210A`, `$C2:3095`, `$C1:53D2` | a grama dos cantos `1DE0–1DEE` e a terra (`14xx`, dura) têm tratamento especial para o jogador (empurrões `$C2:312D…`). Andando por cima nada mudou; provavelmente ligado a ser arremessado sobre a terra |
| 5 | `$0200` | `$C2:20DF` | jogador fora de x∈[24,232) ou y∈[40,216) → `$C2:5998`. Pilares animados (§3.1) |
| 10 | — | objetos `$C4:67DE`, `$C4:6523` | só visual (paleta, color math aditivo); tabela de itens com 8 × item `0F` exclusivo |
| todas | — | `$C4:121D` | itens escondidos: 26–35 por arena (lista em `arenas_rom.json`), colocados em soft blocks sorteados |

## 8. Em aberto
- 🟡 Semântica de `$1F08` (Sudden Death?), dos itens `04`, `11`, `2D`, `0F` e dos eventos `1526`/`17AD` do caça-níquel.
- 🟡 Arena 4 (grama dos cantos) e arena 5 (limite do campo): efeito exato não reproduzido.
- ❌ O sprite do bloco de pressão caindo e o das bolas ficam com a frente `animacoes-sprites`. Os rostos do HUD dependem do descompressor de personagens (`graficos-formato`).
- O chute parou a bomba depois de ~2 casas nas arenas 1 e 7 e rolou livre na arena 6. Deixo para a frente `mecanicas`.
