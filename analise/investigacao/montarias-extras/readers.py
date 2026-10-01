"""PCs que leem +$5C (tipo da montaria) do P1 durante jogo variado."""
import sys, collections
from lib import *
t = int(sys.argv[1], 16)
e = new(); mount(e, t)
L = e.lib; L.dbg_clear(); L.dbg_add(2, 0x35C, 0x35C); L.dbg_set_max(5000000)
p = OUT + f'rd_{t:x}.log'; L.dbg_open(p.encode())
import random; random.seed(1)
for i in range(60):
    d = random.choice(['RIGHT', 'LEFT', 'UP', 'DOWN'])
    b = random.choice([[], ['A'], ['Y'], ['B']])
    e.run(10, p0=[d] + b)
L.dbg_close()
c = collections.Counter(l.split()[2] for l in open(p))
print(hex(t), sorted(c))
