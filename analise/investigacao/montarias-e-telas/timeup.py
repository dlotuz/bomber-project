import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.w8(0x1ed2,1); e.w8(0x1ed0,2)
st={}; scr.sfx_poll(e,st); ev=[]; ps=[]; lb=[]
for f in range(300):
    e.run(1); s,m=scr.sfx_poll(e,st)
    if s: ev.append((f,'sfx',s,(e.r8(0x1ed2),e.r8(0x1ed0))))
    if m is not None: ev.append((f,'mus',m))
    if f in (130,150,200): p=mt.OUT+f'tu1_{f}.png'; e.shot(p); ps.append(p); lb.append(f'1:00 +{f}')
print('perto de 1:00', ev)
e.load(open(mt.OUT+'tt_battle2.bin','rb').read()); e.run(1)
e.w8(0x1ed2,0); e.w8(0x1ed0,2)
st={}; scr.sfx_poll(e,st); ev=[]; pb=scr.bright(e)
for f in range(900):
    e.run(1); s,m=scr.sfx_poll(e,st); b=scr.bright(e)
    if s: ev.append((f,'sfx',s))
    if m is not None: ev.append((f,'mus',m))
    if b!=pb: ev.append((f,'bright',b)); pb=b
    if f in (100,130,200,400,700): p=mt.OUT+f'tu0_{f}.png'; e.shot(p); ps.append(p); lb.append(f'0:02 +{f}')
print('tempo esgotado', scr.compress_ev(ev), 'coroas',[e.r8(0x1f34+2*i) for i in range(5)])
scr.sheet(ps, mt.OUT+'g_timeup.png', cols=4, labels=lb)
