from mec import *
import sys
for s in range(12):
    e=Dbg(f"st_stage{s:02d}"); e.run(1)
    e.tap('A', hold=2, after=0)
    e.bp(0xC4179C); e.bp(0xC41824); e.bp(0xC4121D)
    hit=None; fr=None
    for i in range(800):
        e.run(1)
        L=[r for r in e.log() if r['t']=='EXEC']
        if any(r['pc']==0xC4179C for r in L) and hit is None:
            g=grid(e); hit=sum(1 for row in g for v in row if v==0xCC80)
            w=e.wram(); p70=w[0x70]|w[0x71]<<8|w[0x72]<<16; fr=e.nframes
            n42=[r for r in L if r['pc']==0xC4179C][0]
        if any(r['pc']==0xC4121D for r in L): break
    g=grid(e); after=sum(1 for row in g for v in row if v==0xCC80)
    fo=rom24(p70) if hit is not None else None
    print(f'stage-select state {s:02d}: soft antes={hit} depois={after} frame={fr} [$70]={p70:06X} bytes1E={ROM[fo+0x1E] if fo else None} 27={ROM[fo+0x27] if fo else None} seed={hex(e.r16(0xAE))}')
