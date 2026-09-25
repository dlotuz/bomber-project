# Frente graficos-formato — como os gráficos do Battle Mode estão guardados na ROM

ROM analisada: `Super Bomberman 4 (USA).sfc` (4 MB, HiROM, SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`,
com o patch de tradução em `$E0–$E2`). Marcações: ✅ medido/confirmado · 🟡 provável · ❌ não encontrado.

## 1. Resumo

| Pergunta | Resposta |
|---|---|
| Há LZ/compressão Hudson? | ❌ **Não nos gráficos do Battle.** Há só **um formato de "compressão" de tiles** (elisão de tile zerado, "ZTE") e um **RLE duplo do Modo 7** usado apenas no DRAW GAME. ✅ |
| Como os tiles chegam à VRAM | Tiles ZTE são descomprimidos na WRAM (`$7F:8000` = 32 KB de BG; `$7F:0800` = 2 KB de OBJ; `$7F:208C` = pedaços) e enviados por DMA. Sprites dos personagens e a fonte do HUD vão **crus, por DMA direto da ROM**. ✅ |
| Paletas | **Cruas** (BGR555, 32 bytes por paleta), copiadas para um buffer `$7E:8E00` (512 bytes) enviado à CGRAM todo quadro (`$C4:19DE`). ✅ |
| Validação | **307/307** chamadas dos descompressores do jogo idênticas byte a byte ao `decomp.py` (91 blocos distintos). Os 32 KB de tiles de BG das **10 arenas** (11 envios, contando o 2º da arena 9) idênticos. O RLE do Modo 7 idêntico. Em todas as 24 capturas de tela, **100 % dos bytes de tiles (BG e OBJ) que o jogo escreveu na VRAM foram reconstruídos da ROM e batem** (tabela §6). ✅ |
| Entregáveis | `decomp.py` (descompressores), `catalogo.json` (o que o carregador lê), `catalogo.md`, `STATUS.md`, PNGs em `analise/extraido/graficos-formato/png/`. |

## 2. Formatos (especificação para portar para TypeScript)

Convenções: endereço SNES `$BB:AAAA`. Bancos `$C0–$FF` (HiROM): `offsetArquivo = ((BB - 0xC0) << 16) | AAAA`.
(Os mesmos bytes aparecem em `$40–$7D` e na metade alta de `$00–$3F/$80–$BF`, mas todos os ponteiros usados aqui
estão em `$C0–$FF`.) Ponteiros de 24 bits na ROM são little-endian (`lo, hi, banco`). ✅

### 2.1 ZTE — tiles com elisão de tile zerado ✅ (rotinas `$C4:09A5` e `$C1:874D`, equivalentes)

```
entrada: p = offset do bloco
Z = rom[p]; E = rom[p+1]; i = p + 2; out = []
loop:
  b = rom[i]
  if b == Z:  out += 32 × 0x00;  i += 1          // tile vazio (testado ANTES de E)
  elif b == E: i += 1; break                    // fim
  else:        out += rom[i .. i+31]; i += 32   // tile literal; b é o 1º byte dele
tamanhoComprimido = i - p
```
- Unidade = 32 bytes = 1 tile 4bpp planar (bytes 0–15: planos 0/1 intercalados por linha; 16–31: planos 2/3).
- Não há limite de tamanho no formato; blocos de BG têm 4096 bytes (128 tiles), blocos de OBJ 2048 bytes. ✅
- `$C4:09A5` lê com `[ptr],Y` (Y 16 bits: atravessa banco); `$C1:874D` incrementa o ponteiro 16 bits sem carry.
  Nenhum dos 91 blocos usados cruza fronteira de banco, então os dois são equivalentes na prática. ✅
- TypeScript:
```ts
export function decodeZte(rom: Uint8Array, p: number): { data: Uint8Array; used: number } {
  const z = rom[p], e = rom[p + 1]; let i = p + 2; const out: number[] = [];
  for (;;) {
    const b = rom[i];
    if (b === z) { for (let k = 0; k < 32; k++) out.push(0); i += 1; }
    else if (b === e) { i += 1; break; }
    else { for (let k = 0; k < 32; k++) out.push(rom[i + k]); i += 32; }
  }
  return { data: Uint8Array.from(out), used: i - p };
}
```

### 2.2 Composição de piso (`$C4:4BDD` → núcleo `$C4:4C5C`) ✅
Aplicada sempre no tileset de 32 KB das arenas, depois dos 8 blocos. Para `n = 0..255` (tiles 768–1023 do buffer):
```
d = 0x6000 + 32*n ;  s = 32 * (8 + (n & 1) + 16 * ((n >> 4) & 1))     // tiles 8/9/24/25 = piso 16x16
para cada linha r = 0..7:
  m = ~(buf[d+2r] | buf[d+2r+1] | buf[d+16+2r] | buf[d+17+2r]) & 0xFF   // pixels de cor 0
  para cada um dos 4 bytes-plano x ∈ {2r, 2r+1, 16+2r, 17+2r}:  buf[d+x] = (buf[d+x] & ~m) | (buf[s+x] & m)
```
Genérico (`composite(buf, src, dst, ntiles)` em `decomp.py`): o mesmo com `src`/`dst`/quantidade parametrizados.

### 2.3 Pós-processamento da arena 9 (`$C3:215C`, no início da partida) ✅
Offsets relativos ao buffer de 32 KB: copia `[0x2000,+0x400)→0x2C00`, `[0x3800,+0x800)→0x2400`,
`[0x3800,+0x800)→0x3000`; depois `composite(src=0x1D80, dst=0x2000, 96)` e `composite(src=0x1C80, dst=0x2C00, 96)`.
O jogo reenvia os 32 KB à VRAM (2º DMA, validado).

### 2.4 RLE duplo do Modo 7 (`$C4:6201`, só no DRAW GAME) ✅
Gera 16384 palavras (32 KB) para a VRAM `$0000`. Dois fluxos independentes, cada um com seu contador:
- pixels (byte alto, CHR 8bpp do Modo 7), ponteiro `$58`: `b < 0x80` → literal (1 byte); `b ≥ 0x80` → valor
  `b & 0x7F` repetido `N` vezes, `N` = byte seguinte (2 bytes).
- mapa (byte baixo), ponteiro `$5C`: `b != 0x01` → literal; `b == 0x01` → `N` = próximo byte, valor = o seguinte (3 bytes).
DRAW GAME: pixels `$CD:9800` (6548 bytes consumidos), mapa `$D6:60D9` (499 bytes). (`N = 0` significaria 256; não ocorre.)

### 2.5 Paletas, tiles crus ✅
- Paleta: 16 × BGR555 LE; cor → RGB8: `r = (v & 31)`, `g = (v >> 5) & 31`, `b = (v >> 10) & 31`, `c8 = (c << 3) | (c >> 2)`.
- 4bpp: pixel(x,y) = bit `7-x` de `t[2y]`, `t[2y+1]`, `t[16+2y]`, `t[17+2y]` (planos 0..3). 2bpp: `t[2y]`, `t[2y+1]`.

## 3. Onde cada cena busca os gráficos (transferências medidas)

Rastreio: core snes9x instrumentado (DMA `$420B` com origem/destino/tamanho/VMADD/CGADD, escritas de CPU em
`$2118/$2119/$2122`, "último escritor" de cada byte da WRAM, breakpoints nas rotinas de gráfico com dump da saída).
Nenhuma escrita de CPU direta em `$2118/$2119/$2122` foi observada: **tudo entra por DMA** (canal 4). ✅

Transferências recorrentes (todo quadro, não são gráficos novos): `$7E:8E00`→CGRAM (512 B, `$C4:19DE`);
`$7F:0000`→OAM (544 B); `$7E:5000`→VRAM `$4000` (960 B, mapa); `$C1:88E6`→`$2180` (limpa buffer de OAM). ✅

### 3.1 Estrutura comum: "script gráfico" de 48 bytes ✅
`8 × ponteiro24` de blocos ZTE (→ `$7F:8000 + $1000·i`) + `8 × ponteiro24` de paletas de BG (→ CGRAM `16·i`).
Carregado por `$C4:092E` (arenas: 8×`$C4:09A5`, `$C4:4BDD`, DMA `$C4:096B` 32 KB → VRAM `$0000`, `$C4:0A05` paletas,
`$C4:4E2F` correção) ou pela rotina do patch `$E0:FE44` (título e menus: sem composição).

| Cena | Script (48 B) | Outras cargas | Captura |
|---|---|---|---|
| Arena n (1–10) | `r24($C3:6233 + 3(n-1))` → descritor; `r24(descritor)` → script (`$C3:7542`, `…7572`, `…75D2`, `…7602`, `…7632`, `…7662`, `…7692`, `…76C2`, `…7722`, `…7752`) | BG3 cru `$D1:BC16`→`$5000`, `$D0:F57B`→`$5200`; OBJ ZTE `$C8:FD36`→`$6800`, `$D1:87CE`→`$7000`, `$D1:8F93`→`$7400`, `$D1:967F`→`$7800`, `$C5:013B`→`$7C00` (+`$C8:FA44` na arena 3), `$C7:FEA1`→`$64C0/$65C0`, `$C5:FE5C`→BG `$02E0/$03E0`; HUD `$C4:6170`; sprites dos jogadores por DMA direto | `arena01..10` |
| Título | `$C1:C182` | OBJ ZTE `$C8:0000,$C8:0670,$C8:0C64,$C7:FA7E,$C7:E1B6,$C7:E6F0,$C7:EE58,$C7:F46B`; textos crus do patch `$E2:24AB..` | `title` |
| Menus VS/FFA/jogadores/regras | `$C1:C1B2` | textos crus do patch (`$E1:0027`, `$E1:3335`, …, copiados para `$7F:8000`); OBJ `$C9:F997` | `vsmode, ffa, players, rules` |
| Seleção de personagem | `$C1:C1E2` | OBJ ZTE `$CE:53D7,$CE:5BBB,$CE:60F5`; crus do patch `$E0:6880`, `$E1:B699/B899` | `charsel` |
| Seleção de fase | `$C1:C1E2`, depois `$C1:A901` (8 blocos das prévias, sem paletas, via `$C1:A262`) | nomes das fases: tiles crus do patch `$E0:0021..$E0:37E9` (DMA direto `$E0:401B..$E0:41D4`) | `stagesel` |
| Placar e VICTORY! | `$C2:9C35` (mesmo tileset para os dois) | OBJ ZTE `$C9:F997,$CA:F0B0,$CA:F8B3,$CD:E585` (coroas, troféu, cabeças); poses dos personagens por DMA direto | `scoreboard, victory` |
| DRAW GAME | — | Modo 7 RLE (`$CD:9800` + `$D6:60D9`); depois ZTE `$CD:B195,$CD:C11C,$CD:D11F,$CD:E122` (tabela `$C2:DC09`) → `$7F:208C` → VRAM `$4000–$5BFF` (tiles do BG2) | `draw1, draw2` |

Lista completa, na ordem, com offsets dentro de cada bloco: `catalogo.json → cenas.<tela>.vram` ✅.

### 3.2 Arenas: tabelas de ponteiros ✅
- `$C3:6233`: 12 ponteiros de 24 bits (10 arenas do Battle + 2 extras `$C3:684D`, `$C3:682B`); outras 3 tabelas
  paralelas (`$C3:625D`, `$C3:6287`, `$C3:62B1`) apontam para as variantes `+$22`, `+$44`, `+$66`.
- Registro por arena: `$88` bytes = 4 variantes de `$22` bytes; campo `+0` = script gráfico (igual nas 4 variantes),
  `+3/+6/+9/+C/+F/+12` = ponteiros de mapas/layout (frente arenas-cenario).
- Blocos 0–3 do script = cenário próprio; blocos 4–7 = **iguais nas 10 arenas**: HUD `$CF:93B4`, itens `$D1:C016`,
  bombas/chamas `$D1:D019` e `$D1:E01C` (estes dois recebem o piso por baixo pela composição).
- Paletas de BG: as 8 do script, e em seguida as cores 13–15 da paleta 7 são copiadas para as paletas 2 e 3
  (`$C4:4E2F`). Conferido com a CGRAM: 122–127 de 128 cores iguais; as diferenças são **animação de paleta em jogo**
  (pal 4 cor 15 em todas; arena 8 pal 0 cor 0; arena 9 pal 5 cores 12–15; arena 10 pal 5 cores 4–8). ✅
- Durante a partida alguns tiles de BG são trocados (animação), sempre a partir de blocos ZTE da ROM: cabeças do HUD
  (tiles 515–553, blocos `$CF:9F7A/$CF:AF7D/$CF:BD90`), tiles 46/47/62/63 (`$C5:FE5C`), arena 5 (tiles `$80–$9D`),
  arena 8 (rolos do caça-níquel, tiles `$100–$135`), arena 9 (`$D1:E922/$D1:E942`). Tabela em
  `analise/extraido/graficos-formato/animacoes_bg_arenas.txt`. 🟡 (fonte confirmada; ritmo não medido)

### 3.3 Personagens ✅
| id | Personagem | Sprites (4bpp cru) | Paletas P1–P5 |
|---|---|---|---|
| 0 | Bomberman branco | `$D2:0000–$D2:7FFF` | `$D7:E7DC, E7FC, E81C, E83C, E85C` |
| 1 | ciborgue de monóculo | `$CB:0000–$CB:7FFF` | `$D6:6D9B, 6DBB, 6DDB, 6DFB, 6E1B` |
| 2 | bomber de capacete amarelo | `$CB:8000–$CB:FFFF` | `$D6:6CDB, 6CFB, 6D1B, 6D3B, 6D5B` |
| 3 | cavaleiro alado (mochila de asas) | `$CC:0000–$CC:7FFF` + quadros em `$CA` com ponteiros por linha (ex.: `$CA:0DC3, 0F47, 10EA, 128D`) | `$D6:5FF9, 6019, 6039, 6059, 6079` |
| 4 | verde blindado | `$CC:8000–$CC:FFFF` | `$D6:5E39, 5E59, 5E79, 5E99, 5EB9` |
| 5 | vermelho/roxo | `$CD:0000–$CD:7FFF` | `$D6:5EF9, 5F19, 5F39, 5F59, 5F79` |

- Mapeamento confirmado pelo DMA de cada jogador na partida (personagens padrão 0–4 em P1–P5) e escolhendo o
  6º personagem para P1 (DMA passou a vir de `$CD`). ✅
- Folhas com 16 tiles de largura (linha de tiles = `$200` bytes), quadro 32×32 = 4 linhas de 128 bytes;
  `$C1:8949..$C1:8A84` fazem 4 DMAs de 128 B por sprite, até 2 sprites por quadro. A escolha do quadro é da frente
  animacoes-sprites. ✅
- Paleta do jogador: tabela `$C2:779D`, índice `personagem·32 + jogador·4` → ponteiro 24 bits + atributo
  (`$00,$02,$08,$0A,$0C` → slots OBJ 8, 9, 12, 13, 14). Carregada por `$C2:5642 → $C4:1986`. ✅
  Tabela alternativa `$C2:7B9D` (uma cor por personagem) usada quando `$01A4 == $C00B44` e `$1F0E ∉ {0,2}`, provavelmente
  modo de times. 🟡
- Slot OBJ 15 (bombas/chamas/efeitos): `$D7:E6DC`. ✅ Slots 10/11 vazios no Battle.

### 3.4 Conteúdo dos blocos comuns (identificação visual nos PNGs) 🟡
| Bloco | Conteúdo |
|---|---|
| `$CF:93B4` | HUD da partida (barra, relógio, cabeças, dígitos) |
| `$D1:C016` | painéis de itens/power-ups |
| `$D1:D019`, `$D1:E01C` | bombas e chamas da explosão (centro, braços, pontas), bombas especiais |
| `$D1:BC16` (2bpp) | fonte ASCII do BG3 |
| `$D0:F57B` (2bpp) | faixas "PAUSE!", "HURRY!", "TIME UP!" |
| `$C8:FD36` | faíscas/fragmentos |
| `$D1:87CE` | esferas/cilindros grandes, rastro de fogo |
| `$D1:8F93` | fumaça/poeira, brilhos, sombra |
| `$D1:967F` | bombas (normal, remota, espinhos, D/S/H), números |
| `$C5:013B` | números 2–9 e ícones diversos |
| `$C9:F997`, `$CA:F0B0`, `$CA:F8B3`, `$CD:E585` | placar/vitória: coroas, troféu, cabeças dos personagens |

## 4. Carregador sugerido (o que o TypeScript precisa fazer)
1. Ler `catalogo.json`.
2. Arena n: `desc = r24(0xC36233 + 3(n-1))`, `script = r24(desc)`; decodificar 8 blocos ZTE (concatenar = 32 KB),
   `composite(buf, 0x100, 0x6000, 256)`, se n == 9 `arena9Post`; paletas = 8×32 bytes de `r24(script+24+3i)` + correção
   `$C4:4E2F`; BG3 e OBJ comuns conforme `catalogo.json → partida_comum`.
3. Personagens: fatiar a folha do banco (16 tiles de largura) e aplicar a paleta de `$C2:779D`.
4. Telas (título, menus, placar, vitória, empate): aplicar em ordem `cenas.<tela>.vram` (cada item: tipo `zte`
   (bloco + offset), `raw` (endereço + offset), `zero`, `fill`) e as paletas `cenas.<tela>.cgram`.
5. Mapas de tiles (BG) e metasprites/quadros ficam com as frentes arenas-cenario e animacoes-sprites.

## 5. PNGs de conferência (`analise/extraido/graficos-formato/png/`) ✅
- `arenaNN_bg_tiles.png`: os 1024 tiles de BG montados **só da ROM**, com a paleta de cada tile tirada do mapa.
- `arenaNN_comparacao.png`: à esquerda BG1+BG2 renderizados com tiles e paletas **da ROM** e o mapa capturado;
  à direita o screenshot do emulador. Pixels iguais: 87,7 / 70,1 / 86,9 / 87,7 / 78,4 / 73,6 / 87,8 / 85,8 / 80,8 / 71,3 %
  (arenas 1–10). As diferenças são sprites, a barra do HUD (BG3) e a transparência (color math das arenas 2, 6, 10),
  que o renderizador simples não aplica; os tiles em si batem 100 % (§6).
- `personagem_*.png` (folhas dos 6 personagens com a paleta do P1), `obj_*.png`, `*_obj_vram.png`, `*_bg_vram.png`,
  `*_bg3_2bpp.png`, `drawgame_modo7_*.png`, `banco_XX_bruto.png`.

## 6. Validação (números)
| Teste | Resultado |
|---|---|
| Saída de `$C4:09A5`/`$C1:874D` × `decode_zte` (todas as chamadas em 15 cenas) | **307/307** idênticas, 91 blocos distintos ✅ |
| 32 KB de BG de cada arena × DMA real (inclui 2º envio da arena 9) | 11/11 envios, 0 bytes diferentes ✅ |
| DRAW GAME Modo 7 × DMA real | 0 bytes diferentes ✅ |
| Reconstrução da VRAM a partir da ROM (`recipe.py`), bytes de tiles escritos na cena | 100 % em todas as 24 capturas (ex.: arena01 58240/58240; título 51712/51712; placar 47360/47360) ✅ |
| `loader_test.py` (só `catalogo.json` + ROM) | telas: 100 % dos segmentos; arenas: BG3 2048/2048, OBJ comuns 100 %, BG 96,8–98,8 % (o resto = tiles trocados pela animação em jogo, todos de blocos ZTE da ROM, §3.2) ✅ |
| Paletas das telas encontradas na ROM | 16/16 linhas em todas as telas ✅ |

## 7. Em aberto
- Quadros do personagem 3 em `$CA` (linhas com espaçamento irregular): origem confirmada, tabela de ponteiros não
  levantada (frente animacoes-sprites). 🟡
- Rotinas e ritmo das animações de paleta (`$C1:097B` escreve a pal 4) e de tiles de BG em jogo. 🟡
- Tabela de paletas de times `$C2:7B9D` não testada em partida de times. 🟡
- Rótulos de conteúdo dos blocos comuns de OBJ são visuais. 🟡
- Modos história/Championship/Bombermania: fora do escopo; os mesmos formatos aparecem lá (66 chamadas estáticas a
  `$C4:09A5` e 81 a `$C1:874D` na ROM). ❌ não catalogados.

## 8. Como reproduzir
```
PY=/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/venv/bin/python
SCRATCH=/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad
# 1) core instrumentado (cópia própria): aplicar snes9x_instrumentacao.patch (nesta pasta) sobre uma cópia do snes9x
mkdir -p $SCRATCH/rom-graficos && cp -R $SCRATCH/snes9x $SCRATCH/rom-graficos/ && cd $SCRATCH/rom-graficos/snes9x \
  && patch -p1 < "<esta pasta>/snes9x_instrumentacao.patch"
make -C libretro platform=osx -j8          # dbgemu.py aponta SNES9X_CORE para esse dylib
cd analise/investigacao/graficos-formato
# 2) estados de navegação próprios (título-menu, seleção de personagem/fase): tour_menus.py / nav2.py (ver código)
$PY scenes.py                # captura as 15 cenas (logs + VRAM/CGRAM/OAM/WRAM) em extraido/graficos-formato/cenas
$PY validate_decomp.py       # 307/307
$PY validate_extra.py        # arenas 32 KB, arena 9, Modo 7
$PY recipe.py                # reconstrução da VRAM por cena (+ cenas/*.vmap.json)
$PY build_catalog.py && python3 build_catalog_md.py
$PY loader_test.py           # teste do catálogo de ponta a ponta
$PY make_pngs.py             # PNGs de conferência
python3 decomp.py '$D1:C016' saida.bin
```
Arquivos: `dbgemu.py` (wrapper do core instrumentado), `rom.py`, `decomp.py`, `render.py`, `pal_attr.py`,
`scenes.py`, `recipe.py`, `validate_*.py`, `loader_test.py`, `build_catalog*.py`, `make_pngs.py`;
exploração inicial: `tour_menus.py`, `tour_misc.py`, `tour_allcom.py`, `analyze_logs.py`, `nav2.py`.
