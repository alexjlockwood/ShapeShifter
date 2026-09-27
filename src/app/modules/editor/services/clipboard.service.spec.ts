import { ActionMode } from 'app/modules/editor/model/actionmode';
import { PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { createEditorStore } from 'app/modules/editor/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEditorServices, type EditorServices } from './createEditorServices';

describe('ClipboardService', () => {
  let services: EditorServices;

  beforeEach(() => {
    services = createEditorServices(createEditorStore({ logActions: false }));
    services.clipboardService.init();
  });

  afterEach(() => {
    services.dispose();
    vi.restoreAllMocks();
  });

  function paste(text: string) {
    const event = new Event('paste', { cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    window.dispatchEvent(event);
  }

  function enterActionMode() {
    const { layerTimelineService, actionModeService } = services;
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 4 4 L 20 20'),
    });
    layerTimelineService.addLayer(layer);
    layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName: 'pathData',
        fromValue: new Path('M 4 4 L 20 20'),
        toValue: new Path('M 4 20 L 20 4'),
        currentTime: 0,
      },
    ]);
    actionModeService.setActionMode(ActionMode.Selection);
  }

  describe('in action mode', () => {
    it("explains that SVGs can't be imported", () => {
      enterActionMode();
      const show = vi.spyOn(services.snackBarService, 'show');
      const numLayers = services.layerTimelineService.getVectorLayer().children.length;
      paste('<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 1 1"/></svg>');
      expect(show).toHaveBeenCalledWith(
        "Can't import while editing a path morph",
        'Dismiss',
        expect.anything(),
      );
      expect(services.layerTimelineService.getVectorLayer().children).toHaveLength(numLayers);
    });

    it('ignores text that nothing could be imported from', () => {
      enterActionMode();
      const show = vi.spyOn(services.snackBarService, 'show');
      paste('some plain text');
      expect(show).not.toHaveBeenCalled();
    });
  });

  describe('pasting a VectorDrawable', () => {
    const VECTOR_DRAWABLE = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
        android:width="24dp" android:height="24dp"
        android:viewportWidth="24" android:viewportHeight="24">
      <path android:name="triangle" android:fillColor="#000000"
          android:pathData="M 14 14 L 22 14 L 18 22 Z"/>
    </vector>`;

    it('offers to morph the path that was there into it', () => {
      const { layerTimelineService, snackBarService, actionModeService } = services;
      const square = new PathLayer({
        name: 'square',
        children: [],
        pathData: new Path('M 2 2 L 10 2 L 10 10 L 2 10 Z'),
        fillColor: '#000000',
      });
      layerTimelineService.addLayer(square);
      paste(VECTOR_DRAWABLE);
      expect(layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual([
        'square',
        'triangle',
      ]);
      const snackBar = snackBarService.getSnackBar();
      expect(snackBar?.message).toBe("Morph 'square' into the imported shape?");
      snackBarService.clickAction(snackBar!);
      expect(layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual(['square']);
      expect(actionModeService.isActionMode()).toBe(true);
    });

    it("doesn't offer it into an empty document", () => {
      paste(VECTOR_DRAWABLE);
      expect(services.layerTimelineService.getVectorLayer().children).toHaveLength(1);
      expect(services.snackBarService.getSnackBar()).toBeUndefined();
    });
  });

  describe('pasting blocks', () => {
    function addLayer(name: string) {
      const layer = new PathLayer({ name, children: [], pathData: new Path('M 4 4 L 20 20') });
      services.layerTimelineService.addLayer(layer);
      return layer;
    }

    function copy() {
      let text = '';
      const event = new Event('copy', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: { setData: (_: string, data: string) => (text = data) },
      });
      window.dispatchEvent(event);
      return text;
    }

    function getBlocks() {
      return services.layerTimelineService.getAnimation().blocks;
    }

    function copyStrokeWidthBlock(layerName: string) {
      const layer = addLayer(layerName);
      services.layerTimelineService.addBlocks([
        {
          layerId: layer.id,
          propertyName: 'strokeWidth',
          fromValue: 1,
          toValue: 2,
          currentTime: 0,
        },
      ]);
      return copy();
    }

    // Layer ids restart on every page load, so they can name a different layer in another tab.
    function inAnotherTab(copied: string, layerId: string) {
      const json = JSON.parse(copied);
      json.pageId = 'another tab';
      json.blocks[0].layerId = layerId;
      return JSON.stringify(json);
    }

    it('pastes onto the layer with the same name in another tab', () => {
      const copied = copyStrokeWidthBlock('path');
      const other = addLayer('other');
      paste(inAnotherTab(copied, other.id));
      const blocks = getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[1].layerId).toBe(blocks[0].layerId);
    });

    it('selects the pasted blocks', () => {
      paste(copyStrokeWidthBlock('path'));
      const blocks = getBlocks();
      expect(blocks).toHaveLength(2);
      expect(services.layerTimelineService.getSelectedBlocks()).toEqual([blocks[1]]);
    });

    it('keeps a custom interpolator', () => {
      const layer = addLayer('path');
      const curve = 'M 0 0 C 0.2 0 0 1.4 0.5 1.2 C 0.8 1 0.9 1 1 1';
      services.layerTimelineService.addBlocks([
        {
          layerId: layer.id,
          propertyName: 'strokeWidth',
          fromValue: 1,
          toValue: 2,
          currentTime: 0,
        },
      ]);
      const block = getBlocks()[0].clone();
      block.interpolator = curve;
      services.layerTimelineService.updateBlocks([block]);
      services.layerTimelineService.selectBlock(block.id, true);
      paste(copy());
      const blocks = getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[1].interpolator).toBe(curve);
    });

    it("doesn't paste onto a layer that only has the same id in another tab", () => {
      const copied = copyStrokeWidthBlock('path');
      const other = addLayer('other');
      services.layerTimelineService.updateLayer(
        Object.assign(services.layerTimelineService.getVectorLayer().children[0].clone(), {
          name: 'renamed',
        }),
      );
      const show = vi.spyOn(services.snackBarService, 'show');
      paste(inAnotherTab(copied, other.id));
      expect(getBlocks()).toHaveLength(1);
      expect(show).toHaveBeenCalledWith(
        "Couldn't find the layers to paste onto",
        'Dismiss',
        expect.anything(),
      );
    });

    it('pastes onto the same layer on the same page, even after renaming it', () => {
      const copied = copyStrokeWidthBlock('path');
      const [layer] = services.layerTimelineService.getVectorLayer().children;
      services.layerTimelineService.updateLayer(Object.assign(layer.clone(), { name: 'renamed' }));
      paste(copied);
      const blocks = getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[1].layerId).toBe(layer.id);
    });

    // Reported to Bugsnag as uncaught TypeErrors.
    it('ignores malformed blocks', () => {
      addLayer('path');
      // Errors thrown by event listeners are reported to the window, not to dispatchEvent.
      const errors: unknown[] = [];
      const onError = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      try {
        paste('{"blocks": {"a": 1}}');
        paste('{"blocks": [null, {"type": "unknown"}]}');
      } finally {
        window.removeEventListener('error', onError);
      }
      expect(errors).toEqual([]);
      expect(getBlocks()).toHaveLength(0);
    });
  });
});
