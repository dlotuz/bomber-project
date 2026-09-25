# Arena 7: seta em (3,4) (direita). (1) jogador passando por cima; (2) bomba chutada passando por cima
from harness import *
def prep():
    e = fresh(7); e.run(1)
    clear_cells(e, [(3, c) for c in range(2, 15) if c not in (4, 12)] + [(r, 4) for r in range(1, 12) if r not in (3, 9)])
    for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
    return e
e = prep()
print('(3,4) log=%04X bg2=%04X' % (logic(e, 3, 4), bg2(e, 3, 4)))
setpos(e, 0, 64, 112); e.run(1)
print('(1) jogador subindo pela coluna 4 (segurando CIMA)')
last = None
for f in range(70):
    e.run(1, p0=['UP']); p = pos(e)
    if p != last and (f % 6 == 0 or 70 <= p[1] <= 90 or p[0] != 63): print('  ', f, p, cell_of(e), '%06X' % (e.r16(0x300) | e.r8(0x302) << 16))
    last = p
e = prep(); e.w8(0x34A, 0xFF)
setpos(e, 0, 48, 80); e.run(2); e.run(3, p0=['A']); e.run(1)
setpos(e, 0, 32, 80); e.run(1)
print('(2) bomba em (3,3)? log=%04X  jogador empurra para a direita' % logic(e, 3, 3))
bombs = []
for f in range(150):
    e.run(1, p0=['RIGHT'] if f < 30 else [])
    s = [(r, c) for r in range(1, 12) for c in range(2, 15) if logic(e, r, c) == 0xC900]
    if not bombs or s != bombs[-1][1]: bombs.append((f, s, pos(e)))
print('   (frame, casas com bomba, pos P1):', bombs)
