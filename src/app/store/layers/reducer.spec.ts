import { SelectLayer } from './actions';
import { buildInitialState, reducer } from './reducer';

describe('@ngrx/store timeline', () => {
  it('select a layer', () => {
    const state = reducer(undefined, new SelectLayer('id1', false));
    expect(state.selectedLayerIds).toEqual(new Set(['id1']));
  });

  it('select multiple layers and clear existing selections', () => {
    let state = reducer(undefined, new SelectLayer('id1', false));
    state = reducer(state, new SelectLayer('id2', false));
    state = reducer(state, new SelectLayer('id3', false));
    expect(state.selectedLayerIds).toEqual(new Set(['id1', 'id2', 'id3']));
    state = reducer(state, new SelectLayer('id4', true));
    expect(state.selectedLayerIds).toEqual(new Set(['id4']));
  });
});
