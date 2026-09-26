"""Reserva queimada (revisão final do plano 9, I6/L22): P1 montado (tipo 3) pega 2 reservas (tipos 2 e 3), a chama
(bit $1000) é escrita 1 tick na casa da reserva N (0 = a 1ª). Uso: python mount_burn.py N
Resultado (26/09): N=1 → só a 2ª sai, $1ED4 −1 40 ticks depois; N=0 → a fila esvazia ($C2:6687), a 2ª é apagada
e a casa dela fica 0x0940 ($C2:65E8), $1ED4 −1 só pela 1ª."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mt, mount_lib as M
which = int(sys.argv[1])
e = mt.new()
M.mount(e, 3)
e.w16(M.cell(64, 48), 0x0940 + 0x32)
e.w16(M.cell(96, 48), 0x0940 + 0x33)
for f in range(120): e.run(1, p0=['RIGHT'])
for f in range(20): e.run(1)
a = [e.r16(0x352), e.r16(0x354)]
cells = [e.r16(x + 0x2A) for x in a]
print('reserve cells', [hex(c) for c in cells], 'grid', [hex(e.r16(0x2800 + c)) for c in cells], '1ED4', e.r8(0x1ED4))
c = cells[which]
e.w16(0x2800 + c, 0x1000); e.run(1); e.w16(0x2800 + c, 0)
prev = None
for f in range(80):
    e.run(1)
    st = ([hex(e.r16(0x2800 + c)) for c in cells], [hex(e.r16(o)) for o in (0x352, 0x354)], [hex(e.r16(x) | e.r8(x+2) << 16) for x in a], e.r8(0x1ED4))
    if st != prev: print(f, st); prev = st
