from mec import *
def table(e):
    w=e.wram(); i=0x8000; W=[]
    while True:
        c=w[i]|w[i+1]<<8
        if c==0xFFFF: break
        W.append((c,w[i+2]|w[i+3]<<8)); i+=4
    return W
e=TDbg("st_arena01"); e.run(1)
# bloco (4,1) tem bomba+ (0x48); bomba em (3,1)
print('antes', [x for x in table(e) if x[0]==0x48])
bomb_at(e,0,3,1,back=(2,2)); 
for i in range(160): e.step()
print('grid (4,1)=',hex(grid(e)[1][4]), 'tabela', [x for x in table(e) if x[0]==0x48], len(table(e)))
# queimar o item de novo
bomb_at(e,0,3,1,back=(2,2))
for i in range(135): e.step()
print('durante', hex(grid(e)[1][4]))
for i in range(40): e.step()
print('depois', hex(grid(e)[1][4]))
