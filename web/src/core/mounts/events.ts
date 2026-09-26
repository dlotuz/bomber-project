export type MountEventId =
  | 'egg_revealed' | 'mount_start' | 'mount_ready' | 'egg_reserved' | 'mount_lost' | 'mount_ability' | 'mount_struck';

/** Evento de montaria = variante { type: 'mount' } do GameEvent do plano 6, com dados extras. */
export interface MountEvent {
  type: 'mount'; id: MountEventId; slot?: number; cell?: number;
  mount?: number;                                  // tipo da montaria (2, 3, $A, ...)
  target?: number;                                 // mount_struck: slot atingido
  reserve?: boolean; cause?: 'hit' | 'launch' | 'stun';   // mount_lost
}

export function mev(e: Omit<MountEvent, 'type'>): MountEvent {
  return { type: 'mount', ...e };
}

/** SFX por evento de montaria (plano 11 consome). null = sem som medido (spec §12 A8). */
export const MOUNT_SFX: Readonly<Record<MountEventId, number | null>> = {
  egg_revealed: null, mount_start: null, mount_ready: null, egg_reserved: null,
  mount_lost: null, mount_ability: null, mount_struck: null,
};
