"""Mede caixas (moldura de corda verde, título azul, textos vermelhos/verdes/azuis) nas telas de menu."""
import mt, scr, numpy as np, sys
from PIL import Image
def bbox(m):
    ys,xs=np.nonzero(m)
    return (int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())) if len(xs) else None
def rows(m, gap=3):
    ys=np.nonzero(m.any(axis=1))[0]; out=[]; st=None; pv=None
    for y in ys:
        if st is None: st=y
        elif y-pv>gap: out.append((st,pv)); st=y
        pv=y
    if st is not None: out.append((st,pv))
    return out
for name in sys.argv[1:]:
    e=mt.new(); e.load(open(mt.OUT+name,'rb').read()); e.run(3)
    e.shot(mt.OUT+'_L.png'); a=np.asarray(Image.open(mt.OUT+'_L.png').convert('RGB'),dtype=int)
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    rope=(g>150)&(r<120)&(b<120)
    blue=(b>180)&(r<90)&(g<140)
    red=(r>200)&(g<130)&(b<90)
    print('==',name)
    print(' moldura verde bbox',bbox(rope))
    print(' título azul bbox',bbox(blue[:80]) , 'linhas azuis',[ (s,e_, bbox(blue[s:e_+1])) for s,e_ in rows(blue)][:8])
    print(' textos vermelhos (linhas y0-y1, x0-x1):',[(s,e_,bbox(red[s:e_+1])[0],bbox(red[s:e_+1])[2]) for s,e_ in rows(red)][:8])
    grn=(g>170)&(r<150)&(b<100)&~rope
    print(' cursor/sprites OAM:',[(o['x'],o['y'],hex(o['tile'])) for o in scr.oam(e)][:6])
