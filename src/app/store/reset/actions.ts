import { Action } from 'app/store/ngrx';

import { VectorLayer } from '../../model/layers';
import { Animation } from '../../model/timeline';

export enum ResetActionTypes {
  ResetWorkspace = '__reset__RESET_WORKSPACE',
}

export class ResetWorkspace implements Action {
  readonly type = ResetActionTypes.ResetWorkspace;
  readonly payload: {
    vectorLayer?: VectorLayer;
    animation?: Animation;
    hiddenLayerIds?: ReadonlySet<string>;
  };
  constructor(
    vectorLayer?: VectorLayer,
    animation?: Animation,
    hiddenLayerIds?: ReadonlySet<string>,
  ) {
    this.payload = { vectorLayer, animation, hiddenLayerIds };
  }
}

export type ResetActions = ResetWorkspace;
