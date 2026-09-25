# referencia: chute na arena 1 (sem setas) e na arena 7 com linha toda limpa
import sys
from harness import *
n = int(sys.argv[1])
e = fresh(n); e.run(1)
clear_row(e, 3)
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
e.w8(0x34A, 0xFF)
setpos(e, 0, 48, 80); e.run(4); e.run(3, p0=['A']); e.run(2)
for f in range(24): e.run(1, p0=['LEFT'])
last = None
for f in range(120):
    e.run(1, p0=['RIGHT'] if f < 14 else [])
    ob = [('%06X' % p, x, y) for a, p, x, y in objects(e, base=0x800, hi=0x1400) if x > 20]
    if ob != last and (f % 4 == 0 or not ob or ob[0][0] != 'C135E1'): print(f, ob); last = ob
print('row3 logic', ['%04X' % logic(e, 3, c) for c in range(2, 15)])
