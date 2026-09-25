import mt, scr
def run_from(start_state, start_f, press_f, btn, N=1200):
    e=mt.new(); 
    if start_state: e.load(open(mt.OUT+start_state,'rb').read()); e.run(1)
    f=start_f; ev=[]; pb=scr.bright(e); curs=False
    while f<press_f: e.run(1); f+=1
    e.run(2,p0=[btn]); f+=2
    for k in range(N):
        e.run(1); f+=1; b=scr.bright(e)
        if b!=pb: ev.append((f,'bright',b)); pb=b
        c=any(o['tile']==0xc8 and o['x']==56 for o in scr.oam(e))
        if c and not curs: ev.append((f,'cursor_menu')); curs=True; break
    return scr.compress_ev(ev)
print('START no logo Hudson (f200):', run_from(None,0,200,'START',6000))
print('START na intro (f1000):', run_from(None,0,1000,'START',6000))
print('A na intro (f1000):', run_from(None,0,1000,'A',6000))
print('START durante anim do logo (f5100):', run_from('st_boot60s.bin',3601,5100,'START',600))
