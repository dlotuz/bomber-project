"""Como carry_y.py, mas segue o objeto da bomba na mão (rotina, x, y, z) e quem escreve +$8C do P1.
Argumentos: 'front' (bomba à frente), 'P' (item P ligado), 'noA' (solta o A logo depois do Y), yat=<frame do Y>."""
from h import *
import sys
a = set(x for x in sys.argv[1:] if '=' not in x)
kv = dict(x.split('=') for x in sys.argv[1:] if '=' in x)
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,14,9); e.run(1)
if 'front' in a: bomb_at(e,1,5,3,back=(14,9))
e.w8(0x348,0xFF); e.w8(0x349,0xFF); e.w8(0x3D8, 0xFF if 'P' in a else 0)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
yat = int(kv.get('yat', 30)); aend = yat+3 if 'noA' in a else 90
held = None
e.ww(0x38C, 0x38D)
n0 = e.lib.dbg_count(); prev = None
for i in range(80):
    btn = []
    if i < 2 or 5 <= i < aend: btn.append('A')
    if yat <= i < yat+2: btn.append('Y')
    e.step(p0=btn)
    c = e.r16(0x38C)
    if c and held is None: held = c
    hb = None
    if held:
        w = e.wram(); hb = (f'{w[held+2]<<16|w[held+1]<<8|w[held]:06X}', e.r16(held+0x12), e.r16(held+0x16), e.r16(held+0x1E) if True else 0, w[held+0x1C])
    s = (hex(rt(e,0)), hex(c), e.obj(0)[0x41], hb, ''.join('B' if (v&0xEFC0)==0xC900 else '.' for v in grid(e)[3]))
    if s != prev: print(i, btn, s)
    prev = s
for r in e.log()[n0:]:
    if r['t'] in ('W8','W16') and r['addr'] in (0x38C,0x38D): print(fmt(r))
