from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11) if n==1 else None
e.w8(0x34D,0x22); e.w16(0x34E,0)
e.ww(0x34D,0x34F)
prev=None
for i in range(1500):
    e.step()
    v=(e.r8(0x34D), e.r16(0x34E))
    if v[0]!=prev: print('tick',e.ticks,'frame',e.nframes, v)
    prev=v[0]
    if v[0]==0: break
L=e.log(); 
from collections import Counter
print(Counter((hex(r['pc']),r['t']) for r in L if r['t'] in ('W8','W16')))
