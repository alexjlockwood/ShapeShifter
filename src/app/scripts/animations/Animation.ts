import * as _ from 'lodash';
import { Property, NameProperty, NumberProperty, Inspectable } from '../properties';
import { AnimationBlock } from '.';

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
  private blocks_: AnimationBlock<any>[] = [];

  constructor(readonly obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || '';
    this.blocks = (obj.blocks || []).map(b => b.clone());
    this.duration = obj.duration || 100;
  }

  get blocks() {
    return this.blocks_ || [];
  }

  set blocks(blocks: AnimationBlock<any>[] | undefined) {
    this.blocks_ = blocks || [];
  }
}

interface AnimationArgs {
  id?: string;
  name?: string;
  duration?: number;
}

export interface Animation extends AnimationArgs, Inspectable { }

export interface ConstructorArgs extends AnimationArgs {
  blocks?: AnimationBlock<any>[];
}

