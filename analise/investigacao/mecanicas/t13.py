from mec import *
e = Dbg("st_arena01")
e.ww(0xAE,0xAF)
e.run(120)
from collections import Counter
L=e.log(); print(len(L)); print(Counter(r['pc'] for r in L).most_common(20))
print(Counter(r['f'] for r in L).most_common(5))
