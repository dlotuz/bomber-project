import { scoreboardScreen } from '../../src/screens/scoreboard';
import { createMatchSession, beginRound, endRound, resetCarry } from '../../src/game/match-session';
import { parseConfig, configFromSetup } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { CROWN_SPIN } from '../../src/game/timeline';
import { idleInput } from '../../src/input/input';
import { forceWin, runUntil, skipIntro, setCrowns } from './core-helpers';
import { mkApp, tap, idle, inputOf } from './helpers';
import { defaultSetup } from '../../src/app/settings';
import { ASSETS } from './rom';
import {
  scoreboardMaps, scoreboardSceneMaps, scoreboardFrame, crownObjs, REST_FRAME, SCOREBOARD_SCROLL, PLATE_INNER_PX,
} from '../../src/render/screens-rom/scoreboard';
import { createImage, renderPpu } from '../../src/render/ppu';
import { loadCapturePng, pixelMatch } from './capture-png';
import { parseOam } from './captures';
import { sceneMaps } from '../../src/render/screens-rom/scene';
import { loadCapture, capturedMap, mapMatch } from './captures';

beforeEach(() => resetCarry());

function afterWin(cfg = parseConfig('?players=3&humans=1'), crownsBefore = 0) {
  const env = mkApp();
  const ms = createMatchSession(cfg);
  setCrowns(ms.match, 0, crownsBefore);
  const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const sb = scoreboardScreen(env.app, ms); env.app.go(sb); env.sink.clear();
  return { ...env, ms, sb };
}

describe('placar (§6.10, R7, R8, A15)', () => {
  it('só as linhas dos slots ativos, na posição do slot', () => {
    const setup = { ...defaultSetup(), slots: ['human', 'off', 'cpu', 'off', 'cpu'] as const };
    const { sb } = afterWin(configFromSetup(setup, false, ['kb', 'kb', 'gp0', 'gp1', 'gp2']));
    expect(sb.rows()).toEqual([{ slot: 0, y: 56 }, { slot: 2, y: 120 }, { slot: 4, y: 184 }]);
  });
  it('coroa nova: casa preta até S=4, gira 104 f pela animação e para', () => {
    const { app, sb } = afterWin(undefined, 1);
    expect(sb.crownCell(0, 0)).toBe('full');
    idle(app, 4);  expect(sb.crownCell(0, 1)).toBe('empty');
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('spin:0');
    idle(app, 103); expect(sb.crownCell(0, 1)).toBe(`spin:${CROWN_SPIN.length - 1}`);
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('full');
    expect(sb.crownCell(1, 0)).toBe('empty');
  });
  it('pular: A/B/START a partir de S=18; próxima rodada depois de 15 + 30 (ROUND_BLACK), com $2F +31 e $14 +43', () => {
    const { app, sink } = afterWin();
    idle(app, 17); tap(app, BTN.A);
    expect(app.inTransition).toBe(false);
    tap(app, BTN.B);
    expect(app.inTransition).toBe(true);
    const t0 = app.tick;
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(45);
    expect(sink.since(t0).map(c => [c.t, c.op, c.id])).toEqual([[31, 'bank', 0x2f], [43, 'music', 0x14]]);
  });
  it('sem botão: sai sozinho em S=511', () => {
    const { app } = afterWin();
    idle(app, 511); expect(app.inTransition).toBe(false);
    idle(app, 1); expect(app.inTransition).toBe(true);
  });
});

describe('placar final (§6.12, R9)', () => {
  it('não pula; $16 em S=511; a vitória assume em S=557 sem fade', () => {
    const { app, sink } = afterWin(parseConfig('?players=2&humans=1&matches=1'));
    for (let k = 0; k < 511; k++) app.update(inputOf(BTN.A | BTN.START, BTN.A | BTN.START));
    expect([app.inTransition, sink.of('music')]).toEqual([false, []]);
    idle(app, 1);
    expect(sink.of('music').map(c => c.id)).toEqual([0x16]);
    idle(app, 45); expect(app.screen.id).toBe('scoreboard');
    idle(app, 1);
    expect([app.screen.id, app.inTransition]).toEqual(['victory', false]);
  });
});

