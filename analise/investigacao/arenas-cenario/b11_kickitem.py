# pega o item Chute (logico 0x094E) de verdade e mostra o que muda no jogador
from harness import *
e = fresh(7); e.run(1)
clear_cells(e, [(1, 3), (1, 4), (1, 5)])
e.w16(0x2800 + cell_addr(1, 3), 0x094E); e.w16(0x2000 + cell_addr(1, 3), 0x12A4)
before = e.wram()[0x300:0x400]
for f in range(20): e.run(1, p0=['RIGHT'])
after = e.wram()[0x300:0x400]
print('pos', pos(e), 'log(1,3)=%04X' % logic(e, 1, 3))
print('diffs', ['+%02X:%02X->%02X' % (i, before[i], after[i]) for i in range(0x100) if before[i] != after[i] and i not in (0x11, 0x12, 0x13, 0x15, 0x16, 0x17, 0x26, 0x27)])
open(SCR + '/rom-arenas/kick07.bin', 'wb').write(e.save())
