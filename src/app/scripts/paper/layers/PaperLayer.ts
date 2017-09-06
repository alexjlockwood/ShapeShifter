import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import { Items } from 'app/scripts/paper/util';
import * as _ from 'lodash';
import * as paper from 'paper';

export class PaperLayer extends paper.Layer {
  private readonly itemGroup = new paper.Group();
  private readonly overlayGroup = new paper.Group();
  private selectedLayerIds: Set<string>;
  private hoveredLayerId: string;

  constructor() {
    super();
    this.addChildren([this.itemGroup, this.overlayGroup]);
  }

  setVectorLayer(vl: VectorLayer) {
    // TODO: make this more efficient?
    this.itemGroup.removeChildren();
    this.overlayGroup.removeChildren();
    const { item, overlay } = fromVectorLayer(vl);
    this.itemGroup.addChild(item);
    this.overlayGroup.addChild(overlay);

    // TODO: update selections/hovers in case this is set late
  }

  setSelectedLayerIds(layerIds: Set<string>) {
    this.selectedLayerIds = new Set(layerIds);
  }

  // TODO: make this more efficient
  // TODO: make sure this works when setVectorLayer() hasn't been called yet
  setHoveredLayerId(layerId: string) {
    const prevHoveredLayerId = this.hoveredLayerId;
    if (prevHoveredLayerId) {
      const overlay = this.findOverlayByLayerId(prevHoveredLayerId);
      overlay.removeChildren();
    }
    this.hoveredLayerId = layerId;
    if (layerId) {
      const overlay = this.findOverlayByLayerId(layerId);
      const path = this.findItemByLayerId(layerId) as paper.Path;
      overlay.addChild(this.newHoverPath(path));
    }
  }

  findItemByLayerId(layerId: string) {
    return findByLayerId(this.itemGroup, layerId);
  }

  findOverlayByLayerId(layerId: string) {
    return findByLayerId(this.overlayGroup, layerId);
  }

  // TODO: make this support groups and compound paths as well
  private newHoverPath(path: paper.Path) {
    const hoverPath = new paper.Path(path.segments);
    hoverPath.closed = path.closed;
    hoverPath.strokeScaling = false;
    hoverPath.strokeColor = '#009dec';
    hoverPath.guide = true;
    hoverPath.strokeWidth = 2 / paper.view.zoom;
    return hoverPath;
  }

  private newSelectionBoundsPath(bounds: paper.Rectangle) {
    const rect = new paper.Path.Rectangle(bounds);
    rect.curves[0].divideAtTime(0.5);
    rect.curves[2].divideAtTime(0.5);
    rect.curves[4].divideAtTime(0.5);
    rect.curves[6].divideAtTime(0.5);
    rect.strokeScaling = false;
    rect.fullySelected = true;
    rect.strokeWidth = 1 / paper.view.zoom;
    rect.strokeColor = '#009dec';
    return rect;
  }

  private newSelectionBoxPath(from: paper.Point, to: paper.Point) {
    const midPoint = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
    const rect = new paper.Path.Rectangle(
      new paper.Rectangle(from.add(midPoint), to.add(midPoint)),
    );
    rect.strokeWidth = 1 / paper.view.zoom;
    rect.guide = true;
    rect.strokeColor = '#aaaaaa';
    rect.dashArray = [3 / paper.view.zoom, 3 / paper.view.zoom];
    return rect;
  }
}

function findByLayerId(root: paper.Item, layerId: string) {
  return layerId
    ? _.first(root.getItems({ match: ({ data: { id } }) => layerId === id }))
    : undefined;
}

function fromVectorLayer(vl: VectorLayer) {
  return (function recurseFn(layer: Layer) {
    if (layer instanceof PathLayer) {
      const { fillColor, fillAlpha, strokeColor, strokeAlpha } = layer;
      const { trimPathStart, trimPathEnd, trimPathOffset } = layer;
      const pathData = layer.pathData ? layer.pathData.getPathString() : '';
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
      return {
        item: new paper.Path({
          data: { id: layer.id },
          pathData,
          fillColor: f ? new paper.Color(f.r, f.g, f.b, f.a * fillAlpha) : undefined,
          strokeColor: s ? new paper.Color(s.r, s.g, s.b, s.a * strokeAlpha) : undefined,
          strokeWidth: layer.strokeWidth,
          miterLimit: layer.strokeMiterLimit,
          strokeJoin: layer.strokeLinejoin,
          strokeCap: layer.strokeLinecap,
          fillRule: layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero',
          dashArray,
          dashOffset,
        }),
        overlay: new paper.Group({
          data: { id: layer.id },
          strokeScaling: false,
        }),
      };
    }
    if (layer instanceof ClipPathLayer) {
      // TODO: import a compound path instead
      const pathData = layer.pathData ? layer.pathData.getPathString() : '';
      return {
        item: new paper.Path({
          data: { id: layer.id },
          pathData,
          clipMask: true,
        }),
        overlay: new paper.Group({
          data: { id: layer.id },
          strokeScaling: false,
        }),
      };
    }
    if (layer instanceof GroupLayer) {
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
      const children = layer.children.map(l => recurseFn(l));
      return {
        item: new paper.Group({
          data: { id: layer.id },
          matrix: matrix.clone(),
          children: children.map(({ item: i }) => i),
        }),
        overlay: new paper.Group({
          data: { id: layer.id },
          matrix: matrix.clone(),
          children: children.map(({ overlay: o }) => o),
          strokeScaling: false,
        }),
      };
    }
    if (layer instanceof VectorLayer) {
      const children = layer.children.map(l => recurseFn(l));
      return {
        item: new paper.Group({
          data: { id: layer.id },
          children: children.map(({ item: i }) => i),
        }),
        overlay: new paper.Group({
          data: { id: layer.id },
          children: children.map(({ overlay: o }) => o),
          strokeScaling: false,
        }),
      };
    }
    throw new TypeError('Unknown layer type: ' + layer);
  })(vl);
}

// function getScaleFactor(matrix: paper.Matrix) {
//   // Given unit vectors u0 = (0, 1) and v0 = (1, 0).
//   //
//   // After matrix mapping, we get u1 and v1. Let Θ be the angle between u1 and v1.
//   // Then the final scale we want is:
//   //
//   // Math.min(|u1|sin(Θ),|v1|sin(Θ)) = |u1||v1|sin(Θ) / Math.max(|u1|,|v1|)
//   //
//   // If Math.max(|u1|,|v1|) = 0, that means either x or y has a scale of 0.
//   //
//   // For the non-skew case, which is most of the cases, matrix scale is
//   // computing exactly the scale on x and y axis, and take the minimal of these two.
//   //
//   // For the skew case, an unit square will mapped to a parallelogram,
//   // and this function will return the minimal height of the 2 bases.
//   const m = new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, 0, 0);
//   const u0 = new paper.Point(0, 1);
//   const v0 = new paper.Point(1, 0);
//   const u1 = u0.transform(m);
//   const v1 = v0.transform(m);
//   const sx = Math.hypot(u1.x, u1.y);
//   const sy = Math.hypot(v1.x, v1.y);
//   const dotProduct = u1.y * v1.x - u1.x * v1.y;
//   const maxScale = Math.max(sx, sy);
//   return maxScale > 0 ? Math.abs(dotProduct) / maxScale : 0;
// }
