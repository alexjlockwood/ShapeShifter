import * as paper from 'paper';

import { ShapeGesture } from './ShapeGesture';

/**
 * A gesture that creates a rectangular path.
 */
export class RectangleGesture extends ShapeGesture {
  // @Override
  protected newPath(bounds: paper.Rectangle) {
    return new paper.Path.Rectangle(bounds);
  }
}
