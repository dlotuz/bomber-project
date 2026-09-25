# Catálogo de gráficos do Battle Mode — Super Bomberman 4 (ROM do usuário, com patch de tradução)

Gerado por `build_catalog_md.py` a partir de `catalogo.json` (a fonte de verdade para o carregador).
Endereços SNES `$BB:AAAA` (HiROM); offset no arquivo = `((BB & 0x3F) << 16) | AAAA`. ZTE = tiles com elisão de tile zerado (ver RELATORIO.md §2).
Validação: ✅ = reconstruído da ROM e comparado byte a byte com a VRAM/CGRAM do emulador (`recipe.py`, `loader_test.py`).

ROM: `Super Bomberman 4 (USA).sfc`, 4194304 bytes, SHA-1 `38f4394986bd39fcbe32a722a3fe103ee6177d9b`.

## 1. Layout de VRAM (todas as cenas do Battle) ✅

| Item | Endereço (palavra) |
|---|---|
| BGMODE | Modo 1 (+prioridade BG3); tiles 16x16 em BG1/BG2 (menus) e BG1-3 (partida) |
| BG1_mapa | $4000 |
| BG2_mapa | $4400 |
| BG3_mapa | $5400 (64x64) |
| BG12_tiles | $0000 (4bpp, 1024 tiles) |
| BG3_tiles | $5000 (2bpp) |
| OBJ | $6000 (OBSEL=$63: 16x16 e 32x32, 512 tiles) |
| observacao | endereços em palavras de VRAM |

## 2. Arenas ✅

- Tabela de descritores: `$C3:6233 (3 bytes por arena; 12 entradas, 10 usadas no Battle)`; registro: $88 por arena = 4 variantes de $22 bytes (+0 ponteiro do script gráfico, +3.. mapas).
- Script gráfico: 48 bytes: 8 ponteiros de blocos ZTE (-> $7F:8000 + $1000*i) + 8 ponteiros de paleta BG (32 bytes cada -> CGRAM 16*i).
- Correção de paleta após carregar: $C4:4E2F: cores 13-15 da paleta 7 copiadas para as cores 13-15 das paletas 2 e 3.
- Depois dos 8 blocos: composição do piso sob os tiles 768–1023 (`composite_floor`); arena 9: `arena9_post` no início da partida.

