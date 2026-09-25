import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new('st_rules_after')
shots=[]
def s(tag):
    p=mt.OUT+f'racer_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
for i in range(6): e.tap('A',0,3,40)
s('after5')
e.tap('A',0,3,60); s('x1')
e.tap('A',0,3,60); s('x2')
for k in range(10):
    e.run(30); s(f'w{k}')
open(mt.OUT+'st_racer_battle.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_racer.png')
