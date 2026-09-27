import { CUES, type Cue } from '../../src/audio/cues';
import { STAGE, WIN_END, DRAW_TIME_END, DRAW_DEAD_END, DRAW_SCENE, NEXT_ROUND, SCORE, VICTORY } from '../../src/game/timeline';
import { FADE_OUT_1 } from '../../src/app/fade';
import { CELEBRATE_TICKS, VICTORY_SFX_AT, TIME_UP_TICKS } from '../../src/core/constants';
import { SFX, MUSIC, BANK, VOICE } from '../../src/app/audio';

/** Os roteiros do plano 11 (`CUES`, medidos [AUD §2]) × os tempos que o plano 10 toca (`game/timeline.ts`). */
const OUT = FADE_OUT_1.length;                        // fade-out de 15 f antes do preto
const sfx17 = CELEBRATE_TICKS - VICTORY_SFX_AT;       // SFX $17 → over (97)
const at = (c: Cue[]) => c.map(x => `${x.at}:${x.kind}${'id' in x ? ` ${x.id.toString(16)}` : ''}`);
const cue = (a: number, kind: Cue['kind'], id?: number): Cue => (id === undefined ? { at: a, kind } : { at: a, kind, id }) as Cue;

describe('CUES = timeline do plano 10, em todas as transições (M1)', () => {
  it('fase escolhida → partida', () => {
    expect(at(CUES.stageToBattle.cues)).toEqual(at([
      cue(0, 'sfx', SFX.confirm), cue(STAGE.musicAt, 'music', MUSIC.battleStart), cue(STAGE.voiceAt, 'voice', VOICE.battleStart),
      cue(STAGE.audioFadeAt, 'fade'), cue(STAGE.bankAt, 'bank', BANK.battle), cue(STAGE.battleMusicAt, 'music', MUSIC.battle),
    ]));
  });
  it('rodada com vencedor e última coroa (placar e VITÓRIA)', () => {
    const scoreIn = sfx17 + OUT + WIN_END.black;      // S = 0 do placar
    const win = [cue(0, 'sfx', 0x17), cue(sfx17 + WIN_END.audioFadeAt, 'fade'), cue(sfx17 + WIN_END.bankAt, 'bank', BANK.menus),
      cue(sfx17 + WIN_END.musicAt, 'music', MUSIC.score)];
    expect(at(CUES.roundWin.cues)).toEqual(at(win));
    expect(at(CUES.matchVictory.cues)).toEqual(at([...win, cue(scoreIn + SCORE.victoryMusicAt, 'music', MUSIC.victory),
      cue(scoreIn + VICTORY.voiceAt, 'voice', VOICE.victory)]));
  });
  it('próxima rodada', () => {
    expect(at(CUES.nextRound.cues)).toEqual(at([cue(0, 'bank', BANK.battle), cue(NEXT_ROUND.musicAt - NEXT_ROUND.bankAt, 'music', MUSIC.battle)]));
  });
  it('EMPATE por TIME UP (a partir do STOP em 0:00; over = +160)', () => {
    const o = TIME_UP_TICKS, T = DRAW_TIME_END;
    expect(at(CUES.timeUpDraw.cues)).toEqual(at([cue(0, 'stop'), cue(o + T.audioFadeAt, 'fade'), cue(o + T.bankAt, 'bank', BANK.menus),
      cue(o + T.musicAt, 'music', MUSIC.draw), cue(o + OUT + T.black + DRAW_SCENE.voiceAt, 'voice', VOICE.draw)]));
  });
  it('EMPATE com todos mortos (a partir do FADE)', () => {
    const T = DRAW_DEAD_END, o = -T.audioFadeAt;
    expect(at(CUES.allDeadDraw.cues)).toEqual(at([cue(0, 'fade'), cue(o + T.bankAt, 'bank', BANK.menus),
      cue(o + T.musicAt, 'music', MUSIC.draw), cue(o + OUT + T.black + DRAW_SCENE.voiceAt, 'voice', VOICE.draw)]));
  });
});
