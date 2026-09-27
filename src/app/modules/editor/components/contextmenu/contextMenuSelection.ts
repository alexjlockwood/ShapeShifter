import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';

/**
 * Returns the layers to select before opening the context menu on a layer, or undefined to keep
 * the selection. As with a press of the select tool, a layer that's selected, or that's in a
 * selected group, keeps the selection, so that the menu acts on all of it. Another layer is
 * selected on its own. A right-click on nothing keeps the selection too. The vector layer doesn't
 * count as a group, since it's in the way of selecting what's in it. In the layer list, where
 * each row is one layer, a row in a selected group selects just it (inGroups: false).
 */
export function getContextMenuSelection(
  vl: VectorLayer,
  layerId: string | undefined,
  selectedLayerIds: ReadonlySet<string>,
  { inGroups = true } = {},
): ReadonlySet<string> | undefined {
  if (!layerId || !vl.findLayerById(layerId) || selectedLayerIds.has(layerId)) {
    return undefined;
  }
  if (inGroups) {
    for (let parent = LayerUtil.findParent(vl, layerId); parent && parent.id !== vl.id;) {
      if (selectedLayerIds.has(parent.id)) {
        return undefined;
      }
      parent = LayerUtil.findParent(vl, parent.id);
    }
  }
  return new Set([layerId]);
}
