import mt, mount_lib as M, objlist, sys
from PIL import Image
e=mt.new()
t1=int(sys.argv[1],16); t2=int(sys.argv[2],16)
M.mount(e,t1)
e.w16(M.cell(64,48),0x0940+t2)
for f in range(32): e.run(1,p0=['RIGHT'])
for f in range(60): e.run(1)
p=M.pl(e)
print('após 2º ovo: rt',hex(p['rt']),'tipo',p['t5c'],'$32',p['f32'],'x',p['x'],'1ED4',e.r8(0x1ed4),'grade(64,48)',hex(e.r16(M.cell(64,48))))
print('objs', [(hex(o['a']),hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6])
for f in range(40): e.run(1,p0=['LEFT'])
e.shot(mt.OUT+f'second_egg_{t1:X}_{t2:X}.png')
print('após andar p/ esquerda: objs', [(hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6])
# atingido: bomba e fica parado
e.run(3,p0=['A']); e.run(1)
print('bomba?', hex(e.r16(M.cell(M.pl(e)['x']//16*16, 48))))
hist=[]
for f in range(300):
    e.run(1); p=M.pl(e); hist.append((f,hex(p['rt']),p['r5d'],p['t5c'],p['f32'],p['i96'],e.r8(0x1ed4)))
prev=None
for h in hist:
    if h[1:5]!=prev: print(h); prev=h[1:5]
print('objs fim', [(hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6])
e.shot(mt.OUT+f'second_egg_{t1:X}_{t2:X}_hit.png')
