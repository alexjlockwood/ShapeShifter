import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import { PaperUtil } from 'app/scripts/paper/util';
import { FocusedPathInfo, PathOverlayInfo } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

import { FocusedPathRaster } from './FocusedPathRaster';
import { PivotType, SelectionBoundsRaster } from './SelectionBoundsRaster';

// TODO: use Item#visible to hook up 'visible layer ids' from store
export class PaperLayer extends paper.Layer {
  private vectorLayerItem: paper.Item;
  private selectionBoundsItem: paper.Item;
  private hoverPathItem: paper.Path;
  private selectionBoxItem: paper.Path;
  private pathOverlayItem: paper.Path;
  private focusedPathItem: paper.Item;

  private vectorLayer: VectorLayer;
  private selectedLayerIds: ReadonlySet<string> = new Set();
  private hoveredLayerId: string;
  private focusedPathInfo: FocusedPathInfo;

  setVectorLayer(vl: VectorLayer) {
    this.vectorLayer = vl;
    this.updateVectorLayerItem();
    this.updateFocusedPathItem();
    this.updateSelectionBoundsItem();
    this.updateHoverPathItem();
  }

  setSelectedLayers(layerIds: ReadonlySet<string>) {
    this.selectedLayerIds = new Set(layerIds);
    this.updateSelectionBoundsItem();
  }

  setHoveredLayer(layerId: string) {
    this.hoveredLayerId = layerId;
    this.updateHoverPathItem();
  }

  setPathOverlayInfo(pathOverlayInfo: PathOverlayInfo) {
    if (this.pathOverlayItem) {
      this.pathOverlayItem.remove();
      this.pathOverlayItem = undefined;
    }
    if (pathOverlayInfo) {
      this.pathOverlayItem = newPathOverlayItem(pathOverlayInfo);
      this.updateChildren();
    }
  }

  setSelectionBox(box: { from: paper.Point; to: paper.Point }) {
    if (this.selectionBoxItem) {
      this.selectionBoxItem.remove();
      this.selectionBoxItem = undefined;
    }
    if (box) {
      this.selectionBoxItem = newSelectionBoxItem(box.from, box.to);
      this.updateChildren();
    }
  }

  setFocusedPathInfo(focusedPathInfo: FocusedPathInfo) {
    this.focusedPathInfo = focusedPathInfo;
    this.updateFocusedPathItem();
  }

  private updateVectorLayerItem() {
    if (this.vectorLayerItem) {
      this.vectorLayerItem.remove();
    }
    this.vectorLayerItem = newVectorLayerItem(this.vectorLayer);
    this.updateChildren();
  }

  private updateSelectionBoundsItem() {
    if (this.selectionBoundsItem) {
      this.selectionBoundsItem.remove();
      this.selectionBoundsItem = undefined;
    }
    const selectedItems = Array.from(this.selectedLayerIds).map(id => this.findItemByLayerId(id));
    if (selectedItems.length > 0) {
      this.selectionBoundsItem = newSelectionBoundsItem(
        PaperUtil.transformRectangle(
          PaperUtil.computeBounds(...selectedItems),
          this.matrix.inverted(),
        ),
      );
    }
    this.updateChildren();
  }

  private updateHoverPathItem() {
    if (this.hoverPathItem) {
      this.hoverPathItem.remove();
      this.hoverPathItem = undefined;
    }
    if (this.hoveredLayerId) {
      const item = this.findItemByLayerId(this.hoveredLayerId);
      this.hoverPathItem = newHoverPathItem(item);
    }
    this.updateChildren();
  }

  private updateFocusedPathItem() {
    if (this.focusedPathItem) {
      this.focusedPathItem.remove();
      this.focusedPathItem = undefined;
    }
    if (this.focusedPathInfo) {
      // TODO: is it possible for pathData to be undefined?
      const path = this.findItemByLayerId(this.focusedPathInfo.layerId) as paper.Path;
      this.focusedPathItem = newFocusedPathItem(path, this.focusedPathInfo, this.matrix);
      this.updateChildren();
    }
  }

  private updateChildren() {
    this.children = _.compact([
      this.vectorLayerItem,
      this.selectionBoundsItem,
      this.hoverPathItem,
      this.focusedPathItem,
      this.pathOverlayItem,
      this.selectionBoxItem,
    ]);
  }

