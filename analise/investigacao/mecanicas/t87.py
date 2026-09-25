from mec import *
e=start_round(timeidx=4)
print('clock', e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1ECE), '9E', hex(e.r16(0x9E)), '1F02', e.r16(0x1F02))
for i in range(200): e.step()
print('clock', e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1ECE), '9E', hex(e.r16(0x9E)))
e.shot(OUT+'t87_inf.png')
e=start_round(timeidx=0)
print('1:00 opt clock', e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1ECE))
