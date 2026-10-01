import sys
from lib import *
t = int(sys.argv[1], 16); block = len(sys.argv) > 2
e = new(); mount(e, t)
if block: e.w16(cell(96, 48), 0xCC80)   # bloco no caminho
e.run(3, p0=['A']); e.run(2)
# P1 a direita da bomba olhando p/ esquerda; bomba deve ir para a ESQUERDA... queremos p/ direita: põe P1 à esquerda
e.w16(P1 + 0x12, 15 if False else 31)
for f in range(20): e.run(1, p0=['RIGHT'])
for f in range(3): e.run(1, p0=['LEFT'])
seq = []
for f in range(80):
    e.run(1, p0=['Y'] if f < 3 else [])
    b = [o for o in objs(e) if o['a'] == 0x860]
    if b:
        a = 0x860; w = e.wram()
        seq.append((f, hex(w[a] | w[a+1] << 8 | w[a+2] << 16), b[0]['x'], b[0]['y'], w[a+0x1a] | w[a+0x1b] << 8))
ch = []
for s in seq:
    if not ch or ch[-1][1:] != s[1:]: ch.append(s)
print(ch[:50])
