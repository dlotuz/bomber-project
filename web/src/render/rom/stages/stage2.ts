import { registerRomLayer } from '../../battle-layers';
registerRomLayer({ id: 'stage2', draw(s) { if (s.stage !== 2) return; } });
