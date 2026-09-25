import { BTN, createMatch, startRound, finishRound, step, type GameEvent, type MatchState, type RoundState } from '../core';
import type { GameConfig } from './config';

export const ROUND_OVER_FRAMES = 150;
export const SCOREBOARD_FRAMES = 540;   // ≈9 s, como o placar do original
export const SKIP_AFTER = 60;

export type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory';

/** Transições que interessam a quem está de fora (áudio, webhook). A fila é consumida por quem lê. */
export type SessionNotice =
  | { type: 'round_over'; winners: number[]; crowns: number[] }
  | { type: 'match_over'; champions: number[]; crowns: number[] };

export interface Session {
  cfg: GameConfig; seed: number;
  match: MatchState; round: RoundState;
  phase: SessionPhase; timer: number; paused: boolean; matchOver: boolean;
  /** true só nos ticks em que `step()` do core de fato rodou (ver web/src/app/tick.ts). */
  stepped: boolean;
  /** A partida acabou (vitória confirmada) ou foi abandonada pela pausa; quem hospeda a sessão troca de tela. */
  finished: boolean;
  aborted: boolean;
  notices: SessionNotice[];
  prevPads: number[]; lastWinners: number[]; champions: number[];
}

export function createSession(cfg: GameConfig, seed: number, initialPads: number[] = [0, 0, 0, 0, 0]): Session {
  const match = createMatch(cfg.rules, cfg.stage, seed);
  return {
    cfg, seed, match, round: startRound(match), phase: 'battle', timer: 0, paused: false, matchOver: false,
    stepped: false, finished: false, aborted: false, notices: [],
    prevPads: [...initialPads], lastWinners: [], champions: [],
  };
}

/** Avança um tick (1/60 s). Devolve os eventos do core deste tick (vazio fora da batalha). */
export function updateSession(s: Session, pads: number[]): GameEvent[] {
  const pressed = pads.map((p, i) => p & ~(s.prevPads[i] ?? 0));
  s.prevPads = [...pads];
  s.stepped = false;
  if (s.finished) return [];
  // Só jogadores humanos pausam, pulam telas ou controlam personagens; CPUs (Plano 4) ficam paradas.
  const hit = (mask: number) => pressed.some((p, i) => s.cfg.humans[i] && (p & mask) !== 0);
  let ev: GameEvent[] = [];
  switch (s.phase) {
    case 'battle':
      if (hit(BTN.START)) s.paused = !s.paused;
      else if (s.paused && hit(BTN.B)) { s.finished = true; s.aborted = true; break; }
      if (s.paused) break;
      ev = step(s.round, pads.map((p, i) => (s.cfg.humans[i] ? p : 0)));
      s.stepped = true;
      if (s.round.phase === 'result') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }
      break;
    case 'roundOver':
      if (--s.timer <= 0) {
        const r = finishRound(s.match, s.round);
        s.lastWinners = r.winners;
        s.champions = r.champions;
        s.matchOver = r.matchOver;
        s.notices.push({ type: 'round_over', winners: [...r.winners], crowns: [...s.match.crowns] });
        if (r.matchOver) s.notices.push({ type: 'match_over', champions: [...r.champions], crowns: [...s.match.crowns] });
        s.phase = 'scoreboard';
        s.timer = SCOREBOARD_FRAMES;
      }
      break;
    case 'scoreboard':
      s.timer--;
      if (s.timer <= 0 || (SCOREBOARD_FRAMES - s.timer > SKIP_AFTER && hit(BTN.START | BTN.A))) {
        if (s.matchOver) { s.phase = 'victory'; s.timer = 0; }
        else { s.round = startRound(s.match); s.phase = 'battle'; }
      }
      break;
    case 'victory':
      s.timer++;
      if (s.timer > SKIP_AFTER && hit(BTN.START | BTN.A)) s.finished = true;
      break;
  }
  return ev;
}
