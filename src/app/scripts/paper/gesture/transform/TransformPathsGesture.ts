// import { MathUtil } from 'app/scripts/common';
import { Gesture } from 'app/scripts/paper/gesture';
// import { PaperLayer, SelectionBoundsRaster } from 'app/scripts/paper/item';
// import { PaperService } from 'app/services';
// import * as _ from 'lodash';
import * as paper from 'paper';
// import * as perspectiveTransform from 'perspective-transform';

// type Quadrilateral = [paper.Point, paper.Point, paper.Point, paper.Point];

/**
 * A gesture that performs transform operations.
 *
 * TODO: finish this
 *
 * Preconditions:
 * - The user is in selection mode.
 * - One or more paths are selected.
 */
export class TransformPathsGesture extends Gesture {
  // private readonly pl = paper.project.activeLayer as PaperLayer;
  // private selectedPaths: ReadonlyArray<paper.Path>;

  // private readonly ps: PaperService,
  // private readonly selectionBoundsRaster: SelectionBoundsRaster,
  constructor() {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // this.ps.setHoveredLayerId(undefined);
    // this.selectedPaths = Array.from(this.ps.getSelectedLayerIds()).map(
    //   id => this.pl.findItemByLayerId(id) as paper.Path,
    // );
    // this.selectedPaths.forEach(path => {
    //   const initialSegmentPositions = path.segments.map(s => s.point.clone());
    //   const { topLeft, bottomLeft, bottomRight, topRight } = path.bounds;
    //   const initialQuad: Quadrilateral = [topLeft, bottomLeft, bottomRight, topRight];
    //   const transformQuad: Quadrilateral = [
    //     topLeft,
    //     bottomLeft,
    //     bottomRight.add(new paper.Point(0, 20)),
    //     topRight.add(new paper.Point(0, -20)),
    //   ];
    //   path.segments.forEach((s, i) => {
    //     s.point = new paper.Point(
    //       distortPoint(initialSegmentPositions[i], initialQuad, transformQuad),
    //     );
    //   });
    // });
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    // const currentPivot = event.modifiers.alt ? this.initialCenter : this.initialPivot;
    // this.currentPivot = this.currentPivot.add(event.delta);
    // const currentSize = this.currentPivot.subtract(currentPivot);
    // const initialSize = event.modifiers.alt ? this.centeredInitialSize : this.initialSize;
    // let sx = 1;
    // let sy = 1;
    // if (!MathUtil.isNearZero(initialSize.x)) {
    //   sx = currentSize.x / initialSize.x;
    // }
    // if (!MathUtil.isNearZero(initialSize.y)) {
    //   sy = currentSize.y / initialSize.y;
    // }
    // if (event.modifiers.shift) {
    //   const signx = sx > 0 ? 1 : -1;
    //   const signy = sy > 0 ? 1 : -1;
    //   sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
    //   sx *= signx;
    //   sy *= signy;
    // }
    // // TODO: set strokeScaling to false?
    // this.selectedPaths.forEach((i, index) => {
    //   i.matrix = this.initialMatrices[index].clone().scale(sx, sy, currentPivot);
    // });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    // Guides.hideSelectionBoundsPath();
    // const selectedItems = Selections.getSelectedItems();
    // if (selectedItems.length) {
    //   Guides.showSelectionBoundsPath(computeBoundingBox(selectedItems));
    // }
  }

  // function getTransformPivot(rect: paper.Rectangle, pivotType: PivotType, isCommandPressed: boolean) {
  //   switch (pivotType) {
  //     case 'bottomLeft':
  //       return isCommandPressed ? rect.topRight : rect.center;
  //     case 'topLeft':
  //       return isCommandPressed ? rect.bottomRight : rect.center;
  //     case 'topRight':
  //       return isCommandPressed ? rect.bottomLeft : rect.center;
  //     case 'bottomRight':
  //       return isCommandPressed ? rect.topLeft : rect.center;
  //     case 'leftCenter':
  //       return rect.rightCenter;
  //     case 'topCenter':
  //       return rect.bottomCenter;
  //     case 'rightCenter':
  //       return rect.leftCenter;
  //     case 'bottomCenter':
  //       return rect.topCenter;
  //   }
}

/** Distorts a source point to a new destination coordinate space. */
// function distortPoint(srcPoint: paper.Point, src: Quadrilateral, dst: Quadrilateral) {
//   const srcCorners = _.flatMap(src, p => [p.x, p.y]);
//   const dstCorners = _.flatMap(dst, p => [p.x, p.y]);
//   const [x, y] = perspectiveTransform(srcCorners, dstCorners).transform(srcPoint.x, srcPoint.y);
//   return { x, y };
// }
