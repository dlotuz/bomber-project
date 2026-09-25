from mec import *
e=Dbg("st_arena05"); e.run(1)
tele(e,2,14,11)
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
e.run(15,p0=['RIGHT'])
w=e.wram(); print(len(w))
b=0x11000
for r in range(0,13): print(r, ' '.join(f'{w[b+r*0x40+c*2]|w[b+r*0x40+c*2+1]<<8:04X}' for c in range(16)))
print('P $90..93', [hex(e.r16(0x390+n*0x100)) for n in range(5)], 'P1 $80', hex(e.r16(0x380)))
