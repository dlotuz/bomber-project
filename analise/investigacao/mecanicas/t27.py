from mec import *
e=Dbg("st_arena05"); e.run(1)
for n in range(5): e.w8(0x344+n*0x100,0)
tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
e.w16(0x412,cx(10)); e.w16(0x416,cy(1))
e.bp(0xC2141C)
e.run(250)
from collections import Counter
L=e.log()
c=Counter((r['f'],r['x']) for r in L if r['t']=='EXEC')
frames=sorted(set(f for f,x in c))
missing=[f for f in range(frames[0],frames[-1]) if f not in frames]
print('frames with no P-routine exec:', missing)
print(Counter(r['x'] for r in L))
