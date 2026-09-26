import type { App, Screen } from '../app/app';
import type { MatchSession } from '../game/match-session';
export function drawScreen(_app: App, _ms: MatchSession): Screen { return { id: 'draw', update() {}, draw() {} }; }
