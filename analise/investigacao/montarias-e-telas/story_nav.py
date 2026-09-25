import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new('st_title')
shots=[]
def s(tag):
    p=mt.OUT+f'story_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
s('t')
e.tap('START',0,3,60); s('start')
e.tap('A',0,3,60); s('normal')
for k in range(10):
    e.tap('START',0,3,90); s(f'st{k}')
open(mt.OUT+'st_story1.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_story.png')
