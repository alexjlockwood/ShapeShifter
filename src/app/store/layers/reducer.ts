import { environment } from '../../../environments/environment';
import { DEBUG_VECTOR_DRAWABLE_3 } from '../../scripts/demos';
import { VectorDrawableLoader } from '../../scripts/import';
import { LayerUtil, VectorLayer } from '../../scripts/layers';
import * as actions from './actions';
import * as _ from 'lodash';

const IS_DEV_BUILD = !environment.production;

export interface State {
  // TODO: get rid of the active vector layer id and make this a single VectorLayer variable?
  readonly vectorLayers: ReadonlyArray<VectorLayer>;
  readonly activeVectorLayerId: string;
  readonly selectedLayerIds: Set<string>;
  readonly collapsedLayerIds: Set<string>;
  readonly hiddenLayerIds: Set<string>;
}

export function buildInitialState() {
  let initialVectorLayer: VectorLayer;
  if (IS_DEV_BUILD) {
    // TODO: remove this demo code
    initialVectorLayer =
      VectorDrawableLoader.loadVectorLayerFromXmlString(
        DEBUG_VECTOR_DRAWABLE_3,
        name => false,
      );
  } else {
    initialVectorLayer = new VectorLayer();
  }
  return {
    vectorLayers: [initialVectorLayer],
    activeVectorLayerId: initialVectorLayer.id,
    selectedLayerIds: new Set(),
    collapsedLayerIds: new Set(),
    hiddenLayerIds: new Set(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Import vector layers into the tree.
    case actions.IMPORT_VECTOR_LAYERS: {
      // TODO: support displaying multiple vector layers at some point?
      const { vectorLayers: importedVls } = action.payload;
      const { vectorLayers } = state;
      const newVectorLayers = vectorLayers.concat(importedVls);
      const mergedVl = newVectorLayers.reduce(LayerUtil.mergeVectorLayers);
      return { ...state, vectorLayers: [mergedVl] };
    }

    // Add a layer to the tree.
    case actions.ADD_LAYER: {
      const { layer } = action.payload;
      const vectorLayers = state.vectorLayers.map(vl => {
        if (vl.id === state.activeVectorLayerId) {
          // TODO: add the layer below the currently selected layer, if one exists
          vl = vl.clone();
          vl.children = vl.children.concat([layer]);
        }
        return vl;
      });
      return { ...state, vectorLayers };
    }

    // Expand/collapse a layer.
    case actions.TOGGLE_LAYER_EXPANSION: {
      const { layerId, recursive } = action.payload;
      const layerIds = new Set([layerId]);
      if (recursive) {
        _.forEach(state.vectorLayers, vl => {
          // Recursively expand/collapse the layer's children.
          const layer = vl.findLayerById(layerId);
          if (!layer) {
            return true;
          }
          layer.walk(l => layerIds.add(l.id));
          return false;
        });
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
      let replacementVl: VectorLayer;
      if (replacementLayer instanceof VectorLayer) {
        replacementVl = replacementLayer;
      } else {
        const vl =
          LayerUtil.findParentVectorLayer(state.vectorLayers, replacementLayer.id);
        replacementVl = LayerUtil.replaceLayerInTree(vl, replacementLayer);
      }
      const replacementId = replacementVl.id;
      const vectorLayers =
        state.vectorLayers.map(vl => vl.id === replacementId ? replacementVl : vl);
      return { ...state, vectorLayers };
    }

    // Clear all layer selections.
    case actions.CLEAR_LAYER_SELECTIONS: {
      return { ...state, selectedLayerIds: new Set() };
    }

    // Select a layer.
    case actions.SELECT_LAYER: {
      const { layerId, shouldToggle, clearExisting } = action.payload;
      return selectLayerId(state, layerId, shouldToggle, clearExisting);
    }

    // Select an animation.
    case actions.SELECT_ANIMATION: {
      return { ...state, selectedLayerIds: new Set() };
    }

    // Select an animation block.
    case actions.SELECT_BLOCK: {
      return { ...state, selectedLayerIds: new Set() };
    }

    case actions.ADD_BLOCK: {
      return { ...state, selectedLayerIds: new Set() };
    }

    // Delete all selected layers.
    case actions.DELETE_SELECTED_MODELS: {
      return deleteSelectedLayers(state);
    }
  }
  return state;
}

function selectLayerId(
  state: State,
  layerId: string,
  shouldToggle: boolean,
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

  let activeVectorLayerId = state.activeVectorLayerId;
  const parentVl = LayerUtil.findParentVectorLayer(state.vectorLayers, layerId);
  if (clearExisting || activeVectorLayerId === parentVl.id) {
    // Only allow multi-selecting layers from the same parent vector layer.
    activeVectorLayerId = parentVl.id;
    if (shouldToggle && selectedLayerIds.has(layerId)) {
      selectedLayerIds.delete(layerId);
    } else {
      selectedLayerIds.add(layerId);
    }
  }

  return { ...state, selectedLayerIds, activeVectorLayerId };
}

function deleteSelectedLayers(state: State) {
  const { selectedLayerIds } = state;
  if (!selectedLayerIds.size) {
    // Do nothing if there are no layers selected.
    return state;
  }
  const vectorLayers = state.vectorLayers.slice();
  let collapsedLayerIds = new Set(state.collapsedLayerIds);
  let hiddenLayerIds = new Set(state.hiddenLayerIds);
  selectedLayerIds.forEach(layerId => {
    const parentVl = LayerUtil.findParentVectorLayer(vectorLayers, layerId);
    if (parentVl) {
      const vlIndex = _.findIndex(vectorLayers, vl => vl.id === parentVl.id);
      if (parentVl.id === layerId) {
        // Remove the selected vector from the list of vectors.
        vectorLayers.splice(vlIndex, 1);
      } else {
        // Remove the layer node from the parent vector.
        vectorLayers[vlIndex] = LayerUtil.removeLayerFromTree(parentVl, layerId);
      }
      collapsedLayerIds.delete(layerId);
      hiddenLayerIds.delete(layerId);
    }
  });
  if (collapsedLayerIds.size === state.collapsedLayerIds.size) {
    collapsedLayerIds = state.collapsedLayerIds;
  }
  if (hiddenLayerIds.size === state.hiddenLayerIds.size) {
    hiddenLayerIds = state.hiddenLayerIds;
  }
  if (!vectorLayers.length) {
    // Create an empty vector layer if the last one was deleted.
    vectorLayers.push(new VectorLayer());
  }
  let { activeVectorLayerId } = state;
  if (!_.find(vectorLayers, vl => vl.id === activeVectorLayerId)) {
    // If the active vector layer ID has been deleted, make
    // the first vector layer active instead.
    activeVectorLayerId = vectorLayers[0].id;
  }
  return {
    ...state,
    vectorLayers,
    selectedLayerIds: new Set(),
    collapsedLayerIds,
    hiddenLayerIds,
    activeVectorLayerId,
  };
}
