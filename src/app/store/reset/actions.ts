import { Action } from '@ngrx/store';
import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';

export const RESET_WORKSPACE = '__reset__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
  readonly payload: {
    vectorLayer?: VectorLayer;
    animation?: Animation;
    hiddenLayerIds?: Set<string>;
  };
  constructor(vectorLayer?: VectorLayer, animation?: Animation, hiddenLayerIds?: Set<string>) {
    this.payload = { vectorLayer, animation, hiddenLayerIds };
  }
}

export type Actions = ResetWorkspace;
