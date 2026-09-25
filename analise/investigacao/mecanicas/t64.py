from mec import *
res=[]
for f in list(range(0,12)):
    e=TDbg("st_arena05"); e.run(1)
    for n in range(1,5): tele(e,n,14,11)
    e.w8(0x344,f); e.w8(0x3D8,0)
    tele(e,0,2,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
    mx=0
    for i in range(140):
        e.step()
        g=grid(e)[1]
        n=sum(1 for c in range(3,15) if g[c]&0x1000 and (g[c]&0xFF00)!=0x0900)
        mx=max(mx,n)
    res.append((f,mx))
print('fogo -> casas de chama à direita (linha livre de 12 casas):', res)
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
e.w8(0x34D,0x25); e.w8(0x344,0)
tele(e,0,2,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
mx=0
for i in range(140):
    e.step(); g=grid(e)[1]; mx=max(mx,sum(1 for c in range(3,15) if g[c]&0x1000))
print('doença 0x25, fogo 0 ->', mx)
