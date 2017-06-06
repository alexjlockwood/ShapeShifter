import { VectorLayer } from '../../scripts/layers';
import { Animation } from '../../scripts/timeline';
import { Action } from '@ngrx/store';

export const RESET_WORKSPACE = '__reset__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
  readonly payload: {
    vectorLayer?: VectorLayer,
    animations?: ReadonlyArray<Animation>,
  };
  constructor(
    vectorLayer?: VectorLayer,
    animations?: ReadonlyArray<Animation>,
  ) {
    this.payload = { vectorLayer, animations };
  }
}

export type Actions = ResetWorkspace;
