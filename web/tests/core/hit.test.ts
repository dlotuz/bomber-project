import { arena, put, setCell } from './kit';
import { checkHit, hitPlayer, tickDeath, stunPlayer, tickInv, isImmune } from '../../src/core/hit';
import { CODE, type GameEvent } from '../../src/core/types';
import { makeRng, rnd } from '../../src/core/rng';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

describe('acerto', () => {
  it('hitbox da chama (t25): X 167 na col 10 morre; X 168 não', () => {
    for (const [dx, dies] of [[8, true], [9, false], [-7, true]] as const) {   // centro da col 10 = 159 px
      const s = arena(); const p = put(s, 0, 10, 1, dx, 0);
      setCell(s, 10, 1, CODE.FLAME);
      checkHit(s, p, []);
      expect(p.state === 'dying').toBe(dies);
    }
  });
  it('morte: estado, tick do acerto, doença some, evento', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x21;
    setCell(s, 4, 1, CODE.FLAME);
    const ev: GameEvent[] = [];
    checkHit(s, p, ev);
    expect([p.state, p.hitT0, s.lastHit, p.disease, p.act, p.actT0]).toEqual(['dying', 100, 100, 0, 'dying', 100]);
    expect(ev).toEqual([{ type: 'player_hit', slot: 0 }]);
  });
  it('invencível não morre na chama; tickInv desconta 1 por tick', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.inv = 2;
    setCell(s, 4, 1, CODE.FLAME);
    checkHit(s, p, []); expect(p.state).toBe('alive');
    tickInv(p); tickInv(p); expect(p.inv).toBe(0);
    checkHit(s, p, []); expect(p.state).toBe('dying');
  });
  it('ordem de absorção: montaria → traje → coração → morte', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.costume = 2; p.heart = true;
    let mountHits = 0;
    MOUNTS.current = { ...NO_MOUNT, onHit: () => { mountHits++; return mountHits === 1; } };
    try {
      hitPlayer(s, p, 'flame', []); expect([mountHits, p.costume, p.heart, p.inv]).toEqual([1, 2, true, 0]);
      hitPlayer(s, p, 'flame', []); expect([p.costume, p.heart, p.inv, p.state]).toEqual([-1, true, 96, 'alive']);
      hitPlayer(s, p, 'flame', []); expect([p.heart, p.inv, p.state]).toEqual([false, 96, 'alive']);
      hitPlayer(s, p, 'flame', []); expect(p.state).toBe('dying');
    } finally { MOUNTS.current = NO_MOUNT; }
  });
  it('bloco de pressão mata mesmo com coração e invencibilidade', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.heart = true; p.inv = 300;
    setCell(s, 4, 1, CODE.PRESSURE);
    checkHit(s, p, []);
    expect(p.state).toBe('dying');
  });
  it('em `won` quem está de pé é imune', () => {
    const s = arena(); const p = put(s, 0, 4, 1); s.phase = 'won';
    setCell(s, 4, 1, CODE.PRESSURE);
    expect(isImmune(s, p)).toBe(true);
    checkHit(s, p, []);
    expect(p.state).toBe('alive');
  });
});

describe('linha do tempo da morte (t29)', () => {
  it('doença e contador da doença zeram na morte', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x29; p.diseaseT = 50;
    hitPlayer(s, p, 'flame', []);
    expect([p.disease, p.diseaseT]).toEqual([0, 0]);
  });
  it('Bad Bomber só nasce em `play`: em `won` o jogador fica fora de jogo', () => {
    for (const phase of ['play', 'won'] as const) {
      const s = arena({ rules: { badBomber: true } }); const p = put(s, 0, 4, 1);
      hitPlayer(s, p, 'flame', []);
      s.phase = phase;
      for (let k = 1; k <= 65; k++) { s.tick++; tickDeath(s, p, []); }
      expect([p.state, s.bad.length], phase).toEqual(phase === 'play' ? ['bad', 1] : ['out', 0]);
    }
  });
  it('1–21 animação, 22–64 pós-morte, 65 fora de jogo', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    hitPlayer(s, p, 'flame', []);                   // tick 100
    for (let k = 1; k <= 64; k++) { s.tick++; tickDeath(s, p, []); expect(p.state).toBe('dying'); }
    s.tick++; tickDeath(s, p, []);
    expect(p.state).toBe('out');
  });
});

describe('atordoamento (t44)', () => {
  it('63 ticks de stunned, evento, e o RNG bate com 1 rnd(255) + rnd(13) por tentativa de perda (jogador zerado)', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    // Espelha $C2:51C4: 1 sorteio para o número de perdas (n), depois, por perda, até 8 tentativas com
    // rnd(13) incondicional (jogador zerado nunca tem o que perder, então nenhuma tentativa acerta e a
    // 1ª perda falhando totalmente encerra loseItems — como no Step 3 do brief, sem checar antes se há algo a perder).
    const r = makeRng(s.rng.seed);
    const n = ((rnd(r, 0xff) & 6) >> 1) + 1;
    for (let k = 0; k < n; k++) {
      let ok = false;
      for (let a = 0; a < 8 && !ok; a++) rnd(r, 13);
      if (!ok) break;
    }
    const ev: GameEvent[] = [];
    stunPlayer(s, p, ev);
    expect([p.act, p.actLeft]).toEqual(['stunned', 63]);
    expect(s.rng.seed).toBe(r.seed);
    expect(ev).toEqual([{ type: 'stunned', slot: 0 }]);
  });
  it('já atordoado, ignora novo atordoamento ($C2:0E86 não checa o pedido e o apaga no fim)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.fire = 5;
    stunPlayer(s, p, []);
    p.actLeft = 30;
    const seed = s.rng.seed, fire = p.fire, flyers = s.flyers.length;
    const ev: GameEvent[] = [];
    stunPlayer(s, p, ev);
    expect([p.act, p.actLeft, s.rng.seed, p.fire, s.flyers.length, ev]).toEqual(['stunned', 30, seed, fire, flyers, []]);
  });
  it('em `won` não atordoa', () => {
    const s = arena(); const p = put(s, 0, 4, 1); s.phase = 'won';
    stunPlayer(s, p, []);
    expect(p.act).toBe('idle');
  });
});
