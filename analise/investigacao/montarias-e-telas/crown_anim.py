import mt, scr
from PIL import Image
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.run(3,p1=['A'],p2=['A'],p3=['A'],p4=['A'])
e.run(390)
open(mt.OUT+'tt_sb_pre.bin','wb').write(e.save())
ims=[]; info=[]
for f in range(393,560):
    e.run(1)
    if f%3==0:
        e.shot(mt.OUT+'_tmp.png'); ims.append(Image.open(mt.OUT+'_tmp.png').crop((8,40,120,80)))
    sp=[(o['x'],o['y'],hex(o['tile']),o['pal']) for o in scr.oam(e) if 50<=o['y']<=80 and o['x']>=60]
    info.append((f,sp[:4]))
prev=None
for f,sp in info:
    if sp!=prev: print(f,sp); prev=sp
m=Image.new('RGB',(112*8,40*((len(ims)+7)//8)))
for i,im in enumerate(ims): m.paste(im,((i%8)*112,(i//8)*40))
m.resize((m.width*2,m.height*2),Image.NEAREST).save(mt.OUT+'crown_anim.png')
