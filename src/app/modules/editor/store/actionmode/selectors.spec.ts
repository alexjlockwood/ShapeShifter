import {
  ActionMode,
  ActionSource,
  HoverType,
  type Selection,
  SelectionType,
} from 'app/modules/editor/model/actionmode';
import { PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getActionModeHover, getActionModeSelections, getToolbarState } from './selectors';

describe('action mode selectors', () => {
  let store: Store<State>;
  let services: EditorServices;

  beforeEach(() => {
    store = createEditorStore({ logActions: false });
    services = createEditorServices(store);
    const layer = new PathLayer({ name: 'path', children: [], pathData: new Path('M 0 0 L 1 1') });
    services.layerTimelineService.addLayer(layer);
    services.layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName: 'pathData',
        fromValue: new Path('M 0 0 L 10 0 L 10 10'),
        toValue: new Path('M 0 0 L 10 10'),
        currentTime: 0,
      },
    ]);
    services.actionModeService.setActionMode(ActionMode.Selection);
  });

  afterEach(() => services.dispose());

  // The toolbar and the canvases crashed on these with "Command index out of bounds" and
  // "Subpath index out of bounds".
  it('drops selections of subpaths and commands the paths no longer have', () => {
    const valid: Selection = {
      type: SelectionType.Point,
      source: ActionSource.From,
      subIdx: 0,
      cmdIdx: 2,
    };
    services.actionModeService.setSelections([
      valid,
      // The path animated to has only two commands.
      { type: SelectionType.Point, source: ActionSource.To, subIdx: 0, cmdIdx: 2 },
      { type: SelectionType.SubPath, source: ActionSource.From, subIdx: 1 },
    ]);
    expect(getActionModeSelections(store.getState())).toEqual([valid]);
    expect(getToolbarState(store.getState()).selections).toEqual([valid]);
  });

  it('drops hovers over commands the paths no longer have', () => {
    services.actionModeService.setHover({
      type: HoverType.Split,
      source: ActionSource.To,
      subIdx: 0,
      cmdIdx: 5,
    });
    expect(getActionModeHover(store.getState())).toBeUndefined();

    const hover = { type: HoverType.Split, source: ActionSource.To, subIdx: 0, cmdIdx: 1 };
    services.actionModeService.setHover(hover);
    expect(getActionModeHover(store.getState())).toEqual(hover);
  });
});
