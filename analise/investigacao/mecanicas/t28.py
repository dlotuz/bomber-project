from mec import *
e=Dbg("st_arena01"); e.run(3)
e.trace(True); e.run(1); e.trace(False)
L=e.log(); print(len(L))
pcs=[r['pc'] for r in L]
for i,p in enumerate(pcs):
    if p==0xC2141C:
        print([hex(x) for x in pcs[i-8:i+1]]); break
# find NMI/main loop: print first 40 distinct pcs
import collections
seen=[]
for p in pcs:
    if p not in seen: seen.append(p)
print(len(seen))
open('trace_frame.txt','w').write('\n'.join(f"{r['pc']:06X} A={r['a']:04X} X={r['x']:04X} Y={r['y']:04X}" for r in L))
