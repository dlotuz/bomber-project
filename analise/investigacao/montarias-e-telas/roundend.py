import mt, scr, sys
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.run(3,p1=['A'],p2=['A'],p3=['A'],p4=['A'])
st={}; scr.sfx_poll(e,st); ev=[]; pb=scr.bright(e); shots=[]; labels=[]
alive=lambda: [hex(e.r16(0x300+p*0x100)|e.r8(0x302+p*0x100)<<16) for p in range(5)]
pa=None
for f in range(1400):
    e.run(1)
    s,m=scr.sfx_poll(e,st); b=scr.bright(e)
    if s: ev.append((f,'sfx',s))
    if m is not None: ev.append((f,'mus',m))
    if b!=pb: ev.append((f,'bright',b)); pb=b
    a=alive()
    if a!=pa: ev.append((f,'rt',a)); pa=a
    if f%20==0 and f>=100:
        p=mt.OUT+f're_{f:04d}.png'; e.shot(p); shots.append(p); labels.append(f'+{f}')
    if f==700: open(mt.OUT+'tt_after_round.bin','wb').write(e.save())
for x in scr.compress_ev(ev): print(x)
print('coroas', [e.r8(0x1f34+2*i) for i in range(5)])
open(mt.OUT+'tt_re_end.bin','wb').write(e.save())
scr.sheet(shots, mt.OUT+'g_roundend.png', cols=10, labels=labels)
