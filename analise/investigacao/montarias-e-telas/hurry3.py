import mt, scr
from PIL import Image, ImageDraw
out=[]
for tag,hi,lo,f0,f1,step,box in [('HURRY',1,2,60,260,8,(0,96,256,160)),('TIMEUP',0,2,60,260,8,(0,40,256,170))]:
    e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
    e.w8(0x1ed2,hi); e.w8(0x1ed0,lo)
    ims=[]; clk=[]
    for f in range(f1):
        e.run(1)
        if f>=f0 and f%step==0:
            e.shot(mt.OUT+'_tmp.png'); ims.append((f,(e.r8(0x1ed2),e.r8(0x1ed0)),Image.open(mt.OUT+'_tmp.png').crop(box)))
    W=box[2]-box[0]; H=box[3]-box[1]; cols=5
    m=Image.new('RGB',(W*cols,(H+10)*((len(ims)+cols-1)//cols)),(30,30,30)); d=ImageDraw.Draw(m)
    for i,(f,c,im) in enumerate(ims):
        x,y=(i%cols)*W,(i//cols)*(H+10); m.paste(im,(x,y+10)); d.text((x+2,y),f'+{f} {c[0]}:{c[1]:02d}',fill=(255,255,0))
    m.save(mt.OUT+f'g3_{tag}.png')
