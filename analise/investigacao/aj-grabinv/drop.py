"""P1 (luva) pega o P2 na casa (4,3) e o solta no frame REL=40 de um jeito (1º argumento):
  B | throw (solta o A) | stun | dance | pvict | death (pedidos/bit gravados direto no P1, como em grabrel.py) |
  escape (o P2 aperta B até se soltar).
Opções: flame=K[:N]  liga o bit $1000 (chama, $C2:4B64) na casa do P2 nos ticks REL+K..REL+K+N-1 (padrão 1),
         com o P1 invencível (+$96) para a morte dele não confundir a medida; cell=C,R põe a chama nessa casa
         (no arremesso, a casa do pouso).
Imprime, a cada mudança: frame, tick, rotina do P2, +$96, +$C2, +$C0 e se o bit dele está na ocupação $7F:1000."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'aj-socoluva'))
from h import *  # noqa
mode = sys.argv[1]
opt = dict(a.split('=') for a in sys.argv[2:])
REL = 40
fk = fn = None
fcell0 = 0x2800 + (lambda c, r: r * 0x40 + c * 2)(*map(int, opt['cell'].split(','))) if 'cell' in opt else None
if 'flame' in opt:
    k, _, n = opt['flame'].partition(':'); fk = int(k); fn = int(n or 1)
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,4,3); e.run(1)
e.w8(0x348,0); e.w8(0x349,0xFF); e.w8(0x3D8,0)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
prev = None; t_rel = None; fcell = None
for i in range(220):
    a_on = i < (REL if mode == 'throw' else 200)
    btn = ['A'] if a_on else []
    p1 = []
    if mode == 'B' and i == REL: btn = btn + ['B']
    if mode == 'escape' and i >= REL and i % 2 == 0: p1 = ['B']
    if i == REL:
        if mode == 'stun': e.w16(0x3C0, e.r16(0x3C0) | 0x02)
        if mode == 'dance': e.w16(0x3C0, e.r16(0x3C0) | 0x20)
        if mode == 'pvict': e.w16(0x3C0, e.r16(0x3C0) | 0x2000)
        if mode == 'death': e.w16(0x28C8, e.r16(0x28C8) | 0x1000)
    if fk is not None and t_rel is not None:
        nxt = e.ticks + 1 - t_rel   # tick relativo que este frame vai rodar
        e.w16(0x396, 200)
        if fk <= nxt < fk + fn:
            fcell = fcell or fcell0 or 0x2800 + e.r16(0x480); e.w16(fcell, e.r16(fcell) | 0x1000)
        elif fcell:
            e.w16(fcell, e.r16(fcell) & ~0x1000 & 0xFFFF)
    e.step(p0=btn, p1=p1)
    if i == REL: t_rel = e.ticks
    occ = e.r16(OCC + e.r16(0x480)) & e.r16(0x490) != 0
    s = (f'{rt(e,1):06X}', e.r16(0x496), hex(e.r16(0x4C2)), hex(e.r16(0x4C0)), 'occ' if occ else '-', f'P1 {rt(e,0):06X}')
    if s != prev: print(i, e.ticks, (e.ticks - t_rel) if t_rel else '', s, pos(e,1))
    prev = s
