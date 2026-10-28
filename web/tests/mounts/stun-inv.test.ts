import { mkRound, placePx, ride, run, flameAt, cx, cy, BTN } from './helpers';
import { cellOf } from '../../src/core/mounts/core-api';
import { rider, type MountRider } from '../../src/core/mounts/types';
import { addBomb } from '../../src/core/bombs';
import { punchBomb, startLift, throwHeld } from '../../src/core/flyers';
import { startPPunch } from '../../src/core/actions';
import { landBomb } from '../../src/core/stages/kit';
import { stunPlayer } from '../../src/core/hit';
import { CODE, type GameEvent, type Player, type RoundState } from '../../src/core/types';

// Ajuste "invencível depois de perder a montaria não é atordoado". Emulador (analise/investigacao/aj-stuninv: base.py,
// punch.py, shots.py, kick.py, mnt.py; st_arena05, P2 montado no tipo 3 atingido pela chama em D0):
// - desmontando ($C2:105E → $C2:10D5, e o remonte $C2:1089) o P2 some da grade de ocupação $7F:1000: $C2:4B5C apaga os
//   bits dele ($C2:4BA3 → $C2:3419) e só a rotina normal os grava de novo ($C2:33FC). Bomba socada que cai na casa dele
//   não chama $C2:59D6 e fica parada ali ($C900); tiro E e nota F passam sem chamar $C1:2ED0/$C2:59BF; a bomba chutada
//   entra na casa. A rotina do desmonte não trata pedidos ($C2:4C54) e, no fim, apaga o de atordoamento ($C2:59AB em
//   $C2:10A8/$C2:10F1). Montando ($C2:261E) é igual (sem ocupação; no fim $C2:26CF apaga o pedido).
// - piscando (+$96 ≠ 0): $C2:59D6 não pede o atordoamento — bomba quica sem $C2:0E29 e sem perder item; mas o tiro E
//   ($C1:2ED0 só olha +$E8) deixa lento, a nota F ($C2:59BF, só +$E8; $C2:4C88 → $C2:0D83) faz dançar e o P
//   ($C2:499F, só +$E8; $C2:4C14) empurra, mesmo invencível.
// - depois do +$96 zerar, a bomba atordoa ($C2:59F5 → $C2:0E29) e tira item.

const Q = cellOf(8, 5);

/** P1 (slot 0) em (4,5) olhando para a direita; P2 (slot 1) montado no tipo 3 em (8,5), atingido pela chama em H. */
function scene(p1Mount?: number, p1Col = 4) {
  const s = mkRound();
  const p = placePx(s, 0, cx(p1Col), cy(5)); p.face = 2;
  const q = placePx(s, 1, cx(8), cy(5)); q.fire = 4;
  if (p1Mount !== undefined) ride(s, 0, p1Mount);
  const r = ride(s, 1, 0x3);
  return { s, p, q, r };
}
function hit(s: RoundState): number {
  flameAt(s, Q);
  run(s, 1);                                   // H: perdeu a montaria
  s.grid[Q] = CODE.FLOOR;
  return s.tick;
}
const until = (s: RoundState, t: number): GameEvent[] => run(s, t - s.tick);
const stunned = (ev: GameEvent[], q: Player): boolean => ev.some(e => e.type === 'stunned' && e.slot === q.slot);

/** Bomba socada pelo P1 da casa (5,5): cai na casa do P2 (8,5) em T + 17. */
function punchAt(s: RoundState, p: Player, land: number): GameEvent[] {
  until(s, land - 17);
  p.punch = true;
  addBomb(s, 0, cellOf(5, 5));
  const ev: GameEvent[] = [];
  punchBomb(s, p, ev);
  return [...ev, ...run(s, 17)];
}

/** Bomba arremessada pela luva do P1 na direção do P2 (alvo a 4 casas: cai na casa dele). */
function throwAt(s: RoundState, p: Player, t: number): GameEvent[] {
  until(s, t);
  p.glove = true;
  addBomb(s, 0, cellOf(4, 5));
  const ev: GameEvent[] = [];
  startLift(s, p, ev);
  throwHeld(s, p, ev);
  for (let i = 0; i < 40 && s.flyers.length; i++) ev.push(...run(s, 1));
  return ev;
}

