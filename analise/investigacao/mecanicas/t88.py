from mec import *
e=Dbg("st_c0"); e.run(5)
steps=[('DOWN',20),('A',60),('X',1)]
e.tap('DOWN',hold=3,after=20); e.shot(OUT+'team_0.png')
e.tap('A',hold=3,after=60); e.shot(OUT+'team_1.png')
open(OUT+'st_team_players.bin','wb').write(e.save())
print('7F2010..2020', e.wram()[0x12010:0x12020].hex(' '), '7F200E', e.wram()[0x1200E])
