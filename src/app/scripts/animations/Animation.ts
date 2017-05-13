import * as _ from 'lodash';
import { Property, NameProperty, NumberProperty, Inspectable } from '../properties';
import { AnimationBlock } from '.';

/**
 * An animation represents a collection of layer property tweens for a VectorLayer.
 * An animation has an ID and a duration, as well as a list of AnimationBlocks that
 * each target a single layer in the vector. An animation is structured as an
 * AnimatedVectorDrawable, with the targets being AnimationBlocks.
 */
@Property.register<any>(
  new NameProperty('name'),
  new NumberProperty('duration', { min: 100, max: 60000 }),
)
export class Animation {

  constructor(readonly obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || '';
    this.blocks = obj.blocks || [];
    this.duration = obj.duration || 300;
  }

  clone() {
    const clone = new Animation(this);
    clone.blocks = clone.blocks.slice();
    return clone;
  }
}

interface AnimationArgs {
  id?: string;
  name?: string;
  duration?: number;
  blocks?: ReadonlyArray<AnimationBlock<any>>;
}

export interface Animation extends AnimationArgs, Inspectable { }

// tslint:disable-next-line
export interface ConstructorArgs extends AnimationArgs { }