describe('ajuste: invencível depois de perder a montaria não é atordoado', () => {
  describe('bomba na cabeça (soco)', () => {
    it('desmontando (H+5 a H+52): não atordoa nem tira item; a bomba fica parada na casa dele (fora da ocupação)', () => {
      for (const k of [5, 20, 40, 51, 52]) {
        const { s, p, q } = scene(); const H = hit(s);
        const seed = s.rng.seed;
        const ev = punchAt(s, p, H + k);
        expect([stunned(ev, q), q.act === 'stunned', q.fire, s.rng.seed], `H+${k}`).toEqual([false, false, 4, seed]);
        expect(s.grid[Q], `H+${k}`).toBe(CODE.BOMB);
      }
    });
    it('piscando (H+53 a H+83): quica sem atordoar nem tirar item ($C2:59D6 com +$96 ≠ 0)', () => {
      for (const k of [53, 60, 70, 83]) {
        const { s, p, q } = scene(); const H = hit(s);
        const seed = s.rng.seed;
        const ev = [...punchAt(s, p, H + k), ...run(s, 8)];
        expect([stunned(ev, q), q.act === 'stunned', q.fire, s.rng.seed], `H+${k}`).toEqual([false, false, 4, seed]);
        expect(s.grid[cellOf(9, 5)], `H+${k}`).toBe(CODE.BOMB);   // quicou 1 casa
      }
    });
    it('depois da invencibilidade (H+86): atordoa e tira item, como a bomba na cabeça de quem não pisca', () => {
      const { s, p, q } = scene(); const H = hit(s);
      const ev = punchAt(s, p, H + 86);
      expect([stunned(ev, q), q.act]).toEqual([true, 'stunned']);
      expect(q.fire).toBeLessThan(4);
    });
  });

  describe('bomba na cabeça (luva)', () => {
    it('desmontando e piscando não atordoa; depois atordoa', () => {
      for (const [t, want] of [[10, false], [60, false], [90, true]] as const) {
        const { s, p, q } = scene(); const H = hit(s);
        const ev = throwAt(s, p, H + t);
        expect(stunned(ev, q), `H+${t}`).toBe(want);
        if (!want) expect(q.fire, `H+${t}`).toBe(4);
      }
    });
  });

  describe('bomba que cai do céu (arena: landBomb, $C1:2366)', () => {
    it('desmontando: vira bomba parada na casa dele; piscando: quica; nenhum dos dois atordoa', () => {
      for (const [k, parada] of [[10, true], [60, false]] as const) {
        const { s, q } = scene(); const H = hit(s);
        until(s, H + k);
        const ev: GameEvent[] = [];
        landBomb(s, Q, ev);
        expect([stunned(ev, q), q.fire], `H+${k}`).toEqual([false, 4]);
        expect(s.grid[Q] === CODE.BOMB, `H+${k}`).toBe(parada);
      }
    });
  });

  describe('bomba chutada (não é fonte de atordoamento na ROM: o deslize não chama $C2:59D6)', () => {
    it('chutada contra ele piscando: para na frente, sem atordoar', () => {
      const { s, p, q } = scene(); const H = hit(s);
      until(s, H + 53);
      p.kick = true;
      addBomb(s, 0, cellOf(5, 5));
      const ev = run(s, 30, { 0: BTN.RIGHT });
      expect([stunned(ev, q), q.act === 'stunned', q.fire]).toEqual([false, false, 4]);
    });
  });

  describe('golpe P ($C2:499F só olha +$E8; $C2:4C14 não olha +$96)', () => {
    it('desmontando não é alvo (sem bit "a pé" na ocupação); piscando é empurrado, mas não atordoado', () => {
      for (const [k, pushed] of [[20, false], [60, true]] as const) {
        const { s, p, q } = scene(); const H = hit(s);
        until(s, H + k);
        p.x = q.x - 16 * 256; p.pItem = true;
        const ev: GameEvent[] = [];
        startPPunch(s, p, ev);
        ev.push(...run(s, 3));
        expect([q.act === 'pushed', stunned(ev, q), q.fire], `H+${k}`).toEqual([pushed, false, 4]);
      }
    });
  });

  describe('tiro E (lento)', () => {
    it('desmontando: o tiro passa; piscando: fica lento ($C1:2ED0 não olha +$96), sem atordoar', () => {
      for (const [k, slow] of [[5, false], [55, true]] as const) {
        const { s, q } = scene(0xe); const H = hit(s);
        until(s, H + k);
        const ev = run(s, 1, { 0: BTN.Y });
        ev.push(...run(s, 30));
        expect([q.effect.kind === 2, stunned(ev, q), q.act === 'stunned'], `H+${k}`).toEqual([slow, false, false]);
      }
    });
  });

  describe('nota F (dança / soneca)', () => {
    it('desmontando: a nota passa; piscando: dança ($C2:59BF não olha +$96), sem perder item', () => {
      // nota a 2 casas (32 px): ~60 ticks de voo; disparada 40 ticks antes do acerto chega no desmonte, em H chega piscando
      for (const [dt, dance] of [[-40, false], [0, true]] as const) {
        const { s, q } = scene(0xf, 6);
        if (dt < 0) run(s, 1, { 0: BTN.Y });
        if (dt < 0) run(s, -dt - 1);
        const H = hit(s);
        if (dt === 0) run(s, 1, { 0: BTN.Y });
        let danced = false; const ev: GameEvent[] = [];
        for (let i = 0; i < 100; i++) { ev.push(...run(s, 1)); if (q.act === 'dance') { danced = true; break; } }
        expect([danced, stunned(ev, q), q.fire], `dt=${dt}`).toEqual([dance, false, 4]);
        if (danced) expect([q.inv > 0, s.tick - H < 84], 'dança ainda piscando').toEqual([true, true]);
      }
    });
  });

  describe('atordoamento direto (bola da arena 3, jogador arremessado com Rules.throwStun)', () => {
    it('montando e desmontando: stunPlayer não faz nada ($C2:4C54 não roda; $C2:59AB apaga o pedido no fim)', () => {
      for (const phase of ['mounting', 'dismount'] as const) {
        const s = mkRound();
        const q = placePx(s, 1, cx(8), cy(5)); q.fire = 4;
        ride(s, 1, 0x3, { phase } as Partial<MountRider>);
        const seed = s.rng.seed; const ev: GameEvent[] = [];
        stunPlayer(s, q, ev);
        expect([q.act, q.fire, s.rng.seed, ev], phase).toEqual(['idle', 4, seed, []]);
        expect(rider(q)?.phase).toBe(phase);
      }
    });
    it('montado (riding) e sem montaria, sem invencibilidade: atordoa (a bomba na cabeça do outro desenvolvedor)', () => {
      for (const mounted of [true, false]) {
        const s = mkRound();
        const q = placePx(s, 1, cx(8), cy(5)); q.fire = 4;
        if (mounted) ride(s, 1, 0x3);
        const ev: GameEvent[] = [];
        stunPlayer(s, q, ev);
        expect([q.act, stunned(ev, q)], `montado=${mounted}`).toEqual(['stunned', true]);
      }
    });
  });

  describe('chama no desmonte e na invencibilidade', () => {
    it('não mata desmontando nem piscando; o desmonte não muda a perda de item de um atordoamento depois', () => {
      const { s, q } = scene(); const H = hit(s);
      for (const k of [10, 40, 60, 80]) {
        until(s, H + k - 1);
        flameAt(s, Q);
        run(s, 1);
        s.grid[Q] = CODE.FLOOR;
        expect(q.state, `H+${k}`).toBe('alive');
      }
      expect(q.fire).toBe(4);
    });
  });
});
