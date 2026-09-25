from mec import *
for name,kw in [('normal',{}),('racer',dict(racer=1)),('bad',dict(bad=1)),('sd',dict(sd=1))]:
    e=start_round(**kw, save_as=f'st_r_{name}.bin')
    print(name, 'frame', e.nframes, 'rules', e.wram()[0x12017:0x1201D].hex(' '), 'P1', e.obj(0)[0x40:0x50].hex(' '), 'D8', hex(e.obj(0)[0xD8]), '45',hex(e.obj(0)[0x45]), '5C',hex(e.obj(0)[0x5C]), 'E2',hex(e.obj(0)[0xE2]),'E4',hex(e.obj(0)[0xE4]))
    e.shot(OUT+f'r_{name}.png')
