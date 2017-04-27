import { GroupLayer, ClipPathLayer, PathLayer } from '.';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export interface Layer {

  /**
   * This layers children layers, or undefined if none exist.
   */
  readonly children: (GroupLayer | ClipPathLayer | PathLayer)[] | undefined;

  /**
   * A string uniquely identifying this layer in its tree.
   */
  readonly id: string;

  /**
   * Returns the first descendent layer with the specified ID.
   */
  findLayer(id: string): Layer | undefined;

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
