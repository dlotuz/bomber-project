from mec import *
from collections import Counter
e=Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
for i in range(508): e.run(1)
e.trace(True); e.run(6); e.trace(False)
L=e.log(); pcs=[r['pc'] for r in L]
callers=Counter()
for i,p in enumerate(pcs):
    if p==0xC354B3: callers[hex(pcs[i-1])]+=1
print(callers)
