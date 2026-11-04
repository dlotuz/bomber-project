// Botão do CLIPE (Opções > Clipe): uma tecla e um botão de controle, lidos no próprio aparelho (fora do lockstep e
// das entradas do núcleo). O aviso de conflito só olha as ações que valem na batalha: L, R e SELECT não fazem nada
// nela (o SELECT só sai da pausa junto com o START), por isso o SELECT do controle é o padrão.
import { KEY_FIELDS, type DeviceId, type KeyMap, type PadMap } from '../input/input';

export const CLIP_SECONDS = [15, 30] as const;
export type ClipSeconds = (typeof CLIP_SECONDS)[number];
export const DEFAULT_CLIP_KEY = 'F8';
/** SELECT no layout "standard" da Gamepad API. */
export const DEFAULT_CLIP_PAD = 8;

/** Ações que contam como "botão de jogo" no aviso de conflito. */
const BATTLE: readonly (keyof KeyMap)[] = KEY_FIELDS.filter(f => f !== 'l' && f !== 'r' && f !== 'select');

/** Tecla que pode salvar o clipe: as F são livres (o jogo não as usa), menos F5 (recarrega), F11 (tela cheia) e F12
 *  (ferramentas); Esc cancela a captura; Tab e as teclas do sistema ficam com o navegador. */
export function clipKeyAllowed(code: string): boolean {
  if (!code || code === 'F5' || code === 'F11' || code === 'F12') return false;
  return !(code === 'Escape' || code === 'Tab' || /^(Meta|OS)(Left|Right)$/.test(code) || code === 'ContextMenu' || code === 'PrintScreen');
}

/** Quem também usa o botão: o jogador (1–5) ou o controle da sala online, e a ação. */
export interface ClipConflict { who: number | 'online'; action: keyof KeyMap }

interface BindingSource {
  devices: readonly DeviceId[]; keymaps: readonly KeyMap[]; padmaps: readonly PadMap[];
  online: { device: DeviceId; keymap: KeyMap; padmap: PadMap };
}

/** A tecla é de jogo para alguém no teclado (um dos 5 jogadores ou o controle online)? */
export function clipKeyConflict(s: BindingSource, code: string): ClipConflict | null {
  if (!code) return null;
  for (let i = 0; i < 5; i++) {
    if (s.devices[i] !== 'kb') continue;
    const action = BATTLE.find(f => s.keymaps[i]?.[f] === code);
    if (action) return { who: i + 1, action };
  }
  const action = s.online.device === 'kb' ? BATTLE.find(f => s.online.keymap[f] === code) : undefined;
  return action ? { who: 'online', action } : null;
}

/** O botão é de jogo no mapa de alguém que joga num controle? (o do clipe vale em qualquer controle) */
export function clipPadConflict(s: BindingSource, button: number): ClipConflict | null {
  if (button < 0) return null;
  for (let i = 0; i < 5; i++) {
    if (!s.devices[i]?.startsWith('gp')) continue;
    const action = BATTLE.find(f => s.padmaps[i]?.[f] === button);
    if (action) return { who: i + 1, action };
  }
  const action = s.online.device.startsWith('gp') ? BATTLE.find(f => s.online.padmap[f] === button) : undefined;
  return action ? { who: 'online', action } : null;
}
