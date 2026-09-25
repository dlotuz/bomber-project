import mt, mount_lib as M, objlist
from PIL import Image
e=mt.new()
# 1) velocidade com patins
for t in (None,3,0xE):
    if t is None:
        e.load(open(mt.EST+'st_arena01.bin','rb').read()); e.run(1); M.clear_soft(e)
    else: M.mount(e,t)
    e.w8(0x340,4)
    xs=[]
    for f in range(100): e.run(1,p0=['RIGHT']); xs.append(e.r16(0x312))
    print('speed lvl4, tipo',t,'px/f', (xs[99]-xs[19])/80)
# 2) segundo ovo enquanto montado
M.mount(e,3)
e.w16(M.cell(64,48),0x0940+0x3A)
seq=[]
for f in range(120):
    e.run(1,p0=['RIGHT'] if f<40 else [])
    p=M.pl(e); seq.append((f,hex(p['rt']),p['t5c'],p['f32'],p['x'],e.r8(0x1ed4)))
prev=None
for s in seq:
    if s[1:4]!=prev: print(s); prev=s[1:4]
print('objs', [(hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6])
e.shot(mt.OUT+'second_egg.png')
base=e.save()
# 3) atingido com ovo reserva
e.run(3,p0=['A'])
hist=[]
for f in range(300):
    e.run(1); p=M.pl(e); hist.append((f,hex(p['rt']),p['r5d'],p['t5c'],p['f32'],p['i96'],e.r8(0x1ed4)))
prev=None
for h in hist:
    if h[1:5]!=prev: print(h); prev=h[1:5]
