import { VectorLayer } from '../../scripts/model/layers';
import { Animation } from '../../scripts/model/timeline';
import { Action } from '@ngrx/store';

export const RESET_WORKSPACE = '__reset__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
  readonly payload: {
    vectorLayer?: VectorLayer,
    animations?: ReadonlyArray<Animation>,
    hiddenLayerIds?: Set<string>,
  };
  constructor(
    vectorLayer?: VectorLayer,
    animations?: ReadonlyArray<Animation>,
    hiddenLayerIds?: Set<string>,
  ) {
    this.payload = { vectorLayer, animations, hiddenLayerIds };
  }
}

export type Actions = ResetWorkspace;
