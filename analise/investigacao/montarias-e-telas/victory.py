import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
print('matches idx', e.r8(0x1f00))
e.w8(0x1f34,2)
e.run(3,p1=['A'],p2=['A'],p3=['A'],p4=['A'])
st={}; scr.sfx_poll(e,st); ev=[]; pb=scr.bright(e); shots=[]; labels=[]
for f in range(2400):
    e.run(1)
    s,m=scr.sfx_poll(e,st); b=scr.bright(e)
    if s: ev.append((f,'sfx',s))
    if m is not None: ev.append((f,'mus',m))
    if b!=pb: ev.append((f,'bright',b)); pb=b
    if f%40==0 and f>=320:
        p=mt.OUT+f'vi_{f:04d}.png'; e.shot(p); shots.append(p); labels.append(f'+{f}')
    if f==1500: open(mt.OUT+'tt_victory_wait.bin','wb').write(e.save())
for x in scr.compress_ev(ev): print(x)
print('coroas', [e.r8(0x1f34+2*i) for i in range(5)])
open(mt.OUT+'tt_victory_end.bin','wb').write(e.save())
scr.sheet(shots, mt.OUT+'g_victory.png', cols=10, labels=labels)
