# Pouso da bomba socada em bloco de pressão ($EE80) e em bloco queimando ($EDC0), e volta pela borda ($C1:6566).
# Uso: ./py t104.py  — imprime, por caso, o estado do objeto da bomba ($0860: ponteiro, X, Y) a cada mudança.
# Resultado (2026-10-01): $EE80 → $C1:5C2F/$C1:5C5B (some, nuvem ~40 ticks) e o dono recupera a bomba;
# $EDC0 → quica; para cima de (2,2): y 16 (linha 13 da grade) quica e volta em y < 12 (+224).
from mec import *
def run(label, bomb, pl, face, writes=()):
    e=TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
    e.w8(0x3D8,0)
    tele(e,0,*bomb); e.run(1); e.run(2,p0=['A']); tele(e,0,*pl); e.run(1)
    for (c,r,v) in writes: e.w16(0x2800+r*0x40+c*2, v)
    e.w8(0x362,face)
    nb0=e.obj(0)[0x41]; prev=None; log=[]
    for i in range(80):
        e.step(p0=['Y'] if i<2 else [])
        w=e.wram(); a=0x860
        s=(f'{w[a+2]<<16|w[a+1]<<8|w[a]:06X}', e.r16(a+0x12), e.r16(a+0x16))
        if s!=prev: log.append((e.ticks,)+s)
        prev=s
    g=grid(e)
    print('==',label,'| bombas livres',nb0,'->',e.obj(0)[0x41],'| bombas na grade',[(c,r) for r in range(14) for c in range(16) if (g[r][c]&0xEFC0)==0xC900])
    for l in log: print('  ',l)
run('direita (5,1), (8,1)=EE80', (5,1),(4,1),2, [(8,1,0xEE80)])
run('direita (5,1), (8,1)=EDC0', (5,1),(4,1),2, [(8,1,0xEDC0)])
run('cima (2,2), sem pressão', (2,2),(2,3),0)
run('cima (2,2), (2,12)=EE80', (2,2),(2,3),0, [(2,12,0xEE80)])
run('baixo (2,10), sem pressão', (2,10),(2,9),4)
run('baixo (2,10), (2,0)=EE80', (2,10),(2,9),4, [(2,0,0xEE80)])
run('direita (13,3), sem pressão', (13,3),(12,3),2)
