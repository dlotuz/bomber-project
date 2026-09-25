# Frente animacoes-sprites — relatório

Como os objetos do Battle são desenhados e animados, com o formato das tabelas na ROM para o carregador TypeScript
ler tudo direto da ROM.
Legenda: ✅ medido/confirmado · 🟡 provável (lido no código ou inferido, sem teste dedicado) · ❌ não encontrado.
Endereços em `$BB:AAAA` (HiROM). Offset de arquivo = `((BB & 0x3F) << 16) | AAAA` (ex.: `$D8:1693` → `0x181693`).

Dados extraídos (fora do git): `analise/extraido/animacoes-sprites/` (PNGs de conferência + `animacoes.json`).
Scripts: esta pasta (`*.py`, veja §12).

---

## 0. Resumo em 12 linhas

1. Cada **jogador é 1 sprite 32×32** na OAM. O desenho não é montado com tiles fixos: a cada troca de quadro o jogo
   manda por **DMA 512 bytes crus da ROM** (4 linhas de 128 B, *stride* `$200`) para o slot do jogador na VRAM. ✅
2. Os 6 personagens têm cada um uma **folha de 64 quadros 32×32** (32 KB, 4bpp, sem compressão). ✅
3. As **animações** usam um formato único, também usado por outros objetos: `N` seguido de N quadros de 6 bytes
   `{ptr24 metasprite, duração, dx, dy}`. O **metasprite** é `N` seguido de N peças de 6 bytes `{dx, dy, attr}`. ✅
4. Andar, parar, morrer, vencer, luva e soco usam **as mesmas tabelas para os 6 personagens**. Só muda a folha de
   gráficos (`$C2:0730`) e a paleta (`$C2:779D`). As exceções são o "tédio", com uma animação por personagem, e a
   tela VICTORY, com uma folha própria (`$C2:8EBF`). ✅
5. As **5 cores de jogador** vêm de 5 paletas por personagem, indexadas pelo slot do jogador (`+$20`). P1→OBJ pal 0,
   P2→1, P3→4, P4→5, P5→6. ✅
6. **Ordem de desenho:** a lista é ordenada pelo Y (`+$26`), e o maior Y fica na frente. Bomba parada, chama, bloco,
   item e bloco de pressão pousado são **tiles 16×16 de BG2**, sempre atrás dos sprites. ✅
7. **Bomba:** tile de BG animado por um *script* `{palavra do tilemap, duração}`. A normal é `0B00/02/04/06` =
   20/12/16/16 quadros. Ela só vira sprite (OBJ `0x180`) quando está voando ou deslizando. ✅
8. **Chama:** tiles `0x36x/0x38x/0x3Ax` (fases A/B/C). A sequência é A2 (B2 C2)×5 B2 A1 = **25 ticks de lógica**.
   Os "≈33 quadros" da análise anterior são efeito de *lag* (o jogo pula ticks durante explosões). ✅
9. **Soft block:** queima em 6 tiles `0x020..0x02A`, 4 ticks cada, com gráfico próprio de cada fase. **Item ou bomba
   atingidos:** 5 tiles `0x32E..0x3AE`, 4 ticks cada. ✅
10. **Itens piscam** pela paleta: a cor 15 da paleta BG 4 alterna entre `7D80` (azul) e `00BF` (vermelho) a cada
    4 quadros. ✅
11. **Caveira:** a paleta do jogador alterna entre normal e toda preta a cada 4 quadros. **Invencível:** o sprite
    fica 2 quadros visível e 2 oculto, por 489 quadros. ✅
12. **Pressão:** uma sombra (OBJ `0x4E`) aparece cerca de 33 quadros antes. O bloco (OBJ `0x4C`) cai 8 px/quadro
    desde y=0 e vira o tile BG `082E`. ✅

---

## 1. Infraestrutura (como a OAM é montada)

### 1.1 Registradores e VRAM (Battle) ✅
| Item | Valor |
|---|---|
| OBSEL | `$63`: sprites **16×16 (pequeno) / 32×32 (grande)**, tabela 1 em VRAM word `$6000`, tabela 2 em `$7000` |
| BGMODE | `$79`: modo 1, BG1/BG2/BG3 com tiles 16×16 |
| BG2 (campo) | mapa em word `$4400` (DMA a cada quadro de `$7E:2000`, 960 B = o grid visual), tiles em word `$0000` |
| BG3 (HUD) | mapa em word `$5400` (buffer `$7E:5700`), tiles 2bpp em `$5000` |
| OAM sombra | **`$7F:0000`** (544 B), copiada por DMA ch4 em `$C1:8BD1` a cada NMI |
| CGRAM sombra | **`$7E:8E00`** (512 B, LE), copiada por DMA em `$C4:19DE`. As paletas OBJ ficam em `$7E:8F00` |
| Savestate snes9x | bloco `PPU`: CGRAM (big-endian) no offset 64, `OAMData` no offset 2003. Bloco `FIL` = espelho dos registradores `$21xx` |

### 1.2 Objetos na RAM ✅
- Jogadores: `$0300 + n·$100` (n = 0..4).
- Demais objetos (bombas, chamas, soft blocks queimando, placar etc.): **`$0800 + n·$60`**. O ponteiro da rotina
  fica em `+$00` (3 B), e `$C3:0000` = slot livre.
