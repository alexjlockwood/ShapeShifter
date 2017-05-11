import * as _ from 'lodash';
import { createSelector } from 'reselect';
import { VectorLayer } from '../../layers';
import * as actions from '../actions/Actions';
import {
  Animation,
  AnimationBlock,
  PathAnimationBlock,
  ColorAnimationBlock,
  NumberAnimationBlock,
} from '../../animations';
import { ModelUtil } from '../../common';
import { PathProperty, ColorProperty } from '../../properties';

export interface State {
  // TODO: not sure it makes sense to have a list of vectors anymore
  // (i.e. how should add layer work?)
  readonly vectorLayers: ReadonlyArray<VectorLayer>;
  readonly selectedLayerIds: Set<string>;
  readonly collapsedLayerIds: Set<string>;
  readonly hiddenLayerIds: Set<string>;
  readonly animations: ReadonlyArray<Animation>;
  readonly selectedAnimationId: string;
  readonly activeAnimationId: string;
  readonly selectedBlockIds: Set<string>;
}

export const initialState: State = {
  vectorLayers: [],
  selectedLayerIds: new Set<string>(),
  collapsedLayerIds: new Set<string>(),
  hiddenLayerIds: new Set<string>(),
  animations: [],
  selectedAnimationId: '',
  activeAnimationId: '',
  selectedBlockIds: new Set<string>(),
};

