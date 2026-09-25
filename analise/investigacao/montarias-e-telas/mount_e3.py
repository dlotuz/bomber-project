import mt, mount_lib as M
e=mt.new()
M.mount(e,0xE)
e.w16(0x512,48); e.w16(0x516,48)
e.run(1,p0=['RIGHT']); e.run(2,p2=['LEFT']); e.run(2,p2=['RIGHT'])
e.run(3,p0=['Y'])
f=0
while not e.r8(0x5e6) and f<100: e.run(1); f+=1
g=0; hist=[]
while e.r8(0x5e6) and g<3000: 
    hist.append((e.r8(0x5e4),e.r8(0x5e6))); e.run(1); g+=1
print('acerta após', f, 'frames; dura', g, 'frames; E4 seq', sorted(set(h[0] for h in hist)))
# velocidade sob efeito: novo tiro, P3 anda p/ direita 40 frames
M.mount(e,0xE); e.w16(0x512,48); e.w16(0x516,48)
e.run(1,p0=['RIGHT']); e.run(2,p2=['LEFT']); e.run(2,p2=['RIGHT']); e.run(3,p0=['Y'])
while not e.r8(0x5e6): e.run(1)
x0=e.r16(0x512)|0; xs=[]
for i in range(64): e.run(1,p2=['RIGHT']); xs.append(e.r16(0x512))
print('x sob efeito', xs[:20], 'média', (xs[-1]-x0)/64)
