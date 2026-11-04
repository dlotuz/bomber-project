"""Despeja os campos do objeto da bomba antes e depois de explodir (descobrir +$23 → +$2D)."""
from fh import *
e = setup()
a = place(e, 0, 6, 5, fire=3, fuse=5)
print(hex(a), e.wram()[a:a + 0x30].hex(' '))
for i in range(12):
    e.step(); inv(e)
    print(e.ticks, e.wram()[a:a + 0x30].hex(' '))
