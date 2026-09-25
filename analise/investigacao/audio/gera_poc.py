"""Gera a prova de conceito: .spc e .wav das músicas do fluxo Battle + amostras de SFX e vozes, só a partir da ROM.
Saída: analise/extraido/audio/ (fora do git). Requer ./build_spchost.sh."""
import subprocess, os
SP = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-audio/spchost/spchost"
ROM = "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"
OUT = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/audio/"
def run(wav, spc, script):
    r = subprocess.run([SP, ROM, OUT + wav, (OUT + spc) if spc else '-', script], capture_output=True, text=True)
    print(wav, '|', script, '|', r.stderr.strip().splitlines()[-1]); os.remove(OUT + wav + '.apuram')
MUS = {0x01: ('titulo', 0x30, 30), 0x12: ('menus', 0x30, 30), 0x13: ('battle_start', 0x30, 8), 0x14: ('batalha', 0x2F, 60),
       0x15: ('placar', 0x30, 20), 0x16: ('vitoria', 0x30, 30), 0x18: ('empate', 0x30, 20)}
for m, (nome, bank, secs) in MUS.items():
    run('mus_%02X_%s.wav' % (m, nome), 'mus_%02X_%s.spc' % (m, nome),
        'init; blk %X; mus %X; frames 2; spc; rec; frames %d' % (bank, m, secs * 60))
SFX_BAT = [0x0C, 0x07, 0x0B, 0x08, 0x0A, 0x0D, 0x0E, 0x0F, 0x10, 0x12, 0x15, 0x17, 0x1C, 0x27, 0x28, 0x04]
run('sfx_batalha.wav', None, 'init; blk 2F; rec; frames 20; ' + '; '.join('sfx %X; frames 75' % s for s in SFX_BAT))
run('sfx_menu.wav', None, 'init; blk 30; rec; frames 20; ' + '; '.join('sfx %X; frames 60' % s for s in (1, 2, 3)))
# as vozes dependem do banco de SFX carregado: $2F (partida) ou $30 (menus/telas de resultado)
run('vozes_batalha.wav', None, 'init; blk 2F; rec; frames 20; ' + '; '.join('stream %X; frames 150' % s for s in (0x02, 0x03, 0x04, 0x06, 0x10)))
run('vozes_menu.wav', None, 'init; blk 30; rec; frames 20; stream 1; frames 250; ' + '; '.join('stream %X; frames 150' % s for s in (0x07, 0x0A, 0x0E)))
