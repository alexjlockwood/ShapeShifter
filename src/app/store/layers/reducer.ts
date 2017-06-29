import { GroupLayer, Layer, LayerUtil, VectorLayer } from 'app/scripts/model/layers';
import * as _ from 'lodash';

import * as actions from './actions';

export interface State {
  readonly vectorLayer: VectorLayer;
  readonly selectedLayerIds: Set<string>;
  readonly collapsedLayerIds: Set<string>;
  readonly hiddenLayerIds: Set<string>;
}

export function buildInitialState() {
  return {
    vectorLayer: new VectorLayer(),
    selectedLayerIds: new Set<string>(),
    collapsedLayerIds: new Set<string>(),
    hiddenLayerIds: new Set<string>(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    // Replace a layer.
    case actions.REPLACE_LAYER: {
      const replacementLayer = action.payload.layer;
      const vectorLayer = LayerUtil.replaceLayerInTree(state.vectorLayer, replacementLayer);
      return { ...state, vectorLayer };
    }

    // Group/ungroup selected layers.
    case actions.GROUP_OR_UNGROUP_SELECTED_LAYERS: {
      const { shouldGroup } = action.payload;
      return groupOrUngroupSelectedLayers(state, shouldGroup);
    }

    // Delete all selected layers.
    case actions.DELETE_SELECTED_MODELS: {
      return deleteSelectedLayers(state);
    }

    case actions.ADD_BLOCK: {
      return { ...state, selectedLayerIds: new Set<string>() };
    }

    case actions.SET_SELECTED_LAYERS: {
      return { ...state, selectedLayerIds: new Set<string>(action.payload.layerIds) };
    }

    case actions.SET_HIDDEN_LAYERS: {
      return { ...state, hiddenLayerIds: new Set<string>(action.payload.layerIds) };
    }

    case actions.SET_COLLAPSED_LAYERS: {
      return { ...state, collapsedLayerIds: new Set<string>(action.payload.layerIds) };
    }
  }
  return state;
}

function deleteSelectedLayers(state: State) {
  let { vectorLayer } = state;
  const collapsedLayerIds = new Set(state.collapsedLayerIds);
  const hiddenLayerIds = new Set(state.hiddenLayerIds);
  if (state.selectedLayerIds.has(vectorLayer.id)) {
    vectorLayer = new VectorLayer();
    collapsedLayerIds.clear();
    hiddenLayerIds.clear();
  } else {
    state.selectedLayerIds.forEach(layerId => {
      vectorLayer = LayerUtil.removeLayersFromTree(vectorLayer, layerId);
      collapsedLayerIds.delete(layerId);
      hiddenLayerIds.delete(layerId);
    });
  }
  return {
    ...state,
    vectorLayer,
    selectedLayerIds: new Set<string>(),
    collapsedLayerIds,
    hiddenLayerIds,
  };
}

function groupOrUngroupSelectedLayers(state: State, shouldGroup: boolean) {
  let { vectorLayer, selectedLayerIds } = state;
  if (!selectedLayerIds.size) {
    return state;
  }
  // Sort selected layers by order they appear in tree.
  let tempSelLayers = Array.from(selectedLayerIds).map(id => vectorLayer.findLayerById(id));
  const selLayerOrdersMap = new Map<string, number>();
  let n = 0;
  vectorLayer.walk(layer => {
    if (_.find(tempSelLayers, l => l.id === layer.id)) {
      selLayerOrdersMap.set(layer.id, n);
      n++;
    }
  });
  tempSelLayers.sort((a, b) => selLayerOrdersMap.get(a.id) - selLayerOrdersMap.get(b.id));

  if (shouldGroup) {
    // Remove any layers that are descendants of other selected layers,
    // and remove the vectorLayer itself if selected.
    tempSelLayers = tempSelLayers.filter(layer => {
      if (layer instanceof VectorLayer) {
        return false;
      }
      let p = LayerUtil.findParent(vectorLayer, layer.id);
      while (p) {
        if (_.find(tempSelLayers, l => l.id === p.id)) {
          return false;
        }
        p = LayerUtil.findParent(vectorLayer, p.id);
      }
      return true;
    });

    if (!tempSelLayers.length) {
      return state;
    }

    // Find destination parent and insertion point.
    const firstSelectedLayerParent = LayerUtil.findParent(vectorLayer, tempSelLayers[0].id).clone();
    const firstSelectedLayerIndexInParent = _.findIndex(
      firstSelectedLayerParent.children,
      l => l.id === tempSelLayers[0].id,
    );

    // Remove all selected items from their parents and move them into a new parent.
    const newGroup = new GroupLayer({
      name: LayerUtil.getUniqueLayerName([vectorLayer], 'group'),
      children: tempSelLayers,
    });
    const parentChildren = firstSelectedLayerParent.children.slice();
    parentChildren.splice(firstSelectedLayerIndexInParent, 0, newGroup);
    _.remove(parentChildren, child =>
      _.find(tempSelLayers, selectedLayer => selectedLayer.id === child.id),
    );
    firstSelectedLayerParent.children = parentChildren;
    vectorLayer = LayerUtil.replaceLayerInTree(vectorLayer, firstSelectedLayerParent);
    selectedLayerIds = new Set([newGroup.id]);
  } else {
    // Ungroup selected groups layers.
    const newSelectedLayers: Layer[] = [];
    tempSelLayers.filter(layer => layer instanceof GroupLayer).forEach(groupLayer => {
      // Move children into parent.
      const parent = LayerUtil.findParent(vectorLayer, groupLayer.id).clone();
      const indexInParent = Math.max(0, _.findIndex(parent.children, l => l.id === groupLayer.id));
      const newChildren = parent.children.slice();
      newChildren.splice(indexInParent, 0, ...groupLayer.children);
      parent.children = newChildren;
      vectorLayer = LayerUtil.replaceLayerInTree(vectorLayer, parent);
      newSelectedLayers.splice(0, 0, ...groupLayer.children);
      // Delete the parent.
      vectorLayer = LayerUtil.removeLayersFromTree(vectorLayer, groupLayer.id);
    });
    selectedLayerIds = new Set(newSelectedLayers.map(l => l.id));
  }
  return { ...state, vectorLayer, selectedLayerIds };
}
