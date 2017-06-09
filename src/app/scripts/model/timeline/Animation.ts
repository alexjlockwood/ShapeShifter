import {
  Inspectable,
  NameProperty,
  NumberProperty,
  Property,
} from '../properties';
import {
  AnimationBlock,
  ColorAnimationBlock,
  NumberAnimationBlock,
  PathAnimationBlock,
} from '.';
import * as _ from 'lodash';

/**
 * An animation represents a collection of layer property tweens for a VectorLayer.
 * An animation has an ID and a duration, as well as a list of AnimationBlocks that
 * each target a single layer in the vector. An animation is structured as an
 * AnimatedVectorDrawable, with the targets being AnimationBlocks.
 */
@Property.register(
  new NameProperty('name'),
  new NumberProperty('duration', { min: 100, max: 60000 }),
)
export class Animation {

  constructor(readonly obj = {} as ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || 'anim';
    this.blocks = (obj.blocks || []).map(block => load(block));
    this.duration = obj.duration || 300;
  }

  clone() {
    const clone = new Animation(this);
    clone.blocks = clone.blocks.slice();
    return clone;
  }

  toJSON() {
    return {
      id: this.id,
      duration: this.duration,
      blocks: this.blocks.map(block => block.toJSON()),
    };
  }
}

interface AnimationArgs {
  id?: string;
  name?: string;
  duration?: number;
  blocks?: ReadonlyArray<AnimationBlock>;
}

export interface Animation extends AnimationArgs, Inspectable { }

// tslint:disable-next-line
export interface ConstructorArgs extends AnimationArgs { }

function load(obj: AnimationBlock | any) {
  if (obj instanceof AnimationBlock) {
    return obj;
  }
  if (obj.type === 'number') {
    return new NumberAnimationBlock(obj);
  }
  if (obj.type === 'color') {
    return new ColorAnimationBlock(obj);
  }
  if (obj.type === 'path') {
    return new PathAnimationBlock(obj);
  }
  console.error('Attempt to load animation block with invalid object: ', obj);
  throw new Error('Attempt to load animation block with invalid object');
}
