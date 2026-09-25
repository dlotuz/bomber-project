from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
e.w8(0x344,2)  # alcance 4
# itens reais: soltar via doença 0x2B não; usar grid (logico) - teste com objeto real: usa P2 morrendo? simples: grid
e.w16(0x2800+1*64+4*2,0x0941); e.w16(0x2800+1*64+6*2,0x09A1); e.w16(0x2800+1*64+7*2,0x0943)
tele(e,0,2,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
for i in range(135): e.step()
print(' '.join(f'{v:04X}' for v in grid(e)[1]))
for i in range(40): e.step()
print(' '.join(f'{v:04X}' for v in grid(e)[1]))
