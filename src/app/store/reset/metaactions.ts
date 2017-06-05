import { VectorLayer } from '../../scripts/layers';
import { Animation } from '../../scripts/timeline';
import { Action } from '@ngrx/store';

export const RESET_WORKSPACE = '__reset__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
  readonly payload: {
    vectorLayers?: ReadonlyArray<VectorLayer>,
    animations?: ReadonlyArray<Animation>,
  };
  constructor(
    vectorLayers?: ReadonlyArray<VectorLayer>,
    animations?: ReadonlyArray<Animation>,
  ) {
    this.payload = { vectorLayers, animations };
  }
}

export type Actions = ResetWorkspace;
