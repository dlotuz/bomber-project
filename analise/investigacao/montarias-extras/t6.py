import sys
from lib import *
for t in (2, 6):
    e = new(); mount(e, t)
    e.run(3, p0=['A']); e.run(1)
    w = e.wram(); print('tipo', t, 'bomba +$22/+$23', w[0x860 + 0x22], w[0x860 + 0x23])
    for f in range(30): e.run(1, p0=['DOWN'])   # sai da linha
    mx = 0
    for f in range(140):
        e.run(1)
        row = [e.r16(cell(x, 48)) for x in range(16, 240, 16)]
        n = sum(1 for v in row if v and v not in (0xEC40,) and (v & 0xFF00) != 0x0900)
        mx = max(mx, n)
        if f == 105: e.shot(OUT + f't6_{t}.png'); print('  linha', [hex(v) for v in row])
    print('  casas com chama na linha (max)', mx)
