import { Rect } from 'app/scripts/common';
import * as _ from 'lodash';

import {
  Animatable,
  Inspectable,
  NameProperty,
  Property,
} from '../properties';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from '.';

/**
 * Root class for all layer types.
 */
@Property.register(
  new NameProperty('name'),
)
export abstract class AbstractLayer implements Layer {

  constructor(obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || '';
    this.children = (obj.children || []).map(child => load(child));
  }

  // Implements the Layer interface.
  findLayerById(id: string): Layer | undefined {
    if (this.id === id) {
      return this;
    }
    for (const child of this.children) {
      const layer = child.findLayerById(id);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }

  // Implements the Layer interface.
  findLayerByName(name: string): Layer | undefined {
    if (this.name === name) {
      return this;
    }
    for (const child of this.children) {
      const layer = child.findLayerByName(name);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }

  // Implements the Layer interface.
  isMorphableWith(layer: Layer) {
    if (this.constructor !== layer.constructor) {
      return false;
    }
    if (this instanceof PathLayer || this instanceof ClipPathLayer) {
      return this.pathData.isMorphableWith((layer as any).pathData);
    }
    return this.children.length === layer.children.length
      && this.children.every((c, i) => c.isMorphableWith(layer.children[i]));
  }

  // Implements the Layer interface.
  walk(beforeFn: (layer: Layer) => void) {
    const visitFn = (layer: Layer) => {
      beforeFn(layer);
      layer.children.forEach(l => visitFn(l));
    };
    visitFn(this);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.getPrefix(),
    };
  }

  // Implements the Layer interface.
  abstract clone(): Layer;

  // Implements the Layer interface.
  abstract deepClone(): Layer;

  // Implements the Layer interface.
  abstract getIconName(): string;

  // Implements the Layer interface.
  abstract getPrefix(): string;

  // Implements the Layer interface.
  abstract getBoundingBox(): Rect | undefined;
}

// TODO: share this interface with Layer?
interface AbstractLayerArgs {
  id?: string;
  name: string;
  children: ReadonlyArray<Layer>;
}

export interface AbstractLayer extends AbstractLayerArgs, Inspectable, Animatable { }
export interface ConstructorArgs extends AbstractLayerArgs { }

function load(obj: AbstractLayer | any): Layer {
  if (obj instanceof AbstractLayer) {
    return obj;
  }
  if (obj.type === 'vector') {
    return new VectorLayer(obj);
  }
  if (obj.type === 'group') {
    return new GroupLayer(obj);
  }
  if (obj.type === 'path') {
    return new PathLayer(obj);
  }
  if (obj.type === 'mask') {
    return new ClipPathLayer(obj);
  }
  console.error('Attempt to load layer with invalid object: ', obj);
  throw new Error('Attempt to load layer with invalid object');
}
