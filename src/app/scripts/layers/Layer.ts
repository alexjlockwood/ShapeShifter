import { Inspectable, Animatable } from '../properties';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export interface Layer extends Inspectable, Animatable {

  /**
   * A non-user-visible string that uniquely identifies this layer in the tree.
   */
  readonly id: string;

  /**
   * A user-visible string uniquely identifying this layer in the tree. This value
   * can be renamed, as long as it doesn't conflict with other layers in the tree.
   */
  name: string;

  /**
   * This layers children layers, or undefined if none exist.
   */
  // TODO: make this a readonly array?
  children: Layer[];

  parent: Layer | undefined;
  previousSibling: Layer | undefined;
  nextSibling: Layer | undefined;
  getSibling(offset: number): Layer | undefined;
  remove(): void;
  clone<T extends Layer>(): T;
  deepClone<T extends Layer>(): T;
  getType(): Type;

  /**
   * Returns the first descendent layer with the specified name.
   */
  findLayer(name: string): Layer | undefined;

  /**
   * Returns true iff this layer is morphable with the specified layer. Two
   * paths are 'morphable' if they have the same number of SVG commands,
   * each in the same order and with the same number of point parameters.
   * Two layers are morphable if they are structurally identical and if
   * each pair of paths are morphable with each other.
   */
  isMorphableWith(layer: Layer): boolean;

  /**
   * Interpolate this layer between a start and end layer of the same type.
   */
  interpolate<T extends Layer>(start: T, end: T, fraction: number): void;

  /**
   * Walks the layer tree, executing beforeFunc on each node using a
   * preorder traversal.
   */
  walk(beforeFn: (layer: Layer) => void): void;

  /**
   * Returns true iff this layer is a PathLayer.
   */
  isPathLayer(): boolean;

  /**
   * Returns true iff this layer is a GroupLayer.
   */
  isGroupLayer(): boolean;

  /**
   * Returns true iff this layer is a ClipPathLayer.
   */
  isClipPathLayer(): boolean;

  /**
   * Returns true iff this layer is a VectorLayer.
   */
  isVectorLayer(): boolean;
}

export type Type = 'vectorlayer' | 'grouplayer' | 'clippathlayer' | 'pathlayer';
