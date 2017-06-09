import { ModelUtil } from '../../scripts/common';
import { ColorProperty, PathProperty } from '../../scripts/properties';
import {
  Animation,
  AnimationBlock,
  ColorAnimationBlock,
  NumberAnimationBlock,
  PathAnimationBlock,
} from '../../scripts/timeline';
import * as actions from './actions';
import * as _ from 'lodash';

export interface State {
  readonly animations: ReadonlyArray<Animation>;
  readonly selectedAnimationIds: Set<string>;
  readonly activeAnimationId: string;
  readonly selectedBlockIds: Set<string>;
}

export function buildInitialState() {
  const initialAnimation = new Animation();
  return {
    animations: [initialAnimation],
    selectedAnimationIds: new Set(),
    activeAnimationId: initialAnimation.id,
    selectedBlockIds: new Set(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Add an animation to the application state.
    case actions.ADD_ANIMATION: {
      const animations = state.animations.concat([action.payload.animation]);
      return { ...state, animations };
    }

    // Activate an animation.
    case actions.ACTIVATE_ANIMATION: {
      return { ...state, activeAnimationId: action.payload.animationId };
    }

    // Replace a list of animations.
    case actions.REPLACE_ANIMATIONS: {
      const animations = state.animations.map(anim => {
        const replacement = _.find(action.payload.animations, a => a.id === anim.id);
        return replacement ? replacement : anim;
      });
      return { ...state, animations };
    }

    // Select an animation.
    case actions.SELECT_ANIMATION: {
      const { animationId, clearExisting } = action.payload;
      return selectAnimationId(state, animationId, clearExisting);
    }

    // Add an animation block to the currently active animation.
    case actions.ADD_BLOCK: {
      const { layer, propertyName, fromValue, toValue, activeTime } = action.payload;
      const animation = _.find(state.animations, a => a.id === state.activeAnimationId);
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
        fromValue,
        toValue,
      };

      let newBlock: AnimationBlock;
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

    // Replace a list of animation blocks.
    case actions.REPLACE_BLOCKS: {
      const { blocks } = action.payload;
      if (!blocks.length) {
        // Do nothing if the list of blocks is empty.
        return state;
      }
      const blockMap = new Map<string, AnimationBlock[]>();
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

    // Select an animation block.
    case actions.SELECT_BLOCK: {
      const { blockId, clearExisting } = action.payload;
      return selectBlockId(state, blockId, clearExisting);
    }

    // Clear all layer selections.
    case actions.CLEAR_LAYER_SELECTIONS: {
      return { ...state, selectedAnimationIds: new Set(), selectedBlockIds: new Set() };
    }

    // Select a layer.
    case actions.SELECT_LAYER: {
      return { ...state, selectedAnimationIds: new Set(), selectedBlockIds: new Set() };
    }

    // Delete all selected animations, blocks, and layers.
    case actions.DELETE_SELECTED_MODELS: {
      state = deleteSelectedAnimations(state);
      state = deleteSelectedBlocks(state);
      return state;
    }
  }

  return state;
}

function selectAnimationId(state: State, animationId: string, clearExisting: boolean) {
  const oldSelectedAnimationIds = state.selectedBlockIds;
  const newSelectedAnimationIds = clearExisting ? new Set() : new Set(oldSelectedAnimationIds);
  newSelectedAnimationIds.add(animationId);
  return { ...state, selectedAnimationIds: newSelectedAnimationIds, selectedBlockIds: new Set() };
}

function selectBlockId(state: State, blockId: string, clearExisting: boolean) {
  const oldSelectedBlockIds = state.selectedBlockIds;
  const newSelectedBlockIds = clearExisting ? new Set() : new Set(oldSelectedBlockIds);
  newSelectedBlockIds.add(blockId);
  return { ...state, selectedAnimationIds: new Set(), selectedBlockIds: newSelectedBlockIds };
}

function deleteSelectedAnimations(state: State) {
  const animations = state.animations.filter(animation => {
    return !state.selectedAnimationIds.has(animation.id);
  });
  if (!animations.length) {
    // Create an empty animation if the last one was deleted.
    animations.push(new Animation());
  }
  let activeAnimationId = state.activeAnimationId;
  if (state.selectedAnimationIds.has(activeAnimationId)) {
    // If the active animation was deleted, activate the first animation.
    activeAnimationId = animations[0].id;
  }
  return { ...state, animations, activeAnimationId, selectedAnimationIds: new Set() };
}

function deleteSelectedBlocks(state: State) {
  const animations = state.animations.map(animation => {
    const existingBlocks = animation.blocks;
    const newBlocks = existingBlocks.filter(b => !state.selectedBlockIds.has(b.id));
    if (existingBlocks.length === newBlocks.length) {
      return animation;
    }
    const clonedAnimation = animation.clone();
    clonedAnimation.blocks = newBlocks;
    return clonedAnimation;
  });
  return { ...state, animations, selectedBlockIds: new Set() };
}
