import type { App, Screen } from '../app/app';
import type { SpriteBank } from '../render/sprite-bank';
import type { MatchSession } from '../game/match-session';
export function scoreboardScreen(_app: App, _ms: MatchSession): Screen { return { id: 'scoreboard', update() {}, draw() {} }; }
/** Desenha o placar com o relógio `s` deslocado `yOffset` px (a descida da vitória usa). */
export function drawScoreboard(_ctx: CanvasRenderingContext2D, _bank: SpriteBank, _ms: MatchSession, _s: number, _yOffset: number): void {}
