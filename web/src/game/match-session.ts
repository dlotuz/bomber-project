import { newMatch, devMountHumans, startRound, finishRoundInfo, createAi, matchRngState, type MatchState, type RoundState, type AiState, type MatchCarry } from './core-api';
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
  const match = newMatch(cfg.rules, cfg.stage, seed, prize, cfg.chars);
  // Spawns aleatórios: semente própria do navegador (o RNG do jogo começa sempre em $0012 ao abrir a página, e a
  // ordem sairia igual a cada recarga). Com ?seed= na URL fica determinística, para reproduzir partidas.
  if (cfg.seed === null) match.spawnSeed = (Math.random() * 0x100000000) >>> 0;
  return { cfg, match, round: null, ai: createAi(),
    roundNo: 0, lastWinners: [], champions: [], over: false };
}
export function beginRound(ms: MatchSession): RoundState {
  ms.round = startRound(ms.match);
  if (ms.cfg.devMount) devMountHumans(ms.round, ms.cfg.devMount, ms.cfg.humans);
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
