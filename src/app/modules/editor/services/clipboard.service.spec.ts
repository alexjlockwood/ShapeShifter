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
});
