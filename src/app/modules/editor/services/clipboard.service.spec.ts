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
