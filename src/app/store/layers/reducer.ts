import * as actions from './actions';
import { ModelUtil } from 'app/scripts/common';
import {
  GroupLayer,
  Layer,
  LayerUtil,
  VectorLayer,
} from 'app/scripts/model/layers';
import * as _ from 'lodash';

export interface State {
  readonly vectorLayer: VectorLayer;
  readonly selectedLayerIds: Set<string>;
  readonly collapsedLayerIds: Set<string>;
  readonly hiddenLayerIds: Set<string>;
}

export function buildInitialState() {
  return {
    vectorLayer: new VectorLayer(),
    selectedLayerIds: new Set(),
    collapsedLayerIds: new Set(),
    hiddenLayerIds: new Set(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Import vector layers into the tree.
    case actions.IMPORT_VECTOR_LAYERS: {
      const importedVls = action.payload.vectorLayers.slice();
      if (!importedVls.length) {
        return state;
      }
      const { vectorLayer } = state;
      let vectorLayers = [vectorLayer];
      if (!vectorLayer.children.length) {
        // Simply replace the empty vector layer rather than merging with it.
        const vl = importedVls[0].clone();
        vl.name = vectorLayer.name;
        importedVls[0] = vl;
        vectorLayers = [];
      }
      const newVectorLayers = [...vectorLayers, ...importedVls];
      if (newVectorLayers.length === 1) {
        return { ...state, vectorLayer: newVectorLayers[0] };
      } else {
        return { ...state, vectorLayer: newVectorLayers.reduce(LayerUtil.mergeVectorLayers) };
      }
    }

    // Add a layer to the tree.
    case actions.ADD_LAYER: {
      // TODO: add the layer below the currently selected layer, if one exists
      const { layer } = action.payload;
      const vectorLayer = state.vectorLayer.clone();
      vectorLayer.children = vectorLayer.children.concat([layer]);
      return { ...state, vectorLayer };
    }

    // Expand/collapse a layer.
    case actions.TOGGLE_LAYER_EXPANSION: {
      const { layerId, recursive } = action.payload;
      const layerIds = new Set([layerId]);
      if (recursive) {
        const layer = state.vectorLayer.findLayerById(layerId);
        if (layer) {
          layer.walk(l => layerIds.add(l.id));
        }
      }
      const collapsedLayerIds = new Set(state.collapsedLayerIds);
      if (collapsedLayerIds.has(layerId)) {
        layerIds.forEach(id => collapsedLayerIds.delete(id));
      } else {
        layerIds.forEach(id => collapsedLayerIds.add(id));
      }
      return { ...state, collapsedLayerIds };
    }

    // Show/hide a layer.
    case actions.TOGGLE_LAYER_VISIBILITY: {
      const { layerId } = action.payload;
      const hiddenLayerIds = new Set(state.hiddenLayerIds);
      if (hiddenLayerIds.has(layerId)) {
        hiddenLayerIds.delete(layerId);
      } else {
        hiddenLayerIds.add(layerId);
      }
      return { ...state, hiddenLayerIds };
    }

    // Replace a layer.
    case actions.REPLACE_LAYER: {
      const replacementLayer = action.payload.layer;
      const vectorLayer = LayerUtil.replaceLayerInTree(state.vectorLayer, replacementLayer);
      return { ...state, vectorLayer };
    }

    // Select a layer.
    case actions.SELECT_LAYER: {
      const { layerId, clearExisting } = action.payload;
      return selectLayerId(state, layerId, clearExisting);
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

    case actions.CLEAR_LAYER_SELECTIONS:
    case actions.SELECT_ANIMATION:
    case actions.SELECT_BLOCK:
    case actions.ADD_BLOCK: {
      return { ...state, selectedLayerIds: new Set() };
    }
  }
  return state;
}

function selectLayerId(
  state: State,
  layerId: string,
  clearExisting: boolean,
) {
  const selectedLayerIds = new Set(state.selectedLayerIds);
  if (clearExisting) {
    selectedLayerIds.forEach(id => {
      if (id !== layerId) {
        selectedLayerIds.delete(id);
      }
    });
  }
  if (!clearExisting && selectedLayerIds.has(layerId)) {
    selectedLayerIds.delete(layerId);
  } else {
    selectedLayerIds.add(layerId);
  }
  return { ...state, selectedLayerIds };
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
      vectorLayer = LayerUtil.removeLayerFromTree(vectorLayer, layerId);
      collapsedLayerIds.delete(layerId);
      hiddenLayerIds.delete(layerId);
    });
  }
  return {
    ...state,
    vectorLayer,
    selectedLayerIds: new Set(),
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
      let p = LayerUtil.findParent([vectorLayer], layer.id);
      while (p) {
        if (_.find(tempSelLayers, l => l.id === p.id)) {
          return false;
        }
        p = LayerUtil.findParent([vectorLayer], p.id);
      }
      return true;
    });

    if (!tempSelLayers.length) {
      return state;
    }

    // Find destination parent and insertion point.
    const firstSelectedLayerParent = LayerUtil.findParent([vectorLayer], tempSelLayers[0].id).clone();
    const firstSelectedLayerIndexInParent =
      _.findIndex(firstSelectedLayerParent.children, l => l.id === tempSelLayers[0].id);

    // Remove all selected items from their parents and move them into a new parent.
    const newGroup = new GroupLayer({
      name: ModelUtil.getUniqueLayerName([vectorLayer], 'group'),
      children: tempSelLayers,
    });
    const parentChildren = firstSelectedLayerParent.children.slice();
    parentChildren.splice(firstSelectedLayerIndexInParent, 0, newGroup);
    _.remove(parentChildren, child => _.find(tempSelLayers, selectedLayer => selectedLayer.id === child.id));
    firstSelectedLayerParent.children = parentChildren;
    vectorLayer = LayerUtil.replaceLayerInTree(vectorLayer, firstSelectedLayerParent);
    selectedLayerIds = new Set([newGroup.id]);
  } else {
    // Ungroup selected groups layers.
    const newSelectedLayers: Layer[] = [];
    tempSelLayers
      .filter(layer => layer instanceof GroupLayer)
      .forEach(groupLayer => {
        // Move children into parent.
        const parent = LayerUtil.findParent([vectorLayer], groupLayer.id).clone();
        const indexInParent = Math.max(0, _.findIndex(parent.children, l => l.id === groupLayer.id));
        const newChildren = parent.children.slice();
        newChildren.splice(indexInParent, 0, ...groupLayer.children);
        parent.children = newChildren;
        vectorLayer = LayerUtil.replaceLayerInTree(vectorLayer, parent);
        newSelectedLayers.splice(0, 0, ...groupLayer.children);
        // Delete the parent.
        vectorLayer = LayerUtil.removeLayerFromTree(vectorLayer, groupLayer.id);
      });
    selectedLayerIds = new Set(newSelectedLayers.map(l => l.id));
  }
  return { ...state, vectorLayer, selectedLayerIds };
}
