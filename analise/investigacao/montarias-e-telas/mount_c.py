import mt, mount_lib as M, objlist
from PIL import Image
e=mt.new()
M.mount(e,0xC)
# vai p/ (80,48) olhando p/ direita
for f in range(48): e.run(1,p0=['RIGHT'])
e.w8(0x341,3); e.w8(0x342,3)
ims=[]
for k in range(3):
    e.run(3,p0=['Y']); 
    for f in range(20):
        e.run(1)
    e.shot(mt.OUT+'_tmp.png'); ims.append(Image.open(mt.OUT+'_tmp.png').crop((16,24,240,72)))
    print(k, [(hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6], 'bombs avail',e.r8(0x342), M.pl(e)['x'])
    for f in range(16): e.run(1,p0=['LEFT'])
    e.run(2,p0=['RIGHT'])
m=Image.new('RGB',(224,48*3))
for i,im in enumerate(ims): m.paste(im,(0,48*i))
m.resize((448,288),Image.NEAREST).save(mt.OUT+'mount_C_Y.png')
