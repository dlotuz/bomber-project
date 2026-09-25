from mec import *
import itemsim
e=Dbg("st_arena01"); e.run(1)
g=grid(e)
soft={r*0x40+c*2 for r in range(14) for c in range(16) if g[r][c]==0xCC80}
# seed before builder: seed0=0x12 after 5 calls of Y=FFFF
s=0x12
for _ in range(5): s,_=itemsim.rng(s,0xFFFF)
tab,s2=itemsim.build(soft, itemsim.stage_list(1), s)
w=e.wram(); i=0x8000; W=[]
while True:
    c=w[i]|w[i+1]<<8
    if c==0xFFFF: break
    W.append((c,w[i+2]|w[i+3]<<8)); i+=4
print('igual:', tab==W, len(tab), len(W), 'seed', hex(s2))
print('fallback list', [hex(x) for x in itemsim.FALLBACK])
for a,b in zip(tab,W): print(hex(a[0]),hex(a[1]),'|',hex(b[0]),hex(b[1]), '' if a==b else '<<')
