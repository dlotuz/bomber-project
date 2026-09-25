import mt, scr
e=mt.new('st_cpu5b')
ring=[]; f=0
cr=lambda: tuple(e.r8(0x1f34+2*i) for i in range(5))
c0=cr()
while f<60000:
    if f%30==0: ring.append((f,e.save())); ring=ring[-30:]
    e.run(1); f+=1
    if cr()!=c0: break
print('coroa mudou no frame',f,c0,'->',cr())
# volta ~600 frames
f0,st=ring[0]
open(mt.OUT+'tt_pre_roundend.bin','wb').write(st); print('estado salvo em f',f0)
