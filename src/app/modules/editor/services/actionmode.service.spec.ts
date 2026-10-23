import { ActionMode, ActionSource, SelectionType } from 'app/modules/editor/model/actionmode';
import { PathLayer } from 'app/modules/editor/model/layers';
import { ToolbarData } from 'app/modules/editor/components/toolbar/ToolbarData';
import { Path } from 'app/modules/editor/model/paths';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { createEditorStore } from 'app/modules/editor/store';
import { createEditorServices } from './createEditorServices';

describe('ActionModeService', () => {
  let services: ReturnType<typeof createEditorServices>;

  beforeEach(() => {
    services = createEditorServices(createEditorStore());
  });

  afterEach(() => {
    services.dispose();
  });

  it('deletes a selected split filled subpath', () => {
    const { actionModeService, layerTimelineService } = services;
    const splitPath = new Path('M 0 0 L 10 0 L 10 10 L 0 10 Z')
      .mutate()
      .splitFilledSubPath(0, 1, 3)
      .build();
    const layer = new PathLayer({
      name: 'synthetic',
      children: [],
      pathData: splitPath,
      fillColor: '#FF000000',
    });

    layerTimelineService.addLayer(layer);
    layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName: 'pathData',
        fromValue: splitPath,
        toValue: undefined,
        currentTime: 0,
      },
    ]);
    actionModeService.setActionMode(ActionMode.Selection);
    actionModeService.setSelections([
      { type: SelectionType.SubPath, source: ActionSource.From, subIdx: 0 },
    ]);

    expect(splitPath.getSubPath(0).isSplit()).toBe(false);
    expect(splitPath.getSubPath(0).isUnsplittable()).toBe(true);
    expect(
      new ToolbarData(
        ActionMode.Selection,
        layer,
        undefined,
        actionModeService.getSelections(),
      ).getNumSplitSubPaths(),
    ).toBe(1);

    actionModeService.deleteSelectedActionModeModels();

    const block = layerTimelineService.getSelectedBlocks()[0] as PathAnimationBlock;
    expect(block.fromValue?.getSubPaths()).toHaveLength(1);
  });

  it('deletes a selected split stroked subpath', () => {
    const { actionModeService, layerTimelineService } = services;
    const splitPath = new Path('M 0 0 L 10 0 L 10 10').mutate().splitStrokedSubPath(0, 1).build();
    const layer = new PathLayer({
      name: 'synthetic',
      children: [],
      pathData: splitPath,
      strokeColor: '#FF000000',
      strokeWidth: 1,
    });
    layer.inspectableProperties.get('fillColor')?.setEditableValue(layer, 'fillColor', 'none');

    layerTimelineService.addLayer(layer);
    layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName: 'pathData',
        fromValue: splitPath,
        toValue: undefined,
        currentTime: 0,
      },
    ]);
    actionModeService.setActionMode(ActionMode.Selection);
    actionModeService.setSelections([
      { type: SelectionType.SubPath, source: ActionSource.From, subIdx: 0 },
    ]);

    expect(layer.isFilled()).toBe(false);
    expect(layer.isStroked()).toBe(true);
    expect(splitPath.getSubPath(0).isSplit()).toBe(false);
    expect(splitPath.getSubPath(0).isUnsplittable()).toBe(true);

    actionModeService.deleteSelectedActionModeModels();

    const block = layerTimelineService.getSelectedBlocks()[0] as PathAnimationBlock;
    expect(block.fromValue?.getSubPaths()).toHaveLength(1);
  });
});
