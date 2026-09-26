// Cenas do VS e do modo (A14, CAT `vsmode`/`ffa`): moldura de corda + quebra-cabeça pela geometria genérica de
// `menuMaps` (T5) — sem copiar mapa, os números batem com `tests/screens/scene.test.ts` (medidos nas capturas).
import { menuMaps, type MenuRect, type SceneMaps } from './scene';

/** Molduras medidas nas capturas `vsmode`/`ffa` [MNT §B.2–B.3]. */
export const VS_FRAME: MenuRect = { x0: 7, y0: 51, x1: 248, y1: 186 };
export const MODE_FRAME: MenuRect = { x0: 7, y0: 67, x1: 248, y1: 170 };
/** x-span do título nas duas cenas (mesmo valor nas duas capturas). */
export const VS_TITLE_SPAN = { x0: 64, x1: 190 };

export const vsSceneMaps = (): SceneMaps => menuMaps(VS_FRAME, 'vsmode', VS_TITLE_SPAN);
export const modeSceneMaps = (): SceneMaps => menuMaps(MODE_FRAME, 'ffa', VS_TITLE_SPAN);
