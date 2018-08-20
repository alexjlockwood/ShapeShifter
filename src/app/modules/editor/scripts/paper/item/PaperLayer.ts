import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import {
  CreatePathInfo,
  EditPathInfo,
  SnapGuideInfo,
  SplitCurveInfo,
  TooltipInfo,
} from 'app/modules/editor/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

import { EditPathRaster } from './EditPathRaster';
import { RotateItemsPivotRaster } from './RotateItemsPivotRaster';
import { SelectionBoundsRaster } from './SelectionBoundsRaster';

/**
 * The root layer used of our paper.js project. Note that this layer is
 * assigned a scale matrix that converts global project coordinates to
 * viewport coordinates.
 *
 * TODO: scaling rasters down causes their hit tolerances remain the same
 * TODO: when multiple items selected, show lightly outlined bounds for individual items?
 * TODO: explicitly set paths with no Z to closed? (i.e. M 1 1 h 6 v 6 h -6 v -6)
 * TODO: figure out if we can reduce stable bundle sizes (tree shake paper.js?)
 */
export class PaperLayer extends paper.Layer {
  private canvasColorRect: paper.Path.Rectangle;
  private vectorLayerItem: paper.Item;
  private selectionBoundsItem: paper.Item;
  private rotateItemsPivotItem: paper.Item;
  private hoverPathItem: paper.Path;
  private selectionBoxItem: paper.Path;
  private createPathItem: paper.Path;
  private splitCurveItem: paper.Item;
  private editPathItem: paper.Item;
  private snapGuideItem: paper.Item;
  private pixelGridItem: paper.Item;
  private tooltipItem: paper.Item;

  private cssScaling = 1;

