import mt, scr
e=mt.new(); base=open(mt.OUT+'tt_chars.bin','rb').read()
def cur(e):
    o=scr.oam(e); return sorted(set((s['tile']&0xfc) for s in o if s['tile'] in range(0xC0,0xF0) and s['pal']==0))
# 1) P1 A, depois P1 B
e.load(base); e.run(1); e.run(2,p0=['A']); e.run(20); print('após P1 A cursores', cur(e))
st={}; scr.sfx_poll(e,st); e.run(2,p0=['B']); ev=[]
for f in range(80):
    e.run(1); s,m=scr.sfx_poll(e,st); 
    if s: ev.append((f,s))
print('P1 B após confirmar:', ev, 'brilho', scr.bright(e), 'cursores', cur(e))
# 2) P1 confirma e tenta mover
e.load(base); e.run(1); e.run(2,p0=['A']); e.run(10); e.run(2,p0=['RIGHT']); e.run(10); print('P1 RIGHT após A, cursores', cur(e))
# 3) todos confirmam: linha do tempo
e.load(base); e.run(1)
for p in range(4): e.run(2,**{f'p{p}':['A']}); e.run(6)
st={}; scr.sfx_poll(e,st)
e.run(2,p4=['A']); ev=[]; pb=scr.bright(e); shots=[]
for f in range(200):
    e.run(1); s,m=scr.sfx_poll(e,st); b=scr.bright(e)
    if s: ev.append((f,'sfx',s))
    if b!=pb: ev.append((f,'bright',b)); pb=b
    if f in (1,20,40,60,80): e.shot(mt.OUT+f'ch_all_{f}.png'); shots.append(mt.OUT+f'ch_all_{f}.png')
print('todos confirmaram:', scr.compress_ev(ev))
scr.sheet(shots, mt.OUT+'g_ch_all.png', cols=5)
# 4) mesmo personagem para 2 jogadores?
e.load(base); e.run(1); e.run(2,p1=['LEFT']); e.run(8); e.run(2,p0=['A']); e.run(8); e.run(2,p1=['A']); e.run(20)
print('P1 e P2 no mesmo personagem (branco): cursores', cur(e)); e.shot(mt.OUT+'ch_same.png')
