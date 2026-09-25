import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new(mt.OUT+'st_racer_battle.bin')
shots=[]
def s(tag):
    p=mt.OUT+f'racer_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
e.tap('A',0,3,1); s('a')
for k in range(15):
    e.run(20); s(f'w{k}')
open(mt.OUT+'st_racer_battle2.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_racer.png')