- Campos de animação, iguais em todos os objetos:

| Campo | Tam. | Significado |
|---|---|---|
| `+$08` | 3 | ponteiro para o **1º quadro** da animação (endereço da animação + 1) |
| `+$0B` | 1 | nº de quadros da animação |
| `+$0C` | 1 | índice do quadro atual |
| `+$0D` | 1 | contador de duração (decrementa 1 por tick; `$FE` = congelado) |
| `+$0E` | 1 | paleta OBJ ×2 (atributo: `(+$0E & $0E)` vai para os bits de paleta) |
| `+$0F` | 1 | `$FF` = gráfico mudou, precisa de DMA (só jogadores) |
| `+$12/+$16` | 2+2 | X/Y (centro) |
| `+$18` | 2 | endereço VRAM (word) do slot 32×32 do jogador (`$6000`, `$6100`…) |
| `+$1C` | 2 | nº do tile OAM do slot (P1 `$000`, P2 `$004`, P3 `$040`, P4 `$044`, P5 `$048`) |
| `+$1E` | 2 | base de tile para objetos de tiles fixos (ex.: bomba voando `$100`) |
| `+$26` | 2 | **chave de ordenação** (cópia de Y, gravada a cada quadro em `$C2:1444`) |
| `+$28/+$2A` | 3 | endereço na ROM do gráfico atual (usado pelo DMA) |
| `+$A0/+$A2` | 3 | **base da folha do personagem** (`$C2:0730`[char]) |
| `+$A4/+$A6` | 3 | base da 2ª folha (`$D4:0000`, montarias) |
| `+$C0` bit0 | – | modo "animação move o objeto" (aplica dx/dy de cada quadro) 🟡 |
| `+$20` | 1 | slot do jogador (0..4): escolhe a **cor** |
| `+$22` | 1 | **personagem** (0..5, `&7`): escolhe a folha e o índice nas tabelas |

### 1.3 Motor de animação ✅
- **Iniciar uma animação** (`$C1:7657`, ponteiro da animação em `$54`): `+$0B = N`, `+$0C = 0`, `+$08 = ptr+1`,
  `+$0D` = duração do quadro 0. Depois calcula o gráfico e marca `+$0F = $FF`.
- **A cada tick**, nas rotinas de desenho `$C1:77E7` (jogador) e `$C4:4FB5` (objetos de tiles fixos): desenha o
  quadro atual. Se `+$0D == $FE` não faz mais nada. Senão decrementa `+$0D`. Ao chegar a 0 avança o quadro, voltando
  ao 0 depois do último (**todas as animações fazem loop**), e recarrega `+$0D`.
  - Duração `$FF` = infinito (vira `$FE` e congela).
  - Em estado normal, o quadro aparece exatamente `dur` ticks ✅ (andar: 12/8/12/8 medido).
- **Deslocamento por quadro** (bytes 4–5 do quadro, `s8 dx, s8 dy`): somado a X/Y no 1º tick do quadro quando
  `+$C0` bit0 está ligado (`$C1:7713` → `$C4:4E7F`). É usado nas animações de "tédio" e de salto. 🟡
- **Lag:** as durações contam ticks de lógica. Em explosões grandes o jogo pula quadros (o relógio `$1ECE` também
  para), e aí um quadro de 2 ticks aparece por 3 quadros de vídeo. **Para o port, use os valores da ROM.** ✅
- **DMA de gráfico dos jogadores:** no máximo **1 jogador por quadro** (`$C1:8601`, varre P1..P5 em rodízio a
  partir de `$0172`). Se vários mudam de quadro juntos, alguns só atualizam o desenho 1–4 quadros depois. É um
  detalhe de hardware que o port pode ignorar. ✅

### 1.4 Montagem da OAM e ordem de desenho ✅
- Cada objeto grava suas peças num buffer `$7F:0400+` e se insere (`$C1:855F`) numa **lista ligada ordenada** em
  `$7E:1C40`. O nó guarda `{next, chave, ptr, nº de peças}`, e a **chave é `+$26 + $100`**.
- A inserção mantém a ordem **decrescente** de chave, e em caso de empate o objeto que chega depois fica atrás.
  Depois `$C1:8ADC` copia a lista para a OAM em ordem, com índice menor = maior prioridade.
- Resultado: **quem tem Y maior é desenhado na frente**. Com Y igual, fica na frente o objeto processado antes
  (P1 antes de P5, jogadores antes dos objetos `$0800+`).
- Medido em `st_arena01`: P2 (Y 207), P4 (207), P5 (128), P3 (48), P1 (47) → OAM 0,1,2,3,4.
- Prioridade OAM dos jogadores = **2** (`attr |= $20`). Por isso ficam acima do BG2 (bombas, chamas, blocos,
  itens), que não usa o bit de prioridade.
- A tabela alta da OAM (bit de tamanho) vem do **bit 12 do atributo da peça**. Jogadores: sempre grande (32×32).
  Objetos: `attr & $1000` → 32×32, senão 16×16.

