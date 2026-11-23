import { CODE, newMatch, devMountHumans, startRound, finishRoundInfo, createAi, matchRngState, type MatchState, type RoundState, type AiState, type MatchCarry, type Rules } from './core-api';
import type { DeviceId } from '../input/input';
import type { ExtraRules, GameConfig } from './config';
import { coreStage, stageSkin } from './stages';
import { setBattleStage } from '../render/stage-skin';

export interface MatchSession {
  cfg: GameConfig; match: MatchState; round: RoundState | null; ai: AiState;
  roundNo: number; lastWinners: number[]; champions: number[]; over: boolean;
  /** Fase escolhida na pausa (TROCAR MAPA): entra na próxima rodada; o placar segue. */
  nextStage: number | null;
  /** Regras mudadas na pausa que só valem da próxima rodada (JOGADORES: quem entra/sai; REGRAS: tempo, morte súbita,
   *  bomber mau): mexer nelas com a rodada em jogo mudaria o relógio e a pressão no meio dela. */
  nextRules: Partial<Pick<Rules, 'active' | 'timeIdx' | 'suddenDeath' | 'badBomber'>> | null;
}

/** Estado que atravessa partidas na sessão do navegador: RNG (§3.2) e prêmio da Corrida Bônus (§3.14). */
export const carry: MatchCarry = { seed: null, racerPrize: null };
export function resetCarry(): void { carry.seed = null; carry.racerPrize = null; }

/** Semente do RNG ao abrir a página. Com a do boot do cartucho ($0012) a 1ª partida saía sempre igual (mesmos blocos,
 *  itens e ovos); agora é sorteada a cada abertura. `?seed=N` fixa a semente, para reproduzir uma partida. */
export function sessionSeed(search: string, random: () => number = Math.random): number {
  const q = new URLSearchParams(search);
  if (q.has('seed')) return Number.parseInt(q.get('seed')!, 10) & 0xffff;
  return Math.floor(random() * 0x10000) & 0xffff;
}

export function createMatchSession(cfg: GameConfig): MatchSession {
  const seed = cfg.seed ?? carry.seed ?? 0x0012;
  const prize = cfg.rules.racer && cfg.rules.mode === 'ffa' ? carry.racerPrize : null;
  const match = newMatch(cfg.rules, coreStage(cfg.stage), seed, prize, cfg.chars);
  setBattleStage(stageSkin(cfg.stage));
  // Spawns aleatórios: semente própria do navegador (o RNG do jogo começa sempre em $0012 ao abrir a página, e a
  // ordem sairia igual a cada recarga). Com ?seed= na URL fica determinística, para reproduzir partidas.
  if (cfg.seed === null) match.spawnSeed = (Math.random() * 0x100000000) >>> 0;
  return { cfg, match, round: null, ai: createAi(),
    roundNo: 0, lastWinners: [], champions: [], over: false, nextStage: null, nextRules: null };
}
export function beginRound(ms: MatchSession): RoundState {
  if (ms.nextStage !== null) {
    ms.cfg.stage = ms.nextStage;
    ms.match.stage = coreStage(ms.nextStage);
    setBattleStage(stageSkin(ms.nextStage));
    ms.nextStage = null;
  }
  if (ms.nextRules) {
    for (const r of new Set([ms.cfg.rules, ms.match.rules])) {
      Object.assign(r, ms.nextRules);
      if (ms.nextRules.active) r.active = [...ms.nextRules.active];
    }
    ms.nextRules = null;
  }
  ms.round = startRound(ms.match);
  if (ms.cfg.devMount) devMountHumans(ms.round, ms.cfg.devMount, ms.cfg.humans);
  if (ms.cfg.devClear) ms.round.grid.forEach((v, c, g) => { if (v === CODE.SOFT) g[c] = CODE.FLOOR; });
  ms.ai = createAi();
  ms.roundNo++;
  return ms.round;
}
/** Mudança de jogabilidade/controles na pausa: vale na hora, na partida e na rodada em andamento (as regras da
 *  rodada podem ser o mesmo objeto da partida ou uma cópia; os três recebem). Spawns aleatórios valem da próxima rodada. */
export function applyLiveSettings(ms: MatchSession, randomSpawns: boolean, extras: ExtraRules, devices: readonly DeviceId[]): void {
  const live = { ...extras, randomSpawns };
  for (const r of new Set([ms.cfg.rules, ms.match.rules, ...(ms.round ? [ms.round.rules] : [])])) {
    Object.assign(r, live);
    if (extras.powerKey) r.powerKey = [...extras.powerKey];
  }
  ms.cfg.devices = [...devices];
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
