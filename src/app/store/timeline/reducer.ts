import * as actions from './actions';
import { ModelUtil } from 'app/scripts/common';
import {
  ColorProperty,
  PathProperty,
} from 'app/scripts/model/properties';
import {
  Animation,
  AnimationBlock,
} from 'app/scripts/model/timeline';
import * as _ from 'lodash';

export interface State {
  readonly animation: Animation;
  readonly isAnimationSelected: boolean;
  readonly selectedBlockIds: Set<string>;
}

export function buildInitialState() {
  return {
    animation: new Animation(),
    isAnimationSelected: false,
    selectedBlockIds: new Set(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Replace the animation.
    case actions.REPLACE_ANIMATION: {
      const { animation } = action.payload;
      return { ...state, animation };
    }

    // Select an animation.
    case actions.SELECT_ANIMATION: {
      const { isAnimationSelected } = action.payload;
      return { ...state, isAnimationSelected };
    }

    // Add an animation block to the currently active animation.
    case actions.ADD_BLOCK: {
      const { layer, propertyName, fromValue, toValue, activeTime } = action.payload;
      let { animation } = state;
      const newBlockDuration = 100;

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
      let type: 'path' | 'color' | 'number';
      if (property instanceof PathProperty) {
        type = 'path';
      } else if (property instanceof ColorProperty) {
        type = 'color';
      } else {
        type = 'number';
      }

      // TODO: clone the current rendered property value and set the from/to values appropriately
      // const valueAtCurrentTime =
      //   this.studioState_.animationRenderer
      //     .getLayerPropertyValue(layer.id, propertyName);

      const newBlock = AnimationBlock.from({
        layerId: layer.id,
        propertyName,
        startTime,
        endTime,
        fromValue,
        toValue,
        type,
      });
      animation = animation.clone();
      animation.blocks = animation.blocks.concat(newBlock);

      // Auto-select the new animation block.
      state = selectBlockId(state, newBlock.id, true /* clearExisting */);
      return { ...state, animation };
    }

    // Replace a list of animation blocks.
    case actions.REPLACE_BLOCKS: {
      const { blocks } = action.payload;
      if (!blocks.length) {
        // Do nothing if the list of blocks is empty.
        return state;
      }
      let { animation } = state;
      const newBlocks = animation.blocks.map(block => {
        const newBlock = _.find(blocks, b => block.id === b.id);
        return newBlock ? newBlock : block;
      });
      animation = animation.clone();
      animation.blocks = newBlocks;
      return { ...state, animation };
    }

    // Select an animation block.
    case actions.SELECT_BLOCK: {
      const { blockId, clearExisting } = action.payload;
      return selectBlockId(state, blockId, clearExisting);
    }

    // Clear all layer selections.
    case actions.CLEAR_LAYER_SELECTIONS: {
      return { ...state, isAnimationSelected: false, selectedBlockIds: new Set() };
    }

    // Select a layer.
    case actions.SELECT_LAYER: {
      return { ...state, isAnimationSelected: false, selectedBlockIds: new Set() };
    }

    // Delete all selected animations, blocks, and layers.
    case actions.DELETE_SELECTED_MODELS: {
      state = deleteSelectedAnimation(state);
      state = deleteSelectedBlocks(state);
      return state;
    }
  }

  return state;
}

function selectBlockId(state: State, blockId: string, clearExisting: boolean) {
  const selectedBlockIds = new Set(state.selectedBlockIds);
  if (clearExisting) {
    selectedBlockIds.forEach(id => {
      if (id !== blockId) {
        selectedBlockIds.delete(id);
      }
    });
  }
  if (!clearExisting && selectedBlockIds.has(blockId)) {
    selectedBlockIds.delete(blockId);
  } else {
    selectedBlockIds.add(blockId);
  }
  return { ...state, isAnimationSelected: false, selectedBlockIds };
}

function deleteSelectedAnimation(state: State) {
  let { animation } = state;
  if (state.isAnimationSelected) {
    animation = new Animation();
  }
  return { ...state, animation, isAnimationSelected: false };
}

function deleteSelectedBlocks(state: State) {
  const animation = state.animation.clone();
  animation.blocks = animation.blocks.filter(b => !state.selectedBlockIds.has(b.id));
  return { ...state, animation, selectedBlockIds: new Set() };
}