export function reducer(state = initialState, action: actions.Actions): State {
  switch (action.type) {

    // Add a list of vector layers to the application state.
    case actions.ADD_VECTOR_LAYERS: {
      const addedVectorLayers = action.payload.vectorLayers;
      if (!addedVectorLayers.length) {
        // Do nothing if the list of added vector layers is empty.
        return state;
      }
      const vectorLayers = state.vectorLayers.concat(...addedVectorLayers);
      return { ...state, vectorLayers };
    }

    // TODO: make this more general? i.e. replace a 'layer' instead?
    // TODO: make this more general? i.e. replace a 'layer' instead?
    // TODO: make this more general? i.e. replace a 'layer' instead?
    // TODO: make this more general? i.e. replace a 'layer' instead?
    // TODO: make this more general? i.e. replace a 'layer' instead?
    // Replace a vector layer.
    case actions.REPLACE_VECTOR_LAYER: {
      const replacementVl = action.payload.vectorLayer;
      const replacementId = replacementVl.id;
      const vectorLayers =
        state.vectorLayers.map(vl => vl.id === replacementId ? replacementVl : vl);
      return { ...state, vectorLayers };
    }

    // Select a layer.
    case actions.SELECT_LAYER_ID: {
      const { layerId, clearExisting } = action.payload;
      return selectLayerId(state, layerId, clearExisting);
    }

    // Expand/collapse a layer.
    case actions.TOGGLE_LAYER_ID_EXPANSION: {
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
    case actions.TOGGLE_LAYER_ID_VISIBILITY: {
      const { layerId, recursive } = action.payload;
      const layerIds = new Set([layerId]);
      if (recursive) {
        _.forEach(state.vectorLayers, vl => {
          // Recursively show/hide the layer's children.
          const layer = vl.findLayerById(layerId);
          if (!layer) {
            return true;
          }
          layer.walk(l => layerIds.add(l.id));
          return false;
        });
      }
      const hiddenLayerIds = new Set(state.hiddenLayerIds);
      if (hiddenLayerIds.has(layerId)) {
        layerIds.forEach(id => hiddenLayerIds.delete(id));
      } else {
        layerIds.forEach(id => hiddenLayerIds.add(id));
      }
      return { ...state, hiddenLayerIds };
    }

    // TODO: not sure it makes sense to have a list of vectors here?
    // TODO: not sure it makes sense to have a list of vectors here?
    // TODO: not sure it makes sense to have a list of vectors here?
    // TODO: not sure it makes sense to have a list of vectors here?
    // TODO: not sure it makes sense to have a list of vectors here?
    // Add a layer to the tree.
    case actions.ADD_LAYER: {
      if (!state.vectorLayers.length) {
        // TODO: don't allow the user to add a layer if no vector layers exist?
        // TODO: don't allow the user to add a layer if no vector layers exist?
        // TODO: don't allow the user to add a layer if no vector layers exist?
        // TODO: don't allow the user to add a layer if no vector layers exist?
        // TODO: don't allow the user to add a layer if no vector layers exist?
        return state;
      }
      // TODO: add the layer below the currently selected layer, if one exists
      // TODO: add the layer below the currently selected layer, if one exists
      // TODO: add the layer below the currently selected layer, if one exists
      // TODO: add the layer below the currently selected layer, if one exists
      // TODO: add the layer below the currently selected layer, if one exists
      const { layer } = action.payload;
      // TODO: assign the layer a unique name that doesn't clash with any others
      // TODO: assign the layer a unique name that doesn't clash with any others
      // TODO: assign the layer a unique name that doesn't clash with any others
      // TODO: assign the layer a unique name that doesn't clash with any others
      // TODO: assign the layer a unique name that doesn't clash with any others
      const vl = state.vectorLayers[0].clone();
      vl.children = vl.children.concat(layer);
      const vectorLayers = state.vectorLayers.slice();
      vectorLayers[0] = vl;
      // TODO: auto-select the new layer?
      // TODO: auto-select the new layer?
      // TODO: auto-select the new layer?
      // TODO: auto-select the new layer?
      // TODO: auto-select the new layer?
      return { ...state, vectorLayers };
    }

    // Add a list of animations to the application state.
    case actions.ADD_ANIMATIONS: {
      const newAnimations = action.payload.animations;
      if (!newAnimations.length) {
        // Do nothing if the list of added animations is empty.
        return state;
      }
      const animations = state.animations.concat(...newAnimations);
      let { activeAnimationId } = state;
      if (!activeAnimationId) {
        // Auto-activate the first animation.
        activeAnimationId = animations[0].id;
      }
      return { ...state, animations, activeAnimationId };
    }

    // Select an animation.
    case actions.SELECT_ANIMATION_ID: {
      return selectAnimationId(state, action.payload.animationId);
    }

    // Activate an animation.
    case actions.ACTIVATE_ANIMATION_ID: {
      const { animationId } = action.payload;
      if (animationId === state.activeAnimationId) {
        // Do nothing if the active animation ID hasn't changed.
        return state;
      }
      return { ...state, activeAnimationId: animationId };
    }

    // Add an animation block to the currently active animation.
    case actions.ADD_BLOCK: {
      const { layer, propertyName } = action.payload;
      const animation = _.find(state.animations, anim => anim.id === state.activeAnimationId);
      const newBlockDuration = 100;

      // TODO: pass the active time in as an argument
      // TODO: pass the active time in as an argument
      // TODO: pass the active time in as an argument
      // TODO: pass the active time in as an argument
      // TODO: pass the active time in as an argument
      const activeTime = 0;

      // Find the right start time for the block, which should be a gap between
      // neighboring blocks closest to the active time cursor, of a minimum size.
      const blocksByLayerId = ModelUtil.getOrderedBlocksByPropertyByLayer(animation);
      const blockNeighbors = (blocksByLayerId[layer.id] || {})[propertyName] || [];
      let gaps: Array<{ start: number, end: number }> = [];
      for (let i = 0; i < blockNeighbors.length; i++) {
        gaps.push({
          start: (i === 0) ? 0 : blockNeighbors[i - 1].endTime,
          end: blockNeighbors[i].startTime,
        });
      }
      gaps.push({
        start: blockNeighbors.length ? blockNeighbors[blockNeighbors.length - 1].endTime : 0,
        end: animation.duration,
      });
      gaps = gaps
        .filter(gap => gap.end - gap.start > newBlockDuration)
        .map(gap => Object.assign(gap, {
          dist: Math.min(
            Math.abs(gap.end - activeTime),
            Math.abs(gap.start - activeTime),
          ),
        }))
        .sort((a, b) => a.dist - b.dist);

      if (!gaps.length) {
        // No available gaps, cancel.
        // TODO: show a disabled button to prevent this case?
        console.warn('Ignoring failed attempt to add animation block');
        return state;
      }

      let startTime = Math.max(activeTime, gaps[0].start);
      const endTime = Math.min(startTime + newBlockDuration, gaps[0].end);
      if (endTime - startTime < newBlockDuration) {
        startTime = endTime - newBlockDuration;
      }

      // Generate the new block.
      const property = layer.animatableProperties.get(propertyName);

      // TODO: clone the current rendered property value and set the from/to values appropriately
      // TODO: clone the current rendered property value and set the from/to values appropriately
      // TODO: clone the current rendered property value and set the from/to values appropriately
      // TODO: clone the current rendered property value and set the from/to values appropriately
      // TODO: clone the current rendered property value and set the from/to values appropriately
      // const valueAtCurrentTime =
      //   this.studioState_.animationRenderer
      //     .getLayerPropertyValue(layer.id, propertyName);

      const newBlockArgs = {
        layerId: layer.id,
        animationId: state.activeAnimationId,
        propertyName,
        startTime,
        endTime,
        // fromValue: property.cloneValue(valueAtCurrentTime),
        // toValue: property.cloneValue(valueAtCurrentTime),
      };

      let newBlock: AnimationBlock<any>;
      if (property instanceof PathProperty) {
        newBlock = new PathAnimationBlock(newBlockArgs);
      } else if (property instanceof ColorProperty) {
        newBlock = new ColorAnimationBlock(newBlockArgs);
      } else {
        newBlock = new NumberAnimationBlock(newBlockArgs);
      }

      const animations = state.animations.map(anim => {
        if (anim.id !== animation.id) {
          return anim;
        }
        anim = anim.clone();
        anim.blocks = anim.blocks.concat(newBlock);
        return anim;
      });

      // Auto-select the new animation block.
      state = selectBlockId(state, newBlock.id, true /* clearExisting */);
      return { ...state, animations };
    }

    // Select an animation block.
    case actions.SELECT_BLOCK_ID: {
      const { blockId, clearExisting } = action.payload;
      return selectBlockId(state, blockId, clearExisting);
    }

    // Replace a list of animation blocks.
    case actions.REPLACE_BLOCKS: {
      const { blocks } = action.payload;
      if (!blocks.length) {
        // Do nothing if the list of blocks is empty.
        return state;
      }
      const blockMap = new Map<string, AnimationBlock<any>[]>();
      for (const block of blocks) {
        if (blockMap.has(block.animationId)) {
          const blockList = blockMap.get(block.animationId);
          blockList.push(block);
          blockMap.set(block.animationId, blockList);
        } else {
          blockMap.set(block.animationId, [block]);
        }
      }
      const animations = state.animations.map(animation => {
        return blockMap.has(animation.id) ? animation.clone() : animation;
      });
      blockMap.forEach((replacementBlocks, animId) => {
        const animation = _.find(animations, a => a.id === animId);
        const newBlocks = animation.blocks.slice();
        for (const block of replacementBlocks) {
          newBlocks[_.findIndex(newBlocks, b => b.id === block.id)] = block;
        }
        animation.blocks = newBlocks;
      });
      return { ...state, animations };
    }

    default: {
      return state;
    }
  }
}

function selectAnimationId(state: State, selectedAnimationId: string) {
  if (selectedAnimationId === state.selectedAnimationId) {
    // Do nothing if the selected animation ID hasn't changed.
    return state;
  }
  // Clear any existing layer/block selections.
  let { selectedLayerIds, selectedBlockIds } = state;
  if (selectedLayerIds.size) {
    selectedLayerIds = new Set<string>();
  }
  if (selectedBlockIds.size) {
    selectedBlockIds = new Set<string>();
  }
  return {
    ...state,
    selectedAnimationId,
    // Selecting a new animation ID also makes it active.
    activeAnimationId: selectedAnimationId,
    selectedLayerIds,
    selectedBlockIds,
  };
}

function selectBlockId(state: State, blockId: string, clearExisting: boolean) {
  const oldSelectedBlockIds = state.selectedBlockIds;
  const newSelectedBlockIds = clearExisting ? new Set() : new Set(oldSelectedBlockIds);
  newSelectedBlockIds.add(blockId);
  if (_.isEqual(oldSelectedBlockIds, newSelectedBlockIds)) {
    // Do nothing if the selections haven't changed.
    return state;
  }
  // Clear any existing animation/layer selections.
  let { selectedAnimationId, selectedLayerIds } = state;
  if (selectedAnimationId) {
    selectedAnimationId = '';
  }
  if (selectedLayerIds.size) {
    selectedLayerIds = new Set<string>();
  }
  return {
    ...state,
    selectedBlockIds: newSelectedBlockIds,
    selectedAnimationId,
    selectedLayerIds,
  };
}

function selectLayerId(state: State, layerId: string, clearExisting: boolean) {
  const oldSelectedLayerIds = state.selectedLayerIds;
  const newSelectedLayerIds = clearExisting ? new Set() : new Set(oldSelectedLayerIds);
  newSelectedLayerIds.add(layerId);
  if (_.isEqual(oldSelectedLayerIds, newSelectedLayerIds)) {
    // Do nothing if the selections haven't changed.
    return state;
  }
  // Clear any existing animation/block selections.
  let { selectedAnimationId, selectedBlockIds } = state;
  if (selectedAnimationId) {
    selectedAnimationId = '';
  }
  if (selectedBlockIds.size) {
    selectedBlockIds = new Set<string>();
  }
  return {
    ...state,
    selectedLayerIds: newSelectedLayerIds,
    selectedAnimationId,
    selectedBlockIds,
  };
}
