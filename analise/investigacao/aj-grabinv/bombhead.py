"""Bomba arremessada caindo na casa (4,3) do P2 enquanto ele está no pulo de quem foi largado ($C2:1C35).
P1 (luva) pega o P2 em (4,3), larga com B no frame 40, solta o A e anda para a esquerda (sai da coluna 4).
P3 (luva, +$49 = $FF) em (4,8) olhando para cima põe uma bomba, levanta e arremessa (5 casas = (4,3)).
Modo: drop (como acima) | stand (controle: o P2 só parado em (4,3), sem luva no meio).
2º argumento opcional `aim`: P3 em (4,7); a bomba pousa em (4,3) se a mira achar o P2, senão em (4,2).
Imprime a rotina do P2, +$C0 (pedido de atordoamento bit $02) e as bombas (endereço, rotina, x, y, +1C, +1D)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'aj-socoluva'))
from h import *  # noqa
mode = sys.argv[1]
THROW = 52
ROW3 = 7 if 'aim' in sys.argv[2:] else 8   # aim: P3 em (4,7); o P2 fica a 4 casas e a mira (2..4) só o vê se ele estiver na ocupação
e = TDbg("st_arena05"); e.run(1)
tele(e,3,2,11); tele(e,4,12,11); tele(e,1,4,3); tele(e,2,4,ROW3); e.run(1)
e.w8(0x348,0); e.w8(0x349,0xFF); e.w8(0x3D8,0)
e.w8(0x548,0); e.w8(0x549,0xFF); e.w8(0x5D8,0)
tele(e,0,4 if mode == 'drop' else 2,3); e.run(1); e.w8(0x362,2); e.w8(0x562,(e.r8(0x562) & ~7) | 0)
prev = None
for i in range(140):
    if mode == 'drop':
        p0 = (['A'] if i < 41 else []) + (['B'] if i == 40 else []) + (['LEFT'] if 41 <= i < 52 else [])
    else:
        p0 = []
    st = THROW - 20
    p2 = ['A'] if (st <= i < st + 2 or st + 5 <= i < THROW) else []
    e.step(p0=p0, p2=p2)
    s = (f'{rt(e,1):06X}', hex(e.r16(0x4C0)), f'P1 {rt(e,0):06X}', pos(e,0), f'P3 {rt(e,2):06X}', bombs(e))
    if s != prev: print(i, e.ticks, s)
    prev = s
