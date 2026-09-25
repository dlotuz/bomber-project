from mec import *
import sys
st=sys.argv[1] if len(sys.argv)>1 else "st_arena05"
e=TDbg(st); e.run(1)
# jogadores parados em cantos seguros? deixar como estao
e.w8(0x1ED2,1); e.w8(0x1ED0,2)
g0=grid(e)
events=[]
prev_t=None
for i in range(60*80):
    k=e.step()
    t=(e.r8(0x1ED2),e.r8(0x1ED0),e.r8(0x1ECE))
    g=grid(e)
    for r in range(14):
        for c in range(16):
            if g[r][c]!=g0[r][c]:
                events.append((e.ticks, t, c, r, f'{g0[r][c]:04X}->{g[r][c]:04X}'))
    g0=g
    if e.r8(0x1EA0) in (0,1) and i>10 and False: break
    if t==(0,0,0) and prev_t==(0,0,0): 
        pass
    prev_t=t
    if e.obj(0)[:3].hex()!='1c14c2' and False: break
import json
json.dump(events, open(OUT+f'pressure_{st}.json','w'))
print(len(events))
for ev in events[:30]: print(ev)
