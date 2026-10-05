// Controle da sala online: um perfil só dele (Settings.online), separado dos 5 jogadores locais.
import { DEFAULT_KEYMAPS, InputManager, type KeyTarget } from '../../src/input/input';
import { defaultSettings, normalizeSettings } from '../../src/app/settings';
import { BTN } from '../../src/game/core-api';

function keyboard(): KeyTarget & { press(code: string): void } {
  const fns: Record<string, EventListener[]> = {};
  return {
    addEventListener: (t, fn) => { (fns[t] ??= []).push(fn); },
    removeEventListener: () => {},
    press(code: string) { for (const fn of fns.keydown ?? []) fn({ code, preventDefault() {} } as unknown as Event); },
  };
}

describe('controle da sala online', () => {
  it('nasce igual ao jogador 1 no teclado e sobrevive a configurações antigas (sem o campo)', () => {
    const d = defaultSettings();
    expect(d.online).toEqual({ device: 'kb', keymap: DEFAULT_KEYMAPS[0], padmap: d.padmaps[0] });
    const { online, ...old } = d;
    void online;
    expect(normalizeSettings(JSON.parse(JSON.stringify(old))).online).toEqual(d.online);
  });
  it('é guardado e lido à parte: mexer nele não muda os controles locais', () => {
    const s = defaultSettings();
    s.online.keymap.up = 'ArrowUp'; s.online.device = 'gp1';
    const back = normalizeSettings(JSON.parse(JSON.stringify(s)));
    expect([back.online.keymap.up, back.online.device, back.keymaps[0].up, back.devices[0]]).toEqual(['ArrowUp', 'gp1', 'KeyW', 'kb']);
  });
  it('a entrada lê só o perfil pedido (o jogo local continua com as teclas dele)', () => {
    const kb = keyboard();
    const input = new InputManager(kb, DEFAULT_KEYMAPS, () => []);
    const online = { ...DEFAULT_KEYMAPS[0], up: 'KeyT' };
    kb.press('KeyT');
    expect(input.readProfile('kb', online, defaultSettings().padmaps[0])).toBe(BTN.UP);
    expect(input.poll(['kb', 'kb', 'none', 'none', 'none'])[0]).toBe(0);   // KeyT não é tecla do jogador 1 local
  });
});
