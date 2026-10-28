"""P1 (montado em E ou F) atira no P2 depois de ele perder a montaria. args: arquivo pre, pre, s (tick do Y, relativo a D0)."""
from h import *
import sys
f, pre, s = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
e = TDbg(); e.load(open(f,'rb').read()); e.ticks = -pre
e.bp(0xC259BF); e.bp(0xC259C9); e.bp(0xC24C88); e.bp(0xC20D83); e.bp(0xC12ED0); e.bp(0xC12EDA); e.bp(0xC20E29)
b = ob(1); n0 = e.lib.dbg_count()
while e.ticks < s: e.step()
e.step(p0=['Y']); e.step(p0=['Y'])
prev = None
for i in range(300):
    e.step()
    k = (hex(rt(e,1)), e.r16(b+0x96) > 0, tuple(occ_of(e,1)), e.obj(1)[0xe4], hex(e.r16(b+0xC0)))
    if k != prev: print('  ', e.ticks, k, 'i96=', e.r16(b+0x96), 'e6=', e.obj(1)[0xe6]); prev = k
names = {0xC259BF:'59BF pede danca', 0xC259C9:'59C9 grava $20', 0xC24C88:'4C88 trata $20', 0xC20D83:'0D83 danca', 0xC12ED0:'2ED0 E acerta', 0xC12EDA:'2EDA grava lento', 0xC20E29:'0E29 atordoa'}
print([ (r['f'], names[r['pc']], hex(r['x'])) for r in e.log()[n0:] if r['t']=='EXEC' and r['pc'] in names ])
