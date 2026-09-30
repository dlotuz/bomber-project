import type { GameEvent, Player, RoundState } from './types';
import { INTRO_CLOCK_TICKS, INTRO_TICKS } from './constants';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { tickClock } from './clock';
import { tickPressure } from './pressure';
import { applyDiseaseInput, contagion, tickDisease } from './disease';
import { playerActions } from './actions';
import { pickup } from './items';
import { checkHit, tickDeath, tickInv } from './hit';
import { tickBombs, tickCells } from './bombs';
import { tickFlyers } from './flyers';
import { tickHeld } from './grab';
import { tickBadBombers } from './bad-bomber';
import { checkRoundEnd, tickEndPhases } from './round-end';

/** Passo 3 da §3.4, para um jogador. */
export function playerTick(s: RoundState, p: Player, raw: number, ev: GameEvent[]): void {
  if (!p.present || p.state === 'bad') return;   // o Bad Bomber lê a entrada em tickBadBombers
  if (p.state === 'dying') { tickDeath(s, p, ev); p.prevBtn = raw; return; }
  if (p.state !== 'alive' || s.phase === 'won') { p.prevBtn = raw; return; }   // em `won` quem está de pé congela
  tickInv(p);
  const btn = applyDiseaseInput(s, p, raw);
  playerActions(s, p, btn, btn & ~p.prevBtn, p.prevBtn & ~btn, ev);
  pickup(s, p, ev);
  tickDisease(s, p, ev);
  checkHit(s, p, ev);
  p.prevBtn = btn;
}

/** Passo 4 da §3.4: objetos. */
export function tickObjects(s: RoundState, inputs: readonly number[], ev: GameEvent[]): void {
  tickBombs(s, ev);          // pavio, deslize, cadeia, explosões
  tickCells(s, ev);          // fim de chamas e queimas (revela itens)
  tickHeld(s);               // quem está na mão da luva acompanha quem segura
  tickFlyers(s, ev);
  tickPressure(s, ev);
  tickBadBombers(s, inputs, ev);
  MOUNTS.current.tick(s, ev);
}

export function step(s: RoundState, inputs: readonly number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'over') return ev;
  s.tick++;
  if (s.phase === 'intro') {
    if (s.tick <= INTRO_CLOCK_TICKS) tickClock(s, ev);
    for (const p of s.players) p.prevBtn = inputs[p.slot] ?? 0;
    if (s.tick >= INTRO_TICKS) { s.phase = 'play'; s.phaseT0 = s.tick; }
    return ev;
  }
  if (s.phase === 'timeUp') { tickEndPhases(s, ev); return ev; }
  if (s.phase === 'play') { tickClock(s, ev); if (s.phase !== 'play') return ev; }
  for (const p of s.players) playerTick(s, p, inputs[p.slot] ?? 0, ev);
  tickObjects(s, inputs, ev);
  STAGES[s.stage]?.tick?.(s, ev);
  contagion(s, ev);
  checkRoundEnd(s, ev);
  tickEndPhases(s, ev);
  return ev;
}
