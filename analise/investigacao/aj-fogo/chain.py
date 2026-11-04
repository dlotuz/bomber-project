"""(a) Reação em cadeia em linha na linha 5 da arena 1 (sem blocos moles): A em (4,5) com alcance RA explode e acende
B em (4+D,5), que tem alcance RB. Imprime, tick a tick, as casas da linha 5 (col 2..14): tile&$C30E/dona.
Uso: chain.py RA D RB [colA=4] [raw]  (raw: palavra inteira do tilemap)"""
from fh import *
RA, D, RB = map(int, sys.argv[1:4]); CA = int(sys.argv[4]) if len(sys.argv) > 4 else 4
import fh
if 'raw' in sys.argv: fh.MASK = 0xFFFF
e = setup()
a = place(e, 0, CA, 5, rng=RA, fuse=8)
b = place(e, 1, CA + D, 5, rng=RB, fuse=120)
print('A', hex(a), 'B', hex(b))
cells = [(c, 5) for c in range(2, 15)]
print('col   ' + ' '.join(f'   {c:2d}    ' for c in range(2, 15)))
prev = None; t0 = None
for i in range(60):
    e.step(); inv(e)
    s = line(e, cells)
    if s != prev:
        if t0 is None and 'BOMBA' not in s.split()[2:3]: t0 = e.ticks
        print(f'{e.ticks - (t0 or e.ticks):3d} ' + s)
    prev = s