---

## 2. Formatos na ROM (para o carregador TS)

### 2.1 Animação ✅
```
u8  N
N × { u16 ms_lo; u8 ms_bank;   // ponteiro 24-bit para o metasprite
      u8  dur;                 // ticks (255 = infinito)
      s8  dx; s8 dy; }         // deslocamento do objeto no início do quadro (quase sempre 0,0)
```
### 2.2 Metasprite ✅
```
u8  N
N × { s16 dx; s16 dy;          // canto superior esquerdo da peça em relação à posição (X,Y) do objeto
      u16 attr; }              // bit15 V-flip, bit14 H-flip, bit12 tamanho grande (32x32),
                               // bits 9-11 soma à paleta, bits 0-8 índice de gráfico
```
- **Jogadores:** o índice de gráfico `g` (0..63) aponta para um quadro 32×32 da folha do personagem.
  O OAM usa o tile do slot (`+$1C`) e a paleta `+$0E`, com prioridade 2.
  - Quase todos os quadros têm uma peça em **(dx,dy) = (−16,−24)**: o sprite 32×32 fica com o topo 24 px acima e
    8 px abaixo do centro da casa.
  - Algumas animações usam dy −25…−33 (pulos, tédio, atordoado).
- **Objetos de tiles fixos** (bomba voando, coroa do placar etc.): o tile OAM é `+$1E + g`, e a paleta é
  `(+$0E) + bits 9-11`.

### 2.3 Gráfico do quadro dos jogadores ✅
- `offset(g) = (g % 4)·$80 + (g / 4)·$800`. É a tabela `$C1:7D5F` (4 B por índice, conferida para g = 0..127).
- O quadro são 4 linhas de 4 tiles (128 B cada), com as linhas **`$200` bytes** apartadas na ROM: a folha é uma
  imagem de 16 tiles de largura, com 4 quadros por faixa de 4 linhas.
- `addr = base_personagem + offset(g)`.

### 2.4 Folhas dos personagens — `$C2:0730`, 3 bytes por personagem (`+$22 & $3F`) ✅
| Personagem | Nome (visual) | Base da folha (64 quadros, 32 KB) | Arquivo |
|---|---|---|---|
| 0 | Bomberman branco | `$D2:0000` | `0x120000` |
| 1 | ciborgue de monóculo | `$CB:0000` | `0x0B0000` |
| 2 | felino laranja | `$CB:8000` | `0x0B8000` |
| 3 | cavaleiro alado | `$CC:0000` | `0x0C0000` |
| 4 | bomber verde blindado | `$CC:8000` | `0x0C8000` |
| 5 | bomber vermelho/roxo | `$CD:1800` | `0x0D1800` |
| 6, 7 | (= 0) | `$D2:0000` | |

Folha de montarias: `$D4:0000` (`+$A4`), que é assunto da frente *montarias-e-telas*.
Tela VICTORY: folha do vencedor em `$C2:8EBF` (3 B por personagem): `$DE:A000`, `$DE:A800`, `$DE:B000`,
`$DE:B800`, `$DE:C000`, `$DE:C800` (uma faixa de 4 quadros cada). ✅

### 2.5 Paletas (5 cores de jogador) — `$C2:779D`, 32 B por personagem, 4 B por slot ✅
`entrada = ptr24 paleta (16 cores BGR555 = 32 B crus) + byte atributo (+$0E)`; índice = `char·32 + slot·4`.
Carregada em `$C4:1986` na paleta OBJ `(attr >> 1)`. A cor 0 é transparente.

| slot → OBJ pal | 0 → 0 (P1) | 1 → 1 (P2) | 2 → 4 (P3) | 3 → 5 (P4) | 4 → 6 (P5) |
|---|---|---|---|---|---|
| char 0 | `$D7:E7DC` | `$D7:E7FC` | `$D7:E81C` | `$D7:E83C` | `$D7:E85C` |
| char 1 | `$D6:6D9B` | `$D6:6DBB` | `$D6:6DDB` | `$D6:6DFB` | `$D6:6E1B` |
| char 2 | `$D6:6CDB` | `$D6:6CFB` | `$D6:6D1B` | `$D6:6D3B` | `$D6:6D5B` |
| char 3 | `$D6:5FF9` | `$D6:6019` | `$D6:6039` | `$D6:6059` | `$D6:6079` |
| char 4 | `$D6:5E39` | `$D6:5E59` | `$D6:5E79` | `$D6:5E99` | `$D6:5EB9` |
| char 5 | `$D6:5EF9` | `$D6:5F19` | `$D6:5F39` | `$D6:5F59` | `$D6:5F79` |

- As cores são **branco / preto / vermelho / azul / verde** (slot 0..4). Veja `paletas_6personagens_x_5cores.png`.
- A tabela alternativa `$C2:7B9D` (mesmo formato) dá a mesma paleta aos 5 slots de um personagem. Ela é usada
  quando `$01A4 == [$C0:0B44]` e `$1F0E ∉ {0,2}` (modo em equipes, 🟡).
- Todas as cores estão em `animacoes.json` → `palettes`.

