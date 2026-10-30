"""Tempo do arremesso (A solto no frame 30) contra a queda da mão ($C2:4BC4, B no frame 30): primeiro passo e pouso.
Mostra que os dois dão o 1º passo no próprio frame da soltura (o objeto da bomba roda depois dos jogadores)."""
from h import *
for mode in ('throw', 'B'):
    e = TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11); tele(e,1,14,9); e.run(1)
    e.w8(0x348,0); e.w8(0x349,0xFF); e.w8(0x3D8,0)
    tele(e,0,4,3); e.run(1); e.w8(0x362,2)
    held = None; out = []
    for i in range(60):
        a = (i < 2 or 5 <= i < 30) if mode == 'throw' else (i < 2 or 5 <= i < 58)
        btn = (['A'] if a else []) + (['B'] if mode == 'B' and i == 30 else [])
        k = e.step(p0=btn)
        c = e.r16(0x38C); held = held or c or None
        if held and i >= 29:
            w = e.wram(); out.append((i, k, f'{w[held+2]<<16|w[held+1]<<8|w[held]:06X}', e.r16(held+0x12), e.r16(held+0x16)))
            if out[-1][2] == 'C13BE5': break
    print(mode, out)
