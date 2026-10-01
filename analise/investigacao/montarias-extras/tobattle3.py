from lib import *
e = new('mx_tb')
for p in range(1, 5): e.tap('A', player=p, after=30)
for i in range(5): e.tap('A', after=100)
e.run(150); e.shot(OUT + 'arena01.png')
print('P1 x,y', e.r16(P1 + 0x12), e.r16(P1 + 0x16), 'rt', hex(e.r16(P1) | e.r8(P1 + 2) << 16), 'flag', e.wram()[0x170BD])
save(e, 'mx_arena01')