  /** Finds the vector layer item with the given layer ID. */
  findItemByLayerId(layerId: string) {
    if (!layerId) {
      return undefined;
    }
    if (this.vectorLayerItem.data.id === layerId) {
      return this.vectorLayerItem;
    }
    return _.first(
      this.vectorLayerItem.getItems({
        match: ({ data: { id } }) => layerId === id,
      }),
    );
  }

  /** Finds all vector layer items that overlap with the specified bounds. */
  findItemsInBounds(bounds: paper.Rectangle, includePartialOverlaps: boolean) {
    return this.vectorLayerItem.getItems({
      // TODO: figure out how to deal with groups and compound paths
      class: paper.Path,
      overlapping: includePartialOverlaps ? new paper.Rectangle(bounds) : undefined,
      inside: includePartialOverlaps ? undefined : new paper.Rectangle(bounds),
    });
  }

  hitTestSelectionBoundsItem(mousePoint: paper.Point) {
    return this.selectionBoundsItem.hitTest(this.globalToLocal(mousePoint), {
      class: SelectionBoundsRaster,
    });
  }

  hitTestFocusedPathItem(mousePoint: paper.Point) {
    return this.focusedPathItem.hitTest(this.globalToLocal(mousePoint), {
      class: FocusedPathRaster,
    });
  }
}

