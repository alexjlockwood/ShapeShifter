import { Action } from '@ngrx/store';
import { VectorLayer } from '../../layers';

export const ADD_VECTOR_LAYERS = 'ADD_VECTOR_LAYERS';

export class AddVectorLayers implements Action {
  readonly type = ADD_VECTOR_LAYERS;
  constructor(public readonly payload: ReadonlyArray<VectorLayer>) { }
}

export type Actions = AddVectorLayers;
