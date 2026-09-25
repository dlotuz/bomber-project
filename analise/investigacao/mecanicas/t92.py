from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
tele(e,0,4,3); e.run(1); e.run(2,p0=['A']); e.run(1)
tr=[]
for d,n in [('RIGHT',20),('LEFT',30),('UP',5)]:
    for i in range(n): e.step(p0=[d]); tr.append((d,pos(e)))
print('saindo p/ direita e voltando:', [tr[i] for i in (0,5,10,15,19,20,25,29,30,34)])
# P2 em cima quando a bomba é colocada
e=TDbg("st_arena05"); e.run(1)
for n in range(2,5): tele(e,n,14,11)
tele(e,0,4,3); tele(e,1,4,3); e.run(1); e.run(2,p0=['A']); e.run(1)
for i in range(20): e.step(p1=['DOWN'])
print('P2 que estava na casa sai para baixo:', pos(e,1))
for i in range(20): e.step(p1=['UP'])
print('P2 tenta voltar:', pos(e,1))
