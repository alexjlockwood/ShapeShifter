import { Inspectable, NameProperty, NumberProperty, Property } from 'app/model/properties';
import * as _ from 'lodash';

import { AnimationBlock } from './AnimationBlock';

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
  constructor(obj = {} as ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || 'anim';
    this.blocks = (obj.blocks || []).map(block => AnimationBlock.from(block));
    this.duration = obj.duration || 300;
  }

  clone() {
    const clone = new Animation(this);
    clone.blocks = [...clone.blocks];
    return clone;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
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

export interface Animation extends AnimationArgs, Inspectable {}
export interface ConstructorArgs extends AnimationArgs {}
