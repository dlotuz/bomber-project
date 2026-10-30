"""Comparação: P1 segurando a bomba aperta B (largar com a luva). Mostra que o B usa o mesmo $C2:4BC4 (+$1C = 9,
rotina $C1:26C9) que o Y do soco com bomba na mão."""
from h import *
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,14,9); e.run(1)
e.w8(0x348,0xFF); e.w8(0x349,0xFF); e.w8(0x3D8,0)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
e.ww(0x38C, 0x38D); held = None; prev = None; n0 = e.lib.dbg_count()
for i in range(50):
    btn = (['A'] if (i < 2 or 5 <= i < 45) else []) + (['B'] if 30 <= i < 31 else [])
    e.step(p0=btn)
    c = e.r16(0x38C); held = held or c or None
    w = e.wram(); hb = (f'{w[held+2]<<16|w[held+1]<<8|w[held]:06X}', e.r16(held+0x12), e.r16(held+0x16), w[held+0x1C]) if held else None
    s = (hex(rt(e,0)), hex(c), hb)
    if s != prev: print(i, btn, s)
    prev = s
for r in e.log()[n0:]:
    if r['t'] in ('W8','W16') and r['addr'] in (0x38C,0x38D): print(fmt(r))