describe.skipIf(!ASSETS)('coroa da ROM (R10)', () => {
  it('C3:DA94 tem 32 quadros e 104 f, como a spec', () => {
    const anim = ASSETS!.anim(0xc3da94);
    expect(anim.map(f => f.dur)).toEqual([...CROWN_SPIN]);
  });
});

describe.skipIf(!ASSETS || !loadCapture('scoreboard'))('fundo × captura (A14, §7.5)', () => {
  // Faixa do título ("SCORE BOARD" original; o texto é nosso) + a grade das 5×5 casas de coroa: a captura tem
  // coroas já ganhas (conteúdo dinâmico do estado daquela partida) desenhadas direto no BG naquelas casas, não
  // só pelo OBJ da coroa nova (achado ao comparar linha a linha: só as casas com coroa preenchida na captura
  // divergem da nossa grade "tudo vazio"). `drawScoreboardRom` desenha a coroa por cima via OBJ, então a régua
  // do jogo (SCORE.crownX/rowY0/rowStep) não precisa bater pixel a pixel aqui.
  const ignore = [{ x0: 40, y0: 16, x1: 220, y1: 56 }, { x0: 64, y0: 48, x1: 240, y1: 216 }];

  it('BG1/BG2 do caminho real (sceneMaps: MAP_SOURCES da T19 tem prioridade) batem ≥ 97 % com a captura', () => {
    const cap = loadCapture('scoreboard')!;
    const maps = sceneMaps(ASSETS!, 'scoreboard', scoreboardMaps);
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const built = maps[layer];
      if (!built) continue;
      expect(mapMatch(built, capturedMap(cap, addr), ignore), layer).toBeGreaterThanOrEqual(0.97);
    }
  });

  it('a geometria de reserva da T13 (`scoreboardMaps`) também bate ≥ 97 %, para quando `MAP_SOURCES` faltar', () => {
    const cap = loadCapture('scoreboard')!;
    const maps = scoreboardMaps();
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const built = maps[layer];
      if (!built) continue;
      expect(mapMatch(built, capturedMap(cap, addr), ignore), layer).toBeGreaterThanOrEqual(0.97);
    }
  });
});

/** Sessão no mesmo estado da captura `scoreboard`: personagens 0..4 nos slots 0..4, coroas 2/1/0/5/0 e o 4P acabou
 *  de ganhar a 5ª (na captura, a coroa nova está no quadro 6 do giro: OAM `$140` espelhado ⇒ S = 4 + 6). */
function captureLikeSession() {
  const ms = createMatchSession(parseConfig('?players=5&humans=1&matches=5'));
  ms.cfg.chars = [0, 1, 2, 3, 4];
  [2, 1, 0, 5, 0].forEach((n, slot) => setCrowns(ms.match, slot, n));
  ms.lastWinners = [3];
  return ms;
}
const renderFrame = (f: ReturnType<typeof scoreboardFrame>) => { const img = createImage(256, 224); renderPpu(f, img); return img.data; };

describe.skipIf(!ASSETS)('coroa girando (I4: base $100, paleta 5, para no $106)', () => {
  it('peças relativas à base OBJ $100 na paleta 5; o quadro 2 é o tile $140', () => {
    const [o] = crownObjs(ASSETS!, 2, 0, 0);
    expect([o.src, o.pal, o.prio, o.size]).toEqual([{ tile: 0x140 }, 5, 3, 32]);
  });
  it('o quadro de repouso é o 0 (tile $106, de frente), não o último da animação', () => {
    expect(REST_FRAME).toBe(0);
    expect(crownObjs(ASSETS!, REST_FRAME, 0, 0).map(o => [o.src, o.hflip])).toEqual([[{ tile: 0x106 }, false]]);
  });
  it.skipIf(!loadCapture('scoreboard'))('quadro 6 na casa 4 do 4P = a entrada do OAM da captura (x 208, y 152, $140, pal 5, espelhada)', () => {
    const cap = parseOam(loadCapture('scoreboard')!.oam).find(r => r.tile === 0x140)!;
    const [o] = crownObjs(ASSETS!, 6, 3, 4);
    expect([o.x, o.y, o.src, o.pal, o.hflip, o.size]).toEqual([cap.x, cap.y, { tile: cap.tile }, cap.pal, cap.h, 32]);
  });
  it('cada quadro do giro: tile $100 + peça e paleta 5 + palAdd', () => {
    const anim = ASSETS!.anim(0xc3da94);
    anim.forEach((f, i) => {
      const objs = crownObjs(ASSETS!, i, 2, 1);
      expect(objs.map(o => [o.src, o.pal]), `quadro ${i}`).toEqual(f.pieces.map(p => [{ tile: 0x100 + p.tile }, 5 + p.palAdd]));
    });
  });
});

