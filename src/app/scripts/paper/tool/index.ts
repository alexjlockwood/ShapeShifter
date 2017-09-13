import { PaperService } from 'app/services';

import { MasterTool } from './MasterTool';
import { ZoomPanTool } from './ZoomPanTool';

/** Factory function for creating a new master tool. */
export function newMasterTool(ps: PaperService) {
  return new MasterTool(ps);
}

/** Factory function for creating a new zoom pan tool. */
export function newZoomPanTool(ps: PaperService) {
  return new ZoomPanTool(ps);
}

export { Tool } from './Tool';
