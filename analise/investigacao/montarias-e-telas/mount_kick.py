import mt, mount_lib as M, objlist
e=mt.new()
for t in (3,0xA,0xC,2):
    M.mount(e,t)
    for f in range(32): e.run(1,p0=['RIGHT'])
    e.run(3,p0=['A']); e.run(2)
    for f in range(32): e.run(1,p0=['LEFT'])
    for f in range(30): e.run(1,p0=['RIGHT'])
    for f in range(20): e.run(1)
    bombs=[(o['x'],o['y']) for o in objlist.objs(e) if o['rt']>>8 in (0xC13B,0xC13C,0xC13D,0xC13E)]
    grid=[x for x in range(32,224,16) if e.r16(M.cell(x,48))&0xFF00==0xC900]
    print('tipo',hex(t),'P1 x',M.pl(e)['x'],'bomba na grade (linha y=48) x=',grid, 'obj',bombs[:2])
