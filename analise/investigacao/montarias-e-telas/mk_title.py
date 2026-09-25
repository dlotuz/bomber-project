import mt, scr
e=mt.new(mt.OUT+'st_boot60s.bin')
e.run(5600-3601)
open(mt.OUT+'tt_title.bin','wb').write(e.save()); e.shot(mt.OUT+'tt_title.png')
print([ (s['x'],s['y'],hex(s['tile']),s['pal']) for s in scr.oam(e)][:30])
