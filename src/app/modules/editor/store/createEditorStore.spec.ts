import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { ActionCreators } from 'redux-undo';

import { createEditorStore } from '.';
import { BatchAction } from './batch/actions';
import { SetSelectedLayers, SetVectorLayer } from './layers/actions';
import { getHiddenLayerIds, getSelectedLayerIds, getVectorLayer } from './layers/selectors';
import { SetCurrentTime, SetIsPlaying } from './playback/actions';
import { getCurrentTime } from './playback/selectors';
import { ResetWorkspace } from './reset/actions';
import { isBeingReset } from './reset/selectors';
import { getAnimation } from './timeline/selectors';

describe('createEditorStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts class instance actions', () => {
    const store = createEditorStore();
    const vl = new VectorLayer();
    store.dispatch(new SetVectorLayer(vl));
    expect(getVectorLayer(store.getState())).toBe(vl);
  });

  it('emits the selected value on subscribe and then only when it changes', () => {
    const store = createEditorStore();
    const values: number[] = [];
    store.select(getCurrentTime).subscribe(time => values.push(time));
    store.dispatch(new SetCurrentTime(10));
    store.dispatch(new SetIsPlaying(true));
    store.dispatch(new SetCurrentTime(20));
    expect(values).toEqual([0, 10, 20]);
  });

  it('groups changes made less than a second apart into one undo step', () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['c'])));
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    store.dispatch(ActionCreators.redo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['c']));
  });

  it('does not record playback changes in the undo history', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(new SetCurrentTime(10));
    store.dispatch(new SetIsPlaying(true));
    expect(store.getState().past.length).toBe(numPastStates);
  });

  it('records a batch of actions as one undo step', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(
      new BatchAction(new SetSelectedLayers(new Set(['a'])), new SetCurrentTime(10)),
    );
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    expect(getCurrentTime(store.getState())).toBe(10);
    expect(store.getState().past.length).toBe(numPastStates + 1);
  });

  it('resets the workspace', () => {
    const store = createEditorStore();
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    const vl = new VectorLayer();
    const animation = new Animation();
    const hiddenLayerIds = new Set(['b']);
    store.dispatch(new ResetWorkspace(vl, animation, hiddenLayerIds));
    expect(getVectorLayer(store.getState())).toBe(vl);
    expect(getAnimation(store.getState())).toBe(animation);
    expect(getHiddenLayerIds(store.getState())).toEqual(hiddenLayerIds);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set());
    expect(isBeingReset(store.getState())).toBe(true);
    store.dispatch(new SetCurrentTime(10));
    expect(isBeingReset(store.getState())).toBe(false);
  });

  it('notifies every subscriber of a state before handling actions they dispatch', () => {
    const store = createEditorStore();
    store.select(isBeingReset).subscribe(reset => {
      if (reset) {
        store.dispatch(new SetCurrentTime(10));
      }
    });
    const values: boolean[] = [];
    store.select(isBeingReset).subscribe(reset => values.push(reset));
    store.dispatch(new ResetWorkspace());
    expect(values).toEqual([false, true, false]);
    expect(getCurrentTime(store.getState())).toBe(10);
  });

  it('freezes the state in dev builds', () => {
    const store = createEditorStore();
    const { playback } = store.getState().present;
    expect(() => {
      (playback as { currentTime: number }).currentTime = 10;
    }).toThrow(TypeError);
  });
});