function newVectorLayerItem(vl: VectorLayer): paper.Item {
  const item = new paper.Group();
  if (!vl) {
    return item;
  }
  item.data.id = vl.id;
  item.opacity = vl.alpha;
  item.addChildren(
    vl.children.map(function recurseFn(layer: Layer) {
      if (layer instanceof PathLayer) {
        // TODO: return a compound path instead
        return fromPathLayer(layer);
      }
      if (layer instanceof ClipPathLayer) {
        // TODO: return a compound path instead
        return fromClipPathLayer(layer);
      }
      if (layer instanceof GroupLayer) {
        const groupItem = fromGroupLayer(layer);
        groupItem.addChildren(layer.children.map(l => recurseFn(l)));
        return groupItem;
      }
      throw new TypeError('Unknown layer type: ' + layer);
    }),
  );
  return item;

  function fromPathLayer(layer: PathLayer) {
    const { fillColor, fillAlpha, strokeColor, strokeAlpha } = layer;
    const { trimPathStart, trimPathEnd, trimPathOffset } = layer;
    // TODO: make sure this works with compound paths as well (Android behavior is different)
    const pathLength = layer.pathData ? layer.pathData.getPathLength() : 0;
    const dashArray = pathLength
      ? LayerUtil.toStrokeDashArray(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
      : undefined;
    const dashOffset = pathLength
      ? LayerUtil.toStrokeDashOffset(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
      : undefined;
    const f = ColorUtil.parseAndroidColor(fillColor);
    const s = ColorUtil.parseAndroidColor(strokeColor);
    // TODO: import a compound path instead
    return new paper.Path({
      data: { id: layer.id },
      pathData: layer.pathData ? layer.pathData.getPathString() : '',
      fillColor: f
        ? new paper.Color(f.r / 255, f.g / 255, f.b / 255, f.a / 255 * fillAlpha)
        : undefined,
      strokeColor: s
        ? new paper.Color(s.r / 255, s.g / 255, s.b / 255, s.a / 255 * strokeAlpha)
        : undefined,
      strokeWidth: layer.strokeWidth,
      miterLimit: layer.strokeMiterLimit,
      strokeJoin: layer.strokeLinejoin,
      strokeCap: layer.strokeLinecap,
      fillRule: layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero',
      dashArray,
      dashOffset,
    });
  }

  function fromClipPathLayer(layer: ClipPathLayer) {
    return new paper.Path({
      data: { id: layer.id },
      pathData: layer.pathData ? layer.pathData.getPathString() : '',
      clipMask: true,
    });
  }

  function fromGroupLayer(layer: GroupLayer) {
    const { pivotX, pivotY, scaleX, scaleY, rotation, translateX, translateY } = layer;
    const pivot = new paper.Matrix(1, 0, 0, 1, pivotX, pivotY);
    const scale = new paper.Matrix(scaleX, 0, 0, scaleY, 0, 0);
    const cosr = Math.cos(rotation * Math.PI / 180);
    const sinr = Math.sin(rotation * Math.PI / 180);
    const rotate = new paper.Matrix(cosr, sinr, -sinr, cosr, 0, 0);
    const translate = new paper.Matrix(1, 0, 0, 1, translateX, translateY);
    const matrix = new paper.Matrix()
      .prepend(pivot.inverted())
      .prepend(scale)
      .prepend(rotate)
      .prepend(translate)
      .prepend(pivot);
    return new paper.Group({ data: { id: layer.id }, matrix });
  }
}

/** Creates a new hover path for the specified item. */
function newHoverPathItem(item: paper.Item) {
  let hoverPath: paper.Path;
  if (item instanceof paper.Group) {
    hoverPath = new paper.Path.Rectangle(item.bounds);
  } else if (item instanceof paper.Path) {
    hoverPath = new paper.Path(item.segments);
    hoverPath.closed = item.closed;
  }
  if (hoverPath) {
    hoverPath.strokeColor = '#009dec';
    hoverPath.guide = true;
    hoverPath.strokeScaling = false;
    hoverPath.strokeWidth = 2 / paper.view.zoom;
    // Transform the hover path from local coordinates to viewport coordinates.
    hoverPath.matrix = item.globalMatrix.prepended(paper.project.activeLayer.matrix.inverted());
  }
  return hoverPath;
}

/**
 * Creates a new selection bounds item for the specified selected items.
 */
function newSelectionBoundsItem(bounds: paper.Rectangle) {
  const group = new paper.Group();

  // Draw an outline for the bounded box.
  const outlinePath = new paper.Path.Rectangle(bounds);
  outlinePath.strokeScaling = false;
  outlinePath.strokeWidth = 2 / paper.view.zoom;
  outlinePath.strokeColor = '#e8e8e8';
  outlinePath.guide = true;
  group.addChild(outlinePath);

  // Create segments for the bounded box.
  const segmentSize = 6 / paper.view.zoom / getCssScaling();
  const createSegmentFn = (pivotType: PivotType) => {
    // TODO: avoid creating rasters in a loop like this
    const center = bounds[pivotType];
    const handle = new SelectionBoundsRaster(pivotType, center);
    const scaleFactor = 1 / getAttrScaling();
    handle.scale(scaleFactor, scaleFactor);
    return handle;
  };

  const pivotTypes: ReadonlyArray<PivotType> = [
    'topLeft',
    'topCenter',
    'topRight',
    'rightCenter',
    'bottomRight',
    'bottomCenter',
    'bottomLeft',
    'leftCenter',
  ];
  pivotTypes.forEach(t => group.addChild(createSegmentFn(t)));

  return group;
}

/**
 * Creates the overlay decorations for the given focused path.
 */
function newFocusedPathItem(
  path: paper.Path,
  focusedPathInfo: FocusedPathInfo,
  paperLayerMatrix: paper.Matrix,
) {
  const group = new paper.Group();
  const scaleFactor = 1 / getAttrScaling();

  const matrix = path.globalMatrix.prepended(paperLayerMatrix.inverted());
  const addRasterFn = (raster: paper.Raster) => {
    raster.scale(scaleFactor, scaleFactor);
    raster.transform(matrix);
    group.addChild(raster);
    return raster;
  };
  const addLineFn = (from: paper.Point, to: paper.Point) => {
    const line = new paper.Path.Line(from, to);
    line.guide = true;
    line.strokeColor = '#aaaaaa';
    line.strokeWidth = 1 / paper.view.zoom;
    line.strokeScaling = false;
    line.transform(matrix);
    group.addChild(line);
  };
  const {
    selectedSegments,
    visibleHandleIns,
    selectedHandleIn,
    visibleHandleOuts,
    selectedHandleOut,
  } = focusedPathInfo;
  // TODO: avoid creating rasters in a loop like this
  path.segments.forEach(({ point, handleIn, handleOut }, segmentIndex) => {
    const center = point;
    if (handleIn && visibleHandleIns.has(segmentIndex)) {
      handleIn = center.add(handleIn);
      addLineFn(center, handleIn);
      addRasterFn(
        new FocusedPathRaster(
          'handle-in',
          segmentIndex,
          selectedHandleIn === segmentIndex,
          handleIn,
        ),
      );
    }
    if (handleOut && visibleHandleOuts.has(segmentIndex)) {
      handleOut = center.add(handleOut);
      addLineFn(center, handleOut);
      addRasterFn(
        new FocusedPathRaster(
          'handle-out',
          segmentIndex,
          selectedHandleOut === segmentIndex,
          handleOut,
        ),
      );
    }
    addRasterFn(
      new FocusedPathRaster('segment', segmentIndex, selectedSegments.has(segmentIndex), center),
    );
  });
  return group;
}

function newPathOverlayItem(pathOverlayInfo: PathOverlayInfo) {
  const path = new paper.Path(pathOverlayInfo.pathData);
  path.guide = true;
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.strokeColor = pathOverlayInfo.strokeColor;
  return path;
}

function newSelectionBoxItem(from: paper.Point, to: paper.Point) {
  const path = new paper.Path.Rectangle(new paper.Rectangle(from, to));
  path.guide = true;
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.strokeColor = '#aaaaaa';
  path.dashArray = [3 / paper.view.zoom];
  return path;
}

/** Creates a new 'split segment at location' hover item. */
// function newSplitSegmentAtLocationHover({ curve, point, path }: paper.CurveLocation) {
//   const group = new paper.Group();
//   group.guide = true;

//   const highlightedCurve = new paper.Path([curve.segment1, curve.segment2]);
//   highlightedCurve.guide = true;
//   highlightedCurve.matrix = path.matrix.clone();
//   highlightedCurve.strokeColor = 'red';
//   highlightedCurve.strokeWidth = 4 / paper.view.zoom;
//   group.addChild(highlightedCurve);

//   const highlightedPoint = new paper.Path.Circle(point, 7 / paper.view.zoom);
//   highlightedPoint.guide = true;
//   highlightedPoint.fillColor = 'green';
//   group.addChild(highlightedPoint);

//   return group;
// }

/** Creates a new pen segment preview path. */
// function newPenSegmentPreview(from: paper.Segment, to: paper.Point) {
//   const path = new paper.Path({
//     guide: true,
//     strokeWidth: 4 / paper.view.zoom,
//     strokeColor: 'red',
//   });
//   const fromPoint = from.point.clone();
//   const fromHandleIn = from.handleIn ? from.handleIn.clone() : undefined;
//   const fromHandleOut = from.handleOut ? from.handleOut.clone() : undefined;
//   path.add(
//     new paper.Segment({
//       point: fromPoint,
//       handleIn: fromHandleIn,
//       handleOut: fromHandleOut,
//     }),
//   );
//   path.add(to.clone());
//   return path;
// }

/**
 * Returns the project's CSS scale factor, representing the number of CSS pixels
 * per viewport pixel.
 */
function getCssScaling() {
  // Given unit vectors u0 = (0, 1) and v0 = (1, 0).
  //
  // After matrix mapping, we get u1 and v1. Let Θ be the angle between u1 and v1.
  // Then the final scale we want is:
  //
  // Math.min(|u1|sin(Θ),|v1|sin(Θ)) = |u1||v1|sin(Θ) / Math.max(|u1|,|v1|)
  //
  // If Math.max(|u1|,|v1|) = 0, that means either x or y has a scale of 0.
  //
  // For the non-skew case, which is most of the cases, matrix scale is
  // computing exactly the scale on x and y axis, and take the minimal of these two.
  //
  // For the skew case, an unit square will mapped to a parallelogram,
  // and this function will return the minimal height of the 2 bases.
  const { matrix } = paper.project.activeLayer;
  const m = new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, 0, 0);
  const u0 = new paper.Point(0, 1);
  const v0 = new paper.Point(1, 0);
  const u1 = u0.transform(m);
  const v1 = v0.transform(m);
  const sx = Math.hypot(u1.x, u1.y);
  const sy = Math.hypot(v1.x, v1.y);
  const dotProduct = u1.y * v1.x - u1.x * v1.y;
  const maxScale = Math.max(sx, sy);
  return maxScale > 0 ? Math.abs(dotProduct) / maxScale : 0;
}

/**
 * Returns the project's physical scale factor, representing the number of physical
 * pixels per viewport pixel.
 */
function getAttrScaling() {
  return getCssScaling() * devicePixelRatio;
}
