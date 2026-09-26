import { ActionSource } from 'app/modules/editor/model/actionmode';
import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { createEditorStore } from 'app/modules/editor/store';
import { SetVectorLayer } from 'app/modules/editor/store/layers/actions';
import { describe, expect, it } from 'vitest';

import { CanvasLayers } from './CanvasLayers';

describe('CanvasLayers', () => {
  // Reported to Bugsnag as "Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The
  // image argument is a canvas element with a width or height of 0."
  it('draws a translucent vector layer in a canvas less than a pixel tall', () => {
    const store = createEditorStore({ logActions: false });
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 24 12'),
      fillColor: '#000',
    });
    store.dispatch(
      new SetVectorLayer(
        new VectorLayer({ name: 'vector', children: [path], width: 24, height: 12, alpha: 0.5 }),
      ),
    );
    const canvas = document.createElement('canvas');
    const canvasLayers = new CanvasLayers(canvas, ActionSource.Animated, store);
    canvasLayers.init();
    expect(() => canvasLayers.setDimensions({ w: 1, h: 1 }, { w: 24, h: 12 })).not.toThrow();
    expect(canvas.height).toBe(0);
    canvasLayers.dispose();
  });
});
