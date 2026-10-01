from lib import *
e = new('mx_after_0164')
e.tap('UP', after=20)   # PASSWORD -> BATTLE GAME
shots = []
for i in range(16):
    e.tap('A', after=90); p = OUT + f'tb_{i:02d}.png'; e.shot(p); shots.append(p)
save(e, 'mx_tb')
import sys; sys.path.insert(0, '../../ferramentas'); from nav import grid
grid(shots, OUT + 'g_tb.png', 8)
