# Arena 6: efeito de cada piso especial (1C0A listras, 1C0C caveira, 1C08 caveirinhas) no jogador e na bomba
from harness import *
def put(e, r, c, t):
    a = cell_addr(r, c); e.w16(0x2000 + a, t); e.w16(0x3800 + a, t)
def trace_player(e, frames, btn, tag):
    last = None
    for f in range(frames):
        e.run(1, p0=btn(f)); w = e.wram(); b = 0x300
        s = ('%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), pos(e), 'E4=%02X E6=%02X 4D=%02X' % (w[b+0xE4], w[b+0xE6], w[b+0x4D]))
        if s != last: print(' ', tag, f, s); last = s
# (a) listras: jogador anda para a direita e entra na casa (5,5) com 1C0A
e = fresh(6); e.run(1); clear_row(e, 5); [setpos(e, k, 32 + 16 * k, 208) for k in range(1, 5)]
put(e, 5, 5, 0x1C0A); setpos(e, 0, 48, 112); e.run(1)
print('(a) 1C0A, segurando DIREITA 12 frames e soltando')
trace_player(e, 120, lambda f: ['RIGHT'] if f < 26 else [], 'a')
# (b) caveira
e = fresh(6); e.run(1); clear_row(e, 5); [setpos(e, k, 32 + 16 * k, 208) for k in range(1, 5)]
put(e, 5, 5, 0x1C0C); setpos(e, 0, 48, 112); e.run(1)
print('(b) 1C0C, segurando DIREITA')
trace_player(e, 140, lambda f: ['RIGHT'] if f < 40 else (['LEFT'] if f < 100 else []), 'b')
# (c) bomba em cima de 1C08
e = fresh(6); e.run(1); clear_row(e, 5); [setpos(e, k, 32 + 16 * k, 208) for k in range(1, 5)]
put(e, 5, 5, 0x1C08); setpos(e, 0, 80, 112); e.run(1)
e.run(3, p0=['A']); setpos(e, 0, 224, 48)
print('(c) bomba em 1C08: logic/bg2 de (5,5) e vizinhos')
last = None
for f in range(200):
    e.run(1)
    s = ['%04X/%04X' % (logic(e, 5, c), bg2(e, 5, c)) for c in range(3, 9)]
    if s != last: print('  c', f, s); last = s
