from mec import *
import itemsim, json
base=json.load(open(OUT+'layouts_base.json'))
allok=True
for s in [5]:
    e=Dbg(f"st_stage{s:02d}"); e.run(1)
    e.tap('A', hold=2, after=0)
    e.bp(0xC4179C); e.bp(0xC4121D)
    seedR=None; seedI=None
    for i in range(800):
        st=e.save(); n0=e.lib.dbg_count()
        e.run(1)
        new=[r for r in e.log()[n0:] if r['t']=='EXEC']
        if seedR is None and any(r['pc']==0xC4179C for r in new):
            e.load(st); seedR=e.r16(0xAE); e.run(1)
        if any(r['pc']==0xC4121D for r in new):
            e.load(st); seedI=e.r16(0xAE); e.run(1)
            for k in range(10): e.run(1)
            break
    rows=base[str(s+1)]['base']
    soft={ (r+1)*64+(c+2)*2 for r in range(11) for c in range(13) if rows[r][c]=='x'}
    soft=itemsim.carve(soft)
    soft,seed2=itemsim.remove_random(soft, base[str(s+1)]['remove'], seedR if seedR is not None else 0)
    g=grid(e)
    real={r*64+c*2 for r in range(14) for c in range(16) if g[r][c]==0xCC80}
    # itens
    L=itemsim.stage_list(s+1)
    tab,_=itemsim.build(real, L, seedI if seedI is not None else 0)
    w=e.wram(); i=0x8000; W=[]
    while True:
        cc=w[i]|w[i+1]<<8
        if cc==0xFFFF: break
        W.append((cc,w[i+2]|w[i+3]<<8)); i+=4
    ok1=soft==real; ok2=tab==W
    allok&=ok1 and ok2
    print('fase',s+1,'layout ok',ok1,len(soft),len(real),'itens ok',ok2,len(tab),len(W), 'seedR',hex(seedR or 0),'seedI',hex(seedI or 0), 'seed apos remocao',hex(seed2))
    if not ok2:
        for a,b in zip(tab,W): print('   ',hex(a[0]),hex(a[1]),'|',hex(b[0]),hex(b[1]),'' if a==b else '<<')
print('TUDO OK' if allok else 'FALHAS')
