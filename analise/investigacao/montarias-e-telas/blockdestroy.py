import mt, collections
e = mt.new('st_cpu5b')
def grid(): 
    w=e.wram(); return [w[0x2800+i*2]|w[0x2801+i*2]<<8 for i in range(14*32)]
g0=grid(); t=0
hist=[]
while t<3000:
    st=e.save(); g0=grid()
    e.run(1); t+=1
    g1=grid()
    # célula que era soft block (CC80) e deixou de ser
    d=[i for i in range(len(g0)) if g0[i]==0xCC80 and g1[i]!=0xCC80]
    if d: hist.append((t,d,[hex(g1[i]) for i in d], st))
    if len(hist)>=3: break
for t,d,v,st in hist: print(t,d,v)
# pega o primeiro evento e registra leituras de ROM em 200 frames
t,d,v,st=hist[0]
e.load(st)
mt.watch(e, rlo=0x1C00000, rhi=0x1FFFFFF, wlo=0x2800, whi=0x2bff)
cells=set(d)
for k in range(120):
    e.run(1)
    g=grid()
    if any((g[i] & 0xFF00)==0x0900 for i in cells): print('item appears at +',k, [hex(g[i]) for i in cells]); break
lg=mt.log(e)
c=collections.Counter((hex(pc),hex(a&0xffffff)[:-2]) for pc,kd,a,vv in lg if kd==1)
for kk,vv in sorted(c.items()): print(kk,vv)
