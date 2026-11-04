"""Checagem de $9C bit 0 ($C1:4077–$C1:40A9): só a arena 9 liga esse bit (st_arena09: $9C = $0001; 01..10 medidos:
2=$80, 4=$100, 5=$200, 6=$4, 7=$2, 8=$20, 9=$1, 1/3/10=0). Os tiles $08E0..$08EA são as gangorras.
Bomba em (C,R) com alcance RNG; imprime a linha R (ou a coluna C com 'vert') e o tile cru das casas.
Uso: seesaw.py C R RNG [vert]"""
from fh import *
import fh
C0, R0, RNG = map(int, sys.argv[1:4]); vert = 'vert' in sys.argv
fh.MASK = 0xFFFF
e = setup("st_arena09")
print('$9C =', hex(e.r16(0x9C)))
cells = [(C0, r) for r in range(1, 12)] if vert else [(c, R0) for c in range(2, 15)]
print('tiles:', ' '.join(f'{e.r16(TM + off(c, r)):04X}' for c, r in cells))
print('grade:', ' '.join(f'{e.r16(GR + off(c, r)):04X}' for c, r in cells))
place(e, 0, C0, R0, rng=RNG, fuse=3, park=(14, 11) if not vert else (2, 11))
prev = None
for i in range(12):
    e.step(); inv(e)
    s = line(e, cells)
    if s != prev: print(e.ticks, s)
    prev = s
