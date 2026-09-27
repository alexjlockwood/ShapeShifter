import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { ActionCreators } from 'redux-undo';

import { createEditorStore } from '.';
import { BatchAction } from './batch/actions';
import { SetGuides } from './guides/actions';
import { getGuides } from './guides/selectors';
import { SetSelectedLayers, SetVectorLayer } from './layers/actions';
import { getHiddenLayerIds, getSelectedLayerIds, getVectorLayer } from './layers/selectors';
import { SetHoveredLayerId, SetZoomPanInfo } from './paper/actions';
import { getHoveredLayerId, getZoomPanInfo } from './paper/selectors';
import { SetCurrentTime, SetIsPlaying } from './playback/actions';
import { getCurrentTime } from './playback/selectors';
import { ResetWorkspace } from './reset/actions';
import { isBeingReset } from './reset/selectors';
import { SetTheme } from './theme/actions';
import { getThemeType } from './theme/selectors';
import { getAnimation } from './timeline/selectors';
import { IsolateUndoStep } from './undoredo/actions';

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
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['c'])));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['d'])));
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    store.dispatch(ActionCreators.redo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['d']));
  });

  it('does not record playback changes in the undo history', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(new SetCurrentTime(10));
    store.dispatch(new SetIsPlaying(true));
    expect(store.getState().past.length).toBe(numPastStates);
  });

  it('does not group changes with ones made before playback started', () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    // Playback dispatches the current time every frame.
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(100);
      store.dispatch(new SetCurrentTime(i));
    }
    store.dispatch(new SetSelectedLayers(new Set(['c'])));
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['b']));
  });

  it('does not record a batch of playback changes in the undo history', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(new BatchAction(new SetCurrentTime(10), new SetIsPlaying(true)));
    expect(getCurrentTime(store.getState())).toBe(10);
    expect(store.getState().past.length).toBe(numPastStates);
  });

  it('does not change the theme on undo or redo', () => {
    const store = createEditorStore();
    store.dispatch(new SetTheme('light'));
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetTheme('dark'));
    const numPastStates = store.getState().past.length;
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    expect(store.getState().past.length).toBe(numPastStates + 1);
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    expect(getThemeType(store.getState()).themeType).toBe('dark');
    store.dispatch(new SetTheme('light'));
    store.dispatch(ActionCreators.redo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['b']));
    expect(getThemeType(store.getState()).themeType).toBe('light');
  });

  it('does not record paper slice changes in the undo history', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(new SetHoveredLayerId('a'));
    store.dispatch(new BatchAction(new SetHoveredLayerId('b')));
    expect(getHoveredLayerId(store.getState())).toBe('b');
    expect(store.getState().past.length).toBe(numPastStates);
  });

  it('keeps the canvas view on undo and redo, and clears the paper state about the document', () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    const zoomPanInfo = { zoom: 2, translation: { tx: 10, ty: 20 } };
    store.dispatch(new SetZoomPanInfo(zoomPanInfo));
    store.dispatch(new SetHoveredLayerId('b'));
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    expect(getZoomPanInfo(store.getState())).toEqual(zoomPanInfo);
    expect(getHoveredLayerId(store.getState())).toBeUndefined();
    store.dispatch(new SetHoveredLayerId('a'));
    store.dispatch(ActionCreators.redo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['b']));
    expect(getZoomPanInfo(store.getState())).toEqual(zoomPanInfo);
    expect(getHoveredLayerId(store.getState())).toBeUndefined();
  });

  it('gives loading a project an undo step of its own', () => {
    const store = createEditorStore();
    const vl = getVectorLayer(store.getState());
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(300);
    const loadedVl = new VectorLayer();
    store.dispatch(new ResetWorkspace(loadedVl));
    vi.advanceTimersByTime(300);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    store.dispatch(ActionCreators.undo());
    expect(getVectorLayer(store.getState())).toBe(loadedVl);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set());
    store.dispatch(ActionCreators.undo());
    expect(getVectorLayer(store.getState())).toBe(vl);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
  });

  it('gives a batch with IsolateUndoStep an undo step of its own', () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(100);
    // E.g. the end of a drag on the canvas.
    const editedVl = new VectorLayer();
    store.dispatch(new BatchAction(new IsolateUndoStep(), new SetVectorLayer(editedVl)));
    vi.advanceTimersByTime(100);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));

    store.dispatch(ActionCreators.undo());
    expect(getVectorLayer(store.getState())).toBe(editedVl);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
    store.dispatch(ActionCreators.undo());
    expect(getVectorLayer(store.getState())).not.toBe(editedVl);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
  });

  it("doesn't count an undo or redo that does nothing as an edit", () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(new SetSelectedLayers(new Set(['a'])));
    vi.advanceTimersByTime(800);
    // There's nothing to redo.
    store.dispatch(ActionCreators.redo());
    vi.advanceTimersByTime(700);
    store.dispatch(new SetSelectedLayers(new Set(['b'])));
    store.dispatch(ActionCreators.undo());
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['a']));
  });

  it('records a batch of actions as one undo step', () => {
    const store = createEditorStore();
    const numPastStates = store.getState().past.length;
    store.dispatch(new BatchAction(new SetSelectedLayers(new Set(['a'])), new SetCurrentTime(10)));
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

  it('loads the guides with a project, and starts a new one without any', () => {
    const store = createEditorStore();
    const guides = [{ id: 'g', axis: 'x' as const, value: 4 }];
    store.dispatch(new ResetWorkspace(new VectorLayer(), new Animation(), new Set(), guides));
    expect(getGuides(store.getState())).toBe(guides);
    store.dispatch(new ResetWorkspace());
    expect(getGuides(store.getState())).toEqual([]);
  });

  it('undoes changes to the guides', () => {
    const store = createEditorStore();
    vi.advanceTimersByTime(2000);
    store.dispatch(
      new BatchAction(new IsolateUndoStep(), new SetGuides([{ id: 'g', axis: 'y', value: 1 }])),
    );
    store.dispatch(ActionCreators.undo());
    expect(getGuides(store.getState())).toEqual([]);
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
