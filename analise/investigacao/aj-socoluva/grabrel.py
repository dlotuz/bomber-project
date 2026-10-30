"""P1 (luva) pega o P2 na mesma casa (4,3) e segura com A; no frame 40 o P1 recebe um pedido (+$C0) ou aperta B.
Modo: B | stun ($02) | dance ($20) | pvict ($2000) | death (bit $1000 da casa). Imprime as rotinas do P1 e do P2,
+$8C do P1 e a posição/+$96 do P2: mostra como o P2 é solto em cada caso ($C2:4BC4 grava +$C2 |= $10 nele)."""
from h import *
import sys
mode = sys.argv[1]
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,4,3); e.run(1)
e.w8(0x348,0); e.w8(0x349,0xFF); e.w8(0x3D8,0)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
prev = None
for i in range(140):
    btn = ['A'] if i < 130 else []
    if mode == 'B' and 40 <= i < 41: btn = btn + ['B']
    if i == 40:
        if mode == 'stun': e.w16(0x3C0, e.r16(0x3C0) | 0x02)
        if mode == 'dance': e.w16(0x3C0, e.r16(0x3C0) | 0x20)
        if mode == 'pvict': e.w16(0x3C0, e.r16(0x3C0) | 0x2000)
        if mode == 'death': e.w16(0x28C8, e.r16(0x28C8) | 0x1000)
    e.step(p0=btn)
    s = (hex(rt(e,0)), hex(e.r16(0x38C)), hex(rt(e,1)), pos(e,1), e.r16(0x496) > 0, hex(e.r16(0x4C2)))
    if s != prev: print(i, e.ticks, s)
    prev = s
