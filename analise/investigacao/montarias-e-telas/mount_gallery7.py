import mt, mount_lib as M
from PIL import Image, ImageDraw
e=mt.new()
types=[0x2,0x3,0xA,0xC,0xD,0xE,0xF]
rows=[]
for t in types:
    M.mount(e,t)
    # leva até (64,96)? usa coluna 2 descendo p/ y=80 (área aberta)
    for f in range(32): e.run(1,p0=['DOWN'])
    crops=[]
    for d in [None,'RIGHT','UP','LEFT','DOWN']:
        if d:
            for f in range(10): e.run(1,p0=[d])
            e.run(1)
        e.shot(mt.OUT+'_tmp.png'); im=Image.open(mt.OUT+'_tmp.png'); q=M.pl(e)
        x,y=q['x'],q['y']
        crops.append(im.crop((x-20,y-34,x+20,y+10)).resize((120,132),Image.NEAREST))
    rows.append(crops)
m=Image.new('RGB',(40+120*5,132*len(types)),(20,20,20)); d=ImageDraw.Draw(m)
for i,r in enumerate(rows):
    d.text((4,i*132+60),'tipo %X'%types[i],fill=(255,255,0))
    for j,c in enumerate(r): m.paste(c,(40+j*120,i*132))
m.save(mt.OUT+'montarias_battle_7tipos.png'); print(m.size)
