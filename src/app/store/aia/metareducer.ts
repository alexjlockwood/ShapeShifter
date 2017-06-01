import { Animation } from '../../scripts/animations';
import { LayerUtil, VectorLayer } from '../../scripts/layers';
import { State } from '../reducer';
import * as actions from './actions';
import { ActionReducer } from '@ngrx/store';
import * as _ from 'lodash';

export function reducer(state: State, action: actions.Actions): State {
  switch (action.type) {

    // Select an animation.
    case actions.SELECT_ANIMATION: {
      const { animationId, clearExisting } = action.payload;
      state = selectAnimationId(state, animationId, clearExisting);
      break;
    }

    // Select an animation block.
    case actions.SELECT_BLOCK: {
      const { blockId, clearExisting } = action.payload;
      state = selectBlockId(state, blockId, clearExisting);
      break;
    }

    // Select a layer.
    case actions.SELECT_LAYER: {
      const { layerId, shouldToggle, clearExisting } = action.payload;
      state = selectLayerId(state, layerId, shouldToggle, clearExisting);
      break;
    }

    // Delete all selected animations, blocks, and layers.
    case actions.DELETE_SELECTED_MODELS: {
      state = deleteSelectedAnimations(state);
      state = deleteSelectedBlocks(state);
      state = deleteSelectedLayers(state);
      break;
    }
  }
  return state;
}

function selectAnimationId(state: State, animationId: string, clearExisting: boolean) {
  const layers = state.layers;
  const timeline = state.timeline;
  const oldSelectedAnimationIds = timeline.selectedBlockIds;
  const newSelectedAnimationIds = clearExisting ? new Set() : new Set(oldSelectedAnimationIds);
  newSelectedAnimationIds.add(animationId);
  if (_.isEqual(oldSelectedAnimationIds, newSelectedAnimationIds)) {
    // Do nothing if the selections haven't changed.
    return state;
  }
  // Clear any existing animation/layer selections.
  let { selectedLayerIds } = layers;
  let { selectedBlockIds } = timeline;
  if (selectedBlockIds.size) {
    selectedBlockIds = new Set<string>();
  }
  if (selectedLayerIds.size) {
    selectedLayerIds = new Set<string>();
  }
  return {
    ...state,
    layers: { ...layers, selectedLayerIds },
    timeline: { ...timeline, selectedAnimationIds: newSelectedAnimationIds, selectedBlockIds },
  };
}

function selectBlockId(state: State, blockId: string, clearExisting: boolean) {
  const layers = state.layers;
  const timeline = state.timeline;
  const oldSelectedBlockIds = timeline.selectedBlockIds;
  const newSelectedBlockIds = clearExisting ? new Set() : new Set(oldSelectedBlockIds);
  newSelectedBlockIds.add(blockId);
  if (_.isEqual(oldSelectedBlockIds, newSelectedBlockIds)) {
    // Do nothing if the selections haven't changed.
    return state;
  }
  // Clear any existing animation/layer selections.
  let { selectedLayerIds } = layers;
  let { selectedAnimationIds } = timeline;
  if (selectedAnimationIds.size) {
    selectedAnimationIds = new Set<string>();
  }
  if (selectedLayerIds.size) {
    selectedLayerIds = new Set<string>();
  }
  return {
    ...state,
    layers: { ...layers, selectedLayerIds },
    timeline: { ...timeline, selectedBlockIds: newSelectedBlockIds, selectedAnimationIds },
  };
}

