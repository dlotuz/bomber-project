import { registerRomLayer } from '../../battle-layers';
registerRomLayer({ id: 'stage3', draw(s) { if (s.stage !== 3) return; } });
