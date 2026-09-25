# graficos-formato — STATUS (para as outras frentes)

**Descompressor validado ✅** — 307/307 chamadas das rotinas de descompressão do jogo ($C4:09A5 e $C1:874D),
em título, menus, seleção de fase, 10 arenas, placar/vitória e DRAW GAME, deram saída idêntica byte a byte.
Os tiles de BG de todas as 10 arenas (32 KB cada, incluindo a composição de piso e o pós-processamento da
arena 9) e todos os tiles de OBJ das cenas foram reconstruídos da ROM e batem 100% com a VRAM do emulador.

## Formato (resumo)
Não há LZ. Os gráficos são **tiles 4bpp crus** (formato planar do SNES) com uma única "compressão":
**elisão de tile zerado** (chamei de ZTE):

```
byte Z (marcador "tile zerado"), byte E (marcador de fim)
loop: b = próximo byte
      b == Z -> 32 bytes 0x00, consome 1
      b == E -> fim, consome 1
      senão  -> copia 32 bytes literais (b é o 1º deles), consome 32
```
Paletas são BGR555 cruas na ROM (16 cores = 32 bytes), sem compressão.
Única outra compressão: RLE duplo do Modo 7 só no DRAW GAME (`decode_m7rle(0xCD9800, 0xD660D9)`, validado).
Sprites dos personagens são tiles crus na ROM (lidos por DMA direto, quadro a quadro).

## Como usar
```
cd analise/investigacao/graficos-formato
python3 decomp.py '$D1:C016' saida.bin        # descomprime um bloco ZTE (endereço SNES HiROM)
```
Em Python:
```python
import sys; sys.path.insert(0, 'analise/investigacao/graficos-formato')
from decomp import decode_zte, composite_floor, arena9_post, arena_bg_palettes
from rom import r24
dados, tamanho_comprimido = decode_zte(0xD1C016)
# tileset de BG de uma arena (32 KB -> VRAM word $0000):
script = r24(0xC362DB + 0x88 * (arena - 1))          # descritor da arena, campo +0
buf = b''.join(decode_zte(r24(script + 3 * i))[0] for i in range(8))
buf = composite_floor(buf)                           # sempre ($C4:4BDD)
if arena == 9: buf = arena9_post(buf)                # só na arena 9, ao iniciar a partida
paletas_bg = arena_bg_palettes(script)             # 256 bytes -> CGRAM 0..127 (8 ponteiros + correção $C4:4E2F)
```
Layout de VRAM (todas as cenas do Battle): BG1/BG2 4bpp em word $0000 (tiles 16x16), mapas BG1 $4000,
BG2 $4400, BG3 (2bpp) tiles em word $5000 e mapa em $5400 (64x64), OBJ em word $6000 (OBSEL=$63: 16x16/32x32).

Teste de ponta a ponta do catálogo: `loader_test.py` (usa só `catalogo.json` + ROM).
Detalhes, catálogo e tabelas: `RELATORIO.md`, `catalogo.md`, `catalogo.json` (nesta pasta).
