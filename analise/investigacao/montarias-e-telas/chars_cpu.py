import mt, scr
e=mt.new(); e.load(open(mt.OUT+'tt_players.bin','rb').read()); e.run(1)
# P2..P5 = CPU (P1 fica humano); P3 = CPU apenas p/ testar misto: 1H,2C,3H,4C,5C
for row,cpu in enumerate([0,1,0,1,1]):
    if cpu: e.run(2,p0=['LEFT']); e.run(40)
    e.run(2,p0=['DOWN']); e.run(8)
e.shot(mt.OUT+'pl_mixed.png')
e.run(2,p0=['A']); e.run(90); e.run(2,p0=['A']); e.run(90)
open(mt.OUT+'tt_chars_mixed.bin','wb').write(e.save()); e.shot(mt.OUT+'ch_mixed_0.png')
def cur(e):
    return sorted(set(s['tile'] for s in scr.oam(e) if s['tile'] in (0xC0,0xC4,0xC8,0xCC,0xD0) ))
print('inicial cursores', cur(e))
for k,(p,b) in enumerate([(0,'A'),(0,'RIGHT'),(0,'A'),(2,'A'),(0,'A'),(0,'A')]):
    e.run(2,**{f'p{p}':[b]}); e.run(12)
    e.shot(mt.OUT+f'ch_mixed_{k+1}.png'); print(k,p,b,'cursores',cur(e),'bright',scr.bright(e))
scr.sheet([mt.OUT+'pl_mixed.png']+[mt.OUT+f'ch_mixed_{k}.png' for k in range(7)], mt.OUT+'g_ch_mixed.png', cols=4)
