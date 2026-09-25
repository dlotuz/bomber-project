import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.run(3,p0=['A'],p1=['A'],p2=['A'],p3=['A'],p4=['A'])
e.run(300); base=e.save()
for t in [343,346,349,352,355,358]:
    e.load(base); e.run(t-303); e.run(2,p0=['A']); ok=None
    for f in range(40):
        e.run(1)
        if scr.bright(e)<15 and scr.bright(e)>=0 and f>0 and ok is None and t>341: ok=f
    print('A em',t,'->',ok)
# depois do DRAW: pra onde vai
e.load(base); e.run(300); e.run(2,p0=['A']); ev=[]; pb=scr.bright(e)
for f in range(700):
    e.run(1); b=scr.bright(e)
    if b!=pb: ev.append((f,'bright',b)); pb=b
print(scr.compress_ev(ev)); e.shot(mt.OUT+'after_draw.png'); print('coroas',[e.r8(0x1f34+2*i) for i in range(5)])
