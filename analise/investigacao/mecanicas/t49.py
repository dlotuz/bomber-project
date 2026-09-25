from mec import *
import sys
def run(label, bomb, pl, face, btn='Y', hold=None):
    e=TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
    e.w8(0x3D8,0)  # sem P
    tele(e,0,*bomb); e.run(1); e.run(2,p0=['A']); tele(e,0,*pl); e.run(1)
    e.w8(0x362,face)
    traj=[]
    for i in range(80):
        e.step(p0=[btn] if i<2 else [])
        w=e.wram(); a=0x860
        r=(w[a+2]<<16|w[a+1]<<8|w[a])
        traj.append((e.r16(a+0x12), e.r16(a+0x16), f'{r:06X}'))
        if r==0xC13BE5 and i>3: break
    g=grid(e); cells=[(c,r) for r in range(14) for c in range(16) if (g[r][c]&0xEFC0)==0xC900]
    print(label, 'ticks',len(traj), 'land cell', cells, 'path', [(x,y) for x,y,_ in traj][:40])
run('soco dir. borda', (13,3),(12,3),2)
run('soco esq. borda', (3,3),(4,3),6)
run('soco cima borda', (2,2),(2,3),0)
run('soco baixo borda', (2,10),(2,9),4)
run('soco em pilar (cai sobre pilar?)', (4,3),(3,3),2)