### 2.6 Seleção da animação por ação (tabelas por personagem) ✅
- **1º nível:** uma tabela de 16 ponteiros de 24 bits, indexada por **personagem** (`+$22 & 7`) e lida em
  `$C2:2EE9`. Em todas as tabelas do Battle **as 8 entradas são iguais**, ou seja, a animação é a mesma para todos.
- **2º nível:** a entrada aponta para uma tabela **indexada pela direção `+$62`** (3 B por entrada) ou direto para
  uma animação.
- **Código da direção `+$62`:** 0 = cima, 2 = direita, 4 = baixo, 6 = esquerda. Os ímpares (diagonais) caem no
  horizontal. **+8 = parado** nessa direção (8 cima, 10 dir., 12 baixo, 14 esq.). ✅
- Tabelas de 16 entradas: `[0]` cima, `[1..3]` direita, `[4]` baixo, `[5..7]` esquerda, `[8]` parado cima,
  `[9..11]` parado dir., `[12]` parado baixo, `[13..15]` parado esq.
- Tabelas de 8 entradas seguem o mesmo padrão sem a parte "parado".
- **Carregador TS:** `anim = p24(p24(tab1 + 3*char) + 3*dirIndex)`. Para as ações "diretas", use
  `p24(tab + 3*char)`.

---

## 3. Jogadores — tabela de ações (pronta para TS)

Notação: `gN:d` = gráfico N da folha por d ticks. Offset padrão (−16,−24), e `@dx,dy` quando difere.
Direções na ordem ↑ → ↓ ←. A duração total do ciclo está entre parênteses.

| Ação | 1º nível | 2º nível | Anim ↑ / → / ↓ / ← | Quadros | Status |
|---|---|---|---|---|---|
| **Parado** | `$C2:76C5` | `$C2:776D` [8,9,12,13] | `D8:165A` / `D8:1653` / `D8:1645` / `D8:164C` | g0 / g3 / g6 / g9, dur 255 | ✅ |
| **Andando** | `$C2:76C5` | `$C2:776D` [0,1,4,5] | `D8:16AC` / `D8:1693` / `D8:1661` / `D8:167A` | ↑ g1:12 g0:8 g2:12 g0:8 · → g4 g3 g5 g3 · ↓ g7 g6 g8 g6 · ← g10 g9 g11 g9 (40) | ✅ ritmo **não** depende da velocidade (medido com speed 1,3,5,8) |
| **Aparecer no início da rodada** | – | – | parado ↓ `D8:1645` | nenhuma animação especial: os jogadores surgem com o fade | ✅ |
| **Morte** | `$C2:6E15` (direto) | – | `D8:1999` | g24:5 g25:5 g26:6 g27:6 (22), depois **oculto** (rotina `$C2:1258`) | ✅ (com lag: 5-7-8-8 quadros) |
| **Vitória no fim da rodada** | `$C2:6F05` (direto) | – | `D8:2A74` | g45:12 g46:12 (loop até o fade, ~230 quadros) | ✅ começa no mesmo tick em que o último adversário é atingido |
| **Tela VICTORY — vencedor** | `$C2:8EEC` (direto) | – | `C3:E7F7` | g0:12 g1:12 da folha `$C2:8EBF`[char] | ✅ |
| **Tela VICTORY — demais** | – | `$C2:6EBD`[8] | `D8:2A81` | g52:15 g53:15 g52:15 g54:15 (palmas, 60) | ✅ |
| **Luva: levantar bomba** (segurar A sobre a bomba) | `$C2:7515` | `$C2:7545` | `D8:1DD2` / `D8:1DB9` / `D8:1D87` / `D8:1DA0` | g32 / g35 / g38 / g41, 4×2 = 8 | ✅ |
| **Luva: parado c/ bomba** | `$C2:7665` | `$C2:7695` [8,9,12,13] | `D8:208C` / `D8:2085` / `D8:2077` / `D8:207E` | g32 / g35 / g38 / g41, 255 | ✅ |
| **Luva: andando c/ bomba** | `$C2:7665` | `$C2:7695` [0,1,4,5] | `D8:20DE` / `D8:20C5` / `D8:2093` / `D8:20AC` | ↑ g33:12 g32:8 g34:12 g32:8 · → g36 g35 g37 g35 · ↓ g39 g38 g40 g38 · ← g42 g41 g43 g41 | ✅ |
| **Luva: arremessar** (soltar A) | `$C2:755D` | `$C2:758D` | `D8:1F48` / `D8:1F41` / `D8:1F33` / `D8:1F3A` | g28 / g29 / g30 / g31, 20 (a pose dura ~28 quadros) | ✅ |
| **Soco** (item Soco + **Y**) | `$C2:746D` | `$C2:7485` | `D8:205E` / `D8:2045` / `D8:2013` / `D8:202C` | g12 / g13 / g14 / g15, 4×2 = 8 | ✅ (com ou sem bomba à frente) |
| **Chute** | – | – | nenhuma: continua a animação de andar | – | ✅ |
| **Botão B** (detonar) | `$C2:6CE8` | `$C2:6D18`[12] | `D8:2AA7` | g47 por 3 quadros (acontece mesmo sem bomba remota) | ✅ |
| **Item "P" + Y** | `$C2:749D` | `$C2:74B5` | `D8:2ADF` / `D8:2AD8` / `D8:2ACA` / `D8:2AD1` | g60 / g61 / g62 / g63 (braço estendido), ~40 quadros | ✅ anim / 🟡 efeito do item |
| **Atordoado** (bomba caiu na cabeça) | `$C2:6F71` | `$C2:6FA1`[10] | `D8:19B2` | g0:4 g3:4 g6:4 g9:4, girando; 64 ticks (`+$94` até `$40`), depois parado | ✅ |
| **Tédio** (parado ~383 quadros) | `$C2:6F71` | `$C2:6FA1`[**4 + char**] | char0 `D8:2A0D`, 1 `D8:023D`, 2 `D8:02E0`, 3 `D8:0335`, 4 `D8:03FC`, 5 `D8:046F` | sequências longas com deslocamento (veja `anim_tedio_por_personagem.png`) | ✅ (chars 0–4 medidos; 5 🟡) |
| **Doente (caveira)** | – | – | a mesma animação da ação atual | só muda a paleta (§4) | ✅ |
| **Invencível** | – | – | a mesma animação | pisca 2/2 (§4) | ✅ |
| Choque | `$C2:6CE8` | `$C2:6D18`[4..11] | `D8:2A9A` | g50:3 g55:3 (g55 = eletrocutado) | 🟡 gatilho não testado (arena 5?) |
| Pulinhos em direção | `$C2:6CE8` | `$C2:6D18`[0..3] | `D8:2A00`… | g20-23 @−29 alternando com g56-59, 4 cada | 🟡 |
| Saltos com deslocamento | `$C2:6F35`, `$C2:6F71`[0..3], `$C2:6FC5` | `$C2:6F65`, `$C2:6FA1`, `$C2:6FF5` | ↑`D8:0A1E`… | g20-23 com dy por quadro | 🟡 (lançado por gangorra ou pelo piso das arenas especiais?) |
| g48-51, dur 1 ×8–14 | `$C2:7085`, `$C2:70C1`, `$C2:70FD`, `$C2:7139`, `$C2:7431` | `$C2:70B5`, `$C2:70F1`, `$C2:712D`, `$C2:7169`, `$C2:7461` | – | movimento por quadro | 🟡 (provavelmente arenas especiais ou montarias) |
| Montado | `$C2:76F5` (índice = `+$45 & 7`) | `$C2:770D` / `$C2:773D` | mesmos gráficos de andar e parado | – | 🟡 (frente *montarias*) |
| Montarias | `$C2:6C1C`, `$C2:6C4C`, `$C2:6E45`, `$C2:6E8D`, `$C2:74CD`, `$C2:7001` | – | folha `$D4:0000` | – | 🟡 fora do escopo |

