import mt, mount_lib as M, objlist
from PIL import Image
e=mt.new()
M.mount(e,3)
e.w16(M.cell(64,48),0x0940+0x32)
for f in range(32): e.run(1,p0=['RIGHT'])
for f in range(30): e.run(1)
print('$52',hex(e.r16(0x352)),'$54',hex(e.r16(0x354)),'$32',e.r8(0x332))
a=e.r16(0x352)
if a: print('follower rt', hex(e.r16(a)|e.r8(a+2)<<16), 'xy', e.r16(a+0x12), e.r16(a+0x16))
ims=[]
for f in range(64):
    e.run(1,p0=['DOWN'] if f<32 else ['RIGHT'])
    if f%8==7: e.shot(mt.OUT+'_tmp.png'); ims.append(Image.open(mt.OUT+'_tmp.png').crop((16,24,144,120)))
m=Image.new('RGB',(128*4,96*2))
for i,im in enumerate(ims): m.paste(im,((i%4)*128,(i//4)*96))
m.resize((1024,384),Image.NEAREST).save(mt.OUT+'mount_follower_egg.png')
if a: print('follower xy after', e.r16(a+0x12), e.r16(a+0x16), 'rider', M.pl(e)['x'],M.pl(e)['y'])
# atingido com ovo reserva
e.run(3,p0=['A'])
hist=[]
for f in range(260):
    e.run(1); p=M.pl(e); hist.append((f,hex(p['rt']),p['r5d'],p['t5c'],p['f32'],hex(e.r16(0x352)),p['i96']))
prev=None
for h in hist:
    if h[1:6]!=prev: print(h); prev=h[1:6]
