import { Property, IdProperty, NumberProperty } from '../properties';
import {
  AnimationBlock, PathAnimationBlock, ColorAnimationBlock, NumberAnimationBlock,
} from './AnimationBlock';

/**
 * An animation represents a collection of layer property tweens for a VectorLayer.
 * An animation has an ID and a duration, as well as a list of AnimationBlocks that
 * each target a single layer in the vector. An animation is structured as an
 * AnimatedVectorDrawable, with the targets being AnimationBlocks.
 */
@Property.register(
  new IdProperty('id'),
  new NumberProperty('duration', { min: 100, max: 60000 }),
)
export class Animation {
  private blocks_: ConcreteAnimationBlock[] = [];

  constructor(readonly obj: ConstructorArgs) {
    this.id = obj.id || '';
    this.blocks = (obj.blocks || []).map(o => {
      if (o instanceof PathAnimationBlock) {
        return new PathAnimationBlock(o);
      } else if (o instanceof ColorAnimationBlock) {
        return new ColorAnimationBlock(o);
      } else {
        return new NumberAnimationBlock(o);
      }
    });
    this.duration = obj.duration || 100;
  }

  get blocks() {
    return this.blocks_ || [];
  }

  set blocks(blocks: ConcreteAnimationBlock[] | undefined) {
    this.blocks_ = blocks || [];
  }

  get typeString() {
    return 'animation';
  }

  get typeIdPrefix() {
    return 'anim';
  }

  get typeIcon() {
    return 'animation';
  }
}

interface AnimationArgs {
  id?: string;
  duration?: number;
}

// tslint:disable-next-line
export interface Animation extends AnimationArgs { }

export interface ConstructorArgs extends AnimationArgs {
  blocks?: ConcreteAnimationBlock[];
}

type ConcreteAnimationBlock = PathAnimationBlock | ColorAnimationBlock | NumberAnimationBlock;
