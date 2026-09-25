import mt, scr
e=mt.new(); base=open(mt.OUT+'tt_battle.bin','rb').read()
e.load(base); e.run(1)
fade=None; clock=None; prev=(e.r8(0x1ed2),e.r8(0x1ed0),e.r8(0x1ece))
for f in range(300):
    e.run(1); b=scr.bright(e)
    if fade is None and b>0: fade=f
    c=(e.r8(0x1ed2),e.r8(0x1ed0),e.r8(0x1ece))
    if clock is None and c!=prev: clock=(f,prev,c)
    prev=c
print('fade-in começa em',fade,'relógio muda em',clock)
# quando o jogador pode andar: segura RIGHT desde o início
for start in range(fade, fade+120, 4):
    e.load(base); e.run(1); e.run(start)
    x0=e.r16(0x312); e.run(3,p0=['RIGHT']); 
    if e.r16(0x312)!=x0: print('primeiro frame em que P1 anda: ~',start,'(',start-fade,'após início do fade-in)'); break
# START durante o início?
