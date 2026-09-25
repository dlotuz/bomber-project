import mt, collections
e=mt.new(); base=open(mt.OUT+'tt_mania_eggs.bin','rb').read()
tot=collections.Counter(); n_eggs=None
for trial in range(8):
    e.load(base); e.run(1)
    for k in range(40): e.run(2,p0=['A']); e.run(6)
    n_eggs=e.r8(0x12040)
    e.run(trial*7+1)
    for b in ['DOWN','A']: e.run(2,p0=[b]); e.run(90)
    for b in ['DOWN','DOWN','A']: e.run(2,p0=[b]); e.run(120)
    e.run(2,p0=['A']); e.run(900)
    w=e.wram(); a=0x8000; items=[]
    while (w[a]|w[a+1]<<8)!=0xFFFF and len(items)<100: items.append(w[a+2]); a+=4
    tot.update(hex(i) for i in items)
print('ovos configurados',n_eggs,'tipos sorteados em 8 partidas', sorted(tot.items()))
