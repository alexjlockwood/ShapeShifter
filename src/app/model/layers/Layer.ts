import { Rect } from 'app/scripts/common';
import * as _ from 'lodash';

import { Animatable, Inspectable, NameProperty, Property } from '../properties';
import { ClipPathLayer, GroupLayer, PathLayer, VectorLayer } from '.';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
@Property.register(new NameProperty('name'))
export abstract class Layer implements Inspectable, Animatable {
  /**
   * A non-user-visible string that uniquely identifies this layer in the tree.
   */
  id?: string;

  /**
   * A user-visible string uniquely identifying this layer in the tree. This value
   * can be renamed, as long as it doesn't conflict with other layers in the tree.
   */
  name: string;

  /**
   * This layers children layers, or undefined if none exist.
   */
  children: ReadonlyArray<Layer>;

  /**
   * Returns the Layer type. This string value should not change,
   * as it is used to identify the layer type and icon.
   */
  abstract type: string;

  /**
   * Returns the bounding box for this Layer (or undefined if none exists).
   */
  abstract bounds: Rect | undefined;

  constructor(obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || '';
    this.children = (obj.children || []).map(child => load(child));
  }

  /**
   * Returns the first descendent layer with the specified id.
   */
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

  /**
   * Returns the first descendent layer with the specified name.
   */
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

  /**
   * Walks the layer tree, executing beforeFunc on each node using a
   * preorder traversal.
   */
  walk(beforeFn: (layer: Layer) => void) {
    const visitFn = (layer: Layer) => {
      beforeFn(layer);
      layer.children.forEach(l => visitFn(l));
    };
    visitFn(this);
  }

  /**
   * Returns the JSON representation of this layer.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
    };
  }

  /**
   * Returns a shallow clone of this Layer.
   */
  abstract clone(): Layer;

  /**
   * Returns a deep clone of this Layer.
   */
  abstract deepClone(): Layer;
}

// TODO: share this interface with Layer?
interface LayerArgs {
  id?: string;
  name: string;
  children: ReadonlyArray<Layer>;
}

export interface Layer extends LayerArgs, Inspectable, Animatable {}
export interface ConstructorArgs extends LayerArgs {}

function load(obj: Layer | any): Layer {
  if (obj instanceof Layer) {
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
