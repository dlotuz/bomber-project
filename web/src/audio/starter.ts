/**
 * Quando ligar o som (§6.1): no 1º gesto do usuário (tecla, ponteiro ou botão do controle) e de novo a cada
 * troca de ROM, se o som já estiver ligado ou ligando. Uma troca de ROM durante a criação não se perde: a
 * criação roda de novo quando a atual termina (M6). Todo gesto também pede `resume()` (o AudioContext pode
 * ter nascido suspenso, I3).
 */
export interface AudioStarterDeps {
  /** cria/troca o sink real (`startRealAudio` do plano 10); true = fábrica registrada */
  start(): Promise<boolean>;
  resume(): void;
  warn?(e: unknown): void;
}
export interface AudioStarter { gesture(): void; romChanged(): void; readonly on: boolean }

export function createAudioStarter(d: AudioStarterDeps): AudioStarter {
  let on = false, pending = false, again = false;
  const start = (): void => {
    if (pending) { again = true; return; }
    pending = true; again = false;
    d.start()
      .then(ok => { on = ok; }, e => { d.warn?.(e); })
      .finally(() => { pending = false; if (again) start(); });
  };
  return {
    gesture(): void { d.resume(); if (!on && !pending) start(); },
    romChanged(): void { if (on || pending) start(); },
    get on(): boolean { return on; },
  };
}
