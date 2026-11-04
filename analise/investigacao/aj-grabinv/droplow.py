"""Ordem dos slots: o P2 (slot 1, luva +$49 = $FF) pega o P1 (slot 0) em (4,3) e larga com B no frame 40.
Com quem segura rodando depois do largado, o P1 só vê o +$C2 bit $10 ($C2:4BC4) no tick seguinte.
Opção flame=K: chama (bit $1000) na casa do P1 do tick relativo K em diante, com o P2 invencível.
Imprime a rotina do P1 e do P2, +$96 do P1 e a ocupação $7F:1000 do P1."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'aj-socoluva'))
from h import *  # noqa
opt = dict(a.split('=') for a in sys.argv[1:])
fk = int(opt['flame']) if 'flame' in opt else None
e = TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,0,4,3); e.run(1)
e.w8(0x448,0); e.w8(0x449,0xFF); e.w8(0x4D8,0)
tele(e,1,4,3); e.run(1); e.w8(0x462,2)
prev = None; t_rel = None; cell = 0x2800 + 3 * 0x40 + 4 * 2
for i in range(140):
    p1 = (['A'] if i < 120 else []) + (['B'] if i == 40 else [])
    if fk is not None and t_rel is not None:
        e.w16(0x496, 200)
        if e.ticks + 1 - t_rel >= fk: e.w16(cell, e.r16(cell) | 0x1000)
    e.step(p1=p1)
    if i == 40: t_rel = e.ticks
    occ = e.r16(OCC + e.r16(0x380)) & e.r16(0x390) != 0
    s = (f'P1 {rt(e,0):06X}', e.r16(0x396), 'occ' if occ else '-', f'P2 {rt(e,1):06X}')
    if s != prev: print(i, e.ticks, (e.ticks - t_rel) if t_rel is not None else '', s)
    prev = s
