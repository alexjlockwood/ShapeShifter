import { createSelector } from 'reselect';
import { VectorLayer } from '../../layers';
import * as vectorLayer from '../actions/VectorLayer';

export interface State {
  vectorLayers: ReadonlyArray<VectorLayer>,
};

export const initialState: State = {
  vectorLayers: [],
};

export function reducer(state = initialState, action: vectorLayer.Actions): State {
  switch (action.type) {
    case vectorLayer.ADD_VECTOR_LAYERS:
      return {
        vectorLayers: state.vectorLayers.concat(...action.payload),
      };
    default: {
      return state;
    }
  }
}

export const getVectorLayers = (state: State) => state.vectorLayers;

