import { ActionSource } from 'app/modules/editor/model/actionmode';
import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';

import { CanvasLayers } from './CanvasLayers';

describe('CanvasLayers', () => {
  let store: Store<State>;
  let canvas: HTMLCanvasElement;
  let canvasLayers: CanvasLayers;

  beforeEach(() => {
    store = createEditorStore();
    canvas = document.createElement('canvas');
    canvasLayers = new CanvasLayers(canvas, ActionSource.Animated, store);
    canvasLayers.init();
  });

  afterEach(() => {
    canvasLayers.dispose();
  });

  it('draws the fill before the stroke, so the stroke covers the fill', () => {
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 4 4 L 20 4 L 20 20 L 4 20 Z'),
      // Opaque stroke over a translucent fill: if the fill is drawn on top of the stroke
      // (as if by mistake), it blends into the inner half of the stroke and lightens it.
      strokeColor: '#0000ff',
      strokeAlpha: 1,
      strokeWidth: 4,
      fillColor: '#ffffff',
      fillAlpha: 0.5,
    });
    const vl = new VectorLayer({ name: 'vector', children: [layer], width: 24, height: 24 });
    store.dispatch(new ResetWorkspace(vl, new Animation()));

    // (12, 5) sits in the inner half of the top edge's stroke (which spans y = 2..6), so it
    // should show the pure, opaque stroke color rather than a blend with the fill.
    const { data } = canvas.getContext('2d')!.getImageData(12, 5, 1, 1);
    expect([data[0], data[1], data[2]]).toEqual([0, 0, 255]);
  });
});
