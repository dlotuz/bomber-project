from mec import *
import itemsim, json
res={}
for s in range(10):
    e=Dbg(f"st_stage{s:02d}"); e.run(1)
    seed_menu=e.r16(0xAE)
    e.tap('A', hold=2, after=0)
    e.bp(0xC41824); e.bp(0xC354B3)
    for i in range(700):
        st=e.save(); n0=e.lib.dbg_count()
        e.run(1)
        if any(r['pc']==0xC41824 for r in e.log()[n0:] if r['t']=='EXEC'): break
    e.load(st)
    g=grid(e)
    ncalls=sum(1 for r in e.log() if r['t']=='EXEC' and r['pc']==0xC354B3)
    seed=e.r16(0xAE)
    w=e.wram(); p70=w[0x70]|w[0x71]<<8|w[0x72]<<16
    n=ROM[rom24(p70)+0x1E]
    rows=[]
    for r in range(1,12):
        row=''
        for c in range(2,15):
            v=g[r][c]
            row += '#' if v==0xEC40 else ('x' if v==0xCC80 else ('.' if v==0 else '?'))
        rows.append(row)
    res[s+1]=dict(base=rows, remove=n, seed_before=seed, rec=hex(p70))
    print('fase',s+1,'remove',n,'seed',hex(seed),'rng calls before',ncalls)
    for row in rows: print('   ',row)
json.dump(res, open(OUT+'layouts_base.json','w'), indent=1)
