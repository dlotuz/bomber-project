import type { App, Screen } from '../app/app';
import type { MatchSession } from '../game/match-session';
export function victoryScreen(_app: App, _ms: MatchSession, _startS: number): Screen { return { id: 'victory', update() {}, draw() {} }; }
