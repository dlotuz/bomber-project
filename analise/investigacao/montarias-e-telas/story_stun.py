import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new(mt.OUT+'st_story1.bin')
e.tap('START',0,3,5); e.run(30)
w=e.wram()
L=0x1580
print('liz rt', w[L:L+3][::-1].hex(), 'type $18=',hex(w[L+0x18]), 'x',e.r16(L+0x12),'y',e.r16(L+0x16))
p0=w[0x300:0x400]
e.w8(L,0xAC); e.w8(L+1,0xC8); e.w8(L+2,0xC1)
e.run(2)
w=e.wram(); print('after stun rt', w[L:L+3][::-1].hex(), 'timer57', e.r16(L+0x57))
shots=[]
def s(tag):
    p=mt.OUT+f'story_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
s('stunned')
lx,ly=e.r16(L+0x12),e.r16(L+0x16)
e.w16(0x312,lx); e.w16(0x316,ly)
mt.watch(e, wlo=0x300, whi=0x3ff)
for k in range(12):
    e.run(5); s(f'k{k}')
    w=e.wram(); print(k,'P1 rt',w[0x300:0x303][::-1].hex(),'x',e.r16(0x312),'y',e.r16(0x316),'5D',hex(w[0x35d]),'liz rt',w[L:L+3][::-1].hex())
lg=mt.log(e)
import collections
ch=collections.OrderedDict()
for pc,kd,a,v in lg:
    ch.setdefault(a,[]).append((hex(pc),v))
p1=e.wram()[0x300:0x400]
print('changed fields', [(hex(a-0x300),p0[a-0x300],p1[a-0x300]) for a in range(0x300,0x400) if p0[a-0x300]!=p1[a-0x300]])
open(mt.OUT+'st_story_ride.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_story.png')
