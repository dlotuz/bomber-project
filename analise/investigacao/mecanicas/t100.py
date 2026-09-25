from mec import *
import movesim, json
# grade do stage 5 (sem soft): pilares em (col impar, lin par)
g={}
for r in range(14):
    for c in range(16):
        wall = r in (0,12,13) or c in (0,1,15) or (c%2==1 and r%2==0)
        g[r*64+c*2]=0xEC40 if wall else 0
def run(col,row,dx,dy,d,lvl=1,n=40):
    X=(cx(col)+dx)<<8; Y=(cy(row)+dy)<<8; tr=[]
    for i in range(n):
        X,Y,_=movesim.step(X,Y,movesim.BTN[d],lvl,g); tr.append(((X>>8)-cx(col),(Y>>8)-cy(row)))
    return tr
print('A) Andando para BAIXO a partir da linha 1, coluna 4 (abertura entre pilares nas cols 3 e 5), deslocamento horizontal dx:')
for dx in range(-9,10):
    tr=run(4,1,dx,0,'DOWN',n=20)
    enter=next((i+1 for i,(x,y) in enumerate(tr) if y>=16-7), None)
    print(f'  dx={dx:+d}: entra na linha 2 (y>=+9) no tick {next((i+1 for i,(x,y) in enumerate(tr) if y>=9),None)}, alinhado (x=0) no tick {next((i+1 for i,(x,y) in enumerate(tr) if x==0),None)}; x nos 8 primeiros ticks {[x for x,y in tr[:8]]}')
print('B) Andando para BAIXO contra um pilar (col 3, linha 1; pilar em (3,2)), dx:')
for dx in range(-9,10):
    tr=run(3,1,dx,0,'DOWN',n=30)
    print(f'  dx={dx:+d}: pos final rel. {tr[-1]} ; primeiros {tr[:6]}')
