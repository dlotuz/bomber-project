from lib import *
e = new('mx_tb')
shots = []
for p in range(1, 5):
    e.tap('A', player=p, after=30)
for i in range(10):
    e.tap('A', after=100); pth = OUT + f'tc_{i:02d}.png'; e.shot(pth); shots.append(pth)
save(e, 'mx_tc')
import sys; sys.path.insert(0, '../../ferramentas'); from nav import grid
grid(shots, OUT + 'g_tc.png', 5)
