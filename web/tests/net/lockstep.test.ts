import { Lockstep, type LockstepTick } from '../../src/net/lockstep';
import { beginRound, createMatchSession } from '../../src/game/match-session';
import { configFromSetup, type SetupLike } from '../../src/game/config';
import { aiInputs, step } from '../../src/game/core-api';
import { hashState } from '../../src/core/hash';

/** Rede de mentira: cada mensagem chega `lat` passos depois (varia por mensagem, determinístico). */
function net(n: number) {
  const queue: { at: number; to: number; s: number; k: number; b: number }[] = [];
  let now = 0;
  return {
    send(from: number, k: number, b: number, lat: number) { for (let to = 0; to < n; to++) if (to !== from) queue.push({ at: now + lat, to, s: from, k, b }); },
    deliver(peers: Lockstep[]) {
      now++;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= now) { const m = queue[i]; peers[m.to].remote(m.s, m.k, m.b); queue.splice(i, 1); }
    },
  };
}

describe('lockstep da sala online', () => {
  it('ticks 0..delay−1 sem botões; o botão local vale delay ticks depois', () => {
    const a = new Lockstep(3, 0, [true, false, false, false, false]);
    const seen: number[] = [];
    for (let t = 0; t < 6; t++) { a.local(t === 0 ? 16 : 0); seen.push(a.next()!.input.pads[0]); }
    expect(seen).toEqual([0, 0, 0, 16, 0, 0]);
  });
  it('espera o botão do outro jogador e não roda o tick sem ele', () => {
    const a = new Lockstep(2, 0, [true, true, false, false, false]);
    a.local(0); expect(a.next()).not.toBeNull();   // tick 0
    a.local(0); expect(a.next()).not.toBeNull();   // tick 1
    a.local(0);
    expect(a.next()).toBeNull();                   // tick 2: falta a vaga 1
    expect(a.missing()).toEqual([1]);
    a.remote(1, 2, 32);
    expect(a.next()!.input.pads).toEqual([0, 32, 0, 0, 0]);
  });
  it('só acelera quando todos os outros estão 2+ ticks à frente (não passa dos 60 Hz à toa)', () => {
    const a = new Lockstep(4, 0, [true, true, true, false, false]);
    a.remote(1, 4, 0); a.remote(2, 4, 0);
    expect(a.behind()).toBe(false);          // os outros estão no mesmo ponto (tick 0 + atraso)
    a.remote(1, 6, 0);
    expect(a.behind()).toBe(false);          // um está à frente, o outro não
    a.remote(2, 7, 0);
    expect(a.behind()).toBe(true);
  });
  it('quem sai deixa de ser esperado a partir do tick combinado', () => {
    const a = new Lockstep(1, 0, [true, true, false, false, false]);
    a.local(0); a.next();
    a.drop(1, 1);
    a.local(0);
    const t = a.next()!;
    expect([t.dropped, t.input.pads[1]]).toEqual([[1], 0]);
  });
  it('3 navegadores com latência variável jogam a mesma partida (mesmo hash a cada tick)', () => {
    const setup: SetupLike = {
      mode: 'ffa', slots: ['human', 'human', 'human', 'cpu', 'cpu'], teams: [0, 1, 0, 1, 0], chars: [0, 1, 2, 3, 4], stage: 3,
      rules: { cpuLevel: 2, matches: 1, timeIdx: 0, suddenDeath: false, badBomber: true, racer: false },
    };
    const cfg = configFromSetup(setup, false, ['kb', 'kb', 'kb', 'kb', 'kb'], 0x1234);
    const peers = [0, 1, 2].map(me => new Lockstep(4, me, cfg.humans));
    const games = peers.map(() => ({ ms: createMatchSession(structuredClone(cfg)) }));
    const rs = games.map(g => beginRound(g.ms));
    const wire = net(3);
    const hashes: string[][] = [[], [], []];
    for (let wall = 0; wall < 6000; wall++) {
      peers.forEach((p, i) => {
        // cada humano aperta botões "aleatórios" (determinísticos) — direções e bomba
        const bits = [1, 2, 4, 8, 16, 0][(wall * (i + 3) >> 4) % 6];
        for (const out of p.local(bits)) wire.send(i, out.k, out.b, 1 + ((wall * 7 + i * 13) % 5));
        const t: LockstepTick | null = p.next();
        if (!t) return;
        const r = rs[i], ms = games[i].ms;
        const cpu = ms.cfg.humans.map((h, s) => !h && ms.cfg.rules.active[s]);
        const ai = aiInputs(r, ms.ai, cpu, ms.cfg.rules.cpuLevel);
        step(r, t.input.pads.map((b, s) => (ms.cfg.humans[s] ? b : ai[s])));
        hashes[i].push(hashState(r));
      });
      wire.deliver(peers);
    }
    const n = Math.min(...hashes.map(h => h.length));
    expect(n).toBeGreaterThan(3000);
    for (let k = 0; k < n; k++) if (hashes[0][k] !== hashes[1][k] || hashes[0][k] !== hashes[2][k]) throw new Error(`dessincronizou no tick ${k}`);
  }, 120_000);
  it('atraso que muda na partida: subir preenche os ticks pulados, descer não manda o mesmo tick duas vezes', () => {
    const a = new Lockstep(3, 0, [true, false, false, false, false]);
    expect(a.local(5).map(o => o.k)).toEqual([3]);
    a.next();
    a.setDelay(6); a.setDelay(6);                 // anda 1 tick por chamada: 3 → 4 → 5
    expect(a.delay).toBe(5);
    expect(a.local(7).map(o => o.k)).toEqual([4, 5, 6]);   // tick 1 + 5: os ticks 4 e 5 levam o mesmo botão
    a.next();
    a.setDelay(1); a.setDelay(1);                 // 5 → 4 → 3
    expect(a.local(9)).toEqual([]);               // tick 2 + 3 = 5 já foi mandado
    const seen: number[] = [];
    for (let t = 0; t < 6; t++) { a.local(0); seen.push(a.next()!.input.pads[0]); }
    expect(seen).toEqual([0, 5, 7, 7, 7, 0]);      // ticks 2..7: 0 (sem botão), 3, 4..6 e depois os novos
  });
  it('3 navegadores com atrasos diferentes e mudando durante a partida jogam a mesma partida', () => {
    const setup: SetupLike = {
      mode: 'ffa', slots: ['human', 'human', 'human', 'cpu', 'off'], teams: [0, 1, 0, 1, 0], chars: [0, 1, 2, 3, 4], stage: 5,
      rules: { cpuLevel: 1, matches: 1, timeIdx: 0, suddenDeath: false, badBomber: false, racer: false },
    };
    const cfg = configFromSetup(setup, false, ['kb', 'kb', 'kb', 'kb', 'kb'], 0x4321);
    const peers = [0, 1, 2].map(me => new Lockstep(8, me, cfg.humans));
    const games = peers.map(() => ({ ms: createMatchSession(structuredClone(cfg)) }));
    const rs = games.map(g => beginRound(g.ms));
    const wire = net(3);
    const hashes: string[][] = [[], [], []];
    for (let wall = 0; wall < 5000; wall++) {
      if (wall % 120 === 0) {   // "servidor": novos alvos de atraso para cada um (o anfitrião baixo, os outros variando)
        const targets = [2, 4 + ((wall / 120) % 5), 9 - ((wall / 120) % 4)];
        peers.forEach(p => { p.setDelays(targets); p.setDelay(targets[p.me]); });
      }
      peers.forEach((p, i) => {
        const bits = [1, 2, 4, 8, 16, 0][(wall * (i + 5) >> 3) % 6];
        for (const out of p.local(bits)) wire.send(i, out.k, out.b, 1 + ((wall * 11 + i * 7) % 6));
        const t: LockstepTick | null = p.next();
        if (!t) return;
        const r = rs[i], ms = games[i].ms;
        const cpu = ms.cfg.humans.map((h, s) => !h && ms.cfg.rules.active[s]);
        const ai = aiInputs(r, ms.ai, cpu, ms.cfg.rules.cpuLevel);
        step(r, t.input.pads.map((b, s) => (ms.cfg.humans[s] ? b : ai[s])));
        hashes[i].push(hashState(r));
      });
      wire.deliver(peers);
    }
    const n = Math.min(...hashes.map(h => h.length));
    expect(n).toBeGreaterThan(2500);
    for (let k = 0; k < n; k++) if (hashes[0][k] !== hashes[1][k] || hashes[0][k] !== hashes[2][k]) throw new Error(`dessincronizou no tick ${k}`);
  }, 120_000);
});

describe('sala online sem pausa', () => {
  it('noStart tira o START de todos, segurado e recém-apertado, e mantém o resto', async () => {
    const { noStart } = await import('../../src/net/online');
    const { BTN } = await import('../../src/core/types');
    const inp = { pads: [BTN.START | BTN.A, BTN.START, 0, 0, 0], pressed: [BTN.START, BTN.START | BTN.B, 0, 0, 0],
      any: BTN.START | BTN.A, pressedAny: BTN.START | BTN.B, key: null, connected: [true, true, true, true, true], esc: false, padButton: null };
    noStart(inp);
    expect(inp.pads).toEqual([BTN.A, 0, 0, 0, 0]);
    expect(inp.pressed).toEqual([0, BTN.B, 0, 0, 0]);
    expect(inp.any).toBe(BTN.A);
    expect(inp.pressedAny).toBe(BTN.B);
  });
});
