import { newMatch, startRound, finishRoundInfo, createAi, matchRngState, type MatchState, type RoundState, type AiState, type MatchCarry } from './core-api';
import type { GameConfig } from './config';

export interface MatchSession {
  cfg: GameConfig; match: MatchState; round: RoundState | null; ai: AiState;
  roundNo: number; lastWinners: number[]; champions: number[]; over: boolean;
}

/** Estado que atravessa partidas na sessão do navegador: RNG (§3.2) e prêmio da Corrida Bônus (§3.14). */
export const carry: MatchCarry = { seed: null, racerPrize: null };
export function resetCarry(): void { carry.seed = null; carry.racerPrize = null; }

export function createMatchSession(cfg: GameConfig): MatchSession {
  const seed = cfg.seed ?? carry.seed ?? 0x0012;
  const prize = cfg.rules.racer && cfg.rules.mode === 'ffa' ? carry.racerPrize : null;
  return { cfg, match: newMatch(cfg.rules, cfg.stage, seed, prize, cfg.chars), round: null, ai: createAi(),
    roundNo: 0, lastWinners: [], champions: [], over: false };
}
export function beginRound(ms: MatchSession): RoundState {
  ms.round = startRound(ms.match);
  ms.ai = createAi();
  ms.roundNo++;
  return ms.round;
}
/** Cue do 1º frame do preto depois do `over`: soma a coroa (§6.10) e decide o fim da partida. */
export function endRound(ms: MatchSession): void {
  if (!ms.round) return;
  const info = finishRoundInfo(ms.match, ms.round);
  ms.lastWinners = info.winners;
  ms.over = info.matchOver;
  ms.champions = info.champions;
}
/** Fim da partida (botão da VITÓRIA ou saída pela pausa): o RNG segue para a próxima. */
export function closeMatch(ms: MatchSession): void {
  carry.seed = matchRngState(ms.match);
  carry.racerPrize = null;
}
