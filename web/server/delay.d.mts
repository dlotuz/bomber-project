// Tipos de server/delay.mjs (para os testes em TypeScript).
export interface PeerRtt { slot: number; rtts?: number[] }
export const MIN_DELAY: number;
export const MAX_DELAY: number;
export const RTT_WINDOW: number;
export function rttOf(peer: PeerRtt): number | null;
export function delaysFor(peers: Iterable<PeerRtt>, fixed?: number | null): number[];
