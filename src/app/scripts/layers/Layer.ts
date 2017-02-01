import { Matrix } from '../common';
import { GroupLayer, ClipPathLayer, PathLayer } from '.';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export interface Layer {

  /** This layers children layers, or undefined if none exist. */
  children: (GroupLayer | ClipPathLayer | PathLayer)[] | undefined;

  /** A string uniquely identifying this layer in its tree. */
  id: string;

  /** Returns the first descendent layer with the specified ID. */
  findLayerById(id: string): Layer | undefined;

  /**
   * Returns true iff this layer is structurally identical with the
   * specified layer. Two layers are 'structurally identical' if they
   * have the same structure (i.e. each path has the same number of
   * parent group layers, each path has a corresponding path with the
   * same id in the other layer, etc.).
   */
  isStructurallyIdenticalWith(layer: Layer): boolean;

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
  walk(
    beforeFn: (layer: Layer, transforms?: Matrix[]) => void,
    startingTransforms?: Matrix[]): void;
}
