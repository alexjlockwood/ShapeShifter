import { Action } from '@ngrx/store';
import { VectorLayer } from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';

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
