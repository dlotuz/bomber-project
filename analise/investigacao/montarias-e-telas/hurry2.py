import mt, scr
from PIL import Image
for tag,hi,lo,N,step in [('HURRY',1,1,200,6),('TIMEUP',0,1,260,8)]:
    e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
    e.w8(0x1ed2,hi); e.w8(0x1ed0,lo)
    ims=[]
    for f in range(N):
        e.run(1)
        if f%step==0:
            e.shot(mt.OUT+'_tmp.png'); ims.append((f,Image.open(mt.OUT+'_tmp.png').crop((0,24,256,224))))
    cols=6; W,H=256,200
    m=Image.new('RGB',(W*cols,(H+10)*((len(ims)+cols-1)//cols)),(30,30,30))
    from PIL import ImageDraw; d=ImageDraw.Draw(m)
    for i,(f,im) in enumerate(ims):
        x,y=(i%cols)*W,(i//cols)*(H+10); m.paste(im,(x,y+10)); d.text((x+2,y),f'+{f}',fill=(255,255,0))
    m=m.resize((m.width//2,m.height//2))
    m.save(mt.OUT+f'g_{tag}.png')