function selectLayerId(
  state: State,
  layerId: string,
  shouldToggle: boolean,
  clearExisting: boolean,
) {
  const layers = state.layers;
  const selectedLayerIds = new Set(layers.selectedLayerIds);
  if (clearExisting) {
    selectedLayerIds.forEach(id => {
      if (id !== layerId) {
        selectedLayerIds.delete(id);
      }
    });
  }

  let activeVectorLayerId = layers.activeVectorLayerId;
  const parentVl = LayerUtil.findParentVectorLayer(layers.vectorLayers, layerId);
  if (clearExisting || activeVectorLayerId === parentVl.id) {
    // Only allow multi-selecting layers from the same parent vector layer.
    activeVectorLayerId = parentVl.id;
    if (shouldToggle && selectedLayerIds.has(layerId)) {
      selectedLayerIds.delete(layerId);
    } else {
      selectedLayerIds.add(layerId);
    }
  }

  // Clear any existing animation/block selections.
  const timeline = state.timeline;
  let { selectedAnimationIds, selectedBlockIds } = timeline;
  if (selectedAnimationIds.size) {
    selectedAnimationIds = new Set<string>();
  }
  if (selectedBlockIds.size) {
    selectedBlockIds = new Set<string>();
  }

  return {
    ...state,
    layers: { ...layers, selectedLayerIds, activeVectorLayerId },
    timeline: { ...timeline, selectedAnimationIds, selectedBlockIds },
  };
}

function deleteSelectedAnimations(state: State) {
  const timeline = state.timeline;
  const { selectedAnimationIds } = timeline;
  if (!selectedAnimationIds.size) {
    // Do nothing if there are no selected animations;
    return state;
  }
  const animations = timeline.animations.filter(animation => {
    return !selectedAnimationIds.has(animation.id);
  });
  if (!animations.length) {
    // Create an empty animation if the last one was deleted.
    animations.push(new Animation());
  }
  let activeAnimationId = timeline.activeAnimationId;
  if (selectedAnimationIds.has(activeAnimationId)) {
    // If the active animation was deleted, activate the first animation.
    activeAnimationId = animations[0].id;
  }
  return {
    ...state,
    timeline: {
      ...timeline,
      animations,
      activeAnimationId,
      selectedAnimationIds: new Set<string>(),
    },
  };
}

function deleteSelectedBlocks(state: State) {
  const timeline = state.timeline;
  const { selectedBlockIds } = timeline;
  if (!selectedBlockIds.size) {
    // Do nothing if there are no selected blocks;
    return state;
  }
  const animations = timeline.animations.map(animation => {
    const existingBlocks = animation.blocks;
    const newBlocks = existingBlocks.filter(b => !selectedBlockIds.has(b.id));
    if (existingBlocks.length === newBlocks.length) {
      return animation;
    }
    const clonedAnimation = animation.clone();
    clonedAnimation.blocks = newBlocks;
    return clonedAnimation;
  });
  return {
    ...state,
    timeline: {
      ...timeline,
      animations,
      selectedBlockIds: new Set<string>(),
    },
  };
}

function deleteSelectedLayers(state: State) {
  const layers = state.layers;
  const { selectedLayerIds } = layers;
  if (!selectedLayerIds.size) {
    // Do nothing if there are no layers selected.
    return state;
  }
  const vectorLayers = layers.vectorLayers.slice();
  let collapsedLayerIds = new Set(layers.collapsedLayerIds);
  let hiddenLayerIds = new Set(layers.hiddenLayerIds);
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
  if (collapsedLayerIds.size === layers.collapsedLayerIds.size) {
    collapsedLayerIds = layers.collapsedLayerIds;
  }
  if (hiddenLayerIds.size === layers.hiddenLayerIds.size) {
    hiddenLayerIds = layers.hiddenLayerIds;
  }
  if (!vectorLayers.length) {
    // Create an empty vector layer if the last one was deleted.
    vectorLayers.push(new VectorLayer());
  }
  let { activeVectorLayerId } = layers;
  if (!_.find(vectorLayers, vl => vl.id === activeVectorLayerId)) {
    // If the active vector layer ID has been deleted, make
    // the first vector layer active instead.
    activeVectorLayerId = vectorLayers[0].id;
  }
  return {
    ...state,
    layers: {
      ...layers,
      vectorLayers,
      selectedLayerIds: new Set<string>(),
      collapsedLayerIds,
      hiddenLayerIds,
      activeVectorLayerId,
    },
  };
}
