from mec import *
for btn in ['B','A','X','Y','L','R']:
    e=TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
    e.w8(0x3D8,0); e.w8(0x348,0)
    tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
    for i in range(100):
        e.step(p0=['RIGHT'] if i<16 else ([btn] if 22<=i<26 else []))
    g=grid(e)[1]
    print(btn, ''.join('B' if (v&0xEFC0)==0xC900 else '.' for v in g))
