import { clipKeyAllowed, clipKeyConflict, clipPadConflict } from '../../src/clip/binding';
import { DEFAULT_PADMAP, type DeviceId } from '../../src/input/input';
import { defaultSettings } from '../../src/app/settings';

describe('botão do CLIPE', () => {
  it('teclas aceitas: F1–F12 (menos F5, F11 e F12, do navegador) e as comuns; nunca Esc, Tab nem as do sistema', () => {
    expect(['F8', 'F1', 'F10', 'KeyP', 'Digit0', 'Backquote'].every(clipKeyAllowed)).toBe(true);
    expect(['F5', 'F11', 'F12', 'Escape', 'Tab', 'MetaLeft', 'ContextMenu', 'PrintScreen', ''].some(clipKeyAllowed)).toBe(false);
  });
  it('padrão (F8 e SELECT do controle) não conflita com nenhum botão de jogo', () => {
    const s = defaultSettings();
    expect(clipKeyConflict(s, s.options.clipKey)).toBeNull();
    expect(clipPadConflict(s, s.options.clipPad)).toBeNull();
  });
  it('tecla de jogo de quem está no teclado: avisa a ação e o jogador (L, R e SELECT não contam: não fazem nada na batalha)', () => {
    const s = defaultSettings();   // DEV CONTROLES: P1–P3 no teclado
    expect(clipKeyConflict(s, s.keymaps[1].a)).toEqual({ who: 2, action: 'a' });
    expect(clipKeyConflict(s, s.keymaps[0].select)).toBeNull();
    s.devices[1] = 'none';
    expect(clipKeyConflict(s, s.keymaps[1].a)).toBeNull();   // P2 fora do teclado: a tecla dele não joga
    s.online.keymap.start = 'KeyZ';
    expect(clipKeyConflict(s, 'KeyZ')).toEqual({ who: 'online', action: 'start' });
  });
  it('botão do controle: conflita com o mapa de quem está num controle (ou com o controle online)', () => {
    const s = defaultSettings();   // P4 e P5 nos controles 2 e 1, mapa padrão
    expect(clipPadConflict(s, DEFAULT_PADMAP.a)).toEqual({ who: 4, action: 'a' });
    expect(clipPadConflict(s, -1)).toBeNull();
    s.devices = ['kb', 'kb', 'kb', 'none', 'none'] as DeviceId[];
    expect(clipPadConflict(s, DEFAULT_PADMAP.a)).toBeNull();
    s.online.device = 'gp0';
    expect(clipPadConflict(s, DEFAULT_PADMAP.start)).toEqual({ who: 'online', action: 'start' });
  });
});
