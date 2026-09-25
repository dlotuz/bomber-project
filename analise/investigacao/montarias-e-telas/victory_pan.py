import mt, scr, numpy as np
from PIL import Image
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.w8(0x1f34,2); e.run(3,p1=['A'],p2=['A'],p3=['A'],p4=['A'])
e.run(890)
open(mt.OUT+'tt_victory_pre.bin','wb').write(e.save())
def img():
    e.shot(mt.OUT+'_tmp.png'); return np.asarray(Image.open(mt.OUT+'_tmp.png').convert('L'),dtype=np.int32)
prev=img(); out=[]; spr=[]
for f in range(893,1260):
    e.run(1); cur=img()
    best=min(range(-12,13), key=lambda dy: np.abs(np.roll(prev,-dy,axis=0)[40:200,:]-cur[40:200,:]).mean())
    out.append((f,best)); prev=cur
    big=[o for o in scr.oam(e) if o['y']<100]
    spr.append((f,len(big), min([o['y'] for o in big]) if big else None))
mv=[(f,d) for f,d in out if d]
print('pan frames', mv[0], mv[-1], 'total', sum(d for f,d in out), 'valores', sorted(set(d for f,d in out)))
pv=None
for s in spr:
    if (s[1]>0)!=pv: print('sprites topo', s); pv=s[1]>0
for s in spr[::6]:
    if s[1]: print(s)