describe.skipIf(!ASSETS || !loadCapturePng('scoreboard'))('quadro do placar × scoreboard.png (I4/I5/I6)', () => {
  const cap = loadCapturePng('scoreboard')!;
  it('scrolls medidos por pixel (registrador; o PPU soma 1 ao VOFS): BG1 (256, 263), BG2 (0, 7)', () => {
    expect(SCOREBOARD_SCROLL.bg1).toEqual([256, 263]);
    expect(SCOREBOARD_SCROLL.bg2).toEqual([0, 7]);
  });
  it('fora do miolo da placa (onde a ROM tem "SCORE BOARD" e nós o "PLACAR"), o quadro inteiro bate pixel a pixel', () => {
    const px = renderFrame(scoreboardFrame(ASSETS!, captureLikeSession(), 10));
    // 57 344 px menos o miolo; só 1 px (202, 51) da borda de baixo refeita por espelho perto da ponta direita difere.
    const inner = (PLATE_INNER_PX.x1 - PLATE_INNER_PX.x0 + 1) * (PLATE_INNER_PX.y1 - PLATE_INNER_PX.y0 + 1);
    const n = 256 * 224 - inner;
    expect(Math.round((1 - pixelMatch(px, cap, [PLATE_INNER_PX])) * n)).toBeLessThanOrEqual(1);
  });
  it('cabeças = retratos da ROM (a mesma folha e paleta da captura), linha a linha', () => {
    const px = renderFrame(scoreboardFrame(ASSETS!, captureLikeSession(), 10));
    for (let slot = 0; slot < 5; slot++) {
      const area = { x0: 48, y0: 56 + 32 * slot, x1: 79, y1: 87 + 32 * slot };
      expect(pixelMatch(px, cap, [], area), `${slot + 1}P`).toBe(1);
    }
  });
  it('sem o texto em inglês: o miolo da placa sai liso (uma cor só)', () => {
    const px = renderFrame(scoreboardFrame(ASSETS!, captureLikeSession(), 10));
    const colors = new Set<number>();
    for (let y = PLATE_INNER_PX.y0; y <= PLATE_INNER_PX.y1; y++) for (let x = PLATE_INNER_PX.x0; x <= PLATE_INNER_PX.x1; x++) {
      const i = (y * 256 + x) * 4; colors.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    }
    expect([...colors]).toEqual([0]);
  });
});

describe.skipIf(!ASSETS)('mapas do placar', () => {
  it('coroas cheias antigas vão para a grade do BG2; a nova (depois do giro) fica como OBJ no quadro 0', () => {
    const ms = captureLikeSession();
    const maps = scoreboardSceneMaps(ASSETS!, ms, 200);
    const at = (c: number, r: number) => maps.bg2![r * 32 + c];
    expect([at(5, 4), at(6, 4), at(5, 5), at(6, 5)]).toEqual([0x18a8, 0x18aa, 0x18c8, 0x18ca]);   // 1P, casa 0
    expect(at(13, 10)).toBe(0x58ec);                                                            // 4P, casa 4: vazia no BG2
    const f = scoreboardFrame(ASSETS!, ms, 200);
    expect(f.oam.filter(o => 'tile' in o.src && o.src.tile === 0x106)).toHaveLength(1);
  });
});
