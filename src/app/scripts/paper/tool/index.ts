import { PaperService } from 'app/services';

import { MasterTool } from './MasterTool';
import { Tool } from './Tool';
import { ZoomPanTool } from './ZoomPanTool';

export { Tool } from './Tool';

/** Factory function for creating a new master tool. */
export function newMasterTool(ps: PaperService): Tool {
  return new MasterTool(ps);
}

/** Factory function for creating a new zoom pan tool. */
export function newZoomPanTool(ps: PaperService): Tool {
  return new ZoomPanTool(ps);
}
