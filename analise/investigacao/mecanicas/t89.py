from mec import *
e=Dbg(OUT+"st_team_players.bin"); e.run(60); e.shot(OUT+'team_2.png')
e.tap('A',hold=3,after=60); e.shot(OUT+'team_3.png')
e.tap('A',hold=3,after=60); e.shot(OUT+'team_4.png')
print('7F2010..2020', e.wram()[0x12010:0x12020].hex(' '), '7F200E', e.wram()[0x1200E], '1F0A', e.r16(0x1F0A))
open(OUT+'st_team_next.bin','wb').write(e.save())
