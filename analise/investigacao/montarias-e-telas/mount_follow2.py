import mt, mount_lib as M, objlist
from PIL import Image
e=mt.new()
M.mount(e,3)
e.w16(M.cell(64,48),0x0940+0x32)
for f in range(32): e.run(1,p0=['RIGHT'])
for f in range(40): e.run(1,p0=['DOWN'])   # desce p/ (64,88)? coluna 4 livre
for f in range(10): e.run(1)
p=M.pl(e); a=e.r16(0x352)
print('rider',p['x'],p['y'],'egg',e.r16(a+0x12),e.r16(a+0x16))
c=M.cell((p['x']+8)//16*16,(p['y']+8)//16*16)
hist=[]; ims=[]
for f in range(160):
    if f<3: e.w16(c,0x1002)
    e.run(1); p=M.pl(e); a2=e.r16(0x352)
    hist.append((f,hex(p['rt']),p['r5d'],p['t5c'],p['f32'],hex(a2),p['i96'],p['x'],p['y']))
    if f%10==0: e.shot(mt.OUT+'_tmp.png'); ims.append(Image.open(mt.OUT+'_tmp.png').crop((16,24,144,136)))
prev=None
for h in hist:
    if h[1:6]!=prev: print(h); prev=h[1:6]
m=Image.new('RGB',(128*4,112*4))
for i,im in enumerate(ims): m.paste(im,((i%4)*128,(i//4)*112))
m.save(mt.OUT+'mount_follower_hit.png')
