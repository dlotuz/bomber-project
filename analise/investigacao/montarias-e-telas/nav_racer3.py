import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new(mt.OUT+'st_racer_battle2.bin')
shots=[]
def s(tag):
    p=mt.OUT+f'racer_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
for k in range(16):
    e.run(25); s(f'w{k}')
open(mt.OUT+'st_racer_battle3.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_racer.png')
