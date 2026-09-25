import mt
res={}
for st in ['st_stage%02d'%i for i in range(0,12)]:
    e = mt.new(st)
    e.tap('A',0,3,1)
    mt.watch(e, rlo=0x1C00000, rhi=0x1FFFFFF)
    got=None
    for k in range(1500):
        e.run(1)
        lg=[x for x in mt.log(e) if x[0]==0xC4122E]
        e.lib.mt_reset_log()
        if lg: got=lg[0][2]&0xffffff; break
    print(st, 'tabela de itens em', hex(got) if got else None, 'stage var?', e.r8(0x1ECA) if False else '')
    res[st]=got
