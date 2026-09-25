import mt, scr, numpy as np
from PIL import Image
def track(sec_hi, sec_lo, N, tag):
    e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
    for p in range(1,5): e.w16(0x312+p*0x100, 0)  # tira ninguém; só p/ constar
    e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
    e.w8(0x1ed2,sec_hi); e.w8(0x1ed0,sec_lo)
    e.run(1); e.shot(mt.OUT+'_ref.png'); ref=np.asarray(Image.open(mt.OUT+'_ref.png').convert('L'),dtype=int)
    out=[]
    for f in range(N):
        e.run(1)
        # texto = pixels muito claros (quase brancos/verdes) que diferem do ref
        e.shot(mt.OUT+'_tmp.png'); a=np.asarray(Image.open(mt.OUT+'_tmp.png').convert('RGB'),dtype=int)
        g=np.asarray(Image.open(mt.OUT+'_tmp.png').convert('L'),dtype=int)
        d=(np.abs(g-ref)>40); d[:24,:]=False
        ys,xs=np.nonzero(d)
        # remove jogadores: restringe a pixels verdes claros (texto HURRY/TIME UP é verde claro)
        m=(a[:,:,1]>150)&(a[:,:,0]<200)&d
        ys,xs=np.nonzero(m)
        out.append((f, (xs.min(),xs.max(),ys.min(),ys.max()) if len(xs)>30 else None))
    prev=None
    for f,b in out:
        if (b is None)!=(prev is None) or f%10==0: print(tag,f,b)
        prev=b
track(1,1,200,'HURRY')
track(0,1,200,'TIMEUP')
