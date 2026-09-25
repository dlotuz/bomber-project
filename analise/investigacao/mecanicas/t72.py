from mec import *
import sys, json
st=sys.argv[1]; secs=int(sys.argv[2]) if len(sys.argv)>2 else 2
e=TDbg(st); e.run(1)
spots=[(8,5),(9,7),(7,5),(8,7),(8,6)]
for n in range(5): tele(e,n,*spots[n])
e.run(1)
e.w8(0x1ED2,1); e.w8(0x1ED0,secs)
g0=fgrid(e); ev=[]; t100=None; clocklog=[]
for i in range(60*200):
    k=e.step()
    t=(e.r8(0x1ED2),e.r8(0x1ED0),e.r8(0x1ECE))
    if t100 is None and t[0]==0 and t[1]==59: t100=e.ticks
    g=fgrid(e)
    for r in range(14):
        for c in range(16):
            if g[r][c]!=g0[r][c]: ev.append((e.ticks, t, c, r, g0[r][c], g[r][c]))
    g0=g
    if t==(0,0,0) and len(clocklog)==0: clocklog.append(e.ticks)
    if len(clocklog) and e.ticks>clocklog[0]+600: break
alive=[e.obj(n)[:3].hex() for n in range(5)]
json.dump(dict(ev=ev,t100=t100,t000=clocklog), open(OUT+'pressure2_'+st.split('/')[-1]+'.json','w'))
land={}
spawn={}
for tt,clk,c,r,a,b in ev:
    if b==0x0001 and (c,r) not in spawn: spawn[(c,r)]=tt
    if b==0xEE80 and r not in (0,12,13) and (c,r) not in land: land[(c,r)]=tt
seq=sorted(land.items(), key=lambda kv: kv[1])
print('tick em 0:59 (aprox 1:00)', t100, 'tick em 0:00', clocklog, 'blocos', len(seq), alive)
print([ (c,r,spawn.get((c,r)),tt) for (c,r),tt in seq])
print(gridstr(e))