**Mapa dos 64 quadros** (vale para os 6 personagens, veja `folha_gfx_6personagens_idx.png`):

| g | Conteúdo |
|---|---|
| 0–2 | ↑ parado, passo, passo |
| 3–5 | → |
| 6–8 | ↓ |
| 9–11 | ← |
| 12–15 | soco ↑→↓← |
| 20–23 | pose de salto/choque ↑→↓← |
| 24–27 | morte (queimado → enegrecido → dissolvendo) |
| 28–31 | arremesso ↑→↓← |
| 32–43 | carregando a bomba (3 por direção: parado, passo, passo) |
| 44 | só a sombra |
| 45–46 | vitória (V de vitória) |
| 47 | pose do botão B |
| 48–51 | sentado ↑→↓← |
| 50/55 | choque |
| 52–54 | palmas |
| 56–59 | variantes paradas |
| 60–63 | pose do item P ↑→↓← |

Posição na OAM: `x = X − 16`, `y = Y − 24` (Y = centro da casa em coordenadas de tela). ✅

---

## 4. Efeitos de paleta e visibilidade ✅

| Efeito | Regra exata | Onde |
|---|---|---|
| **Caveira** (`+$4D ≠ 0`, exceto o tipo `$29`) | a cada 4 ticks, com `$016C & 3 == 0`: paleta = normal se `($016C & 4) == 0`, senão **a paleta de `$C0:0B5E` (16 × `0000`, silhueta preta)**. Medido: `NFFFFNNNNFFFF…` (4/4) | `$C1:758C` |
| **Invencível** (`+$96 > 0`, 489 quadros depois do item 08) | `+$96` decrementa por tick. **Não desenha se `+$96 & 2`**, o que dá 2 visível / 2 oculto. Com caveira ao mesmo tempo, a paleta alterna a cada chamada (`+$F6`) | `$C1:77E7` |
| **Morte** | depois do último quadro de `D8:1999` o objeto some da OAM; `$1EA0` cai cerca de 78 quadros depois | `$C2:1258` |

Veja `efeitos_caveira_invencivel.png`.

---

## 5. Bomba ✅

