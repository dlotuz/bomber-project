"""Depois do Y com bomba na mão (A segurado o tempo todo), uma bomba nova aparece embaixo do P1: quem a põe?
Observa escritas na casa (4,3) da grade ($7E:28C8) e chamadas das rotinas de pôr bomba. Argumento: 'noA' solta o A."""
from h import *
import sys
a = set(sys.argv[1:])
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,14,9); e.run(1)
e.w8(0x348,0xFF); e.w8(0x349,0xFF); e.w8(0x3D8,0)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
aend = 33 if 'noA' in a else 90
for i in range(30): e.step(p0=['A'] if (i < 2 or 5 <= i < aend) else [])
e.ww(0x28C8, 0x28C9); n0 = e.lib.dbg_count()
for i in range(30, 80):
    btn = (['A'] if i < aend else []) + (['Y'] if i < 32 else [])
    e.step(p0=btn)
    if (e.r16(0x28C8) & 0xEFC0) == 0xC900: print('bomba nova no frame', i); break
for r in e.log()[n0:]:
    if r['t'] in ('W8','W16'): print(fmt(r))
