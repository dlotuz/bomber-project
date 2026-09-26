// RomAssets: decodifica sob demanda e guarda em cache (spec §2.3).
import type { Anim, ArenaAssets, AudioRomSlices, CharacterAssets, RomAssets, SceneAssets, SceneId } from './types';
import { RomView } from './view';
import { decodeZte } from './decode/zte';
import { decodeAnim } from './decode/anim';
import { decodeBombScript } from './decode/bombscript';
import { loadArena } from './assets-arena';
import { loadCharacter, hudHeadBuffer } from './assets-char';
import { loadScene, loadMode7Draw, audioSlices } from './assets-scene';

export const BOMB_SCRIPTS = 0xc156a8;     // 7 × ptr24, indexado pelo tipo da bomba [ANI §5.1]

function memo<K, V>(m: Map<K, V>, k: K, make: () => V): V {
  let v = m.get(k);
  if (v === undefined) { v = make(); m.set(k, v); }
  return v;
}

export function createRomAssets(bytes: Uint8Array): RomAssets {
  const rom = new RomView(bytes);
  const ztes = new Map<number, Uint8Array>(), arenas = new Map<number, ArenaAssets>(), chars = new Map<number, CharacterAssets>();
  const anims = new Map<number, Anim>(), scenes = new Map<SceneId, SceneAssets>();
  const bombScripts = new Map<number, { word: number; dur: number }[]>();
  let heads: Uint8Array | null = null, m7: { chr: Uint8Array; map: Uint8Array } | null = null, audio: AudioRomSlices | null = null;
  const zte = (a: number) => memo(ztes, a, () => decodeZte(bytes, a).data);
  const anim = (a: number) => memo(anims, a, () => decodeAnim(rom, a));
  return {
    rom,
    arena: s => memo(arenas, s, () => loadArena(rom, s)),
    character: c => memo(chars, c, () => loadCharacter(rom, c, () => (heads ??= hudHeadBuffer(rom)))),
    anim,
    playerAnim: (tab1, c, dirIdx) => anim(rom.p24(rom.p24(tab1 + 3 * c) + 3 * dirIdx)),
    bombScript: t => {
      if (!(t >= 0 && t <= 6)) throw new RangeError(`tipo de bomba inválido: ${t}`);
      return memo(bombScripts, t, () => decodeBombScript(rom, rom.p24(BOMB_SCRIPTS + 3 * t)).frames);
    },
    scene: id => memo(scenes, id, () => loadScene(rom, id, zte)),
    mode7Draw: () => (m7 ??= loadMode7Draw(rom)),
    audioData: () => (audio ??= audioSlices(rom)),
  };
}
