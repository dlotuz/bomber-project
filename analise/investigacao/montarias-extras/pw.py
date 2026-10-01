import sys
from lib import *
code = sys.argv[1]
e = new('mx_password')
F = 0x170BD
for i, d in enumerate(code):
    if i: e.tap('RIGHT', hold=2, after=8)
    for _ in range(int(d)): e.tap('UP', hold=2, after=8)
e.shot(OUT + f'pwe_{code}.png')
print('antes', e.wram()[F])
e.tap('START', hold=2, after=10)
for k in range(30):
    e.run(10)
    if e.wram()[F]: print('flag ligou no quadro +', k * 10, '=', e.wram()[F]); break
e.shot(OUT + f'pwr_{code}.png'); print('depois', e.wram()[F])
e.run(240); e.shot(OUT + f'pwr2_{code}.png')
save(e, 'mx_after_' + code)
