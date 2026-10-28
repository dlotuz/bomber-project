"""P1 chuta uma bomba na direção do P2 (8,5) depois de ele perder a montaria. arg: s (tick relativo a D0)."""
from h import *
import sys
for s in [int(a) for a in sys.argv[1:]]:
    e = TDbg(); e.load(open('d0_None.bin','rb').read()); e.ticks = 0
    e.bp(0xC20E29); e.bp(0xC259D6)
    b = ob(1)
    while e.ticks < s: e.step()
    bomb_at(e,0,5,5,back=(3,5)); n0 = e.lib.dbg_count()
    prev=None
    for i in range(90):
        e.step(p0=['RIGHT'] if i < 22 else [])
        g = fgrid(e); row = ''.join('B' if (g[5][c] & 0xFF00) == 0xC900 else '.' for c in range(16))
        w = e.wram(); objs=[]
        for a in range(0x800, 0x1c00, 0x10):
            r = w[a] | w[a+1]<<8 | w[a+2]<<16
            if (r>>16)==0xC1 and 0x3400 <= (r&0xFFFF) < 0x3A00: objs.append((hex(r), (w[a+0x12]|w[a+0x13]<<8)))
        k=(row, hex(rt(e,1)), pos(e,0)[0]//16, objs[:1], e.r16(b+0x96)>0, bool(occ_of(e,1)))
        if k!=prev: print('  ', e.ticks, k); prev=k
    print('s=',s,[(r['f'],hex(r['pc'])) for r in e.log()[n0:] if r['t']=='EXEC' and r['pc'] in (0xC20E29,0xC259D6)])
