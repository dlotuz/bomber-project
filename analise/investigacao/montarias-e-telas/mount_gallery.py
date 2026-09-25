import mt, mount_lib as M
from PIL import Image, ImageDraw
e=mt.new()
rows=[]
info=[]
for t in range(16):
    seq=M.mount(e,t,maxf=300)
    ok=seq[-1]['r5d']!=0
    crops=[]
    # parado (virado para baixo)
    e.shot('/tmp/_m.png') if False else None
    p=M.pl(e)
    def crop():
        e.shot(mt.OUT+'_tmp.png'); im=Image.open(mt.OUT+'_tmp.png')
        q=M.pl(e); x,y=q['x'],q['y']
        return im.crop((x-20,y-40,x+20,y+8)).resize((80,96),Image.NEAREST)
    crops.append(crop())
    for d in ['RIGHT','DOWN','LEFT','UP']:
        for f in range(12): e.run(1,p0=[d])
        crops.append(crop())
    info.append((t,ok,len(seq),M.pl(e)))
    rows.append(crops)
W=80;H=96
m=Image.new('RGB',(W*5+40,H*16),(30,30,30)); dr=ImageDraw.Draw(m)
for i,r in enumerate(rows):
    dr.text((2,i*H+40),'%X'%i,fill=(255,255,0))
    for j,c in enumerate(r): m.paste(c,(40+j*W,i*H))
m.save(mt.OUT+'mount_gallery_all16.png')
for t,ok,n,p in info: print(hex(t),'montou' if ok else 'NAO', n, hex(p['rt']), p['x'],p['y'])
