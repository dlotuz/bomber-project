import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.w8(0x1f34,2); e.run(3,p1=['A'],p2=['A'],p3=['A'],p4=['A'])
e.run(400); base=e.save()
for t in [420,500,700,850,905,915,940]:
    e.load(base); e.run(t-403); e.run(2,p0=['A'])
    ev=[]; pb=scr.bright(e)
    for f in range(700):
        e.run(1); b=scr.bright(e)
        if b!=pb: ev.append((f,b)); pb=b
    print('A em',t,'->', scr.compress_ev([(f,'bright',b) for f,b in ev])[:4], 'coroas',[e.r8(0x1f34+2*i) for i in range(5)])
