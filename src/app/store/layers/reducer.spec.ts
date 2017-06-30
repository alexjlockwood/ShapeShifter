// import { GroupLayer, PathLayer, VectorLayer } from 'app/model/layers';

// import { SelectLayer, ToggleLayerExpansion, ToggleLayerVisibility } from './actions';
// import { buildInitialState, reducer } from './reducer';

// describe('@ngrx/store timeline', () => {
//   it('select a layer', () => {
//     const state = reducer(undefined, new SelectLayer('id1', false));
//     expect(state.selectedLayerIds).toEqual(new Set(['id1']));
//   });

//   it('select multiple layers and clear existing selections', () => {
//     let state = reducer(undefined, new SelectLayer('id1', false));
//     state = reducer(state, new SelectLayer('id2', false));
//     state = reducer(state, new SelectLayer('id3', false));
//     expect(state.selectedLayerIds).toEqual(new Set(['id1', 'id2', 'id3']));
//     state = reducer(state, new SelectLayer('id4', true));
//     expect(state.selectedLayerIds).toEqual(new Set(['id4']));
//   });

//   it('toggle layer expansion', () => {
//     const path1 = new PathLayer({ id: 'path1', name: 'path', children: [], pathData: undefined });
//     const path2 = new PathLayer({ id: 'path2', name: 'path', children: [], pathData: undefined });
//     const group = new GroupLayer({ id: 'group', name: 'group', children: [path1, path2] });
//     const vectorLayer = new VectorLayer({ id: 'vector', name: 'vector', children: [group] });
//     const initialState = { ...buildInitialState(), vectorLayer };
//     let state = reducer(initialState, new ToggleLayerExpansion('vector', false));
//     expect(state.collapsedLayerIds).toEqual(new Set(['vector']));
//     state = reducer(state, new ToggleLayerExpansion('vector', false));
//     expect(state.collapsedLayerIds).toEqual(new Set());
//     state = reducer(state, new ToggleLayerExpansion('vector', true));
//     expect(state.collapsedLayerIds).toEqual(new Set(['vector', 'group', 'path1', 'path2']));
//     state = reducer(state, new ToggleLayerExpansion('vector', false));
//     expect(state.collapsedLayerIds).toEqual(new Set(['group', 'path1', 'path2']));
//   });

//   it('toggle layer visibility', () => {
//     let state = reducer(undefined, new ToggleLayerVisibility('id1'));
//     state = reducer(state, new ToggleLayerVisibility('id2'));
//     expect(state.hiddenLayerIds).toEqual(new Set(['id1', 'id2']));
//     state = reducer(state, new ToggleLayerVisibility('id1'));
//     expect(state.hiddenLayerIds).toEqual(new Set(['id2']));
//     state = reducer(state, new ToggleLayerVisibility('id2'));
//     expect(state.hiddenLayerIds).toEqual(new Set());
//   });
// });
