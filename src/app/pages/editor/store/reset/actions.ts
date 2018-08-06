import { VectorLayer } from 'app/pages/editor/model/layers';
import { Animation } from 'app/pages/editor/model/timeline';
import { Action } from 'app/pages/editor/store';

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
