from mec import *
e=Dbg("st_arena05"); e.run(1)
tele(e,2,14,11)
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
e.run(20,p0=['RIGHT'])
print(pos(e), 'facing $62', e.r8(0x362), '$98', hex(e.r8(0x398)), '$5C',hex(e.r8(0x35C)), '$4A', hex(e.r8(0x34A)))
for a in (0xC24307,0xC24355,0xC2435D,0xC24370,0xC24389,0xC243A3,0xC243C1,0xC214D9,0xC214D2): e.bp(a)
e.clear(); e.run(3,p0=['RIGHT'])
from collections import Counter
print(Counter(hex(r['pc']) for r in e.log() if r['x']==0x300))
