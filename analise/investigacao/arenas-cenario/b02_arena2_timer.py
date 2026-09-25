# Arena 2: trocas de modo ($1EB6) ao longo de 6000 frames
from harness import *
e = fresh(2); last = e.r8(0x1EB6); t = 0; out = []
for f in range(6000):
    e.run(1)
    m = e.r8(0x1EB6)
    if m != last: out.append((f, last, m, f - t)); t = f; last = m
print(out)
