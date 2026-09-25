import { BTN, createMatch, startRound, finishRound, step, type GameEvent, type MatchState, type RoundState } from '../core';
import type { GameConfig } from './config';

export const ROUND_OVER_FRAMES = 150;
export const SCOREBOARD_FRAMES = 540;   // ≈9 s, como o placar do original
export const SKIP_AFTER = 60;

export type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory';

export interface Session {
  cfg: GameConfig; seed: number; matchNo: number;
  match: MatchState; round: RoundState;
  phase: SessionPhase; timer: number; paused: boolean;
  prevPads: number[]; lastWinners: number[]; champions: number[];
}

export function createSession(cfg: GameConfig, seed: number): Session {
  const match = createMatch(cfg.rules, cfg.stage, seed);
  return {
    cfg, seed, matchNo: 1, match, round: startRound(match), phase: 'battle', timer: 0, paused: false,
    prevPads: [0, 0, 0, 0, 0], lastWinners: [], champions: [],
  };
}

/** Avança um tick (1/60 s). Devolve os eventos do core deste tick (vazio fora da batalha). */
export function updateSession(s: Session, pads: number[]): GameEvent[] {
  const pressed = pads.map((p, i) => p & ~(s.prevPads[i] ?? 0));
  s.prevPads = [...pads];
  const hit = (mask: number) => pressed.some((p, i) => s.cfg.rules.active[i] && (p & mask) !== 0);
  let ev: GameEvent[] = [];
  switch (s.phase) {
    case 'battle':
      if (hit(BTN.START)) s.paused = !s.paused;
      if (s.paused) break;
      ev = step(s.round, pads);
      if (s.round.phase === 'result') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }
      break;
    case 'roundOver':
      if (--s.timer <= 0) {
        const r = finishRound(s.match, s.round);
        s.lastWinners = r.winners;
        s.champions = r.champions;
        s.phase = 'scoreboard';
        s.timer = SCOREBOARD_FRAMES;
      }
      break;
    case 'scoreboard':
      s.timer--;
      if (s.timer <= 0 || (SCOREBOARD_FRAMES - s.timer > SKIP_AFTER && hit(BTN.START | BTN.A))) {
        if (s.match.over) { s.phase = 'victory'; s.timer = 0; }
        else { s.round = startRound(s.match); s.phase = 'battle'; }
      }
      break;
    case 'victory':
      s.timer++;
      if (s.timer > SKIP_AFTER && hit(BTN.START | BTN.A)) {
        s.matchNo++;
        s.match = createMatch(s.cfg.rules, s.cfg.stage, (s.seed + Math.imul(s.matchNo, 7919)) >>> 0);
        s.round = startRound(s.match);
        s.phase = 'battle';
        s.lastWinners = [];
        s.champions = [];
      }
      break;
  }
  return ev;
}
