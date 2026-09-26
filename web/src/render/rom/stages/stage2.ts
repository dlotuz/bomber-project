import { registerRomLayer } from '../../battle-layers';
import { st2 } from '../../../core/stages/stage2';

// Relógios translúcidos do BG1 andando pelo HOFS (o plano 7 cuida do color math 'half' e dos tiles animados).
registerRomLayer({ id: 'stage2', draw(s, b) { if (s.stage !== 2) return; b.bg1Scroll(st2(s).hofs); } });
