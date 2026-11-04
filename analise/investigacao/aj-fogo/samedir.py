"""(c) Mesma direção: A em (CA,5) com alcance RA explode; DT ticks depois uma bomba B (alcance RB) explode dentro do
braço direito de A, em (CA+K,5) — como uma bomba chutada/arremessada que pousa na chama. B é posta longe, em (14,9),
com pavio longo, e o objeto dela é levado para a casa (+$2A, +$12/+$16; grade da casa antiga volta a piso) com pavio 0.
Uso: samedir.py CA RA K RB DT [raw] [vert]   vert: o mesmo na coluna 8 (braço de baixo de A, B abaixo do centro)"""
from fh import *
import fh
CA, RA, K, RB, DT = map(int, sys.argv[1:6])
if 'raw' in sys.argv: fh.MASK = 0xFFFF
vert = 'vert' in sys.argv
e = setup()
a = place(e, 0, *((8, CA) if vert else (CA, 5)), rng=RA, fuse=3)
b = place(e, 1, 14, 9, rng=RB, fuse=200, park=(2, 11))
cells = [(8, r) for r in range(1, 12)] if vert else [(c, 5) for c in range(2, 15)]
tgt = (8, CA + K) if vert else (CA + K, 5)
print('casas', cells[0], '...', cells[-1], 'B vai para', tgt)
prev = None; t0 = None
for i in range(70):
    e.step(); inv(e)
    s = line(e, cells)
    if t0 is None and find_bomb(e, *((8, CA) if vert else (CA, 5))) is None: t0 = e.ticks
    if t0 is not None and e.ticks - t0 == DT - 1:
        o0 = e.r16(b + 0x2A); e.w16(GR + o0, e.r16(0x4000 + o0)); e.w16(TM + o0, e.r16(0x3800 + o0))
        e.w16(b + 0x2A, off(*tgt)); e.w16(b + 0x12, cx(tgt[0])); e.w16(b + 0x16, cy(tgt[1])); e.w8(b + 0x1A, 0)
    if s != prev: print(f'{(e.ticks - t0) if t0 is not None else -1:3d} ' + s)
    prev = s
