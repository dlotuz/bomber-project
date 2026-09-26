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
  it('1–21 animação, 22–64 pós-morte, 65 fora de jogo', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    hitPlayer(s, p, 'flame', []);                   // tick 100
    for (let k = 1; k <= 64; k++) { s.tick++; tickDeath(s, p, []); expect(p.state).toBe('dying'); }
    s.tick++; tickDeath(s, p, []);
    expect(p.state).toBe('out');
  });
});

describe('atordoamento (t44)', () => {
  it('63 ticks de stunned, 1 chamada rnd(255) para o número de perdas, evento', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    const r = makeRng(s.rng.seed); rnd(r, 0xff);
    const ev: GameEvent[] = [];
    stunPlayer(s, p, ev);
    expect([p.act, p.actLeft]).toEqual(['stunned', 63]);
    expect(s.rng.seed).toBe(r.seed);
    expect(ev).toEqual([{ type: 'stunned', slot: 0 }]);
  });
  it('em `won` não atordoa', () => {
    const s = arena(); const p = put(s, 0, 4, 1); s.phase = 'won';
    stunPlayer(s, p, []);
    expect(p.act).toBe('idle');
  });
});
