import mt, scr
e=mt.new()
R=scr.Rec(e)
shots=[];labels=[]
for k in range(60):
    R.run(60)
    p=mt.OUT+f'boot_{k:03d}.png'; e.shot(p); shots.append(p); labels.append(f'f{R.f}')
print(R.transitions()[:80])
open(mt.OUT+'st_boot60s.bin','wb').write(e.save())
scr.sheet(shots, mt.OUT+'g_boot.png', cols=10, labels=labels)
