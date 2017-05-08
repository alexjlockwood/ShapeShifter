import { Animation } from '../animations';
import { VectorLayer } from '../layers';
import { Action } from '@ngrx/store';

export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const ADD_VECTOR_LAYERS = 'ADD_VECTOR_LAYERS';
export const TOGGLE_LAYER_ID_SELECTION = 'TOGGLE_LAYER_ID_SELECTION';

type Actions =
  AddAnimations
  | AddVectorLayers
  | ToggleLayerIdSelection;

export class AddAnimations implements Action {
  readonly type: 'ADD_ANIMATIONS' = ADD_ANIMATIONS;
  constructor(public readonly payload: ReadonlyArray<Animation>) { }
}

export class AddVectorLayers implements Action {
  readonly type: 'ADD_VECTOR_LAYERS' = ADD_VECTOR_LAYERS;
  constructor(public readonly payload: ReadonlyArray<VectorLayer>) { }
}

export class ToggleLayerIdSelection implements Action {
  readonly type: 'TOGGLE_LAYER_ID_SELECTION' = TOGGLE_LAYER_ID_SELECTION;
  constructor(
    public readonly payload: { layerId: string, clearExistingSelections?: boolean },
  ) { }
}
