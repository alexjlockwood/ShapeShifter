import { ActionMode, ActionSource, SelectionType } from 'app/modules/editor/model/actionmode';
import { PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { ActionCreators } from 'redux-undo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasOverlay } from './CanvasOverlay';

// An open, stroked square, which action mode splits by segment.
const PATH = 'M 4 4 L 20 4 L 20 20 L 4 20';

describe('CanvasOverlay', () => {
  let store: Store<State>;
  let services: EditorServices;
  let overlay: CanvasOverlay;

  beforeEach(() => {
    // Edits less than a second apart are undone together.
    vi.useFakeTimers();
    store = createEditorStore({ logActions: false });
    services = createEditorServices(store);
    const { actionModeService, layerTimelineService } = services;
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path(PATH),
      strokeColor: '#000',
    });
    layerTimelineService.addLayer(layer);
    layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName: 'pathData',
        fromValue: new Path(PATH),
        toValue: new Path(PATH),
        currentTime: 0,
      },
    ]);
    actionModeService.setActionMode(ActionMode.Selection);
    overlay = new CanvasOverlay(
      document.createElement('canvas'),
      ActionSource.From,
      store,
      actionModeService,
      layerTimelineService,
    );
    overlay.init();
    // Ten CSS pixels per viewport unit, so that hits snap like they do in the app. The detached
    // canvas is at (0, 0).
    overlay.setDimensions({ w: 240, h: 240 }, { w: 24, h: 24 });
    vi.advanceTimersByTime(2000);
  });

  afterEach(() => {
    overlay.dispose();
    services.dispose();
    vi.useRealTimers();
  });

  function getNumCommands() {
    const [block] = services.layerTimelineService.getSelectedBlocks() as PathAnimationBlock[];
    return block.fromValue?.getCommands().length;
  }

  // Takes viewport coordinates.
  function mouseEvent(x: number, y: number) {
    return new MouseEvent('mousemove', { clientX: x * 10, clientY: y * 10 });
  }

  // Reported to Bugsnag as "Command index out of bounds" and "Subpath index out of bounds".
  it('forgets the hovered segment when undo removes it', () => {
    services.actionModeService.setActionMode(ActionMode.SplitCommands);
    // Add a point to the top segment, then hover over the bottom one, which is now the fifth
    // command.
    overlay.onMouseDown(mouseEvent(12, 4));
    overlay.onMouseMove(mouseEvent(12, 20));
    expect(getNumCommands()).toBe(5);
    vi.advanceTimersByTime(2000);

    store.dispatch(ActionCreators.undo());
    expect(getNumCommands()).toBe(4);

    expect(() => overlay.draw()).not.toThrow();
  });

  it('ignores selections of commands that no longer exist', () => {
    services.actionModeService.setSelections([
      { type: SelectionType.Segment, source: ActionSource.From, subIdx: 0, cmdIdx: 9 },
      { type: SelectionType.Point, source: ActionSource.From, subIdx: 3, cmdIdx: 0 },
    ]);
    expect(() => overlay.draw()).not.toThrow();
  });
});