### 5.1 Bomba parada = tile 16×16 de BG2 animado por *script*
- Formato do script: repetição de `{u16 palavra de tilemap, u8 duração}`. `FFFF` = volta ao início, `FFFE` = para.
- A rotina `$C1:5655` grava a palavra em `$7E:2000 + casa`.
- A tabela de scripts é indexada pelo tipo (`+$22` do objeto bomba, que vem de `+$43` do jogador):
  - `$C1:56A8`: normal;
  - `$C1:56BD`: variante com `+$2E & 4`;
  - `$C1:56D2`: variante com `+$2E & 8`.

| Tipo (`+$43`) | Script | Tiles (16×16, paleta BG 2) | Durações | Visual |
|---|---|---|---|---|
| 0 normal | `$C1:5739` | `0B00 0B02 0B04 0B06` | 20 12 16 16 (loop 64) | bomba pulsando |
| 1 remota | `$C1:5753` | `0B08 0B0A 0B0C 0B0E` | 16 16 16 16 | com antena; só explode com B |
| 2 | `$C1:5761` | `0BC8…0BCE` | 28 16 24 16 | bomba com espinhos |
| 3 | `$C1:56EB` | `0BC0…0BC6` | 20 12 16 16 | "D" |
| 4 | `$C1:5705` | `0BE0…0BE6` | 20 12 16 16 | "S" |
| 5 | `$C1:571F` | `0BE8…0BEE` | 20 12 16 16 (medido 2× mais lento) | "H" |

- Variantes `$C1:56BD` / `$C1:56D2` (paleta BG 1, tiles `0x9xx`, mesmas durações): condição `+$2E` 🟡.
- No Battle só aparecem os tipos 0 e 1 (item 06). Os tipos 2–5 existem e foram medidos forçando `+$43`.
- Medido (tipo 0): `0B00×18 0B02×12 0B04×16 0B06×16 0B00×20 0B02×12 0B04×16 0B06×14` e então a chama. O 1º
  quadro vem 2 ticks mais curto e o último é cortado pela explosão.
- Os tiles vêm do tileset de BG da fase. **O desenho da bomba é o mesmo nas 10 fases**, mas o piso de cada fase
  já vem composto no tile (a frente *graficos-formato* faz `composite_floor`).

### 5.2 Bomba em movimento = sprite ✅
Chutada, socada, arremessada ou carregada, a bomba vira objeto OBJ com a animação `D8:D3A8`: 1 quadro, peça
16×16 em (−8,−8), tile `$100 + $80 = $180`, paleta OBJ 7 (`attr $2F`), sem pulsar.

| Situação | Trajetória medida (tela) |
|---|---|
| **Chute** | desliza 2 px/quadro na direção. O objeto é `$C1:35E1` ✅ |
| **Soco** | 3 casas, arco de ~9 px, em 16 quadros. Medido de (96,80) para a esquerda: (93,76) (82,72) (71,70) (62,71) (53,74) (48,80) a cada 3 quadros. Objeto `$C1:2798` ✅ |
| **Luva, levantar** | y −6, −4, −4, −2 em 4 quadros. Depois fica em (X, Y−16) do jogador ✅ |
| **Luva, arremessar** | 5 casas em ~15 ticks; dx ≈ +7/tick; y: 60, 56, 53, 51, 50, 50, 52, 55, 59, 66, 73, pousa em 79 (partindo de Y=64 na mão) ✅ |
| Bomba quicando | anim `D8:D3AF` (3 quadros × 5, objeto `$C1:662F`) — quando cai sobre um bloco? 🟡 |

---

## 6. Chamas ✅

Tiles 16×16 de BG2, paleta 3. Cada casa da chama fica com a palavra `base + fase`, com as fases
**A = +$00, B = +$20, C = +$40**:

| Peça | Palavra (fase A) | Observação |
|---|---|---|
| centro | `0F6C` | |
| braço horizontal | `0F6A` | esquerda usa H-flip `4F6A` |
| ponta direita | `0F66` | ponta esquerda `4F66` |
| braço vertical | `0F68` | para baixo usa V-flip `8F68` |
| ponta de cima | `0F60` | ponta de baixo `8F60` |

- **Sequência de cada casa (em ticks), igual para todas as peças e casas, em sincronia:**
  `A:2 B:2 C:2 B:2 C:2 B:2 C:2 B:2 C:2 B:2 C:2 B:2 A:1` = **25 ticks**. Depois a casa volta ao piso.
- Sem lag (arena 5) são exatamente 25 quadros. Com lag (arena 1, centro), 2-2-3-3-2-3-3-2-3-3-2-3-1 = 32 quadros
  de vídeo, e o relógio pula 8 quadros no mesmo intervalo (log `1110111…`).
- O logic grid fica `$1000` durante as 25 casas-tick.
- Alcance e ordem de expansão são da frente *mecanicas*. Aqui todas as casas aparecem no mesmo tick.

---

## 7. Soft block destruído e item atingido ✅

| Evento | Tiles (palavra BG2) | Ticks | Rotina / tabela |
|---|---|---|---|
| **Soft block queimando** | `0C20 0C22 0C24 0C26 0C28 0C2A` (paleta 3, tiles 0x020..0x02A) | 4 cada = 24 | objeto `$C1:595B`, tabela `$C1:5A23` (índice `+$2C` += 2 por tick, atualiza a cada 2 passos) |
| Começa | no mesmo tick da chama (logic = `$EDC0`) | | |
| Depois | piso, ou o **item** que estava escondido (ex.: `12EC` = soco) | | |
| **Item (ou bomba) atingido pelo fogo** | `0F2E 0F4E 0F6E 0F8E 0FAE` (paleta 3) | 4 cada = 20 | objeto `$C1:58C4`, tabela `$C1:5906` |

