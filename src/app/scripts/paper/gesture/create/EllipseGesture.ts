import * as paper from 'paper';

import { ShapeGesture } from './ShapeGesture';

/**
 * A gesture that creates an elliptical path.
 */
export class EllipseGesture extends ShapeGesture {
  // @Override
  protected newPath(bounds: paper.Rectangle) {
    return new paper.Path.Ellipse(bounds);
  }
}
