from mec import *
e=TDbg(OUT+'st_r_racer.bin'); e.run(1)
tele(e,0,8,6); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1)
tele(e,1,8,5); tele(e,2,8,4); tele(e,3,8,7); tele(e,4,8,6); e.run(1)
shots=0; prev=None
for i in range(3000):
    e.step(p0=['A'] if (i%40<2 and i>400) else [])
    s=(e.r8(0x1BD)==0, e.obj(0)[:3].hex())
    if i%150==0 and i>300:
        e.shot(OUT+f't102_{i}.png'); 
    if e.obj(0)[:3].hex()=='1c14c2' and i>1000 and e.r8(0x1EA0)==5:
        break
print('frame',i,'1F4C',e.r16(0x1F4C),'1F4E',e.r16(0x1F4E),'1F50',hex(e.r16(0x1F50)))
for n in range(5): print(n, e.obj(n)[0x40:0x50].hex(' '), 'D8',e.obj(n)[0xD8],'E3',e.obj(n)[0xE3])
