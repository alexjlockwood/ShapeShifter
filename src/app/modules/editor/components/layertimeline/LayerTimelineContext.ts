import { createContext, use } from 'react';

import type { LayerTimelineController } from './LayerTimelineController';

export const LayerTimelineContext = createContext<LayerTimelineController | undefined>(undefined);

/** Returns the controller that handles events from the layer list and timeline rows. */
export function useLayerTimelineController() {
  return use(LayerTimelineContext);
}
