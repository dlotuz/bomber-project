import mt, scr
e=mt.new(mt.OUT+'st_boot60s.bin')
R=scr.Rec(e); R.f=3601
shots=[];labels=[]
for k in range(60):
    R.run(60)
    p=mt.OUT+f'boot2_{k:03d}.png'; e.shot(p); shots.append(p); labels.append(f'f{R.f}')
tr=R.transitions()
# resume: só pontos inicio/fim de rampas
print([t for i,t in enumerate(tr) if i==0 or i==len(tr)-1 or not(0<t[1]<15) ])
open(mt.OUT+'st_boot120s.bin','wb').write(e.save())
scr.sheet(shots, mt.OUT+'g_boot2.png', cols=10, labels=labels)
