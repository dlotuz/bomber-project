import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new(mt.OUT+'st_story1.bin')
e.tap('START',0,3,5); e.run(30)
def objs():
    w=e.wram(); out=[]
    for a in range(0x1400,0x1c00,0x10):
        rt=w[a]|w[a+1]<<8|w[a+2]<<16
        if (rt>>16) in (0xC1,0xC2,0xC3,0xC4,0xC5) and w[a+3]&0x80:
            out.append((hex(a),hex(rt),w[a+0x12]|w[a+0x13]<<8,w[a+0x16]|w[a+0x17]<<8))
    return out
print(objs())
shots=[]
def s(tag):
    p=mt.OUT+f'story_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
e.w8(0x344,4)  # fire
w=e.wram(); lx=w[0x1592]|w[0x1593]<<8; ly=w[0x1596]|w[0x1597]<<8
print('liz',lx,ly)
# put player at nearest cell center to lizard
e.w16(0x312,(lx//16)*16); e.w16(0x316,(ly//16)*16)
e.run(1)
e.run(3,p0=['A']); 
for k in range(24):
    e.w16(0x396,0x1e9)
    e.run(8)
    if k%2==0: s(f'f{k}')
    print(k, objs())
open(mt.OUT+'st_story_bombed.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_story.png')
