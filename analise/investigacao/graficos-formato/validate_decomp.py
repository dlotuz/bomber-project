"""Valida decomp.decode_zte contra TODAS as chamadas das rotinas do jogo ($C4:09A5 e $C1:874D) gravadas
pelo core instrumentado (scenes.py). Para cada chamada: pega o ponteiro de origem na entrada, a saída que o jogo
gravou na WRAM (dump na saída da rotina) e compara byte a byte com o descompressor Python."""
import sys, glob, os, json; sys.path.insert(0, '.')
from dbgemu import OUT, parse_log, dp
from decomp import decode_zte
from rom import r24, hx
CEN = OUT + '/cenas'
tot = ok = 0; calls = []
for lp in sorted(p for p in glob.glob(CEN + '/*.log') if not os.path.basename(p).startswith('_')):
    scene = os.path.basename(lp)[:-4]
    binf = open(lp[:-4] + '.bin', 'rb').read()
    pend = None
    for d in parse_log(lp):
        if d['type'] != 'B': continue
        pc = d['pc']
        if pc == 'C409A5':
            pend = ('A', r24(dp(d, 0x58, 3) ), dp(d, 0x58, 3), dp(d, 0x68, 3))   # src = ponteiro lido em [$58]
        elif pc == 'C1874D':
            pend = ('B', dp(d, 0x54, 3), None, dp(d, 0x58, 3))
        elif pc in ('C409D6', 'C1876E') and pend:
            n = int(d['n']); off = int(d['bin']); game = binf[off:off + n]
            src = pend[1]
            mine, clen = decode_zte(src)
            good = mine == game
            tot += 1; ok += good
            calls.append(dict(cena=scene, rotina='C409A5' if pend[0] == 'A' else 'C1874D', script=hx(pend[2]) if pend[2] else None,
                              origem=hx(src), destino_wram=f'{pend[3]:06X}', bytes=n, comprimido=clen, ok=good))
            if not good: print('FALHA', scene, hx(src), n, len(mine))
            pend = None
print(f'{ok}/{tot} chamadas idênticas')
json.dump(calls, open(OUT + '/validacao_chamadas.json', 'w'), indent=1)
