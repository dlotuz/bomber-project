from mec import *
e=Dbg("st_stage00"); e.run(1)
e.ww(0xAE,0xAF)
e.tap('A', hold=2, after=0)
for i in range(700): e.run(1)
from collections import Counter
L=e.log(); print(len(L), Counter(hex(r['pc']) for r in L).most_common(10))
print([ (r['f'],hex(r['val'])) for r in L[:5]])
