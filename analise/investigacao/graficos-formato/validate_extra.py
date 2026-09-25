"""Validações adicionais (rodar depois de scenes.py):
 1) tileset de 32 KB de cada arena (ZTE + composição [+ arena9_post]) contra CADA DMA $7F:8000->VRAM gravado no log;
 2) RLE do Modo 7 (DRAW GAME) contra o DMA de 32 KB gravado;
 3) paletas de BG das arenas contra a CGRAM capturada."""
import sys; sys.path.insert(0, '.')
from dbgemu import OUT, parse_log
from rom import r24, rd
from decomp import decode_zte, composite_floor, arena9_post, decode_m7rle, arena_bg_palettes
CEN = OUT + '/cenas'
for k in range(1, 11):
    script = r24(0xC362DB + 0x88 * (k - 1))
    base = composite_floor(b''.join(decode_zte(r24(script + 3 * i))[0] for i in range(8)))
    L = parse_log(f'{CEN}/arena{k:02d}.log'); B = open(f'{CEN}/arena{k:02d}.bin', 'rb').read()
    ups = [d for d in L if d['type'] == 'D' and d['src'] == '7F8000' and d['n'] == '32768']
    res = []
    for j, d in enumerate(ups):
        real = B[int(d['bin']):int(d['bin']) + 32768]
        mine = base if j == 0 else arena9_post(base)
        res.append(sum(1 for a, b in zip(mine, real) if a != b))
    print(f'arena {k:2d}: {len(ups)} envio(s) de 32 KB, bytes diferentes: {res}')
L = parse_log(f'{CEN}/draw.log'); B = open(f'{CEN}/draw.bin', 'rb').read()
d = [d for d in L if d['type'] == 'D' and d['pc'] == 'C409A1'][0]
mine, cp, cm = decode_m7rle(0xCD9800, 0xD660D9)
print('DRAW GAME Modo 7: bytes diferentes', sum(1 for a, b in zip(mine, B[int(d['bin']):int(d['bin']) + 32768]) if a != b), f'(consumo: pixels {cp} B, mapa {cm} B)')
