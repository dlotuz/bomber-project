import { BTN } from '../core';
import type { App, Screen } from '../app/app';
import { NAME_CHARS, NAME_MAX, defaultSettings, sanitizeName } from '../app/settings';
import { DEVICE_IDS, KEY_FIELDS, keyLabel, type DeviceId, type KeyMap } from '../input/input';
import { MenuList, cycle, type MenuItem } from './menu';
import { COLORS, ROW_H, drawFooter, drawMenuPage, menuPanelRect } from './ui';
import { titleScreen } from './title';

export const DEVICE_LABEL: Record<DeviceId, string> = {
  kb0: 'TECLADO 1', kb1: 'TECLADO 2', gp0: 'CONTROLE 1', gp1: 'CONTROLE 2', gp2: 'CONTROLE 3', gp3: 'CONTROLE 4', none: 'NENHUM',
};

/** CONFIGURAÇÕES: qual dispositivo controla cada jogador, nomes, teclas e restaurar padrão. */
export function settingsScreen(app: App): Screen {
  const st = app.settings;
  // Um dispositivo (que não 'none') atribuído a mais de um jogador é um erro de configuração comum
  // (dois jogadores compartilhando sem querer o mesmo teclado/controle): fica em vermelho para chamar atenção.
  const isDuplicate = (i: number) => st.devices[i] !== 'none' && st.devices.filter(d => d === st.devices[i]).length > 1;
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `JOGADOR ${i + 1}`, value: () => DEVICE_LABEL[st.devices[i]],
    valueColor: () => (isDuplicate(i) ? COLORS.error : COLORS.value),
    left: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], -1); app.save(); },
    right: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], 1); app.save(); },
  }));
  items.push(
    { label: 'NOMES DOS JOGADORES', select: () => app.go(namesScreen(app)) },
    { label: 'TECLAS DO TECLADO 1', select: () => app.go(remapScreen(app, 0)) },
    { label: 'TECLAS DO TECLADO 2', select: () => app.go(remapScreen(app, 1)) },
    {
      label: 'RESTAURAR PADRÃO', select: () => {
        const d = defaultSettings();
        st.devices = d.devices; st.keymaps = d.keymaps; st.names = d.names;
        app.applyKeymaps(); app.save();
      },
    },
    { label: 'VOLTAR', select: () => app.go(titleScreen(app)) },
  );
  const list = new MenuList(items);
  return {
    id: 'settings',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(titleScreen(app)); },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'CONFIGURAÇÕES', list, 224, 14);
      drawFooter(ctx, bank, 'ESQ/DIR: TROCAR O CONTROLE');
    },
  };
}

/** Nomes dos jogadores, editados letra a letra (funciona com teclado e com controle). */
export function namesScreen(app: App): Screen & { readonly editing: number } {
  const st = app.settings;
  let editing = -1;
  let pos = 0;
  let buf: string[] = [];
  const letters = [...NAME_CHARS];
  const commit = () => { st.names[editing] = sanitizeName(buf.join('')); app.save(); editing = -1; };
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `JOGADOR ${i + 1}`,
    value: () => (editing === i ? '' : st.names[i] || '---'),
    select: () => { editing = i; pos = 0; buf = st.names[i].padEnd(NAME_MAX, ' ').split(''); },
  }));
  items.push({ label: 'VOLTAR', select: () => app.go(settingsScreen(app)) });
  const list = new MenuList(items);
  return {
    id: 'names',
    get editing() { return editing; },
    update(inp) {
      const p = inp.pressedAny;
      if (editing < 0) {
        if (list.handle(p) === 'back') app.go(settingsScreen(app));
        return;
      }
      if (p & BTN.UP) buf[pos] = cycle(letters, buf[pos], 1);
      if (p & BTN.DOWN) buf[pos] = cycle(letters, buf[pos], -1);
      if (p & BTN.RIGHT) pos = Math.min(NAME_MAX - 1, pos + 1);
      if (p & BTN.LEFT) pos = Math.max(0, pos - 1);
      if (p & BTN.START) commit();
      else if (p & BTN.A) { if (pos < NAME_MAX - 1) pos++; else commit(); }
      else if (p & BTN.B) editing = -1;
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'NOMES', list, 200);
      if (editing >= 0) {
        // mesma geometria de drawMenuPage (painel de 200 px)
        const r = menuPanelRect(list.items.length, 200);
        const y = r.y + 7 + editing * ROW_H;
        const x0 = r.x + 16 + (r.w - 26) - NAME_MAX * 6;
        buf.forEach((ch, k) => {
          const img = bank.text(ch === ' ' ? '.' : ch, k === pos ? COLORS.title : COLORS.value);
          if (!(k === pos && ((frame >> 3) & 1))) ctx.drawImage(img, x0 + k * 6, y);
        });
        drawFooter(ctx, bank, 'CIMA/BAIXO: LETRA  A: PRÓXIMA  START: OK');
      } else {
        drawFooter(ctx, bank, 'A: EDITAR   B: VOLTAR');
      }
    },
  };
}

const ACTION_LABEL: Record<keyof KeyMap, string> = {
  up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA', a: 'A (BOMBA)', b: 'B', y: 'Y (SOCO)', x: 'X',
  l: 'L', r: 'R', start: 'START', select: 'SELECT',
};

/** Remapeia as teclas de um dos dois conjuntos de teclado: A na ação e depois a nova tecla (ESC cancela). */
export function remapScreen(app: App, k: 0 | 1): Screen & { readonly capturing: keyof KeyMap | null } {
  const map = app.settings.keymaps[k];
  let capturing: keyof KeyMap | null = null;
  // Depois de capturar uma tecla (ou cancelar com Escape), ignora tudo até soltar todos os botões:
  // sem isso, uma tecla recém-remapeada que ainda está pressionada aparece como "recém-apertada" no
  // próximo tick (o mapeamento mudou, então a borda é nova) e sai da tela ou reabre a captura sozinha.
  let suppress = false;
  const items: MenuItem[] = KEY_FIELDS.map(f => ({
    label: ACTION_LABEL[f],
    value: () => (capturing === f ? '...' : keyLabel(map[f])),
    select: () => { capturing = f; },
  }));
  items.push({ label: 'VOLTAR', select: () => app.go(settingsScreen(app)) });
  const list = new MenuList(items);
  return {
    id: 'remap',
    get capturing() { return capturing; },
    update(inp) {
      if (suppress) {
        if (inp.any === 0) suppress = false;
        return;
      }
      if (capturing) {
        if (inp.key) {
          if (inp.key !== 'Escape') { map[capturing] = inp.key; app.applyKeymaps(); app.save(); }
          capturing = null;
          suppress = true;
        }
        return;
      }
      if (list.handle(inp.pressedAny) === 'back') app.go(settingsScreen(app));
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, `TECLADO ${k + 1}`, list, 200);
      drawFooter(ctx, bank, capturing ? 'APERTE A NOVA TECLA (ESC CANCELA)' : 'A: MUDAR TECLA   B: VOLTAR', capturing ? COLORS.title : COLORS.dim);
    },
  };
}
