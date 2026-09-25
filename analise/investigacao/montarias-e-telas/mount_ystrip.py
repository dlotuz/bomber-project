import mt, sys, mount_lib as M, objlist
from PIL import Image, ImageDraw
t=int(sys.argv[1],16); btn=sys.argv[2] if len(sys.argv)>2 else 'Y'
setup=sys.argv[3] if len(sys.argv)>3 else 'soft'
e=mt.new()
M.mount(e,t)
if setup=='soft': e.w16(M.cell(112,48),0xCC80)
# segundo jogador (P3, em (224,48)) move-se para (160,48)
e.w16(0x512,176); e.w16(0x516,48)
for f in range(8): e.run(1,p0=['RIGHT'])
frames=[]
log=[]
for f in range(96):
    e.run(1,p0=([btn] if f in (0,1,2) else []))
    if f%6==0:
        e.shot(mt.OUT+'_tmp.png'); frames.append(Image.open(mt.OUT+'_tmp.png').crop((16,16,240,80)))
    p=M.pl(e)
    log.append((f,hex(p['rt']),p['x'],p['y'],hex(e.r16(M.cell(112,48))), [ (hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if o['a']>=0x800 and o['a']<0x1400 and o['rt'] not in (0xC34EE6,)]))
m=Image.new('RGB',(224*2,64*((len(frames)+1)//2)))
for i,im in enumerate(frames): m.paste(im,((i%2)*224,(i//2)*64))
m=m.resize((m.width*2,m.height*2),Image.NEAREST)
m.save(mt.OUT+f'mount_{t:X}_{btn}_{setup}.png')
prev=None
for l in log:
    k=(l[1],l[4],str(l[5]))
    if k!=prev: print(l); prev=k