- O **desenho do soft block queimando é diferente em cada fase** (tiles 0x020–0x02A do tileset da fase, veja
  `bg_objetos_arenaNN.png`). O desenho do item queimando é igual em todas.
- **Itens:** tiles de BG2 paleta 4. Palavras principais (`$12xx`):

| Item | Palavra | Item | Palavra |
|---|---|---|---|
| Bomba | `1280` | Chute | `12A4` |
| Fogo | `1282` | Luva | `12A6` |
| Patins | `12A2` | P | `12A8` |
| Soco | `12EC` | Caveira | `128A` |

Todos os tiles de item estão nas linhas "tiles 0x280.." da folha BG.

- **Piscar dos itens:** não troca o tile. A cor 15 da paleta BG 4 (CGRAM 79) recebe `7D80` se `$016C & 4`, senão
  `00BF`. Dá 4 quadros azul / 4 vermelho, na moldura de todos os itens ao mesmo tempo (`$C1:0965`). ✅
  `$016C` é o contador de quadros global.

---

## 8. Blocos da pressão ✅

Medido em `st_arena05` com o relógio ajustado. Para a casa (32,48), que é a primeira da espiral:

| Tick | Evento |
|---|---|
| t0 | aparece a **sombra**: OBJ 16×16 tile `$4E`, `attr $2E` (paleta 7, prioridade 2), em (X−8, Y−8) = a casa inteira (quadrado escuro) |
| t0+33 | aparece o **bloco caindo**: OBJ 16×16 tile `$4C`, mesma paleta, x = X−8, y = 0 → 8 → 16 → 24 → 32 (**8 px/tick**, termina 8 px acima da casa) |
| t0+37 | grid visual = **`082E`** (tile 0x02E, paleta BG 2), logic = `$EE80`. O sprite continua por 2 ticks |
| t0+39 | somem o sprite e a sombra |

- Sempre há até 3 sombras à frente do bloco que está caindo. Um bloco novo começa a cair a cada ~17–19 quadros (medido).
- O ritmo, a espiral e o esmagamento são da frente *mecanicas*.
- Os 3 gráficos estão na folha BG ("sprites: sombra, bloco caindo, bomba" e "bloco pressão (BG pousado)").

---

## 9. HUD, placar e coroa

- **HUD (BG3, 2bpp)**: é estático durante a rodada. Só os dígitos do relógio mudam (palavras `$2630+n` nas
  posições 7, 39, 71 do buffer `$7E:5700`). As cabeças do HUD não mudam quando um jogador morre (medido). ✅
  Os tiles são da frente *graficos-formato*.
- **Placar (Score Board)**:
  - as cabeças são OBJ 32×32 (tiles `$80`, `$84`, `$88`, `$C4`, `$C8`, `attr $30/$32/$34/$36/$38` = paletas 0–4,
    prioridade 3), animações 1-quadro `C3:E028`… (objetos `$C2:97A2`);
  - a **coroa nova gira** com a animação **`C3:DA94`**: 32 quadros de peças 32×32 com base de tile `$100`
    (`$106`, `$10A`, `$140`, `$144`, um quadro de 4 peças 16×16 `$148`/`$168`, e as mesmas espelhadas);
  - as durações desaceleram: 1×10, 2×9, 3×4, 4, 5×3, 6, 7, 8, 10, 14;
  - depois a coroa fica parada no tile `$106` (paleta OBJ 5, prioridade 3). ✅
  - Veja `placar_coroa_cabecas.png`.
- Tela **VICTORY**: veja §3 (vencedor `C3:E7F7` com a folha `$DE:xx00`; os outros com palmas `D8:2A81`). ✅

---

## 10. Como o carregador TS deve ler (pseudocódigo)

