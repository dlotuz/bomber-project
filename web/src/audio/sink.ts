// Contrato do som (spec §2.5). O plano 11 implementa o AudioSink real; sem ROM ou antes do gesto do usuário, NoopSink.
export interface AudioSink {
  bank(id: 0x2f | 0x30): void; music(id: number): void; sfx(id: number): void;
  voice(id: number): void; stop(): void; fade(): void; tick(): void;   // tick = 1 vez por tick de jogo (fila de SFX)
}

export class NoopSink implements AudioSink {
  bank(_id: 0x2f | 0x30): void {}
  music(_id: number): void {}
  sfx(_id: number): void {}
  voice(_id: number): void {}
  stop(): void {}
  fade(): void {}
  tick(): void {}
}