| # | Nome | Descritor | Script | Blocos 0–3 (cenário da arena, VRAM $0000–$1FFF) | Paletas BG 0–7 (CGRAM 0–127) | Paleta animada em jogo |
|---|---|---|---|---|---|---|
| 1 | The Classic | `$C3:62DB` | `$C3:7542` | `$D2:C35F` (1867 B), `$D2:C35F` (1867 B), `$D2:C35F` (1867 B), `$D2:C35F` (1867 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E13C`, `$D7:E15C`, `$D7:E15C` | pal4 cor15 |
| 2 | Fast 'n' Slow | `$C3:6363` | `$C3:7572` | `$D2:CAAA` (3355 B), `$D2:D7C5` (1061 B), `$D2:DBEA` (3603 B), `$D2:E9FD` (3603 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E19C`, `$D7:E1BC`, `$D7:E1DC` | pal4 cor15 |
| 3 | Orb-ital Bombardment | `$C3:63EB` | `$C3:75D2` | `$D1:3944` (3603 B), `$D1:4757` (2115 B), `$D1:4F9A` (4099 B), `$D1:5F9D` (2115 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E03C`, `$D7:E05C`, `$D7:E07C` | pal4 cor15 |
| 4 | Don't Push Me | `$C3:6473` | `$C3:7602` | `$D0:0000` (3665 B), `$D0:0E51` (3696 B), `$D3:321F` (4099 B), `$D3:4222` (4037 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:DB3C`, `$D7:DB5C`, `$D7:DB7C` | pal4 cor15 |
| 5 | School of Hard Shocks | `$C3:64FB` | `$C3:7632` | `$D1:67E0` (3107 B), `$D1:7403` (1557 B), `$D1:67E0` (3107 B), `$D1:7A18` (3510 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E0BC`, `$D7:E0DC`, `$D7:E0FC` | pal4 cor15 |
| 6 | Totally Floored | `$C3:6583` | `$C3:7662` | `$D3:5E4B` (3665 B), `$D3:6C9C` (3107 B), `$D3:5E4B` (3665 B), `$D3:5E4B` (3665 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E2DC`, `$D7:E2FC`, `$D7:E31C` | pal4 cor15 |
| 7 | Hide and Blow Seek | `$C3:660B` | `$C3:7692` | `$D0:C8CF` (3603 B), `$D0:D6E2` (3603 B), `$D0:E4F5` (1743 B), `$D0:EBC4` (2487 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:DFBC`, `$D7:DFDC`, `$D7:DFFC` | pal4 cor15 |
| 8 | Spinny Slots | `$C3:6693` | `$C3:76C2` | `$D3:78BF` (2239 B), `$D3:817E` (4006 B), `$D3:9124` (1867 B), `$D3:817E` (4006 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E35C`, `$D7:E37C`, `$D7:E39C` | pal0 cor0, pal4 cor15 |
| 9 | Seesaw Yeehaw | `$C3:671B` | `$C3:7722` | `$D1:0000` (3727 B), `$D1:0E8F` (3479 B), `$D1:D019` (4099 B), `$D1:E01C` (3975 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:DD7C`, `$D7:DD9C`, `$D7:DDBC` | pal4 cor15, pal5 cores 12-15 |
| 10 | Sartorial Shenanigans | `$C3:67A3` | `$C3:7752` | `$D3:ABDD` (3355 B), `$D3:B8F8` (1340 B), `$D3:B8F8` (1340 B), `$D3:BE34` (503 B) | `$D6:9172`, `$D6:9192`, `$D7:E65C`, `$D7:E67C`, `$D6:FFD9`, `$D7:E41C`, `$D7:E43C`, `$D7:E45C` | pal4 cor15, pal5 cores 4-8 |

Blocos 4–7 (iguais nas 10 arenas):

| Slot | ROM | Arquivo | Comprimido | Tiles 4bpp | VRAM (palavra) | Conteúdo |
|---|---|---|---|---|---|---|
| 4 | `$CF:93B4` | 0x0F93B4 | 3014 | 128 | $2000 | HUD da partida (barra do topo: relógio, cabeças dos jogadores, dígitos, contadores) |
| 5 | `$D1:C016` | 0x11C016 | 4099 | 128 | $2800 | painéis de itens (power-ups: bomba, fogo, patins, luva, soco, chute, P, caveira, ...) e ícones |
| 6 | `$D1:D019` | 0x11D019 | 4099 | 128 | $3000 | bombas e chamas da explosão (parte 1); recebem o piso por baixo ($C4:4BDD) |
| 7 | `$D1:E01C` | 0x11E01C | 3975 | 128 | $3800 | bombas e chamas da explosão (parte 2), variantes de bomba (D/S/H...); recebem o piso por baixo |

Variantes de descritor (mesmo script gráfico, mapas diferentes — interessa à frente arenas-cenario): 
1: `$C3:62DB`/`$C3:62FD`/`$C3:631F`/`$C3:6341`, 2: `$C3:6363`/`$C3:6385`/`$C3:63A7`/`$C3:63C9`, 3: `$C3:63EB`/`$C3:640D`/`$C3:642F`/`$C3:6451`, 4: `$C3:6473`/`$C3:6495`/`$C3:64B7`/`$C3:64D9`, 5: `$C3:64FB`/`$C3:651D`/`$C3:653F`/`$C3:6561`, 6: `$C3:6583`/`$C3:65A5`/`$C3:65C7`/`$C3:65E9`, 7: `$C3:660B`/`$C3:662D`/`$C3:664F`/`$C3:6671`, 8: `$C3:6693`/`$C3:66B5`/`$C3:66D7`/`$C3:66F9`, 9: `$C3:671B`/`$C3:673D`/`$C3:675F`/`$C3:6781`, 10: `$C3:67A3`/`$C3:67C5`/`$C3:67E7`/`$C3:6809`

## 3. Comum a todas as partidas ✅

| Camada | ROM | Formato | Bytes | VRAM (palavra) | Conteúdo |
|---|---|---|---|---|---|
| BG3 | `$D1:BC16` | raw_2bpp | 1024 | $5000 | fonte ASCII 8x8 (64 tiles) |
| BG3 | `$D0:F57B` | raw_2bpp | 1024 | $5200 | faixas "PAUSE!", "HURRY!", "TIME UP!" |
| OBJ/BG | `$C8:FD36` | zte (439 B) | 2048 | $6800 | efeitos pequenos (faíscas/fragmentos) |
| OBJ/BG | `$D1:87CE` | zte (1989 B) | 2048 | $7000 | esferas e cilindros grandes, rastro de fogo |
| OBJ/BG | `$D1:8F93` | zte (1772 B) | 2048 | $7400 | nuvens de fumaça/poeira, brilhos, sombra |
| OBJ/BG | `$D1:967F` | zte (1431 B) | 2048 | $7800 | bombas (normal, remota, espinhos, D/S/H), números 0-1 |
| OBJ/BG | `$C5:013B` | zte (1245 B) | 2048 | $7C00 | números 2-9, ícones (lança-chamas, notas musicais, placas) |
| OBJ/BG | `$C8:FA44` | zte (439 B) | 2048 | $7C00 (só arena 3, sobrepõe parte de $C5:013B) | objetos da arena 3 |
| OBJ/BG | `$C7:FEA1` | zte (315 B) | 2048 | $64C0 e $65C0 (2 x 4 tiles) | caixa/ícone 32x16 |
| OBJ/BG | `$C5:FE5C` | zte (191 B) | 2048 | $02E0 e $03E0 (BG, 2 x 2 tiles) | tiles de BG animados |

Cabeças animadas do HUD: tabela `$C4:6170` = `$CF:93B4`, `$CF:9F7A`, `$CF:AF7D`, `$CF:BD90`, `$CF:CBA3`; $7F:208C + $1000*i, depois pedaços de 64 bytes por DMA ($C4:6157) para VRAM word $2010.. (cabeças do HUD de cada jogador).

Paletas OBJ: slot 15 = `$D7:E6DC` (bombas, chamas e efeitos (OBJ pal 7)); jogadores: tabela $C2:779D: índice = personagem*32 + jogador*4 -> ponteiro 24 bits + byte de atributo; slot OBJ = 8 + (atributo>>1) -> 8,9,12,13,14 para P1..P5; times: $C2:7B9D (mesma estrutura; uma cor por personagem).

## 4. Personagens ✅ (bancos confirmados pelo DMA de cada jogador; nomes descritivos)

| id | Personagem | Sprites (4bpp cru) | Paletas P1–P5 (tabela $C2:779D) |
|---|---|---|---|
| 0 | Bomberman branco | $D2:0000-$D2:7FFF | `$D7:E7DC`, `$D7:E7FC`, `$D7:E81C`, `$D7:E83C`, `$D7:E85C` |
| 1 | ciborgue de monóculo | $CB:0000-$CB:7FFF | `$D6:6D9B`, `$D6:6DBB`, `$D6:6DDB`, `$D6:6DFB`, `$D6:6E1B` |
| 2 | bomber de capacete amarelo ("felino laranja" na análise anterior) | $CB:8000-$CB:FFFF | `$D6:6CDB`, `$D6:6CFB`, `$D6:6D1B`, `$D6:6D3B`, `$D6:6D5B` |
| 3 | cavaleiro alado (mochila de asas) | $CC:0000-$CC:7FFF (+ quadros com ponteiros por linha em $CA, ex. $CA:0DC3) | `$D6:5FF9`, `$D6:6019`, `$D6:6039`, `$D6:6059`, `$D6:6079` |
| 4 | verde blindado | $CC:8000-$CC:FFFF | `$D6:5E39`, `$D6:5E59`, `$D6:5E79`, `$D6:5E99`, `$D6:5EB9` |
| 5 | vermelho/roxo | $CD:0000-$CD:7FFF | `$D6:5EF9`, `$D6:5F19`, `$D6:5F39`, `$D6:5F59`, `$D6:5F79` |

Formato: raw_4bpp, folha de 16 tiles de largura (linha = $200 bytes), quadros 32x32; enviado quadro a quadro por DMA ($C1:8949..$C1:8A84, 4 linhas de 128 bytes).

## 5. Telas (menus, título, placar, vitória, empate) ✅

Cada tela lista as origens dos tiles na VRAM (segmentos completos em `catalogo.json` → `cenas.<tela>.vram`, na ordem de aplicação).

### title — Tela-título (menu NORMAL/BATTLE/PASSWORD da tradução)

- Script/carregamento: $C1:C182 (via $E0:FE44, rotina do patch)
- OBJ: ZTE $C8:0000,$C8:0670,$C8:0C64,$C7:FA7E,$C7:E1B6,$C7:E6F0,$C7:EE58,$C7:F46B -> $7F:0800 -> VRAM (rotina $C4:371D)
- Origens: `$CE:6B69` zte → $0000–$0000 (1 seg.); `$CE:795D` zte → $0800–$0800 (1 seg.); `$CE:87CD` zte → $1000–$1000 (1 seg.); `$CE:9564` zte → $1800–$1800 (1 seg.); `$C8:3AEA` zte → $2000–$2000 (1 seg.); `$C8:4A71` zte → $2800–$2800 (1 seg.); `$C8:5A74` zte → $3000–$3740 (8 seg.); `$E2:3F4F` raw → $3410–$3410 (1 seg.); `$E2:3F8F` raw → $3430–$3430 (1 seg.); `$E2:40AF` raw → $34C0–$34C0 (1 seg.); `$E2:414F` raw → $3510–$3510 (1 seg.); `$E2:418F` raw → $3530–$3530 (1 seg.); `$E2:42AF` raw → $35C0–$35C0 (1 seg.); `$E2:452F` raw → $3700–$3700 (1 seg.); `$CE:A339` zte → $3800–$3D40 (2 seg.); `$E2:24AB` raw → $3D30–$3D30 (1 seg.); `$C8:0000` zte → $6000–$6000 (1 seg.); `$C8:0670` zte → $6400–$6400 (1 seg.); `$C8:0C64` zte → $6800–$6800 (1 seg.); `$C7:FA7E` zte → $6C00–$6C00 (1 seg.); `$C7:E1B6` zte → $7000–$7000 (1 seg.); `$C7:E6F0` zte → $7400–$7400 (1 seg.); `$C7:EE58` zte → $7800–$7800 (1 seg.); `$C7:F46B` zte → $7C00–$7C00 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:8B2C`, 1:`$D6:8B4C`, 2:`$D6:8CEC`, 3:`$D6:427D`, 4:`$D6:427D`, 5:`$D6:429D`, 6:`$D6:42BD`, 7:`$D6:42BD`, 8:`$D6:40BD`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:3E7D`, 14:`$D6:3E9D`, 15:`$D6:3EBD`

### vsmode — "Select a VS mode!"

- Script/carregamento: $C1:C1B2 (via $E0:FE44) + textos crus do patch ($E0/$E1)
- Origens: `$CE:AF1E` zte → $0000–$0100 (2 seg.); `$E1:0067` raw → $0020–$0020 (1 seg.); `$E1:0267` raw → $0120–$0120 (1 seg.); `$CE:BE86` zte → $0980–$0980 (1 seg.); `$CE:CE4B` zte → $1000–$1000 (1 seg.); `$CE:DE4E` zte → $1800–$1800 (1 seg.); `$CD:E585` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$3800 (2 seg.); `$CE:EE13` zte → $3000–$3000 (1 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$C9:F997` zte → $6000–$6000 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:8D2C`, 1:`$D6:8D2C`, 2:`$D6:8D4C`, 3:`$D6:8D6C`, 4:`$D6:8D8C`, 5:`$D6:8DAC`, 6:`$D6:777C`, 7:`$D6:8DCC`, 8:`$D6:7F3C`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:3E7D`, 14:`$D6:3E9D`, 15:`$D6:3EBD`

### ffa — Free-for-All / Team Battle

- Script/carregamento: $C1:C1B2 + textos do patch
- Origens: `$CE:AF1E` zte → $0000–$07C0 (3 seg.); `$E1:0067` raw → $0020–$0020 (1 seg.); `$E1:3575` raw → $0120–$0120 (1 seg.); `$CE:BE86` zte → $0800–$0800 (1 seg.); `$CE:CE4B` zte → $1000–$1000 (1 seg.); `$CE:DE4E` zte → $1800–$1800 (1 seg.); `$CD:E585` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$3800 (2 seg.); `$CE:EE13` zte → $3000–$3000 (1 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$C9:F997` zte → $6000–$6000 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:8D2C`, 1:`$D6:8D2C`, 2:`$D6:8D4C`, 3:`$D6:8D6C`, 4:`$D6:8D8C`, 5:`$D6:8DAC`, 6:`$D6:773C`, 7:`$D6:8DCC`, 8:`$D6:7F3C`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:3E7D`, 14:`$D6:3E9D`, 15:`$D6:3EBD`

### players — "Decide on the players!"

- Script/carregamento: $C1:C1B2 + textos do patch
- Origens: `$CE:AF1E` zte → $0000–$0100 (2 seg.); `$E0:D5DC` raw → $0020–$0020 (1 seg.); `$E0:D7DC` raw → $0120–$0120 (1 seg.); `$CE:BE86` zte → $09C0–$09C0 (1 seg.); `$CE:CE4B` zte → $1000–$1000 (1 seg.); `$CE:DE4E` zte → $1800–$1800 (1 seg.); `$CD:E585` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$3800 (2 seg.); `$CE:EE13` zte → $3000–$3000 (1 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$C9:F997` zte → $6000–$6000 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:8D2C`, 1:`$D6:8D2C`, 2:`$D6:8D4C`, 3:`$D6:8D6C`, 4:`$D6:8D8C`, 5:`$D6:8DAC`, 6:`$D6:775C`, 7:`$D6:8DCC`, 8:`$D6:7F3C`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:3E7D`, 14:`$D6:3E9D`, 15:`$D6:3EBD`

### rules — "Configure the rules!"

- Script/carregamento: $C1:C1B2 + textos do patch
- Origens: `$CE:AF1E` zte → $0000–$0100 (2 seg.); `$E0:4240` raw → $0020–$0020 (1 seg.); `$E0:4440` raw → $0120–$0120 (1 seg.); `$CE:CE4B` zte → $1340–$1340 (1 seg.); `$CE:DE4E` zte → $1800–$1800 (1 seg.); `$CD:E585` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$3800 (2 seg.); `$CE:EE13` zte → $3000–$3000 (1 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$C9:F997` zte → $6000–$6000 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:8D2C`, 1:`$D6:8D2C`, 2:`$D6:8D4C`, 3:`$D6:8D6C`, 4:`$D6:8D8C`, 5:`$D6:8DAC`, 6:`$D6:777C`, 7:`$D6:8DCC`, 8:`$D6:7F3C`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:3E7D`, 14:`$D6:3E9D`, 15:`$D6:3EBD`

### charsel — "Select a character!"

- Script/carregamento: $C1:C1E2 (via $E0:FE44) + textos do patch; OBJ ZTE $CE:53D7,$CE:5BBB,$CE:60F5
- Origens: `$CE:AF1E` zte → $0000–$0580 (3 seg.); `$E1:B699` raw → $0020–$0020 (1 seg.); `$E1:B899` raw → $0120–$0120 (1 seg.); `$CE:BE86` zte → $0800–$0800 (1 seg.); `$CE:CE4B` zte → $1000–$1000 (1 seg.); `$CE:DE4E` zte → $1800–$1800 (1 seg.); `$CD:E585` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$3800 (2 seg.); `$CE:EE13` zte → $3000–$3000 (1 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$C9:F997` zte → $6000–$6000 (1 seg.); `$CE:5BBB` zte → $6400–$6400 (1 seg.); `$CE:60F5` zte → $6800–$6800 (1 seg.); `$CE:53D7` zte → $6C00–$6C00 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:7B3C`, 1:`$D6:8D2C`, 2:`$D6:779C`, 3:`$D6:79BC`, 4:`$D6:7A7C`, 5:`$D6:8DAC`, 6:`$D6:771C`, 7:`$D6:7BFC`, 8:`$D6:8E4C`, 9:`$D6:3EDD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:8E0C`, 14:`$D6:8E2C`, 15:`$D6:3EBD`

### stagesel — "Select a stage!" (prévias das arenas)

- Script/carregamento: $C1:C1E2 e depois $C1:A901 (tiles das prévias, 8 blocos; carregado por $C1:A262); nomes das fases: tiles crus do patch $E0:0021.. (DMA direto $E0:401B..)
- Origens: `$C5:07CF` zte → $0000–$0000 (1 seg.); `$C5:1566` zte → $0800–$0800 (1 seg.); `$C5:2281` zte → $1000–$1000 (1 seg.); `$C5:2CB4` zte → $1800–$1800 (1 seg.); `$C5:3B43` zte → $2000–$2000 (1 seg.); `$CD:F398` zte → $2800–$2800 (1 seg.); `$C5:4B46` zte → $3000–$3800 (2 seg.); `$C5:E4A3` raw → $5000–$5000 (1 seg.); `$C0:0000` raw → $5010–$5070 (7 seg.); `$E0:0021` raw → $6000–$6000 (1 seg.); `$E0:0819` raw → $63FC–$63FC (1 seg.); `$E0:1011` raw → $67F8–$67F8 (1 seg.); `$E0:1809` raw → $6BF4–$6BF4 (1 seg.); `$E0:2001` raw → $6FF0–$6FF0 (1 seg.); `$E0:27F9` raw → $73EC–$73EC (1 seg.); `$E0:2FF1` raw → $77E8–$77E8 (1 seg.); `$E0:37E9` raw → $7BE4–$7BE4 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:24AD`, 1:`$D6:232D`, 2:`$D6:234D`, 3:`$D6:79BC`, 4:`$D6:7A7C`, 5:`$D6:8DAC`, 6:`$D6:771C`, 7:`$D6:773C`, 8:`$D6:8E4C`, 9:`$D6:3DFD`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:3E5D`, 13:`$D6:8E0C`, 14:`$D6:8E2C`, 15:`$D6:3EBD`

### scoreboard — SCORE BOARD (coroas)

- Script/carregamento: $C2:9C35 (mesmo tileset da vitória); OBJ ZTE $C9:F997,$CA:F0B0,$CA:F8B3,$CD:E585 (cabeças, coroas, troféu)
- Origens: `$CE:0000` zte → $0000–$0000 (1 seg.); `$CE:0F87` zte → $0800–$0800 (1 seg.); `$CE:1F8A` zte → $1000–$1000 (1 seg.); `$CE:2DFA` zte → $1800–$1800 (1 seg.); `$CE:3C0D` zte → $2000–$3000 (2 seg.); `$CE:48EA` zte → $2800–$3800 (2 seg.); `$D3:E82B` raw → $6080–$6080 (1 seg.); `$D3:EA2B` raw → $6180–$6180 (1 seg.); `$D3:EC2B` raw → $6280–$6280 (1 seg.); `$D3:EE2B` raw → $6380–$6380 (1 seg.); `$CB:B000` raw → $6400–$6400 (1 seg.); `$CC:5900` raw → $6440–$6440 (1 seg.); `$CB:B200` raw → $6500–$6500 (1 seg.); `$CC:5B00` raw → $6540–$6540 (1 seg.); `$CB:B400` raw → $6600–$6600 (1 seg.); `$CC:5D00` raw → $6640–$6640 (1 seg.); `$CB:B600` raw → $6700–$6700 (1 seg.); `$CC:5F00` raw → $6740–$6740 (1 seg.); `$CD:E585` zte → $6800–$6800 (1 seg.); `$CA:F0B0` zte → $7000–$7000 (1 seg.); `$CA:F8B3` zte → $7400–$7400 (1 seg.); `$C9:F997` zte → $7C00–$7C00 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:7DBC`, 1:`$D6:7DDC`, 2:`$D6:7DFC`, 3:`$D6:7E1C`, 4:`$D6:7E3C`, 5:`$D6:7CBC`, 6:`$D6:7E7C`, 7:`$D6:7EFC`, 8:`$D6:779C`, 9:`$D6:79BC`, 10:`$D6:7A7C`, 11:`$D6:7B3C`, 12:`$D6:7BFC`, 13:`$D6:7FDC`, 14:`$C0:E320`, 15:`$D6:7F3C`

### victory — VICTORY! (troféu)

- Script/carregamento: $C2:9C35; OBJ ZTE $C9:F997,$CA:F0B0,$CA:F8B3,$CD:E585; poses dos personagens por DMA direto
- Origens: `$CE:0000` zte → $0000–$2F00 (11 seg.); `$CE:0F87` zte → $0800–$1BA0 (5 seg.); `$CE:1F8A` zte → $1000–$1000 (1 seg.); `$CE:2DFA` zte → $1800–$1BC0 (3 seg.); `$CE:3C0D` zte → $2000–$3000 (2 seg.); `$CE:48EA` zte → $2800–$3800 (5 seg.); `$D2:0900` raw → $6000–$6000 (1 seg.); `$CB:0900` raw → $6040–$6040 (1 seg.); `$D3:E82B` raw → $6080–$6080 (1 seg.); `$D2:0B00` raw → $6100–$6100 (1 seg.); `$CB:0B00` raw → $6140–$6140 (1 seg.); `$D3:EA2B` raw → $6180–$6180 (1 seg.); `$D2:0D00` raw → $6200–$6200 (1 seg.); `$CB:0D00` raw → $6240–$6240 (1 seg.); `$D3:EC2B` raw → $6280–$6280 (1 seg.); `$D2:0600` raw → $6300–$6300 (1 seg.); `$CB:0F00` raw → $6340–$6340 (1 seg.); `$D3:EE2B` raw → $6380–$6380 (1 seg.); `$CB:8900` raw → $6400–$6400 (1 seg.); `$CA:0DC3` raw → $6440–$6440 (1 seg.); `$CC:8900` raw → $6480–$6480 (1 seg.); `$CB:8B00` raw → $6500–$6500 (1 seg.); `$CA:0F47` raw → $6540–$6540 (1 seg.); `$CC:8B00` raw → $6580–$6580 (1 seg.); `$CB:8D00` raw → $6600–$6600 (1 seg.); `$CA:10EA` raw → $6640–$6640 (1 seg.); `$CC:8D00` raw → $6680–$6680 (1 seg.); `$CB:8F00` raw → $6700–$6700 (1 seg.); `$CA:128D` raw → $6740–$6740 (1 seg.); `$CC:8F00` raw → $6780–$6780 (1 seg.); `$CD:E585` zte → $6800–$6800 (1 seg.); `$CA:F0B0` zte → $7000–$7000 (1 seg.); `$CA:F8B3` zte → $7400–$7400 (1 seg.); `$C9:F997` zte → $7C00–$7C00 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:7DBC`, 1:`$D6:7DDC`, 2:`$D6:7DFC`, 3:`$D6:7E1C`, 4:`$D6:7E3C`, 5:`$D6:7CBC`, 6:`$D6:7E7C`, 7:`$D6:7E9C`, 8:`$D6:779C`, 9:`$D6:79BC`, 10:`$D6:7A7C`, 11:`$D6:7B3C`, 12:`$D6:7BFC`, 13:`$D6:7FDC`, 14:`$C0:E320`, 15:`$D6:7F3C`

### draw1 — DRAW GAME (fase Modo 7, zoom)

- Script/carregamento: Modo 7: RLE duplo $C4:6201 com pixels $CD:9800 e mapa $D6:60D9 -> 32 KB VRAM $0000
- Origens: `$CD:D11F` zte → $5000–$5000 (1 seg.); `$D2:6900` raw → $6000–$6000 (1 seg.); `$CB:6900` raw → $6040–$6040 (1 seg.); `$D2:6B00` raw → $6100–$6100 (1 seg.); `$CB:6B00` raw → $6140–$6140 (1 seg.); `$D2:6D00` raw → $6200–$6200 (1 seg.); `$CB:6D00` raw → $6240–$6240 (1 seg.); `$D2:6F00` raw → $6300–$6300 (1 seg.); `$CB:6F00` raw → $6340–$6340 (1 seg.); `$CB:E900` raw → $6400–$6400 (1 seg.); `$CC:6900` raw → $6440–$6440 (1 seg.); `$CC:E900` raw → $6480–$6480 (1 seg.); `$CB:EB00` raw → $6500–$6500 (1 seg.); `$CC:6B00` raw → $6540–$6540 (1 seg.); `$CC:EB00` raw → $6580–$6580 (1 seg.); `$CB:ED00` raw → $6600–$6600 (1 seg.); `$CC:6D00` raw → $6640–$6640 (1 seg.); `$CC:ED00` raw → $6680–$6680 (1 seg.); `$CB:EF00` raw → $6700–$6700 (1 seg.); `$CC:6F00` raw → $6740–$6740 (1 seg.); `$CC:EF00` raw → $6780–$6780 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:62CC`, 1:`$D6:62EC`, 2:`$D6:630C`, 3:`$D6:630C`, 4:`$D6:630C`, 5:`$D6:630C`, 6:`$D6:630C`, 7:`$D6:630C`, 8:`$C0:E000`, 9:`$D6:021A`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:02FA`, 13:`$C0:E240`, 14:`$C0:E320`, 15:`$D7:E6DC`

### draw2 — DRAW GAME (fase final, BG2)

- Script/carregamento: ZTE $CD:B195,$CD:C11C,$CD:D11F,$CD:E122 (tabela $C2:DC09) -> $7F:208C -> VRAM word $4000-$5BFF (tiles do BG2, NBA=$44)
- Origens: `$CD:D11F` zte → $5000–$5000 (1 seg.); `$D2:6800` raw → $6000–$6000 (1 seg.); `$CB:6800` raw → $6040–$6040 (1 seg.); `$D2:6A00` raw → $6100–$6100 (1 seg.); `$CB:6A00` raw → $6140–$6140 (1 seg.); `$D2:6C00` raw → $6200–$6200 (1 seg.); `$CB:6C00` raw → $6240–$6240 (1 seg.); `$D2:6E00` raw → $6300–$6300 (1 seg.); `$CB:6E00` raw → $6340–$6340 (1 seg.); `$CB:E800` raw → $6400–$6400 (1 seg.); `$CC:6800` raw → $6440–$6440 (1 seg.); `$CC:E800` raw → $6480–$6480 (1 seg.); `$CB:EA00` raw → $6500–$6500 (1 seg.); `$CC:6A00` raw → $6540–$6540 (1 seg.); `$CC:EA00` raw → $6580–$6580 (1 seg.); `$CB:EC00` raw → $6600–$6600 (1 seg.); `$CC:6C00` raw → $6640–$6640 (1 seg.); `$CC:EC00` raw → $6680–$6680 (1 seg.); `$CB:EE00` raw → $6700–$6700 (1 seg.); `$CC:6E00` raw → $6740–$6740 (1 seg.); `$CC:EE00` raw → $6780–$6780 (1 seg.)
- Paletas (linha: ROM): 0:`$D6:630C`, 1:`$D6:62CC`, 2:`$D6:62EC`, 3:`$D6:644C`, 4:`$D6:630C`, 5:`$D6:630C`, 6:`$D6:630C`, 7:`$D6:630C`, 8:`$C0:E000`, 9:`$D6:021A`, 10:`$D6:40BD`, 11:`$D6:3E3D`, 12:`$D6:02FA`, 13:`$C0:E240`, 14:`$C0:E320`, 15:`$D7:E6DC`

`*` = casou com a ROM ignorando a cor 0 (a cor 0 é escrita à parte pelo jogo).

