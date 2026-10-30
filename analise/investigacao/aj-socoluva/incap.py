"""P1 (luva) segura a própria bomba em (4,3) ((4,5) no modo dance), olhando para a direita, e é incapacitado com ela na mão.
Modo (1º argumento):
  dance   P2 montado no tipo F em (8,5), olhando para a esquerda, solta a nota (Y) no P1
  danceq  pedido de dança gravado direto (+$C0 |= $20, como $C2:59BF)
  stun    pedido de atordoamento gravado direto (+$C0 |= $02, como $C2:59F5)
  pvict   pedido de empurrão do P gravado direto (+$C0 |= $2000, como $C2:49E2)
  death   liga o bit $1000 da casa do P1 na grade ($C2:4B64: morte)
Imprime a rotina do P1, +$8C, a bomba que estava na mão (rotina, x, y, +$1C) e a linha 3 da grade."""
from h import *
import sys
mode = sys.argv[1]
def mount_n(e, n, t, maxf=240):
    b = ob(n); c = 0x2800 + e.r16(b+0x80)
    e.w16(c, 0x0940 + (0x30 | t))
    for f in range(maxf):
        e.step()
        if e.r8(b+0x5d) and rt(e, n) == 0xC2141C: return f + 1
    return None
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,8,5); e.run(1)
if mode == 'dance':
    assert mount_n(e,1,0xF), 'sem montar'   # P2 monta na casa dele (8,5); o P1 fica na mesma linha
    e.w8(0x462, (e.r8(0x462) & ~7) | 6)
else:
    tele(e,1,14,9); e.run(1)
e.w8(0x348,0); e.w8(0x349,0xFF); e.w8(0x3D8,0)
ROW = 5 if mode == 'dance' else 3
tele(e,0,4,ROW); e.run(1); e.w8(0x362,2)
held = None; prev = None; ev_at = 30
e.ww(0x38C, 0x38D); e.bp(0xC259BF); e.bp(0xC24C88); e.bp(0xC20D83); n0 = e.lib.dbg_count()
for i in range(300):
    btn = ['A'] if (i < 2 or 5 <= i < 290) else []
    kw = {'p0': btn}
    if i == ev_at:
        if mode == 'dance': print('P2', hex(rt(e,1)), e.obj(1)[0x5c], e.obj(1)[0x5d], pos(e,1), e.obj(1)[0x62])
        elif mode == 'danceq': e.w16(0x3C0, e.r16(0x3C0) | 0x20)
        elif mode == 'stun': e.w16(0x3C0, e.r16(0x3C0) | 0x02)
        elif mode == 'pvict': e.w16(0x3C0, e.r16(0x3C0) | 0x2000)
    if mode == 'dance' and ev_at <= i < ev_at + 2: kw['p1'] = ['Y']
    if mode == 'death' and i == ev_at: e.w16(0x2800 + ROW*0x40 + 8, e.r16(0x2800 + ROW*0x40 + 8) | 0x1000)
    e.step(**kw)
    c = e.r16(0x38C); held = held or c or None
    w = e.wram(); hb = (f'{w[held+2]<<16|w[held+1]<<8|w[held]:06X}', e.r16(held+0x12), e.r16(held+0x16), w[held+0x1C]) if held else None
    s = (hex(rt(e,0)), hex(c), hb, pos(e,0), ''.join('B' if (v&0xEFC0)==0xC900 else ('*' if (v&0xFF00) in (0xEC00,0xED00) else '.') for v in grid(e)[ROW]))
    if s != prev: print(i, e.ticks, s)
    prev = s
for r in e.log()[n0:]:
    if r['t'] in ('W8','W16') and r['addr'] in (0x38C,0x38D): print(fmt(r))
names = {0xC259BF: '59BF pede danca', 0xC24C88: '4C88 trata $20', 0xC20D83: '0D83 danca'}
print([(r['f'], names[r['pc']], hex(r['x'])) for r in e.log()[n0:] if r['t'] == 'EXEC' and r['pc'] in names and r['pc'] != 0xC24625][:12], 'C6 do P2:', e.obj(1)[0xc6])
