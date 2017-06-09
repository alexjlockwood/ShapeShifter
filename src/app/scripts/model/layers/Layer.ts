import {
  Animatable,
  Inspectable,
} from '../properties';
import { Rect } from 'app/scripts/common';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export interface Layer extends Inspectable, Animatable {

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
   * Returns a shallow clone of this Layer.
   */
  clone<T extends Layer>(): T;

  /**
   * Returns a deep clone of this Layer.
   */
  deepClone<T extends Layer>(): T;

  /**g
   * Returns the name of the icon that represents this Layer type.
   */
  getIconName(): string;

  /**
   * Returns the prefix that represents this Layer type.
   */
  getPrefix(): string;

  /**
   * Returns the bounding box for this Layer (or undefined if none exists).
   */
  getBoundingBox(): Rect | undefined;

  /**
   * Returns the first descendent layer with the specified id.
   */
  findLayerById(id: string): Layer | undefined;

  /**
   * Returns the first descendent layer with the specified name.
   */
  findLayerByName(name: string): Layer | undefined;

  /**
   * Returns true iff this layer is morphable with the specified layer. Two
   * paths are 'morphable' if they have the same number of SVG commands,
   * each in the same order and with the same number of point parameters.
   * Two layers are morphable if they are structurally identical and if
   * each pair of paths are morphable with each other.
   */
  isMorphableWith(layer: Layer): boolean;

  /**
   * Walks the layer tree, executing beforeFunc on each node using a
   * preorder traversal.
   */
  walk(beforeFn: (layer: Layer) => void): void;

  /**
   * Returns the JSON representation of this layer.
   */
  toJSON();
}