  constructor(private readonly ps: PaperService) {
    super();
    this.canvasColorRect = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(0, 0));
    this.canvasColorRect.guide = true;
    this.updateChildren();
  }

  private get vectorLayer() {
    return this.ps.getVectorLayer();
  }

  private get selectedLayerIds() {
    return this.ps.getSelectedLayerIds();
  }

  private get hoveredLayerId() {
    return this.ps.getHoveredLayerId();
  }

  private get hiddenLayerIds() {
    return this.ps.getHiddenLayerIds();
  }

  private get editPathInfo() {
    return this.ps.getEditPathInfo();
  }

  private get rotateItemsInfo() {
    return this.ps.getRotateItemsInfo();
  }

  hitTestVectorLayer(projPoint: paper.Point) {
    const { width: vpWidth, height: vpHeight } = this.vectorLayer;
    const vpBounds = new paper.Rectangle(0, 0, vpWidth, vpHeight);
    const vpPoint = this.vectorLayerItem.globalToLocal(projPoint);
    if (!vpBounds.contains(vpPoint)) {
      return { hitItem: undefined, children: [] };
    }
    const hitResult = (function recurseFn(item: paper.Item): HitResult {
      const localPoint = item.globalToLocal(projPoint).transform(item.matrix);
      let hitItem: paper.Item;
      let children: HitResult[] = [];
      if (item instanceof paper.Path) {
        // TODO: figure out what to do with compound paths?
        const res = item.hitTest(localPoint, { fill: true, stroke: true });
        if (res) {
          hitItem = res.item;
        }
      } else if (item instanceof paper.Group) {
        const { strokeBounds } = item;
        if (strokeBounds.contains(localPoint)) {
          hitItem = item;
          children = item.children.map(recurseFn).filter(r => !!r.hitItem);
        }
      }
      return { hitItem, children };
    })(this.vectorLayerItem);
    return {
      hitItem: this.vectorLayerItem,
      children: hitResult.children,
    };
  }

  setDimensions(
    viewportWidth: number,
    viewportHeight: number,
    viewWidth: number,
    viewHeight: number,
  ) {
    // Note that viewWidth / viewportWidth === viewHeight / viewportHeight.
    this.cssScaling = viewWidth / viewportWidth;
    this.matrix = new paper.Matrix().scale(this.cssScaling);
    this.updatePixelGridItem(viewportWidth, viewportHeight);
  }

  onVectorLayerChanged() {
    this.updateCanvasColorShape();
    this.updateVectorLayerItem();
    this.updateEditPathItem();
    this.updateSelectionBoundsItem();
    this.updateRotateItemsPivotItem();
    this.updateHoverPathItem();
  }

  onSelectedLayerIdsChanged() {
    this.updateSelectionBoundsItem();
    this.updateRotateItemsPivotItem();
  }

  onHiddenLayerIdsChanged() {
    this.updateHiddenLayers();
    // TODO: should we hide selection bounds, overlays, etc. for invisible layers?
  }

  onHoveredLayerIdChanged() {
    this.updateHoverPathItem();
  }

  onEditPathInfoChanged() {
    this.updateEditPathItem();
    this.updateSelectionBoundsItem();
    this.updateRotateItemsPivotItem();
  }

  onRotateItemsInfoChanged() {
    this.updateRotateItemsPivotItem();
  }

  setCreatePathInfo(info: CreatePathInfo) {
    if (this.createPathItem) {
      this.createPathItem.remove();
      this.createPathItem = undefined;
    }
    if (info) {
      this.createPathItem = newCreatePathItem(info);
      this.updateChildren();
    }
  }

  setSplitCurveInfo(info: SplitCurveInfo) {
    if (this.splitCurveItem) {
      this.splitCurveItem.remove();
      this.splitCurveItem = undefined;
    }
    if (info) {
      this.splitCurveItem = newSplitCurveItem(info, this.cssScaling);
      this.updateChildren();
    }
  }

  setTooltipInfo(info: TooltipInfo) {
    if (this.tooltipItem) {
      this.tooltipItem.remove();
      this.tooltipItem = undefined;
    }
    if (info) {
      // TODO: re-enable tooltip when ready
      // this.tooltipItem = newTooltipItem(info, this.cssScaling);
      this.updateChildren();
    }
  }

  setSnapGuideInfo(info: SnapGuideInfo) {
    if (this.snapGuideItem) {
      this.snapGuideItem.remove();
      this.snapGuideItem = undefined;
    }
    if (info) {
      this.snapGuideItem = newSnapGuideItem(info, this.cssScaling);
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

  private updateCanvasColorShape() {
    this.canvasColorRect = new paper.Path.Rectangle(
      new paper.Point(0, 0),
      new paper.Size(this.vectorLayer.width, this.vectorLayer.height),
    );
    this.canvasColorRect.guide = true;
    this.canvasColorRect.fillColor = parseAndroidColor(this.vectorLayer.canvasColor) || 'white';
    this.updateChildren();
  }

  private updateVectorLayerItem() {
    if (this.vectorLayerItem) {
      this.vectorLayerItem.remove();
    }
    this.vectorLayerItem = newVectorLayerItem(this.vectorLayer);
    this.updateHiddenLayers();
    this.updateChildren();
  }

  private updateSelectionBoundsItem() {
    if (this.selectionBoundsItem) {
      this.selectionBoundsItem.remove();
      this.selectionBoundsItem = undefined;
    }
    if (!this.editPathInfo) {
      const selectedItemBounds = this.getSelectedItemBounds();
      if (selectedItemBounds) {
        this.selectionBoundsItem = newSelectionBoundsItem(selectedItemBounds, this.cssScaling);
      }
    }
    this.updateChildren();
  }

  private updateRotateItemsPivotItem() {
    if (this.rotateItemsPivotItem) {
      this.rotateItemsPivotItem.remove();
      this.rotateItemsPivotItem = undefined;
    }
    const rii = this.rotateItemsInfo;
    if (rii) {
      const selectedItemBounds = this.getSelectedItemBounds();
      if (selectedItemBounds) {
        const vpPivot = rii.pivot ? new paper.Point(rii.pivot) : selectedItemBounds.center;
        this.rotateItemsPivotItem = newRotationPivotItem(vpPivot, this.cssScaling);
      }
    }
    this.updateChildren();
  }

  /**
   * Returns the bounds of the currently selected items in project coordinates.
   * Empty groups will be filtered out. Returns undefined if there are no selected
   * items left to compute.
   */
  private getSelectedItemBounds() {
    const selectedItems = Array.from(this.selectedLayerIds)
      .map(id => this.findItemByLayerId(id))
      // Filter out any selected empty groups.
      .filter(i => !(i instanceof paper.Group) || i.children.length);
    if (selectedItems.length === 0) {
      return undefined;
    }
    return PaperUtil.transformRectangle(
      PaperUtil.computeBounds(selectedItems),
      this.matrix.inverted(),
    );
  }

  private updateHiddenLayers() {
    const hiddenLayerIds = this.hiddenLayerIds;
    (function recurseFn(item: paper.Item) {
      item.visible = !hiddenLayerIds.has(item.data.id);
      if (item.hasChildren()) {
        item.children.forEach(recurseFn);
      }
    })(this.vectorLayerItem);
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

  private updateEditPathItem() {
    if (this.editPathItem) {
      this.editPathItem.remove();
      this.editPathItem = undefined;
    }
    const epi = this.editPathInfo;
    const selectedLayerIds = this.selectedLayerIds;
    if (epi && selectedLayerIds.size) {
      // TODO: is it possible for pathData to be undefined?
      const path = this.findItemByLayerId(selectedLayerIds.values().next().value) as paper.Path;
      this.editPathItem = newEditPathItem(path, epi, this.cssScaling);
      this.updateChildren();
    }
  }

  private updatePixelGridItem(viewportWidth: number, viewportHeight: number) {
    if (this.pixelGridItem) {
      this.pixelGridItem.remove();
      this.pixelGridItem = undefined;
    }
    if (this.cssScaling > 4) {
      this.pixelGridItem = newPixelGridItem(viewportWidth, viewportHeight);
      this.updateChildren();
    }
  }

  private updateChildren() {
    this.children = _.compact([
      this.canvasColorRect,
      this.vectorLayerItem,
      this.selectionBoundsItem,
      this.rotateItemsPivotItem,
      this.hoverPathItem,
      this.createPathItem,
      this.splitCurveItem,
      this.editPathItem,
      this.snapGuideItem,
      this.selectionBoxItem,
      this.pixelGridItem,
      this.tooltipItem,
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

  /**
   * Finds all vector layer items that overlap with the specified bounds.
   * Note that the bounds must be in viewport coordinates.
   * @param includePartialOverlaps iff true, include items that partially overlap the bounds
   */
  findItemsInBounds(vpBounds: paper.Rectangle, includePartialOverlaps: boolean) {
    return this.vectorLayerItem.getItems({
      // TODO: figure out how to deal with groups and compound paths
      class: paper.Path,
      overlapping: includePartialOverlaps ? vpBounds : undefined,
      inside: includePartialOverlaps ? undefined : vpBounds,
    });
  }
}

function parseAndroidColor(androidColor: string, alpha = 1) {
  const color = ColorUtil.parseAndroidColor(androidColor);
  return color
    ? new paper.Color(color.r / 255, color.g / 255, color.b / 255, (color.a / 255) * alpha)
    : undefined;
}

function newVectorLayerItem(vl: VectorLayer): paper.Item {
  const item = new paper.Group();
  if (!vl) {
    return item;
  }

  const fromPathLayerFn = (layer: PathLayer) => {
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
    // TODO: import a compound path instead
    // Only paths with more than one command can be closed.
    const closed =
      layer.pathData && layer.pathData.isClosed() && layer.pathData.getCommands().length > 1;
    return new paper.Path({
      data: { id: layer.id },
      pathData: layer.pathData ? layer.pathData.getPathString() : '',
      fillColor: parseAndroidColor(fillColor, fillAlpha),
      strokeColor: parseAndroidColor(strokeColor, strokeAlpha),
      strokeWidth: layer.strokeWidth,
      miterLimit: layer.strokeMiterLimit,
      strokeJoin: layer.strokeLinejoin,
      strokeCap: layer.strokeLinecap,
      fillRule: layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero',
      dashArray,
      dashOffset,
      closed,
    });
  };

  const fromClipPathLayerFn = (layer: ClipPathLayer) => {
    const pathData = layer.pathData ? layer.pathData.getPathString() : '';
    // Only paths with more than one command can be closed.
    const closed =
      layer.pathData && layer.pathData.isClosed() && layer.pathData.getCommands().length > 1;
    return new paper.Path({
      data: { id: layer.id },
      pathData,
      clipMask: true,
      closed,
    });
  };

  const fromGroupLayerFn = (layer: GroupLayer) => {
    const { pivotX, pivotY, scaleX, scaleY, rotation, translateX, translateY } = layer;
    const pivot = new paper.Matrix(1, 0, 0, 1, pivotX, pivotY);
    const scale = new paper.Matrix(scaleX, 0, 0, scaleY, 0, 0);
    const cosr = Math.cos((rotation * Math.PI) / 180);
    const sinr = Math.sin((rotation * Math.PI) / 180);
    const rotate = new paper.Matrix(cosr, sinr, -sinr, cosr, 0, 0);
    const translate = new paper.Matrix(1, 0, 0, 1, translateX, translateY);
    const matrix = new paper.Matrix()
      .prepend(pivot.inverted())
      .prepend(scale)
      .prepend(rotate)
      .prepend(translate)
      .prepend(pivot);
    return new paper.Group({ data: { id: layer.id }, matrix });
  };

  item.data.id = vl.id;
  item.opacity = vl.alpha;
  item.addChildren(
    vl.children.map(function recurseFn(layer: Layer) {
      if (layer instanceof PathLayer) {
        // TODO: return a compound path instead
        return fromPathLayerFn(layer);
      }
      if (layer instanceof ClipPathLayer) {
        // TODO: return a compound path instead
        return fromClipPathLayerFn(layer);
      }
      if (layer instanceof GroupLayer) {
        const groupItem = fromGroupLayerFn(layer);
        groupItem.addChildren(layer.children.map(l => recurseFn(l)));
        return groupItem;
      }
      throw new TypeError('Unknown layer type: ' + layer);
    }),
  );
  return item;
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
    hoverPath.matrix = item.globalMatrix
      .prepended(paper.project.activeLayer.matrix.inverted())
      .prepend(item.matrix.inverted());
  }
  return hoverPath;
}

// TODO: reuse this code with SelectionBoundsRaster, etc.
const PIVOT_TYPES: Readonly<
  [
    'topLeft',
    'topCenter',
    'topRight',
    'rightCenter',
    'bottomRight',
    'bottomCenter',
    'bottomLeft',
    'leftCenter'
  ]
> = [
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
  'bottomLeft',
  'leftCenter',
];

/**
 * Creates a new selection bounds item for the specified selected items.
 */
function newSelectionBoundsItem(bounds: paper.Rectangle, cssScaling: number) {
  const group = new paper.Group();

  // Draw an outline for the bounded box.
  const outlinePath = new paper.Path.Rectangle(bounds);
  outlinePath.strokeScaling = false;
  outlinePath.strokeWidth = 2 / paper.view.zoom;
  outlinePath.strokeColor = '#e8e8e8';
  outlinePath.guide = true;
  group.addChild(outlinePath);

  // Create segments for the bounded box.
  PIVOT_TYPES.forEach(pivotType => {
    // TODO: avoid creating rasters in a loop like this
    const center = bounds[pivotType];
    const handle = SelectionBoundsRaster.of(pivotType, center);
    const scaleFactor = getRasterScaleFactor(cssScaling);
    handle.scale(scaleFactor, scaleFactor);
    group.addChild(handle);
  });

  return group;
}

/**
 * Creates a rotation pivot point at the specified position.
 */
function newRotationPivotItem(position: paper.Point, cssScaling: number) {
  const pivot = RotateItemsPivotRaster.of(position);
  const scaleFactor = getRasterScaleFactor(cssScaling);
  pivot.scale(scaleFactor, scaleFactor);
  return pivot;
}

/**
 * Creates the overlay decorations for the given edit path.
 */
function newEditPathItem(path: paper.Path, info: EditPathInfo, cssScaling: number) {
  const group = new paper.Group();
  const scaleFactor = getRasterScaleFactor(cssScaling);

  const matrix = path.globalMatrix.prepended(
    new paper.Matrix(1 / cssScaling, 0, 0, 1 / cssScaling, 0, 0),
  );
  const addRasterFn = (raster: paper.Raster) => {
    raster.scale(scaleFactor, scaleFactor);
    group.addChild(raster);
    return raster;
  };
  const addLineFn = (from: paper.Point, to: paper.Point) => {
    const line = new paper.Path.Line(from, to);
    line.guide = true;
    line.strokeColor = '#aaaaaa';
    line.strokeWidth = 1 / paper.view.zoom;
    line.strokeScaling = false;
    // line.transform(matrix);
    group.addChild(line);
  };
  const {
    selectedSegments,
    visibleHandleIns,
    selectedHandleIn,
    visibleHandleOuts,
    selectedHandleOut,
  } = info;
  // TODO: avoid creating rasters in a loop like this
  path.segments.forEach(({ point, handleIn, handleOut }, segmentIndex) => {
    const center = point.transform(matrix);
    if (handleIn && visibleHandleIns.has(segmentIndex)) {
      handleIn = point.add(handleIn).transform(matrix);
      addLineFn(center, handleIn);
      addRasterFn(
        new EditPathRaster('handle-in', segmentIndex, selectedHandleIn === segmentIndex, handleIn),
      );
    }
    if (handleOut && visibleHandleOuts.has(segmentIndex)) {
      handleOut = point.add(handleOut).transform(matrix);
      addLineFn(center, handleOut);
      addRasterFn(
        new EditPathRaster(
          'handle-out',
          segmentIndex,
          selectedHandleOut === segmentIndex,
          handleOut,
        ),
      );
    }
    addRasterFn(
      new EditPathRaster('segment', segmentIndex, selectedSegments.has(segmentIndex), center),
    );
  });
  return group;
}

function getRasterScaleFactor(cssScaling: number) {
  return 1 / (1.8 * cssScaling * paper.view.zoom);
}

function newCreatePathItem(info: CreatePathInfo) {
  const path = new paper.Path(info.pathData);
  path.guide = true;
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.strokeColor = info.strokeColor;
  return path;
}

function newSplitCurveItem(info: SplitCurveInfo, cssScaling: number) {
  const group = new paper.Group();
  group.guide = true;

  const { splitPoint, segment1, segment2 } = info;
  const point1 = new paper.Point(segment1.point);
  const handleIn1 = new paper.Point(segment1.handleIn);
  const handleOut1 = new paper.Point(segment1.handleOut);
  const point2 = new paper.Point(segment2.point);
  const handleIn2 = new paper.Point(segment2.handleIn);
  const handleOut2 = new paper.Point(segment2.handleOut);
  const highlightedCurve = new paper.Path([
    new paper.Segment(point1, handleIn1, handleOut1),
    new paper.Segment(point2, handleIn2, handleOut2),
  ]);
  highlightedCurve.guide = true;
  highlightedCurve.strokeColor = '#3466A9';
  highlightedCurve.strokeScaling = false;
  highlightedCurve.strokeWidth = 2 / paper.view.zoom;
  group.addChild(highlightedCurve);

  const highlightedPoint = new paper.Path.Circle(
    new paper.Point(splitPoint),
    4 / paper.view.zoom / cssScaling,
  );
  highlightedPoint.guide = true;
  highlightedPoint.fillColor = '#3466A9';
  group.addChild(highlightedPoint);

  return group;
}

// TODO: add rounded rect background for tooltip
// TODO: ensure tooltip is justified correctly w/ respect to the active item
// function newTooltipItem(info: TooltipInfo, cssScaling: number) {
//   return new paper.PointText({
//     point: info.point,
//     content: info.label,
//     fillColor: 'red',
//     justification: 'left',
//     // TODO: text doesn't display when using font size of only 12?
//     fontSize: 14 / paper.view.zoom / cssScaling,
//     fontFamily: 'Roboto, Helvetica Neue, sans-serif',
//     guide: true,
//   });
// }

function newSnapGuideItem(info: SnapGuideInfo, cssScaling: number) {
  const group = new paper.Group({ guide: true });

  const newLineFn = (from: paper.Point, to: paper.Point) => {
    const line = new paper.Path.Line(from, to);
    line.guide = true;
    line.strokeScaling = false;
    line.strokeWidth = 1 / paper.view.zoom;
    line.strokeColor = 'red';
    return line;
  };

  info.guides.forEach(({ from, to }) => {
    group.addChild(newLineFn(new paper.Point(from), new paper.Point(to)));
  });

  const addToAngleFn = (point: paper.Point, angle: number) => {
    point = point.clone();
    point.angle += angle;
    return point;
  };

  const newHandleLineFn = (endPoint: paper.Point, handle: paper.Point) => {
    const from = endPoint.add(addToAngleFn(handle, 90));
    const to = endPoint.add(addToAngleFn(handle, -90));
    return newLineFn(from, to);
  };

  const newRulerLabelFn = (point: paper.Point, content: string) => {
    // TODO: use a better font (roboto?)
    // TODO: add padding above/to the side of the label
    return new paper.PointText({
      point,
      content,
      fillColor: 'red',
      // TODO: add justification so it displays to the bottom-left of the current point
      fontSize: 12 / paper.view.zoom / cssScaling,
      guide: true,
    });
  };

  const handleLengthPixels = 4;
  const matrix = new paper.Matrix(cssScaling, 0, 0, cssScaling, 0, 0);
  info.rulers.forEach(line => {
    const from = new paper.Point(line.from);
    const to = new paper.Point(line.to);
    const mid = from.add(to.subtract(from).multiply(0.5));
    const globalFrom = from.transform(matrix);
    const globalTo = to.transform(matrix);
    const rulerHandle = globalTo
      .subtract(globalFrom)
      .normalize()
      .multiply(handleLengthPixels)
      .transform(matrix.inverted());
    // TODO: make sure the rounded vs. actual values are equal!
    // TODO: only display decimals for small viewports
    const pointTextLabel = _.round(from.getDistance(to), 1).toString();
    group.addChildren([
      newLineFn(from, to),
      newHandleLineFn(from, rulerHandle),
      newHandleLineFn(to, rulerHandle),
      newRulerLabelFn(mid, pointTextLabel),
    ]);
  });

  return group;
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

function newPixelGridItem(viewportWidth: number, viewportHeight: number) {
  const group = new paper.Group({ guide: true });
  const newLineFn = (from: paper.Point, to: paper.Point) => {
    const line = new paper.Path.Rectangle(from, to);
    line.strokeColor = '#808080';
    line.opacity = 0.25;
    line.strokeScaling = false;
    line.strokeWidth = 1;
    line.guide = true;
    return line;
  };
  for (let x = 1; x < viewportWidth; x++) {
    group.addChild(newLineFn(new paper.Point(x, 0), new paper.Point(x, viewportHeight)));
  }
  for (let y = 1; y < viewportHeight; y++) {
    group.addChild(newLineFn(new paper.Point(0, y), new paper.Point(viewportWidth, y)));
  }
  return group;
}

export interface HitResult {
  hitItem: paper.Item | undefined;
  children: ReadonlyArray<HitResult>;
}
