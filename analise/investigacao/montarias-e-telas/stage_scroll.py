import mt, scr, numpy as np
from PIL import Image
e=mt.new(); e.load(open(mt.OUT+'tt_stage.bin','rb').read()); e.run(1)
def band():
    e.shot(mt.OUT+'_tmp.png'); return np.asarray(Image.open(mt.OUT+'_tmp.png').convert('L'),dtype=np.int32)[48:140]
prev=band(); total=0; out=[]
texts=[]
for f in range(30):
    e.run(1,p0=['RIGHT'] if f<1 else [])
    cur=band()
    best=min(range(-40,41), key=lambda dx: np.abs(np.roll(prev,-dx,axis=1)[:,48:208]-cur[:,48:208]).mean())
    total+=best; out.append(best); prev=cur
    t=[(o['x'],o['y'],o['tile']) for o in scr.oam(e) if o['y'] in (152,184)]
    texts.append(len(t))
print('deslocamento px/frame', out, 'total', total)
print('sprites de texto visíveis por frame', texts)
