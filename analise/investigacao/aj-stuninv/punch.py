"""Bomba socada pelo P1 caindo na cabeça do P2 depois de ele perder a montaria. Argumento: atraso s (ticks depois
de D0) em que o P1 começa a montar o soco."""
from h import *
import sys, os
VERB=os.environ.get('VERB')
def trial(s):
    e = TDbg(); e.load(open('d0_None.bin','rb').read()); e.ticks = 0
    e.bp(0xC20E29); e.bp(0xC259D6); e.bp(0xC259F5)
    b = ob(1)
    while e.ticks < s: e.step()
    fire0, bombs0 = e.obj(1)[0x44], e.obj(1)[0x42]
    bomb_at(e,0,5,5,back=(4,5)); e.w8(0x362,2)
    n0 = e.lib.dbg_count()
    e.step(p0=['Y']); e.step(p0=['Y'])
    land = None; trace = []
    for i in range(140):
        prev_occ = occ_of(e,1)
        e.step()
        g=fgrid(e); trace.append((e.ticks, hex(rt(e,1)), e.r16(b+0x96), tuple(occ_of(e,1)), hex(g[5][5]), hex(g[5][8]), hex(g[5][9]), e.obj(1)[0x44], e.obj(1)[0xe8], e.obj(1)[0xe9], e.obj(1)[0xe0], e.nframes))
    L = [r for r in e.log()[n0:] if r['t']=='EXEC' and r['pc'] in (0xC20E29, 0xC259D6, 0xC259F5)]
    stun = [ (r['f'], hex(r['pc']), hex(r['x'])) for r in L]
    g = fgrid(e)
    return dict(s=s, stun=stun, fire=(fire0, e.obj(1)[0x44]), bombs=(bombs0, e.obj(1)[0x42]), grid85=hex(g[5][8]), trace=trace)
for s in [int(a) for a in sys.argv[1:]]:
    r = trial(s)
    print('s=',s,'calls',r['stun'],'fogo',r['fire'],'bombas',r['bombs'],'grade(8,5) no fim',r['grid85'])
    prev=None
    for t in r['trace']:
        k=(t[1],t[2] if VERB else 0,t[3],t[4],t[5],t[6],t[7],t[8],t[9],t[10])
        if k!=prev: print('   ', t); prev=k
