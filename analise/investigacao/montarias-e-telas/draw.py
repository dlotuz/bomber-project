import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.run(3,p0=['A'],p1=['A'],p2=['A'],p3=['A'],p4=['A'])
st={}; scr.sfx_poll(e,st); ev=[]; pb=scr.bright(e); shots=[]; lb=[]
for f in range(1500):
    e.run(1)
    s,m=scr.sfx_poll(e,st); b=scr.bright(e)
    if s: ev.append((f,'sfx',s))
    if m is not None: ev.append((f,'mus',m))
    if b!=pb: ev.append((f,'bright',b)); pb=b
    if f%30==0 and f>=300: p=mt.OUT+f'dr_{f:04d}.png'; e.shot(p); shots.append(p); lb.append(f'+{f}')
    if f==600: open(mt.OUT+'tt_draw_wait.bin','wb').write(e.save())
for x in scr.compress_ev(ev): print(x)
print('coroas',[e.r8(0x1f34+2*i) for i in range(5)])
scr.sheet(shots, mt.OUT+'g_draw.png', cols=10, labels=lb)