```ts
const hirom = (a: number) => ((a >> 16) & 0x3f) << 16 | (a & 0xffff);
const p24 = (a: number) => rom[hirom(a)] | rom[hirom(a) + 1] << 8 | rom[hirom(a) + 2] << 16;
const s16 = (v: number) => (v << 16) >> 16, s8 = (v: number) => (v << 24) >> 24;

function readAnim(a: number) {                  // §2.1
  const n = rom[hirom(a)], frames = [];
  for (let i = 0; i < n; i++) {
    const o = a + 1 + 6 * i, ms = p24(o);
    frames.push({ dur: rom[hirom(o + 3)], move: [s8(rom[hirom(o + 4)]), s8(rom[hirom(o + 5)])], pieces: readMs(ms) });
  }
  return frames;
}
function readMs(a: number) {                    // §2.2
  const n = rom[hirom(a)], out = [];
  for (let i = 0; i < n; i++) {
    const o = hirom(a + 1 + 6 * i), attr = rom[o + 4] | rom[o + 5] << 8;
    out.push({ dx: s16(rom[o] | rom[o + 1] << 8), dy: s16(rom[o + 2] | rom[o + 3] << 8),
               gfx: attr & 0x1ff, hflip: !!(attr & 0x4000), vflip: !!(attr & 0x8000),
               big: !!(attr & 0x1000), palAdd: (attr >> 9) & 7 });
  }
  return out;
}
const charSheet = (c: number) => p24(0xC20730 + 3 * c);                      // §2.4
const frameAddr = (c: number, g: number) => charSheet(c) + (g & 3) * 0x80 + (g >> 2) * 0x800;
// frame 32x32: 4 linhas de tiles; linha r = 128 bytes em frameAddr + r*0x200 (4 tiles 4bpp de 32 B)
const palette = (c: number, slot: number) => p24(0xC2779D + 32 * c + 4 * slot);  // 32 B BGR555
const animFor = (tab1: number, c: number, dirIdx: number) => p24(p24(tab1 + 3 * c) + 3 * dirIdx);
// ex.: andar para a direita = animFor(0xC276C5, c, 1); parado para baixo = animFor(0xC276C5, c, 12)
```
Regras do tick: §1.3. Ordem de desenho: §1.4. `animacoes.json` traz as 141 animações já decodificadas para
comparar com a saída do carregador.

---

## 11. Em aberto

- 🟡 O que ativa as tabelas `$C2:6CE8` [0..3], `$C2:6F35`, `$C2:6FC5`, `$C2:7085`, `$C2:70C1`, `$C2:70FD`,
  `$C2:7139`, `$C2:7431` (g20-23 e g48-51 com deslocamento por quadro). Provavelmente as mecânicas das arenas
  especiais (gangorra da 9, piso/esteira da 2 e da 6, choque da 5) e montarias. As animações já estão
  decodificadas; falta ligar cada uma ao gatilho.
- 🟡 Efeito real do item **P** (`+$D8`): a animação g60-63 dura ~40 quadros, mas o efeito não foi descoberto.
- 🟡 Condição das variantes de script de bomba `$C1:56BD` / `$C1:56D2` (`+$2E` bits 2/3).
- 🟡 Animação `D8:D3AF` (bomba quicando?).
- 🟡 Tédio do personagem 5 (`D8:046F`): lido na tabela, sem medição.
- ❌ Tela do placar a partir de `win.bin` (vitória forçada escrevendo posições) ficou em *forced blank*; com uma
  rodada natural de CPU (`st_matchend`) funcionou.

---

## 12. Como reproduzir

Python: `/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/venv/bin/python`.
Rode dentro desta pasta.

| Arquivo | Função |
|---|---|
| `st.py` | lê o savestate (blocos PPU/VRA/RAM/FIL), acessa a ROM e dá `oam(e)` (lê a sombra `$7F:0000`), `cgram(e)` (`$7E:8E00`) e `emu(dbg, state)` |
| `anims.py` | `parse_anim`, `parse_ms`, `gfx_off`, `char_base`, `char_pal`, `fmt_anim` |
| `gfx.py`, `render.py`, `vram.py` | renderização de tiles da ROM e da VRAM |
| `rec.py` | gravador quadro a quadro do estado de animação dos jogadores: `run`, `summarize`, `print_runs` |
| `bomb_seq.py`, `objs.py` | sequência de tiles do grid por casa; objetos `$0800+` |
| `tlist.py` | *trace* de CPU com disassembly nas flags reais: `python tlist.py st_arena01 2 1 C17700 C17A00` |
| `folhas.py`, `folhas_bg.py`, `folhas_extra.py <sb.bin>` | geram os PNG |
| `dump_json.py` | gera `animacoes.json` |

- **Core com rastreio:**
  `scratchpad/rom-animacoes/snes9x/libretro/snes9x_libretro.dylib`. Cópia do snes9x com `dbg.cpp`:
  - leitor e gravador por byte de ROM/WRAM;
  - log de leituras, escritas, execução e DMA;
  - ganchos em `getset.h`, `cpuexec.cpp`, `dma.cpp` e `libretro.cpp`.

  `st.emu(True, …)` usa esse core.
- **Medições principais:**

| Medição | Como provocar |
|---|---|
| Andar | `rec.run(e, 120, {'p0':['DOWN']})` em `st_arena05` |
| Morte | `st_arena01`, 60 quadros, depois A, e esperar 300 |
| Vitória | colocar a bomba, levar P1 para (128,128) e P2..P5 para (48,48) |
| Luva, soco, P | escrever `+$48/$49/$4A/$D8` e usar A (segurar) e Y |
| Chute | bomba em (128,80), andar 34 quadros para a direita e voltar |
| Bomba na cabeça | P2 em (144,80), arremesso de P1 partindo de (64,80) |
| Caveira | `+$4D=$21`, `+$4E=$FF` |
| Invencível | `+$96=$1E9` |
| Pressão | `$1ED2=1`, `$1ED0=3` em `st_arena05` |
| Placar | rodar `st_matchend` até `$1F3A` mudar |

Os scripts e os comandos exatos estão nesta pasta. Os testes de controle estão no histórico da sessão e se refazem
com `rec.run` e `objs.objs`.
