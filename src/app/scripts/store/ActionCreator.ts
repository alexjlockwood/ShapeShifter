import { ADD_ANIMATIONS, ADD_VECTOR_LAYERS } from './Reducers';
import { Animation } from '../animations';
import { VectorLayer } from '../layers';

export function addAnimations(...animations: Animation[]) {
  return { type: ADD_ANIMATIONS, payload: animations };
}

export function addVectorLayers(...vectorLayers: VectorLayer[]) {
  return { type: ADD_VECTOR_LAYERS, payload: vectorLayers };
}
