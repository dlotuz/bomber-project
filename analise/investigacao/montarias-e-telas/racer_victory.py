import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e=mt.new('st_final_wait')
e.w16(0x1f04,1); e.w8(0x1201c,1); e.w8(0x1207c,1)
shots=[]
def s(tag):
    p=mt.OUT+f'racer_{len(shots):02d}_{tag}.png'; e.shot(p); shots.append(p)
e.tap('A',0,3,1)
for k in range(23):
    e.run(40); s(f'w{k}'); print(k, hex(e.r16(0x1f4e)), hex(e.r16(0x1f50)), hex(e.r16(0x1f4c)))
open(mt.OUT+'st_racer_after_victory.bin','wb').write(e.save())
grid(shots, mt.OUT+'g_racer.png')
