import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { Action } from 'app/store/ngrx';

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
