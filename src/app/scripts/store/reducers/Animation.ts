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
}

export const initialState: State = {
  animations: [],
  selectedAnimationId: '',
  activeAnimationId: '',
};

export function reducer(state = initialState, action: animation.Actions): State {
  switch (action.type) {
    case animation.ADD_ANIMATIONS: {
      const animations = state.animations.concat(...action.payload);
      let { activeAnimationId } = state;
      if (!state.animations.length) {
        // Auto-activate the first animation if this is the first
        // animation in the store.
        activeAnimationId = animations[0].id;
      }
      return { ...state, animations, activeAnimationId };
    }
    case animation.SELECT_ANIMATION_ID: {
      // Selecting an animation ID also makes it active.
      const activeAnimationId = action.payload;
      const selectedAnimationId = action.payload;
      return { ...state, selectedAnimationId, activeAnimationId };
    }
    case animation.ACTIVATE_ANIMATION_ID: {
      return { ...state, activeAnimationId: action.payload };
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
          dist: Math.min(Math.abs(gap.end - activeTime), Math.abs(gap.start - activeTime)),
        }))
        .sort((a, b) => a.dist - b.dist);

      if (!gaps.length) {
        // No available gaps, cancel.
        // TODO: show a disabled button to prevent this case?
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
        anim.blocks.push(newBlock);
        return anim;
      });

      // TODO: auto-select the new animation block
      // TODO: auto-select the new animation block
      // TODO: auto-select the new animation block
      // TODO: auto-select the new animation block
      // TODO: auto-select the new animation block

      return { ...state, animations };
    }
    default: {
      return state;
    }
  }
}
