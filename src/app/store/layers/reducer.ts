import { environment } from '../../../environments/environment';
import { DEBUG_VECTOR_DRAWABLE_3 } from '../../scripts/demos';
import { VectorDrawableLoader } from '../../scripts/import';
import { LayerUtil, VectorLayer } from '../../scripts/layers';
import * as actions from './actions';
import * as _ from 'lodash';

const IS_DEV_BUILD = !environment.production;

export interface State {
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
    selectedLayerIds: new Set<string>(),
    collapsedLayerIds: new Set<string>(),
    hiddenLayerIds: new Set<string>(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Add layers to the tree.
    case actions.ADD_LAYERS: {
      // TODO: add the layer below the currently selected layer, if one exists
      const { layers: addedLayers } = action.payload;
      if (!addedLayers.length) {
        // Do nothing if there are no layers to add.
        return state;
      }
      const addedVectorLayers = addedLayers.filter(l => l instanceof VectorLayer);
      const existingVectorLayers = state.vectorLayers.slice();
      existingVectorLayers.push(...addedVectorLayers);
      const addedNonVectorLayers = addedLayers.filter(l => !(l instanceof VectorLayer));
      const activeVectorLayerId = state.activeVectorLayerId;
      const activeVlIndex = _.findIndex(existingVectorLayers, vl => vl.id === activeVectorLayerId);
      const vl = existingVectorLayers[activeVlIndex].clone();
      vl.children = vl.children.concat(addedNonVectorLayers);
      existingVectorLayers[activeVlIndex] = vl;
      return { ...state, vectorLayers: existingVectorLayers };
    }

    // Clear all layer selections.
    case actions.CLEAR_LAYER_SELECTIONS: {
      const selectedLayerIds = new Set<string>();
      return { ...state, selectedLayerIds };
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

    default: {
      return state;
    }
  }
}
