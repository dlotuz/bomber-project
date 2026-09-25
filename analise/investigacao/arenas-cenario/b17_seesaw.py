# Arena 9: jogador entra numa ponta da gangorra; rastreia o jogador e os tiles da gangorra
import sys
from harness import *
col = int(sys.argv[1]) if len(sys.argv) > 1 else 6
e = fresh(9); e.run(1)
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
print('gangorra linha 3:', ['%04X/%04X' % (bg2(e, 3, c), logic(e, 3, c)) for c in range(3, 14)])
print('tab $1F56:', [hex(e.r16(0x1F56 + 2 * i)) for i in range(14)])
clear_cells(e, [(4, col), (5, col), (2, col), (1, col)])
setpos(e, 0, 16 * col, 16 * 5 + 32); e.run(2)
last = None
for f in range(260):
    e.run(1, p0=['UP'] if f < 30 else [])
    w = e.wram(); b = 0x300
    s = ('%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), pos(e), cell_of(e), [('%04X' % bg2(e, 3, c))[1:] for c in (4, 5, 6, 10, 11, 12)], 'z?%02X%02X' % (w[b+0x1A], w[b+0x1B]))
    if s[:2] != (last[:2] if last else None) or s[3] != (last[3] if last else None):
        if f % 2 == 0 or s[0] != (last[0] if last else None): print(f, s)
    last = s
