import * as _ from 'lodash';
import { createSelector } from 'reselect';
import {
  Animation,
  AnimationBlock,
  PathAnimationBlock,
  ColorAnimationBlock,
  NumberAnimationBlock,
} from '../../animations';
import * as animation from '../actions/Animation';
import { ModelUtil } from '../../common';
import { PathProperty, ColorProperty } from '../../properties';

export interface State {
  animations: ReadonlyArray<Animation>;
  selectedAnimationId: string;
  activeAnimationId: string;
  selectedBlockIds: Set<string>;
}

export const initialState: State = {
  animations: [],
  selectedAnimationId: '',
  activeAnimationId: '',
  selectedBlockIds: new Set<string>(),
};

export function reducer(state = initialState, action: animation.Actions): State {
  switch (action.type) {
    case animation.ADD_ANIMATIONS: {
      const animations = state.animations.concat(...action.payload.animations);
      let { activeAnimationId } = state;
      if (!state.animations.length) {
        // Auto-activate the first animation if this is the first
        // animation in the store.
        activeAnimationId = animations[0].id;
      }
      return { ...state, animations, activeAnimationId };
    }
    case animation.SELECT_ANIMATION_ID: {
      const { animationId } = action.payload;
      if (animationId === state.selectedAnimationId
        && animationId === state.activeAnimationId) {
        return state;
      }
      // Selecting an animation ID also makes it active.
      const activeAnimationId = animationId;
      const selectedAnimationId = animationId;
      return { ...state, selectedAnimationId, activeAnimationId };
    }
    case animation.ACTIVATE_ANIMATION_ID: {
      const { animationId } = action.payload;
      if (animationId === state.activeAnimationId) {
        return state;
      }
      return { ...state, activeAnimationId: animationId };
    }
    case animation.ADD_ANIMATION_BLOCK: {
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
      const selectedBlockIds = selectAnimationBlockIds(state, newBlock.id, true);
      return { ...state, animations, selectedBlockIds };
    }
    case animation.SELECT_ANIMATION_BLOCK_ID: {
      const { animationBlockId, clearExisting } = action.payload;
      const selectedBlockIds = selectAnimationBlockIds(state, animationBlockId, clearExisting);
      return { ...state, selectedBlockIds };
    }
    case animation.REPLACE_ANIMATION_BLOCKS: {
      const { animationBlocks } = action.payload;
      if (!animationBlocks.length) {
        return state;
      }
      const blockMap = new Map<string, AnimationBlock<any>[]>();
      for (const block of animationBlocks) {
        if (blockMap.has(block.animationId)) {
          const blocks = blockMap.get(block.animationId);
          blocks.push(block);
          blockMap.set(block.animationId, blocks);
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

function selectAnimationBlockIds(state: State, animationBlockId: string, clearExisting: boolean) {
  const selectedAnimationBlockIds =
    clearExisting ? new Set() : new Set(state.selectedBlockIds);
  selectedAnimationBlockIds.add(animationBlockId);
  return selectedAnimationBlockIds;
}
