from mec import *
e=TDbg("st_arena01"); e.run(1)
# caveira em (3,9): bomba em (2,9) (vazio), fugir para (2,11)
bomb_at(e,0,2,9,back=(3,11))
for i in range(160): e.step()
g=grid(e); print('cell (3,9) =', hex(g[9][3]))
tele(e,0,2,9); e.run(1)
for i in range(20): e.step(p0=['RIGHT'])
print('P1 $4D =', hex(e.r8(0x34D)), 'speed px/tick now:')
x0=pos(e)[0]
for i in range(4): e.step(p0=['LEFT'])
print(pos(e)[0]-x0)
