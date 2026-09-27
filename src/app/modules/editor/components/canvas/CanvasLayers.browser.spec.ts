import { ActionSource } from 'app/modules/editor/model/actionmode';
import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { getContext2d } from 'app/modules/editor/scripts/dom';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { FileExportService } from 'app/modules/editor/services/fileexport.service';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { SetVectorLayer } from 'app/modules/editor/store/layers/actions';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { describe, expect, it } from 'vitest';

import { CanvasCamera } from './CanvasCamera';
import { CanvasLayers } from './CanvasLayers';
import { CanvasPreview } from './CanvasPreview';

const demos = import.meta.glob('/public/demos/*.shapeshifter', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function render(store: Store<State>, camera: CanvasCamera) {
  const canvas = document.createElement('canvas');
  const canvasLayers = new CanvasLayers(canvas, ActionSource.Animated, store);
  canvasLayers.init();
  canvasLayers.setCamera(camera);
  canvasLayers.dispose();
  return canvas.width && canvas.height
    ? getContext2d(canvas).getImageData(0, 0, canvas.width, canvas.height)
    : new ImageData(1, 1);
}

function getPixel(image: ImageData, x: number, y: number) {
  const i = (y * image.width + x) * 4;
  return Array.from(image.data.slice(i, i + 4));
}

describe('CanvasLayers', () => {
  // Reported to Bugsnag as "Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The
  // image argument is a canvas element with a width or height of 0."
  it('draws a translucent vector layer in a panel less than a pixel tall', () => {
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
    const camera = CanvasCamera.fit({
      panel: { w: 100, h: 0.4 },
      viewport: { w: 24, h: 12 },
      pixelRatio: 1,
    });
    expect(() => canvasLayers.setCamera(camera)).not.toThrow();
    expect(canvas.height).toBe(0);
    canvasLayers.dispose();
  });

  it('only draws on the artboard', () => {
    const store = createEditorStore({ logActions: false });
    // A square that's bigger than the viewport, on a background color.
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M -12 -12 L 36 -12 L 36 36 L -12 36 Z'),
      fillColor: '#000',
    });
    store.dispatch(
      new SetVectorLayer(
        new VectorLayer({
          name: 'vector',
          children: [path],
          width: 24,
          height: 24,
          alpha: 0.5,
          canvasColor: '#f00',
        }),
      ),
    );
    const camera = CanvasCamera.fit({
      panel: { w: 200, h: 100 },
      viewport: { w: 24, h: 24 },
      pixelRatio: 1,
    });
    const { x, y, w, h } = camera.getArtboardRect();
    const image = render(store, camera);
    expect(getPixel(image, x + w / 2, y + h / 2)[3]).toBeGreaterThan(0);
    for (const [px, py] of [
      [x - 1, y + h / 2],
      [x + w + 1, y + h / 2],
      [x + w / 2, y - 1],
      [x + w / 2, y + h + 1],
    ]) {
      expect(getPixel(image, px, py), `(${px}, ${py})`).toEqual([0, 0, 0, 0]);
    }
  });

  it('draws edits in progress', () => {
    const store = createEditorStore({ logActions: false });
    const services = createEditorServices(store);
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 4 0 L 4 4 Z'),
      fillColor: '#000',
    });
    services.layerTimelineService.setVectorLayer(
      new VectorLayer({ name: 'vector', children: [path], width: 24, height: 24 }),
    );
    const preview = new CanvasPreview(store, services.layerTimelineService);
    preview.init();
    const canvas = document.createElement('canvas');
    const canvasLayers = new CanvasLayers(canvas, ActionSource.Animated, store, preview);
    canvasLayers.init();
    canvasLayers.setCamera(
      CanvasCamera.fit({
        panel: { w: 240, h: 240 },
        viewport: { w: 24, h: 24 },
        pixelRatio: 1,
        margin: 0,
      }),
    );
    // (20, 20) in the viewport.
    const isDrawn = () => getContext2d(canvas).getImageData(200, 200, 1, 1).data[3] > 0;
    expect(isDrawn()).toBe(false);

    preview.begin();
    preview.setPath(path.id, new Path('M 0 0 L 24 0 L 24 24 L 0 24 Z'));
    expect(isDrawn()).toBe(true);
    preview.cancel();
    expect(isDrawn()).toBe(false);

    canvasLayers.dispose();
    preview.dispose();
    services.dispose();
  });

  // The canvas used to be the size of the artboard. It now covers the panel, and has to draw the
  // same pixels on the artboard.
  describe.each(Object.entries(demos))('%s', (_, json) => {
    it('draws the artboard like an artboard-sized canvas', () => {
      const store = createEditorStore({ logActions: false });
      const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(
        JSON.parse(json),
      );
      store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
      const viewport = { w: vectorLayer.width, h: vectorLayer.height };
      // A panel with a fractional size, like one of action mode's three.
      const camera = CanvasCamera.fit({ panel: { w: 433.33, h: 377.5 }, viewport, pixelRatio: 2 });
      const artboard = camera.getArtboardRect();
      const reference = CanvasCamera.fit({
        panel: { w: artboard.w, h: artboard.h },
        viewport,
        pixelRatio: 2,
        margin: 0,
      });
      const image = render(store, camera);
      const referenceImage = render(store, reference);
      const origin = camera.viewportToDevice({ x: 0, y: 0 });
      expect(Number.isInteger(origin.x) && Number.isInteger(origin.y)).toBe(true);

      let drawnPixels = 0;
      let differentPixels = 0;
      for (let y = 0; y < referenceImage.height; y++) {
        for (let x = 0; x < referenceImage.width; x++) {
          const expected = getPixel(referenceImage, x, y);
          const actual = getPixel(image, origin.x + x, origin.y + y);
          drawnPixels += expected[3] ? 1 : 0;
          differentPixels += expected.some((v, i) => Math.abs(v - actual[i]) > 8) ? 1 : 0;
        }
      }
      expect(drawnPixels).toBeGreaterThan(0);
      // Chrome antialiases the edges of some clip paths a little differently at different places
      // in a canvas, so a few pixels differ in visibilitystrike (0.2% of them). Drawing a device
      // pixel off changes 2 to 7% of them in each demo.
      expect(differentPixels / drawnPixels).toBeLessThan(0.005);
    });
  });
});
