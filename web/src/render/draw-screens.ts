import type { Session } from '../game/session';
import { SCOREBOARD_FRAMES, SKIP_AFTER } from '../game/session';
import type { SpriteBank } from './sprite-bank';
import { roundOverText, type ViewState } from './view';
import { displayName } from '../game/config';
import { drawRound, drawTextCentered, SCREEN_W, SCREEN_H } from './draw-game';

function drawScoreboard(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank): void {
  ctx.fillStyle = '#12305a';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#0b1f3d';
  ctx.fillRect(12, 34, SCREEN_W - 24, 168);
  drawTextCentered(ctx, bank, 'PLACAR', '#ffd23f', 8, 2);
  const age = SCOREBOARD_FRAMES - s.timer;
  let row = 0;
  s.round.players.forEach((p, i) => {
    if (!p.active) return;
    const y = 40 + row * 32;
    row++;
    ctx.drawImage(bank.head(s.cfg.chars[i]), 18, y + 4);
    ctx.drawImage(bank.text(displayName(s.cfg.names, i), '#ffffff'), 36, y + 6);
    for (let k = 0; k < s.match.rules.matches; k++) {
      const x = 92 + k * 31;
      ctx.fillStyle = '#050b18';
      ctx.fillRect(x, y, 28, 22);
      ctx.fillStyle = '#2a4a7a';
      ctx.fillRect(x + 1, y + 1, 26, 20);
      const won = k < s.match.crowns[i];
      const isNew = won && k === s.match.crowns[i] - 1 && s.lastWinners.includes(i);
      if (won && (!isNew || age > 40 || ((age >> 2) & 1) === 0)) ctx.drawImage(bank.crown(), x + 2, y + 3, 24, 16);
    }
  });
  drawTextCentered(ctx, bank, roundOverText(s.lastWinners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 208, 1);
}

function drawVictory(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank, frame: number): void {
  ctx.fillStyle = '#1d1030';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 3 ? '#ffd23f' : '#ffffff';
    ctx.fillRect((i * 97 + frame) % SCREEN_W, (i * 53) % SCREEN_H, 1, 1);
  }
  drawTextCentered(ctx, bank, 'VITÓRIA!', '#ffd23f', 14, 3);
  const champs = s.champions;
  const total = champs.length * 56;
  champs.forEach((slot, k) => {
    const x = Math.floor((SCREEN_W - total) / 2) + k * 56 + 4;
    const bounce = Math.abs(Math.round(Math.sin((frame + k * 10) / 8) * 6));
    ctx.drawImage(bank.bomber(s.cfg.chars[slot], 2, 0), x, 64 - bounce, 48, 60);
  });
  ctx.drawImage(bank.trophy(), (SCREEN_W - 48) / 2, 132, 48, 48);
  const rules = s.cfg.rules;
  const who = rules.mode === 'team'
    ? (rules.teams[champs[0]] === 0 ? 'TIME VERMELHO É O CAMPEÃO!' : 'TIME BRANCO É O CAMPEÃO!')
    : `${displayName(s.cfg.names, champs[0])} É O CAMPEÃO!`;
  drawTextCentered(ctx, bank, who, '#ffffff', 188, 1);
  if (s.timer > SKIP_AFTER && ((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#6ad0ff', 206, 1);
}

export function drawSession(ctx: CanvasRenderingContext2D, s: Session, view: ViewState, bank: SpriteBank, frame: number): void {
  switch (s.phase) {
    case 'battle':
    case 'roundOver':
      drawRound(ctx, s.round, view, bank, s.cfg.chars, frame, s.match.crowns);
      if (s.round.phase === 'intro') drawTextCentered(ctx, bank, s.round.introLeft > 30 ? 'PRONTOS?' : 'JÁ!', '#ffd23f', 100, 2);
      if (s.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 24, SCREEN_W, SCREEN_H - 24);
        if (s.confirmQuit) {
          drawTextCentered(ctx, bank, 'SAIR DA PARTIDA?', '#ffffff', 84, 2);
          drawTextCentered(ctx, bank, 'SAIR DA PARTIDA?', '#ffffff', 108, 2);
          drawTextCentered(ctx, bank, 'A: SIM   B: NÃO', '#6ad0ff', 136, 1);
        } else {
          drawTextCentered(ctx, bank, 'PAUSA', '#ffffff', 96, 2);
          drawTextCentered(ctx, bank, 'START: CONTINUAR   B: SAIR', '#6ad0ff', 124, 1);
        }
      }
      if (s.phase === 'roundOver') {
        drawTextCentered(ctx, bank, roundOverText(s.round.winners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 100, 2);
      }
      break;
    case 'scoreboard':
      drawScoreboard(ctx, s, bank);
      break;
    case 'victory':
      drawVictory(ctx, s, bank, frame);
      break;
  }
}
